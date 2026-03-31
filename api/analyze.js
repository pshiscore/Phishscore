// ── In-memory rate limiter ────────────────────────────────────────────────────
const ipWindows = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const MINUTE = 60 * 1000;
  const HOUR = 60 * MINUTE;
  if (!ipWindows.has(ip)) {
    ipWindows.set(ip, { minuteCount: 0, minuteStart: now, hourCount: 0, hourStart: now });
  }
  const w = ipWindows.get(ip);
  if (now - w.minuteStart > MINUTE) { w.minuteCount = 0; w.minuteStart = now; }
  if (now - w.hourStart > HOUR) { w.hourCount = 0; w.hourStart = now; }
  w.minuteCount++;
  w.hourCount++;
  if (w.minuteCount > 5 || w.hourCount > 20) return true;
  return false;
}

// ── Claude API call with model fallback ───────────────────────────────────────
async function callClaude(body, model) {
  // Strip fields that are not valid Claude API params
  const { trainAI, ...claudeBody } = body;
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({ ...claudeBody, model })
  });
  return response;
}

// ── Main handler ──────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = (req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown').split(',')[0].trim();

  if (isRateLimited(ip)) {
    return res.status(429).json({
      error: 'rate_limited',
      message: "Our guard dogs need a nap! You've sent too many scans. Please wait a moment before trying again."
    });
  }

  try {
    // ── Step 1: Try primary model (Sonnet) ──────────────────────────────────
    let response = await callClaude(req.body, 'claude-sonnet-4-6');

    // ── Step 2: Fallback to Haiku if Sonnet overloaded ──────────────────────
    if (response.status === 529 || response.status === 500 || response.status === 503) {
      console.warn(`Sonnet returned ${response.status}, falling back to Haiku`);
      response = await callClaude(req.body, 'claude-haiku-4-5-20251001');
    }

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      console.error('Both models failed:', response.status, errBody);
      return res.status(502).json({
        error: 'service_unavailable',
        message: 'The AI analysis service is temporarily unavailable. Please try again in a few minutes.'
      });
    }

    const data = await response.json();

    // ── Step 3: Extract URLs for threat checks ──────────────────────────────
    const content = JSON.stringify(req.body.messages || []);
    const urlMatches = content.match(/https?:\/\/[^\s"'\\]+/g) || [];
    const uniqueUrls = [...new Set(urlMatches)].slice(0, 5);

    let gsbFlagged = false;
    let radarFlagged = false;
    let urlhausFlagged = false;
    const flaggedSources = [];

    // ── Step 4: External threat checks in parallel ──────────────────────────
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
            if (!flaggedSources.includes("Google Safe Browsing")) flaggedSources.push("Google Safe Browsing");
          }
        } catch (e) { console.error('GSB error:', e); }
      })(),

      // Cloudflare Radar
      (async () => {
        const cfKey = process.env.CLOUDFLARE_RADAR_KEY;
        if (!cfKey || uniqueUrls.length === 0) return;
        try {
          for (const url of uniqueUrls.slice(0, 2)) {
            const r = await fetch('https://api.cloudflare.com/client/v4/radar/url_scanner/scans', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfKey}` },
              body: JSON.stringify({ url, visibility: 'Public' })
            });
            const d = await r.json();
            if (d.success && d.result?.scan?.verdicts?.malicious) {
              radarFlagged = true;
              if (!flaggedSources.includes("Cloudflare Radar")) flaggedSources.push("Cloudflare Radar");
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

    // ── Step 5: Inject threat results into response ─────────────────────────
    if ((gsbFlagged || radarFlagged || urlhausFlagged) && data.content) {
      try {
        const text = data.content.map(c => c.text || '').join('');
        const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());

        if (gsbFlagged) parsed.safeBrowsingFlagged = true;
        if (radarFlagged) parsed.radarFlagged = true;
        if (urlhausFlagged) parsed.urlhausFlagged = true;
        parsed.flaggedSources = flaggedSources;

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

    return res.status(200).json(data);

  } catch (err) {
    console.error('Analysis error:', err);
    return res.status(500).json({
      error: 'service_unavailable',
      message: 'The AI analysis service is temporarily unavailable. Please try again in a few minutes.'
    });
  }
};

module.exports.config = { api: { bodyParser: { sizeLimit: '10mb' } } };
