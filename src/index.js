import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import BetaDashboard from './components/BetaDashboard';
import DevDashboard from './components/DevDashboard';

const path = window.location.pathname;

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {path === '/beta' ? <BetaDashboard /> : path === '/devs' ? <DevDashboard /> : <App />}
  </React.StrictMode>
);
