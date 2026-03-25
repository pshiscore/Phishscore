module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.VIRUSTOTAL_API_KEY) {
    return res.status(200).json({ skipped: true, message: 'VIRUSTOTAL_API_KEY not configured' });
  }

  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });

  try {
    const encoded = Buffer.from(url).toString('base64').replace(/=/g, '');
    const result = await fetch(`https://www.virustotal.com/api/v3/urls/${encoded}`, {
      headers: { 'x-apikey': process.env.VIRUSTOTAL_API_KEY }
    });
    if (!result.ok) {
      const err = await result.json().catch(() => ({}));
      return res.status(200).json({ error: `VirusTotal error: ${result.status} — ${err?.error?.message || 'unknown'}` });
    }
    const data = await result.json();
    const stats = data?.data?.attributes?.last_analysis_stats || {};
    return res.status(200).json({
      malicious: stats.malicious || 0,
      suspicious: stats.suspicious || 0,
      clean: stats.harmless || 0,
      undetected: stats.undetected || 0,
      total: Object.values(stats).reduce((a, b) => a + b, 0),
    });
  } catch (err) {
    return res.status(200).json({ error: err.message });
  }
};
