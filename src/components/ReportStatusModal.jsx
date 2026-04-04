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
    price: "$14.99",
    color: "#a78bfa",
    desc: "A human expert reviews your AI report to catch anything subtle that was missed.",
    cta: "ADD HUMAN REVIEW",
  },
  {
    tier: 3,
    name: "Expert Investigation",
    price: "$49.99",
    color: "#fbbf24",
    desc: "Full manual OSINT research, source verification, and a 1-on-1 custom recovery strategy.",
    cta: "REQUEST EXPERT INVESTIGATION",
  },
];

export default function ReportStatusModal({ caseId, token, onClose, T = {} }) {
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  // Poll every 15s if report not ready yet (Tier 1 only)
  useEffect(() => {
    if (!caseData) return;
    if (caseData.tier !== 1) return; // T2/T3 don't auto-generate
    if (caseData.report_generated_at) return;
    if (caseData.payment_status !== "paid") return;

    const timer = setTimeout(() => {
      setPollCount(p => p + 1);
      fetchStatus();
    }, 15000);
    return () => clearTimeout(timer);
  }, [caseData, pollCount]);

  const fetchStatus = async () => {
    try {
      let url;
      if (token) {
        url = `${process.env.REACT_APP_SUPABASE_URL}/rest/v1/deep_intel_cases?report_token=eq.${token}&select=id,created_at,original_category,original_score,ivs_score,ivs_label,tier,payment_status,report_generated_at,email_sent_at,email,report_token`;
      } else {
        url = `${process.env.REACT_APP_SUPABASE_URL}/rest/v1/deep_intel_cases?id=eq.${caseId}&select=id,created_at,original_category,original_score,ivs_score,ivs_label,tier,payment_status,report_generated_at,email_sent_at,email,report_token`;
      }

      const res = await fetch(url, {
        headers: {
          apikey: process.env.REACT_APP_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
        }
      });
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length > 0) {
        const data = rows[0];
        setCaseData(data);
        // Trigger analysis for T1 if paid but not yet generated
        if (data.tier === 1 && data.payment_status === 'paid' && !data.report_generated_at) {
          triggerAnalysis(data.id);
        }
      } else {
        setError("Case not found. The link may have expired or be incorrect.");
      }
    } catch (err) {
      setError("Unable to load case status.");
    } finally {
      setLoading(false);
    }
  };

  const triggerAnalysis = async (id) => {
    try {
      await fetch('/api/deep-intel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId: id || caseId })
      });
    } catch (err) {
      console.error('Failed to trigger analysis:', err);
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
          story: `Upgrade from Tier ${caseData.tier} — original case ${caseData.id}`,
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

  const handleCopyLink = () => {
    const reportLink = caseData.report_token
      ? `https://phishscore.ai/report?token=${caseData.report_token}`
      : `https://phishscore.ai/report?case=${caseData.id}`;
    navigator.clipboard.writeText(reportLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
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
                <div style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: "monospace" }}>#{caseData.id.slice(0, 8).toUpperCase()}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 9, color: T.text4, fontFamily: "monospace", letterSpacing: 2, marginBottom: 2 }}>TIER</div>
                <div style={{ fontSize: 11, color: "#a78bfa", fontFamily: "monospace", fontWeight: 700 }}>{TIER_NAMES[tierPurchased]}</div>
              </div>
            </div>

            {/* ── TIER 1 STATUS ── */}
            {tierPurchased === 1 && (
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
                {/* Copy link */}
                {isReportReady && caseData.report_token && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #34d39930" }}>
                    <div style={{ fontSize: 10, color: T.text4, fontFamily: "monospace", letterSpacing: 1, marginBottom: 6 }}>YOUR REPORT LINK — SAVE THIS</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <div style={{ flex: 1, background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 8, padding: "8px 12px", fontSize: 11, color: T.text3, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        phishscore.ai/report?token={caseData.report_token.slice(0, 16)}...
                      </div>
                      <button onClick={handleCopyLink} style={{ background: copied ? "#34d39918" : T.innerBg, border: `1px solid ${copied ? "#34d39960" : T.innerBorder}`, color: copied ? "#34d399" : T.text3, padding: "8px 14px", borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "monospace", letterSpacing: 1, whiteSpace: "nowrap", flexShrink: 0, transition: "all 0.2s" }}>
                        {copied ? "COPIED ✓" : "COPY LINK"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── TIER 2 STATUS ── */}
            {tierPurchased === 2 && (
              <div style={{ background: "#a78bfa12", border: "1px solid #a78bfa30", borderRadius: 12, padding: "16px 18px", marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ fontSize: 24 }}>🔍</div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#a78bfa", fontFamily: "monospace", letterSpacing: 1, marginBottom: 4 }}>HUMAN REVIEW REQUESTED</div>
                    <p style={{ color: T.text2, fontSize: 13, fontFamily: "Georgia, serif", lineHeight: 1.6, margin: 0 }}>
                      A human expert has been notified and will review your AI forensic report. You will be contacted at <strong>{caseData.email}</strong> once the review is complete — typically within 24 hours.
                    </p>
                  </div>
                </div>
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #a78bfa30", fontSize: 12, color: T.text3, fontFamily: "Georgia, serif", lineHeight: 1.6 }}>
                  In the meantime, your AI Forensic Report has already been emailed to you. Questions? <a href={`mailto:contact@phishscore.ai?subject=Case ${caseData.id.slice(0,8).toUpperCase()} Human Review`} style={{ color: "#a78bfa", textDecoration: "none", fontWeight: 700 }}>contact@phishscore.ai</a>
                </div>
              </div>
            )}

            {/* ── TIER 3 STATUS ── */}
            {tierPurchased === 3 && (
              <div style={{ background: "#fbbf2412", border: "1px solid #fbbf2430", borderRadius: 12, padding: "16px 18px", marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ fontSize: 24 }}>🕵️</div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#fbbf24", fontFamily: "monospace", letterSpacing: 1, marginBottom: 4 }}>EXPERT INVESTIGATION ASSIGNED</div>
                    <p style={{ color: T.text2, fontSize: 13, fontFamily: "Georgia, serif", lineHeight: 1.6, margin: 0 }}>
                      Your case has been assigned to an expert investigator who will conduct full OSINT research and source verification. You will be contacted at <strong>{caseData.email}</strong> with your complete investigation report and a 1-on-1 strategy session.
                    </p>
                  </div>
                </div>
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #fbbf2430", fontSize: 12, color: T.text3, fontFamily: "Georgia, serif", lineHeight: 1.6 }}>
                  Expected turnaround: 24-48 hours. Questions? <a href={`mailto:contact@phishscore.ai?subject=Case ${caseData.id.slice(0,8).toUpperCase()} Expert Investigation`} style={{ color: "#fbbf24", textDecoration: "none", fontWeight: 700 }}>contact@phishscore.ai</a>
                </div>
              </div>
            )}

            {/* Intel Value */}
            {caseData.ivs_score && (
              <div style={{ textAlign: "center", padding: "14px", background: T.innerBg, border: `1px solid ${T.innerBorder}`, borderRadius: 10, marginBottom: 20 }}>
                <div style={{ fontSize: 9, color: T.text4, fontFamily: "monospace", letterSpacing: 2, marginBottom: 6 }}>INTEL VALUE</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: "#a78bfa", fontFamily: "monospace" }}>{caseData.ivs_score}</div>
              </div>
            )}

            {/* Upgrade options — T1 only, after report is ready */}
            {tierPurchased === 1 && isReportReady && (
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
                      <button onClick={() => handleUpgrade(u.tier)} disabled={upgradeLoading} style={{ background: `${u.color}18`, border: `1px solid ${u.color}60`, color: u.color, padding: "8px 14px", borderRadius: 8, fontSize: 9, fontWeight: 700, letterSpacing: 1, cursor: upgradeLoading ? "default" : "pointer", fontFamily: "monospace", whiteSpace: "nowrap", flexShrink: 0, opacity: upgradeLoading ? 0.6 : 1 }}>
                        {u.cta}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: 20, textAlign: "center" }}>
              <span style={{ fontSize: 11, color: T.text4, fontFamily: "monospace" }}>Questions? </span>
              <a href={`mailto:contact@phishscore.ai?subject=Deep Intel Case ${caseData.id.slice(0,8).toUpperCase()}`} style={{ fontSize: 11, color: "#a78bfa", fontFamily: "monospace", fontWeight: 700, textDecoration: "none" }}>contact@phishscore.ai</a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
