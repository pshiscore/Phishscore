import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import BetaDashboard from './components/BetaDashboard';

const isBeta = window.location.pathname === '/beta';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {isBeta ? <BetaDashboard /> : <App />}
  </React.StrictMode>
);
