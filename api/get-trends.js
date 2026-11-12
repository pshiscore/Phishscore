const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
// The background refresh calls generate-trends server-to-server and must
// present the same credential Vercel's cron does.
const CRON_SECRET = process.env.CRON_SECRET;
const REFRESH_HOURS = 12;

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    // Fetch the most recent trend snapshot
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/trends?select=*&order=created_at.desc&limit=1`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );
    const rows = await response.json();
    const latest = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;

    // Check if stale or missing
    const isStale = !latest || (() => {
      const ageHours = (Date.now() - new Date(latest.created_at).getTime()) / (1000 * 60 * 60);
      return ageHours >= REFRESH_HOURS;
    })();

    // Trigger a background refresh if stale — fire and forget
    if (isStale && !CRON_SECRET) {
      console.warn("get-trends: CRON_SECRET not set; skipping background refresh");
    } else if (isStale) {
      const baseUrl = 'https://www.phishscore.ai';

      fetch(`${baseUrl}/api/generate-trends`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${CRON_SECRET}`,
        },
        body: JSON.stringify({}),
      }).catch(err => console.error("Background refresh failed:", err));
    }

    // Return cached data if we have it, even if stale (fresh data will be ready next open)
    if (latest) {
      return res.status(200).json({
        data: latest,
        stale: isStale,
        refreshing: isStale,
        lastUpdated: latest.created_at,
      });
    }

    // No data at all yet — return a placeholder
    return res.status(200).json({
      data: null,
      stale: true,
      refreshing: true,
      lastUpdated: null,
    });

  } catch (err) {
    console.error("get-trends error:", err);
    return res.status(500).json({ error: "Failed to fetch trends" });
  }
};
