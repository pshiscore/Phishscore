const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY; // use service key server-side
const GEMINI_KEY = process.env.GEMINI_API_KEY;

// Maps category IDs to human-readable sector labels
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

// Fetch submissions from a given time window
async function fetchWindow(fromISO) {
  const url = `${SUPABASE_URL}/rest/v1/submissions?select=category,score,tags,summary&created_at=gte.${fromISO}&order=created_at.desc`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });
  return res.json();
}

// Aggregate submissions into per-category stats
function aggregate(submissions) {
  const map = {};
  for (const s of submissions) {
    const cat = s.category || "other";
    if (!map[cat]) map[cat] = { category: cat, count: 0, totalScore: 0, scamCount: 0, tags: {} };
    map[cat].count++;
    map[cat].totalScore += s.score || 0;
    if (s.score >= 75) map[cat].scamCount++;
    // Count tag frequency
    if (Array.isArray(s.tags)) {
      for (const tag of s.tags) {
        map[cat].tags[tag] = (map[cat].tags[tag] || 0) + 1;
      }
    }
  }
  // Compute averages and top tags
  return Object.values(map).map(c => ({
    category: c.category,
    count: c.count,
    avgScore: Math.round(c.totalScore / c.count),
    scamRate: Math.round((c.scamCount / c.count) * 100),
    topTags: Object.entries(c.tags).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]),
    sector: SECTOR_MAP[c.category] || null,
  })).sort((a, b) => b.count - a.count);
}

// Compute threat level 1-5 based on volume, avg score, and surge
function computeThreatLevel(currentAgg, previousAgg) {
  if (!currentAgg.length) return 1;

  const totalSubmissions = currentAgg.reduce((s, c) => s + c.count, 0);
  const avgScore = currentAgg.reduce((s, c) => s + c.avgScore * c.count, 0) / Math.max(totalSubmissions, 1);
  const highRiskCats = currentAgg.filter(c => c.avgScore >= 80).length;

  // Surge: compare current week total vs previous
  const prevTotal = previousAgg.reduce((s, c) => s + c.count, 0);
  const surgeRatio = prevTotal > 0 ? totalSubmissions / prevTotal : 1;

  let score = 0;
  // Volume
  if (totalSubmissions >= 50) score += 2;
  else if (totalSubmissions >= 20) score += 1;
  // Average score
  if (avgScore >= 85) score += 2;
  else if (avgScore >= 70) score += 1;
  // High risk categories
  if (highRiskCats >= 4) score += 1;
  // Surge
  if (surgeRatio >= 2) score += 1;

  return Math.min(Math.max(score, 1), 5);
}

// Build sector warnings for categories with high scam rates this week
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
  return warnings.slice(0, 5);
}

// Call Gemini for a 2-sentence safety warning
async function callGemini(threatLevel, currentAgg, sectorWarnings) {
  const topCategories = currentAgg.slice(0, 5).map(c =>
    `${c.category} (${c.count} reports, avg score ${c.avgScore}, top tags: ${c.topTags.join(", ")})`
  ).join("; ");

  const surges = sectorWarnings.filter(w => w.surge).map(w =>
    `${w.sector} up ${w.surge}%`
  ).join(", ");

  const prompt = `You are PhishScore.ai's threat intelligence system. Based on community scam reports from the last 7 days, write exactly 2 plain-English sentences for a public safety warning. Be specific about which scam types are active. Do not use technical jargon. Do not include URLs. Do not mention specific companies by name unless they are being impersonated.

Current threat level: ${threatLevel}/5
Top scam categories this week: ${topCategories}
${surges ? `Notable surges: ${surges}` : "No major surges detected."}

Respond with only the 2 sentences, nothing else.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 120 },
      }),
    }
  );
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Community scam reports are active. Stay vigilant and verify any unexpected messages.";
}

// Store the trend snapshot in Supabase
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

  // Simple internal auth — pass a secret to prevent public triggering
  if (req.headers["x-internal-secret"] !== process.env.INTERNAL_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch current and previous windows in parallel
    const [currentRaw, previousRaw] = await Promise.all([
      fetchWindow(sevenDaysAgo),
      fetchWindow(fourteenDaysAgo),
    ]);

    if (!Array.isArray(currentRaw)) throw new Error("Failed to fetch current submissions");

    // Filter previous to only 7-14 day window
    const previousFiltered = Array.isArray(previousRaw)
      ? previousRaw.filter(s => new Date(s.created_at) < new Date(sevenDaysAgo))
      : [];

    const currentAgg = aggregate(currentRaw);
    const previousAgg = aggregate(previousFiltered);
    const threatLevel = computeThreatLevel(currentAgg, previousAgg);
    const sectorWarnings = buildSectorWarnings(currentAgg, previousAgg);
    const aiWarning = await callGemini(threatLevel, currentAgg, sectorWarnings);

    const snapshot = {
      threat_level: threatLevel,
      ai_warning: aiWarning,
      sector_warnings: sectorWarnings,
      aggregation_snapshot: currentAgg,
      week_current: { total: currentRaw.length, from: sevenDaysAgo },
      week_previous: { total: previousFiltered.length, from: fourteenDaysAgo },
    };

    await storeTrend(snapshot);

    return res.status(200).json({ success: true, data: snapshot });
  } catch (err) {
    console.error("generate-trends error:", err);
    return res.status(500).json({ error: "Failed to generate trends" });
  }
};
