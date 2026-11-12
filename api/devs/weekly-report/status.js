// GET /api/devs/weekly-report/status?id=<report_id>
// Returns the current state of a weekly_reports row for UI polling.

const { authorizeSession } = require('../../_utils/cronAuth');

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL?.replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!authorizeSession(req).ok) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id required' });

  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/weekly_reports?id=eq.${id}&select=id,status,week_start_date,week_end_date,triggered_by,cost_usd,error_message,completed_at&limit=1`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    const rows = await r.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
