import { useState, useEffect, useRef } from "react";
import { SCAM_CATEGORIES, VISIBILITY_OPTIONS, THEMES, getScoreColor, getStatusLabel, getCat, timeAgo } from "./constants";
import db from "./db";
import { ScoreRing, CatIconSvg, VisibilityBadge, PhishScoreLogo, Tooltip } from "./components/Primitives";
import CategoryBreakdown from "./components/CategoryBreakdown";
import SubmitModal, { ScannerPanel } from "./components/SubmitModal";
import { FAQContent } from "./components/FAQPage";
import { GlossaryContent } from "./components/GlossaryPage";
import TransparencyPage from "./components/TransparencyPage";
import LegalPage from "./components/LegalPage";
import APITestDashboard from "./components/APITestDashboard";
import { RadarPanel } from "./components/RadarModal";
import { NewsPanel } from "./components/NewsPanel";
import DeepIntelModal, { DeepIntelContent } from "./components/DeepIntelModal";
import ReportStatusModal from "./components/ReportStatusModal";
import PageWrapper from "./components/PageWrapper";
import InvestigatorChat from "./components/InvestigatorChat";
import ActionRow from "./components/ActionRow";

const TrustBadge = ({ isMobile }) => {
  const [expanded, setExpanded] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const showFull = !isMobile || expanded;

  useEffect(() => {
    const hidden = localStorage.getItem('hideGovernanceBanner');
    if (hidden !== 'true') setShowBanner(true);
  }, []);

  const dismissBanner = () => {
    setShowBanner(false);
    localStorage.setItem('hideGovernanceBanner', 'true');
  };

  if (!showBanner) return null;

  return (
    <div
      style={{
        position: "relative",
        marginBottom: "24px",
        padding: "20px 24px",
        background: "rgba(16, 185, 129, 0.05)",
        border: "1px solid rgba(16, 185, 129, 0.2)",
        borderRadius: "12px",
        display: "flex",
        alignItems: "flex-start",
        gap: "16px",
        maxWidth: "100%",
      }}
    >
      <div style={{ color: "#10b981", flexShrink: 0, marginTop: "2px" }}>
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          <path d="M9 12l2 2 4-4"></path>
        </svg>
      </div>
      <div>
        <h4 style={{ margin: "0 0 6px 0", color: "#d1d5db", fontSize: "14px", fontFamily: "monospace", fontWeight: "600", letterSpacing: "0.5px" }}>
          AI GOVERNANCE & DATA PRIVACY
        </h4>
        <p style={{ margin: 0, color: "#9ca3af", fontSize: "13px", lineHeight: "1.6", fontFamily: "sans-serif" }}>
          All community feed submissions are strictly anonymized.{" "}
          {showFull ? (
            <><strong>We never use your private case data, uploaded files, or credentials to train underlying AI models.</strong> Enterprise-grade forensic intelligence, built on absolute privacy.</>
          ) : (
            <button onClick={() => setExpanded(true)} style={{ background: "none", border: "none", padding: 0, color: "#64748b", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: "2px" }}>Read more...</button>
          )}
        </p>
      </div>
      <button onClick={dismissBanner} style={{ position: "absolute", top: "12px", right: "12px", background: "none", border: "none", color: "#059669", cursor: "pointer", fontSize: "16px", lineHeight: 1, padding: 0 }}>✕</button>
    </div>
  );
};

const MAX_SUMMARY = 120;

function FeedItem({ s, i, T }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const sc = getScoreColor(s.score), vis = s.visibility || "public", isHidden = vis === "private" || vis === "anonymous";
  const quickScanLabel = s._isQuickScan ? (s.preview || 'Private quick scan — content hidden.') : null;
  const qsCatLabel = s._isQuickScan ? ({ phone: '📱 Phone Scan', email: '📧 Email Scan', url: '🔗 Link Scan', text: '📝 Text Scan' }[s.input_type] || '⚡ Quick Scan') : null;
  const cat = s._isQuickScan ? null : getCat(s.category);
  const qsTags = s._isQuickScan ? [s.category, ...(s.ai_tags || [])].filter(Boolean) : [];
  const summaryText = s.summary || s.preview || "";
  const isTruncatable = summaryText.length > MAX_SUMMARY;

  return (
    <div key={s.id} className="feed-row" style={{ display: "grid", gridTemplateColumns: "52px 1fr auto", gap: 12, padding: "16px 0", borderTop: i > 0 ? `1px solid ${T.feedDivider}` : "none", alignItems: "start", minWidth: 0 }}>
      <ScoreRing score={s.score} size={52} trackColor={T.ringTrack} />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", gap: 4, marginBottom: 5, flexWrap: "wrap", alignItems: "center" }}>
          {s._isQuickScan ? (
            <span style={{ background: "#38bdf812", border: "1px solid #38bdf840", color: "#38bdf8", fontSize: 9, padding: "1px 6px", borderRadius: 20, fontFamily: "monospace", letterSpacing: 1 }}>{qsCatLabel}</span>
          ) : (
            <span style={{ background: `${cat.color}14`, border: `1px solid ${cat.color}35`, color: cat.color, fontSize: 9, padding: "1px 6px", borderRadius: 20, fontFamily: "monospace", letterSpacing: 1, display: "flex", alignItems: "center", gap: 4 }}><CatIconSvg icon={cat.icon} color={cat.color} size={10} />{cat.label}</span>
          )}
          {!s._isQuickScan && (s.tags || []).slice(0, 2).map(t => <span key={t} style={{ background: T.tagBg, color: T.tagColor, fontSize: 9, padding: "1px 6px", borderRadius: 20, fontFamily: "monospace" }}>{t}</span>)}
          <VisibilityBadge visibility={vis} />
          {s._isQuickScan
            ? <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 20, color: "#d97706", border: "1px solid #d9780640", background: "#d9780612", fontFamily: "monospace", letterSpacing: 1, fontWeight: 700 }}>⚡ QUICK SCAN</span>
            : <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 20, color: "#818cf8", border: "1px solid #818cf840", background: "#818cf812", fontFamily: "monospace", letterSpacing: 1, fontWeight: 700 }}>🔬 ANALYZE THREAT</span>
          }
          {s._isQuickScan && qsTags.map(tag => <span key={tag} style={{ fontSize: 9, padding: "1px 6px", borderRadius: 20, color: T.text2, border: `1px solid ${T.cardBorder}`, background: T.cardBg, fontFamily: "monospace", letterSpacing: 1, fontWeight: 500 }}>{tag}</span>)}
          {!s._isQuickScan && s.classification_note === "auto" && <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 20, color: "#a78bfa", border: "1px solid #a78bfa40", background: "#a78bfa12", fontFamily: "monospace", letterSpacing: 1 }}>AUTO</span>}
          {!s._isQuickScan && s.classification_note === "reclassified" && <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 20, color: "#f97316", border: "1px solid #f9731640", background: "#f9731612", fontFamily: "monospace", letterSpacing: 1 }}>RECLASSIFIED</span>}
          <span style={{ fontSize: 9, color: T.text4, fontFamily: "monospace", marginLeft: "auto" }}>{timeAgo(s.created_at)}</span>
        </div>
        {quickScanLabel ? (
          <div style={{ fontSize: 12, color: T.text4, fontFamily: "monospace", fontStyle: "italic", marginBottom: 4 }}>{quickScanLabel}</div>
        ) : isHidden ? (
          <div style={{ fontSize: 12, color: T.text4, fontFamily: "monospace", fontStyle: "italic", marginBottom: 4 }}>{vis === "anonymous" ? "Anonymous submission - content not stored" : "Private submission - content hidden"}</div>
        ) : (
          <div className="feed-text" style={{ fontSize: 13, color: T.text3, lineHeight: 1.6, marginBottom: 6, fontFamily: "Georgia, serif" }}>
            {isTruncatable && !isExpanded ? (
              <>{summaryText.slice(0, MAX_SUMMARY)}... <button onClick={() => setIsExpanded(true)} style={{ background: "none", border: "none", padding: 0, color: T.text4, fontSize: 11, fontFamily: "monospace", fontWeight: 700, cursor: "pointer", letterSpacing: 1 }}>read more</button></>
            ) : (
              <>{summaryText}{isTruncatable && isExpanded && <> <button onClick={() => setIsExpanded(false)} style={{ background: "none", border: "none", padding: 0, color: T.text4, fontSize: 11, fontFamily: "monospace", fontWeight: 700, cursor: "pointer", letterSpacing: 1 }}>show less</button></>}</>
            )}
          </div>
        )}
      </div>
      <div style={{ padding: "5px 10px", borderRadius: 20, fontSize: 9, fontWeight: 800, letterSpacing: 2, color: sc, border: `1px solid ${sc}35`, background: `${sc}0d`, whiteSpace: "nowrap", fontFamily: "monospace" }}>{getStatusLabel(s.score)}</div>
    </div>
  );
}

export default function App() {
  const [submissions, setSubmissions] = useState([]);
  const [dbLoading, setDbLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showTransparency, setShowTransparency] = useState(false);
  // activeView drives the inline section below hero stats
  // 'dashboard' = community feed, 'radar' = radar panel, 'faq' = FAQ, 'deep-intel' = Deep Intel
  const [activeView, setActiveView] = useState('dashboard');
  const contentRef = useRef(null);
  const [showInvestigation, setShowInvestigation] = useState(false); // modal only — for prefill from scan results
  const [showLegal, setShowLegal] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get("legal") === "terms" || params.get("legal") === "privacy";
    } catch { return false; }
  });
  const [legalTab, setLegalTab] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get("legal") === "privacy" ? "privacy" : "terms";
    } catch { return "terms"; }
  });
  const [showDevTools, setShowDevTools] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get("devmode") === "ps2026";
    } catch { return false; }
  });
  const [deepIntelPrefill, setDeepIntelPrefill] = useState({});
  const [reportCaseId, setReportCaseId] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get("case") || null;
    } catch { return null; }
  });
  const [reportToken, setReportToken] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get("token") || null;
    } catch { return null; }
  });
  const [filterCat, setFilterCat] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterVis, setFilterVis] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [showMoreFeed, setShowMoreFeed] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isDeepIntelOpen, setIsDeepIntelOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem("phishscore_theme") || "light"; } catch { return "light"; } });

  const T = THEMES[theme] || THEMES.light;

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try { localStorage.setItem("phishscore_theme", next); } catch {}
  };

  const [barDismissed, setBarDismissed] = useState(() => {
    try { return localStorage.getItem("phishscore_bar_dismissed") === "1"; } catch { return false; }
  });
  const dismissBar = () => { setBarDismissed(true); try { localStorage.setItem("phishscore_bar_dismissed", "1"); } catch {} };

  const switchView = (view) => {
    setActiveView(view);
  };

  useEffect(() => {
    if (activeView !== 'dashboard' && window.innerWidth < 768 && contentRef.current) {
      contentRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [activeView]);

  useEffect(() => { loadSubmissions(); }, []);

  const loadSubmissions = async () => {
    setDbLoading(true);
    try {
      const [subData, scanData] = await Promise.all([
        db.getSubmissions(),
        db.getQuickScans().catch(() => []),
      ]);
      const subs = Array.isArray(subData) ? subData : [];
      // scanData is already normalized by /api/get-quick-scans (PII stripped server-side)
      const scans = Array.isArray(scanData) ? scanData : [];
      console.log('[feed] submissions:', subs.length, 'quick scans:', scans.length);
      const merged = [...subs, ...scans].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setSubmissions(merged);
    } catch (e) { console.error(e); }
    setDbLoading(false);
  };

  const handleNewResult = async ({ category, text, result, source, visibility, classificationNote, summary, deliveryChannel }) => {
    const isAnon = visibility === "anonymous";
    const newSub = {
      category,
      source: isAnon ? null : (source || "user-submitted"),
      // CHANGE: store AI summary instead of raw text slice; fall back to short preview if no summary
      summary: isAnon ? null : (summary || null),
      preview: isAnon ? null : ((text || "").slice(0, 80) + ((text || "").length > 80 ? "..." : "")),
      score: result.score,
      tags: result.tags || [],
      visibility: visibility || "public",
      classification_note: classificationNote || null,
      gsb_flagged: result.safeBrowsingFlagged === true,
      radar_flagged: result.radarFlagged === true,
      urlhaus_flagged: result.urlhausFlagged === true,
      // Always written — first-class submission field, not gated behind train_ai
      delivery_channel: deliveryChannel || 'other',
    };
    try {
      const saved = await db.insertSubmission(newSub);
      if (Array.isArray(saved) && saved[0]) {
        setSubmissions(prev => [saved[0], ...prev]);
        return saved[0].id || null;
      } else {
        const fallback = { ...newSub, id: Date.now(), created_at: new Date().toISOString() };
        setSubmissions(prev => [fallback, ...prev]);
        return null;
      }
    } catch {
      setSubmissions(prev => [{ ...newSub, id: Date.now(), created_at: new Date().toISOString() }, ...prev]);
      return null;
    }
  };

  const total = submissions.length;
  const scams = submissions.filter(s => s.score >= 75).length;
  const suspicious = submissions.filter(s => s.score >= 45 && s.score < 75).length;
  const safe = submissions.filter(s => s.score < 45).length;
  const quickScanCount = submissions.filter(s => s._isQuickScan).length;
  const analyzeThreatCount = submissions.filter(s => !s._isQuickScan).length;

  const catCounts = SCAM_CATEGORIES
    .map(cat => ({ ...cat, count: submissions.filter(s => s.category === cat.id).length, scamCount: submissions.filter(s => s.category === cat.id && s.score >= 75).length }))
    .filter(c => c.count > 0).sort((a, b) => b.count - a.count);
  const maxCount = Math.max(...catCounts.map(c => c.count), 1);

  const FEED_CAP = 20, FEED_DEFAULT = 3;
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
    <div style={{ minHeight: "100vh", background: T.pageBg, color: T.text, fontFamily: "Georgia, serif", overflowX: "hidden", maxWidth: "100vw" }}>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 70% 50% at 5% 0%, #f43f5e08, transparent 55%), radial-gradient(ellipse 50% 40% at 95% 100%, #a78bfa07, transparent 55%)" }} />
      <div style={{ position: "relative" }}>

        {/* ANNOUNCEMENT BAR */}
        {!barDismissed && (
          <div style={{ background: theme === "dark" ? "linear-gradient(90deg, #1a0a1a, #0a0d1a, #1a0a1a)" : "#fff5f5", borderBottom: "1px solid #f43f5e33", padding: "10px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 9, color: "#f43f5e", fontFamily: "monospace", letterSpacing: 3, flexShrink: 0 }}>PHISHSCORE.AI</span>
              <span style={{ fontSize: 12, color: "#94a3b8", fontFamily: "Georgia, serif" }}>Got a suspicious message? Paste it, screenshot it, get an instant AI scam score. Live threat intelligence via <span style={{ color: "#f43f5e", fontFamily: "monospace", fontSize: 11 }}>RADAR</span>.</span>
              <button onClick={() => setShowFAQ(true)} style={{ background: "none", border: "none", color: "#f43f5e", cursor: "pointer", fontSize: 11, fontFamily: "monospace", padding: 0, letterSpacing: 1, textDecoration: "underline", flexShrink: 0 }}>How it works</button>
            </div>
            <button onClick={dismissBar} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 14, padding: "0 4px", flexShrink: 0 }}>x</button>
          </div>
        )}

        {/* HEADER */}
        <header className="site-header" style={{ borderBottom: `1px solid ${T.headerBorder}`, padding: "18px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, background: T.headerBg, backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 50 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#f43f5e", boxShadow: "0 0 8px #f43f5e", animation: "blink 2s infinite" }} />
              <span style={{ fontSize: 9, color: "#f43f5e", letterSpacing: 4, fontFamily: "monospace" }}>LIVE INTELLIGENCE</span>
            </div>
            <PhishScoreLogo T={T} size={22} dotSize={13} />
            <div style={{ fontSize: 9, color: T.text4, letterSpacing: 3, fontFamily: "monospace" }}>COMMUNITY SCAM INTELLIGENCE DASHBOARD</div>
          </div>
          <div className="nav-scroll-wrapper no-scrollbar" style={{ display: "flex", alignItems: "center", minWidth: 0, overflow: "hidden" }}>
          <div className="nav-buttons" style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "nowrap" }}>

            {/* Home */}
            <Tooltip text="Home — Community Dashboard" T={T}>
              <button onClick={() => switchView('dashboard')} className="nav-btn" style={{ background: activeView === 'dashboard' ? "#5b6cf818" : "none", border: `1px solid ${activeView === 'dashboard' ? "#5b6cf8" : T.headerBorder}`, color: activeView === 'dashboard' ? "#5b6cf8" : T.text3, height: 40, borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "0 12px", whiteSpace: "nowrap" }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                  <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
                <span className="nav-label" style={{ fontSize: 10, fontWeight: 700, fontFamily: "monospace", letterSpacing: 1 }}>HOME</span>
              </button>
            </Tooltip>

            {/* FAQ */}
            <Tooltip text="FAQ & Help" T={T}>
              <button onClick={() => switchView(activeView === 'faq' ? 'dashboard' : 'faq')} className="nav-btn" style={{ background: activeView === 'faq' ? "#f43f5e18" : "none", border: `1px solid ${activeView === 'faq' ? "#f43f5e" : T.headerBorder}`, color: activeView === 'faq' ? "#f43f5e" : T.text3, height: 40, borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "0 12px", whiteSpace: "nowrap" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <span className="nav-label" style={{ fontSize: 10, fontWeight: 700, fontFamily: "monospace", letterSpacing: 1 }}>FAQ</span>
              </button>
            </Tooltip>

            {/* Radar */}
            <Tooltip text="PhishScore Radar — Live Intelligence" T={T}>
              <button onClick={() => switchView(activeView === 'radar' ? 'dashboard' : 'radar')} className="nav-btn" style={{ background: activeView === 'radar' ? "#f43f5e18" : "none", border: `1px solid ${activeView === 'radar' ? "#f43f5e" : T.headerBorder}`, color: activeView === 'radar' ? "#f43f5e" : T.text3, height: 40, borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "0 12px", whiteSpace: "nowrap" }}>
                <span style={{ position: "relative", width: 15, height: 15, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {activeView !== 'radar' && <span style={{ position: "absolute", inset: -3, borderRadius: "50%", border: "1.5px solid #f43f5e", animation: "radarNavPulse 2s ease-out infinite", opacity: 0.6 }} />}
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="2"/><path d="M12 2a10 10 0 0 1 10 10"/><path d="M12 6a6 6 0 0 1 6 6"/><path d="M12 10a2 2 0 0 1 2 2"/><line x1="12" y1="12" x2="19.5" y2="4.5"/>
                  </svg>
                </span>
                <span className="nav-label" style={{ fontSize: 10, fontWeight: 700, fontFamily: "monospace", letterSpacing: 1 }}>RADAR</span>
              </button>
            </Tooltip>

            {/* News */}
            <Tooltip text="Cyber Threat Briefing — AI News" T={T}>
              <button onClick={() => switchView(activeView === 'news' ? 'dashboard' : 'news')} className="nav-btn" style={{ background: activeView === 'news' ? "#38bdf818" : "none", border: `1px solid ${activeView === 'news' ? "#38bdf8" : T.headerBorder}`, color: activeView === 'news' ? "#38bdf8" : T.text3, height: 40, borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "0 12px", whiteSpace: "nowrap" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/>
                </svg>
                <span className="nav-label" style={{ fontSize: 10, fontWeight: 700, fontFamily: "monospace", letterSpacing: 1 }}>NEWS</span>
              </button>
            </Tooltip>

            {/* Deep Intel */}
            <Tooltip text="PhishScore Deep Intel" T={T}>
              <button onClick={() => isMobile ? setIsDeepIntelOpen(true) : switchView(activeView === 'deep-intel' ? 'dashboard' : 'deep-intel')} className="nav-btn" style={{ background: activeView === 'deep-intel' ? "#a78bfa18" : "none", border: `1px solid ${activeView === 'deep-intel' ? "#a78bfa" : T.headerBorder}`, color: activeView === 'deep-intel' ? "#a78bfa" : T.text3, height: 40, borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "0 12px", whiteSpace: "nowrap" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <span className="nav-label" style={{ fontSize: 10, fontWeight: 700, fontFamily: "monospace", letterSpacing: 1 }}>DEEP INTEL</span>
              </button>
            </Tooltip>

            {/* Theme toggle */}
            <Tooltip text={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"} T={T}>
              <button onClick={toggleTheme} className="nav-btn" style={{ background: "none", border: `1px solid ${T.headerBorder}`, color: T.text3, height: 40, borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "0 12px", whiteSpace: "nowrap" }}>
                {theme === "dark" ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                  </svg>
                )}
                <span className="nav-label" style={{ fontSize: 10, fontWeight: 700, fontFamily: "monospace", letterSpacing: 1 }}>
                  <span style={{ color: "#f43f5e", marginRight: 3 }}>●</span>{theme === "dark" ? "DARK" : "LIGHT"}
                </span>
              </button>
            </Tooltip>

          </div>
          </div>
        </header>

        <main className="site-main" style={{ padding: "28px", maxWidth: 1300, margin: "0 auto", overflowX: "hidden", boxSizing: "border-box" }}>

          {/* STATS */}
          <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 14, marginBottom: 26 }}>
            {[
              { label: "TOTAL REPORTS", key: "total", value: total, accent: "#5b6cf8" },
              { label: "CONFIRMED SCAMS", key: "scams", value: scams, accent: "#f43f5e", sub: `${total > 0 ? Math.round(scams / total * 100) : 0}% rate` },
              { label: "SUSPICIOUS", key: "susp", value: suspicious, accent: "#fb923c" },
              { label: "LIKELY SAFE", key: "safe", value: safe, accent: "#34d399" },
              { label: "⚡ QUICK SCANS", key: "qs", value: quickScanCount, accent: "#d97706" },
              { label: "🔬 ANALYZE THREAT", key: "at", value: analyzeThreatCount, accent: "#818cf8" },
            ].map(s => (
              <div key={s.key} className="stat-card" style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 12, padding: "14px 16px", borderTop: `3px solid ${s.accent}` }}>
                <div className="stat-label" style={{ fontSize: 9, color: T.text3, letterSpacing: 3, marginBottom: 8, fontFamily: "monospace", whiteSpace: "normal" }}>{s.label}</div>
                <div className="stat-value" style={{ fontSize: 30, fontWeight: 800, color: s.accent, fontFamily: "monospace" }}>{s.value}</div>
                {s.sub && <div className="stat-sub" style={{ fontSize: 10, color: T.text4, marginTop: 3, fontFamily: "monospace" }}>{s.sub}</div>}
              </div>
            ))}
          </div>

          {/* ACTION ROW + OMNI-BOX */}
          <ActionRow
            T={T}
            analyzerOpen={isScannerOpen || activeView === 'scanner'}
            onAnalyzeThreat={() => isMobile ? setIsScannerOpen(true) : switchView(activeView === 'scanner' ? 'dashboard' : 'scanner')}
          />

          {/* RADAR INLINE DASHBOARD */}
          {/* INLINE VIEW — driven by activeView */}
          <div ref={contentRef}>

            {/* DASHBOARD view */}
            {activeView === 'dashboard' && (
              <>
                <TrustBadge isMobile={isMobile} />
                {catCounts.length > 0 && <CategoryBreakdown catCounts={catCounts} maxCount={maxCount} filterCat={filterCat} setFilterCat={setFilterCat} T={T} />}
                <div className="feed-card" style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 24, boxSizing: "border-box", width: "100%", minWidth: 0, overflowX: "hidden" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
                    <div style={{ fontSize: 10, letterSpacing: 3, color: T.text3, fontFamily: "monospace", minWidth: 0, overflowWrap: "break-word" }}>
                      COMMUNITY SUBMISSIONS
                      {filterCat !== "all" && <span style={{ color: getCat(filterCat).color, marginLeft: 8 }}>— {getCat(filterCat).label}</span>}
                      <span style={{ color: T.text4, marginLeft: 8, fontSize: 9 }}>{showMoreFeed ? `showing last ${Math.min(FEED_CAP, allFiltered.length)}` : `showing last ${Math.min(FEED_DEFAULT, allFiltered.length)} of ${Math.min(FEED_CAP, allFiltered.length)}`}</span>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                      {["all", "scam", "suspicious", "safe"].map(s => (
                        <button key={s} onClick={() => handleFilterChange(setFilterStatus, s)} style={{ background: filterStatus === s ? `${statusColors[s]}18` : "none", border: `1px solid ${filterStatus === s ? statusColors[s] : T.cardBorder}`, color: filterStatus === s ? statusColors[s] : T.text4, padding: "4px 10px", borderRadius: 20, fontSize: 9, cursor: "pointer", fontFamily: "monospace", letterSpacing: 2, textTransform: "uppercase", transition: "all 0.15s" }}>{s}</button>
                      ))}
                      <span className="filter-divider" style={{ width: 1, height: 16, background: T.cardBorder, flexShrink: 0 }} />
                      {["all", "public", "private", "anonymous"].map(v => {
                        const vOpt = VISIBILITY_OPTIONS.find(o => o.id === v);
                        const color = vOpt ? vOpt.color : "#5b6cf8";
                        return <button key={v} onClick={() => handleFilterChange(setFilterVis, v)} style={{ background: filterVis === v ? `${color}18` : "none", border: `1px solid ${filterVis === v ? color : T.cardBorder}`, color: filterVis === v ? color : T.text4, padding: "4px 10px", borderRadius: 20, fontSize: 9, cursor: "pointer", fontFamily: "monospace", letterSpacing: 1, textTransform: "uppercase", transition: "all 0.15s" }}>{v}</button>;
                      })}
                      <span className="filter-divider" style={{ width: 1, height: 16, background: T.cardBorder, flexShrink: 0 }} />
                      <button onClick={() => setSortBy(s => s === "recent" ? "score" : "recent")} style={{ background: "none", border: `1px solid ${T.cardBorder}`, color: T.text4, padding: "4px 10px", borderRadius: 20, fontSize: 9, cursor: "pointer", fontFamily: "monospace", letterSpacing: 1 }}>{sortBy === "recent" ? "NEWEST" : "HIGHEST SCORE"}</button>
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
                    filtered.map((s, i) => <FeedItem key={s.id} s={s} i={i} T={T} />)
                  )}
                  {!dbLoading && allFiltered.length > FEED_DEFAULT && (
                    <button onClick={() => setShowMoreFeed(v => !v)} style={{ marginTop: 16, width: "100%", background: "none", border: `1px dashed ${T.cardBorder}`, color: T.text4, padding: "10px", borderRadius: 8, cursor: "pointer", fontFamily: "monospace", fontSize: 10, letterSpacing: 1, transition: "all 0.15s" }}>
                      {showMoreFeed ? "SHOW LESS" : `+ SHOW ${Math.min(FEED_CAP, allFiltered.length) - FEED_DEFAULT} MORE SUBMISSIONS`}
                    </button>
                  )}
                </div>
              </>
            )}

            {/* NEWS view */}
            {activeView === 'news' && (
              <PageWrapper>
                <div style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 28 }}>
                  <NewsPanel T={T} onClose={() => switchView('dashboard')} />
                </div>
              </PageWrapper>
            )}

            {/* RADAR view */}
            {activeView === 'radar' && (
              <PageWrapper>
                <div style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 28 }}>
                  <RadarPanel T={T} onClose={() => switchView('dashboard')} />
                </div>
              </PageWrapper>
            )}

            {/* FAQ view */}
            {activeView === 'faq' && (
              <PageWrapper>
                <div style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 40 }}>
                  <FAQContent T={T} />
                </div>
              </PageWrapper>
            )}

            {/* DEEP INTEL view */}
            {activeView === 'deep-intel' && (
              <PageWrapper>
                <div style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 28 }}>
                  <DeepIntelContent onClose={() => switchView('dashboard')} prefill={deepIntelPrefill} T={T} />
                </div>
              </PageWrapper>
            )}

            {/* GLOSSARY view */}
            {activeView === 'glossary' && (
              <PageWrapper>
                <div style={{ padding: "32px 0" }}>
                  <GlossaryContent T={T} onScanClick={() => switchView('scanner')} />
                </div>
              </PageWrapper>
            )}

            {/* SCANNER view */}
            {activeView === 'scanner' && (
              <PageWrapper>
                <ScannerPanel onClose={() => switchView('dashboard')} onNewResult={handleNewResult} onDeepIntel={(prefill) => { switchView('dashboard'); setDeepIntelPrefill(prefill || {}); setShowInvestigation(true); }} submissionCounts={Object.fromEntries(SCAM_CATEGORIES.map(c => [c.id, submissions.filter(s => s.category === c.id).length]))} theme={theme} T={T} />
              </PageWrapper>
            )}

          </div>
        </main>

        {/* FOOTER */}
        <footer style={{ borderTop: `1px solid ${T.cardBorder}`, padding: "28px", marginTop: 20, background: T.pageBg }}>
          <div style={{ maxWidth: 1300, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
            <div>
              <PhishScoreLogo T={T} size={14} dotSize={13} />
              <div style={{ fontSize: 10, color: T.text4, fontFamily: "monospace", letterSpacing: 2, marginTop: 4 }}>PROTECTING COMMUNITIES FROM FRAUD</div>
            </div>
            <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
              <button onClick={() => switchView('faq')} style={{ background: "none", border: "none", color: T.text4, cursor: "pointer", fontFamily: "monospace", fontSize: 11, letterSpacing: 1 }}>FAQ</button>
              <button onClick={() => switchView('glossary')} style={{ background: "none", border: "none", color: T.text4, cursor: "pointer", fontFamily: "monospace", fontSize: 11, letterSpacing: 1 }}>GLOSSARY</button>
              <button onClick={() => setShowTransparency(true)} style={{ background: "none", border: "none", color: T.text4, cursor: "pointer", fontFamily: "monospace", fontSize: 11, letterSpacing: 1 }}>TRANSPARENCY</button>
              <button onClick={() => { setLegalTab("terms"); setShowLegal(true); }} style={{ background: "none", border: "none", color: T.text4, cursor: "pointer", fontFamily: "monospace", fontSize: 11, letterSpacing: 1 }}>TERMS</button>
              <button onClick={() => { setLegalTab("privacy"); setShowLegal(true); }} style={{ background: "none", border: "none", color: T.text4, cursor: "pointer", fontFamily: "monospace", fontSize: 11, letterSpacing: 1 }}>PRIVACY</button>
              <a href="mailto:contact@phishscore.ai" style={{ color: T.text4, fontFamily: "monospace", fontSize: 11, textDecoration: "none", letterSpacing: 1 }}>contact@phishscore.ai</a>
              <div style={{ fontSize: 10, color: T.text4, fontFamily: "monospace" }}>2026 PhishScore.ai</div>
            </div>
          </div>
        </footer>
      </div>

      {/* MODALS — only for flows that need overlay (scanner, checkout, transparency, legal, devtools, report) */}
      {isScannerOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ position: "relative", width: "100%", maxWidth: 600, maxHeight: "90vh", overflowY: "auto", background: T.cardBg, borderRadius: 16, padding: 24 }}>
            <button onClick={() => setIsScannerOpen(false)} style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", color: T.text3, cursor: "pointer", fontSize: 20, lineHeight: 1, zIndex: 1 }}>×</button>
            <ScannerPanel onClose={() => setIsScannerOpen(false)} onNewResult={handleNewResult} onDeepIntel={(prefill) => { setIsScannerOpen(false); setDeepIntelPrefill(prefill || {}); setShowInvestigation(true); }} submissionCounts={Object.fromEntries(SCAM_CATEGORIES.map(c => [c.id, submissions.filter(s => s.category === c.id).length]))} theme={theme} T={T} />
          </div>
        </div>
      )}
      {isDeepIntelOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ position: "relative", width: "100%", maxWidth: 600, maxHeight: "90vh", overflowY: "auto", background: T.cardBg, borderRadius: 16, padding: 24 }}>
            <button onClick={() => setIsDeepIntelOpen(false)} style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", color: T.text3, cursor: "pointer", fontSize: 20, lineHeight: 1, zIndex: 1 }}>×</button>
            <DeepIntelContent onClose={() => setIsDeepIntelOpen(false)} prefill={deepIntelPrefill} T={T} />
          </div>
        </div>
      )}
      {showModal && <SubmitModal onClose={() => setShowModal(false)} onNewResult={handleNewResult} onDeepIntel={(prefill) => { setShowModal(false); setDeepIntelPrefill(prefill || {}); setShowInvestigation(true); }} submissionCounts={Object.fromEntries(SCAM_CATEGORIES.map(c => [c.id, submissions.filter(s => s.category === c.id).length]))} theme={theme} T={T} />}
      {showTransparency && <TransparencyPage onClose={() => setShowTransparency(false)} submissions={submissions} T={T} />}
      {showLegal && <LegalPage onClose={() => setShowLegal(false)} initialTab={legalTab} T={T} />}
      {showDevTools && <APITestDashboard onClose={() => { setShowDevTools(false); window.history.replaceState({}, '', '/'); }} onOpenRadar={() => switchView('radar')} onOpenNews={() => switchView('news')} T={T} />}
      {reportCaseId && <ReportStatusModal caseId={reportCaseId} onClose={() => { setReportCaseId(null); window.history.replaceState({}, '', '/'); }} T={T} />}
      {reportToken && <ReportStatusModal token={reportToken} onClose={() => { setReportToken(null); window.history.replaceState({}, '', '/'); }} T={T} />}
      {showInvestigation && <DeepIntelModal onClose={() => { setShowInvestigation(false); setDeepIntelPrefill({}); }} prefill={deepIntelPrefill} T={T} />}
      <InvestigatorChat />

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.15} }
        @keyframes radarNavPulse { 0%{transform:scale(1);opacity:0.6} 100%{transform:scale(2.2);opacity:0} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        * { box-sizing: border-box; }
        body { margin: 0; background: ${T.pageBg}; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: ${T.scrollTrack}; }
        ::-webkit-scrollbar-thumb { background: ${T.scrollThumb}; border-radius: 3px; }
        button { transition: all 0.15s; }
        a { transition: color 0.15s; }
        a:hover { color: #f43f5e !important; }
        .nav-label { display: none; }
        @media (min-width: 768px) { .nav-label { display: inline; } }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        @media (max-width: 767px) {
          .site-header { padding: 12px 14px !important; gap: 8px !important; }
          .nav-scroll-wrapper { overflow-x: auto !important; }
          .nav-buttons { gap: 4px !important; flex-wrap: nowrap !important; padding-bottom: 2px; }
          .nav-btn { height: 34px !important; padding: 0 8px !important; border-radius: 8px !important; flex-shrink: 0 !important; }
          .cta-btn { padding: 9px 12px !important; font-size: 10px !important; border-radius: 10px !important; letter-spacing: 1px !important; flex-shrink: 0 !important; }
          .site-main { padding: 16px 14px !important; }
          .stats-grid { grid-template-columns: repeat(3, 1fr) !important; gap: 4px !important; margin-bottom: 14px !important; }
          .stat-card { padding: 8px 6px !important; border-radius: 8px !important; border-top-width: 2px !important; }
          .stat-label { font-size: 7px !important; letter-spacing: 1px !important; line-height: 1.3 !important; margin-bottom: 4px !important; text-align: center !important; }
          .stat-value { font-size: 18px !important; text-align: center !important; }
          .stat-sub { font-size: 8px !important; text-align: center !important; }
          .cat-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 8px !important; }
          .feed-card { padding: 16px 14px !important; border-radius: 12px !important; }
          .feed-row { grid-template-columns: 44px 1fr !important; gap: 10px !important; }
          .feed-row > *:last-child { grid-column: 2; margin-top: -4px; }
          .filter-divider { display: none !important; }
          .feed-text { display: block; overflow: visible; }
        }
        @media (max-width: 480px) {
          .modal-inner { padding: 20px 16px !important; }
          .modal-inner .step-indicators { gap: 4px !important; }
        }
      `}</style>
    </div>
  );
}
