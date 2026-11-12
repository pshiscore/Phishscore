// POST /api/check-duplicate  { preview }
//
// The "we've seen this before" check used to run in the browser against the
// latest 50 submissions read with the anon key, previews included. It now runs
// here with the service key, so it keeps matching against private submissions
// after anon SELECT is revoked, and the matched row's text is never returned.

const SUPABASE_URL = (process.env.REACT_APP_SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const RECENT = 50;
const MAX_PREVIEW = 500;
const MATCH_FIELDS = Object.freeze(['score', 'tags', 'category', 'created_at']);

const significantWords = (s) => String(s || '').toLowerCase().split(/\s+/).filter(w => w.length > 5);

// Same similarity rule the browser used: share of the new text's long words
// that appear in a stored preview, > 0.5 counts as a duplicate.
function findDuplicate(preview, rows) {
  const words = significantWords(preview);
  if (!words.length || !Array.isArray(rows)) return null;
  for (const sub of rows) {
    if (!sub?.preview) continue;
    const subWords = significantWords(sub.preview);
    const matches = words.filter(w => subWords.includes(w)).length;
    if (matches / words.length > 0.5) {
      return Object.fromEntries(MATCH_FIELDS.map(f => [f, sub[f] ?? null]));
    }
  }
  return null;
}

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const preview = typeof req.body?.preview === 'string' ? req.body.preview.slice(0, MAX_PREVIEW) : '';
  if (!preview.trim()) return res.status(200).json({ match: null });
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(200).json({ match: null });
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/submissions?select=preview,${MATCH_FIELDS.join(',')}&order=created_at.desc&limit=${RECENT}`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    if (!r.ok) return res.status(200).json({ match: null });
    return res.status(200).json({ match: findDuplicate(preview, await r.json()) });
  } catch (err) {
    console.error('check-duplicate error:', err.message);
    return res.status(200).json({ match: null });
  }
}

module.exports = handler;
Object.assign(module.exports, { findDuplicate, significantWords, MATCH_FIELDS, RECENT });
