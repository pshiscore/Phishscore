// Deep Intel is parked: every endpoint behind it must answer 503 with
// DEEP_INTEL_ENABLED unset and behave as before with DEEP_INTEL_ENABLED=true.
// The webhook is the exception — it keeps verifying signatures and acknowledges
// verified events with 200, but writes nothing while parked.

const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');

process.env.REACT_APP_SUPABASE_URL = 'https://db.example';
process.env.SUPABASE_SERVICE_KEY = 'service-key';
process.env.ANTHROPIC_API_KEY = 'anthropic-key';
process.env.POLAR_API_KEY = 'polar-key';
process.env.POLAR_PRODUCT_T1 = 'prod-t1';
process.env.POLAR_WEBHOOK_SECRET = 'whsec_' + Buffer.from('test-signing-secret').toString('base64');

const { deepIntelEnabled, rejectIfParked, PARKED_MESSAGE } = require('../api/_utils/deepIntelGate');
const handlers = {
  'polar-checkout': require('../api/polar-checkout'),
  'create-checkout': require('../api/create-checkout'),
  'deep-intel':      require('../api/deep-intel'),
  'ivs-score':       require('../api/ivs-score'),
  'report':          require('../api/report'),
};
const webhook = require('../api/polar-webhook');

const UUID = '3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const PARKED = { error: PARKED_MESSAGE };

function res() {
  const r = { code: null, body: null, headers: {} };
  r.status = c => { r.code = c; return r; };
  r.json = b => { r.body = b; return r; };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  return r;
}
function parked() { delete process.env.DEEP_INTEL_ENABLED; }
function enabled() { process.env.DEEP_INTEL_ENABLED = 'true'; }
function reply(data, ok = true) { return { ok, status: ok ? 200 : 500, json: async () => data, text: async () => JSON.stringify(data) }; }
function stubFetch(t, impl) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, opts) => { calls.push({ url: String(url), opts }); return impl(String(url), opts, calls.length); });
  return calls;
}
const neverCalled = () => { throw new Error('outbound fetch must not happen while parked'); };

// ── The gate itself ────────────────────────────────────────────────────────────

test('gate: only the literal string "true" turns Deep Intel on', () => {
  for (const v of [undefined, '', 'false', '0', '1', 'TRUE', 'True', 'yes', ' true', 'true ']) {
    if (v === undefined) delete process.env.DEEP_INTEL_ENABLED; else process.env.DEEP_INTEL_ENABLED = v;
    assert.strictEqual(deepIntelEnabled(), false, `DEEP_INTEL_ENABLED=${JSON.stringify(v)} must be off`);
  }
  enabled();
  assert.strictEqual(deepIntelEnabled(), true);
  assert.strictEqual(deepIntelEnabled({}), false, 'an explicit env without the var is off');
});

test('gate: rejectIfParked answers 503 + no-store and tells the caller to stop', () => {
  parked();
  const r = res();
  assert.strictEqual(rejectIfParked({}, r), true);
  assert.strictEqual(r.code, 503);
  assert.deepStrictEqual(r.body, PARKED);
  assert.strictEqual(r.headers['Cache-Control'], 'no-store');
  enabled();
  const r2 = res();
  assert.strictEqual(rejectIfParked({}, r2), false);
  assert.strictEqual(r2.code, null, 'nothing is written when enabled');
});

// ── Parked: every endpoint is 503 before it parses, reads or calls anything ────

const WELL_FORMED = {
  'polar-checkout': { method: 'POST', body: { tier: 1, email: 'c@example.com', message: 'hello' } },
  'create-checkout': { method: 'POST', body: { caseId: UUID, email: 'c@example.com', tier: 1 } },
  'deep-intel':      { method: 'POST', body: { caseId: UUID } },
  'ivs-score':       { method: 'POST', body: { message: 'hello' } },
  'report':          { method: 'GET', query: { case: UUID } },
};

for (const [name, req] of Object.entries(WELL_FORMED)) {
  test(`${name}: parked → 503, no outbound call`, async (t) => {
    parked();
    const calls = stubFetch(t, neverCalled);
    const r = res();
    await handlers[name](req, r);
    assert.strictEqual(r.code, 503);
    assert.deepStrictEqual(r.body, PARKED);
    assert.strictEqual(calls.length, 0);
  });

  test(`${name}: parked → 503 even with the wrong method and no body (gate runs first)`, async (t) => {
    parked();
    const calls = stubFetch(t, neverCalled);
    const r = res();
    // body/query undefined would throw inside several handlers if anything ran before the gate
    await handlers[name]({ method: 'DELETE' }, r);
    assert.strictEqual(r.code, 503);
    assert.deepStrictEqual(r.body, PARKED);
    assert.strictEqual(calls.length, 0);
  });
}

// ── Enabled: each endpoint behaves as before ───────────────────────────────────

test('polar-checkout enabled: creates the case, then the Polar checkout', async (t) => {
  enabled();
  const calls = stubFetch(t, (url) => url.includes('/rest/v1/deep_intel_cases') ? reply([{ id: UUID }]) : reply({ url: 'https://polar.example/checkout' }));
  const r = res();
  await handlers['polar-checkout'](WELL_FORMED['polar-checkout'], r);
  assert.strictEqual(r.code, 200);
  assert.deepStrictEqual(r.body, { checkoutUrl: 'https://polar.example/checkout' });
  assert.strictEqual(calls.length, 2);
  assert.ok(calls[0].url.includes('/rest/v1/deep_intel_cases'));
  assert.ok(calls[1].url.includes('polar.sh/v1/checkouts'));
});

test('create-checkout enabled: returns the Polar URL', async (t) => {
  enabled();
  const calls = stubFetch(t, () => reply({ url: 'https://polar.example/upgrade' }));
  const r = res();
  await handlers['create-checkout'](WELL_FORMED['create-checkout'], r);
  assert.strictEqual(r.code, 200);
  assert.deepStrictEqual(r.body, { url: 'https://polar.example/upgrade' });
  assert.strictEqual(calls.length, 1);
});

test('deep-intel enabled: validates the body and looks the case up', async (t) => {
  enabled();
  const r400 = res();
  await handlers['deep-intel']({ method: 'POST', body: {} }, r400);
  assert.strictEqual(r400.code, 400);

  const calls = stubFetch(t, () => reply([]));
  const r = res();
  await handlers['deep-intel'](WELL_FORMED['deep-intel'], r);
  assert.strictEqual(calls.length, 1, 'reached the case lookup and stopped there');
  assert.ok(calls[0].url.includes(`/rest/v1/deep_intel_cases?id=eq.${UUID}`));
  assert.strictEqual(r.code, 500);
  assert.strictEqual(r.body.detail, 'Case not found');
});

test('ivs-score enabled: scores via Claude', async (t) => {
  enabled();
  const scored = { ivs: 72, label: 'HIGH', headline: 'h', explanation: 'e', recommend: true, honest_note: '' };
  const calls = stubFetch(t, () => reply({ content: [{ text: JSON.stringify(scored) }] }));
  const r = res();
  await handlers['ivs-score'](WELL_FORMED['ivs-score'], r);
  assert.strictEqual(r.code, 200);
  assert.deepStrictEqual(r.body, scored);
  assert.strictEqual(calls.length, 1);
  assert.ok(calls[0].url.includes('api.anthropic.com'));
});

test('report enabled: serves case status', async (t) => {
  enabled();
  stubFetch(t, () => reply([{ id: UUID, tier: 1, payment_status: 'paid', report_token: 'a'.repeat(64) }]));
  const r = res();
  await handlers['report'](WELL_FORMED['report'], r);
  assert.strictEqual(r.code, 200);
  assert.strictEqual(r.body.id, UUID);
});

// ── Webhook: signature always verified; parked = acknowledge, never write ──────

function signedRequest(payload, { tamper = false } = {}) {
  const body = JSON.stringify(payload);
  const id = 'msg_test', ts = String(Math.floor(Date.now() / 1000));
  const secret = Buffer.from(process.env.POLAR_WEBHOOK_SECRET.slice('whsec_'.length), 'base64');
  const sig = crypto.createHmac('sha256', secret).update(`${id}.${ts}.${body}`).digest('base64');
  const req = Readable.from([Buffer.from(body, 'utf8')]);
  req.method = 'POST';
  req.headers = { 'webhook-id': id, 'webhook-timestamp': ts, 'webhook-signature': `v1,${tamper ? 'x' + sig.slice(1) : sig}` };
  return req;
}
const ORDER = { type: 'order.created', data: { id: 'ord_1', metadata: { caseId: UUID, tier: 1 }, customer: { email: 'c@example.com' } } };

test('polar-webhook parked: verified order → 200, database untouched', async (t) => {
  parked();
  const calls = stubFetch(t, neverCalled);
  const r = res();
  await webhook(signedRequest(ORDER), r);
  assert.strictEqual(r.code, 200);
  assert.deepStrictEqual(r.body, { received: true, parked: true });
  assert.strictEqual(calls.length, 0);
});

test('polar-webhook parked: bad signature is still rejected', async (t) => {
  parked();
  const calls = stubFetch(t, neverCalled);
  const r = res();
  await webhook(signedRequest(ORDER, { tamper: true }), r);
  assert.strictEqual(r.code, 401);
  assert.strictEqual(calls.length, 0);
});

test('polar-webhook enabled: verified order marks the case paid', async (t) => {
  enabled();
  const calls = stubFetch(t, () => reply(null));
  const r = res();
  await webhook(signedRequest(ORDER), r);
  assert.strictEqual(r.code, 200);
  assert.deepStrictEqual(r.body, { received: true });
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].opts.method, 'PATCH');
  assert.ok(calls[0].url.includes(`/rest/v1/deep_intel_cases?id=eq.${UUID}`));
  const patch = JSON.parse(calls[0].opts.body);
  assert.strictEqual(patch.payment_status, 'paid');
  assert.match(patch.report_token, /^[a-f0-9]{64}$/);
});
