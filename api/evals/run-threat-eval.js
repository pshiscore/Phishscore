const { Eval } = require('braintrust');
const { Factuality } = require('autoevals');
const crypto = require('crypto');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const BRAINTRUST_API_KEY = process.env.BRAINTRUST_API_KEY;

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SESSION_TOKEN = crypto
  .createHmac('sha256', ADMIN_PASSWORD || 'fallback')
  .update(ADMIN_USERNAME || 'admin')
  .digest('hex');
const COOKIE_NAME = 'devs_session';

function parseCookies(cookieHeader) {
  return Object.fromEntries(
    (cookieHeader || '').split(';').map(c => {
      const [k, ...v] = c.trim().split('=');
      return [k, v.join('=')];
    }).filter(([k]) => k)
  );
}

function isAuthorized(req) {
  if (!ADMIN_PASSWORD) return false;
  const cookies = parseCookies(req.headers.cookie);
  return cookies[COOKIE_NAME] === SESSION_TOKEN;
}

const DATASET = [
  {
    input: 'URGENT: Your PayPal account has been locked. Click here to verify your identity: http://paypal-secure-verify.xyz/login',
    expected: 'finance',
  },
  {
    input: 'Stanford Medical breakthrough! This secret enzyme melts fat in 2 days. Doctors HATE this one weird trick. Order now before it\'s banned!',
    expected: 'health',
  },
];

const CATEGORY_LIST = 'publishing, delivery, retail, telecom, traffic, social, finance, government, prize, romance, job, tech, political, travel, legal, health, other';

const JSON_SCHEMA = `{"score":<0-100>,"tags":[<2-4 labels>],"summary":"<one sentence>","verdict":"<one sentence>","analysis":"<2-3 sentences>","redFlags":[<up to 5>],"whatToDo":"<one action sentence>","detectedSources":[],"detectedCategory":"<best category id from list or null>","categoryReclassified":false}`;

async function categorizeWithClaude(text) {
  const systemPrompt = `You are PhishScore.ai. Analyze this content for scam indicators.\nUser selected category: "other" (id: "other")\n\nIMPORTANT TASKS:\n1. Extract ONLY phone numbers (with country code if visible) and sender email addresses.\n2. Determine the best category from: ${CATEGORY_LIST}. Return it in detectedCategory if 70%+ confident, else null.\n\nRespond ONLY with valid JSON (no markdown):\n${JSON_SCHEMA}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      messages: [
        {
          role: 'user',
          content: `${systemPrompt}\n\nContent to analyze:\n${text}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error [${res.status}]: ${err}`);
  }

  const data = await res.json();
  const raw = data.content?.map(c => c.text || '').join('') || '';
  const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
  return parsed.detectedCategory || 'unknown';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!isAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!BRAINTRUST_API_KEY) return res.status(503).json({ error: 'BRAINTRUST_API_KEY not configured' });
  if (!ANTHROPIC_API_KEY) return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured' });

  try {
    await Eval('PhishScore Threat Categorization', {
      data: () => DATASET.map(({ input, expected }) => ({ input, expected })),

      task: async (input) => {
        return await categorizeWithClaude(input);
      },

      scores: [Factuality],
    });

    return res.status(200).json({
      success: true,
      message: 'Eval complete. Check Braintrust Dashboard.',
    });
  } catch (err) {
    console.error('Braintrust eval error:', err);
    return res.status(500).json({ error: 'Eval failed', detail: err.message });
  }
};

module.exports.config = { api: { bodyParser: false } };
