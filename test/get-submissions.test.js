// Tests for api/get-submissions.js and api/check-duplicate.js — the feed read paths
// that replace anon SELECT on `submissions`.

const test = require('node:test');
const assert = require('node:assert');

process.env.REACT_APP_SUPABASE_URL = 'https://db.example';
process.env.SUPABASE_SERVICE_KEY = 'service-key';
const feed = require('../api/get-submissions');
const dup = require('../api/check-duplicate');
const { toFeedRows, clampLimit, FEED_FIELDS, SELECT } = feed;
const { findDuplicate, MATCH_FIELDS } = dup;

function res() { const r = { code: null, body: null, headers: {} }; r.status = c => { r.code = c; return r; }; r.json = b => { r.body = b; return r; }; r.setHeader = (k, v) => { r.headers[k] = v; }; return r; }
function stubFetch(t, rows, ok = true) { const calls = []; t.mock.method(globalThis, 'fetch', async (url, opts) => { calls.push({ url: String(url), opts }); return { ok, status: ok ? 200 : 500, json: async () => rows, text: async () => '' }; }); return calls; }

const pub = { id: 1, visibility: 'public', preview: 'public text', source: '+15551234567', score: 80, category: 'finance', tags: ['a'], summary: 's' };
const priv = { id: 2, visibility: 'private', preview: 'private text', source: 'scammer@x.com', score: 60, category: 'job', tags: ['b'], summary: 'kept' };
const anon = { id: 3, visibility: 'anonymous', preview: null, source: null, score: 40, category: 'other', tags: [] };

// ── feed ─────────────────────────────────────────────────────────────────────

const md = { ipqs: { input: 'scammer@x.com', type: 'email' }, extracted_iocs: ['http://evil.example'] };
const full = (r) => ({ ...r, radar_metadata: md, delivery_channel: 'email', gsb_flagged: true, user_feedback: 'voter text', is_accurate: true, classification_note: 'auto', created_at: '2026-11-14T00:00:00Z' });
const NEVER = ['source', 'preview', 'radar_metadata', 'delivery_channel', 'gsb_flagged', 'user_feedback', 'is_accurate'];

test('no row carries the sender, the preview, metadata, flags or feedback text', () => {
  for (const r of toFeedRows([full(pub), full(priv), full(anon)])) {
    for (const f of NEVER) assert.ok(!(f in r), `${r.visibility} row has ${f}`);
    assert.deepStrictEqual(Object.keys(r).sort(), [...FEED_FIELDS, 'summary'].sort());
  }
});

test('only public rows keep the summary; every row keeps what the feed shows', () => {
  const [p, q, a] = toFeedRows([full(pub), full(priv), full(anon)]);
  assert.strictEqual(p.summary, 's'); assert.strictEqual(q.summary, null); assert.strictEqual(a.summary, null);
  assert.strictEqual(q.score, 60); assert.strictEqual(q.category, 'job'); assert.deepStrictEqual(q.tags, ['b']); assert.strictEqual(q.classification_note, 'auto');
});

test('does not mutate the input and tolerates garbage', () => {
  const copy = full(priv); toFeedRows([copy]); assert.strictEqual(copy.preview, 'private text');
  assert.deepStrictEqual(toFeedRows(null), []); assert.deepStrictEqual(toFeedRows([null, undefined, 'x']), []);
});

test('the database query selects only the allowlisted columns', () => {
  assert.strictEqual(SELECT, 'id,created_at,category,score,tags,visibility,classification_note,summary');
});

test('limit is clamped to [1, 1000] and defaults to 1000', () => {
  assert.strictEqual(clampLimit(undefined), 1000); assert.strictEqual(clampLimit('50'), 50);
  assert.strictEqual(clampLimit('5000'), 1000); assert.strictEqual(clampLimit('0'), 1000); assert.strictEqual(clampLimit('abc'), 1000);
});

test('GET feed → 200 with allowlisted fields only, served with the service key', async (t) => {
  const calls = stubFetch(t, [pub, priv, anon]);
  const r = res(); await feed({ method: 'GET', query: {} }, r);
  assert.strictEqual(r.code, 200); assert.strictEqual(r.body.length, 3);
  assert.ok(!('preview' in r.body[0]) && !('source' in r.body[0])); assert.strictEqual(r.body[1].summary, null); assert.strictEqual(r.body[0].summary, 's');
  assert.strictEqual(calls[0].opts.headers.apikey, 'service-key');
  assert.ok(calls[0].url.includes(`select=${SELECT}&order=created_at.desc&limit=1000`));
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
