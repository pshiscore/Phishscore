import { useState, useRef, useEffect } from 'react';
import { getScoreColor, getScoreLabel } from '../score-bands';

// Bands come from src/score-bands.js so the label the user sees and the scale the
// model is given can never drift apart again.
const SCORE_COLOR = getScoreColor;
const SCORE_LABEL = getScoreLabel;

// ── Tag explanation definitions ───────────────────────────────────────────────

const TAG_EXPLANATIONS = {
  compromised_email: {
    header: "Low Risk, but Data Exposed",
    body: "This email address has a low fraud score, meaning it isn't a known spammer. However, it was found in a known public data breach.",
    subhead: "Next Steps:",
    bullets: [
      "If this is your email: Check haveibeenpwned.com to see where your data leaked, and change your passwords.",
      "If you received an email from them: Proceed with normal caution. Their account might be hijacked by a scammer using their leaked password.",
    ],
  },
  recent_abuse: {
    header: "Recently Flagged for Abuse",
    body: "This contact was reported for abusive behavior recently. It may be actively used in spam or scam campaigns.",
    subhead: "Next Steps:",
    bullets: [
      "Do not respond to any requests for personal information or payments.",
      "If this is a phone number, block it and report it to your carrier.",
    ],
  },
  disposable_email: {
    header: "Throwaway Email Address",
    body: "This is a temporary or disposable email address. Legitimate businesses do not use these — scammers use them to avoid being traced.",
    subhead: "Next Steps:",
    bullets: [
      "Treat any message from this address as high risk.",
      "Do not click links or provide any information in response.",
    ],
  },
  spam_trap: {
    header: "Known Spam Trap",
    body: "This address is a spam trap — a honeypot used to catch senders who harvest email addresses. Receiving mail from it indicates it was obtained through illegitimate means.",
    subhead: "Next Steps:",
    bullets: [
      "Do not engage with this sender under any circumstances.",
      "Mark as spam and block immediately.",
    ],
  },
  voip_line: {
    header: "VOIP / Internet-Based Number",
    body: "This phone number is routed through an internet-based VOIP service rather than a traditional carrier. VOIP numbers are cheap, disposable, and extremely common in scam operations.",
    subhead: "Next Steps:",
    bullets: [
      "Be highly skeptical of any claims about who is calling or texting from this number.",
      "Never call back numbers you don't recognise — especially VOIP lines.",
    ],
  },
  phishing: {
    header: "Active Phishing Site Detected",
    body: "This URL was identified as a phishing page by one or more threat intelligence databases. It is designed to steal credentials, payment information, or personal data.",
    subhead: "Next Steps:",
    bullets: [
      "Do not visit this URL or enter any information on the page.",
      "If you already did, change your passwords immediately and monitor your accounts.",
    ],
  },
  malware: {
    header: "Malware Distribution Detected",
    body: "This URL is associated with malware distribution. Visiting it may automatically download malicious software to your device.",
    subhead: "Next Steps:",
    bullets: [
      "Do not click this link.",
      "If you already visited it, run a full antivirus scan immediately.",
    ],
  },
  unsafe_url: {
    header: "Flagged as Unsafe",
    body: "This URL was flagged as unsafe by IPQS threat intelligence. It may host phishing pages, malware, or other malicious content.",
    subhead: "Next Steps:",
    bullets: [
      "Avoid visiting this URL.",
      "If you received it in a message, the message itself is likely malicious.",
    ],
  },
  parked_domain: {
    header: "Parked Domain",
    body: "This link points to a parked or inactive domain. Scammers frequently buy cheap parked domains to host temporary, disposable phishing sites.",
    subhead: "Next Steps:",
    bullets: [
      "Do not click the link or enter any credentials.",
      "Close the page immediately.",
    ],
  },
  spam_domain: {
    header: "Known Spam Domain",
    body: "This domain has a verified history of sending aggressive spam or malicious emails.",
    subhead: "Next Steps:",
    bullets: [
      "Mark the sender as spam.",
      "Do not reply or click unsubscribe links, as this confirms your email is active.",
    ],
  },
  inactive_contact: {
    header: "Invalid or Inactive Contact",
    body: "This email address or phone number is flagged as disconnected or unable to receive messages (hard bounce).",
    subhead: "Next Steps:",
    bullets: [
      "This is likely a spoofed sender ID. Do not attempt to reply.",
    ],
  },
  premium_rate: {
    header: "Premium / Toll Rate Number",
    body: "This is a premium-rate phone number. Scammers use these to artificially inflate traffic or charge you massive per-minute fees just for calling or texting them back.",
    subhead: "Next Steps:",
    bullets: [
      "Do not call or text this number back under any circumstances.",
      "Check your phone bill for unauthorized international or premium charges.",
    ],
  },
};

// Map OSINT pill keys to explanation IDs
function getOsintExplanationKey(label, value) {
  if (label === 'RECENT ABUSE') return 'recent_abuse';
  if (label === 'DISPOSABLE EMAIL') return 'disposable_email';
  if (label === 'SPAM TRAP') return 'spam_trap';
  if (label === 'LINE TYPE' && value === 'VOIP') return 'voip_line';
  if (label === 'PHISHING') return 'phishing';
  if (label === 'MALWARE') return 'malware';
  if (label === 'UNSAFE URL') return 'unsafe_url';
  return null;
}

export default function ActionRow({ T, onAnalyzeThreat, analyzerOpen }) {
  // activePanel: null | 'quickscan' | 'analyze'
  const [activePanel, setActivePanel] = useState(null);
  const [activeExplanation, setActiveExplanation] = useState(null);

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
    setActiveExplanation(null);
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
                    }}>{result.category_label || result.category}</span>
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

              {/* AI tags */}
              {Array.isArray(result.tags) && result.tags.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: result.osint ? 8 : 0 }}>
                  {result.tags.map(tag => (
                    <span key={tag} style={{
                      fontFamily: 'monospace', fontSize: 9, letterSpacing: 1,
                      color: T.text3, background: 'rgba(255,255,255,0.04)',
                      border: `1px solid ${T.cardBorder}`, borderRadius: 5, padding: '2px 8px',
                      textTransform: 'uppercase',
                    }}>{tag}</span>
                  ))}
                </div>
              )}

              {/* OSINT pills */}
              {result.osint && (() => {
                const isVoip = result.osint.line_type === 'VOIP';
                const isInactive = result.osint.active === false || result.osint.valid === false;
                const clickablePills = [
                  result.osint.recent_abuse && { key: 'recent_abuse', label: 'RECENT ABUSE' },
                  result.osint.disposable && { key: 'disposable_email', label: 'DISPOSABLE EMAIL' },
                  result.osint.spam_trap && { key: 'spam_trap', label: 'SPAM TRAP' },
                  isVoip && { key: 'voip_line', label: 'LINE TYPE VOIP' },
                  result.osint.phishing && { key: 'phishing', label: 'PHISHING' },
                  result.osint.malware && { key: 'malware', label: 'MALWARE' },
                  result.osint.unsafe && { key: 'unsafe_url', label: 'UNSAFE URL' },
                  result.osint.parking && { key: 'parked_domain', label: 'PARKED DOMAIN' },
                  result.osint.spamming && { key: 'spam_domain', label: 'SPAM DOMAIN' },
                  isInactive && { key: 'inactive_contact', label: 'INACTIVE CONTACT' },
                  result.osint.premium && { key: 'premium_rate', label: 'PREMIUM LINE' },
                ].filter(Boolean);
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      {result.osint.fraud_score !== null && (
                        <OsintPill label="IPQS FRAUD" value={`${result.osint.fraud_score}/100`} color={result.osint.fraud_score > 50 ? accentRed : '#34d399'} T={T} />
                      )}
                      {result.osint.recent_abuse && <OsintPill label="RECENT ABUSE" value="FLAGGED" color={accentRed} T={T} />}
                      {result.osint.disposable && <OsintPill label="DISPOSABLE EMAIL" value="YES" color="#fb923c" T={T} />}
                      {result.osint.spam_trap && <OsintPill label="SPAM TRAP" value="YES" color={accentRed} T={T} />}
                      {result.osint.line_type && <OsintPill label="LINE TYPE" value={result.osint.line_type} color={isVoip ? accentRed : T.text3} T={T} />}
                      {result.osint.carrier && <OsintPill label="CARRIER" value={result.osint.carrier} color={T.text3} T={T} />}
                      {result.osint.name && <OsintPill label="NAME" value={result.osint.name} color={T.text3} T={T} />}
                      {result.osint.active === false && <OsintPill label="ACTIVE" value="NO" color="#fb923c" T={T} />}
                      {result.osint.premium && <OsintPill label="PREMIUM LINE" value="YES" color="#fb923c" T={T} />}
                      {result.osint.valid === false && <OsintPill label="VALID INBOX" value="NO" color="#fb923c" T={T} />}
                      {result.osint.phishing && <OsintPill label="PHISHING" value="DETECTED" color={accentRed} T={T} />}
                      {result.osint.malware && <OsintPill label="MALWARE" value="DETECTED" color={accentRed} T={T} />}
                      {result.osint.unsafe && <OsintPill label="UNSAFE URL" value="YES" color="#fb923c" T={T} />}
                      {result.osint.parking && <OsintPill label="PARKED DOMAIN" value="YES" color="#fb923c" T={T} />}
                      {result.osint.spamming && <OsintPill label="SPAM DOMAIN" value="YES" color={accentRed} T={T} />}
                      {result.osint.risk_score !== null && result.osint.type === 'url' && (
                        <OsintPill label="URL RISK" value={`${result.osint.risk_score}/100`} color={result.osint.risk_score > 50 ? accentRed : '#34d399'} T={T} />
                      )}
                      {result.osint.type === 'url' && result.osint.domain_age && (
                        <OsintPill
                          label="DOMAIN AGE"
                          value={result.osint.domain_age.status === 'known'
                            ? `${result.osint.domain_age.days} DAYS${result.osint.domain_age.iso ? ` (${result.osint.domain_age.iso.slice(0, 10)})` : ''}`
                            : 'UNKNOWN'}
                          color={T.text3}
                          T={T}
                        />
                      )}
                    </div>

                    {/* "What does this mean?" buttons — one per explainable flag */}
                    {clickablePills.length > 0 && (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {clickablePills.map(({ key, label }) => (
                          <button
                            key={key}
                            onClick={() => setActiveExplanation(activeExplanation === key ? null : key)}
                            style={{
                              background: activeExplanation === key ? 'rgba(244,63,94,0.08)' : 'none',
                              border: `1px solid ${activeExplanation === key ? '#f43f5e60' : T.cardBorder}`,
                              borderRadius: 6,
                              padding: '4px 10px',
                              cursor: 'pointer',
                              fontFamily: 'monospace',
                              fontSize: 9,
                              letterSpacing: 1,
                              color: activeExplanation === key ? accentRed : T.text3,
                              transition: 'all 0.15s',
                            }}
                          >
                            {activeExplanation === key ? '✕ close' : `? what is ${label}?`}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Explanation flyout */}
              {activeExplanation && TAG_EXPLANATIONS[activeExplanation] && (
                <ExplanationFlyout
                  explanation={TAG_EXPLANATIONS[activeExplanation]}
                  onClose={() => setActiveExplanation(null)}
                  T={T}
                />
              )}

              {/* Scan reference — quote this when disputing a result */}
              {result.scan_id && (
                <div style={{
                  marginTop: 10, paddingTop: 8, borderTop: `1px solid ${T.cardBorder}`,
                  fontFamily: 'monospace', fontSize: 9, letterSpacing: 0.5, color: T.text4,
                }}>
                  SCAN ID: <span style={{ color: T.text3, userSelect: 'all' }}>{result.scan_id}</span>
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
        @keyframes slideDown { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
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

function ExplanationFlyout({ explanation, onClose, T }) {
  return (
    <div style={{
      marginTop: 12,
      background: T.innerBg,
      border: `1px solid ${T.innerBorder}`,
      borderRadius: 12,
      padding: '16px 18px',
      position: 'relative',
      animation: 'slideDown 0.15s ease',
    }}>
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 10, right: 10,
          background: 'none', border: 'none', cursor: 'pointer',
          color: T.text3, fontSize: 14, lineHeight: 1, padding: '2px 6px',
        }}
      >×</button>

      <div style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 8, paddingRight: 24 }}>
        {explanation.header}
      </div>
      <p style={{ fontFamily: 'Georgia, serif', fontSize: 13, color: T.text2, lineHeight: 1.7, margin: '0 0 12px' }}>
        {explanation.body}
      </p>
      <div style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: T.text, marginBottom: 8 }}>
        {explanation.subhead}
      </div>
      <ul style={{ margin: '0 0 12px', paddingLeft: 16 }}>
        {explanation.bullets.map((b, i) => (
          <li key={i} style={{ fontFamily: 'Georgia, serif', fontSize: 13, color: T.text2, lineHeight: 1.7, marginBottom: i < explanation.bullets.length - 1 ? 6 : 0 }}>
            {b}
          </li>
        ))}
      </ul>
      <div style={{ fontFamily: 'monospace', fontSize: 9, color: T.text4, letterSpacing: 1 }}>
        Contact us at contact@phishscore.ai with any questions.
      </div>
    </div>
  );
}
