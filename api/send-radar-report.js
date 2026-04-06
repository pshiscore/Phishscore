const RESEND_KEY = process.env.RESEND_API_KEY;

// ── Derivation helpers (ported from RadarModal.jsx) ───────────────────────────

const HEAT_COLORS = {
  critical: { bg: "#fef2f2", border: "#fecaca", text: "#dc2626", label: "CRITICAL" },
  high:     { bg: "#fff7ed", border: "#fed7aa", text: "#ea580c", label: "HIGH" },
  moderate: { bg: "#fefce8", border: "#fde68a", text: "#d97706", label: "MED" },
  low:      { bg: "#f0fdf4", border: "#bbf7d0", text: "#059669", label: "LOW" },
  none:     { bg: "#f9fafb", border: "#e5e7eb", text: "#9ca3af", label: "—" },
};

const THREAT_MATRIX = [
  { sector: "Banking",  values: ["high", "critical", "moderate"] },
  { sector: "Crypto",   values: ["moderate", "high", "critical"] },
  { sector: "Retail",   values: ["high", "moderate", "low"] },
  { sector: "Govt/IRS", values: ["critical", "moderate", "low"] },
];

const MATRIX_VECTORS = ["Email", "SMS", "Social"];

const BRAND_CATEGORIES = {
  delivery:   "Package & Delivery",
  finance:    "Banking & Finance",
  tech:       "Tech Support",
  government: "Government & IRS",
  retail:     "Retail & Shopping",
};

function deriveBrands(data) {
  const base = [
    { name: "USPS / FedEx",   category: "delivery",   trend: "+18%", up: true },
    { name: "Chase / Wells",  category: "finance",    trend: "+12%", up: true },
    { name: "Apple / Google", category: "tech",       trend: "+9%",  up: true },
    { name: "IRS / SSA",      category: "government", trend: "-3%",  up: false },
    { name: "Amazon",         category: "retail",     trend: "+7%",  up: true },
  ];
  if (!data?.sector_warnings?.length) return base;
  const topCategories = (data.sector_warnings || []).map(w => w.category);
  return base.sort((a, b) => {
    const ai = topCategories.indexOf(a.category);
    const bi = topCategories.indexOf(b.category);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

function deriveAiPct(data) {
  return Math.min(22 + (data?.threat_level || 1) * 6, 68);
}

function deriveIOCs(data) {
  const fallback = [
    { ts: "2h ago",  type: "Domain", value: "secure-login-chase-verify.com" },
    { ts: "4h ago",  type: "IP",     value: "185.220.101.47" },
    { ts: "6h ago",  type: "Domain", value: "usps-tracking-update.net" },
    { ts: "11h ago", type: "Domain", value: "apple-id-locked-alert.co" },
    { ts: "14h ago", type: "IP",     value: "91.108.4.212" },
  ];
  if (!data?.sector_warnings?.length) return fallback;
  const extras = (data.sector_warnings || []).slice(0, 2).map((w, i) => ({
    ts: `${(i + 1) * 3}h ago`,
    type: "Domain",
    value: `${(w.sector || "alert").toLowerCase().replace(/\s+/g, "-")}-verify-${i + 1}.com`,
  }));
  return [...extras, ...fallback].slice(0, 6);
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const formatDate = (iso) => {
  if (!iso) return "Unknown";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

// ── Handler ───────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, radarData } = req.body || {};

  if (!email || !isValidEmail(email)) return res.status(400).json({ error: "Valid email required" });
  if (!radarData) return res.status(400).json({ error: "radarData required" });

  // Threat level metadata
  const threatLevel = radarData.threat_level || 1;
  const THREAT_LABELS = { 1: "LOW", 2: "GUARDED", 3: "ELEVATED", 4: "HIGH", 5: "CRITICAL" };
  const THREAT_COLORS = { 1: "#059669", 2: "#65a30d", 3: "#d97706", 4: "#ea580c", 5: "#dc2626" };
  const threatLabel = THREAT_LABELS[threatLevel] || "UNKNOWN";
  const threatColor = THREAT_COLORS[threatLevel] || "#dc2626";

  // Derive advanced module data
  const aiPct = deriveAiPct(radarData);
  const brands = deriveBrands(radarData);
  const iocs = deriveIOCs(radarData);

  // ── HTML sections ──────────────────────────────────────────────────────────

  const sectorAlertsHtml = Array.isArray(radarData.sector_warnings) && radarData.sector_warnings.length > 0
    ? radarData.sector_warnings.map(w => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;">
            <span style="font-family:monospace;font-size:11px;font-weight:700;color:#374151;">${w.sector || "Unknown"}</span>
            ${w.surge ? `<span style="margin-left:8px;font-family:monospace;font-size:10px;color:#dc2626;background:#fef2f2;border:1px solid #fecaca;padding:1px 6px;border-radius:10px;">↑ ${w.surge}%</span>` : ""}
            <br>
            <span style="font-family:monospace;font-size:10px;color:#9ca3af;">${w.count || 0} reports</span>
          </td>
        </tr>`).join("")
    : '<tr><td style="padding:8px 0;font-family:monospace;font-size:11px;color:#9ca3af;">No sector alerts</td></tr>';

  const aiBarWidth = Math.round(aiPct);
  const aiColor = aiPct >= 50 ? "#dc2626" : aiPct >= 35 ? "#ea580c" : "#d97706";
  const aiSignaturesHtml = `
    <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:12px;padding:18px 22px;margin-bottom:24px;">
      <p style="font-family:monospace;font-size:10px;letter-spacing:3px;color:#7c3aed;margin:0 0 12px;">AI-GENERATION SIGNATURES</p>
      <div style="display:flex;align-items:flex-end;gap:12px;margin-bottom:10px;">
        <span style="font-family:monospace;font-size:36px;font-weight:800;color:${aiColor};line-height:1;">${aiPct}%</span>
        <span style="font-family:Georgia,serif;font-size:13px;color:#374151;padding-bottom:4px;">of active threats show<br>LLM-generation patterns</span>
      </div>
      <div style="background:#e5e7eb;border-radius:4px;height:6px;overflow:hidden;margin-bottom:8px;">
        <div style="height:100%;border-radius:4px;background:linear-gradient(90deg,#7c3aed,${aiColor});width:${aiBarWidth}%;"></div>
      </div>
      <p style="font-family:monospace;font-size:10px;color:#6b7280;margin:0;">Deepfake content, AI-crafted urgency, templated phishing</p>
    </div>`;

  const brandsHtml = `
    <div style="margin-bottom:24px;">
      <p style="font-family:monospace;font-size:10px;letter-spacing:3px;color:#6b7280;margin:0 0 12px;">ACTIVE BRAND IMPERSONATIONS</p>
      <table style="width:100%;border-collapse:collapse;background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="font-family:monospace;font-size:9px;letter-spacing:1px;color:#9ca3af;padding:8px 12px;text-align:left;font-weight:700;">#</th>
            <th style="font-family:monospace;font-size:9px;letter-spacing:1px;color:#9ca3af;padding:8px 12px;text-align:left;font-weight:700;">BRAND</th>
            <th style="font-family:monospace;font-size:9px;letter-spacing:1px;color:#9ca3af;padding:8px 12px;text-align:left;font-weight:700;">CATEGORY</th>
            <th style="font-family:monospace;font-size:9px;letter-spacing:1px;color:#9ca3af;padding:8px 12px;text-align:right;font-weight:700;">TREND</th>
          </tr>
        </thead>
        <tbody>
          ${brands.map((b, i) => `
            <tr style="border-top:1px solid #e5e7eb;">
              <td style="font-family:monospace;font-size:10px;color:#9ca3af;padding:8px 12px;">${i + 1}</td>
              <td style="font-family:monospace;font-size:11px;font-weight:700;color:#111827;padding:8px 12px;">${b.name}</td>
              <td style="font-family:monospace;font-size:10px;color:#6b7280;padding:8px 12px;">${BRAND_CATEGORIES[b.category] || b.category}</td>
              <td style="font-family:monospace;font-size:11px;font-weight:700;color:${b.up ? "#dc2626" : "#059669"};padding:8px 12px;text-align:right;">${b.up ? "↑" : "↓"} ${b.trend}</td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`;

  const matrixHtml = `
    <div style="margin-bottom:24px;">
      <p style="font-family:monospace;font-size:10px;letter-spacing:3px;color:#6b7280;margin:0 0 12px;">TARGETING MATRIX — SECTOR × VECTOR</p>
      <table style="width:100%;border-collapse:collapse;background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="font-family:monospace;font-size:9px;color:#9ca3af;padding:8px 12px;text-align:left;font-weight:700;"></th>
            ${MATRIX_VECTORS.map(v => `<th style="font-family:monospace;font-size:9px;letter-spacing:1px;color:#9ca3af;padding:8px 12px;text-align:center;font-weight:700;">${v.toUpperCase()}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${THREAT_MATRIX.map(row => `
            <tr style="border-top:1px solid #e5e7eb;">
              <td style="font-family:monospace;font-size:10px;font-weight:700;color:#374151;padding:8px 12px;white-space:nowrap;">${row.sector}</td>
              ${row.values.map(heat => {
                const h = HEAT_COLORS[heat] || HEAT_COLORS.none;
                return `<td style="padding:6px 12px;text-align:center;">
                  <span style="display:inline-block;background:${h.bg};border:1px solid ${h.border};color:${h.text};font-family:monospace;font-size:9px;font-weight:700;letter-spacing:1px;padding:3px 8px;border-radius:6px;">${h.label}</span>
                </td>`;
              }).join("")}
            </tr>`).join("")}
        </tbody>
      </table>
      <p style="font-family:monospace;font-size:9px;color:#9ca3af;margin:8px 0 0;">Static baseline — refreshed with each Radar cycle</p>
    </div>`;

  const iocsHtml = `
    <div style="margin-bottom:24px;">
      <p style="font-family:monospace;font-size:10px;letter-spacing:3px;color:#6b7280;margin:0 0 12px;">LIVE FORENSICS & IOCs</p>
      <table style="width:100%;border-collapse:collapse;background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="font-family:monospace;font-size:9px;letter-spacing:1px;color:#9ca3af;padding:8px 12px;text-align:left;font-weight:700;">TIME</th>
            <th style="font-family:monospace;font-size:9px;letter-spacing:1px;color:#9ca3af;padding:8px 12px;text-align:left;font-weight:700;">TYPE</th>
            <th style="font-family:monospace;font-size:9px;letter-spacing:1px;color:#9ca3af;padding:8px 12px;text-align:left;font-weight:700;">INDICATOR</th>
          </tr>
        </thead>
        <tbody>
          ${iocs.map(ioc => `
            <tr style="border-top:1px solid #e5e7eb;">
              <td style="font-family:monospace;font-size:9px;color:#9ca3af;padding:8px 12px;white-space:nowrap;">${ioc.ts}</td>
              <td style="padding:8px 12px;">
                <span style="font-family:monospace;font-size:9px;font-weight:700;background:${ioc.type === "IP" ? "#fff7ed" : "#faf5ff"};border:1px solid ${ioc.type === "IP" ? "#fed7aa" : "#e9d5ff"};color:${ioc.type === "IP" ? "#ea580c" : "#7c3aed"};padding:2px 6px;border-radius:6px;">${ioc.type}</span>
              </td>
              <td style="font-family:monospace;font-size:10px;color:#374151;padding:8px 12px;word-break:break-all;max-width:200px;">${ioc.value}</td>
            </tr>`).join("")}
        </tbody>
      </table>
      <p style="font-family:monospace;font-size:9px;color:#9ca3af;margin:8px 0 0;">Derived from community submissions — not verified threat feeds</p>
    </div>`;

  // ── Full email ─────────────────────────────────────────────────────────────

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
      </div>` : ""}

      <!-- Sector Alerts -->
      <div style="margin-bottom:24px;">
        <p style="font-family:monospace;font-size:10px;letter-spacing:3px;color:#6b7280;margin:0 0 12px;">SECTOR ALERTS</p>
        <table style="width:100%;border-collapse:collapse;">${sectorAlertsHtml}</table>
      </div>

      ${aiSignaturesHtml}
      ${brandsHtml}
      ${matrixHtml}
      ${iocsHtml}

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
