const { CohereClient } = require('cohere-ai');

const COHERE_KEY = process.env.COHERE_API_KEY;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!COHERE_KEY) return res.status(500).json({ error: 'COHERE_API_KEY not configured' });

  const start = Date.now();
  try {
    const cohere = new CohereClient({ token: COHERE_KEY });

    const response = await cohere.chat({
      model: 'command-r-08-2024',
      message: "Ping: Return the single word 'Pong' and nothing else.",
    });

    const text = response.text || '(no response)';
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    return res.status(200).json({ ok: true, response: text, elapsed });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
