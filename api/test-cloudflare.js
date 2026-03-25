module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.CLOUDFLARE_RADAR_KEY) {
    return res.status(200).json({ skipped: true, message: 'CLOUDFLARE_RADAR_KEY not configured' });
  }

  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });

  try {
    // Submit scan
    const submit = await fetch('https://api.cloudflare.com/client/v4/radar/url_scanner/scans', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CLOUDFLARE_RADAR_KEY}`
      },
      body: JSON.stringify({ url, screenshotsResolutions: [], visibility: 'Public' })
    });

    const submitData = await submit.json();
    if (!submitData.success) {
      return res.status(200).json({ error: `Cloudflare error: ${JSON.stringify(submitData.errors)}` });
    }

    const uuid = submitData.result?.uuid;
    if (!uuid) return res.status(200).json({ error: 'No UUID returned from Cloudflare' });

    // Poll for result
    await new Promise(r => setTimeout(r, 4000));
    const result = await fetch(
      `https://api.cloudflare.com/client/v4/radar/url_scanner/scans/${uuid}`,
      { headers: { 'Authorization': `Bearer ${process.env.CLOUDFLARE_RADAR_KEY}` } }
    );
    const resultData = await result.json();
    const verdicts = resultData?.result?.scan?.verdicts;

    return res.status(200).json({
      uuid,
      malicious: verdicts?.malicious === true,
      phishing: verdicts?.phishing === true,
      status: resultData?.result?.scan?.task?.status || 'pending',
    });
  } catch (err) {
    return res.status(200).json({ error: err.message });
  }
};
