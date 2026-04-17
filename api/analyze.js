const { checkRateLimit } = require('./_utils/rateLimit');

const RESEND_KEY = process.env.RESEND_API_KEY;
const ADMIN_EMAIL = 'vkrasikov@gmail.com';

async function sendAdminSubmissionAlert(urls, parsed, flaggedSources) {
  if (!RESEND_KEY) return;
  const url = urls[0] || 'No URL detected';
  const flags = flaggedSources.length > 0 ? flaggedSources.join(', ') : 'None';
  const score = parsed?.score ?? 'N/A';
  const category = parsed?.detectedCategory || 'Unknown';
  const redFlagCount = (parsed?.redFlags || []).length;
  const scoreColor = score >= 75 ? '#dc2626' : score >= 45 ? '#d97706' : '#059669';
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'PhishScore Alerts <reports@phishscore.ai>',
        to: ADMIN_EMAIL,
        subject: `[PhishScore] New Submission — Score ${score} · ${category}`,
        html: `
          <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;background:#fff;padding:32px;">
            <div style="margin-bottom:20px;">
              <span style="font-family:monospace;font-size:18px;font-weight:800;">PHISH</span><span style="font-family:monospace;font-size:18px;font-weight:800;color:#dc2626;">SCORE</span><span style="font-family:monospace;font-size:11px;color:#9ca3af;">.ai</span>
              <p style="font-family:monospace;font-size:10px;letter-spacing:3px;color:#6b7280;margin:4px 0 0;">NEW SUBMISSION ALERT</p>
            </div>
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:16px 20px;margin-bottom:16px;">
              <p style="font-family:monospace;font-size:10px;letter-spacing:2px;color:#6b7280;margin:0 0 6px;">SUBMITTED URL</p>
              <p style="font-family:monospace;font-size:13px;color:#111;margin:0;word-break:break-all;">${url}</p>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
              <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;border-top:3px solid ${scoreColor};">
                <p style="font-family:monospace;font-size:9px;letter-spacing:2px;color:#6b7280;margin:0 0 4px;">RISK SCORE</p>
                <p style="font-family:monospace;font-size:26px;font-weight:800;color:${scoreColor};margin:0;">${score}</p>
              </div>
              <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;">
                <p style="font-family:monospace;font-size:9px;letter-spacing:2px;color:#6b7280;margin:0 0 4px;">CATEGORY</p>
                <p style="font-family:monospace;font-size:13px;font-weight:700;color:#374151;margin:0;">${category}</p>
              </div>
            </div>
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px 20px;margin-bottom:16px;">
              <p style="font-family:monospace;font-size:9px;letter-spacing:2px;color:#6b7280;margin:0 0 8px;">THREAT FLAGS</p>
              <p style="font-family:monospace;font-size:12px;color:${flaggedSources.length > 0 ? '#dc2626' : '#059669'};margin:0;">${flags}</p>
              <p style="font-family:monospace;font-size:11px;color:#6b7280;margin:6px 0 0;">${redFlagCount} red flag(s) detected</p>
            </div>
            <p style="font-family:monospace;font-size:10px;color:#9ca3af;margin:0;">Timestamp: ${new Date().toISOString()}</p>
          </div>
        `,
      }),
    });
  } catch (e) {
    console.error('Admin submission alert error:', e);
  }
}

// ── Store anonymized training data ────────────────────────────────────────────
async function storeTrainingData(parsed, context = {}) {
  const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  try {
    const record = {
      score: parsed.score || 0,
      score_label: parsed.score >= 75 ? 'scam' : parsed.score >= 45 ? 'suspicious' : 'safe',
      category: parsed.detectedCategory || null,
      tags: parsed.tags || [],
      red_flag_count: (parsed.redFlags || []).length,
      red_flag_types: (parsed.redFlags || []).map(f => f.slice(0, 80)),
      gsb_flagged: parsed.safeBrowsingFlagged === true,
      radar_flagged: parsed.radarFlagged === true,
      urlhaus_flagged: parsed.urlhausFlagged === true,
      has_urls: (parsed.detectedSources || []).some(s => s.startsWith('http')),
      has_phone: (parsed.detectedSources || []).some(s => /^\+?[\d\s\-()]{7,}$/.test(s)),
      original_text: context.rawText || null,
      // Enriched training fields (only written when trainAI === true)
      training_analysis: parsed,
      training_modality: context.modality || 'text',
      // delivery_channel is a first-class submission field — not stored here
      training_gsb_state: context.gsbFlagged || false,
      training_radar_state: context.radarFlagged || false,
      training_urlhaus_state: context.urlhausFlagged || false,
      training_is_anonymous: context.isAnonymous || false,
      training_consent_version: 'v1',
    };
    const res = await fetch(`${SUPABASE_URL}/rest/v1/training_data`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify(record)
    });
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`Supabase Insert Failed [${res.status}]:`, errorText);
      throw new Error(`Database error: ${res.status}`);
    }
    const data = await res.json();
    return data[0]?.id || null;
  } catch (e) {
    console.error('Training data storage error:', e);
    return null;
  }
}


// ── reCAPTCHA v3 verification ─────────────────────────────────────────────────
async function verifyRecaptcha(token, minScore = 0.5) {
  if (!token || !process.env.RECAPTCHA_SECRET_KEY) return true; // skip if not configured
  try {
    const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${token}`
    });
    const data = await res.json();
    console.log('reCAPTCHA score:', data.score, 'action:', data.action);
    if (!data.success) return false;
    return data.score >= minScore;
  } catch (e) {
    console.error('reCAPTCHA verification error:', e);
    return true; // fail open — don't block if verification itself fails
  }
}

const PII_SCRUBBING_BLOCK = `

PUBLIC PRIVACY PROTOCOL — This summary will be displayed on a public community feed. You MUST redact ALL personally identifying information from the summary:
- Usernames (e.g., "vlad_k", "john82") → replace with "[User]"
- Real human names → replace with "[Recipient]" or "[Sender]" as appropriate
- Email addresses → replace with "[Email Redacted]"
- Phone numbers → replace with "[Phone Redacted]"
- Physical addresses → replace with "[Address Redacted]"
- Account numbers, order IDs, or tracking numbers → replace with "[ID Redacted]"
Never include any of this information in the summary, even if it appears in the original message. The scam pattern and tactics should be described, not the victim's identity.`;

// ── Inject PII scrubbing block into messages for public submissions ────────────
function injectPiiScrubbing(messages) {
  return messages.map(msg => {
    if (typeof msg.content === 'string') {
      return { ...msg, content: msg.content + PII_SCRUBBING_BLOCK };
    }
    if (Array.isArray(msg.content)) {
      const updated = msg.content.map(part => {
        if (part.type === 'text') {
          return { ...part, text: part.text + PII_SCRUBBING_BLOCK };
        }
        return part;
      });
      return { ...msg, content: updated };
    }
    return msg;
  });
}

// ── Claude API call with model fallback ───────────────────────────────────────
async function callClaude(body, model) {
  // Strip fields that are not valid Claude API params
  const { trainAI, recaptchaToken, deliveryChannel, isAnonymous, visibility, ...claudeBody } = body;

  if (visibility === 'public' && Array.isArray(claudeBody.messages)) {
    claudeBody.messages = injectPiiScrubbing(claudeBody.messages);
  }

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

  const { allowed } = await checkRateLimit(ip);
  if (!allowed) {
    return res.status(429).json({
      error: 'rate_limited',
      message: "Our guard dogs need a nap! You've sent too many scans. Please wait a moment before trying again."
    });
  }

  // reCAPTCHA v3 verification
  const recaptchaToken = req.body.recaptchaToken;
  const recaptchaPassed = await verifyRecaptcha(recaptchaToken, 0.5);
  if (!recaptchaPassed) {
    return res.status(429).json({
      error: 'bot_detected',
      message: "Submission could not be verified. Please try again."
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

      // Google Web Risk (replaces Safe Browsing — broader threat types, 100k free/month)
      (async () => {
        const wrKey = process.env.GOOGLE_WEB_RISK_KEY;
        if (!wrKey || uniqueUrls.length === 0) return;
        try {
          for (const url of uniqueUrls.slice(0, 3)) {
            const encoded = encodeURIComponent(url);
            const r = await fetch(
              `https://webrisk.googleapis.com/v1/uris:search?key=${wrKey}&threatTypes=MALWARE&threatTypes=SOCIAL_ENGINEERING&threatTypes=UNWANTED_SOFTWARE&uri=${encoded}`
            );
            const d = await r.json();
            if (d.threat) {
              gsbFlagged = true; // reuse existing flag for backwards compat
              if (!flaggedSources.includes("Google Web Risk")) flaggedSources.push("Google Web Risk");
            }
          }
        } catch (e) { console.error('Web Risk error:', e); }
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

    // ── Parse final response once for training + admin notification ────────────
    let parsedResult = null;
    try {
      const raw = data.content?.map(c => c.text || '').join('') || '';
      if (raw.trim()) parsedResult = JSON.parse(raw.replace(/```json|```/g, '').trim());
    } catch (e) { console.error('Response parse error:', e); }

    // ── Store training data if opted in ─────────────────────────────────────
    let trainingId = null;
    if (req.body.trainAI === true && parsedResult) {
      try {
        const modality = (req.body.messages || []).some(m =>
          Array.isArray(m.content) && m.content.some(c => c.type === 'image')
        ) ? 'image' : 'text';
        const rawText = (req.body.messages || [])
          .flatMap(m => Array.isArray(m.content)
            ? m.content.filter(c => c.type === 'text').map(c => c.text)
            : [typeof m.content === 'string' ? m.content : '']
          ).join('\n').slice(0, 4000);
        trainingId = await storeTrainingData(parsedResult, {
          modality,
          rawText,
          gsbFlagged,
          radarFlagged,
          urlhausFlagged,
          isAnonymous: req.body.isAnonymous === true,
        });
      } catch (e) { console.error('Training store error:', e); }
    }

    // ── Admin notification (fire and forget) ────────────────────────────────
    if (parsedResult) {
      sendAdminSubmissionAlert(uniqueUrls, parsedResult, flaggedSources).catch(e => console.error('Admin alert error:', e));
    }

    return res.status(200).json({ ...data, trainingId });

  } catch (err) {
    console.error('Analysis error:', err);
    return res.status(500).json({
      error: 'service_unavailable',
      message: 'The AI analysis service is temporarily unavailable. Please try again in a few minutes.'
    });
  }
};

module.exports.config = { api: { bodyParser: { sizeLimit: '10mb' } } };
