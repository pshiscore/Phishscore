const PERPLEXITY_KEY = process.env.PERPLEXITY_API_KEY;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!PERPLEXITY_KEY) return res.status(500).json({ error: 'PERPLEXITY_API_KEY not configured' });

  const start = Date.now();
  try {
    const r = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PERPLEXITY_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          { role: 'system', content: 'You are a cyber intelligence researcher.' },
          { role: 'user', content: 'Respond with exactly one sentence confirming the Perplexity API is reachable and state the model name you are running.' },
        ],
      }),
    });

    if (!r.ok) {
      const err = await r.text();
      return res.status(r.status).json({ error: `Perplexity error [${r.status}]: ${err.slice(0, 200)}` });
    }

    const data = await r.json();
    const text = data?.choices?.[0]?.message?.content || '(no response)';
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    return res.status(200).json({ ok: true, response: text, elapsed });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
