// Deep Intel is parked (see docs/DEEP_INTEL_PARKED.md).
//
// Every endpoint behind the feature asks this gate first. It is fail-closed:
// only the literal string 'true' in DEEP_INTEL_ENABLED turns the backend on,
// and the variable is read on every request so a Vercel env change takes
// effect on the next invocation without a code change.

const PARKED_MESSAGE = 'Deep Intel is currently available by request only';

function deepIntelEnabled(env = process.env) {
  return env.DEEP_INTEL_ENABLED === 'true';
}

// Returns true when the request was answered with 503 and the handler must
// stop. Call it before any body parsing, database call or external API call.
function rejectIfParked(req, res) {
  if (deepIntelEnabled()) return false;
  res.setHeader('Cache-Control', 'no-store');
  res.status(503).json({ error: PARKED_MESSAGE });
  return true;
}

module.exports = { deepIntelEnabled, rejectIfParked, PARKED_MESSAGE };
