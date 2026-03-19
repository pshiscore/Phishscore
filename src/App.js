import { useState, useEffect } from "react";
import { SCAM_CATEGORIES, VISIBILITY_OPTIONS, THEMES, getScoreColor, getStatusLabel, getCat, timeAgo } from "./constants";
import db from "./db";
import { ScoreRing, CatIconSvg, VisibilityBadge, SourceBadge, PhishScoreLogo } from "./components/Primitives";
import CategoryBreakdown from "./components/CategoryBreakdown";
import SubmitModal from "./components/SubmitModal";
import FAQPage from "./components/FAQPage";
import TransparencyPage from "./components/TransparencyPage";

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

  useEffect(() => { loadSubmissions(); }, []);

  const loadSubmissions = async () => {
    setDbLoading(true);
    try { const data = await db.getSubmissions(); if (Array.isArray(data)) setSubmissions(data); } catch (e) { console.error(e); }
    setDbLoading(false);
  };

  const handleNewResult = async ({ category, text, result, source, visibility, classificationNote, summary }) => {
    const isAnon = visibility === "anonymous";
    const newSub = {
      category,
      source: isAnon ? null : (source || "user-submitted"),
      // CHANGE: store AI summary instead of raw text slice; fall back to short preview if no summary
      summary: isAnon ? null : (summary || null),
      preview: isAnon ? null : (text.slice(0, 80) + (text.length > 80 ? "..." : "")),
      score: result.score,
      tags: result.tags || [],
      visibility: visibility || "public",
      classification_note: classificationNote || null,
      gsb_flagged: result.safeBrowsingFlagged === true,
      radar_flagged: result.radarFlagged === true,
      urlhaus_flagged: result.urlhausFlagged === true,
    };
    try {
      const saved = await db.insertSubmission(newSub);
      if (Array.isArray(saved) && saved[0]) { setSubmissions(prev => [saved[0], ...prev]); }
      else { setSubmissions(prev => [{ ...newSub, id: Date.now(), created_at: new Date().toISOString() }, ...prev]); }
    } catch { setSubmissions(prev => [{ ...newSub, id: Date.now(), created_at: new Date().toISOString() }, ...prev]); }
  };

  const total = submissions.length;
  const scams = submissions.filter(s => s.score >= 75).length;
  const suspicious = submissions.filter(s => s.score >= 45 && s.score < 75).length;
  const safe = submissions.filter(s => s.score < 45).length;

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
    <div style={{ minHeight: "100vh", background: T.pageBg, color: T.text, fontFamily: "Georgia, serif" }}>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 70% 50% at 5% 0%, #f43f5e08, transparent 55%), radial-gradient(ellipse 50% 40% at 95% 100%, #a78bfa07, transparent 55%)" }} />
      <div style={{ position: "relative" }}>

        {/* ANNOUNCEMENT BAR */}
        {!barDismissed && (
          <div style={{ background: theme === "dark" ? "linear-gradient(90deg, #1a0a1a, #0a0d1a, #1a0a1a)" : "#fff5f5", borderBottom: "1px solid #f43f5e33", padding: "10px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 9, color: "#f43f5e", fontFamily: "monospace", letterSpacing: 3, flexShrink: 0 }}>PHISHSCORE.AI</span>
              <span style={{ fontSize: 12, color: "#94a3b8", fontFamily: "Georgia, serif" }}>Got a suspicious message? Paste it, screenshot it, get an instant AI scam score.</span>
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
            <PhishScoreLogo T={T} size={22} dotSize={13} />
            <div style={{ fontSize: 9, color: T.text4, letterSpacing: 3, fontFamily: "monospace" }}>COMMUNITY SCAM INTELLIGENCE DASHBOARD</div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={() => setShowFAQ(true)} style={{ background: "none", border: `1px solid ${T.headerBorder}`, color: T.text3, padding: "10px 18px", borderRadius: 10, fontSize: 11, cursor: "pointer", fontFamily: "monospace", letterSpacing: 1 }}>FAQ</button>
            <button onClick={toggleTheme} style={{ background: "none", border: `1px solid ${T.headerBorder}`, color: T.text3, padding: "10px 18px", borderRadius: 10, fontSize: 11, cursor: "pointer", fontFamily: "monospace", letterSpacing: 1 }}>{theme === "dark" ? "LIGHT" : "DARK"}</button>
            <button onClick={() => setShowModal(true)} style={{ background: "linear-gradient(135deg,#f43f5e,#be123c)", border: "none", color: "#fff", padding: "13px 26px", borderRadius: 12, fontSize: 12, fontWeight: 700, letterSpacing: 2, cursor: "pointer", fontFamily: "monospace", boxShadow: "0 4px 24px rgba(244,63,94,0.4)" }} onMouseEnter={e => e.currentTarget.style.transform = "scale(1.04)"} onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
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
          {catCounts.length > 0 && <CategoryBreakdown catCounts={catCounts} maxCount={maxCount} filterCat={filterCat} setFilterCat={setFilterCat} T={T} />}

          {/* FEED */}
          <div style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
              <div style={{ fontSize: 10, letterSpacing: 3, color: T.text3, fontFamily: "monospace" }}>
                COMMUNITY SUBMISSIONS
                {filterCat !== "all" && <span style={{ color: getCat(filterCat).color, marginLeft: 8 }}>- {getCat(filterCat).label}</span>}
                <span style={{ color: T.text4, marginLeft: 8, fontSize: 9 }}>{showMoreFeed ? `showing last ${Math.min(FEED_CAP, allFiltered.length)}` : `showing last ${Math.min(FEED_DEFAULT, allFiltered.length)} of ${Math.min(FEED_CAP, allFiltered.length)}`}</span>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                {["all", "scam", "suspicious", "safe"].map(s => (
                  <button key={s} onClick={() => handleFilterChange(setFilterStatus, s)} style={{ background: filterStatus === s ? `${statusColors[s]}18` : "none", border: `1px solid ${filterStatus === s ? statusColors[s] : T.cardBorder}`, color: filterStatus === s ? statusColors[s] : T.text4, padding: "4px 10px", borderRadius: 20, fontSize: 9, cursor: "pointer", fontFamily: "monospace", letterSpacing: 2, textTransform: "uppercase", transition: "all 0.15s" }}>{s}</button>
                ))}
                <div style={{ width: 1, height: 16, background: T.cardBorder }} />
                {["all", "public", "private", "anonymous"].map(v => {
                  const vOpt = VISIBILITY_OPTIONS.find(o => o.id === v);
                  const color = vOpt ? vOpt.color : "#5b6cf8";
                  return <button key={v} onClick={() => handleFilterChange(setFilterVis, v)} style={{ background: filterVis === v ? `${color}18` : "none", border: `1px solid ${filterVis === v ? color : T.cardBorder}`, color: filterVis === v ? color : T.text4, padding: "4px 10px", borderRadius: 20, fontSize: 9, cursor: "pointer", fontFamily: "monospace", letterSpacing: 1, textTransform: "uppercase", transition: "all 0.15s" }}>{v}</button>;
                })}
                <div style={{ width: 1, height: 16, background: T.cardBorder }} />
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
              filtered.map((s, i) => {
                const cat = getCat(s.category), sc = getScoreColor(s.score), vis = s.visibility || "public", isHidden = vis === "private" || vis === "anonymous";
                return (
                  <div key={s.id} style={{ display: "grid", gridTemplateColumns: "56px 1fr auto", gap: 16, padding: "16px 0", borderTop: i > 0 ? `1px solid ${T.feedDivider}` : "none", alignItems: "start" }}>
                    <ScoreRing score={s.score} size={52} trackColor={T.ringTrack} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 6, marginBottom: 5, flexWrap: "wrap", alignItems: "center" }}>
                        <span style={{ background: `${cat.color}14`, border: `1px solid ${cat.color}35`, color: cat.color, fontSize: 9, padding: "2px 8px", borderRadius: 20, fontFamily: "monospace", letterSpacing: 1, display: "flex", alignItems: "center", gap: 4 }}><CatIconSvg icon={cat.icon} color={cat.color} size={10} />{cat.label}</span>
                        {(s.tags || []).slice(0, 2).map(t => <span key={t} style={{ background: T.tagBg, color: T.tagColor, fontSize: 9, padding: "2px 8px", borderRadius: 20, fontFamily: "monospace" }}>{t}</span>)}
                        <VisibilityBadge visibility={vis} />
                        {s.classification_note === "auto" && <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 20, color: "#a78bfa", border: "1px solid #a78bfa40", background: "#a78bfa12", fontFamily: "monospace", letterSpacing: 1 }}>AUTO</span>}
                        {s.classification_note === "reclassified" && <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 20, color: "#f97316", border: "1px solid #f9731640", background: "#f9731612", fontFamily: "monospace", letterSpacing: 1 }}>RECLASSIFIED</span>}
                        <span style={{ fontSize: 9, color: T.text4, fontFamily: "monospace", marginLeft: "auto" }}>{timeAgo(s.created_at)}</span>
                      </div>
                      {isHidden ? (
                        <div style={{ fontSize: 12, color: T.text4, fontFamily: "monospace", fontStyle: "italic", marginBottom: 4 }}>{vis === "anonymous" ? "Anonymous submission - content not stored" : "Private submission - content hidden"}</div>
                      ) : (
                        // CHANGE: show AI summary if available, fall back to raw preview for older submissions
                        <div style={{ fontSize: 13, color: T.text3, lineHeight: 1.6, marginBottom: 6, fontFamily: "Georgia, serif" }}>
                          {s.summary || s.preview || ""}
                        </div>
                      )}
                      {!isHidden && s.source && s.source !== "user-submitted" && (() => {
                        // CHANGE: only show badge if source contains a phone or email — no domains or URLs
                        try {
                          const sources = JSON.parse(s.source);
                          const filtered = Array.isArray(sources)
                            ? sources.filter(v => v && (v.includes("@") || /^[\+\d\s\-\(\)]{7,}$/.test(v.trim())))
                            : [];
                          return filtered.length > 0 ? <SourceBadge source={JSON.stringify(filtered)} /> : null;
                        } catch {
                          const v = s.source.trim();
                          return (v.includes("@") || /^[\+\d\s\-\(\)]{7,}$/.test(v)) ? <SourceBadge source={s.source} /> : null;
                        }
                      })()}
                    </div>
                    <div style={{ padding: "5px 10px", borderRadius: 20, fontSize: 9, fontWeight: 800, letterSpacing: 2, color: sc, border: `1px solid ${sc}35`, background: `${sc}0d`, whiteSpace: "nowrap", fontFamily: "monospace" }}>{getStatusLabel(s.score)}</div>
                  </div>
                );
              })
            )}
            {!dbLoading && allFiltered.length > FEED_DEFAULT && (
              <button onClick={() => setShowMoreFeed(v => !v)} style={{ marginTop: 16, width: "100%", background: "none", border: `1px dashed ${T.cardBorder}`, color: T.text4, padding: "10px", borderRadius: 8, cursor: "pointer", fontFamily: "monospace", fontSize: 10, letterSpacing: 1, transition: "all 0.15s" }}>
                {showMoreFeed ? "SHOW LESS" : `+ SHOW ${Math.min(FEED_CAP, allFiltered.length) - FEED_DEFAULT} MORE SUBMISSIONS`}
              </button>
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
              <button onClick={() => setShowFAQ(true)} style={{ background: "none", border: "none", color: T.text4, cursor: "pointer", fontFamily: "monospace", fontSize: 11, letterSpacing: 1 }}>FAQ</button>
              <button onClick={() => setShowTransparency(true)} style={{ background: "none", border: "none", color: T.text4, cursor: "pointer", fontFamily: "monospace", fontSize: 11, letterSpacing: 1 }}>TRANSPARENCY</button>
              <a href="mailto:contact@phishscore.ai" style={{ color: T.text4, fontFamily: "monospace", fontSize: 11, textDecoration: "none", letterSpacing: 1 }}>contact@phishscore.ai</a>
              <div style={{ fontSize: 10, color: T.text4, fontFamily: "monospace" }}>2026 PhishScore.ai</div>
            </div>
          </div>
        </footer>
      </div>

      {/* MODALS */}
      {showModal && <SubmitModal onClose={() => setShowModal(false)} onNewResult={handleNewResult} submissionCounts={Object.fromEntries(SCAM_CATEGORIES.map(c => [c.id, submissions.filter(s => s.category === c.id).length]))} theme={theme} T={T} />}
      {/* FIX: pass T to FAQPage and TransparencyPage so they respect the theme */}
      {showFAQ && <FAQPage onClose={() => setShowFAQ(false)} T={T} />}
      {showTransparency && <TransparencyPage onClose={() => setShowTransparency(false)} submissions={submissions} T={T} />}

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
        @media (max-width: 480px) {
          .modal-inner { padding: 20px 16px !important; }
          .modal-inner .step-indicators { gap: 4px !important; }
        }
      `}</style>
    </div>
  );
}
