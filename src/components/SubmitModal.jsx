import { useState, useRef, useEffect } from "react";
import { SCAM_CATEGORIES, VISIBILITY_OPTIONS, getScoreColor, getStatusLabel, getCat } from "../constants";
import { ScoreRing, CatIconSvg, VisibilityBadge, Tooltip, PhishScoreLogo } from "./Primitives";
import db from "../db";

function CategoryPicker({ selected, onSelect, submissionCounts = {}, T = {} }) {
  const [showAll, setShowAll] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 768);

  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const initialCount = isDesktop ? 9 : 5; // +1 pinned "other" = 10 desktop / 6 mobile
  const otherCat = SCAM_CATEGORIES.find(c => c.id === "other");
  const restCats = SCAM_CATEGORIES.filter(c => c.id !== "other");
  const sorted = [...restCats].sort((a, b) => (submissionCounts[b.id] || 0) - (submissionCounts[a.id] || 0));
  const topN = sorted.slice(0, initialCount);
  const remaining = sorted.slice(initialCount);
  const visible = [otherCat, ...topN, ...(showAll ? remaining : [])];

  return (
    <div>
      <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 16px", fontFamily: "Georgia, serif" }}>
        Select the type that best matches - or pick <strong style={{ color: "#94a3b8" }}>Unknown / AI Detect</strong> and AI will automatically classify it.
      </p>
      <div className="cat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 8 }}>
        {visible.map(cat => {
          const active = selected === cat.id;
          return (
            <button key={cat.id} onClick={() => onSelect(cat.id)} style={{ background: active ? `${cat.color}18` : T.innerBg, border: `1.5px solid ${active ? cat.color : T.innerBorder}`, borderRadius: 10, padding: "8px 8px", cursor: "pointer", textAlign: "left", transition: "all 0.15s", transform: active ? "scale(1.03)" : "scale(1)", minWidth: 0, boxSizing: "border-box" }}>
              <div style={{ marginBottom: 6 }}><CatIconSvg icon={cat.icon} color={active ? "#ffffff" : "#64748b"} size={18} /></div>
              <div style={{ fontSize: 10, fontWeight: 700, color: active ? cat.color : "#64748b", fontFamily: "monospace", lineHeight: 1.3, wordBreak: "break-word" }}>{cat.label}</div>
              {submissionCounts[cat.id] > 0 && <div style={{ fontSize: 9, color: "#334155", fontFamily: "monospace", marginTop: 3 }}>{submissionCounts[cat.id]} reports</div>}
            </button>
          );
        })}
      </div>
      {remaining.length > 0 && (
        <button onClick={() => setShowAll(v => !v)} style={{ marginTop: 10, width: "100%", background: "none", border: `1px dashed ${T.cardBorder}`, color: T.text4, padding: "8px", borderRadius: 8, cursor: "pointer", fontFamily: "monospace", fontSize: 10, letterSpacing: 1 }}>
          {showAll ? "SHOW LESS" : `+ ${remaining.length} MORE CATEGORIES`}
        </button>
      )}
    </div>
  );
}

function VisibilityPicker({ selected, onSelect }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "#334155", fontFamily: "monospace", letterSpacing: 2, marginBottom: 10 }}>WHO CAN SEE THIS SUBMISSION?</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {VISIBILITY_OPTIONS.map(opt => {
          const active = selected === opt.id;
          return (
            <Tooltip key={opt.id} text={opt.description}>
              <button onClick={() => onSelect(opt.id)} style={{ background: active ? `${opt.color}0f` : "#f8fafc", border: `1.5px solid ${active ? opt.color : "#e2e8f0"}`, borderRadius: 10, padding: "8px 12px", cursor: "pointer", textAlign: "left", transition: "background 0.2s, border-color 0.2s", minWidth: 90 }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.background = "#f1f5f9"; e.currentTarget.style.borderColor = "#cbd5e1"; } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "#f8fafc"; e.currentTarget.style.borderColor = "#e2e8f0"; } }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: active ? opt.color : "#475569", fontFamily: "monospace", marginBottom: 4 }}>{opt.icon}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: active ? opt.color : "#475569", fontFamily: "monospace", marginBottom: 3 }}>{opt.label}</div>
                <div style={{ fontSize: 10, color: active ? `${opt.color}bb` : "#94a3b8", fontFamily: "Georgia, serif", lineHeight: 1.3 }}>{opt.short}</div>
              </button>
            </Tooltip>
          );
        })}
      </div>
      <div style={{ fontSize: 10, color: "#334155", fontFamily: "monospace", marginTop: 8 }}>Hover or tap each option for details</div>
    </div>
  );
}

function ConfidenceMeter({ text, source, T = {} }) {
  let score = 0, tips = [];
  if (text.trim().length > 20) { score += 30; } else { tips.push("Add more message text"); }
  if (text.trim().length > 150) score += 15;
  if (source && source.trim().length > 3) { score += 25; } else { tips.push("Add sender address or phone number"); }
  if (/@/.test(text + source) || (text + source).split("").filter(c => c >= "0" && c <= "9").length >= 7) score += 15;
  if (/received:|message-id:|dkim-signature:|x-mailer:/i.test(text)) { score += 15; } else if (text.length > 100) tips.push("Paste email headers for deepest analysis");
  score = Math.min(score, 100);
  const barColor = score >= 80 ? "#34d399" : score >= 50 ? "#fb923c" : "#f43f5e";
  const label = score >= 80 ? "Strong submission" : score >= 50 ? "Good submission" : "Basic submission";
  return (
    <div style={{ marginTop: 8, marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 10, color: T.text4, fontFamily: "monospace", letterSpacing: 1 }}>SUBMISSION QUALITY</span>
        <span style={{ fontSize: 10, color: barColor, fontFamily: "monospace", fontWeight: 700 }}>{score}% - {label}</span>
      </div>
      <div style={{ background: T.ringTrack, borderRadius: 4, height: 5, overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: 4, background: barColor, width: `${score}%`, transition: "width 0.4s ease", boxShadow: `0 0 6px ${barColor}88` }} />
      </div>
      {tips.length > 0 && (
        <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {tips.map((t, i) => <span key={i} style={{ fontSize: 9, color: T.text4, fontFamily: "monospace", background: T.innerBg, padding: "2px 8px", borderRadius: 10 }}>+ {t}</span>)}
        </div>
      )}
    </div>
  );
}

function ShareCard({ result, category, T = {} }) {
  const [copied, setCopied] = useState(false);
  const cat = getCat(category), sc = getScoreColor(result.score);
  const shareText = `I just checked a suspicious message on PhishScore.ai\n\nScore: ${result.score}/100 - ${getStatusLabel(result.score)}\nCategory: ${cat.label}\nVerdict: ${result.verdict}\n\nTop red flags:\n${(result.redFlags || []).slice(0, 3).map(f => "- " + f).join("\n")}\n\nCheck suspicious messages yourself at phishscore.ai`;
  const handleCopy = () => {
    navigator.clipboard.writeText(shareText).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); }).catch(() => {
      const ta = document.createElement("textarea"); ta.value = shareText; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
      setCopied(true); setTimeout(() => setCopied(false), 2500);
    });
  };
  const twitterText = encodeURIComponent(`Scam alert! This message scored ${result.score}/100 on PhishScore.ai\n\n${result.verdict}\n\nCheck suspicious messages: phishscore.ai`);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, letterSpacing: 3, color: T.text4, fontFamily: "monospace", marginBottom: 8 }}>SHARE THIS WARNING</div>
      <div style={{ background: T.cardBg, border: `1px solid ${sc}30`, borderRadius: 12, padding: 16, marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", border: `3px solid ${sc}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: sc, fontFamily: "monospace" }}>{result.score}</span>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: sc, fontFamily: "monospace" }}>{getStatusLabel(result.score)}</div>
            <div style={{ fontSize: 10, color: T.text3, fontFamily: "monospace" }}>{cat.label} - phishscore.ai</div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: T.text3, fontFamily: "Georgia, serif", lineHeight: 1.5, fontStyle: "italic" }}>"{result.verdict}"</div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={handleCopy} style={{ flex: 1, background: copied ? "#081410" : T.innerBg, border: `1px solid ${copied ? "#34d399" : "#2a2d3e"}`, color: copied ? "#34d399" : T.text3, padding: "9px 12px", borderRadius: 8, fontSize: 10, cursor: "pointer", fontFamily: "monospace", letterSpacing: 1, transition: "all 0.2s" }}>{copied ? "COPIED!" : "COPY TEXT"}</button>
        <a href={`https://twitter.com/intent/tweet?text=${twitterText}`} target="_blank" rel="noopener noreferrer" style={{ flex: 1, background: "#0a0f1a", border: "1px solid #1d9bf040", color: "#1d9bf0", padding: "9px 12px", borderRadius: 8, fontSize: 10, fontFamily: "monospace", letterSpacing: 1, textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>POST TO X</a>
      </div>
    </div>
  );
}

function AccuracyFeedback({ caseId = null, trainingId = null, T = {} }) {
  // status: 'idle' | 'form_open' | 'submitting' | 'success'
  const [status, setStatus] = useState('idle');
  const [feedbackText, setFeedbackText] = useState('');

  const submitFeedback = async (isAccurate, text = '') => {
    setStatus('submitting');
    try {
      await fetch('/api/submit-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId, trainingId, is_accurate: isAccurate, feedbackText: text }),
      });
    } catch { /* best-effort — show success regardless */ }
    setStatus('success');
  };

  if (status === 'success') {
    return (
      <div style={{ padding: "10px 14px", background: "#081410", border: "1px solid #34d39930", borderRadius: 10, display: "flex", alignItems: "center", gap: 8 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        <span style={{ fontSize: 11, color: "#34d399", fontFamily: "monospace" }}>Thank you for your feedback!</span>
      </div>
    );
  }

  if (status === 'form_open') {
    return (
      <div style={{ background: T.innerBg, border: `1px solid ${T.cardBorder}`, borderRadius: 10, padding: "12px 14px" }}>
        <div style={{ fontSize: 10, color: T.text4, fontFamily: "monospace", letterSpacing: 1, marginBottom: 8 }}>WHAT DID WE MISS?</div>
        <textarea
          value={feedbackText}
          onChange={e => setFeedbackText(e.target.value)}
          placeholder="Tell us what the AI got wrong or what context it missed..."
          style={{ width: "100%", minHeight: 88, background: T.inputBg, border: `1.5px solid ${T.inputBorder}`, borderRadius: 8, color: T.text, padding: "10px 12px", fontSize: 12, fontFamily: "Georgia, serif", resize: "vertical", outline: "none", boxSizing: "border-box", lineHeight: 1.6 }}
          onFocus={e => e.target.style.borderColor = "#f43f5e55"}
          onBlur={e => e.target.style.borderColor = T.inputBorder}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button
            onClick={() => submitFeedback(false, feedbackText)}
            disabled={status === 'submitting'}
            style={{ flex: 1, background: "linear-gradient(135deg,#f43f5e,#be123c)", border: "none", color: "#fff", padding: "9px 12px", borderRadius: 8, fontSize: 10, fontWeight: 700, letterSpacing: 1, cursor: "pointer", fontFamily: "monospace" }}>
            {status === 'submitting' ? 'SUBMITTING...' : 'SUBMIT FEEDBACK'}
          </button>
          <button
            onClick={() => setStatus('idle')}
            style={{ background: T.innerBg, border: `1px solid ${T.cardBorder}`, color: T.text4, padding: "9px 14px", borderRadius: 8, fontSize: 10, cursor: "pointer", fontFamily: "monospace" }}>
            CANCEL
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "10px 14px", background: T.innerBg, border: `1px solid ${T.cardBorder}`, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
      <span style={{ fontSize: 11, color: T.text4, fontFamily: "monospace" }}>Was this result accurate?</span>
      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        <button
          onClick={() => submitFeedback(true)}
          style={{ background: "#081410", border: "1px solid #34d39940", color: "#34d399", padding: "6px 20px", borderRadius: 8, fontSize: 11, cursor: "pointer", fontFamily: "monospace", letterSpacing: 1, minWidth: 56 }}>
          YES
        </button>
        <button
          onClick={() => setStatus('form_open')}
          style={{ background: "#160810", border: "1px solid #f43f5e40", color: "#f43f5e", padding: "6px 20px", borderRadius: 8, fontSize: 11, cursor: "pointer", fontFamily: "monospace", letterSpacing: 1, minWidth: 56 }}>
          NO
        </button>
      </div>
    </div>
  );
}

// ── Shared scanner content — used both inline and inside the modal ────────────
export function ScannerPanel({ onClose, onNewResult, onDeepIntel, submissionCounts = {}, theme = "dark", T = {} }) {
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState("other");
  const [visibility, setVisibility] = useState("private");
  const [text, setText] = useState("");
  const [source, setSource] = useState("");
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [inputMode, setInputMode] = useState("text");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [duplicate, setDuplicate] = useState(null);
  const [errorState, setErrorState] = useState(null);
  const [trainAI, setTrainAI] = useState(false);
  const [showTrainInfo, setShowTrainInfo] = useState(false);
  const [deliveryChannel, setDeliveryChannel] = useState("other");
  const [caseId, setCaseId] = useState(null);
  const [trainingId, setTrainingId] = useState(null);
  const fileRef = useRef();
  // CHANGE: double-submit prevention — hard lock at function level
  const isSubmitting = useRef(false);
  const cat = getCat(category);

  const resetForm = () => {
    setStep(1); setResult(null); setText(""); setSource("");
    setCategory("other"); setVisibility("private"); setImage(null);
    setImagePreview(null); setErrorState(null); setDuplicate(null);
    setTrainAI(false); setInputMode("text"); setDeliveryChannel("other");
    setCaseId(null);
    setTrainingId(null);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setImage(ev.target.result); setImagePreview(ev.target.result); };
    reader.readAsDataURL(file);
  };

  const analyze = async () => {
    // CHANGE: block if already in flight
    if (isSubmitting.current) return;
    if (inputMode === "text" && !text.trim()) return;
    if (inputMode === "image" && !image) return;
    isSubmitting.current = true;
    if (inputMode === "text" && text.trim().length > 30) {
      const dup = await db.checkDuplicate(text.slice(0, 130));
      if (dup) setDuplicate(dup);
    }
    setLoading(true);
    try {
      let messages;
      const categoryList = "publishing, delivery, retail, telecom, traffic, social, finance, government, prize, romance, job, tech, political, travel, legal, other";
      // CHANGE: summary trimmed to 1 sentence; whatToDo explicitly banned from including any URLs
      const jsonSchema = `{"score":<0-100>,"tags":[<2-4 labels>],"summary":"<ONE plain-English sentence describing what this scam is and how it operates, written for a community feed — no raw email fields, no technical jargon>","verdict":"<one sentence>","analysis":"<2-3 sentences>","redFlags":[<up to 5>],"whatToDo":"<one action sentence — NEVER include any URLs, domain names, or web addresses of any kind, not even official ones. Say 'go to the official website' or 'contact your bank directly' instead>","detectedSources":["<only phone numbers with country code if present, and sender email addresses — nothing else, empty array if none found>"],"detectedCategory":<best category id string or null>,"categoryReclassified":<true if user category was wrong, false otherwise>}`;
      if (inputMode === "image" && image) {
        // Compress image before sending to stay under 4.5MB Vercel limit
        const compressedImage = await new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX = 1200;
            let w = img.width, h = img.height;
            if (w > MAX || h > MAX) {
              if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
              else { w = Math.round(w * MAX / h); h = MAX; }
            }
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', 0.7));
          };
          img.src = image;
        });
        const base64 = compressedImage.split(",")[1];
        const mimeType = "image/jpeg";
        messages = [{ role: "user", content: [
          { type: "image", source: { type: "base64", media_type: mimeType, data: base64 } },
          { type: "text", text: `You are PhishScore.ai. Analyze this screenshot for scam indicators.\nUser selected category: "${cat.label}" (id: "${category}") - ${cat.description}\n\nIMPORTANT TASKS:\n1. Extract ONLY phone numbers (with country code if visible) and sender email addresses. Do NOT extract domains, URLs, names, usernames, or any other identifiers.\n2. If the user selected "other", determine the best category from: ${categoryList}. Return it in detectedCategory if 70%+ confident, else null.\n3. If the user selected a specific category but the content clearly belongs to a DIFFERENT category with 85%+ confidence, return the correct category in detectedCategory and set categoryReclassified to true.\n\nRespond ONLY with valid JSON (no markdown):\n${jsonSchema}` }
        ]}];
      } else {
        messages = [{ role: "user", content: `You are PhishScore.ai. Analyze this message for scam indicators.\nUser selected category: "${cat.label}" (id: "${category}") - ${cat.description}\n\nIMPORTANT TASKS:\n1. Extract ONLY phone numbers (with country code if visible) and sender email addresses. Do NOT extract domains, URLs, names, usernames, or any other identifiers.\n2. If the user selected "other", determine the best category from: ${categoryList}. Return it in detectedCategory if 70%+ confident, else null.\n3. If the user selected a specific category but the content clearly belongs to a DIFFERENT category with 85%+ confidence, return the correct category in detectedCategory and set categoryReclassified to true.\n\nRespond ONLY with valid JSON (no markdown):\n${jsonSchema}\n\nMessage:\n${text}` }];
      }
      // Get reCAPTCHA v3 token before submitting
      let recaptchaToken = null;
      try {
        if (window.grecaptcha && process.env.REACT_APP_RECAPTCHA_SITE_KEY) {
          recaptchaToken = await new Promise((resolve) => {
            window.grecaptcha.ready(async () => {
              const token = await window.grecaptcha.execute(
                process.env.REACT_APP_RECAPTCHA_SITE_KEY,
                { action: 'submit' }
              );
              resolve(token);
            });
          });
        }
      } catch (e) { console.warn('reCAPTCHA failed silently:', e); }

      const res = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, messages, trainAI, recaptchaToken, deliveryChannel, isAnonymous: visibility === "anonymous", visibility }) });

      // Handle rate limit specifically
      if (res.status === 429) {
        const errData = await res.json().catch(() => ({}));
        setErrorState({ type: "rate_limit", message: errData.message || "You've sent too many scans. Please wait a moment before trying again." });
        setStep("error");
        return;
      }

      // Handle service unavailable
      if (!res.ok) {
        setErrorState({ type: "unavailable", message: "The AI analysis service is temporarily unavailable. Please try again in a few minutes." });
        setStep("error");
        return;
      }

      const data = await res.json();
      if (data.trainingId) setTrainingId(data.trainingId);
      const raw = data.content?.map(c => c.text || "").join("") || "";
      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
      let finalCategory = category, classificationNote = null;
      if (parsed.detectedCategory && parsed.detectedCategory !== category) {
        if (category === "other") { finalCategory = parsed.detectedCategory; classificationNote = "auto"; }
        else if (parsed.categoryReclassified === true) { finalCategory = parsed.detectedCategory; classificationNote = "reclassified"; }
      }
      parsed.finalCategory = finalCategory; parsed.classificationNote = classificationNote;
      setResult(parsed);

      const isPhoneOrEmail = (val) => {
        if (!val || !val.trim()) return false;
        const v = val.trim();
        return /^[\+\d\s\-\(\)]{7,}$/.test(v) || v.includes("@");
      };
      let allSources = [];
      if (source.trim() && isPhoneOrEmail(source.trim())) allSources.push(source.trim());
      if (Array.isArray(parsed.detectedSources)) {
        parsed.detectedSources.forEach(s => {
          if (s && isPhoneOrEmail(s) && !allSources.includes(s.trim())) allSources.push(s.trim());
        });
      }
      const finalSource = allSources.length > 0 ? JSON.stringify(allSources.slice(0, 3)) : "user-submitted";
      const savedId = await onNewResult({ category: finalCategory, text: inputMode === "image" ? "[Screenshot submitted]" : text, result: parsed, source: finalSource, visibility, classificationNote: parsed.classificationNote, summary: parsed.summary || null, deliveryChannel });
      setCaseId(savedId || null);
      setStep(3);
    } catch {
      setErrorState({ type: "unavailable", message: "Something went wrong during analysis. Please try again." });
      setStep("error");
    } finally {
      isSubmitting.current = false;
      setLoading(false);
    }
  };

  const sc = result ? getScoreColor(result.score) : "#fff";
  const canAnalyze = inputMode === "text" ? text.trim().length > 0 : image !== null;
  const visOpt = VISIBILITY_OPTIONS.find(o => o.id === visibility);

  return (
    <div style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 16, width: "100%", padding: 32, boxSizing: "border-box", minWidth: 0 }}>

        <div style={{ marginBottom: 24 }}>
          {/* FIX: uses PhishScoreLogo so PHISH is visible in light mode */}
          <div style={{ marginBottom: 8 }}><PhishScoreLogo T={T} size={20} dotSize={13} /></div>
          {step < 3 && (
            <div className="step-indicators" style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              {["Choose Type", "Submit", "Your Score"].map((s, i) => (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: i + 1 <= step ? "#f43f5e" : T.innerBg, color: i + 1 <= step ? "#fff" : T.text4, fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "monospace" }}>{i + 1}</div>
                  <span style={{ fontSize: 10, color: i + 1 <= step ? "#94a3b8" : T.text4, fontFamily: "monospace" }}>{s}</span>
                  {i < 2 && <div style={{ width: 16, height: 1, background: T.innerBg }} />}
                </div>
              ))}
            </div>
          )}
        </div>

        {step === 1 && (
          <>
            <div style={{ fontSize: 12, letterSpacing: 3, color: "#475569", fontFamily: "monospace", marginBottom: 16 }}>STEP 1 - WHAT TYPE OF SCAM?</div>
            <CategoryPicker selected={category} onSelect={setCategory} submissionCounts={submissionCounts} T={T} />
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${T.cardBorder}` }}>
              <VisibilityPicker selected={visibility} onSelect={setVisibility} />
            </div>
            <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => setStep(2)} style={{ background: "linear-gradient(135deg,#f43f5e,#be123c)", border: "none", color: "#fff", padding: "12px 28px", borderRadius: 10, fontSize: 12, fontWeight: 700, letterSpacing: 2, cursor: "pointer", fontFamily: "monospace", boxShadow: "0 4px 20px rgba(244,63,94,0.35)" }}>NEXT</button>
            </div>
          </>
        )}

        {step === 2 && loading && (
          <div style={{ textAlign: "center", padding: "48px 16px" }}>
            <div style={{ fontSize: 32, marginBottom: 16, display: "inline-block", animation: "spin 1.2s linear infinite" }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a10 10 0 0 1 10 10"/><circle cx="12" cy="12" r="2"/>
              </svg>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: "monospace", letterSpacing: 2, marginBottom: 8 }}>ANALYZING...</div>
            <div style={{ fontSize: 12, color: T.text4, fontFamily: "Georgia, serif", lineHeight: 1.6 }}>Our AI is reviewing your submission for scam indicators.</div>
          </div>
        )}

        {step === 2 && !loading && (
          <>
            <div style={{ fontSize: 12, letterSpacing: 3, color: "#475569", fontFamily: "monospace", marginBottom: 16 }}>STEP 2 - SUBMIT THE CONTENT</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", background: `${cat.color}12`, border: `1px solid ${cat.color}35`, borderRadius: 20 }}>
                <span style={{ fontSize: 10, color: cat.color, fontFamily: "monospace", fontWeight: 700 }}>{cat.label}</span>
                <button onClick={() => setStep(1)} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 10, fontFamily: "monospace" }}>change</button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", background: `${visOpt.color}12`, border: `1px solid ${visOpt.color}35`, borderRadius: 20 }}>
                <span style={{ fontSize: 10, color: visOpt.color, fontFamily: "monospace", fontWeight: 700 }}>{visOpt.label.toUpperCase()}</span>
                <button onClick={() => setStep(1)} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 10, fontFamily: "monospace" }}>change</button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <button onClick={() => setInputMode("text")} style={{ flex: 1, padding: "10px", borderRadius: 8, border: `1.5px solid ${inputMode === "text" ? "#f43f5e" : T.innerBorder}`, background: inputMode === "text" ? "#f43f5e18" : T.innerBg, color: inputMode === "text" ? "#f43f5e" : T.text4, fontFamily: "monospace", fontSize: 11, fontWeight: 700, cursor: "pointer", letterSpacing: 1 }}>PASTE TEXT</button>
              <button onClick={() => setInputMode("image")} style={{ flex: 1, padding: "10px", borderRadius: 8, border: `1.5px solid ${inputMode === "image" ? "#f43f5e" : T.innerBorder}`, background: inputMode === "image" ? "#f43f5e18" : T.innerBg, color: inputMode === "image" ? "#f43f5e" : T.text4, fontFamily: "monospace", fontSize: 11, fontWeight: 700, cursor: "pointer", letterSpacing: 1 }}>UPLOAD SCREENSHOT</button>
            </div>
            {inputMode === "text" ? (
              <>
                <textarea value={text} onChange={e => { setText(e.target.value); if (!source.trim()) { const t = e.target.value, atIdx = t.indexOf("@"); if (atIdx > 0) { const start = t.slice(0, atIdx).replace(/.*\s/, ""), end = t.slice(atIdx + 1).replace(/\s.*/, ""); if (start && end && end.includes(".")) setSource(start + "@" + end.split(".").slice(0, 2).join(".")); } } }}
                  placeholder="Paste the full suspicious message here. Include sender address, subject line, and all body text for best results."
                  style={{ width: "100%", minHeight: 144, background: T.inputBg, border: `1.5px solid ${T.inputBorder}`, borderRadius: 10, color: T.text, padding: 16, fontSize: 13, fontFamily: "Georgia, serif", resize: "vertical", outline: "none", boxSizing: "border-box", lineHeight: 1.7 }}
                  onFocus={e => e.target.style.borderColor = "#f43f5e55"} onBlur={e => e.target.style.borderColor = T.inputBorder} />
                <ConfidenceMeter text={text} source={source} T={T} />
              </>
            ) : (
              <div style={{ marginBottom: 12 }}>
                <input type="file" accept="image/*" ref={fileRef} onChange={handleImageUpload} style={{ display: "none" }} />
                {!imagePreview ? (
                  <button onClick={() => fileRef.current.click()} style={{ width: "100%", minHeight: 160, background: T.inputBg, border: `2px dashed ${T.inputBorder}`, borderRadius: 10, color: T.text4, fontFamily: "monospace", fontSize: 12, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <div style={{ fontSize: 28 }}>[ IMG ]</div>
                    <div>Tap to upload screenshot</div>
                    <div style={{ fontSize: 10, color: T.text4 }}>JPG, PNG, or HEIC from your camera roll</div>
                  </button>
                ) : (
                  <div style={{ position: "relative" }}>
                    <img src={imagePreview} alt="preview" style={{ width: "100%", borderRadius: 10, maxHeight: 280, objectFit: "contain", background: "#0d0f1a" }} />
                    <button onClick={() => { setImage(null); setImagePreview(null); }} style={{ position: "absolute", top: 8, right: 8, background: "#f43f5e", border: "none", color: "#fff", width: 26, height: 26, borderRadius: "50%", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>x</button>
                  </div>
                )}
              </div>
            )}
            {/* Delivery channel picker */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: T.text4, fontFamily: "monospace", letterSpacing: 2, marginBottom: 8 }}>HOW WAS THIS DELIVERED TO YOU?</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[
                  { id: "email",  label: "📧 Email" },
                  { id: "sms",    label: "💬 Text / SMS" },
                  { id: "social", label: "📱 Social Media" },
                  { id: "other",  label: "🔗 Other" },
                ].map(opt => {
                  const active = deliveryChannel === opt.id;
                  return (
                    <button key={opt.id} onClick={() => setDeliveryChannel(opt.id)}
                      style={{ padding: "5px 12px", borderRadius: 9999, border: `1.5px solid ${active ? "#06b6d4" : T.innerBorder}`, background: active ? "#06b6d418" : T.innerBg, color: active ? "#06b6d4" : T.text4, fontFamily: "monospace", fontSize: 10, fontWeight: active ? 700 : 400, cursor: "pointer", transition: "all 0.15s" }}>
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {visibility !== "anonymous" && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: T.text4, fontFamily: "monospace", letterSpacing: 2, marginBottom: 6 }}>SENDER / SOURCE (optional)</div>
                <input value={source} onChange={e => setSource(e.target.value)} placeholder="e.g. scammer@gmail.com or +91 98765 43210 or unknown"
                  style={{ width: "100%", background: T.inputBg, border: `1.5px solid ${T.inputBorder}`, borderRadius: 8, color: T.text, padding: "10px 14px", fontSize: 12, fontFamily: "monospace", outline: "none", boxSizing: "border-box" }}
                  onFocus={e => e.target.style.borderColor = "#f43f5e55"} onBlur={e => e.target.style.borderColor = T.inputBorder} />
                <div style={{ fontSize: 10, color: T.text4, fontFamily: "monospace", marginTop: 4 }}>Helps identify scam origins for the community</div>
              </div>
            )}
            {visibility === "anonymous" && (
              <div style={{ padding: "10px 14px", background: "#94a3b812", border: "1px solid #94a3b830", borderRadius: 8, marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>Anonymous mode: no message content or source will be stored after analysis.</div>
              </div>
            )}
            {duplicate && (
              <div style={{ background: "#0d0a00", border: "1px solid #fbbf2440", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: "#fbbf24", fontFamily: "monospace", letterSpacing: 2, marginBottom: 6 }}>SIMILAR SCAM ALREADY REPORTED</div>
                <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: "Georgia, serif", lineHeight: 1.5, marginBottom: 6 }}>We have seen a similar message before. It scored <strong style={{ color: getScoreColor(duplicate.score) }}>{duplicate.score}/100</strong> ({getStatusLabel(duplicate.score)}) in the {getCat(duplicate.category).label} category.</div>
                <button onClick={() => setDuplicate(null)} style={{ background: "none", border: "none", color: "#fbbf24", cursor: "pointer", fontSize: 10, fontFamily: "monospace", padding: 0 }}>Analyze anyway</button>
              </div>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "space-between", marginBottom: 12 }}>
              <button onClick={() => setStep(1)} style={{ background: T.innerBg, border: "none", color: T.text3, padding: "11px 20px", borderRadius: 10, fontSize: 11, cursor: "pointer", fontFamily: "monospace" }}>BACK</button>
              <button onClick={e => { e.preventDefault(); analyze(); }} disabled={loading || !canAnalyze} style={{ background: loading || !canAnalyze ? "#1a1d2e" : "linear-gradient(135deg,#f43f5e,#be123c)", border: "none", color: loading || !canAnalyze ? "#334155" : "#fff", padding: "11px 28px", borderRadius: 10, fontSize: 12, fontWeight: 700, letterSpacing: 2, cursor: loading || !canAnalyze ? "default" : "pointer", fontFamily: "monospace", boxShadow: loading || !canAnalyze ? "none" : "0 4px 20px rgba(244,63,94,0.35)" }}>
                {loading ? "ANALYZING..." : "GET MY SCORE"}
              </button>
            </div>

            {/* Train PhishScore AI checkbox — below buttons to reduce friction */}
            <div style={{ padding: "10px 12px", background: trainAI ? "#5b6cf808" : T.innerBg, border: `1px solid ${trainAI ? "#5b6cf840" : T.innerBorder}`, borderRadius: 8, transition: "all 0.2s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div onClick={() => setTrainAI(v => !v)} style={{ width: 16, height: 16, borderRadius: 3, border: `2px solid ${trainAI ? "#5b6cf8" : T.text4}`, background: trainAI ? "#5b6cf8" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, transition: "all 0.15s" }}>
                  {trainAI && <span style={{ color: "#fff", fontSize: 10, fontWeight: 800, lineHeight: 1 }}>✓</span>}
                </div>
                <span onClick={() => setTrainAI(v => !v)} style={{ fontSize: 10, fontWeight: 700, color: trainAI ? "#5b6cf8" : T.text4, fontFamily: "monospace", cursor: "pointer", letterSpacing: 1 }}>TRAIN PHISHSCORE AI</span>
                <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, background: "#5b6cf820", color: "#5b6cf8", fontFamily: "monospace", fontWeight: 700 }}>MINI</span>
                <button onClick={() => setShowTrainInfo(v => !v)} style={{ background: "none", border: "none", color: T.text4, cursor: "pointer", fontSize: 9, fontFamily: "monospace", padding: 0, textDecoration: "underline", marginLeft: "auto" }}>
                  {showTrainInfo ? "less" : "what is this?"}
                </button>
              </div>
              {(trainAI || showTrainInfo) && (
                <div style={{ marginTop: 10, padding: "10px 14px", background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderLeft: "3px solid #06b6d4", borderRadius: 8, animation: "slideIn 0.15s ease" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: T.text3, fontFamily: "monospace", letterSpacing: 1, marginBottom: 8 }}>WHAT WE'LL COLLECT FROM THIS SUBMISSION</div>
                  {[
                    { ok: true,  text: "Full AI analysis & reasoning" },
                    { ok: true,  text: "Submission type (image or text)" },
                    { ok: true,  text: "Delivery channel (already captured above)" },
                    { ok: true,  text: "Threat database signals at time of submission (GSB, Radar, URLhaus)" },
                    { ok: true,  text: "Community reflag count (updated over time)" },
                    { ok: false, text: "Your original message is never stored for training" },
                  ].map((item, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: i < 4 ? 5 : 0 }}>
                      <span style={{ fontSize: 10, color: item.ok ? "#06b6d4" : "#f43f5e", fontFamily: "monospace", flexShrink: 0, marginTop: 1 }}>{item.ok ? "✓" : "✗"}</span>
                      <span style={{ fontSize: 11, color: T.text3, fontFamily: "Georgia, serif", lineHeight: 1.5 }}>{item.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {step === "error" && errorState && (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>
              {errorState.type === "rate_limit" ? "🐾" : "⚡"}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: "monospace", letterSpacing: 1, marginBottom: 10 }}>
              {errorState.type === "rate_limit" ? "SLOW DOWN A LITTLE" : "SERVICE TEMPORARILY UNAVAILABLE"}
            </div>
            <p style={{ color: T.text3, fontFamily: "Georgia, serif", fontSize: 13, lineHeight: 1.7, margin: "0 0 24px" }}>
              {errorState.message}
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => { setStep(2); setErrorState(null); }} style={{ background: "linear-gradient(135deg,#f43f5e,#be123c)", border: "none", color: "#fff", padding: "11px 28px", borderRadius: 10, fontSize: 12, fontWeight: 700, letterSpacing: 2, cursor: "pointer", fontFamily: "monospace", boxShadow: "0 4px 20px rgba(244,63,94,0.35)" }}>TRY AGAIN</button>
              <button onClick={onClose} style={{ background: T.innerBg, border: `1px solid ${T.innerBorder}`, color: T.text3, padding: "11px 20px", borderRadius: 10, fontSize: 11, cursor: "pointer", fontFamily: "monospace" }}>CLOSE</button>
            </div>
          </div>
        )}

        {step === 3 && result && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, padding: 22, background: `${sc}0d`, border: `1px solid ${sc}30`, borderRadius: 14, marginBottom: 20, flexWrap: "wrap", textAlign: "center" }}>
              <ScoreRing score={result.score} size={80} trackColor={T.ringTrack} />
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: sc, fontFamily: "monospace", letterSpacing: 1 }}>{getStatusLabel(result.score)}</div>
                <div style={{ color: T.text2, fontSize: 14, marginTop: 5, fontFamily: "Georgia, serif", lineHeight: 1.5 }}>{result.verdict}</div>
                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "center" }}>
                  {result.tags?.map(t => <span key={t} style={{ background: T.innerBg, color: T.text3, fontSize: 10, padding: "3px 9px", borderRadius: 20, fontFamily: "monospace" }}>{t}</span>)}
                  <VisibilityBadge visibility={visibility} />
                  {result.classificationNote === "auto" && <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 20, fontFamily: "monospace", letterSpacing: 1, color: "#a78bfa", border: "1px solid #a78bfa40", background: "#a78bfa12" }}>AUTO-CLASSIFIED</span>}
                  {result.classificationNote === "reclassified" && <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 20, fontFamily: "monospace", letterSpacing: 1, color: "#f97316", border: "1px solid #f9731640", background: "#f9731612" }}>RECLASSIFIED</span>}
                </div>
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ fontSize: 10, letterSpacing: 3, color: T.text4, fontFamily: "monospace" }}>ANALYSIS</div>
                {result.safeBrowsingFlagged && <span style={{ fontSize: 9, color: "#f43f5e", fontFamily: "monospace", background: "#f43f5e12", border: "1px solid #f43f5e35", padding: "2px 8px", borderRadius: 20, letterSpacing: 1 }}>GOOGLE SAFE BROWSING: FLAGGED</span>}
              </div>
              <p style={{ color: T.text2, fontSize: 14, lineHeight: 1.8, margin: 0, fontFamily: "Georgia, serif" }}>{result.analysis}</p>
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
            <div style={{ background: "#081410", border: "1px solid #34d39925", borderRadius: 10, padding: 16, marginBottom: result.score >= 75 ? 12 : 20 }}>
              <div style={{ fontSize: 10, letterSpacing: 3, color: "#34d399", fontFamily: "monospace", marginBottom: 8 }}>WHAT TO DO</div>
              <p style={{ color: "#86efac", fontSize: 13, margin: 0, fontFamily: "Georgia, serif", lineHeight: 1.6 }}>{result.whatToDo}</p>
            </div>
            {result.score >= 75 && (
              <>
                {/* Deep Intel teaser — only shown on confirmed scams */}
                <button onClick={() => onDeepIntel({ message: text, score: result.score, category: result.finalCategory })} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "linear-gradient(135deg, #1a0a2e, #0d0520)", border: "1px solid #a78bfa50", borderRadius: 10, padding: "13px 16px", marginBottom: 10, cursor: "pointer", textDecoration: "none", transition: "all 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = "#a78bfa"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "#a78bfa50"}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                      <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
                    </svg>
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#a78bfa", fontFamily: "monospace", letterSpacing: 1 }}>UNCOVER THIS SCAM — PHISHSCORE DEEP INTEL</div>
                      <div style={{ fontSize: 10, color: "#7c5cbf", fontFamily: "Georgia, serif", marginTop: 2 }}>Forensic report, recovery plan, human & expert review — coming soon</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 9, color: "#f43f5e", border: "1px solid #f43f5e60", background: "#f43f5e12", padding: "2px 7px", borderRadius: 6, fontFamily: "monospace", letterSpacing: 1, flexShrink: 0 }}>BETA</span>
                </button>
                <a href="https://reportfraud.ftc.gov/#/" target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#0d0a00", border: "1px solid #fbbf2440", borderRadius: 10, padding: "12px 16px", marginBottom: 20, textDecoration: "none", color: "#fbbf24", fontSize: 11, fontFamily: "monospace", letterSpacing: 1, fontWeight: 700, transition: "all 0.15s" }} onMouseEnter={e => e.currentTarget.style.background = "#1a1400"} onMouseLeave={e => e.currentTarget.style.background = "#0d0a00"}>
                  <CatIconSvg icon="gov" color="#fbbf24" size={14} /> REPORT THIS SCAM TO THE FTC
                </a>
              </>
            )}
            <div>
              <ShareCard result={result} category={result.finalCategory || category} T={T} />
              <div style={{ marginTop: 12 }}>
                <AccuracyFeedback caseId={caseId} trainingId={trainingId} T={T} />
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button onClick={resetForm} style={{ flex: 1, background: T.innerBg, border: `1px solid ${T.cardBorder}`, color: T.text3, padding: "10px 12px", borderRadius: 10, fontSize: 10, cursor: "pointer", fontFamily: "monospace", letterSpacing: 1 }}>CHECK ANOTHER</button>
                <button onClick={onClose} style={{ flex: 1, background: "linear-gradient(135deg,#f43f5e,#be123c)", border: "none", color: "#fff", padding: "10px 12px", borderRadius: 10, fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "monospace", letterSpacing: 1 }}>VIEW DASHBOARD</button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

// ── Modal wrapper (kept for deep-intel prefill flow from scan results) ─────────
export default function SubmitModal({ onClose, onNewResult, onDeepIntel, submissionCounts = {}, theme = "dark", T = {} }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", backdropFilter: "blur(14px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-inner" style={{ width: "100%", maxWidth: 900, maxHeight: "92vh", overflowY: "auto", position: "relative" }}>
        <ScannerPanel onClose={onClose} onNewResult={onNewResult} onDeepIntel={onDeepIntel} submissionCounts={submissionCounts} theme={theme} T={T} />
      </div>
    </div>
  );
}
