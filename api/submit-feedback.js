const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { caseId, trainingId, is_accurate, feedbackText = '' } = req.body || {};

  if (is_accurate === undefined) {
    return res.status(400).json({ error: 'is_accurate is required' });
  }

  // ── 1. Update Supabase ────────────────────────────────────────────────────────
  if (caseId) {
    try {
      const patch = await fetch(
        `${SUPABASE_URL}/rest/v1/submissions?id=eq.${caseId}`,
        {
          method: 'PATCH',
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({
            is_accurate,
            user_feedback: feedbackText || null,
            // There is no feedback_at column on submissions; sending it made
            // PostgREST reject every PATCH, so no feedback was ever stored.
          }),
        }
      );
      if (!patch.ok) {
        console.error('submit-feedback: Supabase PATCH failed', await patch.text());
      }
    } catch (err) {
      console.error('submit-feedback: Supabase error', err.message);
    }
  }

  // ── 2. Update training_data accuracy label ────────────────────────────────────
  if (trainingId) {
    try {
      const patch = await fetch(
        `${SUPABASE_URL}/rest/v1/training_data?id=eq.${trainingId}`,
        {
          method: 'PATCH',
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({ is_accurate }),
        }
      );
      if (!patch.ok) {
        console.error('submit-feedback: training_data PATCH failed', await patch.text());
      }
    } catch (err) {
      console.error('submit-feedback: training_data error', err.message);
    }
  }

  return res.status(200).json({ ok: true });
};
