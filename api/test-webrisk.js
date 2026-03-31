module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.GOOGLE_WEB_RISK_KEY) return res.status(200).json({ skipped: true, message: 'GOOGLE_WEB_RISK_KEY not configured' });

  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });

  try {
    const encoded = encodeURIComponent(url);
    const r = await fetch(
      `https://webrisk.googleapis.com/v1/uris:search?key=${process.env.GOOGLE_WEB_RISK_KEY}&threatTypes=MALWARE&threatTypes=SOCIAL_ENGINEERING&threatTypes=UNWANTED_SOFTWARE&uri=${encoded}`
    );
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return res.status(200).json({ error: `Web Risk error ${r.status}: ${JSON.stringify(err)}` });
    }
    const data = await r.json();
    return res.status(200).json({
      flagged: !!data.threat,
      threatType: data.threat?.threatTypes?.[0] || null,
      expireTime: data.threat?.expireTime || null,
      clean: !data.threat,
    });
  } catch (err) {
    return res.status(200).json({ error: err.message });
  }
};
