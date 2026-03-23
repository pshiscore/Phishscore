import { useState } from "react";
import { CatIconSvg } from "./Primitives";

export default function CategoryBreakdown({ catCounts, maxCount, filterCat, setFilterCat, T = {} }) {
  const [showAll, setShowAll] = useState(false);
  // Desktop shows 5, mobile shows 3 — controlled via CSS class on each card
  const DEFAULT_MOBILE = 3;
  const DEFAULT_DESKTOP = 5;
  const visible = showAll ? catCounts : catCounts.slice(0, DEFAULT_DESKTOP);
  const hasMore = catCounts.length > DEFAULT_DESKTOP;
  const hasMoreMobile = catCounts.length > DEFAULT_MOBILE;
  return (
    <div style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 24, marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div style={{ fontSize: 10, letterSpacing: 3, color: T.text3, fontFamily: "monospace" }}>
          BREAKDOWN BY SCAM TYPE - <span style={{ color: T.text3 }}>click to filter</span>
        </div>
        {(hasMore || hasMoreMobile) && (
          <span style={{ fontSize: 9, color: T.text4, fontFamily: "monospace" }}>
            {showAll ? `showing all ${catCounts.length}` : (
              <>
                <span className="breakdown-mobile-count">showing top 3 of {catCounts.length}</span>
                <span className="breakdown-desktop-count">showing top 5 of {catCounts.length}</span>
              </>
            )}
          </span>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
        {visible.map((cat, i) => {
          const active = filterCat === cat.id;
          // Cards 4 and 5 (index 3, 4) hidden on mobile, shown on desktop
          const isDesktopOnly = i >= DEFAULT_MOBILE;
          return (
            <button key={cat.id} onClick={() => setFilterCat(active ? "all" : cat.id)}
              className={isDesktopOnly ? "breakdown-desktop-only" : ""}
              style={{ background: active ? `${cat.color}14` : T.innerBg, border: `1.5px solid ${active ? cat.color : T.innerBorder}`, borderRadius: 10, padding: "12px 14px", cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <CatIconSvg icon={cat.icon} color={active ? "#ffffff" : T.text3} size={14} />
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
      {(hasMore || hasMoreMobile) && (
        <button onClick={() => setShowAll(v => !v)} style={{ marginTop: 12, width: "100%", background: "none", border: `1px dashed ${T.cardBorder}`, color: T.text4, padding: "8px", borderRadius: 8, cursor: "pointer", fontFamily: "monospace", fontSize: 10, letterSpacing: 1, transition: "all 0.15s" }}>
          {showAll ? "SHOW LESS" : `+ ${catCounts.length - DEFAULT_DESKTOP} MORE CATEGORIES`}
        </button>
      )}
      <style>{`
        @media (max-width: 767px) {
          .breakdown-desktop-only { display: none !important; }
          .breakdown-desktop-count { display: none !important; }
        }
        @media (min-width: 768px) {
          .breakdown-mobile-count { display: none !important; }
        }
      `}</style>
    </div>
  );
}
