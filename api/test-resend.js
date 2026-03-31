module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.RESEND_API_KEY) return res.status(200).json({ skipped: true, message: 'RESEND_API_KEY not configured' });

  try {
    // Just verify the API key works by hitting the domains endpoint
    const r = await fetch('https://api.resend.com/domains', {
      headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}` }
    });
    const data = await r.json();
    if (!r.ok) return res.status(200).json({ error: `Resend error ${r.status}: ${data.message || JSON.stringify(data)}` });

    const domains = data.data || [];
    const verified = domains.filter(d => d.status === 'verified').map(d => d.name);
    const unverified = domains.filter(d => d.status !== 'verified').map(d => d.name);

    return res.status(200).json({
      ok: true,
      totalDomains: domains.length,
      verifiedDomains: verified,
      unverifiedDomains: unverified,
      ready: verified.length > 0,
    });
  } catch (err) {
    return res.status(200).json({ error: err.message });
  }
};
