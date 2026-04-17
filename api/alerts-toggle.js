const { Redis } = require('@upstash/redis');
const crypto = require('crypto');

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = REDIS_URL && REDIS_TOKEN ? new Redis({ url: REDIS_URL, token: REDIS_TOKEN }) : null;

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SESSION_TOKEN = crypto
  .createHmac('sha256', ADMIN_PASSWORD || 'fallback')
  .update(ADMIN_USERNAME || 'admin')
  .digest('hex');
const COOKIE_NAME = 'devs_session';
const KEY = 'submission_alerts_enabled';

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

  if (!redis) {
    return res.status(503).json({ error: 'Redis not configured', enabled: false });
  }

  if (req.method === 'GET') {
    const val = await redis.get(KEY);
    return res.status(200).json({ enabled: val === true || val === 'true' });
  }

  if (req.method === 'POST') {
    if (!isAuthorized(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const current = await redis.get(KEY);
    const next = !(current === true || current === 'true');
    await redis.set(KEY, next);
    return res.status(200).json({ enabled: next });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
