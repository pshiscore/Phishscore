import { useState } from 'react';

const T = {
  pageBg: '#0a0a0f',
  cardBg: '#0d1117',
  border: '#1e293b',
  text: '#f1f5f9',
  text2: '#cbd5e1',
  text3: '#64748b',
  accent: '#5b6cf8',
};

export default function BetaDashboard() {
  const [input, setInput] = useState('');
  const [focused, setFocused] = useState(false);

  return (
    <div style={{ minHeight: '100vh', background: T.pageBg, color: T.text, fontFamily: 'sans-serif' }}>

      {/* Beta Banner */}
      <div style={{
        background: 'linear-gradient(90deg, rgba(91,108,248,0.15), rgba(167,139,250,0.15))',
        borderBottom: '1px solid rgba(91,108,248,0.3)',
        padding: '10px 20px',
        textAlign: 'center',
      }}>
        <span style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: 3, color: '#a78bfa', fontWeight: 700 }}>
          BETA
        </span>
        <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#94a3b8', marginLeft: 10 }}>
          Welcome to the PhishScore V2 Beta — Testing new UI features.
        </span>
        <a
          href="/"
          style={{ marginLeft: 20, fontFamily: 'monospace', fontSize: 10, color: T.text3, textDecoration: 'underline', letterSpacing: 1 }}
        >
          ← Back to production
        </a>
      </div>

      {/* Nav */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 24px',
        borderBottom: `1px solid ${T.border}`,
        background: T.cardBg,
      }}>
        <div style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 800, letterSpacing: 0.5 }}>
          PhishScore<span style={{ color: '#f43f5e' }}>.ai</span>
          <span style={{ marginLeft: 10, fontSize: 9, letterSpacing: 3, color: '#a78bfa', fontWeight: 400, verticalAlign: 'middle' }}>V2 BETA</span>
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: 10, color: T.text3, letterSpacing: 2 }}>
          UI PROTOTYPE — NOT PRODUCTION
        </div>
      </div>

      {/* Hero + Omni-Box */}
      <div style={{
        maxWidth: 800,
        margin: '0 auto',
        padding: '80px 24px 60px',
        textAlign: 'center',
      }}>
        <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: 5, color: '#a78bfa', marginBottom: 16 }}>
          QUICK SCAN — OMNI-BOX
        </div>
        <h1 style={{
          fontSize: 'clamp(28px, 5vw, 48px)',
          fontWeight: 800,
          fontFamily: 'monospace',
          margin: '0 0 12px',
          lineHeight: 1.15,
          letterSpacing: '-0.5px',
        }}>
          Is it a scam?
        </h1>
        <p style={{ color: T.text3, fontSize: 15, marginBottom: 48, lineHeight: 1.6 }}>
          Paste anything — a phone number, email address, URL, or message — and get an instant AI verdict.
        </p>

        {/* Omni-Box */}
        <div style={{
          position: 'relative',
          maxWidth: 680,
          margin: '0 auto',
        }}>
          <div style={{
            display: 'flex',
            gap: 0,
            borderRadius: 16,
            border: `1.5px solid ${focused ? '#5b6cf8' : T.border}`,
            background: T.cardBg,
            boxShadow: focused ? '0 0 0 3px rgba(91,108,248,0.12)' : '0 4px 24px rgba(0,0,0,0.3)',
            transition: 'all 0.2s',
            overflow: 'hidden',
          }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Enter a phone number, email, or paste a link..."
              rows={3}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                padding: '18px 20px',
                color: T.text,
                fontSize: 15,
                fontFamily: 'sans-serif',
                lineHeight: 1.6,
                resize: 'none',
              }}
            />
            <div style={{
              display: 'flex',
              alignItems: 'flex-end',
              padding: '14px 14px',
              flexShrink: 0,
            }}>
              <button
                disabled={!input.trim()}
                style={{
                  background: input.trim()
                    ? 'linear-gradient(135deg, #5b6cf8, #a78bfa)'
                    : 'rgba(255,255,255,0.05)',
                  border: 'none',
                  borderRadius: 10,
                  padding: '10px 22px',
                  color: input.trim() ? '#fff' : T.text3,
                  fontFamily: 'monospace',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 2,
                  cursor: input.trim() ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                }}
              >
                QUICK SCAN
              </button>
            </div>
          </div>

          {/* Input type hints */}
          <div style={{
            display: 'flex',
            gap: 8,
            marginTop: 12,
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}>
            {['URL / Link', 'Email Address', 'Phone Number', 'SMS / Message'].map(hint => (
              <span key={hint} style={{
                fontFamily: 'monospace',
                fontSize: 10,
                letterSpacing: 1,
                color: T.text3,
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${T.border}`,
                borderRadius: 6,
                padding: '3px 10px',
              }}>
                {hint}
              </span>
            ))}
          </div>
        </div>

        {/* Result placeholder */}
        <div style={{
          marginTop: 48,
          padding: '24px',
          background: 'rgba(255,255,255,0.02)',
          border: `1px dashed ${T.border}`,
          borderRadius: 16,
          maxWidth: 680,
          marginLeft: 'auto',
          marginRight: 'auto',
        }}>
          <div style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: 3, color: T.text3, marginBottom: 8 }}>
            RESULT PANEL — PLACEHOLDER
          </div>
          <p style={{ color: T.text3, fontSize: 13, margin: 0, lineHeight: 1.7 }}>
            Scan results will appear here. Backend not wired — UI prototype only.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        borderTop: `1px solid ${T.border}`,
        padding: '20px 24px',
        textAlign: 'center',
        fontFamily: 'monospace',
        fontSize: 10,
        color: T.text3,
        letterSpacing: 1,
      }}>
        PHISHSCORE.AI — V2 BETA PROTOTYPE · NOT FOR PUBLIC DISTRIBUTION
      </div>

      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; background: ${T.pageBg}; }
        textarea::placeholder { color: #475569; }
        textarea::-webkit-scrollbar { width: 4px; }
        textarea::-webkit-scrollbar-track { background: transparent; }
        textarea::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 2px; }
      `}</style>
    </div>
  );
}
