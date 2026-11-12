// Tests for api/get-submissions.js and api/check-duplicate.js — the feed read paths
// that replace anon SELECT on `submissions`.

const test = require('node:test');
const assert = require('node:assert');

process.env.REACT_APP_SUPABASE_URL = 'https://db.example';
process.env.SUPABASE_SERVICE_KEY = 'service-key';
const feed = require('../api/get-submissions');
const dup = require('../api/check-duplicate');
const { stripPrivate, clampLimit, HIDDEN_FOR_PRIVATE } = feed;
const { findDuplicate, MATCH_FIELDS } = dup;

function res() { const r = { code: null, body: null, headers: {} }; r.status = c => { r.code = c; return r; }; r.json = b => { r.body = b; return r; }; r.setHeader = (k, v) => { r.headers[k] = v; }; return r; }
function stubFetch(t, rows, ok = true) { const calls = []; t.mock.method(globalThis, 'fetch', async (url, opts) => { calls.push({ url: String(url), opts }); return { ok, status: ok ? 200 : 500, json: async () => rows, text: async () => '' }; }); return calls; }

const pub = { id: 1, visibility: 'public', preview: 'public text', source: '+15551234567', score: 80, category: 'finance', tags: ['a'], summary: 's' };
const priv = { id: 2, visibility: 'private', preview: 'private text', source: 'scammer@x.com', score: 60, category: 'job', tags: ['b'], summary: 'kept' };
const anon = { id: 3, visibility: 'anonymous', preview: null, source: null, score: 40, category: 'other', tags: [] };

// ── feed ─────────────────────────────────────────────────────────────────────

test('private rows lose preview and source; everything else on them is kept', () => {
  const [p] = stripPrivate([priv]);
  for (const f of HIDDEN_FOR_PRIVATE) assert.strictEqual(p[f], null, f);
  assert.strictEqual(p.score, 60); assert.strictEqual(p.category, 'job'); assert.strictEqual(p.summary, 'kept'); assert.deepStrictEqual(p.tags, ['b']);
});

test('public and anonymous rows pass through unchanged', () => {
  const out = stripPrivate([pub, anon]);
  assert.deepStrictEqual(out[0], pub); assert.deepStrictEqual(out[1], anon);
});

test('does not mutate the input and tolerates garbage', () => {
  const copy = { ...priv }; stripPrivate([copy]); assert.strictEqual(copy.preview, 'private text');
  assert.deepStrictEqual(stripPrivate(null), []); assert.deepStrictEqual(stripPrivate([null, undefined]), [null, undefined]);
});

test('limit is clamped to [1, 1000] and defaults to 1000', () => {
  assert.strictEqual(clampLimit(undefined), 1000); assert.strictEqual(clampLimit('50'), 50);
  assert.strictEqual(clampLimit('5000'), 1000); assert.strictEqual(clampLimit('0'), 1000); assert.strictEqual(clampLimit('abc'), 1000);
});

test('GET feed → 200 with private rows stripped, served with the service key', async (t) => {
  const calls = stubFetch(t, [pub, priv, anon]);
  const r = res(); await feed({ method: 'GET', query: {} }, r);
  assert.strictEqual(r.code, 200); assert.strictEqual(r.body.length, 3);
  assert.strictEqual(r.body[1].preview, null); assert.strictEqual(r.body[1].source, null); assert.strictEqual(r.body[0].preview, 'public text');
  assert.strictEqual(calls[0].opts.headers.apikey, 'service-key');
  assert.ok(calls[0].url.includes('order=created_at.desc&limit=1000'));
  assert.strictEqual(r.headers['Cache-Control'], 'no-store');
});

test('feed never 500s the page: upstream failure → 200 []; non-GET → 405', async (t) => {
  stubFetch(t, null, false);
  let r = res(); await feed({ method: 'GET', query: {} }, r); assert.strictEqual(r.code, 200); assert.deepStrictEqual(r.body, []);
  r = res(); await feed({ method: 'POST', query: {} }, r); assert.strictEqual(r.code, 405);
});

// ── duplicate check ──────────────────────────────────────────────────────────

test('matches on >50% shared long words and returns only safe fields — never the preview', () => {
  const rows = [{ preview: 'urgent delivery notification package customs payment required immediately', score: 90, tags: ['delivery'], category: 'delivery', created_at: 'c', visibility: 'private' }];
  const m = findDuplicate('URGENT delivery notification: package customs payment required', rows);
  assert.ok(m); assert.deepStrictEqual(Object.keys(m).sort(), [...MATCH_FIELDS].sort());
  assert.ok(!('preview' in m) && !('visibility' in m));
});

test('no match below the threshold, on empty input, or against rows without a preview', () => {
  assert.strictEqual(findDuplicate('completely different wording here', [{ preview: 'urgent delivery notification package', score: 1 }]), null);
  assert.strictEqual(findDuplicate('', [{ preview: 'anything' }]), null);
  assert.strictEqual(findDuplicate('urgent delivery notification', [{ preview: null }, {}]), null);
  assert.strictEqual(findDuplicate('urgent delivery notification', null), null);
});

test('POST check-duplicate → {match}; missing preview → {match:null} without a query; non-POST → 405', async (t) => {
  let calls = stubFetch(t, [{ preview: 'urgent delivery notification package customs', score: 90, tags: [], category: 'delivery', created_at: 'c' }]);
  let r = res(); await dup({ method: 'POST', body: { preview: 'urgent delivery notification package customs payment' } }, r);
  assert.strictEqual(r.code, 200); assert.strictEqual(r.body.match.category, 'delivery'); assert.ok(!('preview' in r.body.match));
  assert.ok(calls[0].url.includes('limit=50')); assert.strictEqual(calls[0].opts.headers.apikey, 'service-key');
  calls = stubFetch(t, []);
  r = res(); await dup({ method: 'POST', body: {} }, r); assert.deepStrictEqual(r.body, { match: null }); assert.strictEqual(calls.length, 0);
  r = res(); await dup({ method: 'GET', body: {} }, r); assert.strictEqual(r.code, 405);
});
