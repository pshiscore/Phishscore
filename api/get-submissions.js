// GET /api/get-submissions[?limit=N]
//
// The community feed, served with the service key so anon SELECT on
// `submissions` can be revoked. A submitter who chose "private" was promised
// that the message preview and the sender stay hidden; until now that was
// enforced only in the browser, and the anon key returned both. They are
// nulled here instead. "anonymous" rows are stored without them already.

const SUPABASE_URL = (process.env.REACT_APP_SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const DEFAULT_LIMIT = 1000; // matches what the browser fetched directly
const MAX_LIMIT = 1000;

const HIDDEN_FOR_PRIVATE = Object.freeze(['preview', 'source']);

function stripPrivate(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map(row => {
    if (!row || row.visibility !== 'private') return row;
    const out = { ...row };
    for (const f of HIDDEN_FOR_PRIVATE) out[f] = null;
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
      `${SUPABASE_URL}/rest/v1/submissions?select=*&order=created_at.desc&limit=${limit}`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    if (!r.ok) {
      console.error('get-submissions Supabase error:', r.status, await r.text());
      return res.status(200).json([]);
    }
    return res.status(200).json(stripPrivate(await r.json()));
  } catch (err) {
    console.error('get-submissions error:', err.message);
    return res.status(200).json([]);
  }
}

module.exports = handler;
Object.assign(module.exports, { stripPrivate, clampLimit, HIDDEN_FOR_PRIVATE, DEFAULT_LIMIT, MAX_LIMIT });
