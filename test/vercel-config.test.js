// vercel.json: security headers on every route; CSP in report-only mode.

const test = require('node:test');
const assert = require('node:assert');
const cfg = require('../vercel.json');

const all = cfg.headers.find(h => h.source === '/(.*)');
const header = (k) => all.headers.find(h => h.key === k)?.value;

test('baseline security headers apply to every route', () => {
  assert.strictEqual(header('X-Content-Type-Options'), 'nosniff');
  assert.strictEqual(header('X-Frame-Options'), 'DENY');
  assert.strictEqual(header('Referrer-Policy'), 'strict-origin-when-cross-origin');
  assert.strictEqual(header('Permissions-Policy'), 'camera=(), microphone=(), geolocation=()');
});

test('CSP ships report-only, with no unsafe-inline/unsafe-eval and frame-ancestors none', () => {
  assert.strictEqual(header('Content-Security-Policy'), undefined, 'not enforced yet');
  const csp = header('Content-Security-Policy-Report-Only');
  const d = Object.fromEntries(csp.split(';').map(s => s.trim().split(/\s+/)).map(([k, ...v]) => [k, v]));
  assert.deepStrictEqual(d['frame-ancestors'], ["'none'"]);
  assert.deepStrictEqual(d['object-src'], ["'none'"]);
  assert.ok(!csp.includes("'unsafe-inline'") && !csp.includes("'unsafe-eval'"));
  assert.ok(d['script-src'].includes('https://www.google.com/recaptcha/') && d['script-src'].includes('https://www.gstatic.com/recaptcha/'));
  assert.ok(d['frame-src'].includes('https://www.google.com/recaptcha/'));
  assert.ok(d['worker-src'].includes('blob:'), 'Sentry replay worker');
  assert.ok(d['connect-src'].some(s => s.endsWith('.ingest.us.sentry.io')), 'Sentry ingest');
  assert.match(d['report-uri'][0], /\/security\/\?sentry_key=/);
});

test('removed pages are rewritten to a real 404; kept /api/test-* endpoints are not', () => {
  const to404 = cfg.rewrites.filter(r => r.destination === '/api/not-found').map(r => r.source).sort();
  assert.deepStrictEqual(to404, ['/ps-internal-api-test-v1_1.html', '/recaptcha-snippet.html']);
  assert.ok(!cfg.rewrites.some(r => r.source.startsWith('/api/test')), 'the /devs dashboard still uses 15 test endpoints');
  const r = { code: null, headers: {}, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, setHeader(k, v) { this.headers[k] = v; } };
  require('../api/not-found')({}, r);
  assert.strictEqual(r.code, 404);
});
