const SUPABASE_URL = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/quick_scans?select=id,input_type,ai_score,ai_category,ai_tags,created_at&order=created_at.desc&limit=50`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );

    if (!r.ok) throw new Error(`Supabase error [${r.status}]`);
    const rows = await r.json();

    // Strip PII — never send raw_input or ipqs_data to the browser
    const safe = (Array.isArray(rows) ? rows : []).map(q => ({
      id: `qs_${q.id}`,
      _isQuickScan: true,
      score: q.ai_score,
      category: q.ai_category,
      visibility: 'private',
      input_type: q.input_type,
      preview: `Private ${q.input_type || 'quick'} scan — OSINT details hidden.`,
      tags: [],
      ai_tags: Array.isArray(q.ai_tags) ? q.ai_tags : [],
      created_at: q.created_at,
    }));

    return res.status(200).json(safe);
  } catch (err) {
    console.error('get-quick-scans error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
