const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const { analyzeRadarBatch } = require('../lib/cnl-analyzer');

const SECTOR_MAP = {
  publishing: "Authors & Writers",
  delivery: "Online Shoppers",
  retail: "Online Shoppers",
  telecom: "Phone Users",
  traffic: "Drivers",
  social: "Social Media Users",
  finance: "Banking Customers",
  government: "General Public",
  prize: "General Public",
  romance: "Dating App Users",
  job: "Job Seekers",
  tech: "Tech Users",
  political: "Voters & Donors",
  travel: "Travelers",
  legal: "General Public",
  other: null,
};

const SEASONAL_CONTEXT = {
  1:  "January: Post-holiday refund scams, W-2 and tax prep phishing, New Year charity fraud.",
  2:  "February: Valentine's Day romance scams, gift card fraud, fake flower and gift delivery notices.",
  3:  "March: Early tax season IRS impersonation, March Madness prize scams, spring break travel fraud.",
  4:  "April: Peak IRS tax scams, fake refund notices, stimulus check impersonation, deadline urgency scams. This is the highest risk month for government impersonation scams.",
  5:  "May: Mother's Day gift scams, fake charity drives, summer travel booking fraud emerging.",
  6:  "June: Summer travel scams, fake vacation rental fraud, graduation gift card scams.",
  7:  "July: Summer travel fraud peaks, fake hotel and airline deals, BBQ and event ticket scams.",
  8:  "August: Back-to-school supply scams, fake scholarship offers, end-of-summer travel fraud.",
  9:  "September: Fake hurricane relief charity scams, back-to-school loan fraud, harvest festival ticket scams.",
  10: "October: Halloween costume and event ticket scams, fake charity drives, holiday shopping fraud beginning.",
  11: "November: Black Friday and Cyber Monday fake deals, fake package delivery surges, holiday charity scams.",
  12: "December: Peak holiday shopping fraud, fake gift cards, charity impersonation, year-end tax scams.",
};

const FALLBACK_INTELLIGENCE = {
  threatLevel: 3,
  threatWarning: "A multi-vector scam surge is active across financial and government impersonation categories. Threat actors are deploying SMS and email lures mimicking major banks and federal agencies.",
  intelligenceSummary: "Current threat intelligence indicates coordinated brand impersonation campaigns targeting banking customers and general consumers. Operators are leveraging fear-based urgency triggers — account suspension notices, IRS penalty threats, and package interception alerts — to compress victim decision-making time and bypass critical thinking. Delivery-sector lures are being used as a secondary vector to harvest home addresses and payment credentials. Victims are funneled through lookalike login pages designed to steal credentials in real time.",
  recommendedAction: "Do not click links in unsolicited SMS or email messages — navigate directly to the official website by typing the address into your browser.",
};

// ── Data fetching ──────────────────────────────────────────────────────────────

async function fetchLast100() {
  const url = `${SUPABASE_URL}/rest/v1/submissions?select=category,score,tags,summary&order=created_at.desc&limit=100`;
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  return res.json();
}

async function fetchPrevious100() {
  const url = `${SUPABASE_URL}/rest/v1/submissions?select=category,score,tags&order=created_at.desc&limit=100&offset=100`;
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  return res.json();
}

// ── Aggregation helpers ────────────────────────────────────────────────────────

function aggregate(submissions) {
  const map = {};
  for (const s of submissions) {
    const cat = s.category || "other";
    if (!map[cat]) map[cat] = { category: cat, count: 0, totalScore: 0, scamCount: 0, tags: {} };
    map[cat].count++;
    map[cat].totalScore += s.score || 0;
    if (s.score >= 75) map[cat].scamCount++;
    if (Array.isArray(s.tags)) {
      for (const tag of s.tags) {
        map[cat].tags[tag] = (map[cat].tags[tag] || 0) + 1;
      }
    }
  }
  return Object.values(map).map(c => ({
    category: c.category,
    count: c.count,
    avgScore: Math.round(c.totalScore / c.count),
    scamRate: Math.round((c.scamCount / c.count) * 100),
    topTags: Object.entries(c.tags).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]),
    sector: SECTOR_MAP[c.category] || null,
  })).sort((a, b) => b.count - a.count);
}

function computeThreatLevel(currentAgg, previousAgg) {
  if (!currentAgg.length) return 1;
  const total = currentAgg.reduce((s, c) => s + c.count, 0);
  const avgScore = currentAgg.reduce((s, c) => s + c.avgScore * c.count, 0) / Math.max(total, 1);
  const highRiskCats = currentAgg.filter(c => c.avgScore >= 80).length;
  const prevTotal = previousAgg.reduce((s, c) => s + c.count, 0);
  const surgeRatio = prevTotal > 0 ? total / prevTotal : 1;

  let score = 0;
  if (total >= 50) score += 2; else if (total >= 20) score += 1;
  if (avgScore >= 85) score += 2; else if (avgScore >= 70) score += 1;
  if (highRiskCats >= 4) score += 1;
  if (surgeRatio >= 2) score += 1;
  return Math.min(Math.max(score, 1), 5);
}

function buildSectorWarnings(currentAgg, previousAgg) {
  const warnings = [];
  for (const cat of currentAgg) {
    if (!cat.sector || cat.count < 2) continue;
    const prev = previousAgg.find(p => p.category === cat.category);
    const prevCount = prev?.count || 0;
    const surge = prevCount > 0 ? Math.round((cat.count / prevCount - 1) * 100) : null;
    if (cat.avgScore >= 80 || cat.scamRate >= 70) {
      warnings.push({
        sector: cat.sector,
        category: cat.category,
        avgScore: cat.avgScore,
        scamRate: cat.scamRate,
        count: cat.count,
        surge: surge !== null && surge > 50 ? surge : null,
        topTags: cat.topTags,
      });
    }
  }
  return warnings.slice(0, 3);
}

// ── Gemini — analyst persona, TTP-focused structured JSON call ────────────────

function buildAnalystPayload(currentAgg, cnlInsights, month, totalReports, surgeRatio) {
  return {
    topCategories: currentAgg.slice(0, 3).map(c => ({
      category: c.category,
      count: c.count,
      avgScore: c.avgScore,
      scamRate: c.scamRate,
      topTags: c.topTags,
    })),
    extractedEntities: cnlInsights?.entities?.organizations?.slice(0, 5).map(o => o.name) || [],
    averageUrgency: cnlInsights?.sentiment?.urgencyLevel || 'UNKNOWN',
    sentimentScore: cnlInsights?.sentiment?.score ?? null,
    sentimentMagnitude: cnlInsights?.sentiment?.magnitude ?? null,
    cnlContentCategories: cnlInsights?.categories?.map(c => c.name) || [],
    seasonalContext: SEASONAL_CONTEXT[month] || '',
    totalReports,
    volumeSpike: surgeRatio >= 1.3,
    volumeChangePct: Math.round((surgeRatio - 1) * 100),
    currentMonth: new Date().toLocaleString('en-US', { month: 'long', timeZone: 'America/New_York' }),
  };
}

async function callGeminiIntelligence(currentAgg, sectorWarnings, cnlInsights, month, totalReports, surgeRatio) {
  const payload = buildAnalystPayload(currentAgg, cnlInsights, month, totalReports, surgeRatio);
  const surges = sectorWarnings.filter(w => w.surge).map(w => `${w.sector} +${w.surge}%`).join(', ');

  const prompt = `You are the Lead Cyber Intelligence Analyst for PhishScore.ai, a real-time community scam detection platform. Your job is to analyze the following threat telemetry and write a public-facing, executive-level Threat Intelligence Briefing.

ANALYST RULES — YOU MUST FOLLOW THESE:
1. DO NOT just list category names. Name the specific organizations and brands being impersonated based on the extracted entities below.
2. Explain the TTPs (Tactics, Techniques, and Procedures): How are scammers tricking people right now? What psychological trigger — fear, urgency, greed, authority — is dominating?
3. Be highly specific and authoritative. Write like a cybersecurity professional, not a blog post.
4. Do NOT write generic advice like "be careful online." Give concrete, situational, threat-specific guidance.

THREAT TELEMETRY:
- Report period: Last 100 community submissions
- Current month: ${payload.currentMonth}
- Seasonal threat context: ${payload.seasonalContext}
- Volume change vs. prior period: ${payload.volumeSpike ? `SPIKE DETECTED (+${payload.volumeChangePct}%)` : `${payload.volumeChangePct >= 0 ? '+' : ''}${payload.volumeChangePct}% (stable)`}
${surges ? `- Active sector surges: ${surges}` : ''}

TOP 3 SCAM CATEGORIES BY VOLUME:
${payload.topCategories.map(c => `- ${c.category}: ${c.count} reports | avg risk score ${c.avgScore}/100 | scam rate ${c.scamRate}% | tactics: ${c.topTags.join(', ')}`).join('\n')}

CNL ENTITY EXTRACTION (brands/orgs detected in scam message text):
- Impersonated organizations: ${payload.extractedEntities.length ? payload.extractedEntities.join(', ') : 'None extracted'}
- Language urgency level: ${payload.averageUrgency}
- Sentiment score: ${payload.sentimentScore ?? 'N/A'} (magnitude: ${payload.sentimentMagnitude ?? 'N/A'})
- Content classification: ${payload.cnlContentCategories.length ? payload.cnlContentCategories.join(', ') : 'None'}

OUTPUT FORMAT — return ONLY valid JSON, no markdown, no backticks, no extra text:
{
  "threatLevel": <integer 1-5. Base this on: volume, urgency level, scam rates, and whether a spike is detected. 5 = critical surge with high-urgency impersonation>,
  "threatWarning": "<1-2 sentence high-impact executive summary naming the specific dominant threat and who is being targeted right now>",
  "intelligenceSummary": "<3-4 sentences: explain the specific mechanics of the current dominant scams — name the impersonated brands from the entity data, describe the psychological trigger being used, explain how victims are being funneled, and what the scammers ultimately want to extract>",
  "recommendedAction": "<1 sentence of highly specific, actionable advice directly tied to the current primary threat vector>"
}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 600,
          responseMimeType: 'application/json',
        },
      }),
    }
  );

  const data = await res.json();
  console.log('Gemini intelligence response status:', res.status);
  if (!res.ok || data.error) {
    console.error('Gemini intelligence error:', JSON.stringify(data));
    return null;
  }

  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const match = raw.match(/\{[\s\S]*\}/);
  let clean = match ? match[0] : raw.replace(/```json/g, '').replace(/```/g, '').trim();

  clean = clean.replace(/\\n/g, "\\n")
               .replace(/\\'/g, "\\'")
               .replace(/\\"/g, '\\"')
               .replace(/\\&/g, "\\&")
               .replace(/\\r/g, "\\r")
               .replace(/\\t/g, "\\t")
               .replace(/\\b/g, "\\b")
               .replace(/\\f/g, "\\f");
  clean = clean.replace(/[\u0000-\u0019]+/g, "");

  try {
    const parsed = JSON.parse(clean);
    console.log('Gemini intelligence parsed — threatLevel:', parsed.threatLevel);
    return parsed;
  } catch (e) {
    console.error('Gemini JSON parse failed:', clean.slice(0, 200));
    return null;
  }
}

// ── Storage ────────────────────────────────────────────────────────────────────

async function storeTrend(payload) {
  await fetch(`${SUPABASE_URL}/rest/v1/trends`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(payload),
  });
}

// ── Main handler ───────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const expectedSecret = process.env.INTERNAL_SECRET || 'phiscore-radara-2026';
  if (req.headers['x-internal-secret'] !== expectedSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const month = new Date().getMonth() + 1;

    // Parallel: current submissions + previous 100 for surge comparison
    const [currentRaw, previousRaw] = await Promise.all([
      fetchLast100(),
      fetchPrevious100(),
    ]);

    if (!Array.isArray(currentRaw)) throw new Error('Failed to fetch submissions');

    const currentAgg = aggregate(currentRaw);
    const previousAgg = Array.isArray(previousRaw) ? aggregate(previousRaw) : [];
    const sectorWarnings = buildSectorWarnings(currentAgg, previousAgg);
    const prevTotal = previousRaw?.length || 0;
    const surgeRatio = prevTotal > 0 ? currentRaw.length / prevTotal : 1;

    // CNL batch analysis on available summaries
    const summaryTexts = currentRaw.filter(s => s.summary).map(s => s.summary);
    const cnlInsights = summaryTexts.length >= 5 ? await analyzeRadarBatch(summaryTexts) : null;
    if (cnlInsights) console.log('CNL insights:', JSON.stringify(cnlInsights).slice(0, 120));

    // Single Gemini call — analyst persona, TTP-focused
    const intelligence = await callGeminiIntelligence(
      currentAgg, sectorWarnings, cnlInsights, month, currentRaw.length, surgeRatio
    ) || FALLBACK_INTELLIGENCE;

    const snapshot = {
      threat_level: intelligence.threatLevel,
      threat_warning: intelligence.threatWarning,
      ai_warning: intelligence.intelligenceSummary,
      sector_warnings: sectorWarnings,
      aggregation_snapshot: currentAgg,
      total_reports: currentRaw.length,
      previous_total: prevTotal,
      cnl_top_categories: cnlInsights?.categories?.map(c => c.name).join(', ') || null,
      cnl_sentiment_level: cnlInsights?.sentiment?.urgencyLevel || null,
      recommended_action: intelligence.recommendedAction,
    };

    await storeTrend(snapshot);
    return res.status(200).json({ success: true, data: snapshot });

  } catch (err) {
    console.error('generate-trends error:', err);
    return res.status(500).json({ error: 'Failed to generate trends' });
  }
};
