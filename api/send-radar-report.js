const RESEND_KEY = process.env.RESEND_API_KEY;

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, radarData } = req.body || {};

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: "Valid email required" });
  }
  if (!radarData) {
    return res.status(400).json({ error: "radarData required" });
  }

  const threatLevel = radarData.threat_level || 1;
  const THREAT_LABELS = { 1: "LOW", 2: "GUARDED", 3: "ELEVATED", 4: "HIGH", 5: "CRITICAL" };
  const THREAT_COLORS = { 1: "#059669", 2: "#65a30d", 3: "#d97706", 4: "#ea580c", 5: "#dc2626" };
  const threatLabel = THREAT_LABELS[threatLevel] || "UNKNOWN";
  const threatColor = THREAT_COLORS[threatLevel] || "#dc2626";

  const formatDate = (iso) => {
    if (!iso) return "Unknown";
    return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const sectorAlertsHtml = Array.isArray(radarData.sector_warnings) && radarData.sector_warnings.length > 0
    ? radarData.sector_warnings.map(w => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;">
            <span style="font-family:monospace;font-size:11px;font-weight:700;color:#374151;">${w.sector || "Unknown"}</span>
            ${w.surge ? `<span style="margin-left:8px;font-family:monospace;font-size:10px;color:#dc2626;background:#fef2f2;border:1px solid #fecaca;padding:1px 6px;border-radius:10px;">↑ ${w.surge}%</span>` : ""}
            <br>
            <span style="font-family:monospace;font-size:10px;color:#9ca3af;">${w.count || 0} reports</span>
          </td>
        </tr>
      `).join("")
    : '<tr><td style="padding:8px 0;font-family:monospace;font-size:11px;color:#9ca3af;">No sector alerts</td></tr>';

  const primaryTargetsHtml = Array.isArray(radarData.primary_targets) && radarData.primary_targets.length > 0
    ? radarData.primary_targets.map(t => `<span style="display:inline-block;font-family:monospace;font-size:10px;color:#374151;background:#f3f4f6;border:1px solid #e5e7eb;padding:2px 8px;border-radius:10px;margin:2px;">${t}</span>`).join("")
    : '<span style="font-family:monospace;font-size:11px;color:#9ca3af;">N/A</span>';

  const html = `
    <div style="font-family:Georgia,serif;max-width:620px;margin:0 auto;background:#ffffff;padding:40px 32px;">

      <!-- Header -->
      <div style="margin-bottom:28px;">
        <div style="margin-bottom:6px;">
          <span style="font-family:monospace;font-size:22px;font-weight:800;color:#111;">PHISH</span><span style="font-family:monospace;font-size:22px;font-weight:800;color:#dc2626;">SCORE</span><span style="font-family:monospace;font-size:13px;color:#9ca3af;">.ai</span>
        </div>
        <p style="font-family:monospace;font-size:10px;letter-spacing:3px;color:#6b7280;margin:4px 0 0;">COMMUNITY THREAT INTELLIGENCE — RADAR REPORT</p>
      </div>

      <!-- Threat Level Banner -->
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
        <p style="font-family:monospace;font-size:10px;letter-spacing:3px;color:#9ca3af;margin:0 0 6px;">THREAT LEVEL</p>
        <div style="display:flex;align-items:center;gap:16px;">
          <span style="font-family:monospace;font-size:32px;font-weight:800;color:${threatColor};">${threatLevel}</span>
          <div>
            <p style="font-family:monospace;font-size:16px;font-weight:700;color:${threatColor};margin:0;">${threatLabel}</p>
            <p style="font-family:Georgia,serif;font-size:13px;color:#374151;margin:4px 0 0;line-height:1.5;">${radarData.threat_warning || "No additional warning."}</p>
          </div>
        </div>
      </div>

      <!-- Intelligence Summary -->
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:18px 22px;margin-bottom:24px;">
        <p style="font-family:monospace;font-size:10px;letter-spacing:3px;color:#dc2626;margin:0 0 10px;">INTELLIGENCE SUMMARY</p>
        <p style="font-family:Georgia,serif;font-size:14px;color:#374151;line-height:1.8;margin:0;">${radarData.ai_warning || "No summary available."}</p>
      </div>

      <!-- Recommended Action -->
      ${radarData.recommended_action ? `
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:18px 22px;margin-bottom:24px;">
        <p style="font-family:monospace;font-size:10px;letter-spacing:3px;color:#059669;margin:0 0 10px;">RECOMMENDED ACTION</p>
        <p style="font-family:Georgia,serif;font-size:14px;color:#374151;line-height:1.8;margin:0;">${radarData.recommended_action}</p>
      </div>
      ` : ""}

      <!-- Sector Alerts -->
      <div style="margin-bottom:24px;">
        <p style="font-family:monospace;font-size:10px;letter-spacing:3px;color:#6b7280;margin:0 0 12px;">SECTOR ALERTS</p>
        <table style="width:100%;border-collapse:collapse;">
          ${sectorAlertsHtml}
        </table>
      </div>

      <!-- Primary Targets -->
      ${Array.isArray(radarData.primary_targets) && radarData.primary_targets.length > 0 ? `
      <div style="margin-bottom:24px;">
        <p style="font-family:monospace;font-size:10px;letter-spacing:3px;color:#6b7280;margin:0 0 10px;">PRIMARY TARGETS</p>
        <div>${primaryTargetsHtml}</div>
      </div>
      ` : ""}

      <!-- Footer -->
      <div style="margin-top:32px;padding-top:20px;border-top:1px solid #e5e7eb;">
        <p style="font-family:monospace;font-size:10px;color:#9ca3af;margin:0 0 4px;">
          Report generated: ${formatDate(radarData.created_at)}
        </p>
        <div style="margin-top:14px;padding:14px 16px;background:#fefce8;border:1px solid #fde68a;border-radius:8px;">
          <p style="font-family:monospace;font-size:10px;font-weight:700;color:#92400e;letter-spacing:1px;margin:0 0 6px;">BETA NOTICE: AI-GENERATED ANALYSIS</p>
          <p style="font-family:Georgia,serif;font-size:11px;color:#78350f;line-height:1.7;margin:0;">
            This radar report is generated by the PhishScore AI engine using community-submitted scam reports. Threat levels and sector alerts reflect aggregated signal data and may not capture every emerging threat. Use this as a reference alongside other security practices.
          </p>
        </div>
        <p style="font-family:monospace;font-size:10px;color:#9ca3af;margin-top:12px;">
          PhishScore Radar — Community Threat Intelligence<br>
          Questions? contact@phishscore.ai
        </p>
      </div>

    </div>
  `;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "PhishScore Radar <reports@phishscore.ai>",
        to: email,
        subject: `PhishScore Radar Report — Threat Level ${threatLevel}: ${threatLabel}`,
        html,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Resend error:", err);
      return res.status(500).json({ error: "Failed to send email" });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("send-radar-report error:", err);
    return res.status(500).json({ error: "Failed to send email" });
  }
};
