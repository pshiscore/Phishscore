const { analyzeContactData } = require('../lib/ipqs');
const { getDomainAge } = require('../lib/domain-age');
const { CATEGORY_GUIDE, coerceCategoryId, isValidCategoryId } = require('../lib/categories');
const { logUsage } = require('./_utils/logUsage');
const rateLimit = require('./_utils/rateLimit');
const recaptcha = require('./_utils/recaptcha');
// Shared with the Quick Scan UI (src/components/ActionRow.jsx) so the model's
// scale and the user-facing label cannot drift apart. Lives under src/ because
// CRA cannot import from outside src/; Node resolves it fine from here.
const { describeScoreBands } = require('../src/score-bands');

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

// Phone numbers, emails, links or a short message; longer text belongs in Analyze Threat.
const MAX_INPUT_CHARS = 2000;

// ── Input type detection ──────────────────────────────────────────────────────

function detectInputType(input) {
  const trimmed = input.trim();
  if (trimmed.includes('@') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return 'email';
  if (/^https?:\/\//i.test(trimmed)) return 'url';
  if (/^[\+\d][\d\s\-().]{6,}[\d]$/.test(trimmed.replace(/\s+/g, ' '))) return 'phone';
  return 'text';
}

// ── Claude Haiku quick scoring ────────────────────────────────────────────────

// Domain age is three-state: known, or unknown. An unknown age is NOT evidence of
// anything — stating it plainly keeps the model from reading a gap as "new domain".
function formatDomainAge(age) {
  if (age && age.status === 'known' && typeof age.days === 'number') {
    const registered = age.iso ? ` (registered ${age.iso.slice(0, 10)})` : '';
    const years = (age.days / 365.25).toFixed(1);
    return `${age.days} days${registered}, about ${years} years`;
  }
  return 'UNKNOWN — the age lookup returned no registration date. '
    + 'This is missing data, NOT evidence of a new domain. '
    + 'Do not treat it as recently registered, and do not let it raise the score.';
}

function buildOsintBlock(ipqsData) {
  if (!ipqsData?.data) return '';
  const d = ipqsData.data;
  const entity = ipqsData.input;

  if (ipqsData.type === 'email') {
    return `
OSINT DATA — We extracted the email "${entity}" and found:
  Fraud Score: ${d.fraud_score ?? 'N/A'}/100
  Recent Abuse: ${d.recent_abuse}
  Disposable Address: ${d.disposable}
  Spam Trap: ${d.spam_trap}
  Honeypot: ${d.honeypot}
  Leaked in Breach: ${d.leaked}
  Valid Inbox: ${d.valid}
  Domain: ${d.domain || 'N/A'}`;
  }

  if (ipqsData.type === 'phone') {
    return `
OSINT DATA — We extracted the phone number "${entity}" and found:
  Fraud Score: ${d.fraud_score ?? 'N/A'}/100
  Line Type: ${d.line_type || 'Unknown'} ${d.line_type === 'VOIP' ? '(CRITICAL: VOIP is heavily used by scammers)' : ''}
  Carrier: ${d.carrier || 'Unknown'}
  Recent Abuse: ${d.recent_abuse}
  Spammer Listed: ${d.spammer}
  Risky: ${d.risky}
  Active Status: ${d.active}
  Registered Name: ${d.name || 'Unknown'}
  Premium/Toll Rate: ${d.premium}`;
  }

  if (ipqsData.type === 'url') {
    return `
OSINT DATA — We scanned the URL "${entity}" and found:
  Risk Score: ${d.risk_score ?? 'N/A'}/100
  Phishing: ${d.phishing}
  Malware: ${d.malware}
  Unsafe: ${d.unsafe}
  Suspicious: ${d.suspicious}
  Parked Domain: ${d.parking}
  Known Spammer: ${d.spamming}
  Domain Age: ${formatDomainAge(d.domain_age)}
  Category: ${d.category || 'N/A'}`;
  }

  return '';
}

async function scoreWithClaude(rawInput, inputType, ipqsData) {
  const osintBlock = buildOsintBlock(ipqsData);
  const hasOsint = osintBlock.length > 0;

  const staticSystem = `You are a cyber threat analyst. Analyze submitted inputs and return a JSON object only — no explanation, no markdown.

Return this exact JSON shape:
{"score": <0-100 integer>, "category": "<one id from the category list>", "category_label": "<short human-readable label, max 40 chars>", "tags": ["<tag1>", "<tag2>"], "summary": "<one sentence, max 120 chars>", "shows_ai_patterns": <true if content shows LLM-generation patterns; false otherwise>, "impersonated_brand": "<primary brand/org being impersonated or null>", "extracted_iocs": ["<suspicious domains, URLs, or IPs; empty array if none>"], "vector": "<email|sms|social|phone|web|other>"}

Category rules:
- "category" MUST be exactly one id from this list, lowercase, nothing else:
${CATEGORY_GUIDE}
- Pick "other" when nothing above fits or there is too little signal. "other" is a
  valid, expected answer — never force a closer-sounding id to avoid it
- "category_label" is a short human-readable description of what you actually found
  (e.g. "VOIP Cold Call", "No Threat Detected", "Insufficient Signal")
- NEVER describe an entity as suspicious in category_label unless a specific observed
  signal supports it, and name that signal in the summary
- Absent, unknown or unavailable data is NOT a signal. Missing data must never
  produce a threat label or raise the score

Tags rules:
- 1 to 3 short context tags based on the input (e.g. ["Insurance", "Cold Call", "Spoofed Number"])
- Tags must NOT contain any PII (no phone numbers, emails, names, or addresses)
- Tags should describe the scam type, medium, or tactic — not the victim

Scoring guide (these bands are also what the user sees, so your score must match the verdict you describe):
${describeScoreBands()}

Additional rules:
- VOIP line type + legitimacy claim in text = score ≥ 80
- Fraud score ≥ 75 from IPQS = score ≥ 70
- Disposable or honeypot email = score ≥ 65
- Phishing or malware flag from URL scan = score ≥ 85
- Parked domain = score ≥ 75
- Valid Inbox = false or Active Status = false AND content claims to be from a legitimate org = score ≥ 85 (spoofed/dead-drop sender)
- All threat checks clean (no phishing, malware, unsafe, suspicious, parked, spam flags) and no scam patterns in the text = score ≤ 20
- An unknown domain age, or any other unavailable field, adds NOTHING to the score
- Only cite evidence actually present in the OSINT DATA or the input text. Never state or imply a registration date, domain age, or any other fact that was not given to you
- Be concise and objective`;

  const userMessage = `User Input: "${rawInput}"
Input Type: ${inputType}
${hasOsint ? osintBlock : 'OSINT DATA: No entity extracted or OSINT unavailable for this input type.'}

Instructions: ${hasOsint
  ? `Analyze the contextual claims in the User Input against the technical reality of the OSINT Data. If the text claims to be from a legitimate organization (e.g., a bank, government agency) but the OSINT shows a VOIP line, high fraud score, disposable email, or phishing flag — treat that mismatch as a severe threat indicator and raise the score significantly.`
  : `Analyze the User Input for scam patterns, urgency tactics, impersonation, suspicious links, or social engineering. Score based on content alone.`}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      temperature: 0, // a disputed scan must be reproducible
      system: [{ type: 'text', text: staticSystem, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!res.ok) throw new Error(`Claude error [${res.status}]`);
  const data = await res.json();
  logUsage({ endpoint: 'quick-scan', model: 'claude-haiku-4-5-20251001', input_tokens: data?.usage?.input_tokens, output_tokens: data?.usage?.output_tokens }).catch(() => {});
  const text = data?.content?.map(c => c.text || '').join('').trim();

  // Parse JSON — strip any accidental markdown fences
  const jsonStr = text.replace(/^```json?\s*/i, '').replace(/```$/i, '').trim();
  try {
    const parsed = JSON.parse(jsonStr);
    // Ensure tags is always an array
    if (!Array.isArray(parsed.tags)) parsed.tags = [];
    if (!isValidCategoryId(parsed.category)) {
      console.warn('[quick-scan] model returned non-canonical category:', JSON.stringify(parsed.category));
    }
    parsed.category = coerceCategoryId(parsed.category);
    if (typeof parsed.category_label !== 'string' || !parsed.category_label.trim()) {
      parsed.category_label = null;
    }
    return parsed;
  } catch (err) {
    // Previously this returned score 50 / "Suspicious Activity" — an
    // infrastructure failure rendered as a threat verdict the user could not
    // distinguish from a real one. Surface it instead.
    throw new Error(`AI response was not valid JSON: ${err.message}`);
  }
}

// ── Supabase insert ───────────────────────────────────────────────────────────

async function insertQuickScan(record) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('insertQuickScan: missing env vars — SUPABASE_URL:', !!SUPABASE_URL, 'SUPABASE_SERVICE_KEY:', !!SUPABASE_KEY);
    return;
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/quick_scans`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(record),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('quick_scans insert failed [' + res.status + ']:', err);
    return null;
  }
  // Prefer: return=representation is already set, so the new row comes back —
  // surface its id so a user can quote a scan when disputing a result.
  let scanId = null;
  try {
    const rows = await res.json();
    scanId = (Array.isArray(rows) ? rows[0] : rows)?.id ?? null;
  } catch (err) {
    console.warn('quick_scans insert: could not read returned row:', err.message);
  }
  console.log('quick_scans insert ok, id:', scanId, 'input_type:', record.input_type, 'score:', record.ai_score);
  return scanId;
}

// ── Main handler ──────────────────────────────────────────────────────────────

// Paid route. Order: rate limit (shared, fails closed) → input validation →
// reCAPTCHA (fails closed) → paid calls. The model, system prompt and token
// limit are fixed below; nothing in the request body can change them.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const message = 'Too many scans in a short time. Please wait a moment and try again.';
  if (await rateLimit.enforceRateLimit(req, res, { route: 'quick-scan:min', max: 6, windowSeconds: 60, message })) return;
  if (await rateLimit.enforceRateLimit(req, res, { route: 'quick-scan:day', max: 60, windowSeconds: 86400, message: 'Daily scan limit reached. Please try again tomorrow.' })) return;

  const { input, recaptchaToken } = req.body || {};
  if (!input || typeof input !== 'string' || !input.trim()) {
    return res.status(400).json({ error: 'input is required' });
  }
  if (input.length > MAX_INPUT_CHARS) {
    return res.status(400).json({ error: `input is longer than ${MAX_INPUT_CHARS} characters` });
  }

  if (await recaptcha.requireHuman(req, res, recaptchaToken, 'quick_scan', { remoteIp: rateLimit.clientIp(req) })) return;

  if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  const rawInput = input.trim();
  const inputType = detectInputType(rawInput);

  // OSINT check — run for all types; smart router extracts entity from free text too
  let ipqsData = null;
  try {
    ipqsData = await analyzeContactData(rawInput);
    if (ipqsData?.type === 'unknown') ipqsData = null; // no entity found, skip
  } catch (err) {
    console.warn('IPQS quick-scan failed (non-fatal):', err.message);
  }

  // Authoritative domain age (RDAP first). IPQS frequently has no creation date,
  // and its absence previously read as "new domain" to the model.
  if (ipqsData?.type === 'url' && ipqsData.data) {
    try {
      const age = await getDomainAge(ipqsData.input);
      if (age) ipqsData.data.domain_age = age;
    } catch (err) {
      console.warn('domain age lookup failed (non-fatal):', err.message);
    }
  }

  // AI scoring
  let aiResult;
  try {
    aiResult = await scoreWithClaude(rawInput, inputType, ipqsData);
  } catch (err) {
    return res.status(500).json({ error: `AI scoring failed: ${err.message}` });
  }

  // Persist — visibility is hardcoded private, cannot be overridden
  const scanId = await insertQuickScan({
    input_type: inputType,
    raw_input: rawInput,
    ipqs_data: ipqsData || null,
    ai_score: aiResult.score,
    ai_category: aiResult.category,
    ai_tags: aiResult.tags || [],
    visibility: 'private',
    created_at: new Date().toISOString(),
    radar_metadata: {
      category_label: aiResult.category_label ?? null,
      shows_ai_patterns: aiResult.shows_ai_patterns ?? null,
      impersonated_brand: aiResult.impersonated_brand ?? null,
      extracted_iocs: Array.isArray(aiResult.extracted_iocs) ? aiResult.extracted_iocs : [],
      vector: aiResult.vector ?? 'other',
    },
  });

  return res.status(200).json({
    ok: true,
    scan_id: scanId,
    input_type: inputType,
    score: aiResult.score,
    category: aiResult.category,
    category_label: aiResult.category_label ?? null,
    summary: aiResult.summary,
    osint: ipqsData
      ? {
          type: ipqsData.type,
          // Do NOT back-fill from risk_score: for URLs there is no fraud_score, and
          // reusing one number under two labels reads as two corroborating signals.
          fraud_score: ipqsData.data?.fraud_score ?? null,
          recent_abuse: ipqsData.data?.recent_abuse ?? null,
          // email
          disposable: ipqsData.data?.disposable ?? null,
          spam_trap: ipqsData.data?.spam_trap ?? null,
          valid: ipqsData.data?.valid ?? null,
          // phone
          line_type: ipqsData.data?.line_type ?? null,
          carrier: ipqsData.data?.carrier ?? null,
          active: ipqsData.data?.active ?? null,
          name: ipqsData.data?.name ?? null,
          premium: ipqsData.data?.premium ?? null,
          // url
          phishing: ipqsData.data?.phishing ?? null,
          malware: ipqsData.data?.malware ?? null,
          unsafe: ipqsData.data?.unsafe ?? null,
          risk_score: ipqsData.data?.risk_score ?? null,
          parking: ipqsData.data?.parking ?? null,
          spamming: ipqsData.data?.spamming ?? null,
          domain_age: ipqsData.data?.domain_age ?? null,
        }
      : null,
  });
};

// Assigned after module.exports = handler; assigning first (as before) put it on
// the object that the handler then replaced, so it was silently dropped.
module.exports.config = { maxDuration: 30, api: { bodyParser: { sizeLimit: '16kb' } } };
