const { Redis } = require('@upstash/redis');

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = REDIS_URL && REDIS_TOKEN ? new Redis({ url: REDIS_URL, token: REDIS_TOKEN }) : null;

/**
 * IP-based sliding-window rate limiter backed by Redis.
 * Falls back to allowing the request if Redis is not configured.
 *
 * @param {string} ip
 * @param {number} maxRequests  max requests per window (default 5)
 * @param {number} windowSeconds  window size in seconds (default 60)
 * @returns {Promise<{ allowed: boolean, count?: number }>}
 */
async function checkRateLimit(ip, maxRequests = 5, windowSeconds = 60) {
  if (!redis) return { allowed: true };

  const key = `rate_limit:${ip}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, windowSeconds);
  }

  if (count > maxRequests) {
    return { allowed: false, count };
  }
  return { allowed: true, count };
}

module.exports = { checkRateLimit };
