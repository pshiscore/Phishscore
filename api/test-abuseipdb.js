const { authorizeSession } = require('./_utils/cronAuth');
const dns = require('dns').promises;

module.exports = async function handler(req, res) {
  // Dev-dashboard diagnostic (/devs): admin session cookie required. Same-origin
  // only, so no CORS headers.
  if (!authorizeSession(req).ok) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });

  try {
    // Extract domain and resolve IP
    const domain = new URL(url).hostname.replace(/^www\./, '');
    let ip;
    try {
      const addresses = await dns.resolve4(domain);
      ip = addresses[0];
    } catch {
      return res.status(200).json({ error: `Could not resolve IP for domain: ${domain}` });
    }

    const result = await fetch(
      `https://api.abuseipdb.com/api/v2/check?ipAddress=${ip}&maxAgeInDays=90&verbose`,
      { headers: { Key: process.env.ABUSEIPDB_API_KEY, Accept: 'application/json' } }
    );
    const data = await result.json();
    if (data.errors) return res.status(200).json({ error: data.errors[0]?.detail || 'AbuseIPDB error' });

    return res.status(200).json({
      ip,
      domain,
      abuseScore: data?.data?.abuseConfidenceScore ?? 0,
      totalReports: data?.data?.totalReports ?? 0,
      lastReported: data?.data?.lastReportedAt || null,
      isp: data?.data?.isp || null,
      usageType: data?.data?.usageType || null,
      countryCode: data?.data?.countryCode || null,
    });
  } catch (err) {
    return res.status(200).json({ error: err.message });
  }
};
