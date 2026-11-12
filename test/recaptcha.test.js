// api/_utils/recaptcha.js — every path that cannot positively verify a human fails closed.

const test = require('node:test');
const assert = require('node:assert');

process.env.REACT_APP_SUPABASE_URL = 'https://db.example';
process.env.SUPABASE_SERVICE_KEY = 'service-key';
process.env.ANTHROPIC_API_KEY = 'anthropic-key';

const { verifyRecaptcha, isServerSideFailure, VERIFY_URL } = require('../api/_utils/recaptcha');
const rateLimit = require('../api/_utils/rateLimit');
rateLimit.setRateLimitStore(rateLimit.createMemoryStore());
const analyze = require('../api/analyze');

const GOOD = { success: true, action: 'submit', hostname: 'www.phishscore.ai', score: 0.9 };
function reply(data, ok = true, status) { return { ok, status: status || (ok ? 200 : 500), json: async () => data, text: async () => JSON.stringify(data) }; }
function quiet(t) { t.mock.method(console, 'error', () => {}); t.mock.method(console, 'warn', () => {}); }
function google(t, data, ok = true) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, opts) => { calls.push({ url: String(url), opts }); return reply(data, ok); });
  return calls;
}
const withSecret = (fn) => async (t) => { process.env.RECAPTCHA_SECRET_KEY = 'secret'; try { await fn(t); } finally { delete process.env.RECAPTCHA_SECRET_KEY; } };

test('fails closed when RECAPTCHA_SECRET_KEY is unset', async (t) => {
  quiet(t);
  delete process.env.RECAPTCHA_SECRET_KEY;
  const calls = google(t, GOOD);
  assert.deepStrictEqual(await verifyRecaptcha('tok', { action: 'submit' }), { ok: false, reason: 'not_configured' });
  assert.strictEqual(calls.length, 0);
});

test('fails closed when the token is missing or empty', withSecret(async (t) => {
  const calls = google(t, GOOD);
  for (const tok of [undefined, null, '', 42]) assert.deepStrictEqual(await verifyRecaptcha(tok, { action: 'submit' }), { ok: false, reason: 'missing_token' });
  assert.strictEqual(calls.length, 0);
}));

test('fails closed when no expected action is given', withSecret(async (t) => {
  quiet(t);
  assert.strictEqual((await verifyRecaptcha('tok', {})).reason, 'not_configured');
}));

test('fails closed when Google throws, errors or times out', withSecret(async (t) => {
  quiet(t);
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('fetch failed'); });
  assert.deepStrictEqual(await verifyRecaptcha('tok', { action: 'submit' }), { ok: false, reason: 'unavailable' });
  t.mock.restoreAll(); quiet(t);
  google(t, {}, false);
  assert.deepStrictEqual(await verifyRecaptcha('tok', { action: 'submit' }), { ok: false, reason: 'unavailable' });
  t.mock.restoreAll(); quiet(t);
  t.mock.method(globalThis, 'fetch', (url, opts) => new Promise((_, reject) => opts.signal.addEventListener('abort', () => reject(opts.signal.reason))));
  assert.deepStrictEqual(await verifyRecaptcha('tok', { action: 'submit', timeoutMs: 30 }), { ok: false, reason: 'unavailable' });
}));

for (const [name, data, reason] of [
  ['success false', { success: false, 'error-codes': ['invalid-input-response'] }, 'invalid'],
  ['wrong action', { ...GOOD, action: 'login' }, 'action_mismatch'],
  ['missing action', { ...GOOD, action: undefined }, 'action_mismatch'],
  ['foreign hostname', { ...GOOD, hostname: 'evil.example' }, 'hostname_mismatch'],
  ['lookalike hostname', { ...GOOD, hostname: 'phishscore.ai.evil.example' }, 'hostname_mismatch'],
  ['preview deployment hostname', { ...GOOD, hostname: 'phishscore-git-main.vercel.app' }, 'hostname_mismatch'],
  ['low score', { ...GOOD, score: 0.3 }, 'low_score'],
  ['missing score', { ...GOOD, score: undefined }, 'low_score'],
]) {
  test(`rejects: ${name}`, withSecret(async (t) => {
    quiet(t);
    google(t, data);
    const out = await verifyRecaptcha('tok', { action: 'submit' });
    assert.strictEqual(out.ok, false);
    assert.strictEqual(out.reason, reason);
  }));
}

test('accepts a successful token for the expected action on both hostnames, posting a form-encoded body', withSecret(async (t) => {
  for (const hostname of ['phishscore.ai', 'www.phishscore.ai']) {
    t.mock.restoreAll();
    const calls = google(t, { ...GOOD, hostname });
    assert.deepStrictEqual(await verifyRecaptcha('to+k/=&x', { action: 'submit', remoteIp: '203.0.113.9' }), { ok: true, score: 0.9 });
    assert.strictEqual(calls[0].url, VERIFY_URL);
    const sent = new URLSearchParams(calls[0].opts.body);
    assert.strictEqual(sent.get('response'), 'to+k/=&x', 'token is URL-encoded, not spliced raw');
    assert.strictEqual(sent.get('secret'), 'secret');
    assert.strictEqual(sent.get('remoteip'), '203.0.113.9');
  }
}));

test('server-side failures are told apart from client failures', () => {
  assert.strictEqual(isServerSideFailure('not_configured'), true);
  assert.strictEqual(isServerSideFailure('unavailable'), true);
  for (const r of ['missing_token', 'invalid', 'action_mismatch', 'hostname_mismatch', 'low_score']) assert.strictEqual(isServerSideFailure(r), false);
});

// ── Route ──────────────────────────────────────────────────────────────────────

const BODY = { text: 'Your parcel is held', category: 'other', visibility: 'private', deliveryChannel: 'sms' };
const req = (body, ip) => ({ method: 'POST', headers: { 'x-forwarded-for': ip }, body });
function res() { const r = { code: null, body: null, headers: {} }; r.status = c => { r.code = c; return r; }; r.json = b => { r.body = b; return r; }; r.setHeader = (k, v) => { r.headers[k] = v; }; return r; }

test('route: no token → 403 and no Claude call (the old bypass is closed)', withSecret(async (t) => {
  quiet(t);
  const calls = google(t, GOOD);
  const r = res();
  await analyze(req(BODY, '10.9.0.1'), r);
  assert.strictEqual(r.code, 403);
  assert.strictEqual(r.body.error, 'verification_failed');
  assert.ok(!calls.some(c => c.url.includes('anthropic')));
}));

test('route: secret unset → 503 and no Claude call', async (t) => {
  quiet(t);
  delete process.env.RECAPTCHA_SECRET_KEY;
  const calls = google(t, GOOD);
  const r = res();
  await analyze(req({ ...BODY, recaptchaToken: 'tok' }, '10.9.0.2'), r);
  assert.strictEqual(r.code, 503);
  assert.ok(!calls.some(c => c.url.includes('anthropic')));
});

test('route: a token for another action → 403', withSecret(async (t) => {
  quiet(t);
  const calls = google(t, { ...GOOD, action: 'login' });
  const r = res();
  await analyze(req({ ...BODY, recaptchaToken: 'tok' }, '10.9.0.3'), r);
  assert.strictEqual(r.code, 403);
  assert.ok(!calls.some(c => c.url.includes('anthropic')));
}));
