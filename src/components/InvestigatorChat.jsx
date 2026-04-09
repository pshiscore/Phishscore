import { useState, useRef, useEffect } from 'react';

const WELCOME = {
  role: 'ai',
  content: "**PhishScore Intelligence Investigator online.**\n\nI can answer questions about recent community scam submissions and threat news in our database. Ask me anything — for example:\n- *What are the most common scam categories this week?*\n- *What phishing tactics have been reported recently?*\n- *Summarize recent banking fraud cases.*",
};

function parseMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code style="background:#1e293b;padding:1px 5px;border-radius:3px;font-size:12px">$1</code>')
    .replace(/^- (.+)/gm, '• $1')
    .replace(/\n/g, '<br/>');
}

export default function InvestigatorChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const open = () => setIsOpen(true);
    document.addEventListener('openInvestigatorChat', open);
    return () => document.removeEventListener('openInvestigatorChat', open);
  }, []);

  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, messages]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/investigator-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Request failed');
      setMessages(prev => [...prev, { role: 'ai', content: data.text }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'system', content: `Error: ${err.message}` }]);
    } finally {
      setIsLoading(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="investigator-chat-root">
      {/* Chat window */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: '88px',
          right: '24px',
          width: '350px',
          height: '500px',
          background: '#0a0a0f',
          border: '1px solid #1e293b',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 9999,
          boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 16px',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <div>
              <div style={{ fontFamily: 'monospace', fontSize: '10px', letterSpacing: '3px', color: '#a78bfa', marginBottom: '2px' }}>
                INTELLIGENCE INVESTIGATOR
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 700, color: '#f1f5f9' }}>
                PhishScore<span style={{ color: '#f43f5e' }}>.ai</span>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '18px', padding: '4px', lineHeight: 1 }}
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '88%',
                  padding: '9px 12px',
                  borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  background: msg.role === 'user'
                    ? 'linear-gradient(135deg, #7c3aed, #a78bfa)'
                    : msg.role === 'system'
                    ? 'rgba(244,63,94,0.1)'
                    : 'rgba(255,255,255,0.04)',
                  border: msg.role === 'ai' ? '1px solid #1e293b' : msg.role === 'system' ? '1px solid rgba(244,63,94,0.3)' : 'none',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  color: msg.role === 'user' ? '#fff' : msg.role === 'system' ? '#f43f5e' : '#cbd5e1',
                  fontFamily: 'sans-serif',
                }}>
                  {msg.role === 'ai'
                    ? <span dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.content) }} />
                    : msg.content}
                </div>
              </div>
            ))}

            {isLoading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{
                  padding: '9px 14px',
                  borderRadius: '12px 12px 12px 2px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid #1e293b',
                  display: 'flex',
                  gap: '5px',
                  alignItems: 'center',
                }}>
                  {[0, 1, 2].map(d => (
                    <div key={d} style={{
                      width: '6px', height: '6px', borderRadius: '50%', background: '#a78bfa',
                      animation: 'investigatorPulse 1.2s ease-in-out infinite',
                      animationDelay: `${d * 0.2}s`,
                    }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: '10px 12px',
            borderTop: '1px solid #1e293b',
            display: 'flex',
            gap: '8px',
            flexShrink: 0,
            background: '#0d1117',
          }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask about scams or threats..."
              disabled={isLoading}
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid #1e293b',
                borderRadius: '8px',
                padding: '8px 12px',
                color: '#e2e8f0',
                fontSize: '13px',
                fontFamily: 'sans-serif',
                outline: 'none',
              }}
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              style={{
                background: isLoading || !input.trim() ? '#1e293b' : 'linear-gradient(135deg, #7c3aed, #a78bfa)',
                border: 'none',
                borderRadius: '8px',
                width: '36px',
                height: '36px',
                cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'all 0.15s',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setIsOpen(o => !o)}
        title="Intelligence Investigator"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          background: isOpen
            ? 'linear-gradient(135deg, #4c1d95, #7c3aed)'
            : 'linear-gradient(135deg, #a78bfa, #7c3aed)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          boxShadow: '0 4px 20px rgba(167,139,250,0.35)',
          transition: 'all 0.2s',
        }}
      >
        {isOpen ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>

      <style>{`
        @keyframes investigatorPulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @media (max-width: 767px) {
          .investigator-chat-root { display: none !important; }
        }
      `}</style>
    </div>
  );
}
