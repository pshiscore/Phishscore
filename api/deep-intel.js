// PhishScore Deep Intel — Forensic Orchestrator
// Triggered after payment confirmed via webhook
// Uses Claude Opus for maximum analysis depth

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const RESEND_KEY = process.env.RESEND_API_KEY;
const { analyzeForDeepIntel } = require('../lib/cnl-analyzer');

// ── External API helpers ──────────────────────────────────────────────────────

async function runURLScan(url) {
  try {
    const submit = await fetch('https://urlscan.io/api/v1/scan/', {
      method: 'POST',
      headers: {
        'API-Key': process.env.URLSCAN_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url, visibility: 'private' })
    });
    const submitData = await submit.json();
    const uuid = submitData?.uuid;
    if (!uuid) return null;

    // Wait for scan to complete (up to 30s)
    for (let i = 0; i < 6; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const result = await fetch(`https://urlscan.io/api/v1/result/${uuid}/`);
      if (result.status === 200) {
        const data = await result.json();
        return {
          uuid,
          screenshot: `https://urlscan.io/screenshots/${uuid}.png`,
          verdict: data?.verdicts?.overall?.malicious ? 'malicious' : 'clean',
          score: data?.verdicts?.overall?.score || 0,
          tags: data?.verdicts?.overall?.tags || [],
          country: data?.page?.country || null,
          server: data?.page?.server || null,
          ip: data?.page?.ip || null,
          domain: data?.page?.domain || null,
        };
      }
    }
    // Return partial if scan not ready
    return { uuid, screenshot: `https://urlscan.io/screenshots/${uuid}.png`, verdict: 'pending' };
  } catch (err) {
    console.error('URLScan error:', err);
    return null;
  }
}

async function checkAbuseIPDB(ip) {
  if (!ip) return null;
  try {
    const res = await fetch(
      `https://api.abuseipdb.com/api/v2/check?ipAddress=${ip}&maxAgeInDays=90&verbose`,
      { headers: { Key: process.env.ABUSEIPDB_API_KEY, Accept: 'application/json' } }
    );
    const data = await res.json();
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

async function checkWhois(domain) {
  if (!domain) return null;
  try {
    const res = await fetch(
      `https://www.whoisxmlapi.com/whoisserver/WhoisService?apiKey=${process.env.WHOISXML_API_KEY}&domainName=${domain}&outputFormat=JSON`
    );
    const data = await res.json();
    const record = data?.WhoisRecord;
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

async function checkVirusTotal(url) {
  if (!process.env.VIRUSTOTAL_API_KEY) return null;
  try {
    const encoded = Buffer.from(url).toString('base64').replace(/=/g, '');
    const res = await fetch(`https://www.virustotal.com/api/v3/urls/${encoded}`, {
      headers: { 'x-apikey': process.env.VIRUSTOTAL_API_KEY }
    });
    if (!res.ok) return null;
    const data = await res.json();
    const stats = data?.data?.attributes?.last_analysis_stats || {};
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

async function generateForensicReport(caseRecord, urlscanData, abuseData, whoisData, vtData, cnlData) {
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

  const prompt = `You are PhishScore Deep Intel's forensic analyst. You have completed a full investigation of a suspected scam. Write a professional, specific case file report for the victim.

CASE DETAILS:
Original PhishScore: ${caseRecord.original_score || 'N/A'}/100
Category: ${caseRecord.original_category || 'Unknown'}
What the victim reported: ${caseRecord.story || 'No story provided'}
Original message: ${(caseRecord.original_message || '').slice(0, 1500)}
${cnlBlock}

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

RECOVERY CHECKLIST
A numbered list of specific actions this person should take NOW, in order of priority. Be specific — name the type of account, the type of call, the specific action. Do not give generic advice. Tailor this entirely to what they told you happened.

WHAT THIS SCAM IS
One paragraph explaining what criminal operation this appears to be part of, how it targets victims, and what the scammers are ultimately trying to achieve.

Rules: No URLs in the report. Plain English. Be direct and specific. This person needs actionable help, not reassurance.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-opus-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const data = await response.json();
  return data?.content?.map(c => c.text || '').join('') || 'Report generation failed.';
}

// ── Email delivery via Resend ─────────────────────────────────────────────────

async function sendReportEmail(email, caseId, reportToken, report, urlscanData, caseRecord) {
  const reportUrl = `https://phishscore.ai/report?token=${reportToken}`;
  const screenshotSection = urlscanData?.screenshot
    ? `<p><strong>Evidence Screenshot:</strong><br><img src="${urlscanData.screenshot}" style="max-width:100%;border-radius:8px;margin-top:8px;" alt="URLScan screenshot"/></p>`
    : '';

  // Format report as HTML
  const reportHtml = report
    .split('\n')
    .map(line => {
      if (line.match(/^[A-Z\s]{4,}$/) && line.trim().length > 3) {
        return `<h3 style="color:#dc2626;font-family:monospace;font-size:13px;letter-spacing:2px;margin:24px 0 8px;">${line}</h3>`;
      }
      if (line.match(/^\d+\./)) {
        return `<p style="margin:4px 0;padding-left:16px;">• ${line.replace(/^\d+\./, '').trim()}</p>`;
      }
      return line ? `<p style="margin:6px 0;">${line}</p>` : '<br>';
    })
    .join('');

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'PhishScore Deep Intel <reports@phishscore.ai>',
      to: email,
      cc: 'contact@phishscore.ai',
      subject: `Your PhishScore Deep Intel Case File — Case #${caseId.slice(0, 8).toUpperCase()}`,
      html: `
        <div style="font-family:Georgia,serif;max-width:640px;margin:0 auto;background:#fff;padding:32px;">
          <div style="margin-bottom:24px;">
            <span style="font-family:monospace;font-size:20px;font-weight:800;">PHISH</span><span style="font-family:monospace;font-size:20px;font-weight:800;color:#dc2626;">SCORE</span><span style="font-family:monospace;font-size:13px;color:#9ca3af;">.ai</span>
            <p style="font-family:monospace;font-size:10px;letter-spacing:3px;color:#6b7280;margin:4px 0 0;">DEEP INTEL — FORENSIC CASE FILE</p>
          </div>

          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:16px;margin-bottom:24px;">
            <p style="font-family:monospace;font-size:11px;letter-spacing:2px;color:#dc2626;margin:0 0 4px;">CASE ID</p>
            <p style="font-family:monospace;font-size:14px;font-weight:700;color:#111;margin:0;">#${caseId.slice(0, 8).toUpperCase()}</p>
          </div>

          ${screenshotSection}

          <div style="color:#374151;font-size:14px;line-height:1.8;">
            ${reportHtml}
          </div>

          <div style="margin-top:32px;padding-top:24px;border-top:1px solid #e5e7eb;">
            <p style="font-size:12px;color:#6b7280;font-family:monospace;">
              View your case file online: <a href="${reportUrl}" style="color:#dc2626;">${reportUrl}</a>
            </p>
            <div style="margin-top:16px;padding:14px 16px;background:#fefce8;border:1px solid #fde68a;border-radius:8px;">
              <p style="font-size:11px;font-weight:700;color:#92400e;font-family:monospace;letter-spacing:1px;margin:0 0 6px;">BETA NOTICE: AI-GENERATED REPORT</p>
              <p style="font-size:11px;color:#78350f;font-family:Georgia,serif;line-height:1.7;margin:0;">
                This forensic analysis was generated by the PhishScore Deep Intel AI engine. While highly accurate in identifying scam patterns, AI can occasionally misinterpret complex data. This report should be treated as a guided starting point for your recovery process. Please verify all entity names, bank details, and URLs independently or with a human investigator before taking legal action.
              </p>
            </div>
            <p style="font-size:11px;color:#9ca3af;font-family:monospace;margin-top:12px;">
              PhishScore Deep Intel — AI-powered forensic scam investigation<br>
              Questions? contact@phishscore.ai
            </p>
          </div>
        </div>
      `
    })
  });
}

// ── Main handler ──────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
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

    // Run all external checks in parallel — CNL runs alongside URL checks
    const [urlscanData, whoisData, vtData, cnlData] = await Promise.all([
      url ? runURLScan(url) : Promise.resolve(null),
      domain ? checkWhois(domain) : Promise.resolve(null),
      url ? checkVirusTotal(url) : Promise.resolve(null),
      messageText ? analyzeForDeepIntel(messageText) : Promise.resolve(null),
    ]);

    // Check IP from URLScan result
    const abuseData = urlscanData?.ip ? await checkAbuseIPDB(urlscanData.ip) : null;

    // Generate forensic report with Opus — now includes CNL ground truth
    const forensicReport = await generateForensicReport(
      caseRecord, urlscanData, abuseData, whoisData, vtData, cnlData
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
        forensic_report: forensicReport,
        report_generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    });

    // Send email
    await sendReportEmail(
      caseRecord.email,
      caseId,
      caseRecord.report_token,
      forensicReport,
      urlscanData,
      caseRecord
    );

    // Mark email sent
    await fetch(`${SUPABASE_URL}/rest/v1/deep_intel_cases?id=eq.${caseId}`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({
        email_sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    });

    console.log(`Deep Intel case ${caseId} complete — report emailed to ${caseRecord.email}`);
    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Deep Intel orchestration error:', err);
    return res.status(500).json({ error: 'Investigation failed', detail: err.message });
  }
};
