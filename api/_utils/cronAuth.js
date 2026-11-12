// One answer to "may this request run a scheduled job?" for every cron handler.
//
// Vercel invokes a cron path with a bare GET. The only credential it will ever
// attach is `Authorization: Bearer <CRON_SECRET>`, and only when an env var
// literally named CRON_SECRET exists. The three cron handlers previously each
// checked a different thing — `x-internal-secret`, `Bearer $INTERNAL_SECRET`,
// `x-cron-secret` — none of which Vercel sends, so every scheduled run was
// rejected with 401 and the data only moved when someone pressed a button in
// the dev dashboard.
//
// Accepted, in order:
//   cron    Authorization: Bearer <CRON_SECRET>      ← what Vercel sends
//   manual  x-internal-secret: <INTERNAL_SECRET>     ← dev dashboard buttons
//   legacy  x-cron-secret / ?secret=                 ← older call sites
//
// CRON_SECRET falls back to INTERNAL_SECRET so setting one Vercel env var to
// the same value is enough. The hardcoded default is kept ONLY so existing
// manual callers do not break; it is public in this repo and should be retired.

const DEFAULT_SECRET = 'phiscore-radara-2026';

function secrets(env = process.env) {
  const internal = env.INTERNAL_SECRET || DEFAULT_SECRET;
  const cron = env.CRON_SECRET || internal;
  return { internal, cron };
}

function header(req, name) {
  const v = req?.headers?.[name];
  return Array.isArray(v) ? v[0] : v;
}

// Returns { ok, actor } where actor ∈ 'cron' | 'manual' | 'legacy' | null.
function authorizeCron(req, env = process.env) {
  const { internal, cron } = secrets(env);
  const bearer = (header(req, 'authorization') || '').replace(/^Bearer\s+/i, '');
  if (bearer && bearer === cron) return { ok: true, actor: 'cron' };
  if (header(req, 'x-internal-secret') === internal) return { ok: true, actor: 'manual' };
  if (header(req, 'x-cron-secret') === internal) return { ok: true, actor: 'legacy' };
  if (req?.query?.secret === internal) return { ok: true, actor: 'legacy' };
  return { ok: false, actor: null };
}

module.exports = { authorizeCron, DEFAULT_SECRET };
