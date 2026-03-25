module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });

  try {
    const domain = new URL(url).hostname.replace(/^www\./, '');
    const result = await fetch(
      `https://www.whoisxmlapi.com/whoisserver/WhoisService?apiKey=${process.env.WHOISXML_API_KEY}&domainName=${domain}&outputFormat=JSON`
    );
    const data = await result.json();
    const record = data?.WhoisRecord;
    if (!record) return res.status(200).json({ error: 'No WHOIS record found', raw: data });

    return res.status(200).json({
      domain,
      createdDate: record?.createdDate || null,
      expiresDate: record?.expiresDate || null,
      registrar: record?.registrarName || null,
      registrant: record?.registrant?.organization || record?.registrant?.name || 'Hidden',
      domainAge: record?.estimatedDomainAge || null,
      country: record?.registrant?.country || null,
    });
  } catch (err) {
    return res.status(200).json({ error: err.message });
  }
};
