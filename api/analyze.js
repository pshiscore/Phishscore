const RESEND_KEY = process.env.RESEND_API_KEY;
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const CATEGORY_NAMES = {
  publishing: 'Publishing & Literary', delivery: 'Package & Delivery', retail: 'Retail & Shopping',
  telecom: 'Phone & Telecom', traffic: 'Traffic & Tolls', social: 'Social Media',
  finance: 'Banking & Finance', government: 'Government & IRS', prize: 'Prize & Lottery',
  romance: 'Romance & Friendship', job: 'Job & Employment', tech: 'Tech Support',
  political: 'Political Campaign', travel: 'Travel & Vacation', legal: 'Legal & Compliance',
  other: 'Unknown / Other'
};

async function getStats() {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/submissions?select=score,category&order=created_at.desc&limit=1000`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    const rows = await res.json();
    if (!Array.isArray(rows)) return null;
    const total = rows.length;
    const scams = rows.filter(r => r.score >= 75).length;
    const suspicious = rows.filter(r => r.score >= 45 && r.score < 75).length;
    const safe = rows.filter(r => r.score < 45).length;
    // Top category
    const catMap = {};
    rows.forEach(r => { catMap[r.category] = (catMap[r.category] || 0) + 1; });
    const topCat = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0];
    return { total, scams, suspicious, safe, topCat: topCat ? { id: topCat[0], count: topCat[1] } : null };
  } catch { return null; }
}

async function sendSubmissionNotification(parsed, body) {
  if (!RESEND_KEY) return;

  // Run stats fetch in parallel with email build — don't block
  const statsPromise = getStats();

  const score = parsed.score || 0;
  const scoreLabel = score >= 75 ? 'SCAM' : score >= 45 ? 'SUSPICIOUS' : 'LIKELY SAFE';
  const scoreColor = score >= 75 ? '#dc2626' : score >= 45 ? '#d97706' : '#16a34a';
  const category = CATEGORY_NAMES[parsed.detectedCategory || parsed.finalCategory] || 'Unknown';
  const tags = (parsed.tags || []).join(', ') || 'None';
  const redFlagCount = (parsed.redFlags || []).length;
  const summary = parsed.summary || parsed.verdict || 'No summary available';
  const flaggedBy = (parsed.flaggedSources || []).length > 0
    ? `<div style="margin-top:8px;padding:6px 10px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;font-size:11px;color:#dc2626;font-family:monospace;">⚠ FLAGGED BY: ${parsed.flaggedSources.join(', ')}</div>` : '';

  const msgContent = JSON.stringify(body.messages || '');
  const isImage = msgContent.includes('"type":"image"');
  const now = new Date();
  const timeStr = now.toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' });

  // Wait for stats now that we need them for the email
  const stats = await statsPromise;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'PhishScore.ai <reports@phishscore.ai>',
      to: 'vkrasikov@gmail.com',
      subject: `[${scoreLabel}] Score: ${score}/100 — ${category} — PhishScore Submission`,
      html: `
        <div style="font-family:Georgia,serif;max-width:640px;margin:0 auto;background:#f8f6f2;padding:0;">

          <!-- Header -->
          <div style="background:#ffffff;border-bottom:3px solid #f43f5e;padding:20px 28px;">
            <div style="font-family:monospace;font-size:22px;font-weight:800;color:#111827;">
              <span style="color:#dc2626;">PHISH</span>SCORE<span style="font-size:13px;color:#9ca3af;">.ai</span>
            </div>
            <div style="font-family:monospace;font-size:9px;letter-spacing:3px;color:#6b7280;margin-top:2px;">NEW SUBMISSION ALERT</div>
          </div>

          <!-- Score banner -->
          <div style="background:${scoreColor};padding:16px 28px;display:flex;align-items:center;">
            <div style="font-family:monospace;font-size:36px;font-weight:800;color:#ffffff;margin-right:16px;">${score}</div>
            <div>
              <div style="font-family:monospace;font-size:14px;font-weight:700;color:#ffffff;letter-spacing:2px;">${scoreLabel}</div>
              <div style="font-family:monospace;font-size:10px;color:rgba(255,255,255,0.8);margin-top:2px;">${timeStr} ET &nbsp;|&nbsp; ${isImage ? 'Screenshot submission' : 'Text submission'}</div>
            </div>
          </div>

          <!-- Main content -->
          <div style="background:#ffffff;padding:24px 28px;">

            <!-- Key details -->
            <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #f3f0eb;font-family:monospace;font-size:10px;letter-spacing:1px;color:#9ca3af;width:140px;">SCAM TYPE</td>
                <td style="padding:8px 0;border-bottom:1px solid #f3f0eb;font-family:monospace;font-size:12px;font-weight:700;color:#111827;">${category}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #f3f0eb;font-family:monospace;font-size:10px;letter-spacing:1px;color:#9ca3af;">TAGS</td>
                <td style="padding:8px 0;border-bottom:1px solid #f3f0eb;font-family:monospace;font-size:11px;color:#374151;">${tags}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #f3f0eb;font-family:monospace;font-size:10px;letter-spacing:1px;color:#9ca3af;">RED FLAGS</td>
                <td style="padding:8px 0;border-bottom:1px solid #f3f0eb;font-family:monospace;font-size:11px;color:${redFlagCount > 0 ? '#dc2626' : '#374151'};">${redFlagCount} detected</td>
              </tr>
              <tr>
                <td style="padding:8px 0;font-family:monospace;font-size:10px;letter-spacing:1px;color:#9ca3af;">SUBMISSION TYPE</td>
                <td style="padding:8px 0;font-family:monospace;font-size:11px;color:#374151;">${isImage ? 'Screenshot' : 'Text paste'}</td>
              </tr>
            </table>

            <!-- AI Summary -->
            <div style="background:#f8f6f2;border-left:3px solid #f43f5e;padding:14px 16px;border-radius:0 8px 8px 0;margin-bottom:20px;">
              <div style="font-family:monospace;font-size:9px;letter-spacing:2px;color:#9ca3af;margin-bottom:6px;">AI SUMMARY</div>
              <p style="font-size:14px;color:#374151;line-height:1.7;margin:0;">${summary}</p>
            </div>

            ${flaggedBy}

            <!-- Red flags list -->
            ${redFlagCount > 0 ? `
            <div style="margin-top:16px;">
              <div style="font-family:monospace;font-size:9px;letter-spacing:2px;color:#9ca3af;margin-bottom:8px;">RED FLAGS DETECTED</div>
              ${(parsed.redFlags || []).map(f => `<div style="display:flex;gap:8px;margin-bottom:6px;font-size:12px;color:#374151;line-height:1.5;"><span style="color:#dc2626;flex-shrink:0;">!</span><span>${f}</span></div>`).join('')}
            </div>` : ''}

            <!-- What to do -->
            ${parsed.whatToDo ? `
            <div style="margin-top:16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 16px;">
              <div style="font-family:monospace;font-size:9px;letter-spacing:2px;color:#16a34a;margin-bottom:6px;">WHAT TO DO</div>
              <p style="font-size:13px;color:#15803d;line-height:1.6;margin:0;">${parsed.whatToDo}</p>
            </div>` : ''}
          </div>

          <!-- Stats bar -->
          ${stats ? `
          <div style="background:#111827;padding:20px 28px;">
            <div style="font-family:monospace;font-size:9px;letter-spacing:3px;color:#6b7280;margin-bottom:14px;">PLATFORM STATS — LAST ${stats.total} REPORTS</div>
            <table style="width:100%;">
              <tr>
                <td style="text-align:center;padding:0 8px;">
                  <div style="font-family:monospace;font-size:28px;font-weight:800;color:#5b6cf8;">${stats.total}</div>
                  <div style="font-family:monospace;font-size:9px;letter-spacing:2px;color:#6b7280;margin-top:2px;">TOTAL</div>
                </td>
                <td style="text-align:center;padding:0 8px;">
                  <div style="font-family:monospace;font-size:28px;font-weight:800;color:#dc2626;">${stats.scams}</div>
                  <div style="font-family:monospace;font-size:9px;letter-spacing:2px;color:#6b7280;margin-top:2px;">SCAMS</div>
                </td>
                <td style="text-align:center;padding:0 8px;">
                  <div style="font-family:monospace;font-size:28px;font-weight:800;color:#d97706;">${stats.suspicious}</div>
                  <div style="font-family:monospace;font-size:9px;letter-spacing:2px;color:#6b7280;margin-top:2px;">SUSPICIOUS</div>
                </td>
                <td style="text-align:center;padding:0 8px;">
                  <div style="font-family:monospace;font-size:28px;font-weight:800;color:#16a34a;">${stats.safe}</div>
                  <div style="font-family:monospace;font-size:9px;letter-spacing:2px;color:#6b7280;margin-top:2px;">LIKELY SAFE</div>
                </td>
                <td style="text-align:center;padding:0 8px;">
                  <div style="font-family:monospace;font-size:14px;font-weight:700;color:#f43f5e;">${Math.round(stats.scams / Math.max(stats.total, 1) * 100)}%</div>
                  <div style="font-family:monospace;font-size:9px;letter-spacing:2px;color:#6b7280;margin-top:2px;">SCAM RATE</div>
                </td>
              </tr>
            </table>
            ${stats.topCat ? `<div style="margin-top:14px;font-family:monospace;font-size:10px;color:#6b7280;">TOP CATEGORY: <span style="color:#f43f5e;">${CATEGORY_NAMES[stats.topCat.id] || stats.topCat.id}</span> with ${stats.topCat.count} reports</div>` : ''}
          </div>` : ''}

          <!-- Footer -->
          <div style="background:#f8f6f2;padding:16px 28px;border-top:1px solid #e8e4de;">
            <div style="font-family:monospace;font-size:10px;color:#9ca3af;">
              PhishScore.ai — Community Scam Intelligence &nbsp;|&nbsp;
              <a href="https://www.phishscore.ai" style="color:#f43f5e;text-decoration:none;">phishscore.ai</a>
            </div>
          </div>

        </div>
      `
    })
  });
}

async function storeTrainingData(parsed) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  const record = {
    score: parsed.score || 0,
    category: parsed.detectedCategory || null,
    tags: parsed.tags || [],
    red_flag_count: (parsed.redFlags || []).length,
    red_flag_types: (parsed.redFlags || []).map(f => f.slice(0, 80)),
    gsb_flagged: parsed.safeBrowsingFlagged === true,
    radar_flagged: parsed.radarFlagged === true,
    urlhaus_flagged: parsed.urlhausFlagged === true,
    has_urls: (parsed.detectedSources || []).some(s => s.startsWith('http')),
    has_phone: (parsed.detectedSources || []).some(s => /^\+?[\d\s\-()]{7,}$/.test(s)),
    score_label: parsed.score >= 75 ? 'scam' : parsed.score >= 45 ? 'suspicious' : 'safe',
  };
  await fetch(`${SUPABASE_URL}/rest/v1/training_data`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify(record)
  });
}

// ── In-memory rate limiter ────────────────────────────────────────────────────
// Tracks request counts per IP. Resets automatically as windows expire.
// For a multi-region Vercel deployment, swap this for Upstash Redis later.
const ipWindows = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const MINUTE = 60 * 1000;
  const HOUR = 60 * MINUTE;

  if (!ipWindows.has(ip)) {
    ipWindows.set(ip, { minuteCount: 0, minuteStart: now, hourCount: 0, hourStart: now });
  }

  const w = ipWindows.get(ip);

  // Reset minute window if expired
  if (now - w.minuteStart > MINUTE) {
    w.minuteCount = 0;
    w.minuteStart = now;
  }
  // Reset hour window if expired
  if (now - w.hourStart > HOUR) {
    w.hourCount = 0;
    w.hourStart = now;
  }

  w.minuteCount++;
  w.hourCount++;

  // 5 per minute, 20 per hour — generous enough for testing from Cape Coral
  if (w.minuteCount > 5 || w.hourCount > 20) return true;
  return false;
}

// ── Claude API call with model fallback ───────────────────────────────────────
async function callClaude(body, model) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({ ...body, model })
  });
  return response;
}

// ── Main handler ──────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Get real IP from Vercel's forwarded header
  const ip = (req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown').split(',')[0].trim();

  // Rate limit check
  if (isRateLimited(ip)) {
    return res.status(429).json({
      error: 'rate_limited',
      message: "Our guard dogs need a nap! You've sent too many scans. Please wait a moment before trying again."
    });
  }

  try {
    // ── Step 1: Try primary model (Sonnet) ──────────────────────────────────
    let response = await callClaude(req.body, 'claude-sonnet-4-6');

    // ── Step 2: If Sonnet is overloaded or erroring, fall back to Haiku ────
    if (response.status === 529 || response.status === 500 || response.status === 503) {
      console.warn(`Sonnet returned ${response.status}, falling back to Haiku`);
      response = await callClaude(req.body, 'claude-haiku-4-5-20251001');
    }

    // If Haiku also failed, surface the error cleanly
    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      console.error('Both models failed:', response.status, errBody);
      return res.status(502).json({
        error: 'service_unavailable',
        message: 'The AI analysis service is temporarily unavailable. Please try again in a few minutes.'
      });
    }

    const data = await response.json();

    // ── Step 3: Extract URLs for external threat checks ─────────────────────
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
            flaggedSources.push("Google Safe Browsing");
          }
        } catch (e) { console.error('GSB error:', e); }
      })(),

      // Cloudflare Radar
      (async () => {
        const cfKey = process.env.CLOUDFLARE_RADAR_KEY;
        if (!cfKey || uniqueUrls.length === 0) return;
        try {
          for (const url of uniqueUrls.slice(0, 2)) {
            const r = await fetch(
              'https://api.cloudflare.com/client/v4/radar/url_scanner/scans',
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfKey}` },
                body: JSON.stringify({ url, screenshotsResolutions: [], visibility: "Public" })
              }
            );
            const d = await r.json();
            if (d.success && d.result) {
              const uuid = d.result.uuid;
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

    // ── Step 5: Inject threat check results into Claude's response ──────────
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

    res.status(200).json(data);

    // ── Step 6: Notification email — disabled until Resend domain verified ──
    // TODO: re-enable once reports@phishscore.ai is verified in Resend

  } catch (err) {
    console.error('Analysis error:', err);
    res.status(500).json({
      error: 'service_unavailable',
      message: 'The AI analysis service is temporarily unavailable. Please try again in a few minutes.'
    });
  }
};

module.exports.config = { api: { bodyParser: { sizeLimit: '10mb' } } };
