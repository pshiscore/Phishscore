const { COOKIE_NAME, sessionToken, authorizeSession } = require('./_utils/cronAuth');

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
// Session token — stateless, derived from the admin credentials in ONE place
// (api/_utils/cronAuth.js) so every validator agrees with this issuer.
const SESSION_TOKEN = sessionToken();
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
    return res.status(200).json({ ok: authorizeSession(req).ok });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};

