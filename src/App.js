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
  async checkDuplicate(preview) {
    // Get recent submissions and check for similarity client-side
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/submissions?select=preview,score,tags,category,created_at&order=created_at.desc&limit=50`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      });
      const data = await res.json();
      if (!Array.isArray(data)) return null;
      const words = preview.toLowerCase().split(/s+/).filter(w => w.length > 5);
      for (const sub of data) {
        if (!sub.preview) continue;
        const subWords = sub.preview.toLowerCase().split(/s+/).filter(w => w.length > 5);
        const matches = words.filter(w => subWords.includes(w)).length;
        const similarity = words.length > 0 ? matches / words.length : 0;
        if (similarity > 0.5) return sub;
      }
    } catch {}
    return null;
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
  { id: "publishing", label: "Publishing & Literary", icon: "book", color: "#a78bfa", description: "Fake agents, vanity presses, contest mills" },
  { id: "delivery", label: "Package & Delivery", icon: "package", color: "#fb923c", description: "FedEx, UPS, USPS, DHL fake notices" },
  { id: "retail", label: "Retail & Shopping", icon: "cart", color: "#34d399", description: "Amazon, eBay, online store scams" },
  { id: "telecom", label: "Phone & Telecom", icon: "phone", color: "#38bdf8", description: "T-Mobile, Verizon, AT&T points/rewards scams" },
  { id: "traffic", label: "Traffic & Tolls", icon: "car", color: "#f43f5e", description: "Fake speeding tickets, toll violations, parking" },
  { id: "social", label: "Social Media", icon: "chat", color: "#e879f9", description: "Instagram, Facebook, TikTok, Twitter scams" },
  { id: "finance", label: "Banking & Finance", icon: "bank", color: "#facc15", description: "Bank alerts, crypto, investment scams" },
  { id: "government", label: "Government & IRS", icon: "gov", color: "#4ade80", description: "IRS, Social Security, Medicare, DMV" },
  { id: "prize", label: "Prize & Lottery", icon: "prize", color: "#fbbf24", description: "You've won!, sweepstakes, gift cards" },
  { id: "romance", label: "Romance & Friendship", icon: "heart", color: "#fb7185", description: "Dating app scams, fake relationships" },
  { id: "job", label: "Job & Employment", icon: "job", color: "#67e8f9", description: "Fake job offers, work from home, pyramid schemes" },
  { id: "tech", label: "Tech Support", icon: "tech", color: "#86efac", description: "Microsoft, Apple, virus alerts, fake support" },
  { id: "political", label: "Political Campaign", icon: "vote", color: "#f97316", description: "Fake fundraising, candidate impersonation, polling scams" },
  { id: "travel", label: "Travel & Vacation", icon: "plane", color: "#2dd4bf", description: "Fake hotels, airline scams, vacation rental fraud, bogus travel deals" },
  { id: "other", label: "Unknown / AI Detect", icon: "other", color: "#94a3b8", description: "Don't know the type? AI will automatically detect and classify your submission" },
];

const CAT_ICON_SVG = ({ icon, color, size = 22 }) => {
  const paths = {
    book: "M4 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm0 2v16h12V4H4zm2 3h8v2H6V7zm0 4h8v2H6v-2zm0 4h5v2H6v-2z",
    package: "M21 8l-9-5-9 5v8l9 5 9-5V8zm-9 3L5.5 8 12 4.5 18.5 8 12 11zm-7 1.97l6 3.33v5.97l-6-3.33v-5.97zm8 9.3v-5.97l6-3.33v5.97l-6 3.33z",
    cart: "M7 18c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm10 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zM5.2 4H2V2H0v2h2l3.6 7.6L4.2 14c-.2.3-.2.7 0 1 .2.3.5.5.8.5h14v-2H6l1-2h9.5c.5 0 1-.3 1.2-.8l3-5.5c.3-.5 0-1.2-.7-1.2H5.2z",
    phone: "M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C9.6 21 3 14.4 3 6c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z",
    car: "M18.9 6c-.2-.6-.8-1-1.4-1H6.5c-.6 0-1.2.4-1.4 1L3 12v8c0 .6.4 1 1 1h1c.6 0 1-.4 1-1v-1h12v1c0 .6.4 1 1 1h1c.6 0 1-.4 1-1v-8l-2.1-6zm-12.4 9c-.8 0-1.5-.7-1.5-1.5S5.7 12 6.5 12s1.5.7 1.5 1.5S7.3 15 6.5 15zm11 0c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5 1.5.7 1.5 1.5-.7 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z",
    chat: "M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z",
    bank: "M2 8v2h20V8L12 2 2 8zm10-4.3L18.8 8H5.2L12 3.7zM4 11v7H2v2h20v-2h-2v-7h-2v7h-3v-7h-2v7H9v-7H7v7H4v-7H2",
    gov: "M12 3L1 9v2h22V9L12 3zm-7 8v7H3v2h18v-2h-2v-7h-2v7h-3v-7h-2v7H8v-7H5zm7-4a1 1 0 1 1 0 2 1 1 0 0 1 0-2z",
    prize: "M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z",
    heart: "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z",
    job: "M20 6h-2.18c.07-.44.18-.88.18-1.35C18 2.99 16.01 1 13.65 1c-1.3 0-2.51.56-3.36 1.44L9 3.81l-1.29-1.37C6.86 1.56 5.65 1 4.35 1 1.99 1 0 2.99 0 5.35c0 .47.08.9.18 1.35H0v13c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z",
    tech: "M20 18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6zm8 9c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z",
    vote: "M18 3H6c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H6V5h12v14zm-7-2l-4-4 1.41-1.41L11 14.17l6.59-6.59L19 9l-8 8z",
    plane: "M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z",
    other: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"
  };
  const d = paths[icon] || paths.other;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ flexShrink: 0, opacity: 0.9 }}>
      <path d={d} />
    </svg>
  );
};

const VISIBILITY_OPTIONS = [
  {
    id: "public",
    label: "Public",
    icon: "[ PUB ]",
    color: "#34d399",
    short: "Full details visible to everyone",
    description: "Your submission including the message preview and sender source will be visible to all visitors. Helps the community identify and avoid this scam. Best for scams with no personal information."
  },
  {
    id: "private",
    label: "Private",
    icon: "[ PRI ]",
    color: "#38bdf8",
    short: "Score shown, details hidden",
    description: "Your score, category, and tags are shown in the community feed but the message preview and source are hidden. Your data is stored securely and used to improve detection. This is the default setting. Good for most submissions."
  },
  {
    id: "anonymous",
    label: "Anonymous",
    icon: "[ ANO ]",
    color: "#94a3b8",
    short: "Nothing stored, score only",
    description: "Only the score and category are shown. No message content, no source, nothing personal is stored after analysis. Appears as Anonymous in the feed. Use this for sensitive messages like romance scams or financial fraud."
  }
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

// Privacy masking helpers
function maskPhone(phone) {
  // Strip everything except digits and leading +
  const cleaned = phone.trim();
  const digits = cleaned.replace(/\D/g, "");
  if (digits.length < 4) return cleaned;
  // Keep everything except last 4 digits, replace those with ****
  const prefix = cleaned.slice(0, cleaned.length - 4).replace(/\d(?=.*\d{2})/g, (d, i) => d); // keep prefix as-is
  // Simpler: just replace last 4 characters that are digits
  let result = cleaned;
  let replaced = 0;
  for (let i = result.length - 1; i >= 0 && replaced < 4; i--) {
    if (/\d/.test(result[i])) {
      result = result.slice(0, i) + "*" + result.slice(i + 1);
      replaced++;
    }
  }
  return result;
}

function maskEmail(email) {
  const atIdx = email.indexOf("@");
  if (atIdx < 0) return email;
  const user = email.slice(0, atIdx);
  const domain = email.slice(atIdx); // includes @
  const len = user.length;
  let masked;
  if (len <= 3) {
    // Too short to mask: show as-is
    masked = user;
  } else if (len <= 6) {
    // 4-6 chars: show first + last, mask middle ~50%
    masked = user[0] + "*".repeat(len - 2) + user[len - 1];
  } else if (len <= 12) {
    // 7-12 chars: show first 2 + last 1, mask ~70%
    masked = user.slice(0, 2) + "*".repeat(len - 3) + user[len - 1];
  } else {
    // 13+ chars: show first 2 + last 1
    masked = user.slice(0, 2) + "*".repeat(Math.min(len - 3, 10)) + user[len - 1];
  }
  return masked + domain;
}

function maskName(name) {
  return name.trim().split(/\s+/).map(word => {
    if (word.length <= 1) return word;
    return word[0] + "*".repeat(Math.min(word.length - 1, 5));
  }).join(" ");
}

function isLikelyName(str) {
  const parts = str.trim().split(/\s+/);
  if (parts.length < 2) return false;
  if (/[\d@]/.test(str)) return false;
  if (str.includes(".com") || str.includes(".net") || str.includes(".org")) return false;
  return parts.every(p => p.length >= 2 && /^[A-Z]/.test(p));
}

function parseSingleSource(source) {
  if (!source || source === "user-submitted") return { label: "Anonymous", platform: null, flag: null };
  const cleanSource = source.trim().toLowerCase();
  const phonePatterns = [
    { regex: /^\+91|^0091/, country: "India", flag: "IN" },
    { regex: /^\+234|^00234/, country: "Nigeria", flag: "NG" },
    { regex: /^\+44|^0044/, country: "UK", flag: "GB" },
    { regex: /^\+1[2-9]/, country: "USA", flag: "US" },
    { regex: /^\+63|^0063/, country: "Philippines", flag: "PH" },
    { regex: /^\+86|^0086/, country: "China", flag: "CN" },
    { regex: /^\+7|^007/, country: "Russia", flag: "RU" },
    { regex: /^\+55|^0055/, country: "Brazil", flag: "BR" },
    { regex: /^\+\d{1,3}/, country: "Intl", flag: null },
  ];
  if (/^[\+\d\s\-\(\)]{7,}$/.test(source.trim())) {
    const masked = maskPhone(source.trim());
    for (const p of phonePatterns) {
      if (p.regex.test(source.trim())) {
        return { label: masked, platform: `${p.country} Phone`, flag: p.flag, type: "phone" };
      }
    }
    return { label: masked, platform: "Phone", flag: null, type: "phone" };
  }
  if (cleanSource.includes("@")) {
    const domain = cleanSource.split("@")[1] || "";
    const masked = maskEmail(source.trim());
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
      return { label: masked, platform: knownProviders[domain].name, platformColor: knownProviders[domain].color, flag: null, type: "email" };
    }
    const suspicious = ["amazon-", "apple-", "paypal-", "microsoft-", "google-", "irs-", "usps-", "fedex-", "ups-", "chase-", "wells-", "bank"];
    const isSuspicious = suspicious.some(s => domain.includes(s));
    return { label: masked, platform: isSuspicious ? "Fake Domain" : domain, flag: null, type: "email", suspicious: isSuspicious };
  }
  // Clean up URLs - extract just the domain
  if (source.trim().startsWith("http://") || source.trim().startsWith("https://")) {
    try {
      const url = new URL(source.trim());
      const cleanDomain = url.hostname.replace(/^www\./, "");
      const suspicious = ["amazon-", "apple-", "paypal-", "microsoft-", "google-", "irs-", "usps-", "fedex-", "ups-", "chase-", "wells-", "bank"];
      const isSuspicious = suspicious.some(s => cleanDomain.includes(s));
      return { label: cleanDomain, platform: isSuspicious ? "Fake Domain" : "URL", flag: null, type: "email", suspicious: isSuspicious };
    } catch {}
  }
  if (/^\d{5,6}$/.test(source.trim())) {
    return { label: source, platform: "SMS Shortcode", flag: null, type: "sms" };
  }
  if (isLikelyName(source.trim())) {
    return { label: maskName(source.trim()), platform: "Name", flag: null, type: "name" };
  }
  return { label: source, platform: null, flag: null, type: "text" };
}

// parseSource handles both single string and JSON array of sources
function parseSource(source) {
  if (!source || source === "user-submitted") return [{ label: "Anonymous", platform: null, flag: null }];
  try {
    const arr = JSON.parse(source);
    if (Array.isArray(arr)) return arr.map(s => parseSingleSource(s)).filter(p => p.label !== "Anonymous");
  } catch {}
  return [parseSingleSource(source)];
}

const FLAG_LABELS = { IN: "IN", PK: "PK", NG: "NG", GB: "UK", US: "US", PH: "PH", CN: "CN", RU: "RU", BR: "BR", ZA: "ZA", BD: "BD", ID: "ID" };

function SingleSourceBadge({ parsed }) {
  if (!parsed || parsed.label === "Anonymous") return null;
  const typeColor = parsed.suspicious ? "#f43f5e"
    : parsed.type === "phone" ? "#38bdf8"
    : parsed.type === "name" ? "#e879f9"
    : parsed.type === "sms" ? "#fbbf24"
    : parsed.platformColor || "#64748b";
  const typeBg = parsed.suspicious ? "#f43f5e18"
    : parsed.type === "phone" ? "#38bdf818"
    : parsed.type === "name" ? "#e879f918"
    : parsed.type === "sms" ? "#fbbf2418"
    : "#1a1d2e";
  const typeBorder = parsed.suspicious ? "#f43f5e35"
    : parsed.type === "phone" ? "#38bdf835"
    : parsed.type === "name" ? "#e879f935"
    : parsed.type === "sms" ? "#fbbf2435"
    : "#2a2d3e";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "nowrap" }}>
      <span style={{ fontSize: 11, color: "#475569", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>
        {parsed.label}
      </span>
      {parsed.platform && (
        <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 20, fontFamily: "monospace", letterSpacing: 1, background: typeBg, color: typeColor, border: `1px solid ${typeBorder}`, whiteSpace: "nowrap" }}>
          {parsed.flag ? `[${FLAG_LABELS[parsed.flag]}] ` : ""}{parsed.platform}
        </span>
      )}
    </div>
  );
}

function SourceBadge({ source }) {
  const parsed = parseSource(source);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {parsed.map((p, i) => <SingleSourceBadge key={i} parsed={p} />)}
    </div>
  );
}

function VisibilityBadge({ visibility }) {
  const v = VISIBILITY_OPTIONS.find(o => o.id === visibility) || VISIBILITY_OPTIONS[0];
  return (
    <span style={{
      fontSize: 9, padding: "2px 8px", borderRadius: 20, fontFamily: "monospace", letterSpacing: 1,
      color: v.color, border: `1px solid ${v.color}40`, background: `${v.color}12`
    }}>{v.label.toUpperCase()}</span>
  );
}

function ScoreRing({ score, size = 64, trackColor = "#1a1d2e" }) {
  const color = getScoreColor(score);
  const r = size * 0.37, circ = 2 * Math.PI * r, dash = (score / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={size * 0.1} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={size * 0.1}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)", filter: `drop-shadow(0 0 ${size * 0.06}px ${color}88)` }} />
      <text x={size / 2} y={size / 2 + size * 0.06} textAnchor="middle" fill={color}
        fontSize={size * 0.21} fontWeight="700" fontFamily="monospace">{score}</text>
    </svg>
  );
}

function Tooltip({ text, children }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative", display: "inline-block" }}
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
      onTouchStart={() => setShow(true)} onTouchEnd={() => setTimeout(() => setShow(false), 2000)}>
      {children}
      {show && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)",
          background: "#1a1d2e", border: "1px solid #2a2d3e", borderRadius: 8, padding: "10px 14px",
          width: 240, fontSize: 12, color: "#94a3b8", fontFamily: "Georgia, serif", lineHeight: 1.6,
          zIndex: 999, boxShadow: "0 8px 32px rgba(0,0,0,0.5)", pointerEvents: "none"
        }}>
          {text}
          <div style={{ position: "absolute", bottom: -5, left: "50%", transform: "translateX(-50%)", width: 8, height: 8, background: "#1a1d2e", border: "1px solid #2a2d3e", borderTop: "none", borderLeft: "none", transform: "translateX(-50%) rotate(45deg)" }} />
        </div>
      )}
    </div>
  );
}

function CategoryPicker({ selected, onSelect, submissionCounts = {} }) {
  const [showAll, setShowAll] = useState(false);

  // Build ordered list: Unknown/AI Detect first, then top 5 by submission count, then rest
  const otherCat = SCAM_CATEGORIES.find(c => c.id === "other");
  const restCats = SCAM_CATEGORIES.filter(c => c.id !== "other");
  const sorted = [...restCats].sort((a, b) => (submissionCounts[b.id] || 0) - (submissionCounts[a.id] || 0));
  const top5 = sorted.slice(0, 5);
  const remaining = sorted.slice(5);
  const visible = [otherCat, ...top5, ...(showAll ? remaining : [])];

  return (
    <div>
      <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 16px", fontFamily: "Georgia, serif" }}>
        Select the type that best matches - or pick <strong style={{ color: "#94a3b8" }}>Unknown / AI Detect</strong> and AI will automatically classify it.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8 }}>
        {visible.map(cat => {
          const active = selected === cat.id;
          return (
            <button key={cat.id} onClick={() => onSelect(cat.id)} style={{
              background: active ? `${cat.color}18` : "#0d0f1a",
              border: `1.5px solid ${active ? cat.color : "#1a1d2e"}`,
              borderRadius: 10, padding: "11px 10px", cursor: "pointer", textAlign: "left",
              transition: "all 0.15s", transform: active ? "scale(1.03)" : "scale(1)"
            }}>
              <div style={{ marginBottom: 6 }}><CAT_ICON_SVG icon={cat.icon} color={active ? "#ffffff" : "#64748b"} size={22} /></div>
              <div style={{ fontSize: 11, fontWeight: 700, color: active ? cat.color : "#64748b", fontFamily: "monospace", lineHeight: 1.3 }}>{cat.label}</div>
              {submissionCounts[cat.id] > 0 && <div style={{ fontSize: 9, color: "#334155", fontFamily: "monospace", marginTop: 3 }}>{submissionCounts[cat.id]} reports</div>}
            </button>
          );
        })}
      </div>
      {remaining.length > 0 && (
        <button onClick={() => setShowAll(v => !v)} style={{
          marginTop: 10, width: "100%", background: "none", border: "1px dashed #1a1d2e",
          color: "#475569", padding: "8px", borderRadius: 8, cursor: "pointer",
          fontFamily: "monospace", fontSize: 10, letterSpacing: 1, transition: "all 0.15s"
        }}>
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
              <button onClick={() => onSelect(opt.id)} style={{
                background: active ? `${opt.color}18` : "#0d0f1a",
                border: `1.5px solid ${active ? opt.color : "#1a1d2e"}`,
                borderRadius: 10, padding: "10px 16px", cursor: "pointer", textAlign: "left",
                transition: "all 0.15s", minWidth: 120
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: active ? opt.color : "#334155", fontFamily: "monospace", marginBottom: 4 }}>{opt.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: active ? opt.color : "#64748b", fontFamily: "monospace", marginBottom: 3 }}>{opt.label}</div>
                <div style={{ fontSize: 10, color: active ? `${opt.color}cc` : "#334155", fontFamily: "Georgia, serif", lineHeight: 1.3 }}>{opt.short}</div>
              </button>
            </Tooltip>
          );
        })}
      </div>
      <div style={{ fontSize: 10, color: "#334155", fontFamily: "monospace", marginTop: 8 }}>Hover or tap each option for details</div>
    </div>
  );
}

function ConfidenceMeter({ text, source }) {
  let score = 0;
  let tips = [];
  if (text.trim().length > 20) { score += 30; } else { tips.push("Add more message text"); }
  if (text.trim().length > 150) { score += 15; }
  if (source && source.trim().length > 3) { score += 25; } else { tips.push("Add sender address or phone number"); }
  const hasEmail = /@/.test(text + source);
  const hasPhone = (text + source).split("").filter(c => c >= "0" && c <= "9").length >= 7;
  if (hasEmail || hasPhone) { score += 15; }
  const hasHeaders = /received:|message-id:|dkim-signature:|x-mailer:/i.test(text);
  if (hasHeaders) { score += 15; } else if (text.length > 100) { tips.push("Paste email headers for deepest analysis"); }
  score = Math.min(score, 100);
  const barColor = score >= 80 ? "#34d399" : score >= 50 ? "#fb923c" : "#f43f5e";
  const label = score >= 80 ? "Strong submission" : score >= 50 ? "Good submission" : "Basic submission";
  return (
    <div style={{ marginTop: 8, marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 10, color: "#475569", fontFamily: "monospace", letterSpacing: 1 }}>SUBMISSION QUALITY</span>
        <span style={{ fontSize: 10, color: barColor, fontFamily: "monospace", fontWeight: 700 }}>{score}% - {label}</span>
      </div>
      <div style={{ background: "#1a1d2e", borderRadius: 4, height: 5, overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: 4, background: barColor, width: `${score}%`, transition: "width 0.4s ease", boxShadow: `0 0 6px ${barColor}88` }} />
      </div>
      {tips.length > 0 && (
        <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {tips.map((t, i) => (
            <span key={i} style={{ fontSize: 9, color: "#475569", fontFamily: "monospace", background: "#1a1d2e", padding: "2px 8px", borderRadius: 10 }}>+ {t}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function SubmitModal({ onClose, onNewResult, submissionCounts = {} }) {
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
  const fileRef = useRef();
  const cat = getCat(category);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setImage(ev.target.result); setImagePreview(ev.target.result); };
    reader.readAsDataURL(file);
  };

  const analyze = async () => {
    if (inputMode === "text" && !text.trim()) return;
    if (inputMode === "image" && !image) return;
    // Check for duplicates on text submissions
    if (inputMode === "text" && text.trim().length > 30) {
      const dup = await db.checkDuplicate(text.slice(0, 130));
      if (dup) { setDuplicate(dup); }
    }
    setLoading(true);
    try {
      let messages;
      if (inputMode === "image" && image) {
        const base64 = image.split(",")[1];
        const mimeType = image.split(";")[0].split(":")[1];
        messages = [{ role: "user", content: [
          { type: "image", source: { type: "base64", media_type: mimeType, data: base64 } },
          { type: "text", text: `You are PhishScore.ai. Analyze this screenshot for scam indicators.\nUser selected category: "${cat.label}" (id: "${category}") - ${cat.description}\n\nIMPORTANT TASKS:\n1. Extract ALL identifiable sources visible in the image (phone numbers, emails, names, usernames, domains, handles).\n2. If the user selected "other", determine the best category from: publishing, delivery, retail, telecom, traffic, social, finance, government, prize, romance, job, tech, political, other. Return it in detectedCategory if 70%+ confident, else null.\n3. If the user selected a specific category but the content clearly belongs to a DIFFERENT category with 85%+ confidence, return the correct category in detectedCategory and set categoryReclassified to true.\n\nRespond ONLY with valid JSON (no markdown):\n{"score":<0-100>,"tags":[<2-4 labels>],"verdict":"<one sentence>","analysis":"<2-3 sentences>","redFlags":[<up to 5>],"whatToDo":"<one action>","detectedSources":["<source1>","...all visible identifiers, empty array if none"],"detectedCategory":<best category id string or null>,"categoryReclassified":<true if user category was wrong, false otherwise>}` }
        ]}];
      } else {
        messages = [{ role: "user", content: `You are PhishScore.ai. Analyze this message for scam indicators.\nUser selected category: "${cat.label}" (id: "${category}") - ${cat.description}\n\nIMPORTANT TASKS:\n1. Extract ALL identifiable sources in the message (phone numbers, email addresses, names, usernames, domains).\n2. If the user selected "other", determine the best category from: publishing, delivery, retail, telecom, traffic, social, finance, government, prize, romance, job, tech, political, other. Return it in detectedCategory if 70%+ confident, else null.\n3. If the user selected a specific category but the content clearly belongs to a DIFFERENT category with 85%+ confidence, return the correct category in detectedCategory and set categoryReclassified to true.\n\nRespond ONLY with valid JSON (no markdown):\n{"score":<0-100>,"tags":[<2-4 labels>],"verdict":"<one sentence>","analysis":"<2-3 sentences>","redFlags":[<up to 5>],"whatToDo":"<one action>","detectedSources":["<source1>","...all visible identifiers, empty array if none"],"detectedCategory":<best category id string or null>,"categoryReclassified":<true if user category was wrong, false otherwise>}\n\nMessage:\n${text}` }];
      }
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, messages })
      });
      const data = await res.json();
      const raw = data.content?.map(c => c.text || "").join("") || "";
      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
      // Determine final category - use AI detected if user picked other OR if reclassified
      let finalCategory = category;
      let classificationNote = null;
      if (parsed.detectedCategory && parsed.detectedCategory !== category) {
        if (category === "other") {
          finalCategory = parsed.detectedCategory;
          classificationNote = "auto";
        } else if (parsed.categoryReclassified === true) {
          finalCategory = parsed.detectedCategory;
          classificationNote = "reclassified";
        }
      }
      parsed.finalCategory = finalCategory;
      parsed.classificationNote = classificationNote;
      setResult(parsed);
      // Combine user-entered source with AI-detected sources
      let allSources = [];
      if (source.trim()) allSources.push(source.trim());
      if (Array.isArray(parsed.detectedSources)) {
        parsed.detectedSources.forEach(s => { if (s && s.trim() && !allSources.includes(s.trim())) allSources.push(s.trim()); });
      } else if (parsed.detectedSource && parsed.detectedSource.trim()) {
        allSources.push(parsed.detectedSource.trim());
      }
      const finalSource = allSources.length > 0 ? JSON.stringify(allSources.slice(0, 3)) : "user-submitted";
      onNewResult({ category: finalCategory, text: inputMode === "image" ? "[Screenshot submitted]" : text, result: parsed, source: finalSource, visibility, classificationNote: parsed.classificationNote });
      setStep(3);
    } catch {
      setResult({ score: 0, tags: ["Error"], verdict: "Analysis failed.", analysis: "Please try again.", redFlags: [], whatToDo: "Try submitting again." });
      setStep(3);
    }
    setLoading(false);
  };

  const sc = result ? getScoreColor(result.score) : "#fff";
  const canAnalyze = inputMode === "text" ? text.trim().length > 0 : image !== null;
  const visOpt = VISIBILITY_OPTIONS.find(o => o.id === visibility);

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
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              {["Choose Type", "Submit", "Your Score"].map((s, i) => (
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
            <CategoryPicker selected={category} onSelect={setCategory} submissionCounts={submissionCounts} />
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid #1a1d2e" }}>
              <VisibilityPicker selected={visibility} onSelect={setVisibility} />
            </div>
            <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => setStep(2)} style={{ background: "linear-gradient(135deg,#f43f5e,#be123c)", border: "none", color: "#fff", padding: "12px 28px", borderRadius: 10, fontSize: 12, fontWeight: 700, letterSpacing: 2, cursor: "pointer", fontFamily: "monospace", boxShadow: "0 4px 20px rgba(244,63,94,0.35)" }}>NEXT</button>
            </div>
          </>
        )}

        {step === 2 && (
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
              <button onClick={() => setInputMode("text")} style={{ flex: 1, padding: "10px", borderRadius: 8, border: `1.5px solid ${inputMode === "text" ? "#f43f5e" : "#1a1d2e"}`, background: inputMode === "text" ? "#f43f5e18" : "#0d0f1a", color: inputMode === "text" ? "#f43f5e" : "#475569", fontFamily: "monospace", fontSize: 11, fontWeight: 700, cursor: "pointer", letterSpacing: 1 }}>PASTE TEXT</button>
              <button onClick={() => setInputMode("image")} style={{ flex: 1, padding: "10px", borderRadius: 8, border: `1.5px solid ${inputMode === "image" ? "#f43f5e" : "#1a1d2e"}`, background: inputMode === "image" ? "#f43f5e18" : "#0d0f1a", color: inputMode === "image" ? "#f43f5e" : "#475569", fontFamily: "monospace", fontSize: 11, fontWeight: 700, cursor: "pointer", letterSpacing: 1 }}>UPLOAD SCREENSHOT</button>
            </div>

            {inputMode === "text" ? (
              <>
                <textarea value={text} onChange={e => {
                  setText(e.target.value);
                  // Auto-enrich: extract sender email if source is empty
                  if (!source.trim()) {
                    const t = e.target.value;
                    const atIdx = t.indexOf("@");
                    if (atIdx > 0) {
                      const start = t.slice(0, atIdx).replace(/.*\s/, "");
                      const end = t.slice(atIdx + 1).replace(/\s.*/, "");
                      if (start && end && end.includes(".")) {
                        setSource(start + "@" + end.split(".").slice(0, 2).join("."));
                      }
                    }
                  }
                }}
                  placeholder="Paste the full suspicious message here. Include sender address, subject line, and all body text for best results."
                  style={{ width: "100%", minHeight: 180, background: "#0d0f1a", border: "1.5px solid #1a1d2e", borderRadius: 10, color: "#e2e8f0", padding: 16, fontSize: 13, fontFamily: "Georgia, serif", resize: "vertical", outline: "none", boxSizing: "border-box", lineHeight: 1.7 }}
                  onFocus={e => e.target.style.borderColor = "#f43f5e55"}
                  onBlur={e => e.target.style.borderColor = "#1a1d2e"} />
                <ConfidenceMeter text={text} source={source} />
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

            {visibility !== "anonymous" && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: "#334155", fontFamily: "monospace", letterSpacing: 2, marginBottom: 6 }}>SENDER / SOURCE (optional)</div>
                <input value={source} onChange={e => setSource(e.target.value)}
                  placeholder="e.g. scammer@gmail.com or +91 98765 43210 or unknown"
                  style={{ width: "100%", background: "#0d0f1a", border: "1.5px solid #1a1d2e", borderRadius: 8, color: "#e2e8f0", padding: "10px 14px", fontSize: 12, fontFamily: "monospace", outline: "none", boxSizing: "border-box" }}
                  onFocus={e => e.target.style.borderColor = "#f43f5e55"}
                  onBlur={e => e.target.style.borderColor = "#1a1d2e"} />
                <div style={{ fontSize: 10, color: "#1e2030", fontFamily: "monospace", marginTop: 4 }}>Helps identify scam origins for the community</div>
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
                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
                  {result.tags?.map(t => <span key={t} style={{ background: "#1a1d2e", color: "#64748b", fontSize: 10, padding: "3px 9px", borderRadius: 20, fontFamily: "monospace" }}>{t}</span>)}
                  <VisibilityBadge visibility={visibility} />
                  {result.classificationNote === "auto" && (
                    <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 20, fontFamily: "monospace", letterSpacing: 1, color: "#a78bfa", border: "1px solid #a78bfa40", background: "#a78bfa12" }}>AUTO-CLASSIFIED</span>
                  )}
                  {result.classificationNote === "reclassified" && (
                    <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 20, fontFamily: "monospace", letterSpacing: 1, color: "#f97316", border: "1px solid #f9731640", background: "#f9731612" }}>RECLASSIFIED</span>
                  )}
                </div>
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ fontSize: 10, letterSpacing: 3, color: "#334155", fontFamily: "monospace" }}>ANALYSIS</div>
                {result.safeBrowsingFlagged && (
                  <span style={{ fontSize: 9, color: "#f43f5e", fontFamily: "monospace", background: "#f43f5e12", border: "1px solid #f43f5e35", padding: "2px 8px", borderRadius: 20, letterSpacing: 1 }}>GOOGLE SAFE BROWSING: FLAGGED</span>
                )}
              </div>
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
            <div style={{ background: "#081410", border: "1px solid #34d39925", borderRadius: 10, padding: 16, marginBottom: result.score >= 75 ? 12 : 20 }}>
              <div style={{ fontSize: 10, letterSpacing: 3, color: "#34d399", fontFamily: "monospace", marginBottom: 8 }}>WHAT TO DO</div>
              <p style={{ color: "#86efac", fontSize: 13, margin: 0, fontFamily: "Georgia, serif", lineHeight: 1.6 }}>{result.whatToDo}</p>
            </div>
            {result.score >= 75 && (
              <a href="https://reportfraud.ftc.gov/#/" target="_blank" rel="noopener noreferrer" style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                background: "#0d0a00", border: "1px solid #fbbf2440", borderRadius: 10,
                padding: "12px 16px", marginBottom: 20, textDecoration: "none",
                color: "#fbbf24", fontSize: 11, fontFamily: "monospace", letterSpacing: 1, fontWeight: 700,
                transition: "all 0.15s"
              }}
              onMouseEnter={e => e.currentTarget.style.background = "#1a1400"}
              onMouseLeave={e => e.currentTarget.style.background = "#0d0a00"}>
                <CAT_ICON_SVG icon="gov" color="#fbbf24" size={14} />
                REPORT THIS SCAM TO THE FTC
              </a>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <ShareCard result={result} category={result.finalCategory || category} />
              <AccuracyFeedback />
              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <button onClick={() => { setStep(1); setResult(null); setText(""); setSource(""); setCategory("other"); setVisibility("private"); setImage(null); setImagePreview(null); }} style={{ flex: 1, background: "#1a1d2e", border: "none", color: "#64748b", padding: "12px", borderRadius: 10, fontSize: 11, cursor: "pointer", fontFamily: "monospace", letterSpacing: 1 }}>CHECK ANOTHER</button>
                <button onClick={onClose} style={{ flex: 1, background: "linear-gradient(135deg,#f43f5e,#be123c)", border: "none", color: "#fff", padding: "12px", borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "monospace", letterSpacing: 1 }}>VIEW DASHBOARD</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ShareCard({ result, category }) {
  const [copied, setCopied] = useState(false);
  const cat = getCat(category);
  const sc = getScoreColor(result.score);
  const shareText = `I just checked a suspicious message on PhishScore.ai\n\nScore: ${result.score}/100 - ${getStatusLabel(result.score)}\nCategory: ${cat.label}\nVerdict: ${result.verdict}\n\nTop red flags:\n${(result.redFlags || []).slice(0, 3).map(f => "- " + f).join("\n")}\n\nCheck suspicious messages yourself at phishscore.ai`;
  const handleCopy = () => {
    navigator.clipboard.writeText(shareText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = shareText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };
  const twitterText = encodeURIComponent(`Scam alert! This message scored ${result.score}/100 on PhishScore.ai\n\n${result.verdict}\n\nCheck suspicious messages: phishscore.ai`);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, letterSpacing: 3, color: "#334155", fontFamily: "monospace", marginBottom: 8 }}>SHARE THIS WARNING</div>
      <div style={{ background: "#090b14", border: `1px solid ${sc}30`, borderRadius: 12, padding: 16, marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", border: `3px solid ${sc}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: sc, fontFamily: "monospace" }}>{result.score}</span>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: sc, fontFamily: "monospace" }}>{getStatusLabel(result.score)}</div>
            <div style={{ fontSize: 10, color: "#475569", fontFamily: "monospace" }}>{cat.label} - phishscore.ai</div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: "#64748b", fontFamily: "Georgia, serif", lineHeight: 1.5, fontStyle: "italic" }}>"{result.verdict}"</div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={handleCopy} style={{ flex: 1, background: copied ? "#081410" : "#1a1d2e", border: `1px solid ${copied ? "#34d399" : "#2a2d3e"}`, color: copied ? "#34d399" : "#64748b", padding: "9px 12px", borderRadius: 8, fontSize: 10, cursor: "pointer", fontFamily: "monospace", letterSpacing: 1, transition: "all 0.2s" }}>
          {copied ? "COPIED!" : "COPY TEXT"}
        </button>
        <a href={`https://twitter.com/intent/tweet?text=${twitterText}`} target="_blank" rel="noopener noreferrer"
          style={{ flex: 1, background: "#0a0f1a", border: "1px solid #1d9bf040", color: "#1d9bf0", padding: "9px 12px", borderRadius: 8, fontSize: 10, cursor: "pointer", fontFamily: "monospace", letterSpacing: 1, textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
          POST TO X
        </a>
      </div>
    </div>
  );
}

function AccuracyFeedback() {
  const [feedback, setFeedback] = useState(null);
  if (feedback) {
    return (
      <div style={{ padding: "10px 14px", background: "#081410", border: "1px solid #34d39925", borderRadius: 10, textAlign: "center" }}>
        <span style={{ fontSize: 12, color: "#34d399", fontFamily: "monospace" }}>Thanks for the feedback! It helps us improve.</span>
      </div>
    );
  }
  return (
    <div style={{ padding: "10px 14px", background: "#0d0f1a", border: "1px solid #1a1d2e", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
      <span style={{ fontSize: 11, color: "#475569", fontFamily: "monospace" }}>Was this result accurate?</span>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => setFeedback("yes")} style={{ background: "#081410", border: "1px solid #34d39940", color: "#34d399", padding: "6px 16px", borderRadius: 8, fontSize: 11, cursor: "pointer", fontFamily: "monospace", letterSpacing: 1 }}>YES</button>
        <button onClick={() => setFeedback("no")} style={{ background: "#160810", border: "1px solid #f43f5e40", color: "#f43f5e", padding: "6px 16px", borderRadius: 8, fontSize: 11, cursor: "pointer", fontFamily: "monospace", letterSpacing: 1 }}>NO</button>
      </div>
    </div>
  );
}

// -- FAQ PAGE ------------------------------------------------------------------
function FAQPage({ onClose }) {
  const faqs = [
    {
      q: "What is PhishScore.ai?",
      a: "PhishScore.ai is a free community-powered scam detection tool. Paste or screenshot any suspicious message - email, text, social media DM, or letter - and our AI instantly scores the likelihood it is a scam from 0 to 100, explains why, and tells you what to do."
    },
    {
      q: "What types of scams can I submit?",
      a: "Any suspicious communication: publishing scams (fake literary agents, vanity presses), delivery scams (fake USPS/FedEx texts), retail scams (fake Amazon alerts), phone carrier scams (fake rewards texts), traffic and toll notices, social media phishing, banking alerts, IRS impersonation, prize and lottery fraud, romance scams, fake job offers, tech support scams, and political campaign scams (fake fundraising, candidate impersonation, polling fraud). Not sure what type? Select Other / Not Sure and the AI will figure out the category automatically."
    },
    {
      q: "What happens when I select Other / Not Sure?",
      a: "Selecting Other / Not Sure tells the AI to determine the category itself. After analyzing the message, if the AI is 70% or more confident, it automatically assigns the most likely category such as Retail, Delivery, or Publishing. The submission appears in the dashboard under that detected category with a small AUTO label. If the AI is not confident enough, the submission stays listed under Other. Additionally, even if you select a specific category, if the AI is 85% or more confident the content actually belongs to a different category, it will automatically reclassify it and show a RECLASSIFIED label so you always know when this happens."
    },
    {
      q: "What is the difference between Public, Private, and Anonymous?",
      a: "Private is the default and recommended setting - your score and category appear in the community feed but message content and sender are never shown publicly. Public submissions share full details to help the community and are best when your message contains no personal info. Anonymous submissions store nothing after analysis - only score and category briefly appear in the feed."
    },
    {
      q: "How do I submit for the best results?",
      a: "The more information you include, the better the score. Include the full message text, the sender email or phone number, and the subject line if it is an email. For texts, include the full phone number. For emails, including the email headers (see below) gives the most accurate analysis."
    },
    {
      q: "What are email headers and how do I find them?",
      a: "Email headers are hidden technical data that show the true origin of an email, even if the sender name looks legitimate. In Gmail: open the email, click the three dots menu, click Show original. In Apple Mail: open the email, go to View menu, then Message, then All Headers. In Outlook: open the email, click File, then Properties. Copy all of that text and paste it into PhishScore along with the message body for the most accurate analysis."
    },
    {
      q: "Why should I include the sender address?",
      a: "Scammers often disguise their real email address. The display name might say Apple Support but the actual address is random-letters@suspicious-domain.net. Including the full sender address helps our AI spot spoofed domains, lookalike addresses, and known scam infrastructure. It also helps the community by showing where scams are originating from geographically."
    },
    {
      q: "Can I upload a screenshot instead of typing?",
      a: "Yes. Use the Upload Screenshot option in the submission flow. Our AI will read all visible text in the image including sender information, logos, links, and message content. This is especially useful for text message scams that are easier to screenshot than type out."
    },
    {
      q: "Is my data safe?",
      a: "Public and Private submissions store the message content and source in our database to power the community dashboard. Anonymous submissions store nothing after analysis. We never sell data or share it with third parties. If you accidentally submitted something with personal information, use the Private or Anonymous options in future, or contact us at contact@phishscore.ai to request removal."
    },
    {
      q: "What does the score mean?",
      a: "The score is the AI's estimated probability that the message is a scam, from 0 to 100. A score of 75 or above is flagged as SCAM. Between 45 and 74 is SUSPICIOUS and worth treating with caution. Below 45 is LIKELY SAFE, though no automated tool is perfect and you should always trust your instincts."
    },
    {
      q: "What external databases does PhishScore use?",
      a: "PhishScore checks submitted URLs against three independent threat intelligence databases in addition to AI analysis. Google Safe Browsing is maintained by Google and protects billions of Chrome users - it checks URLs against known phishing, malware, and social engineering sites in real time. Cloudflare Radar uses intelligence from Cloudflare's global network which processes a significant portion of internet traffic, catching threats based on actual traffic patterns not just reported URLs. URLhaus is operated by abuse.ch, a non-profit Swiss security research organization, and tracks active malware distribution URLs and botnet command servers. When any of these databases flag a URL in your submission, the score is automatically adjusted and the source is shown in your result so you know exactly where the intelligence came from."
    },
    {
      q: "Why does the community feed only show a limited number of submissions?",
      a: "The default dashboard view shows the 15 most recent community submissions to keep the feed fast and focused. When you filter by a specific category such as Publishing or Retail, the feed shows the top 10 most recent submissions in that category. This keeps load times fast as the database grows and ensures you are always seeing the most relevant and recent intelligence."
    },
    {
      q: "Can I report a scam that already happened to me?",
      a: "Yes. Submit the original message even if you already fell for it. Your submission helps others recognize the same scam and may help identify patterns. For financial fraud, also report to the FTC at reportfraud.ftc.gov, the FBI at ic3.gov, and your bank immediately."
    },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", backdropFilter: "blur(14px)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, overflowY: "auto" }}>
      <div style={{ background: "#090b14", border: "1px solid #1a1d2e", borderRadius: 20, width: "100%", maxWidth: 700, padding: 40, position: "relative", margin: "20px 0" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, background: "#1a1d2e", border: "none", color: "#475569", width: 32, height: 32, borderRadius: "50%", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>x</button>

        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 10, letterSpacing: 4, color: "#f43f5e", fontFamily: "monospace", marginBottom: 10 }}>HELP CENTER</div>
          <h1 style={{ color: "#fff", fontFamily: "monospace", fontSize: 24, fontWeight: 800, margin: "0 0 8px", letterSpacing: 1 }}>
            <span style={{ color: "#fff" }}>PHISH</span><span style={{ color: "#f43f5e" }}>SCORE</span><span style={{ color: "#334155" }}>.ai</span> FAQ
          </h1>
          <p style={{ color: "#64748b", fontFamily: "Georgia, serif", fontSize: 14, lineHeight: 1.7, margin: 0 }}>
            Everything you need to know about submitting scams, protecting your privacy, and getting the most accurate results.
          </p>
        </div>

        {/* Best practices highlight box */}
        <div style={{ background: "#0d1a12", border: "1px solid #34d39930", borderRadius: 12, padding: 20, marginBottom: 32 }}>
          <div style={{ fontSize: 10, letterSpacing: 3, color: "#34d399", fontFamily: "monospace", marginBottom: 12 }}>TIPS FOR BEST RESULTS</div>
          {[
            "Include the full sender address, not just the display name",
            "For emails, paste the email headers for deepest analysis",
            "Include the complete message - subject, body, any links",
            "For texts, include the full phone number with country code",
            "Submissions default to Private to protect your privacy",
            "Not sure of the type? Select Other and AI will auto-classify it",
          ].map((tip, i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: i < 5 ? 8 : 0 }}>
              <span style={{ color: "#34d399", flexShrink: 0, fontFamily: "monospace" }}>0{i + 1}</span>
              <span style={{ color: "#86efac", fontSize: 13, fontFamily: "Georgia, serif", lineHeight: 1.5 }}>{tip}</span>
            </div>
          ))}
        </div>

        {/* Email headers guide */}
        <div style={{ background: "#0a0f1a", border: "1px solid #38bdf830", borderRadius: 12, padding: 20, marginBottom: 32 }}>
          <div style={{ fontSize: 10, letterSpacing: 3, color: "#38bdf8", fontFamily: "monospace", marginBottom: 12 }}>HOW TO FIND EMAIL HEADERS</div>
          {[
            { client: "Gmail", steps: "Open email > Three dots menu (...) > Show original > Copy all" },
            { client: "Apple Mail", steps: "Open email > View menu > Message > All Headers > Copy all" },
            { client: "Outlook", steps: "Open email > File > Properties > Internet headers box > Copy all" },
            { client: "Yahoo Mail", steps: "Open email > Three dots menu > View raw message > Copy all" },
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", gap: 12, marginBottom: i < 3 ? 10 : 0, alignItems: "flex-start" }}>
              <span style={{ fontSize: 10, color: "#38bdf8", fontFamily: "monospace", fontWeight: 700, whiteSpace: "nowrap", minWidth: 80 }}>{item.client}</span>
              <span style={{ color: "#7dd3fc", fontSize: 12, fontFamily: "Georgia, serif", lineHeight: 1.5 }}>{item.steps}</span>
            </div>
          ))}
        </div>

        {/* FAQ items */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {faqs.map((faq, i) => (
            <FAQItem key={i} q={faq.q} a={faq.a} />
          ))}
        </div>

        <div style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid #1a1d2e", textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "#475569", fontFamily: "monospace", marginBottom: 8 }}>STILL HAVE QUESTIONS?</div>
          <a href="mailto:contact@phishscore.ai" style={{ color: "#f43f5e", fontFamily: "monospace", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>contact@phishscore.ai</a>
        </div>
      </div>
    </div>
  );
}

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: "#0d0f1a", border: "1px solid #1a1d2e", borderRadius: 10, overflow: "hidden" }}>
      <button onClick={() => setOpen(!open)} style={{ width: "100%", padding: "14px 18px", background: "none", border: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#cbd5e1", fontFamily: "monospace", textAlign: "left", lineHeight: 1.4 }}>{q}</span>
        <span style={{ color: "#f43f5e", fontSize: 16, flexShrink: 0, fontFamily: "monospace", transform: open ? "rotate(45deg)" : "rotate(0)", transition: "transform 0.2s" }}>+</span>
      </button>
      {open && (
        <div style={{ padding: "0 18px 16px", color: "#94a3b8", fontSize: 13, fontFamily: "Georgia, serif", lineHeight: 1.8, borderTop: "1px solid #1a1d2e" }}>
          <div style={{ paddingTop: 14 }}>{a}</div>
        </div>
      )}
    </div>
  );
}

function TransparencyPage({ onClose, submissions }) {
  const total = submissions.length;
  const scams = submissions.filter(s => s.score >= 75).length;
  const suspicious = submissions.filter(s => s.score >= 45 && s.score < 75).length;
  const safe = submissions.filter(s => s.score < 45).length;
  const scamRate = total > 0 ? Math.round(scams / total * 100) : 0;
  const pubCount = submissions.filter(s => s.visibility === "public").length;
  const privCount = submissions.filter(s => s.visibility === "private").length;
  const anonCount = submissions.filter(s => s.visibility === "anonymous").length;
  const autoCount = submissions.filter(s => s.classification_note === "auto").length;
  const reclassCount = submissions.filter(s => s.classification_note === "reclassified").length;
  const catBreakdown = SCAM_CATEGORIES.filter(c => c.id !== "other").map(cat => ({
    ...cat, count: submissions.filter(s => s.category === cat.id).length
  })).filter(c => c.count > 0).sort((a, b) => b.count - a.count);
  const now = new Date();
  const month = now.toLocaleString("default", { month: "long", year: "numeric" });
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", backdropFilter: "blur(14px)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 300, padding: 16, overflowY: "auto" }}>
      <div style={{ background: "#090b14", border: "1px solid #1a1d2e", borderRadius: 20, width: "100%", maxWidth: 680, padding: 40, position: "relative", margin: "20px 0" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, background: "#1a1d2e", border: "none", color: "#475569", width: 32, height: 32, borderRadius: "50%", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>x</button>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 10, letterSpacing: 4, color: "#f43f5e", fontFamily: "monospace", marginBottom: 10 }}>TRANSPARENCY REPORT</div>
          <h1 style={{ color: "#fff", fontFamily: "monospace", fontSize: 22, fontWeight: 800, margin: "0 0 6px", letterSpacing: 1 }}>
            <span style={{ color: "#fff" }}>PHISH</span><span style={{ color: "#f43f5e" }}>SCORE</span><span style={{ color: "#334155" }}>.ai</span>
          </h1>
          <p style={{ color: "#475569", fontFamily: "monospace", fontSize: 11, margin: 0 }}>Live data as of {month}. Updated in real time.</p>
        </div>

        {/* Key stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 24 }}>
          {[
            { label: "TOTAL REPORTS", value: total, color: "#5b6cf8" },
            { label: "CONFIRMED SCAMS", value: scams, color: "#f43f5e" },
            { label: "SCAM RATE", value: scamRate + "%", color: "#fb923c" },
            { label: "LIKELY SAFE", value: safe, color: "#34d399" },
          ].map(s => (
            <div key={s.label} style={{ background: "#0d0f1a", border: "1px solid #1a1d2e", borderRadius: 10, padding: "14px 16px", borderTop: "2px solid " + s.color }}>
              <div style={{ fontSize: 9, color: "#475569", letterSpacing: 2, fontFamily: "monospace", marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: s.color, fontFamily: "monospace" }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Privacy breakdown */}
        <div style={{ background: "#0d0f1a", border: "1px solid #1a1d2e", borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 10, letterSpacing: 3, color: "#475569", fontFamily: "monospace", marginBottom: 14 }}>SUBMISSION PRIVACY BREAKDOWN</div>
          {[
            { label: "Public", value: pubCount, color: "#34d399", note: "Full details visible" },
            { label: "Private", value: privCount, color: "#38bdf8", note: "Score and category only" },
            { label: "Anonymous", value: anonCount, color: "#94a3b8", note: "Nothing stored" },
          ].map(v => (
            <div key={v.label} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <div style={{ width: 60, fontSize: 10, color: v.color, fontFamily: "monospace", fontWeight: 700 }}>{v.label}</div>
              <div style={{ flex: 1, background: "#1a1d2e", borderRadius: 3, height: 5 }}>
                <div style={{ height: "100%", borderRadius: 3, background: v.color, width: total > 0 ? `${Math.round(v.value / total * 100)}%` : "0%" }} />
              </div>
              <div style={{ fontSize: 10, color: v.color, fontFamily: "monospace", width: 30, textAlign: "right" }}>{v.value}</div>
              <div style={{ fontSize: 10, color: "#334155", fontFamily: "Georgia, serif", minWidth: 120 }}>{v.note}</div>
            </div>
          ))}
        </div>

        {/* AI Classification */}
        <div style={{ background: "#0d0f1a", border: "1px solid #1a1d2e", borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 10, letterSpacing: 3, color: "#475569", fontFamily: "monospace", marginBottom: 14 }}>AI CLASSIFICATION ACTIVITY</div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 120 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#a78bfa", fontFamily: "monospace" }}>{autoCount}</div>
              <div style={{ fontSize: 10, color: "#475569", fontFamily: "monospace", letterSpacing: 1 }}>AUTO-CLASSIFIED</div>
              <div style={{ fontSize: 11, color: "#64748b", fontFamily: "Georgia, serif", marginTop: 4 }}>Submitted as Unknown, AI detected correct category</div>
            </div>
            <div style={{ flex: 1, minWidth: 120 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#f97316", fontFamily: "monospace" }}>{reclassCount}</div>
              <div style={{ fontSize: 10, color: "#475569", fontFamily: "monospace", letterSpacing: 1 }}>RECLASSIFIED</div>
              <div style={{ fontSize: 11, color: "#64748b", fontFamily: "Georgia, serif", marginTop: 4 }}>User picked wrong category, AI corrected it</div>
            </div>
          </div>
        </div>

        {/* Top categories */}
        {catBreakdown.length > 0 && (
          <div style={{ background: "#0d0f1a", border: "1px solid #1a1d2e", borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 10, letterSpacing: 3, color: "#475569", fontFamily: "monospace", marginBottom: 14 }}>TOP SCAM CATEGORIES REPORTED</div>
            {catBreakdown.slice(0, 6).map((cat, i) => (
              <div key={cat.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: "#334155", fontFamily: "monospace", width: 16 }}>{i + 1}</div>
                <CAT_ICON_SVG icon={cat.icon} color={cat.color} size={14} />
                <div style={{ flex: 1, fontSize: 12, color: "#94a3b8", fontFamily: "monospace" }}>{cat.label}</div>
                <div style={{ background: "#1a1d2e", borderRadius: 3, height: 5, width: 80 }}>
                  <div style={{ height: "100%", borderRadius: 3, background: cat.color, width: `${Math.round(cat.count / catBreakdown[0].count * 100)}%` }} />
                </div>
                <div style={{ fontSize: 11, color: cat.color, fontFamily: "monospace", width: 24, textAlign: "right" }}>{cat.count}</div>
              </div>
            ))}
          </div>
        )}

        {/* Our commitment */}
        <div style={{ background: "#0a0f1a", border: "1px solid #38bdf830", borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 10, letterSpacing: 3, color: "#38bdf8", fontFamily: "monospace", marginBottom: 12 }}>OUR COMMITMENT TO YOU</div>
          {[
            "We never sell your data or share it with advertisers",
            "Private submissions hide your message and source from all public views",
            "Anonymous submissions store nothing after analysis is complete",
            "PII in sources is masked before display - emails, phones, and names are partially hidden",
            "You can request removal of any submission by emailing contact@phishscore.ai",
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: i < 4 ? 8 : 0 }}>
              <span style={{ color: "#38bdf8", flexShrink: 0, fontFamily: "monospace" }}>+</span>
              <span style={{ color: "#7dd3fc", fontSize: 13, fontFamily: "Georgia, serif", lineHeight: 1.5 }}>{item}</span>
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

function CategoryBreakdown({ catCounts, maxCount, filterCat, setFilterCat, theme, T }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? catCounts : catCounts.slice(0, 3);
  const hasMore = catCounts.length > 3;
  return (
    <div style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 24, marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div style={{ fontSize: 10, letterSpacing: 3, color: T.text3, fontFamily: "monospace" }}>
          BREAKDOWN BY SCAM TYPE - <span style={{ color: T.text3 }}>click to filter</span>
        </div>
        {hasMore && (
          <span style={{ fontSize: 9, color: T.text4, fontFamily: "monospace" }}>
            {showAll ? `showing all ${catCounts.length}` : `showing top 3 of ${catCounts.length}`}
          </span>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
        {visible.map(cat => {
          const active = filterCat === cat.id;
          return (
            <button key={cat.id} onClick={() => setFilterCat(active ? "all" : cat.id)} style={{ background: active ? `${cat.color}14` : T.innerBg, border: `1.5px solid ${active ? cat.color : T.innerBorder}`, borderRadius: 10, padding: "12px 14px", cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <CAT_ICON_SVG icon={cat.icon} color={active ? "#ffffff" : T.text3} size={14} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: active ? cat.color : T.text3, fontFamily: "monospace" }}>{cat.label}</span>
                </div>
                <span style={{ fontSize: 15, fontWeight: 800, color: cat.color, fontFamily: "monospace" }}>{cat.count}</span>
              </div>
              <div style={{ background: T.ringTrack, borderRadius: 3, height: 4 }}>
                <div style={{ height: "100%", borderRadius: 3, background: `linear-gradient(90deg, ${cat.color}, ${cat.color}66)`, width: `${(cat.count / maxCount) * 100}%`, transition: "width 0.8s ease" }} />
              </div>
              <div style={{ fontSize: 10, color: T.text4, marginTop: 5, fontFamily: "monospace" }}>{cat.scamCount} scam{cat.scamCount !== 1 ? "s" : ""}</div>
            </button>
          );
        })}
      </div>
      {hasMore && (
        <button onClick={() => setShowAll(v => !v)} style={{
          marginTop: 12, width: "100%", background: "none", border: `1px dashed ${T.cardBorder}`,
          color: T.text4, padding: "8px", borderRadius: 8, cursor: "pointer",
          fontFamily: "monospace", fontSize: 10, letterSpacing: 1, transition: "all 0.15s"
        }}>
          {showAll ? "SHOW LESS" : `+ ${catCounts.length - 3} MORE CATEGORIES`}
        </button>
      )}
    </div>
  );
}

// -- MAIN APP ------------------------------------------------------------------
export default function App() {
  const [submissions, setSubmissions] = useState([]);
  const [dbLoading, setDbLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showFAQ, setShowFAQ] = useState(false);
  const [showTransparency, setShowTransparency] = useState(false);
  const [filterCat, setFilterCat] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterVis, setFilterVis] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [showMoreFeed, setShowMoreFeed] = useState(false);
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem("phishscore_theme") || "light"; } catch { return "light"; } });
  const toggleTheme = () => { const next = theme === "dark" ? "light" : "dark"; setTheme(next); try { localStorage.setItem("phishscore_theme", next); } catch {} };
  const T = theme === "light" ? {
    pageBg: "#f8f6f2",
    cardBg: "#ffffff",
    cardBorder: "#e8e4de",
    innerBg: "#f3f0eb",
    innerBorder: "#e8e4de",
    headerBg: "rgba(248,246,242,0.97)",
    headerBorder: "#e8e4de",
    text: "#111827",
    text2: "#374151",
    text3: "#6b7280",
    text4: "#9ca3af",
    ringTrack: "#e5e7eb",
    feedDivider: "#f3f0eb",
    tagBg: "#f3f0eb",
    tagColor: "#6b7280",
    inputBg: "#ffffff",
    inputBorder: "#e8e4de",
    scrollTrack: "#f0ede8",
    scrollThumb: "#c8c4bc",
  } : {
    pageBg: "#060810",
    cardBg: "#090b14",
    cardBorder: "#1a1d2e",
    innerBg: "#0d0f1a",
    innerBorder: "#1a1d2e",
    headerBg: "rgba(6,8,16,0.95)",
    headerBorder: "#1a1d2e",
    text: "#e2e8f0",
    text2: "#94a3b8",
    text3: "#64748b",
    text4: "#475569",
    ringTrack: "#1a1d2e",
    feedDivider: "#0d0f1a",
    tagBg: "#1a1d2e",
    tagColor: "#475569",
    inputBg: "#0d0f1a",
    inputBorder: "#1a1d2e",
    scrollTrack: "#060810",
    scrollThumb: "#1a1d2e",
  };
  const [barDismissed, setBarDismissed] = useState(() => {
    try { return localStorage.getItem("phishscore_bar_dismissed") === "1"; } catch { return false; }
  });
  const dismissBar = () => {
    setBarDismissed(true);
    try { localStorage.setItem("phishscore_bar_dismissed", "1"); } catch {}
  };

  useEffect(() => { loadSubmissions(); }, []);

  const loadSubmissions = async () => {
    setDbLoading(true);
    try {
      const data = await db.getSubmissions();
      if (Array.isArray(data)) setSubmissions(data);
    } catch (e) { console.error(e); }
    setDbLoading(false);
  };

  const handleNewResult = async ({ category, text, result, source, visibility, classificationNote }) => {
    const isAnon = visibility === "anonymous";
    const newSub = {
      category,
      source: isAnon ? null : (source || "user-submitted"),
      preview: isAnon ? null : (text.slice(0, 130) + (text.length > 130 ? "..." : "")),
      score: result.score,
      tags: result.tags || [],
      visibility: visibility || "public",
      classification_note: classificationNote || null,
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

  const FEED_CAP = 20;
  const FEED_DEFAULT = 3;
  const allFiltered = submissions
    .filter(s => filterCat === "all" || s.category === filterCat)
    .filter(s => filterStatus === "all" || (filterStatus === "scam" && s.score >= 75) || (filterStatus === "suspicious" && s.score >= 45 && s.score < 75) || (filterStatus === "safe" && s.score < 45))
    .filter(s => filterVis === "all" || (s.visibility || "public") === filterVis)
    .sort((a, b) => sortBy === "recent" ? new Date(b.created_at) - new Date(a.created_at) : b.score - a.score)
    .slice(0, FEED_CAP);
  const filtered = showMoreFeed ? allFiltered : allFiltered.slice(0, FEED_DEFAULT);

  const statusColors = { all: "#5b6cf8", scam: "#f43f5e", suspicious: "#fb923c", safe: "#34d399" };
  const handleFilterChange = (setter, val) => { setter(val); setShowMoreFeed(false); };

  return (
    <div style={{ minHeight: "100vh", background: T.pageBg, color: T.text, fontFamily: "Georgia, serif" }}>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 70% 50% at 5% 0%, #f43f5e08, transparent 55%), radial-gradient(ellipse 50% 40% at 95% 100%, #a78bfa07, transparent 55%)" }} />
      <div style={{ position: "relative" }}>
        {/* ANNOUNCEMENT BAR */}
        {!barDismissed && (
          <div style={{ background: theme === "dark" ? "linear-gradient(90deg, #1a0a1a, #0a0d1a, #1a0a1a)" : "#fff5f5", borderBottom: "1px solid #f43f5e33", padding: "10px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 9, color: "#f43f5e", fontFamily: "monospace", letterSpacing: 3, flexShrink: 0 }}>PHISHSCORE.AI</span>
              <span style={{ fontSize: 12, color: "#94a3b8", fontFamily: "Georgia, serif" }}>
                Got a suspicious message? Paste it, screenshot it, get an instant AI scam score.
              </span>
              <button onClick={() => setShowFAQ(true)} style={{ background: "none", border: "none", color: "#f43f5e", cursor: "pointer", fontSize: 11, fontFamily: "monospace", padding: 0, letterSpacing: 1, textDecoration: "underline" }}>How it works</button>
            </div>
            <button onClick={dismissBar} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 14, padding: "0 4px", flexShrink: 0 }}>x</button>
          </div>
        )}

        {/* HEADER */}
        <header style={{ borderBottom: `1px solid ${T.headerBorder}`, padding: "18px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14, background: T.headerBg, backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 50 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#f43f5e", boxShadow: "0 0 8px #f43f5e", animation: "blink 2s infinite" }} />
              <span style={{ fontSize: 9, color: "#f43f5e", letterSpacing: 4, fontFamily: "monospace" }}>LIVE INTELLIGENCE</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "monospace", letterSpacing: 1 }}>
              <span style={{ color: T.text }}>PHISH</span><span style={{ color: "#f43f5e" }}>SCORE</span><span style={{ color: T.cardBorder, fontSize: 13 }}>.ai</span>
            </div>
            <div style={{ fontSize: 9, color: T.text4, letterSpacing: 3, fontFamily: "monospace" }}>COMMUNITY SCAM INTELLIGENCE DASHBOARD</div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={() => setShowFAQ(true)} style={{ background: "none", border: `1px solid ${T.headerBorder}`, color: T.text3, padding: "10px 18px", borderRadius: 10, fontSize: 11, cursor: "pointer", fontFamily: "monospace", letterSpacing: 1 }}>FAQ</button>
            <button onClick={toggleTheme} style={{ background: "none", border: `1px solid ${T.headerBorder}`, color: T.text3, padding: "10px 18px", borderRadius: 10, fontSize: 11, cursor: "pointer", fontFamily: "monospace", letterSpacing: 1 }}>{theme === "dark" ? "LIGHT" : "DARK"}</button>
            <button onClick={() => setShowModal(true)}
              style={{ background: "linear-gradient(135deg,#f43f5e,#be123c)", border: "none", color: "#fff", padding: "13px 26px", borderRadius: 12, fontSize: 12, fontWeight: 700, letterSpacing: 2, cursor: "pointer", fontFamily: "monospace", boxShadow: "0 4px 24px rgba(244,63,94,0.4)" }}
              onMouseEnter={e => e.currentTarget.style.transform = "scale(1.04)"}
              onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
              CHECK A MESSAGE
            </button>
          </div>
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
              <div key={s.label} style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: "18px 20px", borderTop: `3px solid ${s.accent}` }}>
                <div style={{ fontSize: 9, color: T.text3, letterSpacing: 3, marginBottom: 8, fontFamily: "monospace" }}>{s.label}</div>
                <div style={{ fontSize: 30, fontWeight: 800, color: s.accent, fontFamily: "monospace" }}>{s.value}</div>
                {s.sub && <div style={{ fontSize: 10, color: T.text4, marginTop: 3, fontFamily: "monospace" }}>{s.sub}</div>}
              </div>
            ))}
          </div>

          {/* CATEGORY BREAKDOWN */}
          {catCounts.length > 0 && (
            <CategoryBreakdown
              catCounts={catCounts}
              maxCount={maxCount}
              filterCat={filterCat}
              setFilterCat={setFilterCat}
              theme={theme}
              T={T}
            />
          )}

          {/* FEED */}
          <div style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
              <div style={{ fontSize: 10, letterSpacing: 3, color: T.text3, fontFamily: "monospace" }}>
                COMMUNITY SUBMISSIONS
                {filterCat !== "all" && <span style={{ color: getCat(filterCat).color, marginLeft: 8 }}>- {getCat(filterCat).label}</span>}
                <span style={{ color: T.text4, marginLeft: 8, fontSize: 9 }}>
                  {showMoreFeed ? `showing last ${Math.min(FEED_CAP, allFiltered.length)}` : `showing last ${Math.min(FEED_DEFAULT, allFiltered.length)} of ${Math.min(FEED_CAP, allFiltered.length)}`}
                </span>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                {["all", "scam", "suspicious", "safe"].map(s => (
                  <button key={s} onClick={() => handleFilterChange(setFilterStatus, s)} style={{ background: filterStatus === s ? `${statusColors[s]}18` : "none", border: `1px solid ${filterStatus === s ? statusColors[s] : T.cardBorder}`, color: filterStatus === s ? statusColors[s] : T.text4, padding: "4px 10px", borderRadius: 20, fontSize: 9, cursor: "pointer", fontFamily: "monospace", letterSpacing: 2, textTransform: "uppercase", transition: "all 0.15s" }}>{s}</button>
                ))}
                <div style={{ width: 1, height: 16, background: T.cardBorder }} />
                {["all", "public", "private", "anonymous"].map(v => {
                  const vOpt = VISIBILITY_OPTIONS.find(o => o.id === v);
                  const color = vOpt ? vOpt.color : "#5b6cf8";
                  return (
                    <button key={v} onClick={() => handleFilterChange(setFilterVis, v)} style={{ background: filterVis === v ? `${color}18` : "none", border: `1px solid ${filterVis === v ? color : T.cardBorder}`, color: filterVis === v ? color : T.text4, padding: "4px 10px", borderRadius: 20, fontSize: 9, cursor: "pointer", fontFamily: "monospace", letterSpacing: 1, textTransform: "uppercase", transition: "all 0.15s" }}>{v}</button>
                  );
                })}
                <div style={{ width: 1, height: 16, background: T.cardBorder }} />
                <button onClick={() => setSortBy(s => s === "recent" ? "score" : "recent")} style={{ background: "none", border: `1px solid ${T.cardBorder}`, color: T.text4, padding: "4px 10px", borderRadius: 20, fontSize: 9, cursor: "pointer", fontFamily: "monospace", letterSpacing: 1 }}>
                  {sortBy === "recent" ? "NEWEST" : "HIGHEST SCORE"}
                </button>
              </div>
            </div>

            {dbLoading ? (
              <div style={{ textAlign: "center", padding: "48px 0", color: T.text4, fontFamily: "monospace", fontSize: 12 }}>LOADING SUBMISSIONS...</div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 0" }}>
                <div style={{ color: T.text4, fontFamily: "monospace", fontSize: 12, marginBottom: 12 }}>No submissions yet - be the first!</div>
                <button onClick={() => setShowModal(true)} style={{ background: "linear-gradient(135deg,#f43f5e,#be123c)", border: "none", color: "#fff", padding: "10px 24px", borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "monospace", letterSpacing: 2 }}>CHECK A MESSAGE</button>
              </div>
            ) : (
              filtered.map((s, i) => {
                const cat = getCat(s.category);
                const sc = getScoreColor(s.score);
                const vis = s.visibility || "public";
                const isHidden = vis === "private" || vis === "anonymous";
                return (
                  <div key={s.id} style={{ display: "grid", gridTemplateColumns: "56px 1fr auto", gap: 16, padding: "16px 0", borderTop: i > 0 ? `1px solid ${T.feedDivider}` : "none", alignItems: "start" }}>
                    <ScoreRing score={s.score} size={52} trackColor={T.ringTrack} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 6, marginBottom: 5, flexWrap: "wrap", alignItems: "center" }}>
                        <span style={{ background: `${cat.color}14`, border: `1px solid ${cat.color}35`, color: cat.color, fontSize: 9, padding: "2px 8px", borderRadius: 20, fontFamily: "monospace", letterSpacing: 1, display: "flex", alignItems: "center", gap: 4 }}><CAT_ICON_SVG icon={cat.icon} color={cat.color} size={10} />{cat.label}</span>
                        {(s.tags || []).slice(0, 2).map(t => <span key={t} style={{ background: T.tagBg, color: T.tagColor, fontSize: 9, padding: "2px 8px", borderRadius: 20, fontFamily: "monospace" }}>{t}</span>)}
                        <VisibilityBadge visibility={vis} />
                        {s.classification_note === "auto" && <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 20, color: "#a78bfa", border: "1px solid #a78bfa40", background: "#a78bfa12", fontFamily: "monospace", letterSpacing: 1 }}>AUTO</span>}
                        {s.classification_note === "reclassified" && <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 20, color: "#f97316", border: "1px solid #f9731640", background: "#f9731612", fontFamily: "monospace", letterSpacing: 1 }}>RECLASSIFIED</span>}
                        <span style={{ fontSize: 9, color: T.text4, fontFamily: "monospace", marginLeft: "auto" }}>{timeAgo(s.created_at)}</span>
                      </div>
                      {isHidden ? (
                        <div style={{ fontSize: 12, color: T.text4, fontFamily: "monospace", fontStyle: "italic", marginBottom: 4 }}>
                          {vis === "anonymous" ? "Anonymous submission - content not stored" : "Private submission - content hidden"}
                        </div>
                      ) : (
                        <div style={{ fontSize: 13, color: T.text3, lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 6 }}>{s.preview}</div>
                      )}
                      {!isHidden && s.source && <SourceBadge source={s.source} />}
                    </div>
                    <div style={{ padding: "5px 10px", borderRadius: 20, fontSize: 9, fontWeight: 800, letterSpacing: 2, color: sc, border: `1px solid ${sc}35`, background: `${sc}0d`, whiteSpace: "nowrap", fontFamily: "monospace" }}>{getStatusLabel(s.score)}</div>
                  </div>
                );
              })
            )}
            {!dbLoading && allFiltered.length > FEED_DEFAULT && (
              <button onClick={() => setShowMoreFeed(v => !v)} style={{
                marginTop: 16, width: "100%", background: "none", border: `1px dashed ${T.cardBorder}`,
                color: T.text4, padding: "10px", borderRadius: 8, cursor: "pointer",
                fontFamily: "monospace", fontSize: 10, letterSpacing: 1, transition: "all 0.15s"
              }}>
                {showMoreFeed ? "SHOW LESS" : `+ SHOW ${Math.min(FEED_CAP, allFiltered.length) - FEED_DEFAULT} MORE SUBMISSIONS`}
              </button>
            )}
          </div>
        </main>

        {/* FOOTER */}
        <footer style={{ borderTop: `1px solid ${T.cardBorder}`, padding: "28px", marginTop: 20, background: T.pageBg }}>
          <div style={{ maxWidth: 1300, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, fontFamily: "monospace", letterSpacing: 1, marginBottom: 4 }}>
                <span style={{ color: T.text }}>PHISH</span><span style={{ color: "#f43f5e" }}>SCORE</span><span style={{ color: T.text4 }}>.ai</span>
              </div>
              <div style={{ fontSize: 10, color: T.text4, fontFamily: "monospace", letterSpacing: 2 }}>PROTECTING COMMUNITIES FROM FRAUD</div>
            </div>
            <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
              <button onClick={() => setShowFAQ(true)} style={{ background: "none", border: "none", color: T.text4, cursor: "pointer", fontFamily: "monospace", fontSize: 11, letterSpacing: 1 }}>FAQ</button>
              <button onClick={() => setShowTransparency(true)} style={{ background: "none", border: "none", color: T.text4, cursor: "pointer", fontFamily: "monospace", fontSize: 11, letterSpacing: 1 }}>TRANSPARENCY</button>
              <a href="mailto:contact@phishscore.ai" style={{ color: T.text4, fontFamily: "monospace", fontSize: 11, textDecoration: "none", letterSpacing: 1 }}>contact@phishscore.ai</a>
              <div style={{ fontSize: 10, color: T.text4, fontFamily: "monospace" }}>2026 PhishScore.ai</div>
            </div>
          </div>
        </footer>
      </div>

      {showModal && <SubmitModal onClose={() => setShowModal(false)} onNewResult={handleNewResult} submissionCounts={Object.fromEntries(SCAM_CATEGORIES.map(c => [c.id, submissions.filter(s => s.category === c.id).length]))} />}
      {showFAQ && <FAQPage onClose={() => setShowFAQ(false)} />}
      {showTransparency && <TransparencyPage onClose={() => setShowTransparency(false)} submissions={submissions} />}

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.15} }
        * { box-sizing: border-box; }
        body { margin: 0; background: ${T.pageBg}; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: ${T.scrollTrack}; }
        ::-webkit-scrollbar-thumb { background: ${T.scrollThumb}; border-radius: 3px; }
        button { transition: all 0.15s; }
        a { transition: color 0.15s; }
        a:hover { color: #f43f5e !important; }
      `}</style>
    </div>
  );
}
