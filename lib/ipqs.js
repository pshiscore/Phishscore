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
    domain_age: data.domain_age || null,
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

  // URL: starts with http/https or looks like a domain (e.g. example.com/path)
  if (/^https?:\/\//i.test(trimmed) || /^[\w\-]+\.[a-z]{2,}(\/|$)/i.test(trimmed)) {
    const data = await verifyURL(trimmed);
    return { type: 'url', input: trimmed, data };
  }

  // Email: contains @ symbol
  if (trimmed.includes('@')) {
    const data = await verifyEmail(trimmed);
    return { type: 'email', input: trimmed, data };
  }

  // Phone: strip non-digit chars (except leading +) and check if mostly numeric
  const stripped = trimmed.replace(/[\s\-().+]/g, '');
  if (/^\d{6,}$/.test(stripped)) {
    const data = await verifyPhone(trimmed);
    return { type: 'phone', input: trimmed, data };
  }

  return { type: 'unknown', input: trimmed, data: null };
}

module.exports = { verifyEmail, verifyPhone, verifyURL, analyzeContactData };
