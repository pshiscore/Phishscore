const rateLimit = require('./_utils/rateLimit');
const LIMITS = require('./_utils/limits').analyze;
// Called as recaptcha.verifyRecaptcha so unit tests can mock the verifier.
const recaptcha = require('./_utils/recaptcha');
const { logUsage } = require('./_utils/logUsage');
const { buildSubmissionRow } = require('../src/submissionRow');
const { isValidCategoryId } = require('../lib/categories');
const { buildScoringRequest } = require('../lib/analyze-prompt');
const { validateAnalyzeInput } = require('./_utils/analyzeInput');

// ── Per-URL threat check (no cache) ──────────────────────────────────────────
async function checkUrlThreat(url, wrKey, cfKey) {
  const [gsb, radar, urlhaus] = await Promise.all([
    (async () => {
      if (!wrKey) return false;
      try {
        const r = await fetch(
          `https://webrisk.googleapis.com/v1/uris:search?key=${wrKey}&threatTypes=MALWARE&threatTypes=SOCIAL_ENGINEERING&threatTypes=UNWANTED_SOFTWARE&uri=${encodeURIComponent(url)}`
        );
        const d = await r.json();
        return !!d.threat;
      } catch { return false; }
    })(),
    (async () => {
      if (!cfKey) return false;
      try {
        const r = await fetch('https://api.cloudflare.com/client/v4/radar/url_scanner/scans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfKey}` },
          body: JSON.stringify({ url, visibility: 'Public' }),
        });
        const d = await r.json();
        return !!(d.success && d.result?.scan?.verdicts?.malicious);
      } catch { return false; }
    })(),
    (async () => {
      try {
        const r = await fetch('https://urlhaus-api.abuse.ch/v1/url/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `url=${encodeURIComponent(url)}`,
        });
        const d = await r.json();
        return d.query_status === 'is_listed' && d.url_status === 'online';
      } catch { return false; }
    })(),
  ]);

  return { gsb, radar, urlhaus };
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


// ── Save the community-feed row (service key) ─────────────────────────────────
// Replaces the browser's anon-key insert so anon INSERT/SELECT on submissions
// can be revoked. The score, tags and flags come from THIS request's verdict,
// so a client can no longer store a score the model never gave. Returns the
// stored row, or null — a failed save never fails the analysis.
async function storeSubmission(parsed, input) {
  const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  const row = buildSubmissionRow({ parsed, input });
  if (!row) { console.error('storeSubmission: verdict has no usable score, not saved'); return null; }
  if (!isValidCategoryId(row.category)) row.category = 'other';
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/submissions`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(row),
    });
    if (!res.ok) {
      console.error(`storeSubmission failed [${res.status}]:`, await res.text());
      return null;
    }
    const rows = await res.json();
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  } catch (e) {
    console.error('storeSubmission error:', e.message);
    return null;
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

// ── Build IPQS context block for Claude injection ─────────────────────────────
function buildIpqsContext(ipqs) {
  if (!ipqs?.data || ipqs.type === 'unknown') return null;
  const d = ipqs.data;
  const score = d.fraud_score ?? d.risk_score ?? null;
  if (score == null) return null;

  const type = ipqs.type; // 'email' | 'phone' | 'url'
  const flags = [];
  if (d.recent_abuse)  flags.push('recent abuse');
  if (d.disposable)    flags.push('disposable address');
  if (d.spam_trap)     flags.push('spam trap');
  if (d.honeypot)      flags.push('honeypot');
  if (d.leaked)        flags.push('leaked credentials');
  if (d.spammer)       flags.push('known spammer');
  if (d.risky)         flags.push('risky');
  if (d.phishing)      flags.push('phishing');
  if (d.malware)       flags.push('malware');

  let line = `[IPQS PRE-SCORE] The sender's ${type} was evaluated by IPQualityScore and returned a fraud risk score of ${score}/100.`;
  if (flags.length) line += ` Flags: ${flags.join(', ')}.`;
  if (type === 'phone' && d.line_type) line += ` Line type: ${d.line_type}.`;
  if (type === 'phone' && d.carrier)   line += ` Carrier: ${d.carrier}.`;
  line += ' Factor this into your analysis.';
  return line;
}

// ── Claude API call with model fallback ───────────────────────────────────────
// `request` is built by lib/analyze-prompt.js from validated input. Nothing the
// caller sent is spread into the Anthropic body: model, max_tokens, system and
// messages are all decided here.
function finalMessages(request, { ipqs, visibility }) {
  let messages = request.messages;

  // Inject IPQS context as an additional block on the last user message
  const context = ipqs ? buildIpqsContext(ipqs) : null;
  if (context) {
    messages = messages.map((msg, i) => i === messages.length - 1
      ? { ...msg, content: [...msg.content, { type: 'text', text: context }] }
      : msg);
  }

  if (visibility === 'public') messages = injectPiiScrubbing(messages);
  return messages;
}

async function callClaude(request, model, context) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31',
    },
    body: JSON.stringify({
      model,
      max_tokens: request.max_tokens,
      system: request.system,
      messages: finalMessages(request, context),
    }),
  });
  return response;
}

// ── Main handler ──────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Shared limiter (Postgres); fails closed — a paid endpoint never runs unmetered.
  if (await rateLimit.enforceRateLimit(req, res, {
    route: 'analyze', max: LIMITS.perMinute, windowSeconds: 60,
    message: "Our guard dogs need a nap! You've sent too many scans. Please wait a moment before trying again.",
  })) return;
  if (await rateLimit.enforceRateLimit(req, res, {
    route: 'analyze:day', max: LIMITS.perIpDay, windowSeconds: 86400,
    message: "You've reached today's analysis limit. Please try again tomorrow.",
  })) return;

  // Only the user's content is accepted; see api/_utils/analyzeInput.js.
  const validation = validateAnalyzeInput(req.body);
  if (!validation.ok) return res.status(400).json({ error: 'invalid_request', message: validation.error });
  const input = validation.value;

  // reCAPTCHA v3 — fails closed. 503 when our side cannot verify, 403 otherwise.
  const human = await recaptcha.verifyRecaptcha(input.recaptchaToken, {
    action: 'submit', minScore: 0.5, remoteIp: rateLimit.clientIp(req),
  });
  if (!human.ok) {
    if (recaptcha.isServerSideFailure(human.reason)) {
      return res.status(503).json({
        error: 'service_unavailable',
        message: 'The AI analysis service is temporarily unavailable. Please try again in a few minutes.',
      });
    }
    return res.status(403).json({
      error: 'verification_failed',
      message: "We couldn't verify this submission came from a person. Please refresh the page and try again.",
    });
  }

  // Global daily ceiling across all callers — counted only for verified requests.
  if (await rateLimit.enforceRateLimit(req, res, {
    route: 'analyze:global-day', max: LIMITS.globalDay, windowSeconds: 86400, scope: 'global',
    message: "PhishScore has reached today's limit for this feature. Please try again tomorrow.",
  })) return;

  try {
    // ── Step 1: Try primary model (Sonnet) ──────────────────────────────────
    const request = buildScoringRequest(input);
    const context = { ipqs: input.ipqs, visibility: input.visibility };
    let response = await callClaude(request, 'claude-sonnet-4-6', context);

    // ── Step 2: Fallback to Haiku if Sonnet overloaded ──────────────────────
    if (response.status === 529 || response.status === 500 || response.status === 503) {
      console.warn(`Sonnet returned ${response.status}, falling back to Haiku`);
      response = await callClaude(request, 'claude-haiku-4-5-20251001', context);
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

    // ── Log token usage (fire-and-forget) ───────────────────────────────────
    logUsage({
      endpoint: 'analyze',
      model: data.model || 'claude-sonnet-4-6',
      input_tokens: data.usage?.input_tokens,
      output_tokens: data.usage?.output_tokens,
    }).catch(() => {});

    // ── Step 3: Extract URLs for threat checks ──────────────────────────────
    const urlMatches = input.text.match(/https?:\/\/[^\s"'\\]+/g) || [];
    const uniqueUrls = [...new Set(urlMatches)].slice(0, 5);

    let gsbFlagged = false;
    let radarFlagged = false;
    let urlhausFlagged = false;
    const flaggedSources = [];

    // ── Step 4: Parallel threat checks per URL (cached in Redis for 6h) ──────
    if (uniqueUrls.length > 0) {
      const wrKey = process.env.GOOGLE_WEB_RISK_KEY;
      const cfKey = process.env.CLOUDFLARE_RADAR_KEY;
      const threatResults = await Promise.all(
        uniqueUrls.slice(0, 3).map(url => checkUrlThreat(url, wrKey, cfKey).catch(() => ({ gsb: false, radar: false, urlhaus: false })))
      );
      for (const r of threatResults) {
        if (r.gsb) { gsbFlagged = true; if (!flaggedSources.includes('Google Web Risk')) flaggedSources.push('Google Web Risk'); }
        if (r.radar) { radarFlagged = true; if (!flaggedSources.includes('Cloudflare Radar')) flaggedSources.push('Cloudflare Radar'); }
        if (r.urlhaus) { urlhausFlagged = true; if (!flaggedSources.includes('URLhaus')) flaggedSources.push('URLhaus'); }
      }
    }

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

    // ── Extract raw text once for training + admin alert ────────────────────
    const rawText = input.text.slice(0, 4000);

    // ── Store training data if opted in ─────────────────────────────────────
    let trainingId = null;
    if (input.trainAI && !input.dryRun && parsedResult) {
      try {
        const modality = input.image ? 'image' : 'text';
        trainingId = await storeTrainingData(parsedResult, {
          modality,
          rawText,
          gsbFlagged,
          radarFlagged,
          urlhausFlagged,
          isAnonymous: input.isAnonymous,
        });
      } catch (e) { console.error('Training store error:', e); }
    }

    // ── Save the feed row — every real submission; dryRun (dev dashboard) never ──
    let submission = null;
    if (!input.dryRun && parsedResult) {
      submission = await storeSubmission(parsedResult, {
        category: input.category,
        text: input.text,
        hasImage: !!input.image,
        source: input.source,
        visibility: input.visibility,
        deliveryChannel: input.deliveryChannel,
        ipqs: input.ipqs,
      });
    }

    return res.status(200).json({ ...data, trainingId, submission });

  } catch (err) {
    console.error('Analysis error:', err);
    return res.status(500).json({
      error: 'service_unavailable',
      message: 'The AI analysis service is temporarily unavailable. Please try again in a few minutes.'
    });
  }
};

// A ≤3 MB image is ~4 MB as base64; Vercel caps request bodies at 4.5 MB anyway.
module.exports.config = { api: { bodyParser: { sizeLimit: '4.5mb' } } };
