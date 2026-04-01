const { analyzeForDeepIntel } = require('./lib/cnl-analyzer');

const FALLBACK_TEXT = 'URGENT: Your Chase Bank account has been compromised and suspended. A suspicious transaction of $2,500 was detected from an unknown device. Please call our fraud department immediately at 1-800-555-0123 to verify your identity and restore access. Failure to respond within 24 hours will result in permanent account closure and legal action.';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Use provided text or fallback to scam test paragraph
  const testText = req.body?.text || FALLBACK_TEXT;

  const wordCount = testText.trim().split(/\s+/).length;
  if (wordCount < 20) {
    return res.status(200).json({ error: `Text too short (${wordCount} words) — CNL requires at least 20 words` });
  }

  try {
    const result = await analyzeForDeepIntel(testText);
    if (!result) return res.status(200).json({ error: 'CNL returned no results — check GOOGLE_SERVICE_ACCOUNT_JSON in Vercel environment variables' });

    return res.status(200).json({
      ok: true,
      wordCount,
      organizations: result.entities?.organizations?.map(o => o.name).join(', ') || 'None',
      money: result.entities?.money?.join(', ') || 'None',
      locations: result.entities?.locations?.join(', ') || 'None',
      phones: result.entities?.phones?.join(', ') || 'None',
      urgencyLevel: result.sentiment?.urgencyLevel,
      sentimentScore: result.sentiment?.score,
      sentimentMagnitude: result.sentiment?.magnitude,
      interpretation: result.sentiment?.interpretation,
    });
  } catch (err) {
    console.error('CNL test error:', err.message);
    return res.status(200).json({ error: err.message });
  }
};
