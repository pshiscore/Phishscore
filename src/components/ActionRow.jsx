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

export default function ActionRow({ T, onAnalyzeThreat, analyzerOpen }) {
  // activePanel: null | 'quickscan' | 'analyze'
  const [activePanel, setActivePanel] = useState(null);

  // Sync: when analyzer is closed externally, clear analyze panel
  useEffect(() => {
    if (!analyzerOpen && activePanel === 'analyze') setActivePanel(null);
  }, [analyzerOpen, activePanel]);
  const [input, setInput] = useState('');
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);
  const omniRef = useRef(null);

  const omniOpen = activePanel === 'quickscan';

  useEffect(() => {
    if (omniOpen) {
      setTimeout(() => inputRef.current?.focus(), 120);
      setTimeout(() => omniRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 150);
    }
  }, [omniOpen]);

  function openQuickScan() {
    setActivePanel(p => p === 'quickscan' ? null : 'quickscan');
    setResult(null);
    setError(null);
  }

  function openAnalyzeThreat() {
    setActivePanel('analyze');
    onAnalyzeThreat();
  }

  function closePanel() {
    setActivePanel(null);
    setResult(null);
    setError(null);
    setInput('');
  }

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

  const accentRed = '#f43f5e';
  const accentBlue = '#5b6cf8';
  const panelOpen = activePanel !== null;

  return (
    <div style={{ marginBottom: 24 }}>

      {/* Action Row — hidden when a panel is open */}
      {!panelOpen && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="action-row-grid">

          {/* Quick Scan */}
          <button
            onClick={openQuickScan}
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
              <span style={{ fontSize: 18 }}>⚡</span>
              <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, letterSpacing: 2, color: accentRed }}>
                QUICK SCAN
              </span>
            </div>
            <div style={{ fontFamily: 'sans-serif', fontSize: 14, fontWeight: 700, color: T.text3, lineHeight: 1.5, paddingLeft: 28 }}>
              Best for checking phone numbers, sender emails, or malicious URLs.
            </div>
          </button>

          {/* Analyze Threat */}
          <button
            onClick={openAnalyzeThreat}
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
              <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, letterSpacing: 2, color: accentRed }}>
                ANALYZE THREAT
              </span>
            </div>
            <div style={{ fontFamily: 'sans-serif', fontSize: 14, fontWeight: 700, color: T.text3, lineHeight: 1.5, paddingLeft: 28 }}>
              Best for complex scams, full email chains, and deep forensic context.
            </div>
          </button>
        </div>
      )}

      {/* Omni-Box — shown when Quick Scan panel is active */}
      {omniOpen && (
        <div ref={omniRef} style={{
          background: T.cardBg,
          border: `1.5px solid ${focused ? accentBlue : T.cardBorder}`,
          borderRadius: 14,
          overflow: 'hidden',
          transition: 'border-color 0.2s',
        }}>
          {/* Back button */}
          <div style={{ padding: '10px 14px 0', display: 'flex', alignItems: 'center' }}>
            <button onClick={closePanel} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: T.text3, fontFamily: 'monospace', fontSize: 10, letterSpacing: 1,
              padding: '4px 0', display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
              BACK
            </button>
          </div>

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
                padding: '12px 18px',
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
              <span style={{ fontFamily: 'monospace', fontSize: 11, color: accentRed }}>ERROR: {error}</span>
            </div>
          )}

          {/* Result */}
          {result && !loading && (
            <div style={{ borderTop: `1px solid ${T.cardBorder}`, padding: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{
                      fontFamily: 'monospace', fontSize: 9, letterSpacing: 2, fontWeight: 700,
                      color: SCORE_COLOR(result.score), background: `${SCORE_COLOR(result.score)}18`,
                      border: `1px solid ${SCORE_COLOR(result.score)}40`, borderRadius: 5, padding: '2px 8px',
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

              {result.osint && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {result.osint.fraud_score !== null && (
                    <OsintPill label="IPQS FRAUD" value={`${result.osint.fraud_score}/100`} color={result.osint.fraud_score > 50 ? accentRed : '#34d399'} T={T} />
                  )}
                  {result.osint.recent_abuse && <OsintPill label="RECENT ABUSE" value="FLAGGED" color={accentRed} T={T} />}
                  {result.osint.disposable && <OsintPill label="DISPOSABLE EMAIL" value="YES" color="#fb923c" T={T} />}
                  {result.osint.spam_trap && <OsintPill label="SPAM TRAP" value="YES" color={accentRed} T={T} />}
                  {result.osint.line_type && <OsintPill label="LINE TYPE" value={result.osint.line_type} color={result.osint.line_type === 'VOIP' ? accentRed : T.text3} T={T} />}
                  {result.osint.carrier && <OsintPill label="CARRIER" value={result.osint.carrier} color={T.text3} T={T} />}
                  {result.osint.phishing && <OsintPill label="PHISHING" value="DETECTED" color={accentRed} T={T} />}
                  {result.osint.malware && <OsintPill label="MALWARE" value="DETECTED" color={accentRed} T={T} />}
                  {result.osint.unsafe && <OsintPill label="UNSAFE URL" value="YES" color="#fb923c" T={T} />}
                  {result.osint.risk_score !== null && result.osint.type === 'url' && (
                    <OsintPill label="URL RISK" value={`${result.osint.risk_score}/100`} color={result.osint.risk_score > 50 ? accentRed : '#34d399'} T={T} />
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
