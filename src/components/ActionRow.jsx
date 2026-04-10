import { useState, useRef, useEffect } from 'react';

const SCORE_COLOR = (score) => {
  if (score >= 76) return '#f43f5e';
  if (score >= 51) return '#fb923c';
  if (score >= 21) return '#fbbf24';
  return '#34d399';
};

const SCORE_LABEL = (score) => {
  if (score >= 76) return 'HIGH RISK';
  if (score >= 51) return 'SUSPICIOUS';
  if (score >= 21) return 'LOW RISK';
  return 'LIKELY SAFE';
};

export default function ActionRow({ T, onAnalyzeThreat }) {
  const [omniOpen, setOmniOpen] = useState(false);
  const [input, setInput] = useState('');
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);
  const omniRef = useRef(null);

  useEffect(() => {
    if (omniOpen) {
      setTimeout(() => inputRef.current?.focus(), 120);
      setTimeout(() => omniRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 150);
    }
  }, [omniOpen]);

  async function runScan() {
    if (!input.trim() || loading) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch('/api/quick-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: input.trim() }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Scan failed');
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); runScan(); }
  }

  function reset() {
    setInput('');
    setResult(null);
    setError(null);
    inputRef.current?.focus();
  }

  const accentBlue = '#5b6cf8';
  const accentRed = '#f43f5e';

  return (
    <div style={{ marginBottom: 24 }}>

      {/* Action Row — 50/50 split */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 12,
      }} className="action-row-grid">

        {/* Quick Scan */}
        <button
          onClick={() => { setOmniOpen(o => !o); setResult(null); setError(null); }}
          style={{
            background: omniOpen
              ? `${accentBlue}18`
              : T.cardBg,
            border: `1.5px solid ${omniOpen ? accentBlue : T.cardBorder}`,
            borderRadius: 14,
            padding: '18px 22px',
            cursor: 'pointer',
            textAlign: 'left',
            color: T.text,
            transition: 'all 0.2s',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 18 }}>⚡</span>
            <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, letterSpacing: 2, color: omniOpen ? accentBlue : T.text }}>
              QUICK SCAN
            </span>
          </div>
          <div style={{ fontFamily: 'sans-serif', fontSize: 12, color: T.text3, lineHeight: 1.5, paddingLeft: 28 }}>
            Best for checking phone numbers, sender emails, or malicious URLs.
          </div>
        </button>

        {/* Analyze Threat */}
        <button
          onClick={onAnalyzeThreat}
          style={{
            background: T.cardBg,
            border: `1.5px solid ${T.cardBorder}`,
            borderRadius: 14,
            padding: '18px 22px',
            cursor: 'pointer',
            textAlign: 'left',
            color: T.text,
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = accentRed; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = T.cardBorder; }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 18 }}>🔬</span>
            <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, letterSpacing: 2, color: T.text }}>
              ANALYZE THREAT
            </span>
          </div>
          <div style={{ fontFamily: 'sans-serif', fontSize: 12, color: T.text3, lineHeight: 1.5, paddingLeft: 28 }}>
            Best for complex scams, full email chains, and deep forensic context.
          </div>
        </button>
      </div>

      {/* Omni-Box — expands below when Quick Scan is active */}
      {omniOpen && (
        <div ref={omniRef} style={{
          marginTop: 10,
          background: T.cardBg,
          border: `1.5px solid ${focused ? accentBlue : T.cardBorder}`,
          borderRadius: 14,
          overflow: 'hidden',
          transition: 'border-color 0.2s',
        }}>
          {/* Input area */}
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => { setInput(e.target.value); setResult(null); setError(null); }}
              onKeyDown={onKeyDown}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Enter a phone number, email, or paste a link..."
              rows={2}
              disabled={loading}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                padding: '16px 18px',
                color: T.text,
                fontSize: 14,
                fontFamily: 'sans-serif',
                lineHeight: 1.6,
                resize: 'none',
                opacity: loading ? 0.5 : 1,
              }}
            />
            <div style={{ padding: '12px 12px', flexShrink: 0, display: 'flex', gap: 6 }}>
              {result && (
                <button onClick={reset} style={{
                  background: 'none', border: `1px solid ${T.cardBorder}`, borderRadius: 8,
                  padding: '8px 12px', color: T.text3, fontFamily: 'monospace', fontSize: 10,
                  letterSpacing: 1, cursor: 'pointer',
                }}>
                  CLEAR
                </button>
              )}
              <button
                onClick={runScan}
                disabled={loading || !input.trim()}
                style={{
                  background: loading || !input.trim()
                    ? 'rgba(255,255,255,0.05)'
                    : `linear-gradient(135deg, ${accentBlue}, #a78bfa)`,
                  border: 'none', borderRadius: 8,
                  padding: '8px 18px',
                  color: loading || !input.trim() ? T.text3 : '#fff',
                  fontFamily: 'monospace', fontSize: 11, fontWeight: 700, letterSpacing: 2,
                  cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s', whiteSpace: 'nowrap',
                }}
              >
                {loading ? 'SCANNING...' : 'QUICK SCAN'}
              </button>
            </div>
          </div>

          {/* Type hints */}
          <div style={{ padding: '0 18px 12px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['URL / Link', 'Email Address', 'Phone Number', 'SMS / Message'].map(hint => (
              <span key={hint} style={{
                fontFamily: 'monospace', fontSize: 9, letterSpacing: 1, color: T.text3,
                background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.cardBorder}`,
                borderRadius: 5, padding: '2px 8px',
              }}>{hint}</span>
            ))}
          </div>

          {/* Loading */}
          {loading && (
            <div style={{ padding: '16px 18px', borderTop: `1px solid ${T.cardBorder}`, display: 'flex', alignItems: 'center', gap: 10 }}>
              {[0,1,2].map(d => (
                <div key={d} style={{
                  width: 7, height: 7, borderRadius: '50%', background: accentBlue,
                  animation: 'investigatorPulse 1.2s ease-in-out infinite',
                  animationDelay: `${d * 0.2}s`,
                }} />
              ))}
              <span style={{ fontFamily: 'monospace', fontSize: 10, color: T.text3, letterSpacing: 2 }}>RUNNING SCAN...</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ padding: '14px 18px', borderTop: `1px solid ${T.cardBorder}`, background: 'rgba(244,63,94,0.05)' }}>
              <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#f43f5e' }}>ERROR: {error}</span>
            </div>
          )}

          {/* Result */}
          {result && !loading && (
            <div style={{ borderTop: `1px solid ${T.cardBorder}`, padding: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
                {/* Score ring */}
                <div style={{
                  width: 64, height: 64, borderRadius: '50%',
                  border: `3px solid ${SCORE_COLOR(result.score)}`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, background: `${SCORE_COLOR(result.score)}10`,
                }}>
                  <div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 800, color: SCORE_COLOR(result.score), lineHeight: 1 }}>{result.score}</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 7, color: SCORE_COLOR(result.score), letterSpacing: 1 }}>/100</div>
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{
                      fontFamily: 'monospace', fontSize: 9, letterSpacing: 2, fontWeight: 700,
                      color: SCORE_COLOR(result.score),
                      background: `${SCORE_COLOR(result.score)}18`,
                      border: `1px solid ${SCORE_COLOR(result.score)}40`,
                      borderRadius: 5, padding: '2px 8px',
                    }}>{SCORE_LABEL(result.score)}</span>
                    <span style={{
                      fontFamily: 'monospace', fontSize: 9, letterSpacing: 1,
                      color: T.text3, background: 'rgba(255,255,255,0.04)',
                      border: `1px solid ${T.cardBorder}`, borderRadius: 5, padding: '2px 8px',
                      textTransform: 'uppercase',
                    }}>{result.category}</span>
                    <span style={{
                      fontFamily: 'monospace', fontSize: 9, letterSpacing: 1,
                      color: '#a78bfa', background: 'rgba(167,139,250,0.08)',
                      border: '1px solid rgba(167,139,250,0.2)', borderRadius: 5, padding: '2px 8px',
                      textTransform: 'uppercase',
                    }}>{result.input_type}</span>
                  </div>
                  <div style={{ fontFamily: 'sans-serif', fontSize: 13, color: T.text2, lineHeight: 1.5 }}>
                    {result.summary}
                  </div>
                </div>
              </div>

              {/* OSINT flags */}
              {result.osint && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {result.osint.fraud_score !== null && (
                    <OsintPill label="IPQS FRAUD" value={`${result.osint.fraud_score}/100`} color={result.osint.fraud_score > 50 ? '#f43f5e' : '#34d399'} T={T} />
                  )}
                  {result.osint.recent_abuse && (
                    <OsintPill label="RECENT ABUSE" value="FLAGGED" color="#f43f5e" T={T} />
                  )}
                  {result.osint.disposable && (
                    <OsintPill label="DISPOSABLE EMAIL" value="YES" color="#fb923c" T={T} />
                  )}
                  {result.osint.spam_trap && (
                    <OsintPill label="SPAM TRAP" value="YES" color="#f43f5e" T={T} />
                  )}
                  {result.osint.line_type && (
                    <OsintPill label="LINE TYPE" value={result.osint.line_type} color={result.osint.line_type === 'VOIP' ? '#f43f5e' : T.text3} T={T} />
                  )}
                  {result.osint.carrier && (
                    <OsintPill label="CARRIER" value={result.osint.carrier} color={T.text3} T={T} />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <style>{`
        @media (max-width: 767px) {
          .action-row-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function OsintPill({ label, value, color, T }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      background: `${color}10`, border: `1px solid ${color}30`,
      borderRadius: 6, padding: '3px 10px',
    }}>
      <span style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: 1, color: T.text3 }}>{label}</span>
      <span style={{ fontFamily: 'monospace', fontSize: 9, fontWeight: 700, color }}>{value}</span>
    </div>
  );
}
