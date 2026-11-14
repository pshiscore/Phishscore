import React from 'react';
import './styles/fallback.css';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App';
import BetaDashboard from './components/BetaDashboard';
import DevDashboard from './components/DevDashboard';

Sentry.init({
  dsn: process.env.REACT_APP_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  // Short commit SHA, set by the build script ("dev" for local builds). Never
  // reference a REACT_APP_* variable that might be unset: CRA then inlines the
  // whole process.env object, including Vercel's commit message and git metadata.
  release: process.env.REACT_APP_RELEASE,
  tracesSampleRate: 0.2,
  // Session Replay is deliberately off: its recorder copies style attributes
  // in a way the CSP reports, and errors plus traces are all we need.
  integrations: [Sentry.browserTracingIntegration()],
});

const fallback = (
  <div style={{
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    background: '#f8f6f2',
    fontFamily: 'monospace',
    gap: 12,
    padding: 24,
    textAlign: 'center',
  }}>
    <div style={{ fontSize: 11, letterSpacing: 4, color: '#f43f5e' }}>PHISHSCORE.AI</div>
    <div style={{ fontSize: 22, fontWeight: 800, color: '#111827', letterSpacing: 1 }}>Something went wrong.</div>
    <div style={{ fontSize: 13, color: '#6b7280', maxWidth: 400 }}>
      Our engineering team has been automatically notified. Please refresh the page or try again shortly.
    </div>
    <button
      onClick={() => window.location.reload()}
      style={{
        marginTop: 8,
        background: 'linear-gradient(135deg,#f43f5e,#be123c)',
        border: 'none',
        color: '#fff',
        padding: '10px 28px',
        borderRadius: 10,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 2,
        cursor: 'pointer',
      }}
    >
      RELOAD PAGE
    </button>
  </div>
);

const path = window.location.pathname;

// The in-app legal modal was removed; old ?legal=terms|privacy links go to the
// static pages, which are the only copies of the policy and terms.
const legal = new URLSearchParams(window.location.search).get('legal');
if (legal === 'privacy' || legal === 'terms') window.location.replace(`/${legal}.html`);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={fallback}>
      {path === '/beta' ? <BetaDashboard /> : path === '/devs' ? <DevDashboard /> : <App />}
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);
