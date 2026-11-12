// Tests for api/report.js — the token-gated replacement for anon reads of deep_intel_cases.

const test = require('node:test');
const assert = require('node:assert');
const { mock } = require('node:test');

process.env.REACT_APP_SUPABASE_URL = 'https://db.example';
process.env.SUPABASE_SERVICE_KEY = 'service-key';
process.env.DEEP_INTEL_ENABLED = 'true'; // the gate itself is covered in deep-intel-gate.test.js
const handler = require('../api/report');
const { isValidToken, isValidCaseId, tokensMatch, shapeForToken, shapeForCase, STATUS_FIELDS, REPORT_FIELDS } = handler;

const TOKEN = 'a'.repeat(64);
const UUID = '3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const ROW = {
  id: UUID, created_at: 't', original_category: 'finance', original_score: 80, ivs_score: 70, ivs_label: 'HIGH',
  tier: 1, payment_status: 'paid', report_generated_at: 'g', email: 'c@example.com', report_token: TOKEN,
  forensic_report: 'REPORT BODY', urlscan_screenshot: 'https://shot', original_message: 'SECRET PASTE', whois_data: {},
};

function res() { const r = { code: null, body: null, headers: {} }; r.status = c => { r.code = c; return r; }; r.json = b => { r.body = b; return r; }; r.setHeader = (k, v) => { r.headers[k] = v; }; return r; }
function stubFetch(t, rows, ok = true) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, opts) => { calls.push({ url: String(url), opts }); return { ok, status: ok ? 200 : 500, json: async () => rows, text: async () => '' }; });
  return calls;
}

test('shape helpers never include the original message or arbitrary columns', () => {
  const byToken = shapeForToken(ROW), byCase = shapeForCase(ROW);
  assert.deepStrictEqual(Object.keys(byToken).sort(), [...REPORT_FIELDS].sort());
  assert.deepStrictEqual(Object.keys(byCase).sort(), [...STATUS_FIELDS].sort());
  for (const o of [byToken, byCase]) { assert.ok(!('original_message' in o)); assert.ok(!('whois_data' in o)); }
  assert.strictEqual(byToken.forensic_report, 'REPORT BODY');
  assert.ok(!('forensic_report' in byCase), 'the case path must never carry the report body');
});

test('token format: 64 lowercase hex only', () => {
  assert.ok(isValidToken(TOKEN));
  for (const bad of [TOKEN.toUpperCase(), TOKEN.slice(1), TOKEN + 'a', 'z'.repeat(64), '', null, undefined, 42, `${TOKEN}&select=*`]) {
    assert.strictEqual(isValidToken(bad), false, JSON.stringify(bad));
  }
});

test('case id format: UUID only', () => {
  assert.ok(isValidCaseId(UUID)); assert.ok(isValidCaseId(UUID.toUpperCase()));
  for (const bad of ['', '123', `${UUID}&select=*`, 'not-a-uuid', null]) assert.strictEqual(isValidCaseId(bad), false, JSON.stringify(bad));
});

test('tokensMatch is strict on length and content', () => {
  assert.ok(tokensMatch(TOKEN, TOKEN));
  assert.strictEqual(tokensMatch(TOKEN, TOKEN.slice(0, 63) + 'b'), false);
  assert.strictEqual(tokensMatch(TOKEN, TOKEN + 'a'), false);
  assert.strictEqual(tokensMatch(null, TOKEN), false);
});

test('valid token → 200 with the report fields and nothing else', async (t) => {
  const calls = stubFetch(t, [ROW]);
  const r = res(); await handler({ method: 'GET', query: { token: TOKEN } }, r);
  assert.strictEqual(r.code, 200);
  assert.deepStrictEqual(Object.keys(r.body).sort(), [...REPORT_FIELDS].sort());
  assert.strictEqual(r.body.forensic_report, 'REPORT BODY');
  assert.ok(calls[0].url.includes(`report_token=eq.${TOKEN}`));
  assert.ok(calls[0].url.includes('select=' + REPORT_FIELDS.join(',')));
  assert.strictEqual(calls[0].opts.headers.apikey, 'service-key');
  assert.strictEqual(r.headers['Cache-Control'], 'no-store');
});

test('unknown token → 404; malformed token → 404 without touching the database', async (t) => {
  let calls = stubFetch(t, []);
  let r = res(); await handler({ method: 'GET', query: { token: 'b'.repeat(64) } }, r);
  assert.strictEqual(r.code, 404); assert.strictEqual(calls.length, 1);
  calls = stubFetch(t, [ROW]);
  r = res(); await handler({ method: 'GET', query: { token: 'nope' } }, r);
  assert.strictEqual(r.code, 404); assert.strictEqual(calls.length, 0, 'malformed input must not reach Supabase');
});

test('a row whose token does not match exactly is refused even if the database returned it', async (t) => {
  stubFetch(t, [{ ...ROW, report_token: 'c'.repeat(64) }]);
  const r = res(); await handler({ method: 'GET', query: { token: TOKEN } }, r);
  assert.strictEqual(r.code, 404);
});

test('case path → status fields only, no report body, no original message', async (t) => {
  const calls = stubFetch(t, [ROW]);
  const r = res(); await handler({ method: 'GET', query: { case: UUID.toUpperCase() } }, r);
  assert.strictEqual(r.code, 200);
  assert.deepStrictEqual(Object.keys(r.body).sort(), [...STATUS_FIELDS].sort());
  assert.ok(!('forensic_report' in r.body) && !('original_message' in r.body));
  assert.ok(calls[0].url.includes(`id=eq.${UUID}`), 'uuid is lower-cased before it reaches the filter');
  assert.ok(calls[0].url.includes('select=' + STATUS_FIELDS.join(',')), 'the body columns are never even requested');
});

test('unknown or malformed case id → 404', async (t) => {
  let calls = stubFetch(t, []);
  let r = res(); await handler({ method: 'GET', query: { case: UUID } }, r); assert.strictEqual(r.code, 404);
  calls = stubFetch(t, [ROW]);
  r = res(); await handler({ method: 'GET', query: { case: 'x' } }, r); assert.strictEqual(r.code, 404); assert.strictEqual(calls.length, 0);
});

test('neither or both credentials → 400; non-GET → 405; Supabase failure → 502 not a leak', async (t) => {
  stubFetch(t, [ROW]);
  let r = res(); await handler({ method: 'GET', query: {} }, r); assert.strictEqual(r.code, 400);
  r = res(); await handler({ method: 'GET', query: { token: TOKEN, case: UUID } }, r); assert.strictEqual(r.code, 400);
  r = res(); await handler({ method: 'POST', query: { token: TOKEN } }, r); assert.strictEqual(r.code, 405);
  stubFetch(t, null, false);
  r = res(); await handler({ method: 'GET', query: { token: TOKEN } }, r); assert.strictEqual(r.code, 502); assert.ok(!JSON.stringify(r.body).includes('REPORT'));
});
