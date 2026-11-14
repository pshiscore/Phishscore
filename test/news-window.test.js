// /api/get-news returns only stories published in the last 7 days (rolling,
// UTC, computed on the server), newest first, capped, ignoring any query
// parameters. Older rows stay in threat_news.

const test = require('node:test');
const assert = require('node:assert');

process.env.REACT_APP_SUPABASE_URL = 'https://db.example';
process.env.SUPABASE_SERVICE_KEY = 'service-key';
const news = require('../api/get-news');
const { publishedAt } = require('../api/cron/fetch-news');

const DAY = 24 * 60 * 60 * 1000;
const ago = (days) => new Date(Date.now() - days * DAY).toISOString();
const story = (id, days, extra = {}) => ({ id, source_name: 'The Record', article_url: `https://x.example/${id}`, title: 't', hook: 'h', impact: 'i', takeaway: 'a', published_at: ago(days), created_at: ago(0), ...extra });

function res() { const r = { code: null, body: null, headers: {} }; r.status = c => { r.code = c; return r; }; r.json = b => { r.body = b; return r; }; r.setHeader = (k, v) => { r.headers[k] = v; }; return r; }
function stubFetch(t, rows, ok = true) { const calls = []; t.mock.method(globalThis, 'fetch', async (url, opts) => { calls.push({ url: String(url), opts }); return { ok, status: ok ? 200 : 500, json: async () => rows }; }); return calls; }

test('a story 6 days old is returned; one 8 days old is not', async (t) => {
  stubFetch(t, [story('old', 8), story('recent', 6)]);
  const r = res(); await news({ method: 'GET', query: {} }, r);
  assert.strictEqual(r.code, 200);
  assert.deepStrictEqual(r.body.map(s => s.id), ['recent']);
});

test('an empty window returns 200 with an empty list', async (t) => {
  stubFetch(t, []);
  const r = res(); await news({ method: 'GET', query: {} }, r);
  assert.strictEqual(r.code, 200); assert.deepStrictEqual(r.body, []);
});

test('newest first, allowlisted fields, future-dated rows dropped', async (t) => {
  stubFetch(t, [story('a', 3), story('b', 1), story('future', -2), story('bad', 0, { published_at: 'not a date' })]);
  const r = res(); await news({ method: 'GET', query: {} }, r);
  assert.deepStrictEqual(r.body.map(s => s.id), ['b', 'a']);
  assert.deepStrictEqual(Object.keys(r.body[0]).sort(), [...news.FIELDS].sort());
  assert.ok(!('created_at' in r.body[0]));
});

test('the database query applies the window and the cap, and ignores client parameters', async (t) => {
  const calls = stubFetch(t, []);
  const before = Date.now();
  const r = res(); await news({ method: 'GET', query: { limit: '5000', since: '2020-01-01', days: '365' } }, r);
  const u = new URL(calls[0].url);
  const gte = u.searchParams.getAll('published_at').find(v => v.startsWith('gte.')).slice(4);
  const since = Date.parse(gte);
  assert.ok(Math.abs(since - (before - 7 * DAY)) < 5000, 'since is now minus 7 days');
  assert.ok(u.searchParams.getAll('published_at').some(v => v.startsWith('lte.')));
  assert.strictEqual(u.searchParams.get('limit'), String(news.MAX_ROWS));
  assert.strictEqual(u.searchParams.get('order'), 'published_at.desc');
  assert.strictEqual(calls[0].opts.headers.apikey, 'service-key');
  assert.strictEqual(r.headers['Cache-Control'], 'no-store');
});

test('more rows than the cap are cut to the cap', () => {
  const rows = Array.from({ length: news.MAX_ROWS + 20 }, (_, i) => story(`s${i}`, (i % 6) + 0.1));
  assert.strictEqual(news.inWindow(rows).length, news.MAX_ROWS);
});

test('upstream failure → 200 []; non-GET → 405', async (t) => {
  stubFetch(t, null, false);
  let r = res(); await news({ method: 'GET', query: {} }, r); assert.strictEqual(r.code, 200); assert.deepStrictEqual(r.body, []);
  r = res(); await news({ method: 'POST', query: {} }, r); assert.strictEqual(r.code, 405);
});

test('fetch-news keeps real publish dates and falls back to fetch time only when unusable', () => {
  const fetchedAt = new Date('2026-11-14T12:00:00Z');
  assert.deepStrictEqual(publishedAt({ pubDate: 'Mon, 21 Sep 2026 22:24:38 +0000' }, fetchedAt), { iso: '2026-09-21T22:24:38.000Z', fallback: false }, 'an old but valid date is kept');
  assert.deepStrictEqual(publishedAt({ isoDate: '2026-11-13T21:04:33.000Z', pubDate: 'garbage' }, fetchedAt), { iso: '2026-11-13T21:04:33.000Z', fallback: false });
  for (const item of [{}, { pubDate: 'not a date' }, { pubDate: '2026-11-20T00:00:00Z' }, null]) {
    assert.deepStrictEqual(publishedAt(item, fetchedAt), { iso: fetchedAt.toISOString(), fallback: true }, JSON.stringify(item));
  }
  assert.deepStrictEqual(require('../api/cron/fetch-news').config, { maxDuration: 60 });
});

test('the News panel has no stale-source filter and a neutral 7-day empty state', () => {
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'src/components/NewsPanel.jsx'), 'utf8');
  assert.ok(!src.includes("'Fraud of the Day'"));
  assert.ok(src.includes('NO STORIES IN THE PAST 7 DAYS'));
  assert.ok(!/warming up|load more|loadMore|IntersectionObserver|onScroll/i.test(src));
  assert.ok(!/threat_news/.test(src), 'the panel reads /api/get-news, never the table');
});

test('no browser code touches threat_news with the anon key', () => {
  const { execSync } = require('node:child_process');
  const hits = execSync('git grep -n "threat_news" -- src || true', { cwd: require('node:path').join(__dirname, '..') }).toString()
    .split('\n').filter(l => l && !/\/\/|\* /.test(l.split(':').slice(2).join(':')));
  assert.deepStrictEqual(hits, []);
});
