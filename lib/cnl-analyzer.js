// ── Cloud Natural Language API Analyzer ──────────────────────────────────────
// Extracts entities, sentiment, and content categories from text
// Used by Deep Intel (pre-processor) and Radar (batch analysis)

const { GoogleAuth } = require('google-auth-library');

const NL_BASE = 'https://language.googleapis.com/v1';
const NL_SCOPES = ['https://www.googleapis.com/auth/cloud-platform'];

let _auth = null;

function getAuth() {
  if (_auth) return _auth;

  // Prefer explicit raw JSON (Vercel env var: GOOGLE_SERVICE_ACCOUNT_JSON)
  const rawJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (rawJson) {
    try {
      const credentials = JSON.parse(rawJson);
      _auth = new GoogleAuth({ credentials, scopes: NL_SCOPES });
      return _auth;
    } catch (e) {
      console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON:', e.message);
    }
  }

  // Fall back to GOOGLE_APPLICATION_CREDENTIALS (path to JSON file or ADC)
  _auth = new GoogleAuth({ scopes: NL_SCOPES });
  return _auth;
}

async function nlRequest(endpoint, body) {
  const client = await getAuth().getClient();
  const tokenResponse = await client.getAccessToken();
  const token = tokenResponse.token;

  const res = await fetch(`${NL_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`NL API error ${res.status}: ${JSON.stringify(err)}`);
  }
  return res.json();
}

// ── Entity Extraction ─────────────────────────────────────────────────────────
// Returns organizations, money amounts, locations, phone numbers, URLs
async function analyzeEntities(text) {
  if (!text || text.trim().length < 20) return null;
  try {
    const data = await nlRequest('/documents:analyzeEntities', {
      document: { type: 'PLAIN_TEXT', content: text },
      encodingType: 'UTF8'
    });

    const entities = data.entities || [];

    // Group by type — focus on scam-relevant types
    const organizations = entities
      .filter(e => e.type === 'ORGANIZATION' && e.salience > 0.05)
      .map(e => ({ name: e.name, salience: Math.round(e.salience * 100) }))
      .slice(0, 5);

    const money = entities
      .filter(e => e.type === 'PRICE' || e.type === 'NUMBER')
      .filter(e => e.mentions?.some(m => m.text?.content?.match(/\$|£|€|USD|GBP|\d+,\d{3}/)))
      .map(e => e.name)
      .slice(0, 3);

    const locations = entities
      .filter(e => e.type === 'LOCATION' && e.salience > 0.05)
      .map(e => e.name)
      .slice(0, 3);

    const phones = entities
      .filter(e => e.type === 'PHONE_NUMBER')
      .map(e => e.name)
      .slice(0, 3);

    return { organizations, money, locations, phones, totalEntities: entities.length };
  } catch (err) {
    console.error('CNL entity error:', err.message);
    return null;
  }
}

// ── Sentiment Analysis ────────────────────────────────────────────────────────
// Returns score (-1 to +1) and magnitude (0 to infinity)
// High magnitude + negative score = high pressure/threatening language
async function analyzeSentiment(text) {
  if (!text || text.trim().length < 20) return null;
  try {
    const data = await nlRequest('/documents:analyzeSentiment', {
      document: { type: 'PLAIN_TEXT', content: text },
      encodingType: 'UTF8'
    });

    const score = data.documentSentiment?.score || 0;
    const magnitude = data.documentSentiment?.magnitude || 0;

    // Classify urgency level
    let urgencyLevel = 'LOW';
    if (magnitude > 3 && score < -0.2) urgencyLevel = 'HIGH';
    else if (magnitude > 1.5) urgencyLevel = 'MEDIUM';

    return {
      score: Math.round(score * 100) / 100,
      magnitude: Math.round(magnitude * 100) / 100,
      urgencyLevel,
      interpretation: urgencyLevel === 'HIGH'
        ? 'High-pressure or threatening language detected'
        : urgencyLevel === 'MEDIUM'
        ? 'Moderately urgent or emotional language'
        : 'Neutral language'
    };
  } catch (err) {
    console.error('CNL sentiment error:', err.message);
    return null;
  }
}

// ── Content Classification ────────────────────────────────────────────────────
// Returns top content categories (requires text > 20 words)
async function classifyText(text) {
  if (!text || text.trim().split(/\s+/).length < 20) return null;
  try {
    const data = await nlRequest('/documents:classifyText', {
      document: { type: 'PLAIN_TEXT', content: text }
    });

    const categories = (data.categories || [])
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3)
      .map(c => ({ name: c.name, confidence: Math.round(c.confidence * 100) }));

    return categories;
  } catch (err) {
    console.error('CNL classify error:', err.message);
    return null;
  }
}

// ── Full Deep Intel Pre-Analysis ──────────────────────────────────────────────
// Runs entities + sentiment in parallel, returns structured context for Opus
async function analyzeForDeepIntel(text) {
  if (!text || text.trim().length < 20) return null;
  try {
    const [entities, sentiment] = await Promise.all([
      analyzeEntities(text),
      analyzeSentiment(text),
    ]);

    return { entities, sentiment };
  } catch (err) {
    console.error('CNL deep intel error:', err.message);
    return null;
  }
}

// ── Batch Radar Analysis ──────────────────────────────────────────────────────
// Classifies concatenated summaries for Radar trend detection
async function analyzeRadarBatch(summaries) {
  if (!summaries || summaries.length === 0) return null;
  const combined = summaries.slice(0, 50).join(' ').slice(0, 5000); // Stay within limits
  try {
    const [categories, sentiment] = await Promise.all([
      classifyText(combined),
      analyzeSentiment(combined),
    ]);
    return { categories, sentiment };
  } catch (err) {
    console.error('CNL radar batch error:', err.message);
    return null;
  }
}

module.exports = { analyzeEntities, analyzeSentiment, classifyText, analyzeForDeepIntel, analyzeRadarBatch };
