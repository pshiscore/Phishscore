// Shared fixed-window rate limiter.
//
// Counters live in Postgres (public.rate_limits, migration
// supabase/migrations/002_rate_limits.sql) behind the service-role-only RPC
// check_rate_limit, so limits hold across every serverless instance. The old
// in-memory Map was per-instance and reset on each cold start.
//
// Endpoints only ever call checkRateLimit / enforceRateLimit. The store is a
// single object with one method, hit(bucket, max, windowSeconds), so swapping
// Postgres for Redis later means writing another store, not touching routes.
//
// Fail CLOSED: if the store errors or does not answer within STORE_TIMEOUT_MS,
// the request is refused (unavailable: true → 503) and the failure is logged.
// Pass { failOpen: true } only for routes that cost nothing to serve.

const STORE_TIMEOUT_MS = 1500;
const MAX_BUCKET_LENGTH = 200;

// ── Stores ─────────────────────────────────────────────────────────────────────

function createSupabaseStore({ url, key, timeoutMs = STORE_TIMEOUT_MS } = {}) {
  return {
    name: 'supabase',
    async hit(bucket, max, windowSeconds) {
      const base = (url ?? process.env.REACT_APP_SUPABASE_URL ?? '').replace(/\/$/, '');
      const serviceKey = key ?? process.env.SUPABASE_SERVICE_KEY;
      if (!base || !serviceKey) throw new Error('rate limit store not configured');
      const res = await fetch(`${base}/rest/v1/rpc/check_rate_limit`, {
        method: 'POST',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ p_bucket: bucket, p_max: max, p_window_seconds: windowSeconds }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw new Error(`check_rate_limit HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const rows = await res.json();
      const row = Array.isArray(rows) ? rows[0] : rows;
      if (!row || typeof row.allowed !== 'boolean' || !Number.isInteger(row.current_count)) {
        throw new Error(`check_rate_limit unexpected response: ${JSON.stringify(rows).slice(0, 200)}`);
      }
      return { allowed: row.allowed, count: row.current_count };
    },
  };
}

// For unit tests and local experiments only — per-process, like the old limiter.
function createMemoryStore() {
  const windows = new Map();
  return {
    name: 'memory',
    async hit(bucket, max, windowSeconds) {
      const windowStart = Math.floor(Date.now() / 1000 / windowSeconds) * windowSeconds;
      const k = `${bucket}@${windowStart}`;
      const count = (windows.get(k) || 0) + 1;
      windows.set(k, count);
      return { allowed: count <= max, count };
    },
  };
}

let store = createSupabaseStore();
function setRateLimitStore(next) { store = next; }
function getRateLimitStore() { return store; }

// ── Interface ──────────────────────────────────────────────────────────────────

// Vercel sets x-forwarded-for to the real client address; the first entry is
// the client. Anything that is not an IPv4/IPv6 character is stripped so the
// bucket key cannot be stuffed.
function clientIp(req) {
  const fwd = String(req?.headers?.['x-forwarded-for'] || req?.headers?.['x-real-ip'] || req?.socket?.remoteAddress || req?.connection?.remoteAddress || '');
  const first = fwd.split(',')[0].trim().replace(/[^0-9a-fA-F:.]/g, '').slice(0, 64);
  return first || 'unknown';
}

function bucketFor(route, ip) {
  return `${String(route || 'default')}:${String(ip || 'unknown')}`.slice(0, MAX_BUCKET_LENGTH);
}

// Same leading arguments as the old limiter, plus the route.
// Returns { allowed, count, unavailable }.
async function checkRateLimit(ip, maxRequests = 5, windowSeconds = 60, route = 'default', { failOpen = false } = {}) {
  const bucket = bucketFor(route, ip);
  try {
    const { allowed, count } = await store.hit(bucket, maxRequests, windowSeconds);
    return { allowed, count, unavailable: false };
  } catch (err) {
    console.error(`[rateLimit] ${store.name} store failed for ${route} — failing ${failOpen ? 'OPEN' : 'CLOSED'}:`, err.message);
    return { allowed: failOpen, count: null, unavailable: true };
  }
}

// Route helper: answers 429 (over the limit) or 503 (limiter unavailable) and
// returns true when the handler must stop.
async function enforceRateLimit(req, res, { route, max, windowSeconds, message, failOpen = false }) {
  const { allowed, unavailable } = await checkRateLimit(clientIp(req), max, windowSeconds, route, { failOpen });
  if (allowed) return false;
  if (unavailable) {
    res.status(503).json({ error: 'service_unavailable', message: 'This service is temporarily unavailable. Please try again in a moment.' });
    return true;
  }
  res.setHeader('Retry-After', String(windowSeconds));
  res.status(429).json({ error: 'rate_limited', message: message || 'Too many requests. Please wait a moment before trying again.' });
  return true;
}

module.exports = {
  checkRateLimit, enforceRateLimit, clientIp, bucketFor,
  createSupabaseStore, createMemoryStore, setRateLimitStore, getRateLimitStore,
  STORE_TIMEOUT_MS,
};
