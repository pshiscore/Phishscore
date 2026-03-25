import { useState } from "react";

const BASE = '';  // same-origin, no domain needed

const APIS = [
  {
    id: 'urlscan',
    name: 'URLScan.io',
    desc: 'Live screenshot, page analysis, malicious verdict',
    run: async (url) => {
      const res = await fetch(`${BASE}/api/test-urlscan`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      return [
        `UUID: ${d.uuid || 'N/A'}`,
        `Verdict: ${d.verdict || 'pending'}`,
        `Score: ${d.score ?? 'N/A'}`,
        `Country: ${d.country || 'N/A'}`,
        `IP: ${d.ip || 'N/A'}`,
        d.screenshot ? `Screenshot: ready` : `Screenshot: pending`
      ].join('\n');
    }
  },
  {
    id: 'abuseipdb',
    name: 'AbuseIPDB',
    desc: 'IP abuse confidence score and historical reports',
    run: async (url) => {
      const res = await fetch(`${BASE}/api/test-abuseipdb`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      return [
        `IP: ${d.ip || 'N/A'}`,
        `Abuse Score: ${d.abuseScore ?? 'N/A'}%`,
        `Total Reports: ${d.totalReports ?? 'N/A'}`,
        `ISP: ${d.isp || 'N/A'}`,
        `Country: ${d.countryCode || 'N/A'}`,
        `Usage Type: ${d.usageType || 'N/A'}`
      ].join('\n');
    }
  },
  {
    id: 'whois',
    name: 'WhoisXML',
    desc: 'Domain age, registrar, and ownership details',
    run: async (url) => {
      const res = await fetch(`${BASE}/api/test-whois`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      return [
        `Domain Age: ${d.domainAge !== null ? d.domainAge + ' days' : 'N/A'}`,
        `Created: ${d.createdDate || 'N/A'}`,
        `Expires: ${d.expiresDate || 'N/A'}`,
        `Registrar: ${d.registrar || 'N/A'}`,
        `Registrant: ${d.registrant || 'N/A'}`,
        `Country: ${d.country || 'N/A'}`
      ].join('\n');
    }
  },
  {
    id: 'virustotal',
    name: 'VirusTotal',
    desc: '70+ security engine verdicts',
    run: async (url) => {
      const res = await fetch(`${BASE}/api/test-virustotal`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      if (d.skipped) return `SKIPPED: ${d.message}`;
      return [
        `Malicious: ${d.malicious ?? 0} engines`,
        `Suspicious: ${d.suspicious ?? 0} engines`,
        `Clean: ${d.clean ?? 0} engines`,
        `Total: ${d.total ?? 0} engines checked`
      ].join('\n');
    }
  },
  {
    id: 'gsb',
    name: 'Google Safe Browsing',
    desc: 'Phishing, malware and social engineering',
    run: async (url) => {
      const res = await fetch(`${BASE}/api/test-gsb`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      return [
        `Flagged: ${d.flagged ? 'YES ⚠' : 'No'}`,
        `Matches: ${d.matchCount ?? 0}`,
        d.threats?.length ? `Threats: ${d.threats.join(', ')}` : `No threats detected`
      ].join('\n');
    }
  },
  {
    id: 'urlhaus',
    name: 'URLhaus',
    desc: 'Malware distribution and botnet URL database',
    run: async (url) => {
      const res = await fetch(`${BASE}/api/test-urlhaus`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      return [
        `Listed: ${d.listed ? 'YES ⚠' : 'No'}`,
        `Status: ${d.status || 'not listed'}`,
        `Query Status: ${d.queryStatus || 'N/A'}`
      ].join('\n');
    }
  },
  {
    id: 'claude',
    name: 'Claude API (Sonnet)',
    desc: 'AI analysis endpoint — full scan pipeline',
    run: async (url) => {
      const start = Date.now();
      const res = await fetch(`${BASE}/api/analyze`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6', max_tokens: 500,
          messages: [{ role: 'user', content: `Test ping from API dashboard. URL: ${url}. Return JSON: {"score":50,"tags":["test"],"summary":"API test","verdict":"API test successful","analysis":"Test","redFlags":[],"whatToDo":"No action needed","detectedSources":[],"detectedCategory":null,"categoryReclassified":false}` }]
        })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      if (d.error) throw new Error(d.error || d.message);
      return [
        `Status: OK`,
        `Response time: ${((Date.now() - start) / 1000).toFixed(1)}s`,
        `Model: claude-sonnet-4-6`,
        `Content blocks: ${d.content?.length ?? 0}`
      ].join('\n');
    }
  }
];

function APICard({ api, url, T }) {
  const [status, setStatus] = useState('idle'); // idle, running, pass, fail, skip
  const [result, setResult] = useState('');
  const [timing, setTiming] = useState('');

  const run = async () => {
    if (!url) return;
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;
    setStatus('running');
    setResult('Running test...');
    const start = Date.now();
    try {
      const summary = await api.run(fullUrl);
      const elapsed = ((Date.now() - start) / 1000).toFixed(1) + 's';
      setTiming(elapsed);
      if (summary.startsWith('SKIPPED')) { setStatus('skip'); setResult(summary); }
      else { setStatus('pass'); setResult(summary); }
    } catch (err) {
      setTiming(((Date.now() - start) / 1000).toFixed(1) + 's');
      setStatus('fail');
      setResult(`Error: ${err.message}`);
    }
  };

  const colors = {
    idle:    { border: T.innerBorder, badge: T.text4, bg: T.innerBg },
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
        <button onClick={run} disabled={status === 'running'} style={{ background: T.innerBg, border: `1px solid ${T.innerBorder}`, color: T.text3, padding: '5px 14px', borderRadius: 6, fontSize: 10, cursor: 'pointer', fontFamily: 'monospace', letterSpacing: 1 }}>RUN</button>
      </div>
    </div>
  );
}

export default function APITestDashboard({ onClose, T = {} }) {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState(0); // force re-render all cards

  const runAll = () => {
    if (!url.trim()) return;
    setKey(k => k + 1); // remount all cards to reset state
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: T.pageBg, zIndex: 9999, overflowY: 'auto', padding: 28 }}>
      {/* Header */}
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'monospace', color: T.text, marginBottom: 2 }}>
              <span style={{ color: '#f43f5e' }}>PHISH</span>SCORE API TEST DASHBOARD
            </div>
            <div style={{ fontSize: 9, letterSpacing: 3, color: T.text4, fontFamily: 'monospace' }}>INTERNAL USE ONLY — NOT FOR PUBLIC ACCESS</div>
          </div>
          <button onClick={onClose} style={{ background: T.innerBg, border: `1px solid ${T.innerBorder}`, color: T.text3, padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontFamily: 'monospace', fontSize: 11, letterSpacing: 1 }}>✕ CLOSE</button>
        </div>

        {/* Input */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
          <input
            type="text"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runAll()}
            placeholder="Enter domain or URL (e.g. travel-deals-365.net)"
            style={{ flex: 1, minWidth: 280, background: T.inputBg, border: `1.5px solid ${T.inputBorder}`, borderRadius: 10, color: T.text, padding: '12px 16px', fontSize: 13, fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }}
          />
          <button
            onClick={runAll}
            disabled={!url.trim()}
            style={{ background: url.trim() ? 'linear-gradient(135deg,#f43f5e,#be123c)' : T.innerBg, border: 'none', color: url.trim() ? '#fff' : T.text4, padding: '12px 28px', borderRadius: 10, fontSize: 12, fontWeight: 700, letterSpacing: 2, cursor: url.trim() ? 'pointer' : 'default', fontFamily: 'monospace', boxShadow: url.trim() ? '0 4px 20px rgba(244,63,94,0.35)' : 'none' }}>
            ▶ RUN ALL
          </button>
        </div>

        {/* Note */}
        <div style={{ background: T.innerBg, border: `1px solid ${T.innerBorder}`, borderRadius: 8, padding: '10px 16px', marginBottom: 24, fontSize: 10, color: T.text4, fontFamily: 'monospace', lineHeight: 1.7 }}>
          URLScan takes 15-30 seconds. VirusTotal shows SKIP if key not configured. Press RUN ALL or test individually.
        </div>

        {/* Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
          {APIS.map(api => (
            <APICard key={`${api.id}-${key}`} api={api} url={url} T={T} />
          ))}
        </div>
      </div>
    </div>
  );
}
