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

    // Extract URLs from message content
    const content = JSON.stringify(req.body.messages || []);
    const urlMatches = content.match(/https?:\/\/[^\s"'\\]+/g) || [];
    const uniqueUrls = [...new Set(urlMatches)].slice(0, 5);

    let gsbFlagged = false;
    let radarFlagged = false;
    let urlhausFlagged = false;
    const flaggedSources = [];

    // Run all external checks in parallel
    await Promise.all([

      // Google Safe Browsing
      (async () => {
        const gsbKey = process.env.GOOGLE_SAFE_BROWSING_KEY;
        if (!gsbKey || uniqueUrls.length === 0) return;
        try {
          const r = await fetch(
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
          const d = await r.json();
          if (d.matches && d.matches.length > 0) {
            gsbFlagged = true;
            flaggedSources.push("Google Safe Browsing");
          }
        } catch (e) { console.error('GSB error:', e); }
      })(),

      // Cloudflare Radar URL Scanner
      (async () => {
        const cfKey = process.env.CLOUDFLARE_RADAR_KEY;
        if (!cfKey || uniqueUrls.length === 0) return;
        try {
          for (const url of uniqueUrls.slice(0, 2)) {
            const r = await fetch(
              'https://api.cloudflare.com/client/v4/radar/url_scanner/scans',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${cfKey}`
                },
                body: JSON.stringify({ url, screenshotsResolutions: [], visibility: "Public" })
              }
            );
            const d = await r.json();
            if (d.success && d.result) {
              const uuid = d.result.uuid;
              // Poll for result
              await new Promise(resolve => setTimeout(resolve, 3000));
              const resultRes = await fetch(
                `https://api.cloudflare.com/client/v4/radar/url_scanner/scans/${uuid}`,
                { headers: { 'Authorization': `Bearer ${cfKey}` } }
              );
              const resultData = await resultRes.json();
              const verdicts = resultData?.result?.scan?.verdicts;
              if (verdicts && (verdicts.malicious === true || verdicts.phishing === true)) {
                radarFlagged = true;
                if (!flaggedSources.includes("Cloudflare Radar")) flaggedSources.push("Cloudflare Radar");
              }
            }
          }
        } catch (e) { console.error('Cloudflare Radar error:', e); }
      })(),

      // URLhaus
      (async () => {
        if (uniqueUrls.length === 0) return;
        try {
          for (const url of uniqueUrls.slice(0, 3)) {
            const r = await fetch('https://urlhaus-api.abuse.ch/v1/url/', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: `url=${encodeURIComponent(url)}`
            });
            const d = await r.json();
            if (d.query_status === "is_listed" && d.url_status === "online") {
              urlhausFlagged = true;
              if (!flaggedSources.includes("URLhaus")) flaggedSources.push("URLhaus");
            }
          }
        } catch (e) { console.error('URLhaus error:', e); }
      })()

    ]);

    // Inject external check results into Claude response
    if ((gsbFlagged || radarFlagged || urlhausFlagged) && data.content) {
      try {
        const text = data.content.map(c => c.text || '').join('');
        const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());

        if (gsbFlagged) parsed.safeBrowsingFlagged = true;
        if (radarFlagged) parsed.radarFlagged = true;
        if (urlhausFlagged) parsed.urlhausFlagged = true;
        parsed.flaggedSources = flaggedSources;

        // Boost score and add red flags for each source
        const boost = flaggedSources.length * 8;
        parsed.score = Math.min((parsed.score || 0) + boost, 99);
        parsed.redFlags = parsed.redFlags || [];
        flaggedSources.forEach(src => {
          const flag = `URL flagged by ${src}`;
          if (!parsed.redFlags.includes(flag)) parsed.redFlags.unshift(flag);
        });

        data.content = [{ type: 'text', text: JSON.stringify(parsed) }];
      } catch (e) { console.error('Response injection error:', e); }
    }

    res.status(200).json(data);
  } catch (err) {
    console.error('Analysis error:', err);
    res.status(500).json({ error: 'Analysis failed' });
  }
}
