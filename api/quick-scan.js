const { analyzeContactData } = require('../lib/ipqs');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
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

async function scoreWithClaude(input, inputType, ipqsData) {
  let osintBlock = '';
  if (ipqsData?.data) {
    const d = ipqsData.data;
    if (ipqsData.type === 'email') {
      osintBlock = `\nOSINT DATA (IPQS): fraud_score=${d.fraud_score}, disposable=${d.disposable}, recent_abuse=${d.recent_abuse}, spam_trap=${d.spam_trap}, honeypot=${d.honeypot}, leaked=${d.leaked}`;
    } else if (ipqsData.type === 'phone') {
      osintBlock = `\nOSINT DATA (IPQS): fraud_score=${d.fraud_score}, line_type=${d.line_type}, carrier=${d.carrier}, recent_abuse=${d.recent_abuse}, risky=${d.risky}, spammer=${d.spammer}, voip=${d.line_type === 'VOIP'}`;
    }
  }

  const prompt = `You are a cyber threat analyst. Analyze this input and return a JSON object only — no explanation, no markdown.

Input type: ${inputType}
Input: ${input}${osintBlock}

Return this exact JSON shape:
{"score": <0-100 integer>, "category": "<one of: phishing|scam|fraud|spam|suspicious|safe|unknown>", "summary": "<one sentence, max 120 chars>"}

Rules:
- score 0-20 = safe/low risk, 21-50 = suspicious, 51-75 = likely threat, 76-100 = confirmed threat
- If OSINT fraud_score is provided, weight it heavily in your score
- VOIP line type is a strong scam indicator
- Disposable or honeypot email = high score
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
      max_tokens: 150,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`Claude error [${res.status}]`);
  const data = await res.json();
  const text = data?.content?.map(c => c.text || '').join('').trim();

  // Parse JSON — strip any accidental markdown fences
  const jsonStr = text.replace(/^```json?\s*/i, '').replace(/```$/i, '').trim();
  try {
    return JSON.parse(jsonStr);
  } catch {
    // Fallback if parsing fails
    return { score: 50, category: 'unknown', summary: 'Could not parse AI response.' };
  }
}

// ── Supabase insert ───────────────────────────────────────────────────────────

async function insertQuickScan(record) {
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
    console.error('quick_scans insert failed:', err);
    // Non-fatal — don't crash the response if DB insert fails
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

  // OSINT check for email/phone — fail open
  let ipqsData = null;
  if (inputType === 'email' || inputType === 'phone') {
    try {
      ipqsData = await analyzeContactData(rawInput);
    } catch (err) {
      console.warn('IPQS quick-scan failed (non-fatal):', err.message);
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
  await insertQuickScan({
    input_type: inputType,
    raw_input: rawInput,
    ipqs_data: ipqsData || null,
    ai_score: aiResult.score,
    ai_category: aiResult.category,
    visibility: 'private',
    created_at: new Date().toISOString(),
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
          fraud_score: ipqsData.data?.fraud_score ?? null,
          recent_abuse: ipqsData.data?.recent_abuse ?? null,
          // email extras
          disposable: ipqsData.data?.disposable ?? null,
          spam_trap: ipqsData.data?.spam_trap ?? null,
          // phone extras
          line_type: ipqsData.data?.line_type ?? null,
          carrier: ipqsData.data?.carrier ?? null,
        }
      : null,
  });
};
