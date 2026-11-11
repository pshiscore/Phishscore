import { useState, useEffect } from "react";
import useAsyncStatus from '../hooks/useAsyncStatus';
import { PhishScoreLogo } from "./Primitives";


// TEMP: hidden for production simplification — do not remove code
const SHOW_WEEKLY_BRIEF = false;

const SOURCES = [
  'all',
  'BleepingComputer',
  'Writer Beware',
  'The Record',
  'Ars Technica',
  'Fraud of the Day',
  'TorrentFreak',
];

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

function SubscribeModal({ T, onClose }) {
  const [email, setEmail] = useState('');
  // Subscribe lifecycle: idle → running → success | error (see src/asyncStatus.js).
  const sub = useAsyncStatus();
  const { status } = sub;
  const errorMsg = sub.isError ? (sub.error || 'Something went wrong. Please try again.') : '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    sub.run(async () => {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Subscription failed');
      return data;
    });
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 20, width: "100%", maxWidth: 460, padding: "36px 32px", position: "relative" }}>

        {/* Close */}
        <button onClick={onClose} style={{ position: "absolute", top: 14, right: 14, background: T.innerBg, border: `1px solid ${T.innerBorder}`, color: T.text3, width: 30, height: 30, borderRadius: "50%", cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>

        {/* Header */}
        <div style={{ fontSize: 9, letterSpacing: 4, color: "#a78bfa", fontFamily: "monospace", marginBottom: 10 }}>WEEKLY INTELLIGENCE</div>
        <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "monospace", color: T.text, marginBottom: 6, letterSpacing: 0.5 }}>PhishScore Weekly Brief</div>
        <p style={{ fontSize: 13, color: T.text3, fontFamily: "Georgia, serif", lineHeight: 1.6, margin: "0 0 24px" }}>
          One email per week. The most critical threats, synthesized by AI.
        </p>

        {status === 'success' ? (
          <div style={{ background: "#081410", border: "1px solid #34d39930", borderRadius: 12, padding: "18px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>✓</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#34d399", fontFamily: "monospace", letterSpacing: 1, marginBottom: 6 }}>YOU'RE IN</div>
            <div style={{ fontSize: 12, color: T.text3, fontFamily: "Georgia, serif", lineHeight: 1.6 }}>Check your inbox for a confirmation. Your first briefing arrives next week.</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                style={{ flex: 1, background: T.inputBg, border: `1.5px solid ${status === 'error' ? '#f43f5e' : T.inputBorder}`, borderRadius: 10, color: T.text, padding: "10px 14px", fontSize: 13, fontFamily: "monospace", outline: "none", boxSizing: "border-box" }}
                onFocus={e => e.target.style.borderColor = "#a78bfa55"}
                onBlur={e => e.target.style.borderColor = status === 'error' ? '#f43f5e' : T.inputBorder}
              />
              <button
                type="submit"
                disabled={status === 'running'}
                style={{ background: status === 'running' ? T.innerBg : "linear-gradient(135deg,#a78bfa,#7c3aed)", border: "none", color: status === 'running' ? T.text4 : "#fff", padding: "10px 20px", borderRadius: 10, fontSize: 11, fontWeight: 700, letterSpacing: 1.5, cursor: status === 'running' ? "default" : "pointer", fontFamily: "monospace", whiteSpace: "nowrap" }}>
                {status === 'running' ? '...' : 'SUBSCRIBE'}
              </button>
            </div>
            {status === 'error' && (
              <div style={{ fontSize: 11, color: "#f43f5e", fontFamily: "monospace", marginBottom: 14 }}>{errorMsg}</div>
            )}
          </form>
        )}

        {/* AI Transparency Note */}
        <div style={{ background: "rgba(167,139,250,0.07)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 12, padding: "14px 16px", marginTop: status === 'success' ? 16 : 0 }}>
          <div style={{ fontSize: 9, fontFamily: "monospace", fontWeight: 700, letterSpacing: 2, color: "#a78bfa", marginBottom: 6 }}>🤖 AI TRANSPARENCY</div>
          <p style={{ fontSize: 11, color: T.text3, fontFamily: "Georgia, serif", lineHeight: 1.65, margin: "0 0 8px" }}>
            <strong style={{ color: T.text2 }}>100% AI-Generated.</strong> This briefing is autonomously synthesized by AI. We use Cohere's enterprise RAG (Retrieval-Augmented Generation) models to digest thousands of community reports and global threat feeds into a single, zero-hallucination newsletter. No human writers involved.
          </p>
          <p style={{ fontSize: 10, color: T.text4, fontFamily: "monospace", letterSpacing: 0.5, margin: 0 }}>
            One email per week. Unsubscribe anytime. We never sell your data.
          </p>
        </div>

      </div>
    </div>
  );
}

export function NewsPanel({ T = {}, onClose }) {
  // Feed lifecycle: idle → running → success | error (see src/asyncStatus.js).
  // It fetches on mount, so "loading" means "not settled yet": the spinner is
  // up from the first frame, exactly as useState(true) was.
  const feed = useAsyncStatus();
  const { run: loadFeed } = feed;
  const articles = feed.data || [];
  const loading = !feed.isSuccess && !feed.isError;
  const error = feed.isError ? "Could not load threat news. Please try again shortly." : null;
  const [activeSource, setActiveSource] = useState('all');
  const [showSubscribe, setShowSubscribe] = useState(false);

  useEffect(() => {
    loadFeed(async () => {
      try {
        const res = await fetch('/api/get-news');
        if (!res.ok) throw new Error(`Failed to load news: ${res.status}`);
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      } catch (err) {
        console.error("NewsPanel fetch error:", err);
        throw err;
      }
    });
  }, [loadFeed]);

  const visibleNews = activeSource === 'all'
    ? articles
    : articles.filter(a => a.source_name === activeSource);

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, gap: 16 }}>
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

      {/* Source filter buttons + subscribe CTA */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 20 }}>
        {SOURCES.map(src => {
          const active = activeSource === src;
          return (
            <button
              key={src}
              onClick={() => setActiveSource(src)}
              style={{
                background: active ? T.cardBorder : T.innerBg,
                border: `1px solid ${active ? "#38bdf8" : T.innerBorder}`,
                color: active ? "#38bdf8" : T.text4,
                padding: "4px 10px",
                borderRadius: 20,
                fontSize: 10,
                fontWeight: active ? 700 : 400,
                fontFamily: "monospace",
                letterSpacing: 1,
                cursor: "pointer",
                textTransform: "uppercase",
                transition: "all 0.15s",
              }}
            >
              {src}
            </button>
          );
        })}
        {SHOW_WEEKLY_BRIEF && (
          <button
            onClick={() => setShowSubscribe(true)}
            style={{ marginLeft: "auto", background: "linear-gradient(135deg,#a78bfa,#7c3aed)", border: "none", color: "#fff", padding: "5px 14px", borderRadius: 20, fontSize: 10, fontWeight: 700, letterSpacing: 1, cursor: "pointer", fontFamily: "monospace", whiteSpace: "nowrap", flexShrink: 0 }}
          >
            📬 GET THE WEEKLY BRIEF
          </button>
        )}
      </div>

      {SHOW_WEEKLY_BRIEF && showSubscribe && <SubscribeModal T={T} onClose={() => setShowSubscribe(false)} />}

      {/* Body */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: T.text4, fontFamily: "monospace", fontSize: 12 }}>
          LOADING BRIEFING...
        </div>
      ) : error ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "#f43f5e", fontFamily: "monospace", fontSize: 12 }}>
          {error}
        </div>
      ) : visibleNews.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0" }}>
          <div style={{ color: T.text4, fontFamily: "monospace", fontSize: 12, marginBottom: 8 }}>
            {activeSource === 'all' ? 'NO BRIEFINGS AVAILABLE YET' : `NO ARTICLES FROM ${activeSource.toUpperCase()} YET`}
          </div>
          <div style={{ color: T.text4, fontFamily: "Georgia, serif", fontSize: 13 }}>
            {activeSource === 'all' ? 'The news pipeline is warming up. Check back shortly.' : 'Try selecting a different source or check back after the next refresh.'}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {visibleNews.map(item => (
            <NewsCard key={item.id} item={item} T={T} />
          ))}
        </div>
      )}
    </div>
  );
}

export default NewsPanel;
