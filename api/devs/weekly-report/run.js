// POST /api/devs/weekly-report/run
// The async 5-phase CTO report pipeline. Called by trigger.js in the background.
// Auth: x-cron-secret header only (never called directly from browser.

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL?.replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const PERPLEXITY_KEY = process.env.PERPLEXITY_API_KEY;
const SENTRY_TOKEN = process.env.SENTRY_AUTH_TOKEN;
const SENTRY_ORG = process.env.SENTRY_ORG_SLUG;
const SENTRY_PROJECT = process.env.SENTRY_PROJECT_SLUG;
const CRON_SECRET = process.env.INTERNAL_SECRET || 'phiscore-radara-2026';

// Cost cap: refuse to run if projected input tokens exceed this
const MAX_INPUT_TOKENS = 30_000;

// ── Supabase helpers ───────────────────────────────────────────────────────────

async function sbGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase GET failed [${res.status}]: ${path}`);
  return res.json();
}

async function sbPatch(id, body) {
  await fetch(`${SUPABASE_URL}/rest/v1/weekly_reports?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  });
}

async function setStatus(id, status, extra = {}) {
  await sbPatch(id, { status, ...extra });
}

async function setFailed(id, message) {
  await sbPatch(id, { status: 'failed', error_message: message, completed_at: new Date().toISOString() });
}

// ── PII scrubber ───────────────────────────────────────────────────────────────

function scrubPii(text) {
  if (!text) return text;
  let count = 0;
  const scrub = (t, re, tag) => t.replace(re, () => { count++; return tag; });
  let out = text;
  out = scrub(out, /(?<!\w)(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)/g, '[PHONE]');
  out = scrub(out, /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]');
  out = scrub(out, /\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]');
  out = scrub(out, /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD]');
  return { text: out, count };
}

// ── Phase 1: Business metrics ──────────────────────────────────────────────────

async function extractMetrics(weekStart, weekEnd) {
  const prevStart = new Date(weekStart);
  prevStart.setUTCDate(prevStart.getUTCDate() - 7);
  const prevStartStr = prevStart.toISOString().split('T')[0];

  const [curSubs, prevSubs, curScans, prevScans, categories, training] = await Promise.all([
    sbGet(`submissions?select=id,score,category&created_at=gte.${weekStart}&created_at=lte.${weekEnd}T23:59:59Z`),
    sbGet(`submissions?select=id&created_at=gte.${prevStartStr}&created_at=lt.${weekStart}`),
    sbGet(`quick_scans?select=id,ai_score,ai_category&created_at=gte.${weekStart}&created_at=lte.${weekEnd}T23:59:59Z`),
    sbGet(`quick_scans?select=id&created_at=gte.${prevStartStr}&created_at=lt.${weekStart}`),
    sbGet(`submissions?select=category&created_at=gte.${weekStart}&created_at=lte.${weekEnd}T23:59:59Z`),
    sbGet(`training_data?select=id&created_at=gte.${weekStart}&created_at=lte.${weekEnd}T23:59:59Z`),
  ]);

  const pctChange = (cur, prev) => prev === 0 ? null : Math.round(((cur - prev) / prev) * 100);

  const catCounts = {};
  categories.forEach(r => { catCounts[r.category] = (catCounts[r.category] || 0) + 1; });
  const topCategories = Object.entries(catCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([cat, count]) => ({ cat, count }));

  const confirmedScams = curSubs.filter(s => s.score >= 75).length;
  const avgScore = curSubs.length > 0
    ? Math.round(curSubs.reduce((s, r) => s + (r.score || 0), 0) / curSubs.length)
    : 0;

  return {
    submissions: { current: curSubs.length, previous: prevSubs.length, pct_change: pctChange(curSubs.length, prevSubs.length) },
    quick_scans:  { current: curScans.length, previous: prevScans.length, pct_change: pctChange(curScans.length, prevScans.length) },
    confirmed_scams: confirmedScams,
    avg_threat_score: avgScore,
    top_categories: topCategories,
    training_rows: training.length,
  };
}

// ── Phase 2: Token cost audit ──────────────────────────────────────────────────

async function extractCostAudit(weekStart, weekEnd) {
  const prevStart = new Date(weekStart);
  prevStart.setUTCDate(prevStart.getUTCDate() - 28); // 4-week window for z-score
  const prevStartStr = prevStart.toISOString().split('T')[0];

  const [weekRows, historicalRows] = await Promise.all([
    sbGet(`api_usage_log?select=endpoint,model,input_tokens,output_tokens,cost_usd&created_at=gte.${weekStart}&created_at=lte.${weekEnd}T23:59:59Z`),
    sbGet(`api_usage_log?select=cost_usd&created_at=gte.${prevStartStr}&created_at=lt.${weekStart}`),
  ]);

  const totalCost = weekRows.reduce((s, r) => s + (parseFloat(r.cost_usd) || 0), 0);
  const totalTokens = weekRows.reduce((s, r) => s + (r.input_tokens || 0) + (r.output_tokens || 0), 0);

  const byEndpoint = {};
  weekRows.forEach(r => {
    if (!byEndpoint[r.endpoint]) byEndpoint[r.endpoint] = { calls: 0, cost: 0 };
    byEndpoint[r.endpoint].calls++;
    byEndpoint[r.endpoint].cost += parseFloat(r.cost_usd) || 0;
  });

  // Simple anomaly: week cost vs 4-week average
  const historicalCost = historicalRows.reduce((s, r) => s + (parseFloat(r.cost_usd) || 0), 0);
  const historicalAvg = historicalRows.length > 0 ? historicalCost / 4 : null;
  const costAnomaly = historicalAvg !== null && historicalAvg > 0
    ? { pct_vs_avg: Math.round(((totalCost - historicalAvg) / historicalAvg) * 100), flagged: totalCost > historicalAvg * 1.25 }
    : null;

  return {
    week_total_cost_usd: Math.round(totalCost * 10000) / 10000,
    week_total_tokens: totalTokens,
    by_endpoint: byEndpoint,
    cost_anomaly: costAnomaly,
    note: weekRows.length === 0 ? 'No api_usage_log data yet — run the SQL migration first.' : null,
  };
}

// ── Phase 3: Service health pings ─────────────────────────────────────────────

async function pingService(name, url, headers = {}) {
  const start = Date.now();
  try {
    const res = await fetch(url, { method: 'HEAD', headers, signal: AbortSignal.timeout(5000) });
    return { name, ok: res.ok || res.status < 500, status: res.status, latency_ms: Date.now() - start };
  } catch (err) {
    return { name, ok: false, status: null, latency_ms: Date.now() - start, error: err.message };
  }
}

async function extractHealth() {
  const results = await Promise.all([
    pingService('Supabase', `${SUPABASE_URL}/rest/v1/`, { apikey: SUPABASE_KEY }),
    pingService('Anthropic', 'https://api.anthropic.com/v1/models', { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' }),
    PERPLEXITY_KEY
      ? pingService('Perplexity', 'https://api.perplexity.ai/chat/completions', { Authorization: `Bearer ${PERPLEXITY_KEY}` })
      : Promise.resolve({ name: 'Perplexity', ok: null, status: null, error: 'No key configured' }),
    SENTRY_TOKEN
      ? pingService('Sentry', `https://sentry.io/api/0/organizations/${SENTRY_ORG}/`, { Authorization: `Bearer ${SENTRY_TOKEN}` })
      : Promise.resolve({ name: 'Sentry', ok: null, status: null, error: 'No key configured' }),
  ]);
  return results;
}

// ── Phase 3b: Sentry errors ────────────────────────────────────────────────────

async function extractSentryErrors() {
  if (!SENTRY_TOKEN || !SENTRY_ORG || !SENTRY_PROJECT) return [];
  try {
    const res = await fetch(
      `https://sentry.io/api/0/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/issues/?query=is:unresolved&statsPeriod=7d&limit=10`,
      { headers: { Authorization: `Bearer ${SENTRY_TOKEN}`, 'Content-Type': 'application/json' } }
    );
    if (!res.ok) return [];
    const issues = await res.json();
    return (Array.isArray(issues) ? issues : []).map(i => ({
      title: i.title,
      culprit: i.culprit || 'N/A',
      count: i.count,
      user_count: i.userCount,
      last_seen: i.lastSeen,
      permalink: i.permalink,
    }));
  } catch {
    return [];
  }
}

// ── Phase 4: Claude analysis ───────────────────────────────────────────────────

async function analyzeWithClaude(metrics, costAudit, health, sentryErrors, weekStart, weekEnd) {
  const payload = {
    week: `${weekStart} to ${weekEnd}`,
    business_metrics: metrics,
    cost_audit: costAudit,
    service_health: health,
    sentry_errors: sentryErrors.slice(0, 10),
  };

  const payloadStr = JSON.stringify(payload, null, 2);
  const { text: scrubbed, count: piiCount } = scrubPii(payloadStr);

  // Rough token estimate: ~1 token per 4 chars
  const estimatedInputTokens = Math.round(scrubbed.length / 4) + 800; // +800 for system prompt
  if (estimatedInputTokens > MAX_INPUT_TOKENS) {
    throw new Error(`Payload too large: ~${estimatedInputTokens} estimated tokens exceeds cap of ${MAX_INPUT_TOKENS}`);
  }

  const staticSystemPrompt = `You are the CTO of PhishScore.ai, a community-driven scam intelligence platform.
Analyze the weekly operational data below and return a structured JSON report.
PII items have been redacted. Do not attempt to infer redacted values.
Return ONLY valid JSON — no markdown, no explanation.

Return this exact JSON shape:
{
  "executive_summary": "<4 bullet points a CTO can read in 20 seconds>",
  "wins": ["<win1>", "<win2>"],
  "risks": ["<risk1>", "<risk2>"],
  "recommendations": [
    {
      "title": "<action title>",
      "severity": "high|medium|low",
      "confidence": "high|medium|low",
      "suggested_fix": "<1-2 sentence fix>",
      "file_hint": "<file path if applicable, else null>"
    }
  ],
  "architecture_suggestion": "<one architectural improvement>",
  "cost_optimization": "<one cost reduction suggestion>"
}`;

  const userPrompt = `PII redacted: ${piiCount} items.

Weekly operational data:
${scrubbed}`;

  const start = Date.now();
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: [{ type: 'text', text: staticSystemPrompt, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  const latency = Date.now() - start;
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude analysis failed [${res.status}]: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const { logUsage } = require('../../_utils/logUsage');
  logUsage({
    endpoint: 'weekly-report',
    model: 'claude-sonnet-4-6',
    input_tokens: data.usage?.input_tokens,
    output_tokens: data.usage?.output_tokens,
    latency_ms: latency,
  }).catch(() => {});

  const text = data.content?.map(c => c.text || '').join('').trim();
  const jsonStr = text.replace(/^```json?\s*/i, '').replace(/```$/i, '').trim();
  const analysis = JSON.parse(jsonStr);

  const costUsd = (data.usage?.input_tokens || 0) * (3 / 1_000_000)
    + (data.usage?.output_tokens || 0) * (15 / 1_000_000);

  return { analysis, costUsd };
}

// ── Phase 5: Report HTML ───────────────────────────────────────────────────────

function buildEmailHtml({ weekStart, weekEnd, metrics, analysis, costAudit, sentryErrors, reportCost }) {
  const fmt = d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const severityColor = { high: '#dc2626', medium: '#d97706', low: '#059669' };

  const recsHtml = (analysis.recommendations || [])
    .sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.severity] - { high: 0, medium: 1, low: 2 }[b.severity]))
    .map(r => `
      <tr>
        <td style="padding:10px 8px;border-bottom:1px solid #f3f4f6;font-family:monospace;font-size:10px;color:${severityColor[r.severity] || '#374151'};font-weight:700;white-space:nowrap;">${(r.severity || '').toUpperCase()}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #f3f4f6;font-family:Georgia,serif;font-size:12px;color:#374151;">
          <strong>${r.title}</strong><br>
          <span style="color:#6b7280;font-size:11px;">${r.suggested_fix}</span>
          ${r.file_hint ? `<br><code style="font-size:10px;color:#6b7280;">${r.file_hint}</code>` : ''}
        </td>
        <td style="padding:10px 8px;border-bottom:1px solid #f3f4f6;font-family:monospace;font-size:9px;color:#9ca3af;white-space:nowrap;">${(r.confidence || '').toUpperCase()}</td>
      </tr>`).join('');

  const errorsHtml = sentryErrors.slice(0, 5).map(e => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #f3f4f6;font-family:monospace;font-size:11px;color:#dc2626;">${e.title}</td>
      <td style="padding:8px;border-bottom:1px solid #f3f4f6;font-family:monospace;font-size:10px;color:#6b7280;">${e.culprit}</td>
      <td style="padding:8px;border-bottom:1px solid #f3f4f6;font-family:monospace;font-size:10px;color:#374151;text-align:right;">${e.count || '?'}</td>
    </tr>`).join('');

  const subChange = metrics.submissions.pct_change;
  const scanChange = metrics.quick_scans.pct_change;
  const changeStr = (v) => v === null ? '—' : (v > 0 ? `+${v}%` : `${v}%`);
  const changeColor = (v) => v === null ? '#9ca3af' : v > 10 ? '#059669' : v < -10 ? '#dc2626' : '#374151';

  return `
<div style="font-family:Georgia,serif;max-width:640px;margin:0 auto;background:#ffffff;padding:40px 32px;">

  <!-- Header -->
  <div style="margin-bottom:28px;border-bottom:2px solid #111;padding-bottom:16px;">
    <span style="font-family:monospace;font-size:22px;font-weight:800;color:#111;">PHISH</span><span style="font-family:monospace;font-size:22px;font-weight:800;color:#dc2626;">SCORE</span><span style="font-family:monospace;font-size:13px;color:#9ca3af;">.ai</span>
    <p style="font-family:monospace;font-size:10px;letter-spacing:3px;color:#6b7280;margin:6px 0 0;">WEEKLY CTO BRIEFING — ${fmt(weekStart).toUpperCase()} – ${fmt(weekEnd).toUpperCase()}</p>
  </div>

  <!-- Executive Summary -->
  <div style="background:#f9fafb;border-left:4px solid #111;padding:16px 20px;margin-bottom:24px;">
    <p style="font-family:monospace;font-size:10px;letter-spacing:3px;color:#374151;margin:0 0 10px;">EXECUTIVE SUMMARY</p>
    <p style="font-size:13px;color:#374151;line-height:1.7;margin:0;white-space:pre-line;">${analysis.executive_summary || ''}</p>
  </div>

  <!-- Volume Stats -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
    <tr>
      ${[
        { label: 'SUBMISSIONS', value: metrics.submissions.current, change: subChange },
        { label: 'QUICK SCANS', value: metrics.quick_scans.current, change: scanChange },
        { label: 'CONFIRMED SCAMS', value: metrics.confirmed_scams, change: null },
        { label: 'AVG THREAT SCORE', value: metrics.avg_threat_score, change: null },
      ].map(s => `
        <td style="width:25%;padding:4px;">
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;text-align:center;">
            <p style="font-family:monospace;font-size:8px;letter-spacing:2px;color:#6b7280;margin:0 0 4px;">${s.label}</p>
            <p style="font-family:monospace;font-size:20px;font-weight:800;color:#111;margin:0;">${s.value}</p>
            ${s.change !== null ? `<p style="font-family:monospace;font-size:9px;color:${changeColor(s.change)};margin:3px 0 0;">${changeStr(s.change)} wow</p>` : ''}
          </div>
        </td>`).join('')}
    </tr>
  </table>

  <!-- Wins & Risks -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
    <tr>
      <td style="width:50%;padding-right:8px;vertical-align:top;">
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 16px;">
          <p style="font-family:monospace;font-size:9px;letter-spacing:2px;color:#059669;margin:0 0 8px;">✓ WINS THIS WEEK</p>
          ${(analysis.wins || []).map(w => `<p style="font-size:12px;color:#166534;margin:0 0 6px;line-height:1.5;">• ${w}</p>`).join('')}
        </div>
      </td>
      <td style="width:50%;padding-left:8px;vertical-align:top;">
        <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:14px 16px;">
          <p style="font-family:monospace;font-size:9px;letter-spacing:2px;color:#d97706;margin:0 0 8px;">⚠ RISKS TO WATCH</p>
          ${(analysis.risks || []).map(r => `<p style="font-size:12px;color:#92400e;margin:0 0 6px;line-height:1.5;">• ${r}</p>`).join('')}
        </div>
      </td>
    </tr>
  </table>

  <!-- Recommendations -->
  ${recsHtml ? `
  <div style="margin-bottom:24px;">
    <p style="font-family:monospace;font-size:10px;letter-spacing:3px;color:#374151;margin:0 0 10px;">ACTION ITEMS</p>
    <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <thead><tr>
        <th style="padding:8px;background:#f9fafb;font-family:monospace;font-size:9px;letter-spacing:2px;color:#6b7280;text-align:left;">SEV</th>
        <th style="padding:8px;background:#f9fafb;font-family:monospace;font-size:9px;letter-spacing:2px;color:#6b7280;text-align:left;">ITEM</th>
        <th style="padding:8px;background:#f9fafb;font-family:monospace;font-size:9px;letter-spacing:2px;color:#6b7280;text-align:left;">CONFIDENCE</th>
      </tr></thead>
      <tbody>${recsHtml}</tbody>
    </table>
  </div>` : ''}

  <!-- Sentry Errors -->
  ${errorsHtml ? `
  <div style="margin-bottom:24px;">
    <p style="font-family:monospace;font-size:10px;letter-spacing:3px;color:#374151;margin:0 0 10px;">TOP SENTRY ERRORS (7D)</p>
    <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <thead><tr>
        <th style="padding:8px;background:#f9fafb;font-family:monospace;font-size:9px;color:#6b7280;text-align:left;">ISSUE</th>
        <th style="padding:8px;background:#f9fafb;font-family:monospace;font-size:9px;color:#6b7280;text-align:left;">CULPRIT</th>
        <th style="padding:8px;background:#f9fafb;font-family:monospace;font-size:9px;color:#6b7280;text-align:right;">COUNT</th>
      </tr></thead>
      <tbody>${errorsHtml}</tbody>
    </table>
  </div>` : ''}

  <!-- Architecture & Cost -->
  <div style="margin-bottom:24px;">
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px;margin-bottom:10px;">
      <p style="font-family:monospace;font-size:9px;letter-spacing:2px;color:#6b7280;margin:0 0 6px;">ARCHITECTURE NOTE</p>
      <p style="font-size:12px;color:#374151;line-height:1.6;margin:0;">${analysis.architecture_suggestion || '—'}</p>
    </div>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px;">
      <p style="font-family:monospace;font-size:9px;letter-spacing:2px;color:#6b7280;margin:0 0 6px;">COST OPTIMIZATION</p>
      <p style="font-size:12px;color:#374151;line-height:1.6;margin:0;">${analysis.cost_optimization || '—'}</p>
    </div>
  </div>

  <!-- Footer -->
  <div style="border-top:1px solid #e5e7eb;padding-top:16px;margin-top:8px;">
    <p style="font-family:monospace;font-size:9px;color:#9ca3af;margin:0;">
      Week: ${weekStart} → ${weekEnd} &nbsp;|&nbsp;
      LLM cost this week: $${(costAudit.week_total_cost_usd || 0).toFixed(4)} &nbsp;|&nbsp;
      This report cost: $${reportCost.toFixed(4)}<br>
      PhishScore.ai — contact@phishscore.ai
    </p>
  </div>

</div>`;
}

// ── Shared pipeline — called by trigger.js inline and by HTTP handler ──────────

async function runPipeline(report_id, weekStart, weekEnd) {
  try {
    await setStatus(report_id, 'running');

    // Phase 1 + 2 + 3 in parallel
    const [metrics, costAudit, health, sentryErrors] = await Promise.all([
      extractMetrics(weekStart, weekEnd).catch(e => ({ error: e.message })),
      extractCostAudit(weekStart, weekEnd).catch(e => ({ error: e.message })),
      extractHealth().catch(() => []),
      extractSentryErrors().catch(() => []),
    ]);

    await sbPatch(report_id, {
      metrics_json: { business: metrics, cost: costAudit },
      health_json: health,
    });

    // Phase 4: Claude analysis
    let analysis = null;
    let reportCost = 0;
    try {
      const result = await analyzeWithClaude(metrics, costAudit, health, sentryErrors, weekStart, weekEnd);
      analysis = result.analysis;
      reportCost = result.costUsd;
    } catch (err) {
      console.error('[run] Claude analysis error:', err.message);
      analysis = {
        executive_summary: `Analysis unavailable: ${err.message}`,
        wins: [], risks: [], recommendations: [],
        architecture_suggestion: null, cost_optimization: null,
      };
    }

    // Phase 5: Build report HTML
    const html = buildEmailHtml({ weekStart, weekEnd, metrics, analysis, costAudit, sentryErrors, reportCost });

    await sbPatch(report_id, {
      status: 'completed',
      analysis_markdown: html,
      recommendations_json: analysis.recommendations || [],
      cost_usd: reportCost,
      completed_at: new Date().toISOString(),
    });

    console.log(`[weekly-report] ${report_id} completed. Cost: $${reportCost.toFixed(4)}`);
  } catch (err) {
    console.error('[weekly-report/run] fatal:', err.message);
    await setFailed(report_id, err.message).catch(() => {});
  }
}

// ── HTTP handler (kept for direct invocation if needed) ────────────────────────

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (req.headers['x-cron-secret'] !== CRON_SECRET) return res.status(401).json({ error: 'Unauthorized' });

  const { report_id, week_start, week_end } = req.body || {};
  if (!report_id || !week_start || !week_end) return res.status(400).json({ error: 'report_id, week_start, week_end required' });

  res.status(202).json({ ok: true, report_id });
  await runPipeline(report_id, week_start, week_end);
}

handler.config = { maxDuration: 120 };
module.exports = handler;
module.exports.runPipeline = runPipeline;
