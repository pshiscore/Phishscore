export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Run Claude analysis
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();

    // Google Safe Browsing check if API key is configured
    let safeBrowsingFlagged = false;
    const gsbKey = process.env.GOOGLE_SAFE_BROWSING_KEY;
    if (gsbKey && req.body.messages) {
      try {
        // Extract URLs from the message content
        const content = JSON.stringify(req.body.messages);
        const urlMatches = content.match(/https?:\/\/[^\s"']+/g) || [];
        const uniqueUrls = [...new Set(urlMatches)].slice(0, 5);
        if (uniqueUrls.length > 0) {
          const gsbRes = await fetch(
            `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${gsbKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                client: { clientId: "phishscore", clientVersion: "1.0" },
                threatInfo: {
                  threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
                  platformTypes: ["ANY_PLATFORM"],
                  threatEntryTypes: ["URL"],
                  threatEntries: uniqueUrls.map(url => ({ url }))
                }
              })
            }
          );
          const gsbData = await gsbRes.json();
          if (gsbData.matches && gsbData.matches.length > 0) {
            safeBrowsingFlagged = true;
          }
        }
      } catch (gsbErr) {
        console.error('GSB check failed:', gsbErr);
      }
    }

    // Inject safeBrowsingFlagged into the response content if flagged
    if (safeBrowsingFlagged && data.content) {
      try {
        const text = data.content.map(c => c.text || '').join('');
        const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
        parsed.safeBrowsingFlagged = true;
        if (parsed.score < 90) parsed.score = Math.min(parsed.score + 10, 99);
        parsed.redFlags = parsed.redFlags || [];
        if (!parsed.redFlags.includes('URL flagged by Google Safe Browsing')) {
          parsed.redFlags.unshift('URL flagged by Google Safe Browsing');
        }
        data.content = [{ type: 'text', text: JSON.stringify(parsed) }];
      } catch {}
    }

    res.status(200).json(data);
  } catch (err) {
    console.error('Analysis error:', err);
    res.status(500).json({ error: 'Analysis failed' });
  }
}
