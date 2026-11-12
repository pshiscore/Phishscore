// reCAPTCHA v3 server-side verification — fails CLOSED.
//
// Every path that cannot positively verify a human returns ok: false:
// missing secret, missing token, Google unreachable or slow, success: false,
// wrong action, wrong hostname, low or missing score. The previous inline
// version in api/analyze.js returned true for the first three, and because the
// site never loaded the reCAPTCHA script, every real request took that path.
//
// Callers should treat reason 'not_configured' / 'unavailable' as a 503 (our
// side is broken) and everything else as a 403 (the request did not verify).

const VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';
const EXPECTED_HOSTNAMES = ['phishscore.ai', 'www.phishscore.ai'];
const DEFAULT_MIN_SCORE = 0.5;
const VERIFY_TIMEOUT_MS = 3000;

const SERVER_SIDE_REASONS = new Set(['not_configured', 'unavailable']);

async function verifyRecaptcha(token, { action, minScore = DEFAULT_MIN_SCORE, remoteIp, timeoutMs = VERIFY_TIMEOUT_MS } = {}) {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    console.error('[recaptcha] RECAPTCHA_SECRET_KEY is not set — refusing request');
    return { ok: false, reason: 'not_configured' };
  }
  if (!action) {
    console.error('[recaptcha] verifyRecaptcha called without an expected action — refusing request');
    return { ok: false, reason: 'not_configured' };
  }
  if (typeof token !== 'string' || token.length === 0) return { ok: false, reason: 'missing_token' };

  let data;
  try {
    const params = new URLSearchParams({ secret, response: token });
    if (remoteIp && remoteIp !== 'unknown') params.set('remoteip', remoteIp);
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`siteverify HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    console.error('[recaptcha] verification unavailable — refusing request:', err.message);
    return { ok: false, reason: 'unavailable' };
  }

  if (!data || data.success !== true) {
    console.warn('[recaptcha] token rejected:', JSON.stringify(data?.['error-codes'] || []));
    return { ok: false, reason: 'invalid' };
  }
  if (data.action !== action) {
    console.warn(`[recaptcha] action mismatch: expected ${action}, got ${data.action}`);
    return { ok: false, reason: 'action_mismatch' };
  }
  if (!EXPECTED_HOSTNAMES.includes(data.hostname)) {
    console.warn(`[recaptcha] hostname mismatch: ${data.hostname}`);
    return { ok: false, reason: 'hostname_mismatch' };
  }
  if (typeof data.score !== 'number' || data.score < minScore) {
    console.warn(`[recaptcha] low score ${data.score} for ${action}`);
    return { ok: false, reason: 'low_score', score: data.score };
  }
  return { ok: true, score: data.score };
}

function isServerSideFailure(reason) { return SERVER_SIDE_REASONS.has(reason); }

// Route helper: answers 503 (we cannot verify) or 403 (did not verify) and
// returns true when the handler must stop. Looks the verifier up on
// module.exports at call time so unit tests can mock it.
async function requireHuman(req, res, token, action, { minScore = DEFAULT_MIN_SCORE, remoteIp } = {}) {
  const human = await module.exports.verifyRecaptcha(token, { action, minScore, remoteIp });
  if (human.ok) return false;
  if (isServerSideFailure(human.reason)) {
    res.status(503).json({ error: 'service_unavailable', message: 'This service is temporarily unavailable. Please try again in a few minutes.' });
  } else {
    res.status(403).json({ error: 'verification_failed', message: "We couldn't verify this request came from a person. Please refresh the page and try again." });
  }
  return true;
}

module.exports = { verifyRecaptcha, isServerSideFailure, requireHuman, EXPECTED_HOSTNAMES, VERIFY_URL };
