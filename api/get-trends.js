const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const INTERNAL_SECRET = process.env.INTERNAL_SECRET;
const REFRESH_HOURS = 48;

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
    if (isStale) {
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000";

      fetch(`${baseUrl}/api/generate-trends`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": INTERNAL_SECRET,
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
