// /api/submit-feedback: validation, existence check, rate limit, reCAPTCHA and
// one vote per result per IP per day.

const test = require('node:test');
const assert = require('node:assert');

process.env.REACT_APP_SUPABASE_URL = 'https://db.example';
process.env.SUPABASE_SERVICE_KEY = 'service-key';
process.env.RECAPTCHA_SECRET_KEY = 'secret';

const rateLimit = require('../api/_utils/rateLimit');
const recaptcha = require('../api/_utils/recaptcha');
const feedback = require('../api/submit-feedback');

const CASE = '3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const TRAIN = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
function res() { const r = { code: null, body: null, headers: {} }; r.status = c => { r.code = c; return r; }; r.json = b => { r.body = b; return r; }; r.setHeader = (k, v) => { r.headers[k] = v; }; return r; }
function reply(data, ok = true, status) { return { ok, status: status || (ok ? 200 : 500), json: async () => data, text: async () => JSON.stringify(data) }; }
let n = 0;
const ip = () => `10.40.${Math.floor(n / 250)}.${n++ % 250}`;
const req = (body, addr = ip()) => ({ method: 'POST', headers: { 'x-forwarded-for': addr }, body });
function world(t, { exists = true, human = true } = {}) {
  rateLimit.setRateLimitStore(rateLimit.createMemoryStore());
  t.mock.method(console, 'error', () => {});
  const calls = [];
  t.mock.method(recaptcha, 'verifyRecaptcha', async (token, opts) => { calls.push({ recaptcha: opts.action, token }); return human ? { ok: true } : { ok: false, reason: 'low_score' }; });
  t.mock.method(globalThis, 'fetch', async (url, opts = {}) => {
    url = String(url); calls.push({ url, method: opts.method || 'GET', body: opts.body });
    if ((opts.method || 'GET') === 'GET') return reply(exists ? [{ id: 'x' }] : []);
    return reply(null, true, 204);
  });
  return calls;
}
const patches = (calls) => calls.filter(c => c.method === 'PATCH');

test('a valid vote is verified, checked for existence, then written with only real columns', async (t) => {
  const calls = world(t);
  const r = res();
  await feedback(req({ caseId: CASE, is_accurate: false, feedbackText: 'missed the link', recaptchaToken: 'tok' }), r);
  assert.strictEqual(r.code, 200);
  assert.deepStrictEqual(calls.find(c => c.recaptcha), { recaptcha: 'feedback', token: 'tok' });
  assert.ok(calls.some(c => c.method === 'GET' && c.url.includes(`/rest/v1/submissions?id=eq.${CASE}&select=id`)));
  const [p] = patches(calls);
  assert.ok(p.url.endsWith(`/rest/v1/submissions?id=eq.${CASE}`));
  assert.deepStrictEqual(JSON.parse(p.body), { is_accurate: false, user_feedback: 'missed the link' });
});

for (const [name, body, re] of [
  ['missing is_accurate', { caseId: CASE }, /is_accurate/],
  ['is_accurate not boolean', { caseId: CASE, is_accurate: 'yes' }, /is_accurate/],
  ['malformed caseId', { caseId: 'abc', is_accurate: true }, /caseId/],
  ['filter-injection caseId', { caseId: `${CASE}&id=neq.0`, is_accurate: true }, /caseId/],
  ['malformed trainingId', { trainingId: '1; drop', is_accurate: true }, /trainingId/],
  ['neither id', { is_accurate: true }, /required/],
  ['feedback too long', { caseId: CASE, is_accurate: false, feedbackText: 'x'.repeat(1001) }, /longer than/],
]) {
  test(`400: ${name}, before reCAPTCHA or any DB call`, async (t) => {
    const calls = world(t);
    const r = res();
    await feedback(req({ ...body, recaptchaToken: 'tok' }), r);
    assert.strictEqual(r.code, 400);
    assert.match(r.body.error, re);
    assert.strictEqual(calls.length, 0);
  });
}

test('403 without a human token; nothing written', async (t) => {
  const calls = world(t, { human: false });
  const r = res();
  await feedback(req({ caseId: CASE, is_accurate: true, recaptchaToken: 'tok' }), r);
  assert.strictEqual(r.code, 403);
  assert.strictEqual(patches(calls).length, 0);
});

test('404 when the submission does not exist; nothing written', async (t) => {
  const calls = world(t, { exists: false });
  const r = res();
  await feedback(req({ caseId: CASE, is_accurate: true, recaptchaToken: 'tok' }), r);
  assert.strictEqual(r.code, 404);
  assert.strictEqual(patches(calls).length, 0);
});

test('one vote per submission per IP per day: second vote is 409; another IP or another submission is fine', async (t) => {
  const calls = world(t);
  const addr = ip();
  const codes = [];
  for (const body of [
    { caseId: CASE, is_accurate: true },
    { caseId: CASE, is_accurate: false },                         // same IP, same case → 409
    { caseId: '11111111-2222-4333-8444-555555555555', is_accurate: true }, // same IP, other case → ok
  ]) { const r = res(); await feedback(req({ ...body, recaptchaToken: 'tok' }, addr), r); codes.push(r.code); }
  const other = res(); await feedback(req({ caseId: CASE, is_accurate: true, recaptchaToken: 'tok' }), other);
  assert.deepStrictEqual(codes, [200, 409, 200]);
  assert.strictEqual(other.code, 200);
  assert.strictEqual(patches(calls).length, 3, 'the duplicate wrote nothing');
});

test('trainingId-only votes are deduplicated on the training row', async (t) => {
  world(t);
  const addr = ip();
  const a = res(); await feedback(req({ trainingId: TRAIN, is_accurate: true, recaptchaToken: 'tok' }, addr), a);
  const b = res(); await feedback(req({ trainingId: TRAIN, is_accurate: true, recaptchaToken: 'tok' }, addr), b);
  assert.deepStrictEqual([a.code, b.code], [200, 409]);
});

test('per-IP limit: 11th request in a minute is 429; limiter down is 503', async (t) => {
  world(t);
  const addr = ip();
  let last;
  for (let i = 0; i < 11; i++) { last = res(); await feedback(req({ is_accurate: true, recaptchaToken: 'tok' }, addr), last); }
  assert.strictEqual(last.code, 429);
  rateLimit.setRateLimitStore({ name: 'down', hit: async () => { throw new Error('down'); } });
  const r = res(); await feedback(req({ caseId: CASE, is_accurate: true, recaptchaToken: 'tok' }), r);
  assert.strictEqual(r.code, 503);
});
