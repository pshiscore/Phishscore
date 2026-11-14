// GET /api/get-news
//
// News stories from the last 7 days only (rolling, computed here in UTC),
// newest first. Older rows stay in threat_news for a future archive; this
// endpoint never returns them. Query parameters are ignored: the window and
// the row cap are fixed server-side.

const SUPABASE_URL = (process.env.REACT_APP_SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
// 5 feeds x 2 items a day x 7 days = 70 at most; the cap leaves headroom.
const MAX_ROWS = 100;
// A publish date slightly in the future (clock skew) is tolerated; anything
// later is not shown, so a bad date can never pin a story to the top.
const FUTURE_TOLERANCE_MS = 60 * 60 * 1000;
const FIELDS = Object.freeze(['id', 'source_name', 'article_url', 'title', 'hook', 'impact', 'takeaway', 'published_at']);

function newsWindow(nowMs = Date.now()) {
  return {
    since: new Date(nowMs - WINDOW_DAYS * DAY_MS).toISOString(),
    until: new Date(nowMs + FUTURE_TOLERANCE_MS).toISOString(),
  };
}

function buildQuery(nowMs = Date.now()) {
  const { since, until } = newsWindow(nowMs);
  return `threat_news?select=${FIELDS.join(',')}`
    + `&published_at=gte.${encodeURIComponent(since)}`
    + `&published_at=lte.${encodeURIComponent(until)}`
    + `&order=published_at.desc&limit=${MAX_ROWS}`;
}

// The database query already applies the window; this repeats it so the
// response is correct even if the query string is ever changed.
function inWindow(rows, nowMs = Date.now()) {
  if (!Array.isArray(rows)) return [];
  const { since, until } = newsWindow(nowMs);
  const lo = Date.parse(since), hi = Date.parse(until);
  return rows
    .filter(r => r && typeof r === 'object')
    .filter(r => { const t = Date.parse(r.published_at); return Number.isFinite(t) && t >= lo && t <= hi; })
    .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at))
    .slice(0, MAX_ROWS)
    .map(r => Object.fromEntries(FIELDS.map(f => [f, r[f] ?? null])));
}

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('get-news: missing env vars');
    return res.status(200).json([]);
  }

  const nowMs = Date.now();
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${buildQuery(nowMs)}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!r.ok) {
      console.error('get-news Supabase error:', r.status);
      return res.status(200).json([]);
    }
    return res.status(200).json(inWindow(await r.json(), nowMs));
  } catch (err) {
    console.error('get-news error:', err.message);
    return res.status(200).json([]);
  }
}

module.exports = handler;
Object.assign(module.exports, { newsWindow, buildQuery, inWindow, WINDOW_DAYS, MAX_ROWS, FIELDS });
