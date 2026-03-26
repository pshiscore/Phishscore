import { useState, useRef } from "react";
import { PhishScoreLogo, ScoreRing } from "./Primitives";

const TIERS = [
  {
    tier: 1,
    name: "AI Forensic Report",
    price: "$2.99",
    color: "#f43f5e",
    features: [
      "Live website screenshot & analysis",
      "Domain age & ownership (WHOIS)",
      "IP abuse history check",
      "VirusTotal cross-check",
      "Claude Opus AI case file",
      "Personalized recovery checklist",
      "Delivered to your email",
    ],
    cta: "GET MY FORENSIC REPORT",
  },
  {
    tier: 2,
    name: "Verified Human Check",
    price: "$9.99",
    color: "#a78bfa",
    features: [
      "Everything in AI Forensic Report",
      "15-min human expert review",
      "Catches subtle tricks AI may miss",
      "Human-verified recovery plan",
    ],
    cta: "ADD HUMAN REVIEW",
    badge: "Available after AI report",
  },
  {
    tier: 3,
    name: "Expert Investigation",
    price: "$29.99",
    color: "#fbbf24",
    features: [
      "Everything in Human Check",
      "Full manual OSINT research",
      "Source & identity verification",
      "1-on-1 custom strategy session",
    ],
    cta: "REQUEST EXPERT INVESTIGATION",
    badge: "Available after AI report",
  },
];

const IVS_CONFIG = {
  LOW:      { color: "#34d399", bg: "#34d39912", border: "#34d39930", label: "LOW VALUE" },
  MODERATE: { color: "#fbbf24", bg: "#fbbf2412", border: "#fbbf2430", label: "MODERATE VALUE" },
  HIGH:     { color: "#fb923c", bg: "#fb923c12", border: "#fb923c30", label: "HIGH VALUE" },
  CRITICAL: { color: "#f43f5e", bg: "#f43f5e12", border: "#f43f5e30", label: "CRITICAL VALUE" },
};

export default function DeepIntelModal({ onClose, prefill = {}, T = {} }) {
  // Steps: intake → scoring → tiers → checkout → confirm
  const [step, setStep] = useState("intake");
  const [message, setMessage] = useState(prefill.message || "");
  const [story, setStory] = useState("");
  const [email, setEmail] = useState("");
  const [images, setImages] = useState([]);
  const [ivs, setIvs] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef();

  const isFreshEntry = !prefill.message && !prefill.score;
  const originalScore = prefill.score || null;
  const originalCategory = prefill.category || null;

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files || []);
    files.slice(0, 3 - images.length).forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => setImages(prev => [...prev, { data: ev.target.result, name: file.name }]);
      reader.readAsDataURL(file);
    });
  };

  const handleAnalyze = async () => {
    if (!message.trim() && !story.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/ivs-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          story: story.trim(),
          originalScore,
          originalCategory,
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setIvs(data);
      setStep("scoring");
    } catch (err) {
      setError("Analysis failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async (tier) => {
    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address to receive your report.");
      setCheckoutLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier,
          email,
          message: message.trim(),
          story: story.trim(),
          originalScore,
          originalCategory,
          ivsScore: ivs?.ivs,
          ivsLabel: ivs?.label,
          ivsExplanation: ivs?.explanation,
          entryPoint: isFreshEntry ? "fresh" : "scan",
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      // Redirect to Lemon Squeezy checkout
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setError("Failed to create checkout. Please try again.");
      setCheckoutLoading(false);
    }
  };

  const ivsConfig = ivs ? (IVS_CONFIG[ivs.label] || IVS_CONFIG.MODERATE) : null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(14px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16, overflowY: "auto" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 20, width: "100%", maxWidth: 580, maxHeight: "92vh", overflowY: "auto", padding: 28, position: "relative", boxShadow: "0 32px 96px rgba(0,0,0,0.7)" }}>

        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, background: T.innerBg, border: `1px solid ${T.innerBorder}`, color: T.text3, width: 30, height: 30, borderRadius: "50%", cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center" }}>x</button>

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ marginBottom: 6 }}><PhishScoreLogo T={T} size={16} dotSize={11} /></div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
            </svg>
            <span style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 800, color: T.text, letterSpacing: 1 }}>DEEP INTEL</span>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: "#f43f5e", border: "1px solid #f43f5e60", background: "#f43f5e12", padding: "2px 7px", borderRadius: 6, fontFamily: "monospace" }}>BETA</span>
            <span style={{ fontSize: 10, color: T.text4, fontFamily: "monospace" }}>—</span>
            <a href="mailto:contact@phishscore.ai?subject=Deep Intel Beta Tester Request" style={{ fontSize: 10, color: "#a78bfa", fontFamily: "monospace", textDecoration: "none", fontWeight: 700 }}>contact us</a>
            <span style={{ fontSize: 10, color: T.text4, fontFamily: "Georgia, serif", fontStyle: "italic" }}>before using</span>
          </div>
          <div style={{ fontSize: 9, color: T.text4, fontFamily: "monospace", letterSpacing: 2 }}>FORENSIC SCAM INVESTIGATION</div>
        </div>

        {/* Pre-fill badge if coming from scan */}
        {!isFreshEntry && originalScore && step === "intake" && (
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", background: "#f43f5e12", border: "1px solid #f43f5e35", borderRadius: 20 }}>
              <span style={{ fontSize: 10, color: "#f43f5e", fontFamily: "monospace", fontWeight: 700 }}>PHISHSCORE {originalScore}/100</span>
            </div>
            {originalCategory && (
              <div style={{ padding: "5px 10px", background: T.innerBg, border: `1px solid ${T.innerBorder}`, borderRadius: 20 }}>
                <span style={{ fontSize: 10, color: T.text3, fontFamily: "monospace" }}>{originalCategory}</span>
              </div>
            )}
          </div>
        )}

        {/* ── STEP: INTAKE ── */}
        {step === "intake" && (
          <>
            {/* Intro */}
            <div style={{ background: T.innerBg, border: `1px solid ${T.innerBorder}`, borderRadius: 12, padding: "14px 16px", marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#a78bfa", fontFamily: "monospace", letterSpacing: 1, marginBottom: 6 }}>NEED A DEEP DIVE INVESTIGATION?</div>
              <p style={{ color: T.text3, fontSize: 13, fontFamily: "Georgia, serif", lineHeight: 1.7, margin: 0 }}>
                Paste the suspicious message below and tell us what happened. Our AI will first analyze the <strong style={{ color: T.text2 }}>Intel Value Score</strong> — the likelihood that a full forensic investigation will uncover something important. No payment required for this step.
              </p>
            </div>

            <div style={{ fontSize: 11, letterSpacing: 3, color: T.text3, fontFamily: "monospace", marginBottom: 16 }}>
              {isFreshEntry ? "STEP 1 — PASTE SUSPICIOUS MESSAGE" : "STEP 1 — ADD MORE CONTEXT"}
            </div>

            {/* Message box */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: T.text4, fontFamily: "monospace", letterSpacing: 1, marginBottom: 6 }}>
                {isFreshEntry ? "SUSPICIOUS MESSAGE OR CONTENT" : "ORIGINAL MESSAGE"} <span style={{ color: "#f43f5e" }}>*</span>
              </div>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder={isFreshEntry
                  ? "Paste the suspicious message, email, or website content you want investigated..."
                  : "Original message pre-filled — add anything else here..."}
                style={{ width: "100%", minHeight: 120, background: T.inputBg, border: `1.5px solid ${T.inputBorder}`, borderRadius: 10, color: T.text, padding: 14, fontSize: 13, fontFamily: "Georgia, serif", resize: "vertical", outline: "none", boxSizing: "border-box", lineHeight: 1.7 }}
                onFocus={e => e.target.style.borderColor = "#a78bfa55"}
                onBlur={e => e.target.style.borderColor = T.inputBorder}
              />
            </div>

            {/* Story box */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: T.text4, fontFamily: "monospace", letterSpacing: 1, marginBottom: 6 }}>WHAT HAPPENED? <span style={{ color: "#f43f5e" }}>*</span></div>
              <textarea
                value={story}
                onChange={e => setStory(e.target.value)}
                placeholder="Tell us what happened — did you click a link? Enter your login details? Make a payment? The more specific you are, the more targeted your recovery plan will be."
                style={{ width: "100%", minHeight: 100, background: T.inputBg, border: `1.5px solid ${T.inputBorder}`, borderRadius: 10, color: T.text, padding: 14, fontSize: 13, fontFamily: "Georgia, serif", resize: "vertical", outline: "none", boxSizing: "border-box", lineHeight: 1.7 }}
                onFocus={e => e.target.style.borderColor = "#a78bfa55"}
                onBlur={e => e.target.style.borderColor = T.inputBorder}
              />
            </div>

            {/* Image upload */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: T.text4, fontFamily: "monospace", letterSpacing: 1, marginBottom: 6 }}>ADDITIONAL SCREENSHOTS (optional, up to 3)</div>
              <input type="file" accept="image/*" multiple ref={fileRef} onChange={handleImageUpload} style={{ display: "none" }} />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {images.map((img, i) => (
                  <div key={i} style={{ position: "relative", width: 72, height: 72 }}>
                    <img src={img.data} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: `1px solid ${T.innerBorder}` }} />
                    <button onClick={() => setImages(prev => prev.filter((_, j) => j !== i))} style={{ position: "absolute", top: -6, right: -6, background: "#f43f5e", border: "none", color: "#fff", width: 18, height: 18, borderRadius: "50%", cursor: "pointer", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>x</button>
                  </div>
                ))}
                {images.length < 3 && (
                  <button onClick={() => fileRef.current.click()} style={{ width: 72, height: 72, background: T.innerBg, border: `1.5px dashed ${T.innerBorder}`, borderRadius: 8, cursor: "pointer", color: T.text4, fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                )}
              </div>
            </div>

            {error && <div style={{ fontSize: 12, color: "#f43f5e", fontFamily: "monospace", marginBottom: 12, padding: "8px 12px", background: "#f43f5e10", border: "1px solid #f43f5e30", borderRadius: 8 }}>{error}</div>}

            <button
              onClick={handleAnalyze}
              disabled={loading || (!message.trim() && !story.trim())}
              style={{ width: "100%", background: loading || (!message.trim() && !story.trim()) ? T.innerBg : "linear-gradient(135deg,#a78bfa,#7c3aed)", border: "none", color: loading || (!message.trim() && !story.trim()) ? T.text4 : "#fff", padding: "14px", borderRadius: 10, fontSize: 12, fontWeight: 700, letterSpacing: 2, cursor: loading || (!message.trim() && !story.trim()) ? "default" : "pointer", fontFamily: "monospace", boxShadow: loading ? "none" : "0 4px 20px rgba(167,139,250,0.35)", transition: "all 0.15s" }}>
              {loading ? "ANALYZING INTEL VALUE..." : "ANALYZE INVESTIGATION VALUE →"}
            </button>

            {/* Contact footer */}
            <div style={{ marginTop: 16, textAlign: "center" }}>
              <span style={{ fontSize: 11, color: T.text4, fontFamily: "monospace" }}>Complex investigation? Contact us directly — </span>
              <a href="mailto:contact@phishscore.ai?subject=Deep Investigation Request" style={{ fontSize: 11, color: "#a78bfa", fontFamily: "monospace", fontWeight: 700, textDecoration: "none" }}>contact@phishscore.ai</a>
            </div>
          </>
        )}

        {/* ── STEP: IVS SCORING ── */}
        {step === "scoring" && ivs && (
          <>
            <div style={{ fontSize: 11, letterSpacing: 3, color: T.text3, fontFamily: "monospace", marginBottom: 20 }}>STEP 2 — INTEL VALUE ASSESSMENT</div>

            {/* Double score display */}
            <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
              {originalScore && (
                <div style={{ flex: 1, textAlign: "center", padding: "16px 12px", background: T.innerBg, border: `1px solid ${T.innerBorder}`, borderRadius: 12 }}>
                  <div style={{ fontSize: 9, color: T.text4, fontFamily: "monospace", letterSpacing: 2, marginBottom: 8 }}>PHISHSCORE</div>
                  <ScoreRing score={originalScore} size={56} trackColor={T.ringTrack} />
                  <div style={{ fontSize: 10, color: T.text3, fontFamily: "monospace", marginTop: 6 }}>SCAM CONFIRMED</div>
                </div>
              )}
              <div style={{ flex: 1, textAlign: "center", padding: "16px 12px", background: ivsConfig.bg, border: `1px solid ${ivsConfig.border}`, borderRadius: 12 }}>
                <div style={{ fontSize: 9, color: T.text4, fontFamily: "monospace", letterSpacing: 2, marginBottom: 8 }}>INTEL VALUE</div>
                <div style={{ fontSize: 36, fontWeight: 800, color: ivsConfig.color, fontFamily: "monospace", lineHeight: 1 }}>{ivs.ivs}</div>
                <div style={{ fontSize: 10, color: ivsConfig.color, fontFamily: "monospace", marginTop: 6, letterSpacing: 1 }}>{ivsConfig.label}</div>
              </div>
            </div>

            {/* IVS explanation */}
            <div style={{ background: ivsConfig.bg, border: `1px solid ${ivsConfig.border}`, borderRadius: 12, padding: "14px 16px", marginBottom: 20 }}>
              <div style={{ fontSize: 10, letterSpacing: 2, color: ivsConfig.color, fontFamily: "monospace", marginBottom: 6 }}>{ivs.headline}</div>
              <p style={{ color: T.text2, fontSize: 13, fontFamily: "Georgia, serif", lineHeight: 1.8, margin: 0 }}>{ivs.explanation}</p>
            </div>

            {/* Honest note if not recommended */}
            {!ivs.recommend && ivs.honest_note && (
              <div style={{ background: T.innerBg, border: `1px solid ${T.innerBorder}`, borderRadius: 10, padding: "12px 16px", marginBottom: 20 }}>
                <div style={{ fontSize: 10, color: T.text3, fontFamily: "monospace", letterSpacing: 1, marginBottom: 4 }}>HONEST ASSESSMENT</div>
                <p style={{ color: T.text3, fontSize: 13, fontFamily: "Georgia, serif", lineHeight: 1.7, margin: 0 }}>{ivs.honest_note}</p>
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStep("intake")} style={{ background: T.innerBg, border: `1px solid ${T.innerBorder}`, color: T.text3, padding: "11px 20px", borderRadius: 10, fontSize: 11, cursor: "pointer", fontFamily: "monospace" }}>← BACK</button>
              <button
                onClick={() => setStep("tiers")}
                style={{ flex: 1, background: ivs.recommend ? "linear-gradient(135deg,#a78bfa,#7c3aed)" : T.innerBg, border: "none", color: ivs.recommend ? "#fff" : T.text3, padding: "11px 20px", borderRadius: 10, fontSize: 12, fontWeight: 700, letterSpacing: 2, cursor: "pointer", fontFamily: "monospace", boxShadow: ivs.recommend ? "0 4px 20px rgba(167,139,250,0.35)" : "none" }}>
                {ivs.recommend ? "VIEW INVESTIGATION OPTIONS →" : "PROCEED ANYWAY →"}
              </button>
            </div>
          </>
        )}

        {/* ── STEP: TIERS ── */}
        {step === "tiers" && (
          <>
            {/* Email at top */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: T.text4, fontFamily: "monospace", letterSpacing: 1, marginBottom: 6 }}>YOUR EMAIL — REPORT DELIVERED HERE <span style={{ color: "#f43f5e" }}>*</span></div>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                style={{ width: "100%", background: T.inputBg, border: `1.5px solid ${T.inputBorder}`, borderRadius: 8, color: T.text, padding: "10px 14px", fontSize: 13, fontFamily: "monospace", outline: "none", boxSizing: "border-box" }}
                onFocus={e => e.target.style.borderColor = "#a78bfa55"}
                onBlur={e => e.target.style.borderColor = T.inputBorder}
              />
            </div>

            <div style={{ fontSize: 11, letterSpacing: 3, color: T.text3, fontFamily: "monospace", marginBottom: 14 }}>STEP 3 — CHOOSE INVESTIGATION TIER</div>

            {/* Tier 1 — full width primary */}
            {(() => {
              const tier = TIERS[0];
              return (
                <div style={{ background: `${tier.color}08`, border: `1.5px solid ${tier.color}`, borderRadius: 14, padding: "16px 18px", marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: tier.color, fontFamily: "monospace", letterSpacing: 1 }}>{tier.name}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: tier.color, fontFamily: "monospace" }}>{tier.price}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 14 }}>
                    {tier.features.map((f, j) => (
                      <div key={j} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <span style={{ color: tier.color, flexShrink: 0, fontSize: 11, marginTop: 1 }}>✓</span>
                        <span style={{ fontSize: 12, color: T.text3, fontFamily: "Georgia, serif", lineHeight: 1.4 }}>{f}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    disabled={true}
                    style={{ width: "100%", background: T.innerBg, border: `1px solid ${T.innerBorder}`, color: T.text4, padding: "12px", borderRadius: 10, fontSize: 11, fontWeight: 700, letterSpacing: 2, cursor: "default", fontFamily: "monospace", opacity: 0.5 }}>
                    PAYMENTS COMING SOON
                  </button>
                  <div style={{ textAlign: "center", fontSize: 10, color: T.text4, fontFamily: "monospace", marginTop: 8 }}>
                    Payment processing temporarily unavailable — <a href="mailto:contact@phishscore.ai" style={{ color: "#a78bfa", textDecoration: "none" }}>contact us</a> to investigate manually
                  </div>
                </div>
              );
            })()}

            {/* Tier 2 + 3 — side by side, compact */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
              {TIERS.slice(1).map(tier => (
                <div key={tier.tier} style={{ background: T.innerBg, border: `1px solid ${T.innerBorder}`, borderRadius: 12, padding: "12px 14px", opacity: 0.7 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: tier.color, fontFamily: "monospace", marginBottom: 2 }}>{tier.name}</div>
                  <div style={{ fontSize: 9, color: T.text4, fontFamily: "monospace", marginBottom: 8, letterSpacing: 1 }}>{tier.badge}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: tier.color, fontFamily: "monospace", marginBottom: 8 }}>{tier.price}</div>
                  {tier.features.slice(1).map((f, j) => (
                    <div key={j} style={{ display: "flex", gap: 6, marginBottom: 3 }}>
                      <span style={{ color: tier.color, flexShrink: 0, fontSize: 10 }}>✓</span>
                      <span style={{ fontSize: 10, color: T.text4, fontFamily: "Georgia, serif", lineHeight: 1.4 }}>{f}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {error && <div style={{ fontSize: 12, color: "#f43f5e", fontFamily: "monospace", marginBottom: 12, padding: "8px 12px", background: "#f43f5e10", border: "1px solid #f43f5e30", borderRadius: 8 }}>{error}</div>}

            <div style={{ padding: "10px 14px", background: T.innerBg, border: `1px solid ${T.innerBorder}`, borderRadius: 8, marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: T.text4, fontFamily: "monospace", lineHeight: 1.6 }}>
                Report delivered within minutes of payment. Human and Expert tiers available as upgrades after your AI report is complete.
              </div>
            </div>

            <div style={{ textAlign: "center" }}>
              <span style={{ fontSize: 11, color: T.text4, fontFamily: "monospace" }}>Complex investigation? Contact us directly — </span>
              <a href="mailto:contact@phishscore.ai?subject=Deep Investigation Request" style={{ fontSize: 11, color: "#a78bfa", fontFamily: "monospace", fontWeight: 700, textDecoration: "none" }}>contact@phishscore.ai</a>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
