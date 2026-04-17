const crypto = require('crypto');

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
// Session token — derived from credentials so it's stateless and auto-invalidates on password change
const SESSION_TOKEN = crypto
  .createHmac('sha256', ADMIN_PASSWORD || 'fallback')
  .update(ADMIN_USERNAME || 'admin')
  .digest('hex');

const COOKIE_NAME = 'devs_session';
const COOKIE_MAX_AGE = 60 * 60 * 8; // 8 hours

module.exports = async function handler(req, res) {
  // POST /api/auth-devs — validate credentials, set session cookie
  if (req.method === 'POST') {
    const { username, password } = req.body || {};

    if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
      console.error('auth-devs: ADMIN_USERNAME or ADMIN_PASSWORD env vars not set');
      return res.status(500).json({ error: 'Auth not configured' });
    }

    const validUser = username === ADMIN_USERNAME;
    const validPass = password === ADMIN_PASSWORD;

    if (!validUser || !validPass) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.setHeader('Set-Cookie', [
      `${COOKIE_NAME}=${SESSION_TOKEN}; HttpOnly; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Strict${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`,
    ]);
    return res.status(200).json({ ok: true });
  }

  // GET /api/auth-devs — check if session cookie is valid
  if (req.method === 'GET') {
    const cookies = parseCookies(req.headers.cookie || '');
    const token = cookies[COOKIE_NAME];
    const valid = !!ADMIN_PASSWORD && token === SESSION_TOKEN;
    return res.status(200).json({ ok: valid });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};

function parseCookies(cookieHeader) {
  return Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [k, ...v] = c.trim().split('=');
      return [k, v.join('=')];
    }).filter(([k]) => k)
  );
}
