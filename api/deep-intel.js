// PhishScore Deep Intel — Forensic Orchestrator
// Triggered after payment confirmed via webhook
// Uses Claude Opus for maximum analysis depth

const { rejectIfParked } = require('./_utils/deepIntelGate');

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const { analyzeForDeepIntel } = require('../lib/cnl-analyzer');
const { analyzeContactData } = require('../lib/ipqs');

// ── Google Vision OCR & Logo Detection ───────────────────────────────────────

async function analyzeImagesWithVision(imageUrls, telemetryLog) {
  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey || !Array.isArray(imageUrls) || imageUrls.length === 0) return null;

  const urls = imageUrls.slice(0, 3);
  const requests = urls.map(url => ({
    image: { source: { imageUri: url } },
    features: [
      { type: 'TEXT_DETECTION' },
      { type: 'LOGO_DETECTION' },
    ],
  }));

  const result = await fetchWithTelemetry(
    'Google_Vision',
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests }),
    },
    telemetryLog
  );

  if (!result.ok || !result.data?.responses) return null;

  const lines = result.data.responses.map((annotation, i) => {
    const extractedText = (
      annotation?.fullTextAnnotation?.text ||
      annotation?.textAnnotations?.[0]?.description ||
      ''
    ).slice(0, 2000);
    const logos = (annotation?.logoAnnotations || [])
      .map(l => l.description)
      .filter(Boolean);

    const logoLine = logos.length > 0
      ? `  Detected logos/brands: ${logos.join(', ')}`
      : '  No logos detected.';
    const textLine = extractedText.trim()
      ? `  Extracted text:\n${extractedText.trim().replace(/^/gm, '    ')}`
      : '  No text detected.';

    return `Image ${i + 1}:\n${logoLine}\n${textLine}`;
  });

  return lines.join('\n\n') || null;
}

// ── Telemetry wrapper ─────────────────────────────────────────────────────────

async function fetchWithTelemetry(serviceName, url, options = {}, telemetryLog) {
  const started_at = new Date().toISOString();
  const startMs = Date.now();
  const entry = {
    service: serviceName,
    started_at,
    finished_at: null,
    latency_ms: null,
    status: null,
    success: false,
    error: null,
    raw_response: null,
  };
  try {
    const res = await fetch(url, options);
    entry.finished_at = new Date().toISOString();
    entry.latency_ms = Date.now() - startMs;
    entry.status = res.status;

    // Read body once to avoid stream double-consumption
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }

    // Trim VirusTotal bulk attribute to prevent memory bloat
    if (serviceName === 'VirusTotal' && res.ok && data?.data?.attributes?.last_analysis_results) {
      delete data.data.attributes.last_analysis_results;
    }

    entry.raw_response = data;
    entry.success = res.ok;
    telemetryLog.push(entry);
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    entry.finished_at = new Date().toISOString();
    entry.latency_ms = Date.now() - startMs;
    entry.success = false;
    entry.error = err.message;
    telemetryLog.push(entry);
    return { ok: false, status: null, data: null };
  }
}

// ── External API helpers ──────────────────────────────────────────────────────

async function runURLScan(url, telemetryLog) {
  try {
    const submitResult = await fetchWithTelemetry('URLScan_Submit', 'https://urlscan.io/api/v1/scan/', {
      method: 'POST',
      headers: { 'API-Key': process.env.URLSCAN_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, visibility: 'private' }),
    }, telemetryLog);

    const uuid = submitResult.data?.uuid;
    if (!uuid) return null;

    // Poll for result — track as a single telemetry entry spanning the full wait
    const pollStarted = new Date().toISOString();
    const pollStartMs = Date.now();
    let pollData = null;
    let pollSuccess = false;

    for (let i = 0; i < 6; i++) {
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i))); // 1s, 2s, 4s, 8s, 16s, 32s
      try {
        const r = await fetch(`https://urlscan.io/api/v1/result/${uuid}/`);
        if (r.status === 200) {
          pollData = await r.json();
          pollSuccess = true;
          break;
        }
      } catch (e) { /* continue polling */ }
    }

    telemetryLog.push({
      service: 'URLScan_Result',
      started_at: pollStarted,
      finished_at: new Date().toISOString(),
      latency_ms: Date.now() - pollStartMs,
      status: pollSuccess ? 200 : 404,
      success: pollSuccess,
      error: pollSuccess ? null : 'Scan timed out — result not ready after 30s',
      raw_response: pollData
        ? { verdict: pollData?.verdicts?.overall?.malicious ? 'malicious' : 'clean', score: pollData?.verdicts?.overall?.score }
        : null,
    });

    if (pollSuccess && pollData) {
      return {
        uuid,
        screenshot: `https://urlscan.io/screenshots/${uuid}.png`,
        verdict: pollData?.verdicts?.overall?.malicious ? 'malicious' : 'clean',
        score: pollData?.verdicts?.overall?.score || 0,
        tags: pollData?.verdicts?.overall?.tags || [],
        country: pollData?.page?.country || null,
        server: pollData?.page?.server || null,
        ip: pollData?.page?.ip || null,
        domain: pollData?.page?.domain || null,
      };
    }
    // Return partial if scan not ready
    return { uuid, screenshot: `https://urlscan.io/screenshots/${uuid}.png`, verdict: 'pending' };
  } catch (err) {
    console.error('URLScan error:', err);
    return null;
  }
}

async function checkAbuseIPDB(ip, telemetryLog) {
  if (!ip) return null;
  try {
    const result = await fetchWithTelemetry(
      'AbuseIPDB',
      `https://api.abuseipdb.com/api/v2/check?ipAddress=${ip}&maxAgeInDays=90&verbose`,
      { headers: { Key: process.env.ABUSEIPDB_API_KEY, Accept: 'application/json' } },
      telemetryLog
    );
    if (!result.ok || !result.data) return null;
    const data = result.data;
    return {
      abuseScore: data?.data?.abuseConfidenceScore || 0,
      totalReports: data?.data?.totalReports || 0,
      lastReported: data?.data?.lastReportedAt || null,
      isp: data?.data?.isp || null,
      usageType: data?.data?.usageType || null,
      countryCode: data?.data?.countryCode || null,
    };
  } catch (err) {
    console.error('AbuseIPDB error:', err);
    return null;
  }
}

async function checkWhois(domain, telemetryLog) {
  if (!domain) return null;
  try {
    const result = await fetchWithTelemetry(
      'WhoisXML',
      `https://www.whoisxmlapi.com/whoisserver/WhoisService?apiKey=${process.env.WHOISXML_API_KEY}&domainName=${domain}&outputFormat=JSON`,
      {},
      telemetryLog
    );
    if (!result.data) return null;
    const record = result.data?.WhoisRecord;
    return {
      createdDate: record?.createdDate || null,
      expiresDate: record?.expiresDate || null,
      registrar: record?.registrarName || null,
      registrant: record?.registrant?.organization || record?.registrant?.name || 'Hidden',
      domainAge: record?.estimatedDomainAge || null,
      country: record?.registrant?.country || null,
    };
  } catch (err) {
    console.error('WhoisXML error:', err);
    return null;
  }
}

async function checkVirusTotal(url, telemetryLog) {
  if (!process.env.VIRUSTOTAL_API_KEY) return null;
  try {
    const encoded = Buffer.from(url).toString('base64').replace(/=/g, '');
    const result = await fetchWithTelemetry(
      'VirusTotal',
      `https://www.virustotal.com/api/v3/urls/${encoded}`,
      { headers: { 'x-apikey': process.env.VIRUSTOTAL_API_KEY } },
      telemetryLog
    );
    if (!result.ok || !result.data) return null;
    const stats = result.data?.data?.attributes?.last_analysis_stats || {};
    return {
      malicious: stats.malicious || 0,
      suspicious: stats.suspicious || 0,
      clean: stats.harmless || 0,
      total: Object.values(stats).reduce((a, b) => a + b, 0),
    };
  } catch (err) {
    console.error('VirusTotal error:', err);
    return null;
  }
}

// Extract first email or phone from message text
function extractContact(text) {
  if (!text) return null;
  const emailMatch = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) return emailMatch[0];
  const phoneMatch = text.match(/(?:\+?[\d][\d\s\-().]{7,}[\d])/);
  if (phoneMatch) return phoneMatch[0].trim();
  return null;
}

// Extract first URL from message
function extractUrl(text) {
  if (!text) return null;
  const match = text.match(/https?:\/\/[^\s"'<>]+/);
  return match ? match[0] : null;
}

// Extract domain from URL
function extractDomain(url) {
  if (!url) return null;
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
}

// ── Claude Opus report generation ────────────────────────────────────────────

async function generateForensicReport(caseRecord, urlscanData, abuseData, whoisData, vtData, cnlData, ipqsData, visionData, telemetryLog) {
  const domainAge = whoisData?.domainAge;
  const ageWarning = domainAge && domainAge < 30
    ? `CRITICAL: Domain is only ${domainAge} days old — extremely common with scam infrastructure.`
    : domainAge
    ? `Domain age: ${domainAge} days.`
    : 'Domain age: Unknown.';

  const abuseWarning = abuseData?.abuseScore > 50
    ? `CRITICAL: IP has ${abuseData.abuseScore}% abuse confidence score with ${abuseData.totalReports} prior reports.`
    : abuseData
    ? `IP abuse score: ${abuseData?.abuseScore || 0}% (${abuseData?.totalReports || 0} reports).`
    : 'IP data: Not available.';

  const vtWarning = vtData?.malicious > 0
    ? `CRITICAL: VirusTotal flagged by ${vtData.malicious} engine(s) out of ${vtData.total || '?'} (${vtData.malicious} malicious).`
    : vtData
    ? `VirusTotal: ${vtData.malicious || 0} malicious detections out of ${vtData.total || '?'} engines.`
    : 'VirusTotal: Not scanned.';

  // Build IPQS forensic block if available
  let ipqsBlock = '';
  if (ipqsData?.data) {
    const d = ipqsData.data;
    if (ipqsData.type === 'email') {
      ipqsBlock = `
IPQS FORENSIC BACKGROUND CHECK — EMAIL (${ipqsData.input}):
Fraud Score: ${d.fraud_score ?? 'N/A'}/100
Recent Abuse Flag: ${d.recent_abuse ? 'YES — flagged for recent malicious activity' : 'No'}
Disposable Address: ${d.disposable ? 'YES — throwaway inbox' : 'No'}
Spam Trap: ${d.spam_trap ? 'YES' : 'No'}
Honeypot: ${d.honeypot ? 'YES' : 'No'}
Domain: ${d.domain || 'Unknown'}
MX Records Valid: ${d.mx_records ? 'Yes' : 'No'}
Leaked in Breach: ${d.leaked ? 'YES' : 'No'}
First Seen: ${d.first_seen || 'Unknown'}`;
    } else if (ipqsData.type === 'phone') {
      ipqsBlock = `
IPQS FORENSIC BACKGROUND CHECK — PHONE (${ipqsData.input}):
Fraud Score: ${d.fraud_score ?? 'N/A'}/100
Recent Abuse Flag: ${d.recent_abuse ? 'YES — flagged for recent malicious activity' : 'No'}
Line Type: ${d.line_type || 'Unknown'} ${d.line_type === 'VOIP' ? '— CRITICAL: VOIP numbers are heavily used by scammers' : ''}
Carrier: ${d.carrier || 'Unknown'}
Registered Name: ${d.name || 'Not available'}
Country: ${d.country || 'Unknown'}${d.region ? `, ${d.region}` : ''}${d.city ? ` (${d.city})` : ''}
Prepaid: ${d.prepaid ? 'YES' : 'No'}
Active Status: ${d.active_status || (d.active ? 'Active' : 'Unknown')}
Risky: ${d.risky ? 'YES' : 'No'}
Spammer Listed: ${d.spammer ? 'YES' : 'No'}
Do Not Call Registry: ${d.do_not_call ? 'YES' : 'No'}
Leaked in Breach: ${d.leaked ? 'YES' : 'No'}`;
    }
  }

  // Build Vision OCR block if available
  const visionBlock = visionData
    ? `\nVISUAL EVIDENCE (Google Vision OCR & Logo Detection):\n${visionData}`
    : '';

  // Build CNL context block if available
  let cnlBlock = '';
  if (cnlData) {
    const { entities, sentiment } = cnlData;
    const orgList = entities?.organizations?.map(o => o.name).join(', ') || 'None detected';
    const moneyList = entities?.money?.join(', ') || 'None detected';
    cnlBlock = `
LANGUAGE INTELLIGENCE (Google Cloud NL — verified ground truth):
Organizations mentioned: ${orgList}
Financial amounts referenced: ${moneyList}
Urgency level: ${sentiment?.urgencyLevel || 'UNKNOWN'} (sentiment score: ${sentiment?.score || 0}, magnitude: ${sentiment?.magnitude || 0})
Interpretation: ${sentiment?.interpretation || 'N/A'}
Note: Cross-reference the organizations listed above with the WHOIS and VirusTotal results below.`;
  }

  const prompt = `ANALYST INSTRUCTION: If IPQS Forensic Data is provided below, explicitly reference the fraud score, line type (e.g., VOIP), domain age, or abuse flags in your report to substantiate your analysis. Do not omit this data — it is verified ground truth. If VISUAL EVIDENCE is provided, reference specific text extracted from the screenshots and any detected logos/brands to identify impersonation tactics.

CASE DETAILS:
Original PhishScore: ${caseRecord.original_score || 'N/A'}/100
Category: ${caseRecord.original_category || 'Unknown'}
What the victim reported: ${caseRecord.story || 'No story provided'}
Original message: ${(caseRecord.original_message || '').slice(0, 1500)}
${ipqsBlock}
${cnlBlock}
${visionBlock}

FORENSIC FINDINGS:
${ageWarning}
${abuseWarning}
${vtWarning}
URLScan verdict: ${urlscanData?.verdict || 'Not scanned'}
Server location: ${urlscanData?.country || whoisData?.country || 'Unknown'}
Registrar: ${whoisData?.registrar || 'Unknown'}
Domain registered: ${whoisData?.createdDate || 'Unknown'}
Domain owner: ${whoisData?.registrant || 'Hidden/Anonymous'}

Write a forensic case file with these exact sections:

VERDICT
One sentence stating clearly whether this is a confirmed scam and how dangerous it is.

EVIDENCE SUMMARY
3-4 sentences describing what the forensic data reveals about this scam's infrastructure — domain age, hosting, abuse history, how it operates.

WHAT HAPPENED TO YOU
Based on the victim's story, explain specifically what data or access the scammer may now have. Be specific and honest. If they clicked a link, what risk does that create. If they entered credentials, what should they assume is compromised.

VISUAL EVIDENCE
${visionData ? 'Analyze the Google Vision OCR results above. Identify any scam scripts, fake brand logos, spoofed interface elements, or deceptive text extracted from the screenshots. Explain what each piece of visual evidence reveals about the attack methodology.' : 'No screenshots were submitted with this case.'}

CNL & PSYCHOLOGICAL TACTICS
Break down the specific Cognitive Neurological Linguistics and psychological manipulation techniques used in this attack. Identify and name each tactic explicitly — for example: urgency and artificial time pressure, authority impersonation, fear-based compliance, social proof exploitation, reciprocity traps, scarcity triggers, or identity anchoring. For each tactic, explain how it was deployed in this specific message and why it is effective at bypassing rational decision-making. This section helps the victim understand they were targeted by deliberate psychological engineering, not personal gullibility.

RECOVERY CHECKLIST
A numbered list of specific actions this person should take NOW, in order of priority. Be specific — name the type of account, the type of call, the specific action. Do not give generic advice. Tailor this entirely to what they told you happened.

WHAT THIS SCAM IS
One paragraph explaining what criminal operation this appears to be part of, how it targets victims, and what the scammers are ultimately trying to achieve.

Rules: No URLs in the report. Plain English. Be direct and specific. This person needs actionable help, not reassurance.`;

  const claudeStarted = new Date().toISOString();
  const claudeStartMs = Date.now();

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-6',
      max_tokens: 2000,
      system: [{ type: 'text', text: 'You are PhishScore Deep Intel\'s forensic analyst. Write professional, specific case file reports for scam victims. Structure every report with these exact sections: VERDICT, EVIDENCE SUMMARY, WHAT HAPPENED TO YOU, VISUAL EVIDENCE, CNL & PSYCHOLOGICAL TACTICS, RECOVERY CHECKLIST, WHAT THIS SCAM IS. Rules: No URLs in the report. Plain English. Be direct and specific. Tailor advice entirely to what the victim reported.', cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const data = await response.json();

  // Claude telemetry — track billing metadata and stop reason
  telemetryLog.push({
    service: 'Claude_Opus',
    started_at: claudeStarted,
    finished_at: new Date().toISOString(),
    latency_ms: Date.now() - claudeStartMs,
    status: response.status,
    success: response.ok,
    error: response.ok ? null : `HTTP ${response.status}`,
    raw_response: {
      input_tokens: data?.usage?.input_tokens ?? null,
      output_tokens: data?.usage?.output_tokens ?? null,
      stop_reason: data?.stop_reason ?? null,
    },
  });

  return data?.content?.map(c => c.text || '').join('') || 'Report generation failed.';
}

// ── Main handler ──────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  if (rejectIfParked(req, res)) return; // Deep Intel is parked — docs/DEEP_INTEL_PARKED.md
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { caseId } = req.body;
  if (!caseId) return res.status(400).json({ error: 'caseId required' });

  try {
    // Fetch case record
    const caseRes = await fetch(
      `${SUPABASE_URL}/rest/v1/deep_intel_cases?id=eq.${caseId}&select=*`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    const cases = await caseRes.json();
    const caseRecord = cases?.[0];

    if (!caseRecord) throw new Error('Case not found');
    if (caseRecord.payment_status !== 'paid') throw new Error('Case not paid');
    // Prevent duplicate report generation
    if (caseRecord.report_generated_at) {
      console.log(`Case ${caseId} already has a report, skipping`);
      return res.status(200).json({ success: true, already_complete: true });
    }

    // Extract URL from message for scanning
    const url = extractUrl(caseRecord.original_message);
    const domain = extractDomain(url);
    const messageText = caseRecord.original_message || caseRecord.story || '';

    console.log(`Deep Intel case ${caseId}: URL=${url}, domain=${domain}`);

    // Initialise telemetry log — tracks every external API call in execution order
    const telemetryLog = [];

    // Extract scammer contact (email or phone) from message/story for IPQS check
    const scammerContact = caseRecord.contact_info
      || extractContact(caseRecord.story || '')
      || extractContact(messageText);

    // Run all external checks in parallel — CNL, IPQS, and Vision run alongside URL checks
    const [urlscanData, whoisData, vtData, cnlData, ipqsData, visionData] = await Promise.all([
      url ? runURLScan(url, telemetryLog) : Promise.resolve(null),
      domain ? checkWhois(domain, telemetryLog) : Promise.resolve(null),
      url ? checkVirusTotal(url, telemetryLog) : Promise.resolve(null),
      messageText ? analyzeForDeepIntel(messageText) : Promise.resolve(null),
      scammerContact
        ? analyzeContactData(scammerContact).catch(err => {
            console.warn('IPQS check failed (non-fatal):', err.message);
            return null;
          })
        : Promise.resolve(null),
      caseRecord.evidence_urls
        ? analyzeImagesWithVision(caseRecord.evidence_urls, telemetryLog).catch(err => {
            console.warn('Vision analysis failed (non-fatal):', err.message);
            return null;
          })
        : Promise.resolve(null),
    ]);

    // Check IP from URLScan result
    const abuseData = urlscanData?.ip ? await checkAbuseIPDB(urlscanData.ip, telemetryLog) : null;

    // Generate forensic report with Opus — includes CNL, IPQS, Vision, and telemetry
    const forensicReport = await generateForensicReport(
      caseRecord, urlscanData, abuseData, whoisData, vtData, cnlData, ipqsData, visionData, telemetryLog
    );

    // Save all results to Supabase
    await fetch(`${SUPABASE_URL}/rest/v1/deep_intel_cases?id=eq.${caseId}`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({
        urlscan_uuid: urlscanData?.uuid || null,
        urlscan_screenshot: urlscanData?.screenshot || null,
        urlscan_verdict: urlscanData?.verdict || null,
        abuseipdb_data: abuseData || null,
        whois_data: whoisData || null,
        virustotal_data: vtData || null,
        ipqs_data: ipqsData || null,
        forensic_report: forensicReport,
        api_telemetry: telemetryLog,
        report_generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    });

    console.log(`Deep Intel case ${caseId} complete — report available at https://phishscore.ai/report?token=${caseRecord.report_token}`);
    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Deep Intel orchestration error:', err);
    return res.status(500).json({ error: 'Investigation failed', detail: err.message });
  }
};
