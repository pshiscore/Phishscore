import { useState, useEffect } from "react";
import { PhishScoreLogo } from "./Primitives";

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

function timeAgo(ts) {
  if (!ts) return "";
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function NewsCard({ item, T }) {
  return (
    <div style={{
      background: T.innerBg,
      border: `1px solid ${T.innerBorder}`,
      borderRadius: 12,
      padding: "18px 20px",
      display: "flex",
      flexDirection: "column",
      gap: 10,
    }}>
      {/* Badge row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{
          fontFamily: "monospace", fontSize: 9, fontWeight: 700, letterSpacing: 2,
          color: "#38bdf8", background: "#38bdf812", border: "1px solid #38bdf830",
          padding: "2px 8px", borderRadius: 20,
        }}>
          {item.source_name?.toUpperCase()}
        </span>
        <span style={{ fontSize: 10, color: T.text4, fontFamily: "monospace" }}>
          {timeAgo(item.published_at)}
        </span>
      </div>

      {/* Hook */}
      <div style={{
        fontSize: 14, fontWeight: 700, color: T.text,
        fontFamily: "Georgia, serif", lineHeight: 1.5,
      }}>
        {item.hook || item.title}
      </div>

      {/* Impact */}
      {item.impact && (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <span style={{ fontSize: 9, fontFamily: "monospace", fontWeight: 700, color: "#fb923c", letterSpacing: 1, flexShrink: 0, marginTop: 2 }}>IMPACT</span>
          <span style={{ fontSize: 12, color: "#fb923c", fontFamily: "Georgia, serif", lineHeight: 1.5 }}>{item.impact}</span>
        </div>
      )}

      {/* Takeaway */}
      {item.takeaway && (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <span style={{ fontSize: 9, fontFamily: "monospace", fontWeight: 700, color: "#34d399", letterSpacing: 1, flexShrink: 0, marginTop: 2 }}>ACTION</span>
          <span style={{ fontSize: 12, color: "#34d399", fontFamily: "Georgia, serif", lineHeight: 1.5 }}>{item.takeaway}</span>
        </div>
      )}

      {/* Source link */}
      <div style={{ marginTop: 4 }}>
        <a
          href={item.article_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 11, color: T.text4, fontFamily: "monospace",
            textDecoration: "none", letterSpacing: 1,
            transition: "color 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.color = "#f43f5e"; }}
          onMouseLeave={e => { e.currentTarget.style.color = T.text4; }}
        >
          READ ORIGINAL SOURCE ↗
        </a>
      </div>
    </div>
  );
}

export function NewsPanel({ T = {}, onClose }) {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchNews() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/threat_news?select=*&order=published_at.desc&limit=10`,
          {
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
            },
          }
        );
        if (!res.ok) throw new Error(`Supabase error: ${res.status}`);
        const data = await res.json();
        setArticles(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("NewsPanel fetch error:", err);
        setError("Could not load threat news. Please try again shortly.");
      } finally {
        setLoading(false);
      }
    }
    fetchNews();
  }, []);

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28, gap: 16 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 4, color: "#38bdf8", fontFamily: "monospace", marginBottom: 8 }}>
            CYBER THREAT BRIEFING
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <PhishScoreLogo T={T} size={20} dotSize={11} />
            <span style={{ fontSize: 20, fontWeight: 800, fontFamily: "monospace", color: T.text3, letterSpacing: 1 }}>
              NEWS
            </span>
          </div>
          <p style={{ color: T.text3, fontFamily: "Georgia, serif", fontSize: 13, lineHeight: 1.6, margin: 0 }}>
            AI-curated cybersecurity intelligence from leading threat research sources.
          </p>
        </div>
        {onClose && (
          <button onClick={onClose} style={{ background: T.innerBg, border: `1px solid ${T.innerBorder}`, color: T.text3, width: 32, height: 32, borderRadius: "50%", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>×</button>
        )}
      </div>

      {/* Body */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: T.text4, fontFamily: "monospace", fontSize: 12 }}>
          LOADING BRIEFING...
        </div>
      ) : error ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "#f43f5e", fontFamily: "monospace", fontSize: 12 }}>
          {error}
        </div>
      ) : articles.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0" }}>
          <div style={{ color: T.text4, fontFamily: "monospace", fontSize: 12, marginBottom: 8 }}>
            NO BRIEFINGS AVAILABLE YET
          </div>
          <div style={{ color: T.text4, fontFamily: "Georgia, serif", fontSize: 13 }}>
            The news pipeline is warming up. Check back shortly.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {articles.map(item => (
            <NewsCard key={item.id} item={item} T={T} />
          ))}
        </div>
      )}
    </div>
  );
}

export default NewsPanel;
