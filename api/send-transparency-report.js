const RESEND_KEY = process.env.RESEND_API_KEY;

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, reportData } = req.body || {};

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: 'Valid email required' });
  }
  if (!reportData) {
    return res.status(400).json({ error: 'reportData required' });
  }

  const { total, scams, safe, scamRate, pubCount, privCount, anonCount, autoCount, reclassCount, catBreakdown, month } = reportData;

  const formatDate = () => new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const catRowsHtml = Array.isArray(catBreakdown) && catBreakdown.length > 0
    ? catBreakdown.slice(0, 6).map((cat, i) => `
        <tr>
          <td style="padding:7px 0;border-bottom:1px solid #f3f4f6;font-family:monospace;font-size:10px;color:#6b7280;">${i + 1}</td>
          <td style="padding:7px 8px;border-bottom:1px solid #f3f4f6;font-family:monospace;font-size:11px;color:#374151;font-weight:600;">${cat.label}</td>
          <td style="padding:7px 0;border-bottom:1px solid #f3f4f6;font-family:monospace;font-size:11px;color:#374151;text-align:right;">${cat.count}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="3" style="padding:8px 0;font-family:monospace;font-size:11px;color:#9ca3af;">No category data</td></tr>';

  const html = `
    <div style="font-family:Georgia,serif;max-width:620px;margin:0 auto;background:#ffffff;padding:40px 32px;">

      <!-- Header -->
      <div style="margin-bottom:28px;">
        <div style="margin-bottom:6px;">
          <span style="font-family:monospace;font-size:22px;font-weight:800;color:#111;">PHISH</span><span style="font-family:monospace;font-size:22px;font-weight:800;color:#dc2626;">SCORE</span><span style="font-family:monospace;font-size:13px;color:#9ca3af;">.ai</span>
        </div>
        <p style="font-family:monospace;font-size:10px;letter-spacing:3px;color:#6b7280;margin:4px 0 0;">TRANSPARENCY REPORT — ${(month || formatDate()).toUpperCase()}</p>
      </div>

      <!-- Stats Grid -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <tr>
          ${[
            { label: 'TOTAL REPORTS', value: total ?? 0, color: '#5b6cf8' },
            { label: 'CONFIRMED SCAMS', value: scams ?? 0, color: '#dc2626' },
            { label: 'SCAM RATE', value: (scamRate ?? 0) + '%', color: '#ea580c' },
            { label: 'LIKELY SAFE', value: safe ?? 0, color: '#059669' },
          ].map(s => `
            <td style="width:25%;padding:4px;">
              <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px 12px;border-top:3px solid ${s.color};">
                <p style="font-family:monospace;font-size:9px;letter-spacing:2px;color:#6b7280;margin:0 0 6px;">${s.label}</p>
                <p style="font-family:monospace;font-size:22px;font-weight:800;color:${s.color};margin:0;">${s.value}</p>
              </div>
            </td>
          `).join('')}
        </tr>
      </table>

      <!-- Privacy Breakdown -->
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:18px 22px;margin-bottom:24px;">
        <p style="font-family:monospace;font-size:10px;letter-spacing:3px;color:#374151;margin:0 0 12px;">SUBMISSION PRIVACY</p>
        ${[
          { label: 'Public', value: pubCount ?? 0, color: '#059669' },
          { label: 'Private', value: privCount ?? 0, color: '#38bdf8' },
          { label: 'Anonymous', value: anonCount ?? 0, color: '#94a3b8' },
        ].map(v => `
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
            <span style="font-family:monospace;font-size:10px;color:${v.color};font-weight:700;min-width:72px;">${v.label}</span>
            <span style="font-family:monospace;font-size:11px;color:#374151;">${v.value}</span>
          </div>
        `).join('')}
      </div>

      <!-- AI Classification -->
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:18px 22px;margin-bottom:24px;">
        <p style="font-family:monospace;font-size:10px;letter-spacing:3px;color:#374151;margin:0 0 12px;">AI CLASSIFICATION</p>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding-right:24px;">
              <p style="font-family:monospace;font-size:22px;font-weight:800;color:#a78bfa;margin:0;">${autoCount ?? 0}</p>
              <p style="font-family:monospace;font-size:9px;letter-spacing:2px;color:#6b7280;margin:4px 0 0;">AUTO-CLASSIFIED</p>
            </td>
            <td>
              <p style="font-family:monospace;font-size:22px;font-weight:800;color:#f97316;margin:0;">${reclassCount ?? 0}</p>
              <p style="font-family:monospace;font-size:9px;letter-spacing:2px;color:#6b7280;margin:4px 0 0;">RECLASSIFIED</p>
            </td>
          </tr>
        </table>
      </div>

      <!-- Top Categories -->
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:18px 22px;margin-bottom:24px;">
        <p style="font-family:monospace;font-size:10px;letter-spacing:3px;color:#374151;margin:0 0 12px;">TOP SCAM CATEGORIES</p>
        <table style="width:100%;border-collapse:collapse;">
          ${catRowsHtml}
        </table>
      </div>

      <!-- Footer -->
      <div style="margin-top:24px;padding-top:18px;border-top:1px solid #e5e7eb;">
        <p style="font-family:monospace;font-size:10px;color:#9ca3af;margin:0 0 4px;">Report generated: ${formatDate()}</p>
        <p style="font-family:monospace;font-size:10px;color:#9ca3af;margin:8px 0 0;">
          PhishScore Transparency Report — Community-driven scam detection<br>
          contact@phishscore.ai
        </p>
      </div>

    </div>
  `;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'PhishScore Reports <reports@phishscore.ai>',
        to: email,
        subject: `PhishScore Transparency Report — ${month || formatDate()}`,
        html,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Resend error:', err);
      return res.status(500).json({ error: 'Failed to send email' });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('send-transparency-report error:', err);
    return res.status(500).json({ error: 'Failed to send email' });
  }
};
