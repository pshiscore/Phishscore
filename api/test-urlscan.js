const { authorizeSession } = require('./_utils/cronAuth');
module.exports = async function handler(req, res) {
  // Dev-dashboard diagnostic (/devs): admin session cookie required. Same-origin
  // only, so no CORS headers.
  if (!authorizeSession(req).ok) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });

  try {
    const submit = await fetch('https://urlscan.io/api/v1/scan/', {
      method: 'POST',
      headers: { 'API-Key': process.env.URLSCAN_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, visibility: 'private' })
    });
    const submitData = await submit.json();
    if (!submitData.uuid) return res.status(200).json({ error: submitData.message || 'Scan failed to submit', raw: submitData });

    const uuid = submitData.uuid;
    // Poll up to 30s
    for (let i = 0; i < 6; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const result = await fetch(`https://urlscan.io/api/v1/result/${uuid}/`);
      if (result.status === 200) {
        const data = await result.json();
        return res.status(200).json({
          uuid,
          verdict: data?.verdicts?.overall?.malicious ? 'malicious' : 'clean',
          score: data?.verdicts?.overall?.score || 0,
          country: data?.page?.country || null,
          ip: data?.page?.ip || null,
          screenshot: `https://urlscan.io/screenshots/${uuid}.png`,
          tags: data?.verdicts?.overall?.tags || [],
        });
      }
    }
    return res.status(200).json({ uuid, verdict: 'pending', screenshot: `https://urlscan.io/screenshots/${uuid}.png` });
  } catch (err) {
    return res.status(200).json({ error: err.message });
  }
};
