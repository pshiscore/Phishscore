const IPQS_KEY = process.env.IPQS_API_KEY;

// ── Email Validation ──────────────────────────────────────────────────────────

async function verifyEmail(email) {
  if (!IPQS_KEY) throw new Error('IPQS_API_KEY not configured');

  const url = `https://www.ipqualityscore.com/api/json/email/${IPQS_KEY}/${encodeURIComponent(email)}?strictness=1&abuse_strictness=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`IPQS email API error [${res.status}]`);

  const data = await res.json();
  return {
    valid: data.valid,
    deliverable: data.deliverability === 'high',
    fraud_score: data.fraud_score,
    recent_abuse: data.recent_abuse,
    disposable: data.disposable,
    honeypot: data.honeypot,
    spam_trap: data.spam_trap_score > 0,
    domain: data.domain,
    mx_records: data.mx_records,
    leaked: data.leaked,
    first_seen: data.first_seen?.human || null,
    message: data.message || null,
  };
}

// ── Phone Validation ──────────────────────────────────────────────────────────

async function verifyPhone(phoneNumber) {
  if (!IPQS_KEY) throw new Error('IPQS_API_KEY not configured');

  // Sanitize: keep digits, leading +, and country codes
  const sanitized = phoneNumber.replace(/[\s\-().]/g, '');

  const url = `https://www.ipqualityscore.com/api/json/phone/${IPQS_KEY}/${encodeURIComponent(sanitized)}?strictness=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`IPQS phone API error [${res.status}]`);

  const data = await res.json();
  return {
    valid: data.valid,
    fraud_score: data.fraud_score,
    recent_abuse: data.recent_abuse,
    line_type: data.line_type,   // VOIP, Wireless, Landline, etc.
    carrier: data.carrier,
    name: data.name || null,     // reverse lookup name if available
    country: data.country,
    region: data.region || null,
    city: data.city || null,
    zip_code: data.zip_code || null,
    prepaid: data.prepaid || false,
    risky: data.risky || false,
    active: data.active,
    active_status: data.active_status || null,
    do_not_call: data.do_not_call || false,
    leaked: data.leaked || false,
    spammer: data.spammer || false,
    message: data.message || null,
  };
}

// ── Domain age normalization ──────────────────────────────────────────────────

// IPQS returns a populated shell like {human:"N/A",timestamp:null,iso:null} when it
// has no creation date. That object is truthy, so a plain `|| null` guard keeps it
// and downstream consumers read "N/A" as if it were data. Collapse it to an
// explicit three-state result instead: age is either known, or it is unknown.
// It must never be representable as "new" or "recent".
function normalizeDomainAge(raw) {
  const ts = raw && typeof raw === 'object' ? raw.timestamp : null;
  if (typeof ts !== 'number' || !Number.isFinite(ts) || ts <= 0) {
    return { status: 'unknown', days: null, iso: null, human: null };
  }
  const ms = ts * 1000; // IPQS timestamps are seconds, not milliseconds
  const days = Math.floor((Date.now() - ms) / 86400000);
  if (!Number.isFinite(days) || days < 0) {
    // A future creation date is bad data, not a brand-new domain.
    return { status: 'unknown', days: null, iso: null, human: null };
  }
  return {
    status: 'known',
    days,
    iso: raw.iso || new Date(ms).toISOString(),
    human: raw.human || null,
  };
}

// ── URL Scanning ──────────────────────────────────────────────────────────────

async function verifyURL(url) {
  if (!IPQS_KEY) throw new Error('IPQS_API_KEY not configured');

  const endpoint = `https://www.ipqualityscore.com/api/json/url/${IPQS_KEY}/${encodeURIComponent(url)}`;
  const res = await fetch(endpoint);
  if (!res.ok) throw new Error(`IPQS URL API error [${res.status}]`);

  const data = await res.json();
  return {
    unsafe: data.unsafe,
    phishing: data.phishing,
    malware: data.malware,
    suspicious: data.suspicious,
    risk_score: data.risk_score,
    domain_age: normalizeDomainAge(data.domain_age),
    category: data.category || null,
    domain: data.domain || null,
    ip_address: data.ip_address || null,
    country_code: data.country_code || null,
    message: data.message || null,
  };
}

// ── Smart Router ──────────────────────────────────────────────────────────────

async function analyzeContactData(input) {
  if (!input || typeof input !== 'string') {
    throw new Error('analyzeContactData: input must be a non-empty string');
  }

  const trimmed = input.trim();
  console.log('[IPQS] analyzeContactData input:', trimmed.slice(0, 120));

  // 1. URL: has http/https or www. prefix
  if (trimmed.includes('http') || trimmed.includes('www.')) {
    const urlMatch = trimmed.match(/(https?:\/\/[^\s]+|www\.[^\s]+)/i);
    const extracted = urlMatch ? urlMatch[0] : trimmed;
    console.log('[IPQS] Extracted Entity (url):', extracted);
    const data = await verifyURL(extracted);
    return { type: 'url', input: extracted, data };
  }

  // 2. Email: contains @
  if (trimmed.includes('@')) {
    const emailMatch = trimmed.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
    const extracted = emailMatch ? emailMatch[0] : trimmed;
    console.log('[IPQS] Extracted Entity (email):', extracted);
    const data = await verifyEmail(extracted);
    return { type: 'email', input: extracted, data };
  }

  // 3. Phone: count all digits — if 10-15 digits present, treat as phone
  const justDigits = trimmed.replace(/\D/g, '');
  if (justDigits.length >= 10 && justDigits.length <= 15) {
    console.log('[IPQS] Extracted Entity (phone):', justDigits);
    const data = await verifyPhone(justDigits);
    return { type: 'phone', input: justDigits, data };
  }

  console.log('[IPQS] No entity extracted, falling back to text-only analysis.');
  return { type: 'unknown', input: trimmed, data: null };
}

module.exports = { verifyEmail, verifyPhone, verifyURL, analyzeContactData, normalizeDomainAge };
