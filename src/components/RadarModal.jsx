import { useState, useEffect } from "react";
import { PhishScoreLogo } from "./Primitives";
import { SCAM_CATEGORIES } from "../constants";

const getCat = (id) => SCAM_CATEGORIES.find(c => c.id === id) || SCAM_CATEGORIES[SCAM_CATEGORIES.length - 1];

const THREAT_CONFIG = [
  { level: 1, label: "LOW",      color: "#34d399", bg: "#34d39912", desc: "Scam activity is low. Stay aware but no elevated risk detected." },
  { level: 2, label: "GUARDED",  color: "#a3e635", bg: "#a3e63512", desc: "Minor scam activity detected across some categories." },
  { level: 3, label: "ELEVATED", color: "#fbbf24", bg: "#fbbf2412", desc: "Moderate scam activity. Be cautious with unsolicited messages." },
  { level: 4, label: "HIGH",     color: "#fb923c", bg: "#fb923c12", desc: "High scam activity detected. Verify all unexpected communications." },
  { level: 5, label: "CRITICAL", color: "#f43f5e", bg: "#f43f5e12", desc: "Critical scam surge. Exercise extreme caution." },
];

const HEAT_COLORS = {
  critical: { bg: "#f43f5e18", border: "#f43f5e50", text: "#f43f5e", label: "CRITICAL" },
  high:     { bg: "#fb923c18", border: "#fb923c50", text: "#fb923c", label: "HIGH" },
  moderate: { bg: "#fbbf2418", border: "#fbbf2450", text: "#fbbf24", label: "MED" },
  low:      { bg: "#34d39912", border: "#34d39930", text: "#34d399", label: "LOW" },
  none:     { bg: "transparent", border: "transparent", text: "#334155", label: "—" },
};

const MATRIX_VECTORS = ["Email", "SMS", "Social", "Phone", "Web", "Other"];
const VECTOR_KEYS = ["email", "sms", "social", "phone", "web", "other"];

// ── Sub-components ────────────────────────────────────────────────────────────

function ThreatMeter({ level, T, warning }) {
  const config = THREAT_CONFIG[level - 1] || THREAT_CONFIG[0];
  return (
    <div style={{ background: config.bg, border: `1px solid ${config.color}40`, borderRadius: 14, padding: "18px 20px", marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: warning ? 14 : 0 }}>
        <div style={{ position: "relative", width: 52, height: 52, flexShrink: 0 }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `2px solid ${config.color}`, animation: "radarPulse 2s ease-out infinite" }} />
          <div style={{ position: "absolute", inset: 6, borderRadius: "50%", border: `2px solid ${config.color}80`, animation: "radarPulse 2s ease-out infinite 0.5s" }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: config.color, fontFamily: "monospace" }}>{level}</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 3, color: config.color, fontFamily: "monospace", marginBottom: 4 }}>THREAT LEVEL — {config.label}</div>
          <div style={{ fontSize: 13, color: T.text2, fontFamily: "Georgia, serif", lineHeight: 1.5 }}>{config.desc}</div>
        </div>
      </div>
      {warning && (
        <div style={{ borderTop: `1px solid ${config.color}30`, paddingTop: 12 }}>
          <p style={{ color: T.text2, fontSize: 13, fontFamily: "Georgia, serif", lineHeight: 1.8, margin: 0 }}>{warning}</p>
        </div>
      )}
    </div>
  );
}

function SectorWarning({ warning, T }) {
  const cat = getCat(warning.category);
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 14px", background: T.innerBg, border: `1px solid ${T.innerBorder}`, borderRadius: 10, marginBottom: 8 }}>
      <div style={{ flexShrink: 0, marginTop: 2 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: cat.color, fontFamily: "monospace" }}>{warning.sector}</span>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {warning.surge && <span style={{ fontSize: 9, color: "#f43f5e", fontFamily: "monospace", background: "#f43f5e12", border: "1px solid #f43f5e35", padding: "1px 6px", borderRadius: 10 }}>↑ {warning.surge}%</span>}
            <span style={{ fontSize: 9, color: T.text4, fontFamily: "monospace" }}>{warning.count} reports</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {warning.topTags.map(tag => (
            <span key={tag} style={{ fontSize: 9, color: T.text3, background: T.cardBg, border: `1px solid ${T.cardBorder}`, padding: "1px 7px", borderRadius: 20, fontFamily: "monospace" }}>{tag}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function AiSignaturesCard({ pct, T }) {
  const color = pct >= 50 ? "#f43f5e" : pct >= 35 ? "#fb923c" : "#fbbf24";
  const display = pct != null ? pct : "—";
  return (
    <div style={{ background: T.innerBg, border: `1px solid ${T.innerBorder}`, borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ fontSize: 9, letterSpacing: 3, color: "#a78bfa", fontFamily: "monospace", marginBottom: 10 }}>AI-GENERATION SIGNATURES</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 32, fontWeight: 800, color: pct != null ? color : T.text4, fontFamily: "monospace", lineHeight: 1 }}>{display}{pct != null ? "%" : ""}</span>
        <span style={{ fontSize: 11, color: T.text3, fontFamily: "Georgia, serif", paddingBottom: 4 }}>of active threats show<br />LLM-generation patterns</span>
      </div>
      {pct != null && (
        <div style={{ background: T.ringTrack, borderRadius: 4, height: 6, overflow: "hidden", marginBottom: 8 }}>
          <div style={{ height: "100%", borderRadius: 4, background: `linear-gradient(90deg, #a78bfa, ${color})`, width: `${pct}%`, transition: "width 1s ease", boxShadow: `0 0 8px ${color}66` }} />
        </div>
      )}
      <div style={{ fontSize: 10, color: T.text4, fontFamily: "monospace" }}>Derived from community submissions — updated each Radar cycle</div>
    </div>
  );
}

function BrandLeaderboard({ brands, T }) {
  if (!brands || !brands.length) {
    return (
      <div style={{ background: T.innerBg, border: `1px solid ${T.innerBorder}`, borderRadius: 12, padding: "14px 16px" }}>
        <div style={{ fontSize: 9, letterSpacing: 3, color: "#f43f5e", fontFamily: "monospace", marginBottom: 12 }}>ACTIVE BRAND IMPERSONATIONS</div>
        <div style={{ fontSize: 11, color: T.text4, fontFamily: "monospace" }}>No brand impersonation data yet.</div>
      </div>
    );
  }
  return (
    <div style={{ background: T.innerBg, border: `1px solid ${T.innerBorder}`, borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ fontSize: 9, letterSpacing: 3, color: "#f43f5e", fontFamily: "monospace", marginBottom: 12 }}>ACTIVE BRAND IMPERSONATIONS</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {brands.map((b, i) => (
          <div key={b.name} style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <span style={{ fontSize: 9, color: T.text4, fontFamily: "monospace", width: 14, flexShrink: 0 }}>{i + 1}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.text, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</div>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, color: T.text3, fontFamily: "monospace", flexShrink: 0 }}>
              {b.count}×
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ThreatMatrix({ threatMatrix, T }) {
  const hasData = threatMatrix && Object.keys(threatMatrix).length > 0;
  const activeVectors = hasData ? VECTOR_KEYS.filter(k => threatMatrix[k]) : [];
  return (
    <div style={{ background: T.innerBg, border: `1px solid ${T.innerBorder}`, borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ fontSize: 9, letterSpacing: 3, color: "#fbbf24", fontFamily: "monospace", marginBottom: 12 }}>THREAT MATRIX — DELIVERY VECTOR</div>
      {!hasData ? (
        <div style={{ fontSize: 11, color: T.text4, fontFamily: "monospace" }}>No vector data yet — collecting from submissions.</div>
      ) : (
        <div style={{ overflowX: "auto", width: "100%" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 4, minWidth: 280 }}>
            <thead>
              <tr>
                <th style={{ fontSize: 9, color: T.text4, fontFamily: "monospace", fontWeight: 700, letterSpacing: 1, padding: "4px 6px", textAlign: "left" }}>VECTOR</th>
                <th style={{ fontSize: 9, color: T.text3, fontFamily: "monospace", fontWeight: 700, letterSpacing: 1, padding: "4px 6px", textAlign: "center" }}>REPORTS</th>
                <th style={{ fontSize: 9, color: T.text3, fontFamily: "monospace", fontWeight: 700, letterSpacing: 1, padding: "4px 6px", textAlign: "center" }}>AVG SCORE</th>
                <th style={{ fontSize: 9, color: T.text3, fontFamily: "monospace", fontWeight: 700, letterSpacing: 1, padding: "4px 6px", textAlign: "center" }}>RISK</th>
              </tr>
            </thead>
            <tbody>
              {activeVectors.map(key => {
                const row = threatMatrix[key];
                const h = HEAT_COLORS[row.heat] || HEAT_COLORS.none;
                return (
                  <tr key={key}>
                    <td style={{ fontSize: 10, color: T.text2, fontFamily: "monospace", fontWeight: 700, padding: "4px 6px", whiteSpace: "nowrap", textTransform: "uppercase" }}>{key}</td>
                    <td style={{ fontSize: 10, color: T.text3, fontFamily: "monospace", padding: "4px 6px", textAlign: "center" }}>{row.count}</td>
                    <td style={{ fontSize: 10, color: T.text3, fontFamily: "monospace", padding: "4px 6px", textAlign: "center" }}>{row.avg_score}</td>
                    <td style={{ padding: "4px 6px", textAlign: "center" }}>
                      <span style={{ display: "inline-block", background: h.bg, border: `1px solid ${h.border}`, color: h.text, fontSize: 8, fontWeight: 700, fontFamily: "monospace", letterSpacing: 1, padding: "3px 6px", borderRadius: 6, whiteSpace: "nowrap" }}>{h.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ fontSize: 9, color: T.text4, fontFamily: "monospace", marginTop: 8 }}>Derived from community submissions — updated each Radar cycle</div>
    </div>
  );
}

function IOCBoard({ iocs: rawIocs, T }) {
  const iocs = Array.isArray(rawIocs) && rawIocs.length
    ? rawIocs.map((v, i) => ({
        ts: `${(i + 1) * 2}h ago`,
        type: /^\d{1,3}(\.\d{1,3}){3}$/.test(v) ? "IP" : "Domain",
        value: v,
      }))
    : null;
  const [copied, setCopied] = useState(null);
  const copy = (val, i) => {
    navigator.clipboard.writeText(val).catch(() => {});
    setCopied(i);
    setTimeout(() => setCopied(null), 1800);
  };
  return (
    <div style={{ background: T.innerBg, border: `1px solid ${T.innerBorder}`, borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ fontSize: 9, letterSpacing: 3, color: "#06b6d4", fontFamily: "monospace", marginBottom: 12 }}>LIVE FORENSICS & IOCs</div>
      {!iocs ? (
        <div style={{ fontSize: 11, color: T.text4, fontFamily: "monospace" }}>No IOC data yet — collecting from submissions.</div>
      ) : (
        <div style={{ overflowX: "auto", width: "100%", maxWidth: "100%" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 360 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.innerBorder}` }}>
                {["Time", "Type", "Indicator", ""].map(h => (
                  <th key={h} style={{ fontSize: 9, color: T.text4, fontFamily: "monospace", fontWeight: 700, letterSpacing: 1, padding: "4px 8px", textAlign: "left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {iocs.map((ioc, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${T.innerBorder}20` }}>
                  <td style={{ fontSize: 9, color: T.text4, fontFamily: "monospace", padding: "7px 8px", whiteSpace: "nowrap" }}>{ioc.ts}</td>
                  <td style={{ fontSize: 9, fontFamily: "monospace", padding: "7px 8px", whiteSpace: "nowrap" }}>
                    <span style={{ color: ioc.type === "IP" ? "#fb923c" : "#a78bfa", background: ioc.type === "IP" ? "#fb923c12" : "#a78bfa12", border: `1px solid ${ioc.type === "IP" ? "#fb923c40" : "#a78bfa40"}`, padding: "2px 6px", borderRadius: 6 }}>{ioc.type}</span>
                  </td>
                  <td style={{ fontSize: 10, color: T.text2, fontFamily: "monospace", padding: "7px 8px", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", wordBreak: "break-all" }}>{ioc.value}</td>
                  <td style={{ padding: "7px 8px" }}>
                    <button onClick={() => copy(ioc.value, i)} title="Copy" style={{ background: "none", border: "none", cursor: "pointer", color: copied === i ? "#34d399" : T.text4, padding: 2, display: "flex", alignItems: "center" }}>
                      {copied === i
                        ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      }
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ fontSize: 9, color: T.text4, fontFamily: "monospace", marginTop: 8 }}>Derived from community submissions — not verified threat feeds</div>
    </div>
  );
}

// ── Shared radar content ──────────────────────────────────────────────────────
export function RadarPanel({ T = {}, onClose }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailValue, setEmailValue] = useState("");
  const [emailStatus, setEmailStatus] = useState(null);
  const [isReportExpanded, setIsReportExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  useEffect(() => { loadTrends(); }, []);

  const loadTrends = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/get-trends");
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json.data);
      setRefreshing(json.refreshing || false);
    } catch {
      setError("Unable to load radar data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendReport = async () => {
    if (!emailValue || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) { setEmailStatus("error"); return; }
    setEmailStatus("sending");
    try {
      const res = await fetch("/api/send-radar-report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: emailValue, radarData: data }) });
      if (!res.ok) throw new Error("Failed");
      setEmailStatus("success");
      setTimeout(() => { setEmailOpen(false); setEmailValue(""); setEmailStatus(null); }, 4000);
    } catch { setEmailStatus("error"); }
  };

  const formatLastUpdated = (iso) => {
    if (!iso) return "Never";
    const d = new Date(iso);
    const hours = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60));
    if (hours < 1) return "Just updated";
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const showAdvanced = !isMobile || isReportExpanded;

  return (
    <>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h2 style={{ color: T.text, fontFamily: "monospace", fontSize: 18, fontWeight: 800, margin: "0 0 4px", letterSpacing: 1 }}>
              PHISHSCORE <span style={{ color: "#f43f5e" }}>RADAR</span>
            </h2>
            <div style={{ fontSize: 9, color: T.text4, fontFamily: "monospace", letterSpacing: 2 }}>COMMUNITY THREAT INTELLIGENCE</div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
              <button
                onClick={() => { setEmailOpen(o => !o); setEmailStatus(null); }}
                title="Export radar report by email"
                style={{ background: T.innerBg, border: `1px solid ${T.cardBorder}`, color: T.text3, borderRadius: 9999, padding: "6px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 7, flexShrink: 0, fontSize: 11, fontFamily: "monospace", fontWeight: 600 }}
              >
                Export Report
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2,4 12,13 22,4"/>
                </svg>
              </button>
              {emailOpen && (
                <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-end" }}>
                  {emailStatus === "success" ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#34d399", fontFamily: "monospace" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      Report sent!
                    </div>
                  ) : (
                    <>
                      <input type="email" value={emailValue} onChange={e => setEmailValue(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSendReport()} placeholder="your@email.com"
                        style={{ fontSize: 10, fontFamily: "monospace", background: T.innerBg, border: `1px solid ${emailStatus === "error" ? "#f43f5e" : T.innerBorder}`, color: T.text, padding: "5px 8px", borderRadius: 6, width: "min(160px, 100%)", outline: "none" }} />
                      <button onClick={handleSendReport} disabled={emailStatus === "sending"}
                        style={{ fontSize: 9, fontFamily: "monospace", letterSpacing: 1.5, fontWeight: 700, background: "linear-gradient(135deg,#f43f5e,#be123c)", border: "none", color: "#fff", padding: "5px 10px", borderRadius: 6, cursor: emailStatus === "sending" ? "default" : "pointer", opacity: emailStatus === "sending" ? 0.7 : 1 }}>
                        {emailStatus === "sending" ? "SENDING..." : "SEND REPORT"}
                      </button>
                      {emailStatus === "error" && <div style={{ fontSize: 9, color: "#f43f5e", fontFamily: "monospace" }}>Failed — try again</div>}
                      <div style={{ fontSize: 10, color: T.text4, fontFamily: "monospace", textAlign: "center", marginTop: 4 }}>Subscription reports coming soon.</div>
                    </>
                  )}
                </div>
              )}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 9, color: T.text4, fontFamily: "monospace", letterSpacing: 1 }}>LAST UPDATED</div>
              <div style={{ fontSize: 11, color: refreshing ? "#fbbf24" : T.text3, fontFamily: "monospace" }}>{refreshing ? "REFRESHING..." : formatLastUpdated(data?.created_at)}</div>
              <div style={{ fontSize: 9, color: T.text4, fontFamily: "monospace", marginTop: 2 }}>Updates every 48h</div>
            </div>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: "center", padding: "48px 0" }}>
          <div style={{ fontSize: 32, marginBottom: 12, animation: "spin 2s linear infinite", display: "inline-block" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="2"/><path d="M12 2a10 10 0 0 1 10 10"/><path d="M12 6a6 6 0 0 1 6 6"/><line x1="12" y1="12" x2="19.5" y2="4.5"/>
            </svg>
          </div>
          <div style={{ fontSize: 11, color: T.text4, fontFamily: "monospace", letterSpacing: 2 }}>SCANNING...</div>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div style={{ textAlign: "center", padding: "32px 0" }}>
          <div style={{ fontSize: 13, color: T.text3, fontFamily: "Georgia, serif", marginBottom: 16 }}>{error}</div>
          <button onClick={loadTrends} style={{ background: "linear-gradient(135deg,#f43f5e,#be123c)", border: "none", color: "#fff", padding: "10px 24px", borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "monospace", letterSpacing: 2 }}>RETRY</button>
        </div>
      )}

      {/* No data */}
      {!loading && !error && !data && (
        <div style={{ textAlign: "center", padding: "32px 0" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📡</div>
          <div style={{ fontSize: 12, color: T.text3, fontFamily: "monospace", letterSpacing: 1, marginBottom: 8 }}>RADAR INITIALIZING</div>
          <div style={{ fontSize: 13, color: T.text4, fontFamily: "Georgia, serif", lineHeight: 1.7 }}>First scan is being generated. Check back in a few minutes.</div>
        </div>
      )}

      {/* Data */}
      {!loading && !error && data && (
        <>
          {/* ── ALWAYS VISIBLE ─────────────────────────────────────────────── */}
          <ThreatMeter level={data.threat_level || 1} T={T} warning={data.threat_warning} />

          {/* Intelligence Summary */}
          <div style={{ background: T.innerBg, border: `1px solid ${T.innerBorder}`, borderRadius: 12, padding: "14px 18px", marginBottom: 20 }}>
            <div style={{ fontSize: 9, letterSpacing: 3, color: "#f43f5e", fontFamily: "monospace", marginBottom: 8 }}>INTELLIGENCE SUMMARY</div>
            <p style={{ color: T.text2, fontSize: 13, fontFamily: "Georgia, serif", lineHeight: 1.8, margin: 0 }}>{data.ai_warning}</p>
          </div>

          {/* Recommended Action */}
          {data.recommended_action && (
            <div style={{ background: "#34d39912", border: "1px solid #34d39940", borderRadius: 12, padding: "14px 18px", marginBottom: 20, display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ flexShrink: 0, marginTop: 1 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 9, letterSpacing: 3, color: "#34d399", fontFamily: "monospace", marginBottom: 6 }}>WHAT TO DO NOW</div>
                <p style={{ color: T.text2, fontSize: 13, fontFamily: "Georgia, serif", lineHeight: 1.7, margin: 0 }}>{data.recommended_action}</p>
              </div>
            </div>
          )}

          {/* Sector Warnings */}
          {Array.isArray(data.sector_warnings) && data.sector_warnings.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 9, letterSpacing: 3, color: T.text3, fontFamily: "monospace", marginBottom: 10 }}>SECTOR ALERTS</div>
              {data.sector_warnings.map((w, i) => <SectorWarning key={i} warning={w} T={T} />)}
            </div>
          )}

          {/* Activity bar chart */}
          {Array.isArray(data.aggregation_snapshot) && data.aggregation_snapshot.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 9, letterSpacing: 3, color: T.text3, fontFamily: "monospace", marginBottom: 10 }}>ACTIVITY — LAST 100 REPORTS</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {data.aggregation_snapshot.slice(0, 5).map((cat, i) => {
                  const catInfo = getCat(cat.category);
                  const barWidth = Math.max(10, Math.min(100, (cat.count / (data.aggregation_snapshot[0]?.count || 1)) * 100));
                  return (
                    <div key={cat.category} style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <div style={{ width: 16, fontSize: 9, color: T.text4, fontFamily: "monospace", flexShrink: 0 }}>{i + 1}</div>
                      <div style={{ minWidth: 0, width: 100, maxWidth: 100, fontSize: 10, color: T.text2, fontFamily: "monospace", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{catInfo.label}</div>
                      <div style={{ flex: 1, minWidth: 0, background: T.ringTrack, borderRadius: 3, height: 5 }}>
                        <div style={{ height: "100%", borderRadius: 3, background: `linear-gradient(90deg, ${catInfo.color}, ${catInfo.color}66)`, width: `${barWidth}%`, transition: "width 0.8s ease" }} />
                      </div>
                      <div style={{ fontSize: 10, color: catInfo.color, fontFamily: "monospace", width: 24, textAlign: "right", flexShrink: 0 }}>{cat.count}</div>
                      <div style={{ fontSize: 9, color: T.text4, fontFamily: "monospace", width: 44, textAlign: "right", flexShrink: 0 }}>avg {cat.avgScore}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── MOBILE COLLAPSE TOGGLE ─────────────────────────────────────── */}
          {isMobile && !isReportExpanded && (
            <button
              onClick={() => setIsReportExpanded(true)}
              style={{ width: "100%", background: "linear-gradient(135deg, #1a0a2e, #0d0520)", border: "1px solid #a78bfa50", borderRadius: 12, padding: "14px 18px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 20 }}
            >
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#a78bfa", fontFamily: "monospace", letterSpacing: 1, marginBottom: 3 }}>VIEW FULL INTELLIGENCE REPORT</div>
                <div style={{ fontSize: 10, color: "#7c5cbf", fontFamily: "Georgia, serif" }}>AI signatures • Brand impersonations • Threat matrix • IOC board</div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
          )}

          {/* ── ADVANCED MODULES (desktop always, mobile when expanded) ───── */}
          {showAdvanced && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Row 1: AI Signatures + Brand Leaderboard */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
                <AiSignaturesCard pct={data.radar_metrics?.ai_pct ?? null} T={T} />
                <BrandLeaderboard brands={data.radar_metrics?.active_brands ?? null} T={T} />
              </div>

              {/* Row 2: Threat Matrix */}
              <ThreatMatrix threatMatrix={data.radar_metrics?.threat_matrix ?? null} T={T} />

              {/* Row 3: IOC Board */}
              <IOCBoard iocs={data.radar_metrics?.live_iocs ?? null} T={T} />

              {/* Collapse button on mobile */}
              {isMobile && isReportExpanded && (
                <button
                  onClick={() => setIsReportExpanded(false)}
                  style={{ width: "100%", background: "none", border: `1px dashed ${T.cardBorder}`, color: T.text4, borderRadius: 10, padding: "10px", cursor: "pointer", fontFamily: "monospace", fontSize: 10, letterSpacing: 1 }}
                >
                  ↑ COLLAPSE INTELLIGENCE REPORT
                </button>
              )}
            </div>
          )}

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${T.cardBorder}`, fontSize: 10, color: T.text4, fontFamily: "monospace", textAlign: "center" }}>
            Analysis based on last 100 community reports • AI analysis by Gemini
          </div>
        </>
      )}
    </>
  );
}

// ── Modal wrapper ─────────────────────────────────────────────────────────────
export default function RadarModal({ onClose, T = {} }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", backdropFilter: "blur(14px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 20, width: "100%", maxWidth: 520, maxHeight: "88vh", overflowY: "auto", padding: 28, position: "relative", boxShadow: "0 32px 96px rgba(0,0,0,0.7)" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, background: T.innerBg, border: `1px solid ${T.innerBorder}`, color: T.text3, width: 30, height: 30, borderRadius: "50%", cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center" }}>x</button>
        <div style={{ marginBottom: 6 }}><PhishScoreLogo T={T} size={16} dotSize={11} /></div>
        <RadarPanel T={T} onClose={onClose} />
      </div>
      <style>{`
        @keyframes radarPulse { 0%{transform:scale(0.8);opacity:1} 100%{transform:scale(1.6);opacity:0} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes slideIn { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  );
}
