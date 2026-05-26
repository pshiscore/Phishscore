// POST /api/extract-email
// Phase A: Claude Haiku parses raw pasted email text → { sender, subject, body }
// Phase B: IPQS scores the extracted sender address
// Returns: { sender, subject, body, ipqs }

const { analyzeContactData } = require('../lib/ipqs');

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

const SYSTEM_PROMPT = `You are an email parser. Extract structured data from raw pasted email text (headers, body, or any mix).

Return ONLY a valid JSON object with exactly these keys:
{
  "sender": "<full sender email address, no angle brackets, empty string if not found>",
  "subject": "<subject line text, empty string if not found>",
  "body": "<the main body text of the email, trimmed, empty string if not found>"
}

Rules:
- For sender: extract the actual email address from lines like "From:", "From: Name <email>", or any email address that appears to be the sender. Strip angle brackets. If multiple candidates exist, prefer the one on the From: line.
- For subject: extract text after "Subject:" line. If none, empty string.
- For body: everything after the headers block (after the first blank line following headers), or the main prose content. Trim leading/trailing whitespace.
- Never include extra keys, commentary, or markdown. Only the JSON object.`;

async function callHaiku(rawText) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: rawText.slice(0, 8000) }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude Haiku error [${res.status}]: ${err}`);
  }

  const data = await res.json();
  const raw = data?.content?.[0]?.text || '';
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON in Haiku response: ' + raw.slice(0, 120));
  return JSON.parse(match[0]);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { rawText } = req.body || {};
  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    return res.status(400).json({ error: 'rawText is required' });
  }

  // Phase A — AI parsing
  let parsed;
  try {
    parsed = await callHaiku(rawText);
  } catch (err) {
    console.error('[extract-email] Haiku parse failed:', err.message);
    return res.status(502).json({ error: 'AI parsing failed', detail: err.message });
  }

  const { sender = '', subject = '', body = '' } = parsed;

  // Phase B — IPQS scoring on sender (best-effort, never blocks response)
  // analyzeContactData auto-detects email vs phone via lib/ipqs.js
  let ipqs = null;
  const isEmail = sender && sender.includes('@');
  const isPhone = !isEmail && sender && /[\d\s\-().+]{7,}/.test(sender) && sender.replace(/\D/g, '').length >= 7;
  if (isEmail || isPhone) {
    try {
      ipqs = await analyzeContactData(sender);
      if (ipqs?.type === 'unknown') ipqs = null;
    } catch (err) {
      console.warn('[extract-email] IPQS failed:', err.message);
    }
  }

  return res.status(200).json({ sender, subject, body, ipqs, ipqsType: ipqs?.type ?? null });
};

module.exports.config = { api: { bodyParser: { sizeLimit: '1mb' } } };
