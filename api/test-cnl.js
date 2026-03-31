const { analyzeForDeepIntel } = require('./lib/cnl-analyzer');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const testText = `URGENT: Your Chase Bank account has been compromised. 
  A suspicious transaction of $2,500 was detected. Call 1-800-555-0123 immediately 
  to verify your identity and prevent permanent account suspension. 
  Failure to respond within 24 hours will result in account closure.`;

  try {
    const result = await analyzeForDeepIntel(testText);
    if (!result) return res.status(200).json({ error: 'CNL returned no results — check credentials' });

    return res.status(200).json({
      ok: true,
      entities: result.entities,
      sentiment: result.sentiment,
    });
  } catch (err) {
    return res.status(200).json({ error: err.message });
  }
};
