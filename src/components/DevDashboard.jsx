import { useState, useEffect } from 'react';
import APITestDashboard from './APITestDashboard';

const T = {
  pageBg:      '#060810',
  cardBg:      '#0d0f1a',
  cardBorder:  '#1e2235',
  inputBg:     '#0a0c14',
  inputBorder: '#1e2235',
  text:        '#f1f5f9',
  text2:       '#cbd5e1',
  text3:       '#94a3b8',
  text4:       '#475569',
  ringTrack:   '#1e2235',
  innerBg:     '#111827',
  innerBorder: '#1e293b',
  tagBg:       '#1e2235',
  tagColor:    '#94a3b8',
  scrollTrack: '#0d0f1a',
  scrollThumb: '#1e2235',
};

export default function DevDashboard() {
  // 'loading' | 'login' | 'authenticated'
  const [authState, setAuthState] = useState('loading');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [maintenance, setMaintenance] = useState(false);
  const [maintenanceLoading, setMaintenanceLoading] = useState(true);
  const [maintenanceToggling, setMaintenanceToggling] = useState(false);

  // Check for existing valid session on mount
  useEffect(() => {
    fetch('/api/auth-devs')
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          setAuthState('authenticated');
          fetch('/api/maintenance')
            .then(r => r.json())
            .then(d => { setMaintenance(d.maintenance); setMaintenanceLoading(false); })
            .catch(() => setMaintenanceLoading(false));
        } else {
          setAuthState('login');
        }
      })
      .catch(() => setAuthState('login'));
  }, []);

  const toggleMaintenance = async () => {
    setMaintenanceToggling(true);
    try {
      const res = await fetch('/api/maintenance', { method: 'POST' });
      const data = await res.json();
      if (res.ok) setMaintenance(data.maintenance);
    } finally {
      setMaintenanceToggling(false);
    }
  };

  const handleLogin = async () => {
    if (!username || !password) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/auth-devs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        setAuthState('authenticated');
      } else if (res.status === 500) {
        setError('Auth not configured — ADMIN_USERNAME/ADMIN_PASSWORD missing in Vercel env vars.');
      } else {
        setError('Invalid credentials. Access denied.');
      }
    } catch {
      setError('Could not reach auth server.');
    }
    setSubmitting(false);
  };

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (authState === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: T.pageBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 10, color: T.text4, fontFamily: 'monospace', letterSpacing: 3 }}>VERIFYING SESSION...</div>
      </div>
    );
  }

  // ── Login ────────────────────────────────────────────────────────────────────
  if (authState === 'login') {
    return (
      <div style={{ minHeight: '100vh', background: T.pageBg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ width: '100%', maxWidth: 380, background: T.cardBg, border: '1px solid #f43f5e40', borderRadius: 16, padding: 36, boxSizing: 'border-box' }}>
          <div style={{ fontSize: 9, letterSpacing: 4, color: '#f43f5e', fontFamily: 'monospace', marginBottom: 6 }}>PHISHSCORE.AI</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: T.text, fontFamily: 'monospace', letterSpacing: 1, marginBottom: 4 }}>COMMAND CENTER</div>
          <div style={{ fontSize: 11, color: T.text4, fontFamily: 'monospace', marginBottom: 28 }}>Restricted — authorised personnel only</div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 9, color: T.text4, fontFamily: 'monospace', letterSpacing: 2, marginBottom: 6 }}>USERNAME</div>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="admin"
              style={{ width: '100%', background: T.inputBg, border: `1.5px solid ${T.inputBorder}`, borderRadius: 8, color: T.text, padding: '10px 14px', fontSize: 13, fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => e.target.style.borderColor = '#f43f5e55'}
              onBlur={e => e.target.style.borderColor = T.inputBorder}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 9, color: T.text4, fontFamily: 'monospace', letterSpacing: 2, marginBottom: 6 }}>PASSWORD</div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              style={{ width: '100%', background: T.inputBg, border: `1.5px solid ${T.inputBorder}`, borderRadius: 8, color: T.text, padding: '10px 14px', fontSize: 13, fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => e.target.style.borderColor = '#f43f5e55'}
              onBlur={e => e.target.style.borderColor = T.inputBorder}
            />
          </div>

          {error && (
            <div style={{ fontSize: 11, color: '#f43f5e', fontFamily: 'monospace', marginBottom: 16, padding: '8px 12px', background: '#f43f5e12', border: '1px solid #f43f5e30', borderRadius: 8 }}>
              {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={submitting || !username || !password}
            style={{ width: '100%', background: submitting || !username || !password ? '#1a1d2e' : 'linear-gradient(135deg,#f43f5e,#be123c)', border: 'none', color: submitting || !username || !password ? '#334155' : '#fff', padding: '12px', borderRadius: 10, fontSize: 12, fontWeight: 700, letterSpacing: 2, cursor: submitting ? 'default' : 'pointer', fontFamily: 'monospace', boxShadow: submitting ? 'none' : '0 4px 20px rgba(244,63,94,0.35)' }}>
            {submitting ? 'VERIFYING...' : 'ENTER'}
          </button>
        </div>
      </div>
    );
  }

  // ── Authenticated ────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: T.pageBg, padding: '24px 16px', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: 4, color: '#f43f5e', fontFamily: 'monospace', marginBottom: 4 }}>PHISHSCORE.AI</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: T.text, fontFamily: 'monospace', letterSpacing: 1 }}>COMMAND CENTER</div>
          </div>
          <a href="/" style={{ fontSize: 10, color: T.text4, fontFamily: 'monospace', letterSpacing: 2, textDecoration: 'none', border: `1px solid ${T.cardBorder}`, padding: '6px 14px', borderRadius: 20 }}>← DASHBOARD</a>
        </div>
        {/* ── Kill Switch ─────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 28, background: T.cardBg, border: `1px solid ${maintenance ? '#f43f5e40' : '#22c55e30'}`, borderRadius: 16, padding: '24px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: 4, color: maintenance ? '#f43f5e' : '#22c55e', fontFamily: 'monospace', marginBottom: 6 }}>SITE STATUS</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: maintenance ? '#f43f5e' : '#22c55e', boxShadow: maintenance ? '0 0 8px #f43f5e' : '0 0 8px #22c55e', flexShrink: 0 }} />
              <div style={{ fontSize: 20, fontWeight: 800, color: T.text, fontFamily: 'monospace', letterSpacing: 1 }}>
                {maintenanceLoading ? '...' : maintenance ? 'MAINTENANCE MODE' : 'LIVE'}
              </div>
            </div>
            <div style={{ fontSize: 11, color: T.text4, fontFamily: 'monospace', marginTop: 4 }}>
              {maintenance ? 'Site is offline — users see maintenance page.' : 'Site is fully operational.'}
            </div>
          </div>
          <button
            onClick={toggleMaintenance}
            disabled={maintenanceLoading || maintenanceToggling}
            style={{
              background: maintenanceLoading || maintenanceToggling
                ? '#1a1d2e'
                : maintenance
                  ? 'linear-gradient(135deg,#22c55e,#15803d)'
                  : 'linear-gradient(135deg,#f43f5e,#be123c)',
              border: 'none',
              color: maintenanceLoading || maintenanceToggling ? '#334155' : '#fff',
              padding: '14px 32px',
              borderRadius: 12,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 2,
              cursor: maintenanceLoading || maintenanceToggling ? 'default' : 'pointer',
              fontFamily: 'monospace',
              boxShadow: maintenanceLoading || maintenanceToggling
                ? 'none'
                : maintenance
                  ? '0 4px 20px rgba(34,197,94,0.35)'
                  : '0 4px 20px rgba(244,63,94,0.45)',
              minWidth: 160,
              transition: 'all 0.2s',
            }}
          >
            {maintenanceToggling
              ? 'UPDATING...'
              : maintenance
                ? 'RESTORE LIVE'
                : 'KILL SWITCH'}
          </button>
        </div>

        <APITestDashboard
          onClose={() => window.location.href = '/'}
          onOpenRadar={() => window.location.href = '/?view=radar'}
          onOpenNews={() => window.location.href = '/?view=news'}
          T={T}
        />
      </div>
    </div>
  );
}
