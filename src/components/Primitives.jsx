import { useState } from "react";
import { getScoreColor, VISIBILITY_OPTIONS, FLAG_LABELS } from "../constants";
import { parseSource } from "../utils";

// ── Logo ──────────────────────────────────────────────────────────────────────
// FIX: "PHISH" uses T.text so it's visible in both light and dark mode
export function PhishScoreLogo({ T = {}, size = 20, dotSize = 13 }) {
  return (
    <div style={{ fontSize: size, fontWeight: 800, fontFamily: "monospace", letterSpacing: 1 }}>
      <span style={{ color: T.text }}>PHISH</span>
      <span style={{ color: "#f43f5e" }}>SCORE</span>
      <span style={{ color: T.text4, fontSize: dotSize }}>.ai</span>
    </div>
  );
}

// ── Score ring ─────────────────────────────────────────────────────────────────
export function ScoreRing({ score, size = 64, trackColor = "#1a1d2e" }) {
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

// ── Category icon ──────────────────────────────────────────────────────────────
export const CatIconSvg = ({ icon, color, size = 22 }) => {
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
    legal: "M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-1 14l-3-3 1.41-1.41L11 12.17l4.59-4.58L17 9l-6 6z",
    other: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ flexShrink: 0, opacity: 0.9 }}>
      <path d={paths[icon] || paths.other} />
    </svg>
  );
};

// ── Tooltip ────────────────────────────────────────────────────────────────────
export function Tooltip({ text, children }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative", display: "inline-block" }}
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
      onTouchStart={() => setShow(true)} onTouchEnd={() => setTimeout(() => setShow(false), 2000)}>
      {children}
      {show && (
        <div style={{ position: "absolute", bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)", background: "#1a1d2e", border: "1px solid #2a2d3e", borderRadius: 8, padding: "10px 14px", width: 240, fontSize: 12, color: "#94a3b8", fontFamily: "Georgia, serif", lineHeight: 1.6, zIndex: 999, boxShadow: "0 8px 32px rgba(0,0,0,0.5)", pointerEvents: "none" }}>
          {text}
          <div style={{ position: "absolute", bottom: -5, left: "50%", width: 8, height: 8, background: "#1a1d2e", border: "1px solid #2a2d3e", borderTop: "none", borderLeft: "none", transform: "translateX(-50%) rotate(45deg)" }} />
        </div>
      )}
    </div>
  );
}

// ── Visibility badge ───────────────────────────────────────────────────────────
export function VisibilityBadge({ visibility }) {
  const v = VISIBILITY_OPTIONS.find(o => o.id === visibility) || VISIBILITY_OPTIONS[0];
  return (
    <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 20, fontFamily: "monospace", letterSpacing: 1, color: v.color, border: `1px solid ${v.color}40`, background: `${v.color}12` }}>
      {v.label.toUpperCase()}
    </span>
  );
}

// ── Source badge ───────────────────────────────────────────────────────────────
function SingleSourceBadge({ parsed }) {
  if (!parsed || parsed.label === "Anonymous") return null;
  const typeColor = parsed.suspicious ? "#f43f5e" : parsed.type === "phone" ? "#38bdf8" : parsed.type === "name" ? "#e879f9" : parsed.type === "sms" ? "#fbbf24" : parsed.platformColor || "#64748b";
  const typeBg = parsed.suspicious ? "#f43f5e18" : parsed.type === "phone" ? "#38bdf818" : parsed.type === "name" ? "#e879f918" : parsed.type === "sms" ? "#fbbf2418" : "#1a1d2e";
  const typeBorder = parsed.suspicious ? "#f43f5e35" : parsed.type === "phone" ? "#38bdf835" : parsed.type === "name" ? "#e879f935" : parsed.type === "sms" ? "#fbbf2435" : "#2a2d3e";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "nowrap" }}>
      <span style={{ fontSize: 11, color: "#475569", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>{parsed.label}</span>
      {parsed.platform && (
        <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 20, fontFamily: "monospace", letterSpacing: 1, background: typeBg, color: typeColor, border: `1px solid ${typeBorder}`, whiteSpace: "nowrap" }}>
          {parsed.flag ? `[${FLAG_LABELS[parsed.flag]}] ` : ""}{parsed.platform}
        </span>
      )}
    </div>
  );
}

export function SourceBadge({ source }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {parseSource(source).map((p, i) => <SingleSourceBadge key={i} parsed={p} />)}
    </div>
  );
}
