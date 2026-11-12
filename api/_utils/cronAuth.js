// The one gate for scheduled jobs and their manual triggers.
//
// Two callers, two credentials, nothing else:
//   cron    Authorization: Bearer <CRON_SECRET>   — what Vercel attaches to a
//           scheduled invocation. Fails closed: no CRON_SECRET, no cron.
//   manual  devs_session cookie                   — issued by /api/auth-devs
//           after an admin login. Derived once here; every validator agrees
//           with the issuer, and validation always fails closed when the
//           admin credentials are unset.
//
// There is no shared string, no header the browser has to know, and no
// hardcoded default. The old x-internal-secret / x-cron-secret / ?secret=
// forms are refused.

const crypto = require('crypto');

const COOKIE_NAME = 'devs_session';

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ba = Buffer.from(a), bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

// Stateless session token: changes whenever the admin password changes.
// /api/auth-devs issues it; this is the only place it is derived.
function sessionToken(env = process.env) {
  return crypto
    .createHmac('sha256', env.ADMIN_PASSWORD || 'fallback')
    .update(env.ADMIN_USERNAME || 'admin')
    .digest('hex');
}

function parseCookies(header = '') {
  return Object.fromEntries(
    String(header || '').split(';').map(c => {
      const [k, ...v] = c.trim().split('=');
      return [k, v.join('=')];
    }).filter(([k]) => k)
  );
}

function header(req, name) {
  const v = req?.headers?.[name];
  return Array.isArray(v) ? v[0] : v;
}

const refuse = (reason) => ({ ok: false, actor: null, reason });

function authorizeCron(req, env = process.env) {
  if (!env.CRON_SECRET) return refuse('CRON_SECRET not configured');
  // The scheme is required: a bare token in the Authorization header is not a
  // bearer credential, and must not be compared as one.
  const m = /^Bearer\s+(\S+)$/i.exec(header(req, 'authorization') || '');
  if (!m) return refuse('no bearer token');
  return safeEqual(m[1], env.CRON_SECRET) ? { ok: true, actor: 'cron' } : refuse('bad bearer token');
}

function authorizeSession(req, env = process.env) {
  if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD) return refuse('admin credentials not configured');
  const token = parseCookies(header(req, 'cookie'))[COOKIE_NAME];
  if (!token) return refuse('no session cookie');
  return safeEqual(token, sessionToken(env))
    ? { ok: true, actor: `manual:${env.ADMIN_USERNAME}` }
    : refuse('bad session cookie');
}

function authorizeJob(req, env = process.env) {
  const cron = authorizeCron(req, env);
  if (cron.ok) return cron;
  const session = authorizeSession(req, env);
  if (session.ok) return session;
  return refuse('unauthorized');
}

// Handler-side: returns the auth result, or sends 401 and returns null.
function requireJobAuth(req, res, env = process.env) {
  const auth = authorizeJob(req, env);
  if (!auth.ok) { res.status(401).json({ error: 'Unauthorized' }); return null; }
  return auth;
}

module.exports = { COOKIE_NAME, sessionToken, parseCookies, authorizeCron, authorizeSession, authorizeJob, requireJobAuth };
