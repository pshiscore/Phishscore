import { useState, useRef, useEffect } from "react";

const BASE = '';

async function safeJson(r) {
  const text = await r.text();
  try { return JSON.parse(text); }
  catch { throw new Error(`Invalid JSON response: ${text.slice(0, 100)}`); }
}

// ── API Definitions ────────────────────────────────────────────────────────────
const API_GROUPS = [
  {
    id: 'url',
    label: 'URL & DOMAIN INTELLIGENCE',
    color: '#f43f5e',
    apis: [
      {
        id: 'webrisk', name: 'Google Web Risk',
        desc: 'Malware, phishing, unwanted software detection (replaces GSB)',
        run: async (url) => {
          const r = await fetch(`${BASE}/api/test-webrisk`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const d = await safeJson(r);
          if (d.error) throw new Error(d.error);
          if (d.skipped) return `SKIPPED: ${d.message}`;
          return [`Flagged: ${d.flagged ? 'YES ⚠' : 'No'}`, `Threat Type: ${d.threatType || 'none'}`, `Clean: ${d.clean ? 'Yes' : 'No'}`].join('\n');
        }
      },
      {
        id: 'urlscan', name: 'URLScan.io',
        desc: 'Live screenshot, page analysis, malicious verdict',
        run: async (url) => {
          const r = await fetch(`${BASE}/api/test-urlscan`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const d = await safeJson(r);
          if (d.error) throw new Error(d.error);
          return [`UUID: ${d.uuid || 'N/A'}`, `Verdict: ${d.verdict || 'pending'}`, `Score: ${d.score ?? 'N/A'}`, `Country: ${d.country || 'N/A'}`, `IP: ${d.ip || 'N/A'}`].join('\n');
        }
      },
      {
        id: 'virustotal', name: 'VirusTotal',
        desc: '70+ security engine verdicts',
        run: async (url) => {
          const r = await fetch(`${BASE}/api/test-virustotal`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const d = await safeJson(r);
          if (d.error) throw new Error(d.error);
          if (d.skipped) return `SKIPPED: ${d.message}`;
          return [`Malicious: ${d.malicious ?? 0} engines`, `Suspicious: ${d.suspicious ?? 0} engines`, `Clean: ${d.clean ?? 0} engines`, `Total: ${d.total ?? 0}`].join('\n');
        }
      },
      {
        id: 'urlhaus', name: 'URLhaus',
        desc: 'Malware distribution and botnet URL database',
        run: async (url) => {
          const r = await fetch(`${BASE}/api/test-urlhaus`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const d = await safeJson(r);
          if (d.error) throw new Error(d.error);
          return [`Listed: ${d.listed ? 'YES ⚠' : 'No'}`, `Status: ${d.status || 'not listed'}`, `Query: ${d.queryStatus || 'N/A'}`].join('\n');
        }
      },
      {
        id: 'abuseipdb', name: 'AbuseIPDB',
        desc: 'IP abuse confidence score and reports',
        run: async (url) => {
          const r = await fetch(`${BASE}/api/test-abuseipdb`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const d = await safeJson(r);
          if (d.error) throw new Error(d.error);
          return [`IP: ${d.ip || 'N/A'}`, `Abuse Score: ${d.abuseScore ?? 'N/A'}%`, `Reports: ${d.totalReports ?? 'N/A'}`, `ISP: ${d.isp || 'N/A'}`].join('\n');
        }
      },
      {
        id: 'whois', name: 'WhoisXML',
        desc: 'Domain age, registrar, ownership details',
        run: async (url) => {
          const r = await fetch(`${BASE}/api/test-whois`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const d = await safeJson(r);
          if (d.error) throw new Error(d.error);
          return [`Domain Age: ${d.domainAge !== null ? d.domainAge + ' days' : 'N/A'}`, `Created: ${d.createdDate || 'N/A'}`, `Registrar: ${d.registrar || 'N/A'}`, `Registrant: ${d.registrant || 'N/A'}`].join('\n');
        }
      },
      {
        id: 'cloudflare', name: 'Cloudflare Radar',
        desc: 'URL scanning via Cloudflare global network',
        run: async (url) => {
          const r = await fetch(`${BASE}/api/test-cloudflare`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const d = await safeJson(r);
          if (d.error) throw new Error(d.error);
          if (d.skipped) return `SKIPPED: ${d.message}`;
          return [`UUID: ${d.uuid || 'N/A'}`, `Malicious: ${d.malicious ? 'YES ⚠' : 'No'}`, `Phishing: ${d.phishing ? 'YES ⚠' : 'No'}`, `Status: ${d.status || 'N/A'}`].join('\n');
        }
      },
    ]
  },
  {
    id: 'ai',
    label: 'AI MODELS',
    color: '#a78bfa',
    apis: [
      {
        id: 'claude-sonnet', name: 'Claude Sonnet 4.6',
        desc: 'Primary AI model — main analysis pipeline',
        run: async (url) => {
          const start = Date.now();
          const r = await fetch(`${BASE}/api/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 300, messages: [{ role: 'user', content: `API test ping. URL: ${url}. Return JSON: {"score":50,"tags":["test"],"summary":"API test","verdict":"OK","analysis":"Test","redFlags":[],"whatToDo":"None","detectedSources":[],"detectedCategory":null,"categoryReclassified":false}` }] }) });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const d = await safeJson(r);
          if (d.error) throw new Error(d.error || d.message);
          return [`Status: OK`, `Time: ${((Date.now() - start) / 1000).toFixed(1)}s`, `Model: claude-sonnet-4-6`, `Blocks: ${d.content?.length ?? 0}`].join('\n');
        }
      },
      {
        id: 'claude-haiku', name: 'Claude Haiku 4.5 (Fallback)',
        desc: 'Backup AI model — fires when Sonnet unavailable',
        run: async (url) => {
          const start = Date.now();
          const r = await fetch(`${BASE}/api/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 300, messages: [{ role: 'user', content: `API test ping. Return JSON: {"score":50,"tags":["test"],"summary":"API test","verdict":"OK","analysis":"Test","redFlags":[],"whatToDo":"None","detectedSources":[],"detectedCategory":null,"categoryReclassified":false}` }] }) });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const d = await safeJson(r);
          if (d.error) throw new Error(d.error || d.message);
          return [`Status: OK`, `Time: ${((Date.now() - start) / 1000).toFixed(1)}s`, `Model: claude-haiku-4-5-20251001`].join('\n');
        }
      },
      {
        id: 'claude-opus', name: 'Claude Opus 4.6 (Deep Intel)',
        desc: 'Premium AI model — forensic reports',
        run: async (url) => {
          const start = Date.now();
          const r = await fetch(`${BASE}/api/test-opus`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const d = await safeJson(r);
          if (d.error) throw new Error(d.error || d.message);
          return [`Status: OK`, `Time: ${((Date.now() - start) / 1000).toFixed(1)}s`, `Model: claude-opus-4-6`].join('\n');
        }
      },
      {
        id: 'gemini', name: 'Google Gemini (Radar AI)',
        desc: 'Gemini 2.5 Flash — powers Radar threat intelligence',
        run: async (url) => {
          const r = await fetch(`${BASE}/api/test-gemini`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const d = await safeJson(r);
          if (d.error) throw new Error(d.error);
          return [`Status: OK`, `Model: gemini-2.5-flash`, `Response: ${(d.response || '').slice(0, 100)}`].join('\n');
        }
      },
      {
        id: 'cnl', name: 'Cloud Natural Language',
        desc: 'Entity extraction + sentiment analysis — tests with a scam paragraph (requires 20+ words)',
        run: async () => {
          // CNL needs 20+ words — always send a fixed scam test paragraph, ignore URL input
          const testText = 'URGENT: Your Chase Bank account has been compromised and suspended. A suspicious transaction of $2,500 was detected from an unknown device. Please call our fraud department immediately at 1-800-555-0123 to verify your identity and restore access. Failure to respond within 24 hours will result in permanent account closure and legal action.';
          const r = await fetch(`${BASE}/api/test-cnl`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: testText }) });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const d = await safeJson(r);
          if (d.error) throw new Error(d.error);
          const orgs = d.entities?.organizations?.map(o => o.name).join(', ') || 'None';
          return [`Status: OK`, `Organizations: ${orgs}`, `Urgency: ${d.sentiment?.urgencyLevel || 'N/A'}`, `Sentiment: ${d.sentiment?.score ?? 'N/A'}`].join('\n');
        }
      },
    ]
  },
  {
    id: 'vision',
    label: 'VISION API (IMAGE ANALYSIS)',
    color: '#34d399',
    apis: [
      {
        id: 'vision', name: 'Cloud Vision API',
        desc: 'OCR text extraction, logo detection, safe search — upload an image to test',
        requiresImage: true,
        run: async (url, imageBase64) => {
          if (!imageBase64) throw new Error('No image provided — use the upload button');
          const r = await fetch(`${BASE}/api/test-vision`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageBase64 }) });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const d = await safeJson(r);
          if (d.error) throw new Error(d.error);
          const logos = d.logos?.map(l => `${l.description} (${l.score}%)`).join(', ') || 'None';
          return [
            `OCR: ${d.ocr?.charCount || 0} chars extracted`,
            `Text preview: ${(d.ocr?.text || '').slice(0, 120)}`,
            `Logos: ${logos}`,
            `Safe Search: adult=${d.safeSearch?.adult || 'N/A'}, violence=${d.safeSearch?.violence || 'N/A'}`
          ].join('\n');
        }
      },
    ]
  },
  {
    id: 'services',
    label: 'SERVICES',
    color: '#fbbf24',
    apis: [
      {
        id: 'resend', name: 'Resend Email',
        desc: 'Transactional email delivery — checks domain verification status',
        run: async () => {
          const r = await fetch(`${BASE}/api/test-resend`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const d = await safeJson(r);
          if (d.error) throw new Error(d.error);
          if (d.skipped) return `SKIPPED: ${d.message}`;
          return [`Status: OK`, `Domains: ${d.totalDomains}`, `Verified: ${d.verifiedDomains.join(', ') || 'None ⚠'}`, `Ready: ${d.ready ? 'Yes ✓' : 'No — verify domain first'}`].join('\n');
        }
      },
      {
        id: 'recaptcha', name: 'reCAPTCHA v3',
        desc: 'Bot detection — verifies secret key is valid',
        run: async () => {
          const r = await fetch(`${BASE}/api/test-recaptcha`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const d = await safeJson(r);
          if (d.error) throw new Error(d.error);
          if (d.skipped) return `SKIPPED: ${d.message}`;
          return [`Key Valid: ${d.keyValid ? 'Yes ✓' : 'No ✗'}`, `Status: ${d.status}`, `Errors: ${d.errorCodes.join(', ') || 'none'}`].join('\n');
        }
      },
    ]
  },
];

// ── API Card Component ─────────────────────────────────────────────────────────
function APICard({ api, url, imageBase64, autoRun, T }) {
  const [status, setStatus] = useState('idle');
  const [result, setResult] = useState('');
  const [timing, setTiming] = useState('');
  const hasRun = useRef(false);
  const fileRef = useRef();

  useEffect(() => {
    if (autoRun && !hasRun.current) {
      if (api.requiresImage) return; // skip auto-run for vision
      hasRun.current = true;
      run();
    }
  }, [autoRun]);

  const run = async (imgBase64) => {
    const fullUrl = url ? (url.startsWith('http') ? url : `https://${url}`) : 'https://example.com';
    setStatus('running'); setResult('Running...'); setTiming('');
    const start = Date.now();
    try {
      const summary = await api.run(fullUrl, imgBase64 || imageBase64);
      const elapsed = ((Date.now() - start) / 1000).toFixed(1) + 's';
      setTiming(elapsed);
      if (summary.startsWith('SKIPPED')) { setStatus('skip'); setResult(summary); }
      else { setStatus('pass'); setResult(summary); }
    } catch (err) {
      setTiming(((Date.now() - start) / 1000).toFixed(1) + 's');
      setStatus('fail'); setResult(`Error: ${err.message}`);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target.result.split(',')[1];
      run(base64);
    };
    reader.readAsDataURL(file);
  };

  const colors = {
    idle:    { border: T.innerBorder, badge: T.text4,   bg: T.innerBg },
    running: { border: '#fbbf24',     badge: '#fbbf24', bg: '#fbbf2408' },
    pass:    { border: '#34d399',     badge: '#34d399', bg: '#34d39908' },
    fail:    { border: '#f43f5e',     badge: '#f43f5e', bg: '#f43f5e08' },
    skip:    { border: T.innerBorder, badge: T.text4,   bg: T.innerBg },
  };
  const c = colors[status];
  const labels = { idle: 'IDLE', running: '⟳ RUNNING', pass: '✓ PASS', fail: '✗ FAIL', skip: '— SKIP' };

  return (
    <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 12, padding: 16, transition: 'all 0.2s' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.text, fontFamily: 'monospace' }}>{api.name}</div>
        <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 6, fontWeight: 700, letterSpacing: 1, color: c.badge, border: `1px solid ${c.border}`, background: T.cardBg, fontFamily: 'monospace' }}>{labels[status]}</span>
      </div>
      <div style={{ fontSize: 10, color: T.text4, fontFamily: 'monospace', marginBottom: 10 }}>{api.desc}</div>
      <div style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}`, borderRadius: 8, padding: '10px 12px', minHeight: 60, fontSize: 11, color: status === 'pass' ? '#34d399' : status === 'fail' ? '#f43f5e' : T.text3, fontFamily: 'monospace', lineHeight: 1.7, whiteSpace: 'pre', overflowX: 'auto', maxHeight: 160, overflowY: 'auto' }}>
        {result || 'Waiting...'}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
        <span style={{ fontSize: 9, color: T.text4, fontFamily: 'monospace' }}>{timing}</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {api.requiresImage && (
            <>
              <input type="file" accept="image/*" ref={fileRef} onChange={handleImageUpload} style={{ display: 'none' }} />
              <button onClick={() => fileRef.current.click()} disabled={status === 'running'} style={{ background: '#34d39918', border: '1px solid #34d39940', color: '#34d399', padding: '5px 12px', borderRadius: 6, fontSize: 10, cursor: 'pointer', fontFamily: 'monospace', letterSpacing: 1 }}>
                UPLOAD IMAGE
              </button>
            </>
          )}
          {!api.requiresImage && (
            <button onClick={() => run()} disabled={status === 'running'} style={{ background: T.innerBg, border: `1px solid ${T.innerBorder}`, color: T.text3, padding: '5px 14px', borderRadius: 6, fontSize: 10, cursor: 'pointer', fontFamily: 'monospace', letterSpacing: 1 }}>RUN</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function APITestDashboard({ onClose, T = {} }) {
  const [url, setUrl] = useState('');
  const [runAllId, setRunAllId] = useState(null);
  const [activeGroup, setActiveGroup] = useState('all');

  const runAll = () => {
    if (!url.trim()) return;
    setRunAllId(Date.now());
  };

  const visibleGroups = activeGroup === 'all'
    ? API_GROUPS
    : API_GROUPS.filter(g => g.id === activeGroup);

  return (
    <div style={{ position: 'fixed', inset: 0, background: T.pageBg, zIndex: 9999, overflowY: 'auto', padding: 24 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'monospace', color: T.text, marginBottom: 2 }}>
              <span style={{ color: '#f43f5e' }}>PHISH</span>SCORE API TEST DASHBOARD
            </div>
            <div style={{ fontSize: 9, letterSpacing: 3, color: T.text4, fontFamily: 'monospace' }}>INTERNAL USE ONLY — NOT FOR PUBLIC ACCESS</div>
          </div>
          <button onClick={onClose} style={{ background: T.innerBg, border: `1px solid ${T.innerBorder}`, color: T.text3, padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontFamily: 'monospace', fontSize: 11, letterSpacing: 1 }}>✕ CLOSE</button>
        </div>

        {/* URL Input + Run All */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <input type="text" value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && runAll()}
            placeholder="Enter domain or URL for URL/Domain tests (e.g. travel-deals-365.net)"
            style={{ flex: 1, minWidth: 280, background: T.inputBg, border: `1.5px solid ${T.inputBorder}`, borderRadius: 10, color: T.text, padding: '12px 16px', fontSize: 13, fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }} />
          <button onClick={runAll} disabled={!url.trim()}
            style={{ background: url.trim() ? 'linear-gradient(135deg,#f43f5e,#be123c)' : T.innerBg, border: 'none', color: url.trim() ? '#fff' : T.text4, padding: '12px 28px', borderRadius: 10, fontSize: 12, fontWeight: 700, letterSpacing: 2, cursor: url.trim() ? 'pointer' : 'default', fontFamily: 'monospace' }}>
            ▶ RUN ALL
          </button>
        </div>

        {/* Group filter tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {[{ id: 'all', label: 'ALL', color: T.text3 }, ...API_GROUPS.map(g => ({ id: g.id, label: g.label.split(' ')[0], color: g.color }))].map(tab => (
            <button key={tab.id} onClick={() => setActiveGroup(tab.id)}
              style={{ padding: '6px 14px', borderRadius: 8, border: `1.5px solid ${activeGroup === tab.id ? tab.color : T.innerBorder}`, background: activeGroup === tab.id ? `${tab.color}18` : T.innerBg, color: activeGroup === tab.id ? tab.color : T.text4, fontFamily: 'monospace', fontSize: 10, fontWeight: 700, cursor: 'pointer', letterSpacing: 1 }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Notes */}
        <div style={{ background: T.innerBg, border: `1px solid ${T.innerBorder}`, borderRadius: 8, padding: '10px 16px', marginBottom: 20, fontSize: 10, color: T.text4, fontFamily: 'monospace', lineHeight: 1.7 }}>
          URLScan takes 15-30s. Vision API requires image upload — click UPLOAD IMAGE. Services just verify key/config status. RUN ALL skips Vision.
        </div>

        {/* Groups */}
        {visibleGroups.map(group => (
          <div key={group.id} style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 3, height: 16, background: group.color, borderRadius: 2 }} />
              <div style={{ fontSize: 10, fontWeight: 700, color: group.color, fontFamily: 'monospace', letterSpacing: 2 }}>{group.label}</div>
              <div style={{ flex: 1, height: 1, background: T.cardBorder }} />
              <div style={{ fontSize: 9, color: T.text4, fontFamily: 'monospace' }}>{group.apis.length} APIs</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
              {group.apis.map(api => (
                <APICard key={`${api.id}-${runAllId}`} api={api} url={url} autoRun={runAllId !== null} T={T} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
