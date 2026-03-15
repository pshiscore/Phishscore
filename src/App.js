import { useState, useEffect, useRef } from "react";

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

const db = {
  async getSubmissions() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/submissions?order=created_at.desc&limit=100`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    return res.json();
  },
  async insertSubmission(data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/submissions`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(data)
    });
    return res.json();
  }
};

const SCAM_CATEGORIES = [
  { id: "publishing", label: "Publishing & Literary", icon: "Book", color: "#a78bfa", description: "Fake agents, vanity presses, contest mills" },
  { id: "delivery", label: "Package & Delivery", icon: "Box", color: "#fb923c", description: "FedEx, UPS, USPS, DHL fake notices" },
  { id: "retail", label: "Retail & Shopping", icon: "Cart", color: "#34d399", description: "Amazon, eBay, online store scams" },
  { id: "telecom", label: "Phone & Telecom", icon: "Phone", color: "#38bdf8", description: "T-Mobile, Verizon, AT&T points/rewards scams" },
  { id: "traffic", label: "Traffic & Tolls", icon: "Car", color: "#f43f5e", description: "Fake speeding tickets, toll violations, parking" },
  { id: "social", label: "Social Media", icon: "Chat", color: "#e879f9", description: "Instagram, Facebook, TikTok, Twitter scams" },
  { id: "finance", label: "Banking & Finance", icon: "Bank", color: "#facc15", description: "Bank alerts, crypto, investment scams" },
  { id: "government", label: "Government & IRS", icon: "Gov", color: "#4ade80", description: "IRS, Social Security, Medicare, DMV" },
  { id: "prize", label: "Prize & Lottery", icon: "Slot", color: "#fbbf24", description: "You've won!, sweepstakes, gift cards" },
  { id: "romance", label: "Romance & Friendship", icon: "Heart", color: "#fb7185", description: "Dating app scams, fake relationships" },
  { id: "job", label: "Job & Employment", icon: "Brief", color: "#67e8f9", description: "Fake job offers, work from home, pyramid schemes" },
  { id: "tech", label: "Tech Support", icon: "PC", color: "#86efac", description: "Microsoft, Apple, virus alerts, fake support" },
  { id: "other", label: "Other / Not Sure", icon: "?", color: "#94a3b8", description: "Not sure - let the AI figure it out" },
];

const getScoreColor = (s) => s >= 75 ? "#f43f5e" : s >= 45 ? "#fb923c" : "#34d399";
const getStatusLabel = (s) => s >= 75 ? "SCAM" : s >= 45 ? "SUSPICIOUS" : "LIKELY SAFE";
const getCat = (id) => SCAM_CATEGORIES.find(c => c.id === id) || SCAM_CATEGORIES[SCAM_CATEGORIES.length - 1];

const timeAgo = (ts) => {
  const d = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
};

// Parse source string into display label + platform tag
function parseSource(source) {
  if (!source || source === "user-submitted") return { label: "Anonymous", platform: null, flag: null };

  // Phone number patterns
  const phonePatterns = [
    { regex: /^\+91|^0091/, country: "India", flag: "IN" },
    { regex: /^\+234|^00234/, country: "Nigeria", flag: "NG" },
    { regex: /^\+44|^0044/, country: "UK", flag: "GB" },
    { regex: /^\+1[2-9]\d{2}[2-9]\d{6}/, country: "USA", flag: "US" },
    { regex: /^\+63|^0063/, country: "Philippines", flag: "PH" },
    { regex: /^\+86|^0086/, country: "China", flag: "CN" },
    { regex: /^\+7|^007/, country: "Russia", flag: "RU" },
    { regex: /^\+55|^0055/, country: "Brazil", flag: "BR" },
    { regex: /^\+\d{1,3}/, country: "Intl", flag: null },
    { regex: /^\d{10,}$/, country: "Phone", flag: null },
  ];

  const cleanSource = source.trim().toLowerCase();

  // Check if it looks like a phone number
  if (/^[\+\d\s\-\(\)]{7,}$/.test(source.trim())) {
    for (const p of phonePatterns) {
      if (p.regex.test(source.trim())) {
        return { label: source.trim(), platform: `${p.country} Phone`, flag: p.flag, type: "phone" };
      }
    }
    return { label: source.trim(), platform: "Phone", flag: null, type: "phone" };
  }

  // Email domains
  if (cleanSource.includes("@")) {
    const domain = cleanSource.split("@")[1] || "";
    const emailUser = cleanSource.split("@")[0] || "";
    const knownProviders = {
      "gmail.com": { name: "Gmail", color: "#ea4335" },
      "yahoo.com": { name: "Yahoo", color: "#6001d2" },
      "hotmail.com": { name: "Hotmail", color: "#0072c6" },
      "outlook.com": { name: "Outlook", color: "#0072c6" },
      "icloud.com": { name: "iCloud", color: "#3478f6" },
      "aol.com": { name: "AOL", color: "#ff0b00" },
      "protonmail.com": { name: "ProtonMail", color: "#6d4aff" },
      "me.com": { name: "iCloud", color: "#3478f6" },
    };
    if (knownProviders[domain]) {
      return { label: source, platform: knownProviders[domain].name, platformColor: knownProviders[domain].color, flag: null, type: "email" };
    }
    // Check for suspicious lookalike domains
    const suspicious = ["amazon-", "apple-", "paypal-", "microsoft-", "google-", "irs-", "usps-", "fedex-", "ups-", "chase-", "wells-", "bank"];
    const isSuspicious = suspicious.some(s => domain.includes(s) || emailUser.includes(s.replace("-", "")));
    return { label: source, platform: isSuspicious ? "Fake Domain" : domain, flag: null, type: "email", suspicious: isSuspicious };
  }

  // SMS shortcode or text
  if (/^\d{5,6}$/.test(source.trim())) {
    return { label: source, platform: "SMS Shortcode", flag: null, type: "sms" };
  }

  return { label: source, platform: null, flag: null, type: "text" };
}

const FLAG_EMOJIS = {
  IN: "IN", NG: "NG", GB: "UK", US: "US", PH: "PH", CN: "CN", RU: "RU", BR: "BR"
};

function SourceBadge({ source }) {
  const parsed = parseSource(source);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <span style={{ fontSize: 11, color: "#475569", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>
        {parsed.label}
      </span>
      {parsed.platform && (
        <span style={{
          fontSize: 9, padding: "2px 7px", borderRadius: 20, fontFamily: "monospace", letterSpacing: 1,
          background: parsed.suspicious ? "#f43f5e18" : parsed.type === "phone" ? "#38bdf818" : "#1a1d2e",
          color: parsed.suspicious ? "#f43f5e" : parsed.platformColor || (parsed.type === "phone" ? "#38bdf8" : "#64748b"),
          border: `1px solid ${parsed.suspicious ? "#f43f5e35" : parsed.type === "phone" ? "#38bdf835" : "#2a2d3e"}`,
          whiteSpace: "nowrap"
        }}>
          {parsed.flag ? `[${FLAG_EMOJIS[parsed.flag]}] ` : ""}{parsed.platform}
        </span>
      )}
    </div>
  );
}

function ScoreRing({ score, size = 64 }) {
  const color = getScoreColor(score);
  const r = size * 0.37, circ = 2 * Math.PI * r, dash = (score / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1a1d2e" strokeWidth={size * 0.1} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={size * 0.1}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)", filter: `drop-shadow(0 0 ${size * 0.06}px ${color}88)` }} />
      <text x={size / 2} y={size / 2 + size * 0.06} textAnchor="middle" fill={color}
        fontSize={size * 0.21} fontWeight="700" fontFamily="monospace">{score}</text>
    </svg>
  );
}

function CategoryPicker({ selected, onSelect }) {
  return (
    <div>
      <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 16px", fontFamily: "Georgia, serif" }}>
        Select the type that best matches - or pick <strong style={{ color: "#94a3b8" }}>Other / Not Sure</strong> and the AI will figure it out.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8 }}>
        {SCAM_CATEGORIES.map(cat => {
          const active = selected === cat.id;
          return (
            <button key={cat.id} onClick={() => onSelect(cat.id)} style={{
              background: active ? `${cat.color}18` : "#0d0f1a",
              border: `1.5px solid ${active ? cat.color : "#1a1d2e"}`,
              borderRadius: 10, padding: "11px 10px", cursor: "pointer", textAlign: "left",
              transition: "all 0.15s", transform: active ? "scale(1.03)" : "scale(1)"
            }}>
              <div style={{ fontSize: 13, marginBottom: 5, lineHeight: 1, fontFamily: "monospace", fontWeight: 700, color: active ? cat.color : "#334155" }}>[{cat.icon}]</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: active ? cat.color : "#64748b", fontFamily: "monospace", lineHeight: 1.3 }}>{cat.label}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SubmitModal({ onClose, onNewResult }) {
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState("other");
  const [text, setText] = useState("");
  const [source, setSource] = useState("");
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [inputMode, setInputMode] = useState("text"); // "text" or "image"
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef();
  const cat = getCat(category);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImage(ev.target.result);
      setImagePreview(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const analyze = async () => {
    if (inputMode === "text" && !text.trim()) return;
    if (inputMode === "image" && !image) return;
    setLoading(true);

    try {
      let messages;
      if (inputMode === "image" && image) {
        const base64 = image.split(",")[1];
        const mimeType = image.split(";")[0].split(":")[1];
        messages = [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mimeType, data: base64 } },
            { type: "text", text: `You are PhishScore.ai, an expert scam detection AI. Analyze this screenshot for scam indicators.\n\nUser category hint: "${cat.label}" - ${cat.description}\n\nLook at the image carefully - read all text, sender info, links, logos, and visual cues.\n\nRespond ONLY with valid JSON (no markdown, no backticks):\n{\n  "score": <0-100 integer>,\n  "tags": [<2-4 short labels>],\n  "verdict": "<one sentence verdict>",\n  "analysis": "<2-3 plain English sentences>",\n  "redFlags": [<up to 5 red flags, empty array if none>],\n  "whatToDo": "<one concrete action>",\n  "detectedSource": "<sender email, phone number, or domain if visible in image, or null>"\n}` }
          ]
        }];
      } else {
        messages = [{
          role: "user",
          content: `You are PhishScore.ai, an expert scam detection AI trusted by millions. Analyze this message for scam indicators.\n\nUser category hint: "${cat.label}" - ${cat.description}\n\nRespond ONLY with valid JSON (no markdown, no backticks):\n{\n  "score": <0-100 integer>,\n  "tags": [<2-4 short labels>],\n  "verdict": "<one sentence verdict>",\n  "analysis": "<2-3 plain English sentences>",\n  "redFlags": [<up to 5 red flags, empty array if none>],\n  "whatToDo": "<one concrete action>",\n  "detectedSource": "<sender email, phone number, or domain if clearly identifiable in message, or null>"\n}\n\nMessage:\n${text}`
        }];
      }

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages })
      });
      const data = await res.json();
      const raw = data.content?.map(c => c.text || "").join("") || "";
      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
      setResult(parsed);
      const finalSource = source.trim() || parsed.detectedSource || "user-submitted";
      onNewResult({ category, text: inputMode === "image" ? "[Screenshot submitted]" : text, result: parsed, source: finalSource });
      setStep(3);
    } catch {
      setResult({ score: 0, tags: ["Error"], verdict: "Analysis failed.", analysis: "Please try again.", redFlags: [], whatToDo: "Try submitting again." });
      setStep(3);
    }
    setLoading(false);
  };

  const sc = result ? getScoreColor(result.score) : "#fff";
  const canAnalyze = inputMode === "text" ? text.trim().length > 0 : image !== null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", backdropFilter: "blur(14px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#090b14", border: "1px solid #1a1d2e", borderRadius: 20, width: "100%", maxWidth: 620, maxHeight: "92vh", overflowY: "auto", padding: 32, position: "relative", boxShadow: "0 32px 96px rgba(0,0,0,0.7)" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, background: "#1a1d2e", border: "none", color: "#475569", width: 30, height: 30, borderRadius: "50%", cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center" }}>x</button>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "monospace", letterSpacing: 1, marginBottom: 8 }}>
            <span style={{ color: "#fff" }}>PHISH</span><span style={{ color: "#f43f5e" }}>SCORE</span><span style={{ color: "#334155", fontSize: 13 }}>.ai</span>
          </div>
          {step < 3 && (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {["Choose Type", "Submit Content", "Your Score"].map((s, i) => (
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
              <button onClick={() => setStep(2)} style={{ background: "linear-gradient(135deg,#f43f5e,#be123c)", border: "none", color: "#fff", padding: "12px 28px", borderRadius: 10, fontSize: 12, fontWeight: 700, letterSpacing: 2, cursor: "pointer", fontFamily: "monospace", boxShadow: "0 4px 20px rgba(244,63,94,0.35)" }}>NEXT</button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div style={{ fontSize: 12, letterSpacing: 3, color: "#475569", fontFamily: "monospace", marginBottom: 16 }}>STEP 2 - SUBMIT THE CONTENT</div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: `${cat.color}12`, border: `1px solid ${cat.color}35`, borderRadius: 10, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: cat.color, fontFamily: "monospace" }}>{cat.label}</div>
                <div style={{ fontSize: 11, color: "#475569", fontFamily: "Georgia, serif" }}>{cat.description}</div>
              </div>
              <button onClick={() => setStep(1)} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 11, fontFamily: "monospace" }}>change</button>
            </div>

            {/* Input mode toggle */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <button onClick={() => setInputMode("text")} style={{ flex: 1, padding: "10px", borderRadius: 8, border: `1.5px solid ${inputMode === "text" ? "#f43f5e" : "#1a1d2e"}`, background: inputMode === "text" ? "#f43f5e18" : "#0d0f1a", color: inputMode === "text" ? "#f43f5e" : "#475569", fontFamily: "monospace", fontSize: 11, fontWeight: 700, cursor: "pointer", letterSpacing: 1 }}>
                PASTE TEXT
              </button>
              <button onClick={() => setInputMode("image")} style={{ flex: 1, padding: "10px", borderRadius: 8, border: `1.5px solid ${inputMode === "image" ? "#f43f5e" : "#1a1d2e"}`, background: inputMode === "image" ? "#f43f5e18" : "#0d0f1a", color: inputMode === "image" ? "#f43f5e" : "#475569", fontFamily: "monospace", fontSize: 11, fontWeight: 700, cursor: "pointer", letterSpacing: 1 }}>
                UPLOAD SCREENSHOT
              </button>
            </div>

            {inputMode === "text" ? (
              <>
                <textarea value={text} onChange={e => setText(e.target.value)}
                  placeholder="Paste the full suspicious message here. Include sender address, subject line, and all body text for best results."
                  style={{ width: "100%", minHeight: 180, background: "#0d0f1a", border: "1.5px solid #1a1d2e", borderRadius: 10, color: "#e2e8f0", padding: 16, fontSize: 13, fontFamily: "Georgia, serif", resize: "vertical", outline: "none", boxSizing: "border-box", lineHeight: 1.7 }}
                  onFocus={e => e.target.style.borderColor = "#f43f5e55"}
                  onBlur={e => e.target.style.borderColor = "#1a1d2e"}
                />
                <div style={{ fontSize: 10, color: "#334155", fontFamily: "monospace", marginTop: 5, marginBottom: 12 }}>{text.length} chars - more context = better score</div>
              </>
            ) : (
              <div style={{ marginBottom: 12 }}>
                <input type="file" accept="image/*" ref={fileRef} onChange={handleImageUpload} style={{ display: "none" }} />
                {!imagePreview ? (
                  <button onClick={() => fileRef.current.click()} style={{ width: "100%", minHeight: 160, background: "#0d0f1a", border: "2px dashed #1a1d2e", borderRadius: 10, color: "#475569", fontFamily: "monospace", fontSize: 12, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <div style={{ fontSize: 28 }}>[ IMG ]</div>
                    <div>Tap to upload screenshot</div>
                    <div style={{ fontSize: 10, color: "#334155" }}>JPG, PNG, or HEIC from your camera roll</div>
                  </button>
                ) : (
                  <div style={{ position: "relative" }}>
                    <img src={imagePreview} alt="preview" style={{ width: "100%", borderRadius: 10, maxHeight: 280, objectFit: "contain", background: "#0d0f1a" }} />
                    <button onClick={() => { setImage(null); setImagePreview(null); }} style={{ position: "absolute", top: 8, right: 8, background: "#f43f5e", border: "none", color: "#fff", width: 26, height: 26, borderRadius: "50%", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>x</button>
                  </div>
                )}
              </div>
            )}

            {/* Optional source field */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: "#334155", fontFamily: "monospace", letterSpacing: 2, marginBottom: 6 }}>SENDER / SOURCE (optional)</div>
              <input
                value={source}
                onChange={e => setSource(e.target.value)}
                placeholder="e.g. scammer@gmail.com or +91 98765 43210 or unknown"
                style={{ width: "100%", background: "#0d0f1a", border: "1.5px solid #1a1d2e", borderRadius: 8, color: "#e2e8f0", padding: "10px 14px", fontSize: 12, fontFamily: "monospace", outline: "none", boxSizing: "border-box" }}
                onFocus={e => e.target.style.borderColor = "#f43f5e55"}
                onBlur={e => e.target.style.borderColor = "#1a1d2e"}
              />
              <div style={{ fontSize: 10, color: "#1e2030", fontFamily: "monospace", marginTop: 4 }}>Helps identify scam origins for the community dashboard</div>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "space-between" }}>
              <button onClick={() => setStep(1)} style={{ background: "#1a1d2e", border: "none", color: "#64748b", padding: "11px 20px", borderRadius: 10, fontSize: 11, cursor: "pointer", fontFamily: "monospace" }}>BACK</button>
              <button onClick={analyze} disabled={loading || !canAnalyze} style={{ background: loading || !canAnalyze ? "#1a1d2e" : "linear-gradient(135deg,#f43f5e,#be123c)", border: "none", color: loading || !canAnalyze ? "#334155" : "#fff", padding: "11px 28px", borderRadius: 10, fontSize: 12, fontWeight: 700, letterSpacing: 2, cursor: loading || !canAnalyze ? "default" : "pointer", fontFamily: "monospace", boxShadow: loading || !canAnalyze ? "none" : "0 4px 20px rgba(244,63,94,0.35)" }}>
                {loading ? "ANALYZING..." : "GET MY SCORE"}
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
                <div style={{ fontSize: 10, letterSpacing: 3, color: "#f43f5e", fontFamily: "monospace", marginBottom: 10 }}>RED FLAGS ({result.redFlags.length})</div>
                {result.redFlags.map((f, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: i < result.redFlags.length - 1 ? 8 : 0 }}>
                    <span style={{ color: "#f43f5e", flexShrink: 0 }}>!</span>
                    <span style={{ color: "#fca5a5", fontSize: 13, fontFamily: "Georgia, serif", lineHeight: 1.5 }}>{f}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ background: "#081410", border: "1px solid #34d39925", borderRadius: 10, padding: 16, marginBottom: 20 }}>
              <div style={{ fontSize: 10, letterSpacing: 3, color: "#34d399", fontFamily: "monospace", marginBottom: 8 }}>WHAT TO DO</div>
              <p style={{ color: "#86efac", fontSize: 13, margin: 0, fontFamily: "Georgia, serif", lineHeight: 1.6 }}>{result.whatToDo}</p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setStep(1); setResult(null); setText(""); setSource(""); setCategory("other"); setImage(null); setImagePreview(null); }} style={{ flex: 1, background: "#1a1d2e", border: "none", color: "#64748b", padding: "12px", borderRadius: 10, fontSize: 11, cursor: "pointer", fontFamily: "monospace", letterSpacing: 1 }}>CHECK ANOTHER</button>
              <button onClick={onClose} style={{ flex: 1, background: "linear-gradient(135deg,#f43f5e,#be123c)", border: "none", color: "#fff", padding: "12px", borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "monospace", letterSpacing: 1 }}>VIEW DASHBOARD</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [submissions, setSubmissions] = useState([]);
  const [dbLoading, setDbLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filterCat, setFilterCat] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("recent");

  useEffect(() => { loadSubmissions(); }, []);

  const loadSubmissions = async () => {
    setDbLoading(true);
    try {
      const data = await db.getSubmissions();
      if (Array.isArray(data)) setSubmissions(data);
    } catch (e) { console.error(e); }
    setDbLoading(false);
  };

  const handleNewResult = async ({ category, text, result, source }) => {
    const newSub = {
      category,
      source: source || "user-submitted",
      preview: text.slice(0, 130) + (text.length > 130 ? "..." : ""),
      score: result.score,
      tags: result.tags || [],
    };
    try {
      const saved = await db.insertSubmission(newSub);
      if (Array.isArray(saved) && saved[0]) {
        setSubmissions(prev => [saved[0], ...prev]);
      } else {
        setSubmissions(prev => [{ ...newSub, id: Date.now(), created_at: new Date().toISOString() }, ...prev]);
      }
    } catch {
      setSubmissions(prev => [{ ...newSub, id: Date.now(), created_at: new Date().toISOString() }, ...prev]);
    }
  };

  const total = submissions.length;
  const scams = submissions.filter(s => s.score >= 75).length;
  const suspicious = submissions.filter(s => s.score >= 45 && s.score < 75).length;
  const safe = submissions.filter(s => s.score < 45).length;

  const catCounts = SCAM_CATEGORIES
    .map(cat => ({ ...cat, count: submissions.filter(s => s.category === cat.id).length, scamCount: submissions.filter(s => s.category === cat.id && s.score >= 75).length }))
    .filter(c => c.count > 0).sort((a, b) => b.count - a.count);
  const maxCount = Math.max(...catCounts.map(c => c.count), 1);

  const filtered = submissions
    .filter(s => filterCat === "all" || s.category === filterCat)
    .filter(s => filterStatus === "all" || (filterStatus === "scam" && s.score >= 75) || (filterStatus === "suspicious" && s.score >= 45 && s.score < 75) || (filterStatus === "safe" && s.score < 45))
    .sort((a, b) => sortBy === "recent" ? new Date(b.created_at) - new Date(a.created_at) : b.score - a.score);

  const statusColors = { all: "#5b6cf8", scam: "#f43f5e", suspicious: "#fb923c", safe: "#34d399" };

  return (
    <div style={{ minHeight: "100vh", background: "#060810", color: "#e2e8f0", fontFamily: "Georgia, serif" }}>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 70% 50% at 5% 0%, #f43f5e08, transparent 55%), radial-gradient(ellipse 50% 40% at 95% 100%, #a78bfa07, transparent 55%)" }} />
      <div style={{ position: "relative" }}>
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
            CHECK A MESSAGE
          </button>
        </header>

        <main style={{ padding: "28px", maxWidth: 1300, margin: "0 auto" }}>
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

          {catCounts.length > 0 && (
            <div style={{ background: "#090b14", border: "1px solid #1a1d2e", borderRadius: 16, padding: 24, marginBottom: 22 }}>
              <div style={{ fontSize: 10, letterSpacing: 3, color: "#334155", fontFamily: "monospace", marginBottom: 18 }}>
                BREAKDOWN BY SCAM TYPE - <span style={{ color: "#475569" }}>click to filter</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
                {catCounts.map(cat => {
                  const active = filterCat === cat.id;
                  return (
                    <button key={cat.id} onClick={() => setFilterCat(active ? "all" : cat.id)} style={{ background: active ? `${cat.color}14` : "#0d0f1a", border: `1.5px solid ${active ? cat.color : "#1a1d2e"}`, borderRadius: 10, padding: "12px 14px", cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: active ? cat.color : "#64748b", fontFamily: "monospace" }}>{cat.label}</span>
                        <span style={{ fontSize: 15, fontWeight: 800, color: cat.color, fontFamily: "monospace" }}>{cat.count}</span>
                      </div>
                      <div style={{ background: "#1a1d2e", borderRadius: 3, height: 4 }}>
                        <div style={{ height: "100%", borderRadius: 3, background: `linear-gradient(90deg, ${cat.color}, ${cat.color}66)`, width: `${(cat.count / maxCount) * 100}%`, transition: "width 0.8s ease" }} />
                      </div>
                      <div style={{ fontSize: 10, color: "#334155", marginTop: 5, fontFamily: "monospace" }}>{cat.scamCount} scam{cat.scamCount !== 1 ? "s" : ""}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

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
                  {sortBy === "recent" ? "NEWEST" : "HIGHEST SCORE"}
                </button>
              </div>
            </div>

            {dbLoading ? (
              <div style={{ textAlign: "center", padding: "48px 0", color: "#334155", fontFamily: "monospace", fontSize: 12 }}>LOADING SUBMISSIONS...</div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 0" }}>
                <div style={{ color: "#334155", fontFamily: "monospace", fontSize: 12, marginBottom: 12 }}>No submissions yet - be the first!</div>
                <button onClick={() => setShowModal(true)} style={{ background: "linear-gradient(135deg,#f43f5e,#be123c)", border: "none", color: "#fff", padding: "10px 24px", borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "monospace", letterSpacing: 2 }}>CHECK A MESSAGE</button>
              </div>
            ) : (
              filtered.map((s, i) => {
                const cat = getCat(s.category);
                const sc = getScoreColor(s.score);
                return (
                  <div key={s.id} style={{ display: "grid", gridTemplateColumns: "60px 1fr auto", gap: 16, padding: "16px 0", borderTop: i > 0 ? "1px solid #0d0f1a" : "none", alignItems: "start" }}>
                    <ScoreRing score={s.score} size={56} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 6, marginBottom: 5, flexWrap: "wrap", alignItems: "center" }}>
                        <span style={{ background: `${cat.color}14`, border: `1px solid ${cat.color}35`, color: cat.color, fontSize: 9, padding: "2px 8px", borderRadius: 20, fontFamily: "monospace", letterSpacing: 1 }}>{cat.label}</span>
                        {(s.tags || []).slice(0, 2).map(t => <span key={t} style={{ background: "#1a1d2e", color: "#475569", fontSize: 9, padding: "2px 8px", borderRadius: 20, fontFamily: "monospace" }}>{t}</span>)}
                        <span style={{ fontSize: 9, color: "#1e2a3a", fontFamily: "monospace", marginLeft: "auto" }}>{timeAgo(s.created_at)}</span>
                      </div>
                      <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 6 }}>{s.preview}</div>
                      <SourceBadge source={s.source} />
                    </div>
                    <div style={{ padding: "5px 11px", borderRadius: 20, fontSize: 9, fontWeight: 800, letterSpacing: 2, color: sc, border: `1px solid ${sc}35`, background: `${sc}0d`, whiteSpace: "nowrap", fontFamily: "monospace" }}>{getStatusLabel(s.score)}</div>
                  </div>
                );
              })
            )}
          </div>
          <div style={{ textAlign: "center", marginTop: 28, fontSize: 9, color: "#1a1d2e", letterSpacing: 3, fontFamily: "monospace" }}>PHISHSCORE.AI - PROTECTING COMMUNITIES FROM FRAUD</div>
        </main>
      </div>
      {showModal && <SubmitModal onClose={() => setShowModal(false)} onNewResult={handleNewResult} />}
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.15} }
        * { box-sizing: border-box; }
        body { margin: 0; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: #060810; }
        ::-webkit-scrollbar-thumb { background: #1a1d2e; border-radius: 3px; }
        button { transition: all 0.15s; }
      `}</style>
    </div>
  );
}
