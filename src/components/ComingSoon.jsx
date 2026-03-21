import { PhishScoreLogo } from "./Primitives";

const ICONS = {
  radar: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="2"/>
      <path d="M12 2a10 10 0 0 1 10 10"/>
      <path d="M12 6a6 6 0 0 1 6 6"/>
      <path d="M12 10a2 2 0 0 1 2 2"/>
      <line x1="12" y1="12" x2="19.5" y2="4.5"/>
    </svg>
  ),
  search: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
};

export default function ComingSoon({ onClose, title, icon, description, T = {} }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", backdropFilter: "blur(14px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 20, width: "100%", maxWidth: 480, padding: 40, position: "relative", boxShadow: "0 32px 96px rgba(0,0,0,0.7)", textAlign: "center" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, background: T.innerBg, border: `1px solid ${T.innerBorder}`, color: T.text3, width: 30, height: 30, borderRadius: "50%", cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center" }}>x</button>

        <div style={{ marginBottom: 8 }}><PhishScoreLogo T={T} size={16} dotSize={11} /></div>

        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20, opacity: 0.85 }}>
          {ICONS[icon]}
        </div>

        <div style={{ fontSize: 10, letterSpacing: 4, color: "#f43f5e", fontFamily: "monospace", marginBottom: 10 }}>COMING SOON</div>
        <h2 style={{ color: T.text, fontFamily: "monospace", fontSize: 22, fontWeight: 800, margin: "0 0 16px", letterSpacing: 1 }}>{title}</h2>
        <p style={{ color: T.text3, fontFamily: "Georgia, serif", fontSize: 14, lineHeight: 1.8, margin: "0 0 32px" }}>{description}</p>

        <div style={{ background: T.innerBg, border: `1px solid ${T.innerBorder}`, borderRadius: 12, padding: "14px 20px", marginBottom: 28 }}>
          <div style={{ fontSize: 11, color: T.text4, fontFamily: "monospace", letterSpacing: 1 }}>Want to be notified when this launches?</div>
          <a href="mailto:contact@phishscore.ai?subject=Notify me: PhishScore Trends" style={{ color: "#f43f5e", fontFamily: "monospace", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>contact@phishscore.ai</a>
        </div>

        <button onClick={onClose} style={{ background: "linear-gradient(135deg,#f43f5e,#be123c)", border: "none", color: "#fff", padding: "12px 32px", borderRadius: 10, fontSize: 12, fontWeight: 700, letterSpacing: 2, cursor: "pointer", fontFamily: "monospace", boxShadow: "0 4px 20px rgba(244,63,94,0.35)" }}>
          BACK TO DASHBOARD
        </button>
      </div>
    </div>
  );
}
