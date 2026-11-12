// GET /api/report?token=<64 hex>   the customer's link: status + the forensic report
// GET /api/report?case=<uuid>      the post-checkout landing: status only
//
// Replaces the browser reading deep_intel_cases with the anon key, which exposed
// every customer's email, report token and paid report to anyone holding main.js.
// This route uses the service key, validates the credential's shape before it
// reaches the database, compares the token in constant time, and returns only
// the fields ReportStatusModal reads.
//
// Why a case path exists: both checkout handlers redirect to /report?case=<id>
// before the payment webhook has minted a token. The id is a 122-bit UUID that
// only the payer's browser receives; this path never returns the report body or
// the original message. Replacing it with a checkout-time claim token is the
// cleaner design and needs a schema column.

const crypto = require('crypto');

const SUPABASE_URL = (process.env.REACT_APP_SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const TOKEN_RE = /^[a-f0-9]{64}$/; // crypto.randomBytes(32).toString('hex'), set by polar-webhook
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATUS_FIELDS = Object.freeze([
  'id', 'created_at', 'original_category', 'original_score', 'ivs_score', 'ivs_label',
  'tier', 'payment_status', 'report_generated_at', 'email', 'report_token',
]);
const REPORT_FIELDS = Object.freeze([...STATUS_FIELDS, 'forensic_report', 'urlscan_screenshot']);

const isValidToken = (t) => typeof t === 'string' && TOKEN_RE.test(t);
const isValidCaseId = (c) => typeof c === 'string' && UUID_RE.test(c);

function tokensMatch(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ba = Buffer.from(a), bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

const pick = (row, fields) => Object.fromEntries(fields.map(f => [f, row?.[f] ?? null]));
const shapeForToken = (row) => pick(row, REPORT_FIELDS);
const shapeForCase = (row) => pick(row, STATUS_FIELDS);

async function fetchCase(filter, fields) {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/deep_intel_cases?${filter}&select=${fields.join(',')}&limit=1`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  if (!r.ok) throw new Error(`Supabase ${r.status}`);
  const rows = await r.json();
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Not configured' });

  const { token, case: caseId } = req.query || {};
  const hasToken = token !== undefined, hasCase = caseId !== undefined;
  if (hasToken === hasCase) return res.status(400).json({ error: 'Provide exactly one of token or case' });

  try {
    if (hasToken) {
      // A malformed token is indistinguishable from an unknown one on purpose.
      if (!isValidToken(token)) return res.status(404).json({ error: 'Not found' });
      const row = await fetchCase(`report_token=eq.${token}`, REPORT_FIELDS);
      if (!row || !tokensMatch(row.report_token, token)) return res.status(404).json({ error: 'Not found' });
      return res.status(200).json(shapeForToken(row));
    }
    if (!isValidCaseId(caseId)) return res.status(404).json({ error: 'Not found' });
    const row = await fetchCase(`id=eq.${caseId.toLowerCase()}`, STATUS_FIELDS);
    if (!row) return res.status(404).json({ error: 'Not found' });
    return res.status(200).json(shapeForCase(row));
  } catch (err) {
    console.error('report lookup failed:', err.message);
    return res.status(502).json({ error: 'Lookup failed' });
  }
}

module.exports = handler;
Object.assign(module.exports, { STATUS_FIELDS, REPORT_FIELDS, isValidToken, isValidCaseId, tokensMatch, shapeForToken, shapeForCase });
