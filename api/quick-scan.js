const { analyzeContactData } = require('../lib/ipqs');

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

module.exports.config = { maxDuration: 30 };

// ── Input type detection ──────────────────────────────────────────────────────

function detectInputType(input) {
  const trimmed = input.trim();
  if (trimmed.includes('@') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return 'email';
  if (/^https?:\/\//i.test(trimmed)) return 'url';
  if (/^[\+\d][\d\s\-().]{6,}[\d]$/.test(trimmed.replace(/\s+/g, ' '))) return 'phone';
  return 'text';
}

// ── Claude Haiku quick scoring ────────────────────────────────────────────────

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
  Risky: ${d.risky}`;
  }

  if (ipqsData.type === 'url') {
    return `
OSINT DATA — We scanned the URL "${entity}" and found:
  Risk Score: ${d.risk_score ?? 'N/A'}/100
  Phishing: ${d.phishing}
  Malware: ${d.malware}
  Unsafe: ${d.unsafe}
  Suspicious: ${d.suspicious}
  Domain Age: ${d.domain_age ? JSON.stringify(d.domain_age) : 'Unknown'}
  Category: ${d.category || 'N/A'}`;
  }

  return '';
}

async function scoreWithClaude(rawInput, inputType, ipqsData) {
  const osintBlock = buildOsintBlock(ipqsData);
  const hasOsint = osintBlock.length > 0;

  const prompt = `You are a cyber threat analyst. Analyze the following and return a JSON object only — no explanation, no markdown.

User Input (what the user submitted):
"${rawInput}"

Input Type: ${inputType}
${hasOsint ? osintBlock : 'OSINT DATA: No entity extracted or OSINT unavailable for this input type.'}

Instructions: ${hasOsint
  ? `Analyze the contextual claims in the User Input against the technical reality of the OSINT Data. If the text claims to be from a legitimate organization (e.g., a bank, government agency) but the OSINT shows a VOIP line, high fraud score, disposable email, or phishing flag — treat that mismatch as a severe threat indicator and raise the score significantly.`
  : `Analyze the User Input for scam patterns, urgency tactics, impersonation, suspicious links, or social engineering. Score based on content alone.`}

Return this exact JSON shape (no markdown, no explanation):
{"score": <0-100 integer>, "category": "<descriptive category>", "tags": ["<tag1>", "<tag2>"], "summary": "<one sentence, max 120 chars>", "shows_ai_patterns": <true if content shows LLM-generation patterns; false otherwise>, "impersonated_brand": "<primary brand/org being impersonated or null>", "extracted_iocs": ["<suspicious domains, URLs, or IPs; empty array if none>"], "vector": "<email|sms|social|phone|web|other>"}

Category rules:
- MUST be a specific, highly descriptive label — e.g. "Insurance Scam", "Delivery Phishing", "Tech Support Fraud", "Bank Impersonation", "Romance Scam", "Investment Fraud", "IRS Impersonation", "Suspicious URL"
- NEVER output "Unknown", "AI Detect", "unknown", or any generic placeholder
- If genuinely unclear, use the closest plausible threat type, e.g. "Suspicious Cold Call" or "Unverified Link"

Tags rules:
- 1 to 3 short context tags based on the input (e.g. ["Insurance", "Cold Call", "Spoofed Number"])
- Tags must NOT contain any PII (no phone numbers, emails, names, or addresses)
- Tags should describe the scam type, medium, or tactic — not the victim

Scoring guide:
- 0-20 = safe / low risk
- 21-50 = suspicious
- 51-75 = likely threat
- 76-100 = confirmed threat

Additional rules:
- VOIP line type + legitimacy claim in text = score ≥ 80
- Fraud score ≥ 75 from IPQS = score ≥ 70
- Disposable or honeypot email = score ≥ 65
- Phishing or malware flag from URL scan = score ≥ 85
- Be concise and objective`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`Claude error [${res.status}]`);
  const data = await res.json();
  const text = data?.content?.map(c => c.text || '').join('').trim();

  // Parse JSON — strip any accidental markdown fences
  const jsonStr = text.replace(/^```json?\s*/i, '').replace(/```$/i, '').trim();
  try {
    const parsed = JSON.parse(jsonStr);
    // Ensure tags is always an array
    if (!Array.isArray(parsed.tags)) parsed.tags = [];
    return parsed;
  } catch {
    return { score: 50, category: 'Suspicious Activity', tags: [], summary: 'Could not parse AI response.' };
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
  } else {
    console.log('quick_scans insert ok, input_type:', record.input_type, 'score:', record.ai_score);
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { input } = req.body || {};
  if (!input || typeof input !== 'string' || !input.trim()) {
    return res.status(400).json({ error: 'input is required' });
  }

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

  // AI scoring
  let aiResult;
  try {
    aiResult = await scoreWithClaude(rawInput, inputType, ipqsData);
  } catch (err) {
    return res.status(500).json({ error: `AI scoring failed: ${err.message}` });
  }

  // Persist — visibility is hardcoded private, cannot be overridden
  await insertQuickScan({
    input_type: inputType,
    raw_input: rawInput,
    ipqs_data: ipqsData || null,
    ai_score: aiResult.score,
    ai_category: aiResult.category,
    ai_tags: aiResult.tags || [],
    visibility: 'private',
    created_at: new Date().toISOString(),
    radar_metadata: {
      shows_ai_patterns: aiResult.shows_ai_patterns ?? null,
      impersonated_brand: aiResult.impersonated_brand ?? null,
      extracted_iocs: Array.isArray(aiResult.extracted_iocs) ? aiResult.extracted_iocs : [],
      vector: aiResult.vector ?? 'other',
    },
  });

  return res.status(200).json({
    ok: true,
    input_type: inputType,
    score: aiResult.score,
    category: aiResult.category,
    summary: aiResult.summary,
    osint: ipqsData
      ? {
          type: ipqsData.type,
          fraud_score: ipqsData.data?.fraud_score ?? ipqsData.data?.risk_score ?? null,
          recent_abuse: ipqsData.data?.recent_abuse ?? null,
          // email
          disposable: ipqsData.data?.disposable ?? null,
          spam_trap: ipqsData.data?.spam_trap ?? null,
          // phone
          line_type: ipqsData.data?.line_type ?? null,
          carrier: ipqsData.data?.carrier ?? null,
          // url
          phishing: ipqsData.data?.phishing ?? null,
          malware: ipqsData.data?.malware ?? null,
          unsafe: ipqsData.data?.unsafe ?? null,
          risk_score: ipqsData.data?.risk_score ?? null,
        }
      : null,
  });
};
