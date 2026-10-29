// Authoritative domain-age lookup.
//
// Order of preference:
//   1. RDAP — the registry's own structured record. We select the event whose
//      eventAction is exactly "registration". We never fall back to another
//      event: "last changed" and "last update of RDAP database" describe record
//      edits, not creation, and "expiration" is in the future. Reading any of
//      them as a creation date is how a 3-year-old domain gets called new.
//   2. The registrar RDAP server via the registry's rel="related" link, when the
//      registry record itself carries no registration event.
//   3. WhoisXML `createdDate` — only for TLDs with no RDAP service (.io and
//      friends are absent from the IANA bootstrap).
//   4. Unknown. An unknown age is reported as unknown. It is never "recent",
//      never zero days, and never contributes to a risk score.

const BOOTSTRAP_URL = 'https://data.iana.org/rdap/dns.json';
const RDAP_TIMEOUT_MS = 6000;
const BOOTSTRAP_TTL_MS = 24 * 60 * 60 * 1000;

let _bootstrap = null;
let _bootstrapAt = 0;

const unknown = (reason) => ({ status: 'unknown', days: null, iso: null, source: null, reason });

async function fetchJson(url, { timeout = RDAP_TIMEOUT_MS, headers = {} } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers, redirect: 'follow' });
    if (!res.ok) return { ok: false, status: res.status, data: null };
    return { ok: true, status: res.status, data: await res.json() };
  } catch (err) {
    return { ok: false, status: 0, data: null, error: err.message };
  } finally {
    clearTimeout(timer);
  }
}

// IANA bootstrap: maps a TLD to its RDAP base URL. Cached per warm lambda.
async function getRdapBase(tld) {
  const now = Date.now();
  if (!_bootstrap || now - _bootstrapAt > BOOTSTRAP_TTL_MS) {
    const res = await fetchJson(BOOTSTRAP_URL, { timeout: 8000 });
    if (!res.ok || !Array.isArray(res.data?.services)) return null;
    _bootstrap = res.data;
    _bootstrapAt = now;
  }
  for (const [tlds, urls] of _bootstrap.services) {
    if (tlds.includes(tld) && Array.isArray(urls) && urls.length) {
      return urls[0].endsWith('/') ? urls[0] : urls[0] + '/';
    }
  }
  return null;
}

// The whole point of this module: match eventAction === "registration", exactly.
function selectRegistrationEvent(events) {
  if (!Array.isArray(events)) return null;
  const ev = events.find(
    e => typeof e?.eventAction === 'string' && e.eventAction.toLowerCase() === 'registration'
  );
  return ev?.eventDate || null;
}

// Turn an ISO date into an age, rejecting anything that isn't a sane past date.
// Handles fractional seconds of any precision and the Z suffix via Date.parse.
function toAge(iso, source) {
  if (!iso || typeof iso !== 'string') return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  const days = Math.floor((Date.now() - ms) / 86400000);
  if (days < 0) return null; // a future creation date is bad data, not a new domain
  return { status: 'known', days, iso: new Date(ms).toISOString(), source, reason: null };
}

function registrableDomain(input) {
  let host = String(input || '').trim();
  if (!host) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(host)) {
    try { host = new URL(host).hostname; } catch { return null; }
  } else {
    host = host.split('/')[0];
  }
  host = host.replace(/^www\./i, '').replace(/\.$/, '').toLowerCase();
  return host.includes('.') ? host : null;
}

async function lookupRdap(domain) {
  const tld = domain.split('.').pop();
  const base = await getRdapBase(tld);
  if (!base) return { age: null, hadService: false };

  const res = await fetchJson(`${base}domain/${encodeURIComponent(domain)}`, {
    headers: { Accept: 'application/rdap+json' },
  });
  if (!res.ok) return { age: null, hadService: true };

  const direct = toAge(selectRegistrationEvent(res.data?.events), 'rdap');
  if (direct) return { age: direct, hadService: true };

  // Registry carried no registration event — try the registrar's own record.
  const related = (res.data?.links || []).find(l => l?.rel === 'related' && l?.href);
  if (related) {
    const sub = await fetchJson(related.href, { headers: { Accept: 'application/rdap+json' } });
    if (sub.ok) {
      const viaRegistrar = toAge(selectRegistrationEvent(sub.data?.events), 'rdap-registrar');
      if (viaRegistrar) return { age: viaRegistrar, hadService: true };
    }
  }
  return { age: null, hadService: true };
}

async function lookupWhoisXml(domain) {
  const key = process.env.WHOISXML_API_KEY;
  if (!key) return null;
  const res = await fetchJson(
    `https://www.whoisxmlapi.com/whoisserver/WhoisService?apiKey=${key}&domainName=${encodeURIComponent(domain)}&outputFormat=JSON`,
    { timeout: 8000 }
  );
  if (!res.ok) return null;
  // createdDate only. Never updatedDate (a record edit) or expiresDate (future).
  return toAge(res.data?.WhoisRecord?.createdDate, 'whoisxml');
}

async function getDomainAge(input) {
  const domain = registrableDomain(input);
  if (!domain) return unknown('unparseable-input');

  try {
    const { age, hadService } = await lookupRdap(domain);
    if (age) return age;
    // Only reach for WHOIS when RDAP had nothing to say about this TLD at all.
    if (!hadService) {
      const viaWhois = await lookupWhoisXml(domain);
      if (viaWhois) return viaWhois;
      return unknown('no-rdap-service-and-whois-unavailable');
    }
    return unknown('rdap-no-registration-event');
  } catch (err) {
    console.warn('[domain-age] lookup failed for', domain, '-', err.message);
    return unknown('lookup-error');
  }
}

module.exports = { getDomainAge, selectRegistrationEvent, toAge, registrableDomain };
