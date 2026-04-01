// ── Cloud Natural Language API Analyzer ──────────────────────────────────────

function getApiKey() {
  return process.env.GOOGLE_NL_API_KEY || process.env.GEMINI_API_KEY;
}

async function nlRequest(endpoint, body) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('No API key configured (GOOGLE_NL_API_KEY)');

  // Fixed URL: base includes /documents, endpoint is just the method
  const url = `https://language.googleapis.com/v1/documents${endpoint}?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`!!! GOOGLE NL REJECTED (${res.status}) on ${endpoint}:`, errText);
    throw new Error(`Status ${res.status}: ${errText}`);
  }

  return res.json();
}

// ── Entity Extraction ─────────────────────────────────────────────────────────
async function analyzeEntities(text) {
  if (!text || text.trim().length < 20) return null;
  try {
    const data = await nlRequest(':analyzeEntities', {
      document: { type: 'PLAIN_TEXT', content: text },
      encodingType: 'UTF8'
    });

    const entities = data.entities || [];
    const organizations = entities
      .filter(e => e.type === 'ORGANIZATION' && e.salience > 0.05)
      .map(e => ({ name: e.name, salience: Math.round(e.salience * 100) }))
      .slice(0, 5);
    const money = entities
      .filter(e => e.type === 'PRICE' || e.type === 'NUMBER')
      .filter(e => e.mentions?.some(m => m.text?.content?.match(/\$|£|€|USD|GBP|\d+,\d{3}/)))
      .map(e => e.name).slice(0, 3);
    const locations = entities
      .filter(e => e.type === 'LOCATION' && e.salience > 0.05)
      .map(e => e.name).slice(0, 3);
    const phones = entities
      .filter(e => e.type === 'PHONE_NUMBER')
      .map(e => e.name).slice(0, 3);

    return { organizations, money, locations, phones, totalEntities: entities.length };
  } catch (err) {
    console.error('CNL entity error:', err.message);
    return null;
  }
}

// ── Sentiment Analysis ────────────────────────────────────────────────────────
async function analyzeSentiment(text) {
  if (!text || text.trim().length < 20) return null;
  try {
    const data = await nlRequest(':analyzeSentiment', {
      document: { type: 'PLAIN_TEXT', content: text },
      encodingType: 'UTF8'
    });

    const score = data.documentSentiment?.score || 0;
    const magnitude = data.documentSentiment?.magnitude || 0;
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
// Requires minimum 20 words — returns null silently if too short
async function classifyText(text) {
  if (!text) return null;
  const wordCount = text.trim().split(/\s+/).length;
  if (wordCount < 20) {
    console.log(`CNL classifyText skipped — only ${wordCount} words (minimum 20)`);
    return null;
  }
  try {
    const data = await nlRequest(':classifyText', {
      document: { type: 'PLAIN_TEXT', content: text },
      encodingType: 'UTF8'
    });

    return (data.categories || [])
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3)
      .map(c => ({ name: c.name, confidence: Math.round(c.confidence * 100) }));
  } catch (err) {
    console.error('CNL classify error:', err.message);
    return null;
  }
}

// ── Full Deep Intel Pre-Analysis ──────────────────────────────────────────────
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
async function analyzeRadarBatch(summaries) {
  if (!summaries || summaries.length === 0) return null;
  const combined = summaries.slice(0, 50).join(' ').slice(0, 5000);
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
