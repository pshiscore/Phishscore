import { useState, useEffect } from 'react';
import APITestDashboard from './APITestDashboard';

const T = {
  pageBg:      '#f8f6f2',
  cardBg:      '#ffffff',
  cardBorder:  '#e8e4de',
  inputBg:     '#ffffff',
  inputBorder: '#e8e4de',
  text:        '#111827',
  text2:       '#374151',
  text3:       '#6b7280',
  text4:       '#9ca3af',
  ringTrack:   '#e5e7eb',
  innerBg:     '#f3f0eb',
  innerBorder: '#e8e4de',
  tagBg:       '#f3f0eb',
  tagColor:    '#6b7280',
  scrollTrack: '#f0ede8',
  scrollThumb: '#c8c4bc',
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
  const [maintenanceError, setMaintenanceError] = useState(null);

  const [alerts, setAlerts] = useState(false);
  const [alertsLoading, setAlertsLoading] = useState(true);

  const [evalRunning, setEvalRunning] = useState(false);
  const [evalStatus, setEvalStatus] = useState(null); // null | 'success' | 'error'
  const [alertsToggling, setAlertsToggling] = useState(false);
  const [alertsError, setAlertsError] = useState(null);

  // Check for existing valid session on mount
  useEffect(() => {
    fetch('/api/auth-devs')
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          setAuthState('authenticated');
          fetch('/api/maintenance')
            .then(r => r.json())
            .then(d => {
              if (d.error) setMaintenanceError(d.error);
              setMaintenance(d.maintenance || false);
              setMaintenanceLoading(false);
            })
            .catch(() => { setMaintenanceError('Could not reach maintenance API.'); setMaintenanceLoading(false); });
          fetch('/api/alerts-toggle')
            .then(r => r.json())
            .then(d => {
              if (d.error) setAlertsError(d.error);
              setAlerts(d.enabled || false);
              setAlertsLoading(false);
            })
            .catch(() => { setAlertsError('Could not reach alerts API.'); setAlertsLoading(false); });
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

  const toggleAlerts = async () => {
    setAlertsToggling(true);
    try {
      const res = await fetch('/api/alerts-toggle', { method: 'POST' });
      const data = await res.json();
      if (res.ok) setAlerts(data.enabled);
    } finally {
      setAlertsToggling(false);
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
              onFocus={e => e.target.style.borderColor = '#f43f5e'}
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
              onFocus={e => e.target.style.borderColor = '#f43f5e'}
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
            style={{ width: '100%', background: submitting || !username || !password ? '#e5e7eb' : 'linear-gradient(135deg,#f43f5e,#be123c)', border: 'none', color: submitting || !username || !password ? '#9ca3af' : '#fff', padding: '12px', borderRadius: 10, fontSize: 12, fontWeight: 700, letterSpacing: 2, cursor: submitting ? 'default' : 'pointer', fontFamily: 'monospace', boxShadow: submitting ? 'none' : '0 4px 20px rgba(244,63,94,0.35)' }}>
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
            <div style={{ fontSize: 11, color: maintenanceError ? '#f43f5e' : T.text4, fontFamily: 'monospace', marginTop: 4 }}>
              {maintenanceError ? `Redis not configured — add UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN to Vercel.` : maintenance ? 'Site is offline — users see maintenance page.' : 'Site is fully operational.'}
            </div>
          </div>
          <button
            onClick={toggleMaintenance}
            disabled={maintenanceLoading || maintenanceToggling || !!maintenanceError}
            style={{
              background: maintenanceLoading || maintenanceToggling
                ? '#e5e7eb'
                : maintenance
                  ? 'linear-gradient(135deg,#22c55e,#15803d)'
                  : 'linear-gradient(135deg,#f43f5e,#be123c)',
              border: 'none',
              color: maintenanceLoading || maintenanceToggling ? '#9ca3af' : '#fff',
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

        {/* ── Submission Alerts ───────────────────────────────────────────────── */}
        <div style={{ marginBottom: 28, background: T.cardBg, border: `1px solid ${alerts ? '#5b6cf840' : T.cardBorder}`, borderRadius: 16, padding: '24px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: 4, color: alerts ? '#5b6cf8' : T.text4, fontFamily: 'monospace', marginBottom: 6 }}>SUBMISSION ALERTS</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: alerts ? '#5b6cf8' : T.text4, boxShadow: alerts ? '0 0 8px #5b6cf8' : 'none', flexShrink: 0 }} />
              <div style={{ fontSize: 20, fontWeight: 800, color: T.text, fontFamily: 'monospace', letterSpacing: 1 }}>
                {alertsLoading ? '...' : alerts ? 'ALERTS ON' : 'ALERTS OFF'}
              </div>
            </div>
            <div style={{ fontSize: 11, color: alertsError ? '#f43f5e' : T.text4, fontFamily: 'monospace', marginTop: 4 }}>
              {alertsError
                ? 'Redis not configured — add UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN to Vercel.'
                : alerts
                  ? 'Email report sent to vkrasikov@gmail.com for every submission.'
                  : 'No emails will be sent for submissions.'}
            </div>
          </div>
          <button
            onClick={toggleAlerts}
            disabled={alertsLoading || alertsToggling || !!alertsError}
            style={{
              background: alertsLoading || alertsToggling
                ? '#e5e7eb'
                : alerts
                  ? 'linear-gradient(135deg,#6b7280,#374151)'
                  : 'linear-gradient(135deg,#5b6cf8,#4338ca)',
              border: 'none',
              color: alertsLoading || alertsToggling ? '#9ca3af' : '#fff',
              padding: '14px 32px',
              borderRadius: 12,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 2,
              cursor: alertsLoading || alertsToggling ? 'default' : 'pointer',
              fontFamily: 'monospace',
              boxShadow: alertsLoading || alertsToggling
                ? 'none'
                : alerts
                  ? '0 4px 20px rgba(107,114,128,0.3)'
                  : '0 4px 20px rgba(91,108,248,0.4)',
              minWidth: 160,
              transition: 'all 0.2s',
            }}
          >
            {alertsToggling ? 'UPDATING...' : alerts ? 'DISABLE' : 'ENABLE ALERTS'}
          </button>
        </div>

        <APITestDashboard
          onClose={() => window.location.href = '/'}
          onOpenRadar={() => window.location.href = '/?view=radar'}
          onOpenNews={() => window.location.href = '/?view=news'}
          T={T}
          embedded
        />

        {/* ── Dev Tools ───────────────────────────────────────────────────────── */}
        <div style={{ marginTop: 28, display: 'flex', justifyContent: 'flex-end', gap: 12, flexWrap: 'wrap' }}>

          {/* Braintrust Eval */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <button
              onClick={async () => {
                setEvalRunning(true);
                setEvalStatus(null);
                try {
                  const res = await fetch('/api/evals/run-threat-eval', { method: 'POST' });
                  const data = await res.json();
                  setEvalStatus(res.ok && data.success ? 'success' : 'error');
                } catch {
                  setEvalStatus('error');
                } finally {
                  setEvalRunning(false);
                }
              }}
              disabled={evalRunning}
              style={{
                background: evalRunning
                  ? '#e5e7eb'
                  : evalStatus === 'success'
                    ? 'linear-gradient(135deg,#22c55e,#15803d)'
                    : evalStatus === 'error'
                      ? 'linear-gradient(135deg,#f43f5e,#be123c)'
                      : 'linear-gradient(135deg,#7c3aed,#5b21b6)',
                border: 'none',
                color: evalRunning ? '#9ca3af' : '#fff',
                padding: '10px 24px',
                borderRadius: 10,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 2,
                cursor: evalRunning ? 'default' : 'pointer',
                fontFamily: 'monospace',
                boxShadow: evalRunning ? 'none' : '0 4px 16px rgba(124,58,237,0.35)',
                transition: 'all 0.2s',
                minWidth: 220,
              }}
            >
              {evalRunning
                ? '⏳ RUNNING EVAL...'
                : evalStatus === 'success'
                  ? '✓ EVAL COMPLETE'
                  : evalStatus === 'error'
                    ? '✗ EVAL FAILED'
                    : 'RUN THREAT ANALYSIS EVAL SUITE'}
            </button>
            {evalStatus === 'success' && (
              <div style={{ fontSize: 10, color: '#22c55e', fontFamily: 'monospace', letterSpacing: 1 }}>
                Check Braintrust Dashboard for results
              </div>
            )}
            {evalStatus === 'error' && (
              <div style={{ fontSize: 10, color: '#f43f5e', fontFamily: 'monospace', letterSpacing: 1 }}>
                Eval failed — check Vercel logs
              </div>
            )}
          </div>

          {/* Sentry Test */}
          <button
            onClick={() => { throw new Error('Sentry test crash from PhishScore Command Center'); }}
            style={{
              background: 'linear-gradient(135deg,#dc2626,#991b1b)',
              border: 'none',
              color: '#fff',
              padding: '10px 24px',
              borderRadius: 10,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 2,
              cursor: 'pointer',
              fontFamily: 'monospace',
              opacity: 0.7,
            }}
          >
            TRIGGER SENTRY TEST CRASH
          </button>
        </div>
      </div>
    </div>
  );
}
