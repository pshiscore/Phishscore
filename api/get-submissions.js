// GET /api/get-submissions[?limit=N]
//
// The community feed, served with the service key so anon SELECT on
// `submissions` can be revoked. This endpoint is public, so it returns only
// what the feed displays (see FeedItem in src/App.js and TransparencyPage):
//   every row: id, created_at, category, score, tags, visibility,
//              classification_note
//   public rows only: summary (the one-sentence AI summary)
// Never returned: the sender (source), the message preview, radar_metadata
// (it holds the IPQS lookup with the sender's email or phone and the links
// found in the message), threat-check flags, and voters' feedback text.

const SUPABASE_URL = (process.env.REACT_APP_SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const DEFAULT_LIMIT = 1000; // matches what the browser fetched directly
const MAX_LIMIT = 1000;

const FEED_FIELDS = Object.freeze(['id', 'created_at', 'category', 'score', 'tags', 'visibility', 'classification_note']);
const PUBLIC_ONLY_FIELDS = Object.freeze(['summary']);
const SELECT = [...FEED_FIELDS, ...PUBLIC_ONLY_FIELDS].join(',');

// Builds each row from the allowlist, so a column added to the table later is
// not published by accident.
function toFeedRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.filter(row => row && typeof row === 'object').map(row => {
    const out = {};
    for (const f of FEED_FIELDS) out[f] = row[f] ?? null;
    const isPublic = row.visibility === 'public';
    for (const f of PUBLIC_ONLY_FIELDS) out[f] = isPublic ? (row[f] ?? null) : null;
    return out;
  });
}

function clampLimit(raw) {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('get-submissions: missing env vars');
    return res.status(200).json([]);
  }
  const limit = clampLimit(req.query?.limit);
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/submissions?select=${SELECT}&order=created_at.desc&limit=${limit}`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    if (!r.ok) {
      console.error('get-submissions Supabase error:', r.status);
      return res.status(200).json([]);
    }
    return res.status(200).json(toFeedRows(await r.json()));
  } catch (err) {
    console.error('get-submissions error:', err.message);
    return res.status(200).json([]);
  }
}

module.exports = handler;
Object.assign(module.exports, { toFeedRows, clampLimit, FEED_FIELDS, PUBLIC_ONLY_FIELDS, SELECT, DEFAULT_LIMIT, MAX_LIMIT });
