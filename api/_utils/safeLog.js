// Log helpers that keep visitor input out of server logs (Vercel, and any
// drain attached to them).
//
// dbError: a PostgREST error body can echo row values: `details` carries
//   "Failing row contains (...)" or "Key (email)=(...) already exists", and
//   some messages end in `: "<value>"`. Keep the code and the message only,
//   with any quoted value after a colon removed.
// safeError: JSON.parse errors quote a snippet of the text being parsed (a
//   model reply that can repeat the visitor's message), so they are reduced
//   to their type.

function dbError(text) {
  let body;
  try { body = JSON.parse(text); } catch { return '(non-JSON error body)'; }
  if (!body || typeof body !== 'object') return '(unrecognised error body)';
  const message = typeof body.message === 'string'
    ? body.message.replace(/:\s*".*$/s, ': <redacted>').slice(0, 200)
    : '';
  return [body.code, message].filter(Boolean).join(' ') || '(no message)';
}

function safeError(err) {
  if (err instanceof SyntaxError) return 'SyntaxError: invalid JSON';
  const msg = err && typeof err.message === 'string' ? err.message : String(err);
  return msg.slice(0, 200);
}

module.exports = { dbError, safeError };
