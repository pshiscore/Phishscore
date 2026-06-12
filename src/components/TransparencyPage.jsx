import { SCAM_CATEGORIES } from "../constants";
import { CatIconSvg, PhishScoreLogo } from "./Primitives";

// FIX: now accepts T prop and uses it throughout instead of hardcoded dark colors
export default function TransparencyPage({ onClose, submissions, T = {} }) {
  const total = submissions.length;
  const scams = submissions.filter(s => s.score >= 75).length;
  const safe = submissions.filter(s => s.score < 45).length;
  const scamRate = total > 0 ? Math.round(scams / total * 100) : 0;
  const pubCount = submissions.filter(s => s.visibility === "public").length;
  const privCount = submissions.filter(s => s.visibility === "private").length;
  const anonCount = submissions.filter(s => s.visibility === "anonymous").length;
  const autoCount = submissions.filter(s => s.classification_note === "auto").length;
  const reclassCount = submissions.filter(s => s.classification_note === "reclassified").length;
  const catBreakdown = SCAM_CATEGORIES.filter(c => c.id !== "other")
    .map(cat => ({ ...cat, count: submissions.filter(s => s.category === cat.id).length }))
    .filter(c => c.count > 0).sort((a, b) => b.count - a.count);
  const month = new Date().toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "America/New_York" });

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", backdropFilter: "blur(14px)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, overflowY: "auto" }}>
      <div style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 20, width: "100%", maxWidth: 680, padding: 40, position: "relative", margin: "20px 0" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, background: T.innerBg, border: `1px solid ${T.innerBorder}`, color: T.text3, width: 32, height: 32, borderRadius: "50%", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>x</button>

        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 10, letterSpacing: 4, color: "#f43f5e", fontFamily: "monospace", marginBottom: 10 }}>TRANSPARENCY REPORT</div>
          <PhishScoreLogo T={T} size={22} dotSize={13} />
          <p style={{ color: T.text3, fontFamily: "monospace", fontSize: 11, margin: "6px 0 0" }}>Live data as of {month}. Updated in real time.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 24 }}>
          {[
            { label: "TOTAL REPORTS", value: total, color: "#5b6cf8" },
            { label: "CONFIRMED SCAMS", value: scams, color: "#f43f5e" },
            { label: "SCAM RATE", value: scamRate + "%", color: "#fb923c" },
            { label: "LIKELY SAFE", value: safe, color: "#34d399" },
          ].map(s => (
            <div key={s.label} style={{ background: T.innerBg, border: `1px solid ${T.innerBorder}`, borderRadius: 10, padding: "14px 16px", borderTop: "2px solid " + s.color }}>
              <div style={{ fontSize: 9, color: T.text3, letterSpacing: 2, fontFamily: "monospace", marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: s.color, fontFamily: "monospace" }}>{s.value}</div>
            </div>
          ))}
        </div>

        <div style={{ background: T.innerBg, border: `1px solid ${T.innerBorder}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 10, letterSpacing: 3, color: T.text3, fontFamily: "monospace", marginBottom: 14 }}>SUBMISSION PRIVACY BREAKDOWN</div>
          {[
            { label: "Public", value: pubCount, color: "#34d399", note: "Full details visible" },
            { label: "Private", value: privCount, color: "#38bdf8", note: "Score and category only" },
            { label: "Anonymous", value: anonCount, color: "#94a3b8", note: "Nothing stored" },
          ].map(v => (
            <div key={v.label} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <div style={{ width: 60, fontSize: 10, color: v.color, fontFamily: "monospace", fontWeight: 700 }}>{v.label}</div>
              <div style={{ flex: 1, background: T.ringTrack, borderRadius: 3, height: 5 }}>
                <div style={{ height: "100%", borderRadius: 3, background: v.color, width: total > 0 ? `${Math.round(v.value / total * 100)}%` : "0%" }} />
              </div>
              <div style={{ fontSize: 10, color: v.color, fontFamily: "monospace", width: 30, textAlign: "right" }}>{v.value}</div>
              <div style={{ fontSize: 10, color: T.text4, fontFamily: "Georgia, serif", minWidth: 120 }}>{v.note}</div>
            </div>
          ))}
        </div>

        <div style={{ background: T.innerBg, border: `1px solid ${T.innerBorder}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 10, letterSpacing: 3, color: T.text3, fontFamily: "monospace", marginBottom: 14 }}>AI CLASSIFICATION ACTIVITY</div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 120 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#a78bfa", fontFamily: "monospace" }}>{autoCount}</div>
              <div style={{ fontSize: 10, color: T.text3, fontFamily: "monospace", letterSpacing: 1 }}>AUTO-CLASSIFIED</div>
              <div style={{ fontSize: 11, color: T.text2, fontFamily: "Georgia, serif", marginTop: 4 }}>Submitted as Unknown, AI detected correct category</div>
            </div>
            <div style={{ flex: 1, minWidth: 120 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#f97316", fontFamily: "monospace" }}>{reclassCount}</div>
              <div style={{ fontSize: 10, color: T.text3, fontFamily: "monospace", letterSpacing: 1 }}>RECLASSIFIED</div>
              <div style={{ fontSize: 11, color: T.text2, fontFamily: "Georgia, serif", marginTop: 4 }}>User picked wrong category, AI corrected it</div>
            </div>
          </div>
        </div>

        {catBreakdown.length > 0 && (
          <div style={{ background: T.innerBg, border: `1px solid ${T.innerBorder}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 10, letterSpacing: 3, color: T.text3, fontFamily: "monospace", marginBottom: 14 }}>TOP SCAM CATEGORIES REPORTED</div>
            {catBreakdown.slice(0, 6).map((cat, i) => (
              <div key={cat.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: T.text4, fontFamily: "monospace", width: 16 }}>{i + 1}</div>
                <CatIconSvg icon={cat.icon} color={cat.color} size={14} />
                <div style={{ flex: 1, fontSize: 12, color: T.text2, fontFamily: "monospace" }}>{cat.label}</div>
                <div style={{ background: T.ringTrack, borderRadius: 3, height: 5, width: 80 }}>
                  <div style={{ height: "100%", borderRadius: 3, background: cat.color, width: `${Math.round(cat.count / catBreakdown[0].count * 100)}%` }} />
                </div>
                <div style={{ fontSize: 11, color: cat.color, fontFamily: "monospace", width: 24, textAlign: "right" }}>{cat.count}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ background: T.innerBg, border: "1px solid #38bdf830", borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 10, letterSpacing: 3, color: "#38bdf8", fontFamily: "monospace", marginBottom: 12 }}>OUR COMMITMENT TO YOU</div>
          {["We never sell your data or share it with advertisers", "Private submissions hide your message and source from all public views", "Anonymous submissions store nothing after analysis is complete", "PII in sources is masked before display - emails, phones, and names are partially hidden", "You can request removal of any submission by emailing contact@phishscore.ai"].map((item, i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: i < 4 ? 8 : 0 }}>
              <span style={{ color: "#38bdf8", flexShrink: 0, fontFamily: "monospace" }}>+</span>
              <span style={{ color: T.text2, fontSize: 13, fontFamily: "Georgia, serif", lineHeight: 1.5 }}>{item}</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 24, textAlign: "center" }}>
          <a href="mailto:contact@phishscore.ai" style={{ color: "#f43f5e", fontFamily: "monospace", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>contact@phishscore.ai</a>
        </div>
      </div>
    </div>
  );
}
