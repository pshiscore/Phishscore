const crypto = require('crypto');

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SESSION_TOKEN = crypto
  .createHmac('sha256', ADMIN_PASSWORD || 'fallback')
  .update(ADMIN_USERNAME || 'admin')
  .digest('hex');
const COOKIE_NAME = 'devs_session';

// In-memory state — resets on cold start (maintenance mode is never "stuck on")
let maintenanceOn = false;

function parseCookies(cookieHeader) {
  return Object.fromEntries(
    (cookieHeader || '').split(';').map(c => {
      const [k, ...v] = c.trim().split('=');
      return [k, v.join('=')];
    }).filter(([k]) => k)
  );
}

function isAuthorized(req) {
  if (!ADMIN_PASSWORD) return false;
  const cookies = parseCookies(req.headers.cookie);
  return cookies[COOKIE_NAME] === SESSION_TOKEN;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'GET') {
    return res.status(200).json({ maintenance: maintenanceOn });
  }

  if (req.method === 'POST') {
    if (!isAuthorized(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    maintenanceOn = !maintenanceOn;
    return res.status(200).json({ maintenance: maintenanceOn });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
