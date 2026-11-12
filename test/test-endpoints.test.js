// The dev dashboard's diagnostic endpoints (api/test-*.js) need the /devs
// session cookie, send no CORS headers, and the unused ones are gone.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'pw';
const { COOKIE_NAME, sessionToken } = require('../api/_utils/cronAuth');

const API = path.join(__dirname, '..', 'api');
const KEPT = fs.readdirSync(API).filter(f => /^test-.*\.js$/.test(f)).sort();
const dashboard = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'APITestDashboard.jsx'), 'utf8');

function res() { const r = { code: null, body: null, headers: {} }; r.status = c => { r.code = c; return r; }; r.json = b => { r.body = b; return r; }; r.end = () => r; r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; }; return r; }

test('exactly the endpoints the dashboard calls are kept', () => {
  const called = [...new Set([...dashboard.matchAll(/\/api\/(test-[a-z0-9-]+)/g)].map(m => `${m[1]}.js`))].sort();
  assert.deepStrictEqual(KEPT, called);
  assert.strictEqual(KEPT.length, 15);
});

test('deleted files are gone', () => {
  for (const f of ['api/test-gsb.js', 'public/ps-internal-api-test-v1_1.html', 'public/recaptcha-snippet.html']) {
    assert.ok(!fs.existsSync(path.join(__dirname, '..', f)), f);
  }
});

for (const file of KEPT) {
  test(`${file}: 401 without the session cookie, before any outbound call, no CORS`, async (t) => {
    const calls = [];
    t.mock.method(globalThis, 'fetch', async (...a) => { calls.push(a); return { ok: true, status: 200, json: async () => ({}), text: async () => '{}' }; });
    const handler = require(path.join(API, file));
    for (const method of ['POST', 'GET', 'OPTIONS']) {
      for (const cookie of [undefined, `${COOKIE_NAME}=forged`]) {
        const r = res();
        await handler({ method, headers: cookie ? { cookie } : {}, body: { url: 'https://example.com' }, query: {} }, r);
        assert.strictEqual(r.code, 401, `${method} ${cookie || 'no cookie'}`);
        assert.ok(!Object.keys(r.headers).some(h => h.startsWith('access-control')), 'no CORS headers');
      }
    }
    assert.strictEqual(calls.length, 0);
  });

  test(`${file}: a valid session gets past auth`, async (t) => {
    t.mock.method(globalThis, 'fetch', async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => '{}', arrayBuffer: async () => new ArrayBuffer(0) }));
    t.mock.method(console, 'error', () => {}); t.mock.method(console, 'warn', () => {}); t.mock.method(console, 'log', () => {});
    const handler = require(path.join(API, file));
    const r = res();
    try { await handler({ method: 'POST', headers: { cookie: `${COOKIE_NAME}=${sessionToken()}` }, body: { url: 'https://example.com', input: 'x', token: 'x' }, query: {} }, r); } catch {}
    assert.notStrictEqual(r.code, 401);
  });
}
