const { authorizeSession } = require('./_utils/cronAuth');
module.exports = async function handler(req, res) {
  // Dev-dashboard diagnostic (/devs): admin session cookie required. Same-origin
  // only, so no CORS headers.
  if (!authorizeSession(req).ok) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 50,
        messages: [{ role: 'user', content: 'API test ping. Reply with: {"status":"ok"}' }]
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(200).json({ error: data?.error?.message || `HTTP ${response.status}` });

    return res.status(200).json({
      ok: true,
      content: data.content
    });
  } catch (err) {
    return res.status(200).json({ error: err.message });
  }
};
