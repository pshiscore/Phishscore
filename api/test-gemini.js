const { authorizeSession } = require('./_utils/cronAuth');
module.exports = async function handler(req, res) {
  // Dev-dashboard diagnostic (/devs): admin session cookie required. Same-origin
  // only, so no CORS headers.
  if (!authorizeSession(req).ok) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.GEMINI_API_KEY) {
    return res.status(200).json({ error: 'GEMINI_API_KEY not configured' });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'API test ping from PhishScore. Reply with exactly: Gemini API is working correctly.' }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 50 }
        })
      }
    );

    const data = await response.json();

    if (!response.ok || data.error) {
      return res.status(200).json({ error: `Gemini error ${response.status}: ${JSON.stringify(data.error || data)}` });
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) return res.status(200).json({ error: 'No text in Gemini response', raw: data });

    return res.status(200).json({ response: text });
  } catch (err) {
    return res.status(200).json({ error: err.message });
  }
};
