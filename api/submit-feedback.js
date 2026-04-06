const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const RESEND_KEY = process.env.RESEND_API_KEY;
const ADMIN_EMAIL = 'contact@phishscore.ai';

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { caseId, is_accurate, feedbackText = '' } = req.body || {};

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
            feedback_at: new Date().toISOString(),
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

  // ── 2. Send admin alert for negative feedback ─────────────────────────────────
  if (!is_accurate && feedbackText && RESEND_KEY) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'PhishScore Alerts <alerts@phishscore.ai>',
          to: ADMIN_EMAIL,
          subject: `[PhishScore] Inaccurate result reported — Case ${caseId || 'unknown'}`,
          html: `
            <div style="font-family: monospace; background: #0d0f1a; color: #e2e8f0; padding: 24px; border-radius: 12px; max-width: 600px;">
              <h2 style="color: #f43f5e; margin: 0 0 16px;">Inaccurate Result Reported</h2>
              <p style="margin: 0 0 8px;"><strong>Case ID:</strong> ${caseId || 'N/A'}</p>
              <p style="margin: 0 0 8px;"><strong>Is Accurate:</strong> No</p>
              <p style="margin: 0 0 16px;"><strong>Submitted at:</strong> ${new Date().toISOString()}</p>
              <div style="background: #1a1d2e; border: 1px solid #f43f5e40; border-radius: 8px; padding: 16px;">
                <p style="margin: 0 0 6px; color: #94a3b8; font-size: 11px; letter-spacing: 2px;">USER FEEDBACK</p>
                <p style="margin: 0; color: #e2e8f0; line-height: 1.6;">${feedbackText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
              </div>
            </div>
          `,
        }),
      });
    } catch (err) {
      console.error('submit-feedback: Resend error', err.message);
    }
  }

  return res.status(200).json({ ok: true });
};
