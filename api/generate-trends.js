const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const { analyzeRadarBatch } = require('./lib/cnl-analyzer');

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

// Seasonal scam context by month
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

// Fetch last 100 submissions (privacy-safe fields only)
async function fetchLast100() {
  const url = `${SUPABASE_URL}/rest/v1/submissions?select=category,score,tags,summary&order=created_at.desc&limit=100`;
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  return res.json();
}

// Fetch previous 100 for surge comparison (offset by 100)
async function fetchPrevious100() {
  const url = `${SUPABASE_URL}/rest/v1/submissions?select=category,score,tags&order=created_at.desc&limit=100&offset=100`;
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  return res.json();
}

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

// Top 3 sector warnings only
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

// Pull recent confirmed scam summaries for Gemini context
function buildRecentSummaries(submissions) {
  return submissions
    .filter(s => s.summary && s.score >= 75)
    .slice(0, 15)
    .map(s => `[${s.category}] ${s.summary}`)
    .join("\n");
}

// Gemini prompt 1: Threat level card — 3 sentences including seasonal warning
async function callGeminiThreatWarning(threatLevel, currentAgg, sectorWarnings, month) {
  const seasonal = SEASONAL_CONTEXT[month] || "";
  const topCategories = currentAgg.slice(0, 6).map(c =>
    `${c.category} (${c.count} reports, avg score ${c.avgScore}, scam rate ${c.scamRate}%, top tags: ${c.topTags.join(", ")})`
  ).join("; ");
  const surges = sectorWarnings.filter(w => w.surge).map(w => `${w.sector} up ${w.surge}%`).join(", ");
  const topSectors = sectorWarnings.map(w => w.sector).join(", ");

  const prompt = `You are PhishScore.ai's threat intelligence analyst. Write a public threat advisory based on current scam data.

Current threat level: ${threatLevel}/5
Current month scam context: ${seasonal}
Most active scam categories (last 100 community reports): ${topCategories}
${surges ? `Surging sectors: ${surges}` : "No major surges detected."}
${topSectors ? `Highest risk sectors right now: ${topSectors}` : ""}

Write EXACTLY 3 sentences:
1. Which scam types are most active right now and who is being targeted.
2. What specific seasonal or timely scams people should watch for this month — be specific about the scam type (e.g. IRS refund scams, Easter gift card fraud, tax deadline urgency scams). Do not be vague.
3. One clear protective action people should take.

Rules: No URLs. No bullet points. Plain English. 3 flowing sentences only.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.5, maxOutputTokens: 200 },
      }),
    }
  );
  const data = await res.json();
  console.log('Gemini threat warning response status:', res.status);
  if (!res.ok || data.error) {
    console.error('Gemini threat warning error:', JSON.stringify(data));
    return null; // return null so we know it failed
  }
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  console.log('Gemini threat warning result:', text?.slice(0, 80));
  return text || null;
}

// Gemini prompt 2: Intelligence summary — specific insights from recent scam content
async function callGeminiIntelligenceSummary(currentAgg, recentSummaries, month) {
  const seasonal = SEASONAL_CONTEXT[month] || "";
  const topCategories = currentAgg.slice(0, 5).map(c =>
    `${c.category}: ${c.count} reports, avg score ${c.avgScore}, top tactics: ${c.topTags.join(", ")}`
  ).join("; ");

  const prompt = `You are PhishScore.ai's intelligence analyst. Review the latest community-submitted scam data and write a specific intelligence briefing.

Top categories from last 100 community reports: ${topCategories}
Current month context: ${seasonal}
Recent confirmed scam summaries submitted by users:
${recentSummaries || "No detailed summaries available."}

Write 2-3 sentences that:
- Identify the specific tactics and themes scammers are using right now based on the summaries above.
- Highlight any patterns (e.g. urgency tactics, brand impersonation, fake fees).
- Mention the most targeted groups if clear from the data.

Rules: Be specific — name the scam types and tactics. Do not say generic things like "stay vigilant" or "be careful." No URLs. No bullet points. Plain flowing sentences.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.5, maxOutputTokens: 180 },
      }),
    }
  );
  const data = await res.json();
  console.log('Gemini intelligence summary response status:', res.status);
  if (!res.ok || data.error) {
    console.error('Gemini intelligence summary error:', JSON.stringify(data));
    return null;
  }
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  console.log('Gemini intelligence summary result:', text?.slice(0, 80));
  return text || null;
}

async function storeTrend(payload) {
  await fetch(`${SUPABASE_URL}/rest/v1/trends`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(payload),
  });
}

// ── Main handler ──────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (req.headers["x-internal-secret"] !== process.env.INTERNAL_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const month = new Date().getMonth() + 1;

    const [currentRaw, previousRaw] = await Promise.all([
      fetchLast100(),
      fetchPrevious100(),
    ]);

    if (!Array.isArray(currentRaw)) throw new Error("Failed to fetch submissions");

    const currentAgg = aggregate(currentRaw);
    const previousAgg = Array.isArray(previousRaw) ? aggregate(previousRaw) : [];
    const threatLevel = computeThreatLevel(currentAgg, previousAgg);
    const sectorWarnings = buildSectorWarnings(currentAgg, previousAgg);
    const recentSummaries = buildRecentSummaries(currentRaw);

    // Run Gemini calls + CNL batch analysis in parallel
    const summaryTexts = currentRaw
      .filter(s => s.summary)
      .map(s => s.summary);

    const [threatWarning, intelligenceSummary, cnlInsights] = await Promise.all([
      callGeminiThreatWarning(threatLevel, currentAgg, sectorWarnings, month),
      callGeminiIntelligenceSummary(currentAgg, recentSummaries, month),
      summaryTexts.length >= 5 ? analyzeRadarBatch(summaryTexts) : Promise.resolve(null),
    ]);

    console.log('Gemini results — threatWarning:', !!threatWarning, 'intelligenceSummary:', !!intelligenceSummary);
    if (cnlInsights) console.log('CNL insights:', JSON.stringify(cnlInsights.categories));

    // Build CNL-enriched context for snapshot
    const cnlTopCategories = cnlInsights?.categories?.map(c => c.name).join(', ') || null;
    const cnlSentimentLevel = cnlInsights?.sentiment?.urgencyLevel || null;

    const snapshot = {
      threat_level: threatLevel,
      threat_warning: threatWarning || `Threat level ${threatLevel} detected. Multiple scam types are active — exercise caution with unexpected messages, especially from financial institutions and government agencies.`,
      ai_warning: intelligenceSummary || `Scam activity is currently elevated across ${currentAgg.slice(0,3).map(c=>c.category).join(', ')} categories. Be cautious of urgency-based messages requesting personal information or payment.`,
      sector_warnings: sectorWarnings,
      aggregation_snapshot: currentAgg,
      total_reports: currentRaw.length,
      previous_total: previousRaw?.length || 0,
      cnl_top_categories: cnlTopCategories,
      cnl_sentiment_level: cnlSentimentLevel,
    };

    await storeTrend(snapshot);
    return res.status(200).json({ success: true, data: snapshot });

  } catch (err) {
    console.error("generate-trends error:", err);
    return res.status(500).json({ error: "Failed to generate trends" });
  }
};
