// Per-IP daily caps and global daily ceilings on every paid route. The global
// ceiling counts only verified requests, so tokenless junk cannot exhaust it.

const test = require('node:test');
const assert = require('node:assert');

process.env.REACT_APP_SUPABASE_URL = 'https://db.example';
process.env.SUPABASE_SERVICE_KEY = 'service-key';
process.env.ANTHROPIC_API_KEY = 'anthropic-key';
process.env.COHERE_API_KEY = 'cohere-key';
process.env.RECAPTCHA_SECRET_KEY = 'secret';
process.env.INVESTIGATOR_CHAT_ENABLED = 'true';

const { CohereClient } = require('cohere-ai');
const LIMITS = require('../api/_utils/limits');
const rateLimit = require('../api/_utils/rateLimit');
const recaptcha = require('../api/_utils/recaptcha');

function res() { const r = { code: null, body: null, headers: {} }; r.status = c => { r.code = c; return r; }; r.json = b => { r.body = b; return r; }; r.setHeader = (k, v) => { r.headers[k] = v; }; return r; }
function reply(data, ok = true, status) { return { ok, status: status || (ok ? 200 : 500), json: async () => data, text: async () => JSON.stringify(data) }; }

const ROUTES = [
  { name: 'analyze', handler: require('../api/analyze'), limits: LIMITS.analyze, body: { text: 'Your parcel is held', category: 'other', visibility: 'private', deliveryChannel: 'sms', dryRun: true } },
  { name: 'quick-scan', handler: require('../api/quick-scan'), limits: LIMITS.quickScan, body: { input: 'is this a scam?' } },
  { name: 'extract-email', handler: require('../api/extract-email'), limits: LIMITS.extractEmail, body: { rawText: 'From: a@b.example\n\nhi' } },
  { name: 'investigator-chat', handler: require('../api/investigator-chat'), limits: LIMITS.investigatorChat, body: { message: 'what is trending?' } },
];

function stubPaid(t) {
  t.mock.method(console, 'error', () => {}); t.mock.method(console, 'warn', () => {});
  const paid = [];
  t.mock.method(globalThis, 'fetch', async (url, opts = {}) => {
    url = String(url);
    if (url.includes('api.anthropic.com')) {
      paid.push(url);
      const max = JSON.parse(opts.body).max_tokens;
      const text = max === 512 ? '{"sender":"","subject":"","body":"hi"}' : '{"score":10,"category":"other","tags":[],"summary":"s"}';
      return reply({ content: [{ type: 'text', text }], usage: {} });
    }
    if (url.includes('/rest/v1/quick_scans')) return reply([{ id: 'scan' }], true, 201);
    return reply([]);
  });
  t.mock.method(CohereClient.prototype, 'chat', async () => { paid.push('cohere'); return { text: 'a', citations: [] }; });
  return paid;
}

test('limits: every route has a per-minute, per-IP daily and global daily limit, global > per-IP', () => {
  for (const [name, l] of Object.entries(LIMITS)) {
    for (const k of ['perMinute', 'perIpDay', 'globalDay']) assert.ok(Number.isInteger(l[k]) && l[k] > 0, `${name}.${k}`);
    assert.ok(l.globalDay > l.perIpDay && l.perIpDay > l.perMinute, name);
  }
});

for (const r of ROUTES) {
  test(`${r.name}: per-IP daily cap of ${r.limits.perIpDay} → 429`, async (t) => {
    rateLimit.setRateLimitStore(rateLimit.createMemoryStore());
    t.mock.method(recaptcha, 'verifyRecaptcha', async () => ({ ok: true }));
    stubPaid(t);
    const day = `${r.name === 'analyze' ? 'analyze' : r.name}:day`;
    // Pre-fill the day bucket for this IP to just under the cap.
    for (let i = 0; i < r.limits.perIpDay; i++) await rateLimit.checkRateLimit('10.50.0.1', r.limits.perIpDay, 86400, day);
    const out = res();
    await r.handler({ method: 'POST', headers: { 'x-forwarded-for': '10.50.0.1' }, body: { ...r.body, recaptchaToken: 'tok' } }, out);
    assert.strictEqual(out.code, 429);
    assert.strictEqual(out.headers['Retry-After'], '86400');
    assert.match(out.body.message, /tomorrow/i);
  });

  test(`${r.name}: global ceiling of ${r.limits.globalDay} stops every IP once reached`, async (t) => {
    rateLimit.setRateLimitStore(rateLimit.createMemoryStore());
    t.mock.method(recaptcha, 'verifyRecaptcha', async () => ({ ok: true }));
    const paid = stubPaid(t);
    for (let i = 0; i < r.limits.globalDay; i++) await rateLimit.checkRateLimit('all', r.limits.globalDay, 86400, `${r.name}:global-day`);
    const out = res();
    await r.handler({ method: 'POST', headers: { 'x-forwarded-for': '10.50.9.9' }, body: { ...r.body, recaptchaToken: 'tok' } }, out);
    assert.strictEqual(out.code, 429);
    assert.match(out.body.message, /today's limit/);
    assert.strictEqual(paid.length, 0, 'no paid call past the ceiling');
  });

  test(`${r.name}: unverified requests do not consume the global ceiling`, async (t) => {
    rateLimit.setRateLimitStore(rateLimit.createMemoryStore());
    t.mock.method(recaptcha, 'verifyRecaptcha', async () => ({ ok: false, reason: 'invalid' }));
    stubPaid(t);
    for (let i = 0; i < 3; i++) {
      const out = res();
      await r.handler({ method: 'POST', headers: { 'x-forwarded-for': `10.60.0.${i}` }, body: { ...r.body, recaptchaToken: 'bad' } }, out);
      assert.strictEqual(out.code, 403);
    }
    const probe = await rateLimit.checkRateLimit('all', r.limits.globalDay, 86400, `${r.name}:global-day`);
    assert.strictEqual(probe.count, 1, 'only the probe itself was counted');
  });
}
