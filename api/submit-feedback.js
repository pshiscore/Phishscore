// POST /api/submit-feedback — "Was this result accurate?" on an Analyze result.
//
// Order: per-IP rate limit (shared, fails closed) → input validation →
// reCAPTCHA (fails closed) → the submission / training row must exist →
// one vote per submission per IP per UTC day → write.
//
// The one-vote rule reuses the rate_limits table: bucket
// "feedback-vote:<id>:<ip>" with max 1 over a 86400 s fixed window, so the
// "day" is the UTC calendar day, not a rolling 24 hours.

const rateLimit = require('./_utils/rateLimit');
const recaptcha = require('./_utils/recaptcha');

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_FEEDBACK_CHARS = 1000;
const DAY = 86400;

const sbHeaders = () => ({ apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` });

async function rowExists(table, id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}&select=id&limit=1`, { headers: sbHeaders() });
  if (!res.ok) throw new Error(`${table} lookup failed [${res.status}]`);
  const rows = await res.json();
  return Array.isArray(rows) && rows.length === 1;
}

async function patch(table, id, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...sbHeaders(), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  });
  if (!res.ok) console.error(`submit-feedback: ${table} PATCH failed`, await res.text());
}

function validate(body) {
  const { caseId = null, trainingId = null, is_accurate, feedbackText = '', recaptchaToken = null } = body || {};
  if (typeof is_accurate !== 'boolean') return { error: 'is_accurate must be true or false' };
  if (caseId !== null && (typeof caseId !== 'string' || !UUID_RE.test(caseId))) return { error: 'caseId is not a valid id' };
  if (trainingId !== null && (typeof trainingId !== 'string' || !UUID_RE.test(trainingId))) return { error: 'trainingId is not a valid id' };
  if (!caseId && !trainingId) return { error: 'caseId or trainingId is required' };
  if (typeof feedbackText !== 'string') return { error: 'feedbackText must be a string' };
  if (feedbackText.length > MAX_FEEDBACK_CHARS) return { error: `feedbackText is longer than ${MAX_FEEDBACK_CHARS} characters` };
  return { value: { caseId: caseId && caseId.toLowerCase(), trainingId: trainingId && trainingId.toLowerCase(), isAccurate: is_accurate, feedbackText, recaptchaToken } };
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (await rateLimit.enforceRateLimit(req, res, { route: 'submit-feedback:min', max: 10, windowSeconds: 60 })) return;

  const { error, value } = validate(req.body);
  if (error) return res.status(400).json({ error });

  const ip = rateLimit.clientIp(req);
  if (await recaptcha.requireHuman(req, res, value.recaptchaToken, 'feedback', { remoteIp: ip })) return;

  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(503).json({ error: 'service_unavailable' });

  try {
    const [caseOk, trainingOk] = await Promise.all([
      value.caseId ? rowExists('submissions', value.caseId) : true,
      value.trainingId ? rowExists('training_data', value.trainingId) : true,
    ]);
    if (!caseOk || !trainingOk) return res.status(404).json({ error: 'Not found' });
  } catch (err) {
    console.error('submit-feedback lookup error:', err.message);
    return res.status(503).json({ error: 'service_unavailable' });
  }

  // One vote per result per IP per day. Keyed on the submission when there is
  // one, otherwise on the training row.
  const voteKey = value.caseId ? `feedback-vote:${value.caseId}` : `feedback-vote:t:${value.trainingId}`;
  const vote = await rateLimit.checkRateLimit(ip, 1, DAY, voteKey);
  if (vote.unavailable) return res.status(503).json({ error: 'service_unavailable' });
  if (!vote.allowed) return res.status(409).json({ error: 'already_voted', message: "You've already rated this result today." });

  if (value.caseId) {
    await patch('submissions', value.caseId, {
      is_accurate: value.isAccurate,
      user_feedback: value.feedbackText || null,
      // There is no feedback_at column on submissions; sending it made
      // PostgREST reject every PATCH, so no feedback was ever stored.
    });
  }
  if (value.trainingId) await patch('training_data', value.trainingId, { is_accurate: value.isAccurate });

  return res.status(200).json({ ok: true });
}

module.exports = handler;
module.exports.config = { api: { bodyParser: { sizeLimit: '16kb' } } };
