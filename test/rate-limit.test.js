// api/_utils/rateLimit.js — shared limiter over the check_rate_limit RPC.

const test = require('node:test');
const assert = require('node:assert');

process.env.REACT_APP_SUPABASE_URL = 'https://db.example';
process.env.SUPABASE_SERVICE_KEY = 'service-key';

const rl = require('../api/_utils/rateLimit');
const { checkRateLimit, enforceRateLimit, clientIp, bucketFor, createSupabaseStore, createMemoryStore, setRateLimitStore } = rl;

function res() { const r = { code: null, body: null, headers: {} }; r.status = c => { r.code = c; return r; }; r.json = b => { r.body = b; return r; }; r.setHeader = (k, v) => { r.headers[k] = v; }; return r; }
function reply(data, ok = true, status) { return { ok, status: status || (ok ? 200 : 500), json: async () => data, text: async () => JSON.stringify(data) }; }

test('supabase store: calls the RPC with the service key and the bucket', async (t) => {
  setRateLimitStore(createSupabaseStore());
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, opts) => { calls.push({ url: String(url), opts }); return reply([{ allowed: true, current_count: 3 }]); });
  const out = await checkRateLimit('203.0.113.9', 5, 60, 'analyze');
  assert.deepStrictEqual(out, { allowed: true, count: 3, unavailable: false });
  assert.strictEqual(calls[0].url, 'https://db.example/rest/v1/rpc/check_rate_limit');
  assert.strictEqual(calls[0].opts.headers.apikey, 'service-key');
  assert.deepStrictEqual(JSON.parse(calls[0].opts.body), { p_bucket: 'analyze:203.0.113.9', p_max: 5, p_window_seconds: 60 });
  assert.ok(calls[0].opts.signal, 'request carries a timeout signal');
});

test('supabase store: over the limit is reported as not allowed, not unavailable', async (t) => {
  setRateLimitStore(createSupabaseStore());
  t.mock.method(globalThis, 'fetch', async () => reply([{ allowed: false, current_count: 6 }]));
  assert.deepStrictEqual(await checkRateLimit('1.2.3.4', 5, 60, 'analyze'), { allowed: false, count: 6, unavailable: false });
});

for (const [name, impl] of [
  ['HTTP error', async () => reply({ code: 'PGRST202' }, false, 404)],
  ['network error', async () => { throw new TypeError('fetch failed'); }],
  ['malformed body', async () => reply({ hello: 'world' })],
  ['empty array', async () => reply([])],
]) {
  test(`supabase store: ${name} fails CLOSED by default and open only when asked`, async (t) => {
    setRateLimitStore(createSupabaseStore());
    t.mock.method(globalThis, 'fetch', impl);
    t.mock.method(console, 'error', () => {});
    assert.deepStrictEqual(await checkRateLimit('1.2.3.4', 5, 60, 'analyze'), { allowed: false, count: null, unavailable: true });
    assert.deepStrictEqual(await checkRateLimit('1.2.3.4', 5, 60, 'analyze', { failOpen: true }), { allowed: true, count: null, unavailable: true });
  });
}

test('supabase store: a store that never answers is cut off by the timeout and fails closed', async (t) => {
  setRateLimitStore(createSupabaseStore({ timeoutMs: 50 }));
  t.mock.method(console, 'error', () => {});
  t.mock.method(globalThis, 'fetch', (url, opts) => new Promise((_, reject) => opts.signal.addEventListener('abort', () => reject(opts.signal.reason))));
  const started = Date.now();
  const out = await checkRateLimit('1.2.3.4', 5, 60, 'analyze');
  assert.ok(Date.now() - started < 1000);
  assert.deepStrictEqual(out, { allowed: false, count: null, unavailable: true });
});

test('supabase store: missing configuration fails closed', async (t) => {
  setRateLimitStore(createSupabaseStore({ url: '', key: '' }));
  t.mock.method(console, 'error', () => {});
  assert.strictEqual((await checkRateLimit('1.2.3.4', 5, 60, 'x')).unavailable, true);
});

test('enforceRateLimit: 429 with Retry-After over the limit, 503 when unavailable, false when allowed', async (t) => {
  t.mock.method(console, 'error', () => {});
  const req = { headers: { 'x-forwarded-for': '198.51.100.7, 10.0.0.1' } };
  setRateLimitStore(createMemoryStore());
  const ok = res();
  assert.strictEqual(await enforceRateLimit(req, ok, { route: 'r1', max: 1, windowSeconds: 60 }), false);
  assert.strictEqual(ok.code, null);
  const over = res();
  assert.strictEqual(await enforceRateLimit(req, over, { route: 'r1', max: 1, windowSeconds: 60, message: 'slow down' }), true);
  assert.strictEqual(over.code, 429);
  assert.strictEqual(over.headers['Retry-After'], '60');
  assert.strictEqual(over.body.message, 'slow down');
  setRateLimitStore({ name: 'broken', hit: async () => { throw new Error('down'); } });
  const down = res();
  assert.strictEqual(await enforceRateLimit(req, down, { route: 'r1', max: 1, windowSeconds: 60 }), true);
  assert.strictEqual(down.code, 503);
});

test('buckets are per route and per IP', async () => {
  setRateLimitStore(createMemoryStore());
  assert.strictEqual((await checkRateLimit('1.1.1.1', 1, 60, 'a')).allowed, true);
  assert.strictEqual((await checkRateLimit('1.1.1.1', 1, 60, 'a')).allowed, false);
  assert.strictEqual((await checkRateLimit('1.1.1.1', 1, 60, 'b')).allowed, true, 'another route has its own budget');
  assert.strictEqual((await checkRateLimit('2.2.2.2', 1, 60, 'a')).allowed, true, 'another IP has its own budget');
});

test('clientIp: first forwarded address, sanitized; bucket length capped', () => {
  assert.strictEqual(clientIp({ headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' } }), '203.0.113.9');
  assert.strictEqual(clientIp({ headers: { 'x-forwarded-for': '2001:db8::1' } }), '2001:db8::1');
  assert.strictEqual(clientIp({ headers: { 'x-forwarded-for': '1.2.3.4"; drop table x;--' } }), '1.2.3.4dabe');
  assert.strictEqual(clientIp({ headers: {} }), 'unknown');
  assert.strictEqual(bucketFor('analyze', 'x'.repeat(500)).length, 200);
});
