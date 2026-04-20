const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('get-news: missing env vars');
    return res.status(200).json([]);
  }

  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/threat_news?select=*&order=published_at.desc&limit=60`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );

    if (!r.ok) {
      const errBody = await r.text();
      console.error('get-news Supabase error:', r.status, errBody);
      return res.status(200).json([]);
    }

    const rows = await r.json();
    return res.status(200).json(Array.isArray(rows) ? rows : []);
  } catch (err) {
    console.error('get-news error:', err.message);
    return res.status(200).json([]);
  }
};
