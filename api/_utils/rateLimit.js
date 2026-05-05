// In-memory sliding-window rate limiter (no Redis dependency).
// Resets per serverless cold start — sufficient for abuse protection.
const counts = new Map();

async function checkRateLimit(ip, maxRequests = 5, windowSeconds = 60) {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const key = ip;

  const entry = counts.get(key);
  if (!entry || now - entry.start > windowMs) {
    counts.set(key, { start: now, count: 1 });
    return { allowed: true, count: 1 };
  }

  entry.count += 1;
  if (entry.count > maxRequests) {
    return { allowed: false, count: entry.count };
  }
  return { allowed: true, count: entry.count };
}

module.exports = { checkRateLimit };
