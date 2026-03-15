import { useState } from "react";

// === SCAM CATEGORIES ===
const SCAM_CATEGORIES = [
{ id: “publishing”, label: “Publishing & Literary”, icon: “Book”, color: “#a78bfa”, description: “Fake agents, vanity presses, contest mills”, },
{ id: “delivery”, label: “Package & Delivery”, icon: “Box”, color: “#fb923c”, description: “FedEx, UPS, USPS, DHL fake notices”, },
{ id: “retail”, label: “Retail & Shopping”, icon: “Cart”, color: “#34d399”, description: “Amazon, eBay, online store scams”, },
{ id: “telecom”, label: “Phone & Telecom”, icon: “Phone”, color: “#38bdf8”, description: “T-Mobile, Verizon, AT&T points/rewards scams”, },
{ id: “traffic”, label: “Traffic & Tolls”, icon: “Car”, color: “#f43f5e”, description: “Fake speeding tickets, toll violations, parking”, },
{ id: “social”, label: “Social Media”, icon: “Chat”, color: “#e879f9”, description: “Instagram, Facebook, TikTok, Twitter scams”, },
{ id: “finance”, label: “Banking & Finance”, icon: “Bank”, color: “#facc15”, description: “Bank alerts, crypto, investment scams”, },
{ id: “government”, label: “Government & IRS”, icon: “Gov”, color: “#4ade80”, description: “IRS, Social Security, Medicare, DMV”, },
{ id: “prize”, label: “Prize & Lottery”, icon: “Slot”, color: “#fbbf24”, description: “You’ve won!, sweepstakes, gift cards”, },
{ id: “romance”, label: “Romance & Friendship”, icon: “Heart”, color: “#fb7185”, description: “Dating app scams, fake relationships”, },
{ id: “job”, label: “Job & Employment”, icon: “Brief”, color: “#67e8f9”, description: “Fake job offers, work from home, pyramid schemes”, },
{ id: “tech”, label: “Tech Support”, icon: “PC”, color: “#86efac”, description: “Microsoft, Apple, virus alerts, fake support”, },
{ id: “other”, label: “Other / Not Sure”, icon: “?”, color: “#94a3b8”, description: “Not sure - let the AI figure it out”, },
];

const INITIAL_SUBMISSIONS = [
{ id: 1, category: “publishing”, source: “literary-agent@gmail.com”, preview: “Congratulations! I represent major publishers and loved your manuscript. A reading fee of $150 is required to proceed…”, score: 96, tags: [“Reading Fee”, “Fake Agent”], timestamp: 1741900000 },
{ id: 2, category: “delivery”, source: “usps-tracking@usps-notify.info”, preview: “Your package could not be delivered. Pay $3.49 redelivery fee within 24hrs or it will be returned to sender…”, score: 94, tags: [“Fake USPS”, “Phishing”], timestamp: 1741890000 },
{ id: 3, category: “retail”, source: “order-update@amazon-secure.net”, preview: “Your Amazon account has been locked due to suspicious activity. Verify your payment method immediately…”, score: 97, tags: [“Fake Amazon”, “Account Phishing”], timestamp: 1741880000 },
{ id: 4, category: “telecom”, source: “tmobile-rewards@t-mobile-points.com”, preview: “Your T-Mobile reward points (8,450 pts) expire tonight! Claim your free gift now before midnight…”, score: 91, tags: [“Fake T-Mobile”, “Rewards Scam”], timestamp: 1741870000 },
{ id: 5, category: “traffic”, source: “tolls@ez-pass-billing.net”, preview: “FINAL NOTICE: Unpaid toll balance of $6.85. Failure to pay within 48hrs will result in $75 late fee and license suspension…”, score: 95, tags: [“Fake Toll”, “Urgency Tactic”], timestamp: 1741860000 },
{ id: 6, category: “social”, source: “instagram-verify@meta-support.co”, preview: “Your Instagram account has been selected for verification! Click here to get your blue checkmark within 24 hours…”, score: 88, tags: [“Fake Meta”, “Verification Scam”], timestamp: 1741850000 },
{ id: 7, category: “finance”, source: “security@chase-alerts.net”, preview: “URGENT: Suspicious login detected on your Chase account from Russia. Verify identity immediately to prevent account freeze…”, score: 98, tags: [“Fake Bank”, “Account Takeover”], timestamp: 1741840000 },
{ id: 8, category: “government”, source: “irs-notice@tax-refund-gov.com”, preview: “IRS FINAL NOTICE: You owe $2,847 in back taxes. Failure to call within 4 hours will result in arrest…”, score: 99, tags: [“Fake IRS”, “Arrest Threat”], timestamp: 1741830000 },
{ id: 9, category: “prize”, source: “winner@amazon-giveaway2026.com”, preview: “You’ve been selected as today’s winner! Claim your $1,000 Amazon gift card. Only pay $4.99 shipping…”, score: 96, tags: [“Fake Giveaway”, “Advance Fee”], timestamp: 1741820000 },
{ id: 10, category: “publishing”, source: “submissions@inkwellmgmt.com”, preview: “Thank you for your query. We’re interested in your project and would like to schedule a call to discuss representation…”, score: 11, tags: [“Likely Legitimate”], timestamp: 1741810000 },
{ id: 11, category: “tech”, source: “support@microsoft-security.net”, preview: “CRITICAL ALERT: Your Windows PC is infected with 5 viruses. Call our toll-free number immediately to prevent data loss…”, score: 97, tags: [“Fake Microsoft”, “Tech Support Scam”], timestamp: 1741800000 },
{ id: 12, category: “job”, source: “hr@amazon-remote-jobs.net”, preview: “Work from home for Amazon! Earn $500/day reviewing products. No experience needed. Pay $50 registration fee to start…”, score: 93, tags: [“Fake Job”, “Advance Fee”], timestamp: 1741790000 },
{ id: 13, category: “romance”, source: “sergei.miller.us@gmail.com”, preview: “My darling, I am US Army officer stationed overseas. I have fallen in love with your profile. I need help transferring funds…”, score: 97, tags: [“Romance Scam”, “Military Impersonation”], timestamp: 1741780000 },
{ id: 14, category: “finance”, source: “crypto-invest@binance-vip.net”, preview: “Exclusive invitation: Our AI trading bot generates 40% monthly returns. Minimum investment $500. Limited spots available…”, score: 95, tags: [“Crypto Scam”, “Investment Fraud”], timestamp: 1741770000 },
];

const getScoreColor = (s) => s >= 75 ? “#f43f5e” : s >= 45 ? “#fb923c” : “#34d399”;
const getStatusLabel = (s) => s >= 75 ? “SCAM” : s >= 45 ? “SUSPICIOUS” : “LIKELY SAFE”;
const getCat = (id) => SCAM_CATEGORIES.find(c => c.id === id) || SCAM_CATEGORIES[SCAM_CATEGORIES.length - 1];
const timeAgo = (ts) => {
const d = Math.floor(Date.now() / 1000 - ts);
if (d < 60) return “just now”;
if (d < 3600) return `${Math.floor(d / 60)}m ago`;
if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
return `${Math.floor(d / 86400)}d ago`;
};

function ScoreRing({ score, size = 64 }) {
const color = getScoreColor(score);
const r = size * 0.37, circ = 2 * Math.PI * r, dash = (score / 100) * circ;
return (
<svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
<circle cx={size / 2} cy={size / 2} r={r} fill=“none” stroke=”#1a1d2e” strokeWidth={size * 0.1} />
<circle cx={size / 2} cy={size / 2} r={r} fill=“none” stroke={color} strokeWidth={size * 0.1}
strokeDasharray={`${dash} ${circ}`} strokeLinecap=“round”
transform={`rotate(-90 ${size / 2} ${size / 2})`}
style={{ transition: “stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)”, filter: `drop-shadow(0 0 ${size * 0.06}px ${color}88)` }} />
<text x={size / 2} y={size / 2 + size * 0.06} textAnchor=“middle” fill={color}
fontSize={size * 0.21} fontWeight=“700” fontFamily=“monospace”>{score}</text>
</svg>
);
}

function CategoryPicker({ selected, onSelect }) {
return (
<div>
<p style={{ color: “#64748b”, fontSize: 13, margin: “0 0 16px”, fontFamily: “Georgia, serif” }}>
Select the type that best matches - or pick <strong style={{ color: “#94a3b8” }}>Other / Not Sure</strong> and the AI will figure it out.
</p>
<div style={{ display: “grid”, gridTemplateColumns: “repeat(auto-fill, minmax(130px, 1fr))”, gap: 8 }}>
{SCAM_CATEGORIES.map(cat => {
const active = selected === cat.id;
return (
<button key={cat.id} onClick={() => onSelect(cat.id)} style={{
background: active ? `${cat.color}18` : “#0d0f1a”,
border: `1.5px solid ${active ? cat.color : "#1a1d2e"}`,
borderRadius: 10, padding: “11px 10px”, cursor: “pointer”, textAlign: “left”,
transition: “all 0.15s”, transform: active ? “scale(1.03)” : “scale(1)”
}}>
<div style={{ fontSize: 22, marginBottom: 5, lineHeight: 1 }}>{cat.icon}</div>
<div style={{ fontSize: 11, fontWeight: 700, color: active ? cat.color : “#64748b”, fontFamily: “monospace”, lineHeight: 1.3 }}>{cat.label}</div>
</button>
);
})}
</div>
</div>
);
}

function SubmitModal({ onClose, onNewResult }) {
const [step, setStep] = useState(1);
const [category, setCategory] = useState(“other”);
const [text, setText] = useState(””);
const [loading, setLoading] = useState(false);
const [result, setResult] = useState(null);
const cat = getCat(category);

const analyze = async () => {
if (!text.trim()) return;
setLoading(true);
try {
const res = await fetch(”/api/analyze”, {
method: “POST”,
headers: { “Content-Type”: “application/json” },
body: JSON.stringify({
model: “claude-sonnet-4-20250514”,
max_tokens: 1000,
messages: [{ role: “user”, content: `You are PhishScore.ai, an expert scam detection AI trusted by millions. Analyze this message for scam indicators.

User’s category hint: “${cat.label}” - ${cat.description}

Respond ONLY with valid JSON (no markdown, no backticks):
{
“score”: <0-100 integer, probability this is a scam>,
“tags”: [<2-4 short labels like “Fake USPS”, “Urgency Tactic”, “Reading Fee”, “Legitimate”>],
“verdict”: “<one sentence plain English verdict>”,
“analysis”: “<2-3 sentences a non-technical person can understand>”,
“redFlags”: [<up to 5 specific red flag strings, empty array if none>],
“whatToDo”: “<one concrete action the person should take right now>”
}

Message:
${text}` }]
})
});
const data = await res.json();
const raw = data.content?.map(c => c.text || “”).join(””) || “”;
const parsed = JSON.parse(raw.replace(/`json|`/g, “”).trim());
setResult(parsed);
onNewResult({ category, text, result: parsed });
setStep(3);
} catch {
setResult({ score: 0, tags: [“Error”], verdict: “Analysis failed.”, analysis: “Please try again.”, redFlags: [], whatToDo: “Try submitting again.” });
setStep(3);
}
setLoading(false);
};

const sc = result ? getScoreColor(result.score) : “#fff”;

return (
<div style={{ position: “fixed”, inset: 0, background: “rgba(0,0,0,0.82)”, backdropFilter: “blur(14px)”, display: “flex”, alignItems: “center”, justifyContent: “center”, zIndex: 200, padding: 16 }}
onClick={e => e.target === e.currentTarget && onClose()}>
<div style={{ background: “#090b14”, border: “1px solid #1a1d2e”, borderRadius: 20, width: “100%”, maxWidth: 620, maxHeight: “92vh”, overflowY: “auto”, padding: 32, position: “relative”, boxShadow: “0 32px 96px rgba(0,0,0,0.7)” }}>
<button onClick={onClose} style={{ position: “absolute”, top: 16, right: 16, background: “#1a1d2e”, border: “none”, color: “#475569”, width: 30, height: 30, borderRadius: “50%”, cursor: “pointer”, fontSize: 15, display: “flex”, alignItems: “center”, justifyContent: “center” }}>x</button>

```
    {/* Brand */}
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "monospace", letterSpacing: 1, marginBottom: 4 }}>
        <span style={{ color: "#fff" }}>PHISH</span><span style={{ color: "#f43f5e" }}>SCORE</span><span style={{ color: "#1e2030", fontSize: 13 }}>.ai</span>
      </div>
      {/* Step dots */}
      {step < 3 && (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {["Choose Type", "Paste Message", "Your Score"].map((s, i) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 22, height: 22, borderRadius: "50%", background: i + 1 <= step ? "#f43f5e" : "#1a1d2e", color: i + 1 <= step ? "#fff" : "#475569", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "monospace" }}>{i + 1}</div>
              <span style={{ fontSize: 10, color: i + 1 <= step ? "#94a3b8" : "#334155", fontFamily: "monospace" }}>{s}</span>
              {i < 2 && <div style={{ width: 16, height: 1, background: "#1a1d2e" }} />}
            </div>
          ))}
        </div>
      )}
    </div>

    {step === 1 && (
      <>
        <div style={{ fontSize: 12, letterSpacing: 3, color: "#475569", fontFamily: "monospace", marginBottom: 16 }}>STEP 1 - WHAT TYPE OF SCAM?</div>
        <CategoryPicker selected={category} onSelect={setCategory} />
        <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
          <button onClick={() => setStep(2)} style={{ background: "linear-gradient(135deg,#f43f5e,#be123c)", border: "none", color: "#fff", padding: "12px 28px", borderRadius: 10, fontSize: 12, fontWeight: 700, letterSpacing: 2, cursor: "pointer", fontFamily: "monospace", boxShadow: "0 4px 20px rgba(244,63,94,0.35)" }}>
            NEXT ->
          </button>
        </div>
      </>
    )}

    {step === 2 && (
      <>
        <div style={{ fontSize: 12, letterSpacing: 3, color: "#475569", fontFamily: "monospace", marginBottom: 16 }}>STEP 2 - PASTE THE MESSAGE</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: `${cat.color}12`, border: `1px solid ${cat.color}35`, borderRadius: 10, marginBottom: 14 }}>
          <span style={{ fontSize: 22 }}>{cat.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: cat.color, fontFamily: "monospace" }}>{cat.label}</div>
            <div style={{ fontSize: 11, color: "#475569", fontFamily: "Georgia, serif" }}>{cat.description}</div>
          </div>
          <button onClick={() => setStep(1)} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 11, fontFamily: "monospace" }}>change</button>
        </div>
        <textarea value={text} onChange={e => setText(e.target.value)}
          placeholder={`Paste the full suspicious message here...\n\nTip: Include sender address, subject line, and all body text for best results.`}
          style={{ width: "100%", minHeight: 200, background: "#0d0f1a", border: "1.5px solid #1a1d2e", borderRadius: 10, color: "#e2e8f0", padding: 16, fontSize: 13, fontFamily: "Georgia, serif", resize: "vertical", outline: "none", boxSizing: "border-box", lineHeight: 1.7 }}
          onFocus={e => e.target.style.borderColor = "#f43f5e55"}
          onBlur={e => e.target.style.borderColor = "#1a1d2e"}
        />
        <div style={{ fontSize: 10, color: "#1e2030", fontFamily: "monospace", marginTop: 5 }}>{text.length} chars - more context = better score</div>
        <div style={{ marginTop: 16, display: "flex", gap: 10, justifyContent: "space-between" }}>
          <button onClick={() => setStep(1)} style={{ background: "#1a1d2e", border: "none", color: "#64748b", padding: "11px 20px", borderRadius: 10, fontSize: 11, cursor: "pointer", fontFamily: "monospace" }}><- BACK</button>
          <button onClick={analyze} disabled={loading || !text.trim()} style={{ background: loading || !text.trim() ? "#1a1d2e" : "linear-gradient(135deg,#f43f5e,#be123c)", border: "none", color: loading || !text.trim() ? "#334155" : "#fff", padding: "11px 28px", borderRadius: 10, fontSize: 12, fontWeight: 700, letterSpacing: 2, cursor: loading || !text.trim() ? "default" : "pointer", fontFamily: "monospace", boxShadow: loading || !text.trim() ? "none" : "0 4px 20px rgba(244,63,94,0.35)" }}>
            {loading ? "Search ANALYZING..." : "GET MY SCORE ->"}
          </button>
        </div>
      </>
    )}

    {step === 3 && result && (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 20, padding: 22, background: `${sc}0d`, border: `1px solid ${sc}30`, borderRadius: 14, marginBottom: 20 }}>
          <ScoreRing score={result.score} size={80} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: sc, fontFamily: "monospace", letterSpacing: 1 }}>{getStatusLabel(result.score)}</div>
            <div style={{ color: "#cbd5e1", fontSize: 14, marginTop: 5, fontFamily: "Georgia, serif", lineHeight: 1.5 }}>{result.verdict}</div>
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              {result.tags?.map(t => <span key={t} style={{ background: "#1a1d2e", color: "#64748b", fontSize: 10, padding: "3px 9px", borderRadius: 20, fontFamily: "monospace" }}>{t}</span>)}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, letterSpacing: 3, color: "#334155", fontFamily: "monospace", marginBottom: 8 }}>ANALYSIS</div>
          <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.8, margin: 0, fontFamily: "Georgia, serif" }}>{result.analysis}</p>
        </div>

        {result.redFlags?.length > 0 && (
          <div style={{ background: "#160810", border: "1px solid #f43f5e25", borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 10, letterSpacing: 3, color: "#f43f5e", fontFamily: "monospace", marginBottom: 10 }}>! RED FLAGS ({result.redFlags.length})</div>
            {result.redFlags.map((f, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: i < result.redFlags.length - 1 ? 8 : 0 }}>
                <span style={{ color: "#f43f5e", flexShrink: 0 }}>></span>
                <span style={{ color: "#fca5a5", fontSize: 13, fontFamily: "Georgia, serif", lineHeight: 1.5 }}>{f}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ background: "#081410", border: "1px solid #34d39925", borderRadius: 10, padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 10, letterSpacing: 3, color: "#34d399", fontFamily: "monospace", marginBottom: 8 }}>OK WHAT TO DO</div>
          <p style={{ color: "#86efac", fontSize: 13, margin: 0, fontFamily: "Georgia, serif", lineHeight: 1.6 }}>{result.whatToDo}</p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => { setStep(1); setResult(null); setText(""); setCategory("other"); }} style={{ flex: 1, background: "#1a1d2e", border: "none", color: "#64748b", padding: "12px", borderRadius: 10, fontSize: 11, cursor: "pointer", fontFamily: "monospace", letterSpacing: 1 }}>+ CHECK ANOTHER</button>
          <button onClick={onClose} style={{ flex: 1, background: "linear-gradient(135deg,#f43f5e,#be123c)", border: "none", color: "#fff", padding: "12px", borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "monospace", letterSpacing: 1 }}>VIEW DASHBOARD -></button>
        </div>
      </div>
    )}
  </div>
</div>
```

);
}

export default function App() {
const [submissions, setSubmissions] = useState(INITIAL_SUBMISSIONS);
const [showModal, setShowModal] = useState(false);
const [filterCat, setFilterCat] = useState(“all”);
const [filterStatus, setFilterStatus] = useState(“all”);
const [sortBy, setSortBy] = useState(“recent”);

const total = submissions.length;
const scams = submissions.filter(s => s.score >= 75).length;
const suspicious = submissions.filter(s => s.score >= 45 && s.score < 75).length;
const safe = submissions.filter(s => s.score < 45).length;

const catCounts = SCAM_CATEGORIES
.map(cat => ({ …cat, count: submissions.filter(s => s.category === cat.id).length, scamCount: submissions.filter(s => s.category === cat.id && s.score >= 75).length }))
.filter(c => c.count > 0).sort((a, b) => b.count - a.count);
const maxCount = Math.max(…catCounts.map(c => c.count), 1);

const filtered = submissions
.filter(s => filterCat === “all” || s.category === filterCat)
.filter(s => filterStatus === “all” || (filterStatus === “scam” && s.score >= 75) || (filterStatus === “suspicious” && s.score >= 45 && s.score < 75) || (filterStatus === “safe” && s.score < 45))
.sort((a, b) => sortBy === “recent” ? b.timestamp - a.timestamp : b.score - a.score);

const handleNewResult = ({ category, text, result }) => {
setSubmissions(prev => [{ id: prev.length + 1, category, source: “user-submitted”, preview: text.slice(0, 130) + (text.length > 130 ? “…” : “”), score: result.score, tags: result.tags || [], timestamp: Math.floor(Date.now() / 1000) }, …prev]);
};

const statusColors = { all: “#5b6cf8”, scam: “#f43f5e”, suspicious: “#fb923c”, safe: “#34d399” };

return (
<div style={{ minHeight: “100vh”, background: “#060810”, color: “#e2e8f0”, fontFamily: “Georgia, serif” }}>
<div style={{ position: “fixed”, inset: 0, pointerEvents: “none”, background: “radial-gradient(ellipse 70% 50% at 5% 0%, #f43f5e08, transparent 55%), radial-gradient(ellipse 50% 40% at 95% 100%, #a78bfa07, transparent 55%)” }} />

```
  <div style={{ position: "relative" }}>
    {/* HEADER */}
    <header style={{ borderBottom: "1px solid #1a1d2e", padding: "18px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14, background: "rgba(6,8,16,0.95)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 50 }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#f43f5e", boxShadow: "0 0 8px #f43f5e", animation: "blink 2s infinite" }} />
          <span style={{ fontSize: 9, color: "#f43f5e", letterSpacing: 4, fontFamily: "monospace" }}>LIVE INTELLIGENCE</span>
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "monospace", letterSpacing: 1 }}>
          <span style={{ color: "#fff" }}>PHISH</span><span style={{ color: "#f43f5e" }}>SCORE</span><span style={{ color: "#1a1d2e", fontSize: 13 }}>.ai</span>
        </div>
        <div style={{ fontSize: 9, color: "#334155", letterSpacing: 3, fontFamily: "monospace" }}>COMMUNITY SCAM INTELLIGENCE DASHBOARD</div>
      </div>
      <button onClick={() => setShowModal(true)}
        style={{ background: "linear-gradient(135deg,#f43f5e,#be123c)", border: "none", color: "#fff", padding: "13px 26px", borderRadius: 12, fontSize: 12, fontWeight: 700, letterSpacing: 2, cursor: "pointer", fontFamily: "monospace", boxShadow: "0 4px 24px rgba(244,63,94,0.4)" }}
        onMouseEnter={e => e.currentTarget.style.transform = "scale(1.04)"}
        onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
        Search CHECK A MESSAGE
      </button>
    </header>

    <main style={{ padding: "28px", maxWidth: 1300, margin: "0 auto" }}>
      {/* STATS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 14, marginBottom: 26 }}>
        {[
          { label: "TOTAL REPORTS", value: total, accent: "#5b6cf8" },
          { label: "CONFIRMED SCAMS", value: scams, accent: "#f43f5e", sub: `${total > 0 ? Math.round(scams / total * 100) : 0}% rate` },
          { label: "SUSPICIOUS", value: suspicious, accent: "#fb923c" },
          { label: "LIKELY SAFE", value: safe, accent: "#34d399" },
        ].map(s => (
          <div key={s.label} style={{ background: "#090b14", border: "1px solid #1a1d2e", borderRadius: 12, padding: "18px 20px", borderTop: `3px solid ${s.accent}` }}>
            <div style={{ fontSize: 9, color: "#334155", letterSpacing: 3, marginBottom: 8, fontFamily: "monospace" }}>{s.label}</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: s.accent, fontFamily: "monospace" }}>{s.value}</div>
            {s.sub && <div style={{ fontSize: 10, color: "#334155", marginTop: 3, fontFamily: "monospace" }}>{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* CATEGORY BREAKDOWN */}
      <div style={{ background: "#090b14", border: "1px solid #1a1d2e", borderRadius: 16, padding: 24, marginBottom: 22 }}>
        <div style={{ fontSize: 10, letterSpacing: 3, color: "#334155", fontFamily: "monospace", marginBottom: 18 }}>
          BREAKDOWN BY SCAM TYPE - <span style={{ color: "#475569" }}>click to filter</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
          {catCounts.map(cat => {
            const active = filterCat === cat.id;
            return (
              <button key={cat.id} onClick={() => setFilterCat(active ? "all" : cat.id)} style={{ background: active ? `${cat.color}14` : "#0d0f1a", border: `1.5px solid ${active ? cat.color : "#1a1d2e"}`, borderRadius: 10, padding: "12px 14px", cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ fontSize: 16 }}>{cat.icon}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: active ? cat.color : "#64748b", fontFamily: "monospace", lineHeight: 1.3 }}>{cat.label}</span>
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 800, color: cat.color, fontFamily: "monospace" }}>{cat.count}</span>
                </div>
                <div style={{ background: "#1a1d2e", borderRadius: 3, height: 4 }}>
                  <div style={{ height: "100%", borderRadius: 3, background: `linear-gradient(90deg, ${cat.color}, ${cat.color}66)`, width: `${(cat.count / maxCount) * 100}%`, transition: "width 0.8s ease" }} />
                </div>
                <div style={{ fontSize: 10, color: "#334155", marginTop: 5, fontFamily: "monospace" }}>{cat.scamCount} confirmed scam{cat.scamCount !== 1 ? "s" : ""}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* FEED */}
      <div style={{ background: "#090b14", border: "1px solid #1a1d2e", borderRadius: 16, padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
          <div style={{ fontSize: 10, letterSpacing: 3, color: "#334155", fontFamily: "monospace" }}>
            COMMUNITY SUBMISSIONS
            {filterCat !== "all" && <span style={{ color: getCat(filterCat).color, marginLeft: 8 }}>- {getCat(filterCat).label}</span>}
          </div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
            {["all", "scam", "suspicious", "safe"].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)} style={{ background: filterStatus === s ? `${statusColors[s]}18` : "none", border: `1px solid ${filterStatus === s ? statusColors[s] : "#1a1d2e"}`, color: filterStatus === s ? statusColors[s] : "#334155", padding: "4px 12px", borderRadius: 20, fontSize: 9, cursor: "pointer", fontFamily: "monospace", letterSpacing: 2, textTransform: "uppercase", transition: "all 0.15s" }}>{s}</button>
            ))}
            <div style={{ width: 1, height: 16, background: "#1a1d2e" }} />
            <button onClick={() => setSortBy(s => s === "recent" ? "score" : "recent")} style={{ background: "none", border: "1px solid #1a1d2e", color: "#334155", padding: "4px 12px", borderRadius: 20, fontSize: 9, cursor: "pointer", fontFamily: "monospace", letterSpacing: 1 }}>
              {sortBy === "recent" ? "v NEWEST" : "v HIGHEST SCORE"}
            </button>
          </div>
        </div>

        {filtered.length === 0
          ? <div style={{ textAlign: "center", padding: "48px 0", color: "#1a1d2e", fontFamily: "monospace", fontSize: 12 }}>No submissions match this filter</div>
          : filtered.map((s, i) => {
            const cat = getCat(s.category);
            const sc = getScoreColor(s.score);
            return (
              <div key={s.id} style={{ display: "grid", gridTemplateColumns: "64px 1fr auto", gap: 16, padding: "15px 0", borderTop: i > 0 ? "1px solid #0d0f1a" : "none", alignItems: "center" }}>
                <ScoreRing score={s.score} size={60} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ background: `${cat.color}14`, border: `1px solid ${cat.color}35`, color: cat.color, fontSize: 9, padding: "2px 8px", borderRadius: 20, fontFamily: "monospace", letterSpacing: 1 }}>{cat.icon} {cat.label}</span>
                    {s.tags.slice(0, 2).map(t => <span key={t} style={{ background: "#1a1d2e", color: "#475569", fontSize: 9, padding: "2px 8px", borderRadius: 20, fontFamily: "monospace" }}>{t}</span>)}
                    <span style={{ fontSize: 9, color: "#1e2a3a", fontFamily: "monospace", marginLeft: "auto" }}>{timeAgo(s.timestamp)}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.preview}</div>
                </div>
                <div style={{ padding: "5px 11px", borderRadius: 20, fontSize: 9, fontWeight: 800, letterSpacing: 2, color: sc, border: `1px solid ${sc}35`, background: `${sc}0d`, whiteSpace: "nowrap", fontFamily: "monospace" }}>{getStatusLabel(s.score)}</div>
              </div>
            );
          })
        }
      </div>

      <div style={{ textAlign: "center", marginTop: 28, fontSize: 9, color: "#1a1d2e", letterSpacing: 3, fontFamily: "monospace" }}>PHISHSCORE.AI - PROTECTING COMMUNITIES FROM FRAUD</div>
    </main>
  </div>

  {showModal && <SubmitModal onClose={() => setShowModal(false)} onNewResult={handleNewResult} />}

  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700&display=swap');
    @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.15} }
    * { box-sizing: border-box; }
    body { margin: 0; }
    ::-webkit-scrollbar { width: 5px; }
    ::-webkit-scrollbar-track { background: #060810; }
    ::-webkit-scrollbar-thumb { background: #1a1d2e; border-radius: 3px; }
    button { transition: all 0.15s; }
  `}</style>
</div>
```

);
}