import { useState, useEffect } from "react";
import { PhishScoreLogo } from "./Primitives";

const TIER_NAMES = {
  1: "AI Forensic Report",
  2: "Verified Human Check",
  3: "Expert Investigation",
};

const TIER_UPGRADE = [
  {
    tier: 2,
    name: "Verified Human Check",
    price: "$9.99",
    color: "#a78bfa",
    desc: "A human expert reviews your AI report to catch anything subtle that was missed.",
    cta: "ADD HUMAN REVIEW",
  },
  {
    tier: 3,
    name: "Expert Investigation",
    price: "$29.99",
    color: "#fbbf24",
    desc: "Full manual OSINT research, source verification, and a 1-on-1 custom recovery strategy.",
    cta: "REQUEST EXPERT INVESTIGATION",
  },
];

export default function ReportStatusModal({ caseId, onClose, T = {} }) {
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [pollCount, setPollCount] = useState(0);

  useEffect(() => {
    if (!caseId) return;
    fetchStatus();
  }, [caseId]);

  // Poll every 15s if report not ready yet
  useEffect(() => {
    if (!caseData) return;
    if (caseData.report_generated_at) return; // already done
    if (caseData.payment_status !== "paid") return; // not paid

    const timer = setTimeout(() => {
      setPollCount(p => p + 1);
      fetchStatus();
    }, 15000);
    return () => clearTimeout(timer);
  }, [caseData, pollCount]);

  const fetchStatus = async () => {
    try {
      const res = await fetch(
        `${process.env.REACT_APP_SUPABASE_URL}/rest/v1/deep_intel_cases?id=eq.${caseId}&select=id,created_at,original_category,original_score,ivs_score,ivs_label,tier,payment_status,report_generated_at,email_sent_at,email`,
        {
          headers: {
            apikey: process.env.REACT_APP_SUPABASE_ANON_KEY,
            Authorization: `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
          }
        }
      );
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length > 0) {
        setCaseData(rows[0]);
      } else {
        setError("Case not found.");
      }
    } catch (err) {
      setError("Unable to load case status.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (tier) => {
    if (!caseData?.email) return;
    setUpgradeLoading(true);
    try {
      const res = await fetch("/api/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier,
          email: caseData.email,
          message: "",
          story: `Upgrade from Tier ${caseData.tier} — original case ${caseId}`,
          originalScore: caseData.original_score,
          originalCategory: caseData.original_category,
          ivsScore: caseData.ivs_score,
          ivsLabel: caseData.ivs_label,
          entryPoint: "upgrade",
        })
      });
      const data = await res.json();
      if (data.checkoutUrl) window.location.href = data.checkoutUrl;
    } catch {
      alert("Failed to create upgrade checkout. Please try again.");
    } finally {
      setUpgradeLoading(false);
    }
  };

  const isReportReady = caseData?.report_generated_at;
  const isPaid = caseData?.payment_status === "paid";
  const tierPurchased = caseData?.tier || 1;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(14px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16, overflowY: "auto" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 20, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", padding: 28, position: "relative", boxShadow: "0 32px 96px rgba(0,0,0,0.7)" }}>

        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, background: T.innerBg, border: `1px solid ${T.innerBorder}`, color: T.text3, width: 30, height: 30, borderRadius: "50%", cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center" }}>x</button>

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ marginBottom: 6 }}><PhishScoreLogo T={T} size={16} dotSize={11} /></div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
            </svg>
            <span style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 800, color: T.text, letterSpacing: 1 }}>DEEP INTEL</span>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: "#f43f5e", border: "1px solid #f43f5e60", background: "#f43f5e12", padding: "2px 7px", borderRadius: 6, fontFamily: "monospace" }}>BETA</span>
          </div>
          <div style={{ fontSize: 9, color: T.text4, fontFamily: "monospace", letterSpacing: 2 }}>INVESTIGATION STATUS</div>
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ fontSize: 11, color: T.text4, fontFamily: "monospace", letterSpacing: 2 }}>LOADING CASE...</div>
          </div>
        )}

        {error && (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <div style={{ fontSize: 13, color: T.text3, fontFamily: "Georgia, serif", marginBottom: 16 }}>{error}</div>
            <button onClick={onClose} style={{ background: T.innerBg, border: `1px solid ${T.innerBorder}`, color: T.text3, padding: "10px 24px", borderRadius: 10, fontSize: 11, cursor: "pointer", fontFamily: "monospace" }}>CLOSE</button>
          </div>
        )}

        {!loading && !error && caseData && (
          <>
            {/* Case ID */}
            <div style={{ background: T.innerBg, border: `1px solid ${T.innerBorder}`, borderRadius: 10, padding: "10px 14px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 9, color: T.text4, fontFamily: "monospace", letterSpacing: 2, marginBottom: 2 }}>CASE ID</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: "monospace" }}>#{caseId.slice(0, 8).toUpperCase()}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 9, color: T.text4, fontFamily: "monospace", letterSpacing: 2, marginBottom: 2 }}>TIER</div>
                <div style={{ fontSize: 11, color: "#a78bfa", fontFamily: "monospace", fontWeight: 700 }}>{TIER_NAMES[tierPurchased]}</div>
              </div>
            </div>

            {/* Status */}
            <div style={{ background: isReportReady ? "#34d39912" : "#fbbf2412", border: `1px solid ${isReportReady ? "#34d39930" : "#fbbf2430"}`, borderRadius: 12, padding: "16px 18px", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontSize: 24 }}>{isReportReady ? "✅" : "⏳"}</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: isReportReady ? "#34d399" : "#fbbf24", fontFamily: "monospace", letterSpacing: 1, marginBottom: 4 }}>
                    {isReportReady ? "REPORT DELIVERED" : "GENERATING YOUR REPORT"}
                  </div>
                  <p style={{ color: T.text2, fontSize: 13, fontFamily: "Georgia, serif", lineHeight: 1.6, margin: 0 }}>
                    {isReportReady
                      ? `Your forensic case file has been emailed to ${caseData.email}. Check your inbox — including spam folder.`
                      : `Our AI agent is running forensic checks now. Your report will be emailed to ${caseData.email} within a few minutes. This page updates automatically.`}
                  </p>
                </div>
              </div>
            </div>

            {/* Case details */}
            {(caseData.original_score || caseData.ivs_score) && (
              <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
                {caseData.original_score && (
                  <div style={{ flex: 1, textAlign: "center", padding: "12px", background: T.innerBg, border: `1px solid ${T.innerBorder}`, borderRadius: 10 }}>
                    <div style={{ fontSize: 9, color: T.text4, fontFamily: "monospace", letterSpacing: 2, marginBottom: 6 }}>PHISHSCORE</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: "#f43f5e", fontFamily: "monospace" }}>{caseData.original_score}</div>
                  </div>
                )}
                {caseData.ivs_score && (
                  <div style={{ flex: 1, textAlign: "center", padding: "12px", background: T.innerBg, border: `1px solid ${T.innerBorder}`, borderRadius: 10 }}>
                    <div style={{ fontSize: 9, color: T.text4, fontFamily: "monospace", letterSpacing: 2, marginBottom: 6 }}>INTEL VALUE</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: "#a78bfa", fontFamily: "monospace" }}>{caseData.ivs_score}</div>
                  </div>
                )}
              </div>
            )}

            {/* Upgrade options — only show after report is ready and tier 1 */}
            {isReportReady && tierPurchased === 1 && (
              <div>
                <div style={{ fontSize: 9, letterSpacing: 3, color: T.text4, fontFamily: "monospace", marginBottom: 12 }}>WANT TO GO DEEPER?</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {TIER_UPGRADE.map(u => (
                    <div key={u.tier} style={{ background: T.innerBg, border: `1px solid ${u.color}40`, borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: u.color, fontFamily: "monospace" }}>{u.name}</span>
                          <span style={{ fontSize: 14, fontWeight: 800, color: u.color, fontFamily: "monospace" }}>{u.price}</span>
                        </div>
                        <p style={{ color: T.text3, fontSize: 12, fontFamily: "Georgia, serif", lineHeight: 1.5, margin: 0 }}>{u.desc}</p>
                      </div>
                      <button
                        onClick={() => handleUpgrade(u.tier)}
                        disabled={upgradeLoading}
                        style={{ background: `${u.color}18`, border: `1px solid ${u.color}60`, color: u.color, padding: "8px 14px", borderRadius: 8, fontSize: 9, fontWeight: 700, letterSpacing: 1, cursor: "pointer", fontFamily: "monospace", whiteSpace: "nowrap", flexShrink: 0 }}>
                        {upgradeLoading ? "..." : u.cta}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: 20, textAlign: "center" }}>
              <span style={{ fontSize: 11, color: T.text4, fontFamily: "monospace" }}>Questions? </span>
              <a href={`mailto:contact@phishscore.ai?subject=Deep Intel Case ${caseId.slice(0,8).toUpperCase()}`} style={{ fontSize: 11, color: "#a78bfa", fontFamily: "monospace", fontWeight: 700, textDecoration: "none" }}>contact@phishscore.ai</a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
