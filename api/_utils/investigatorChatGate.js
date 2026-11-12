// The investigator chat is parked (see docs/INVESTIGATOR_CHAT_PARKED.md).
//
// Same pattern as api/_utils/deepIntelGate.js: fail-closed, read per request.
// Only the literal string 'true' in INVESTIGATOR_CHAT_ENABLED turns it on.

const PARKED_MESSAGE = 'The AI chat is currently turned off';

function investigatorChatEnabled(env = process.env) {
  return env.INVESTIGATOR_CHAT_ENABLED === 'true';
}

// Returns true when the request was answered with 503 and the handler must
// stop. Call it first: before rate limiting, parsing, or any outbound call.
function rejectIfChatParked(req, res) {
  if (investigatorChatEnabled()) return false;
  res.setHeader('Cache-Control', 'no-store');
  res.status(503).json({ error: PARKED_MESSAGE });
  return true;
}

module.exports = { investigatorChatEnabled, rejectIfChatParked, PARKED_MESSAGE };
