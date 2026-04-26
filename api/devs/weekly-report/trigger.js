// POST /api/devs/weekly-report/trigger
// Auth-gated: requires valid devs_session cookie or x-cron-secret header.
// Inserts a weekly_reports row (status=pending), fires run.js via background fetch,
// returns {report_id} immediately so the client can begin polling /status.

const crypto = require('crypto');

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL?.replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const CRON_SECRET   = process.env.INTERNAL_SECRET || 'phiscore-radara-2026';

module.exports.config = { maxDuration: 120 };

// Reuse same HMAC logic as auth-devs.js
const SESSION_TOKEN = crypto
  .createHmac('sha256', ADMIN_PASSWORD || 'fallback')
  .update(ADMIN_USERNAME || 'admin')
  .digest('hex');

function parseCookies(header = '') {
  return Object.fromEntries(
    header.split(';').map(c => {
      const [k, ...v] = c.trim().split('=');
      return [k, v.join('=')];
    }).filter(([k]) => k)
  );
}

function isAuthed(req) {
  // Cron path: signed header
  if (req.headers['x-cron-secret'] === CRON_SECRET) return { ok: true, actor: 'cron' };
  // Admin dashboard path: session cookie
  const cookies = parseCookies(req.headers.cookie || '');
  if (ADMIN_PASSWORD && cookies['devs_session'] === SESSION_TOKEN) {
    return { ok: true, actor: `manual:${ADMIN_USERNAME || 'admin'}` };
  }
  return { ok: false };
}

function getWeekBounds() {
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0=Sun
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - daysToMonday);
  monday.setUTCHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const fmt = (d) => d.toISOString().split('T')[0];
  return { week_start: fmt(monday), week_end: fmt(sunday) };
}

async function sbPost(path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase insert failed [${res.status}]: ${err}`);
  }
  return res.json();
}

async function checkRunning() {
  const { week_start } = getWeekBounds();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/weekly_reports?week_start_date=eq.${week_start}&status=in.(pending,running)&limit=1`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = isAuthed(req);
  if (!auth.ok) return res.status(401).json({ error: 'Unauthorized' });

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  try {
    // Guard: prevent double-trigger for current week
    const existing = await checkRunning();
    if (existing) {
      return res.status(409).json({
        error: 'A report for this week is already running',
        report_id: existing.id,
        status: existing.status,
      });
    }

    const { week_start, week_end } = getWeekBounds();

    // Insert pending row
    const rows = await sbPost('weekly_reports', {
      week_start_date: week_start,
      week_end_date:   week_end,
      status:          'pending',
      triggered_by:    auth.actor,
    });
    const report = Array.isArray(rows) ? rows[0] : rows;
    const report_id = report.id;

    // Respond immediately so the client can start polling, then run the pipeline
    res.status(200).json({ ok: true, report_id, week_start, week_end });

    // Run pipeline inline — Vercel keeps the function alive until this resolves (maxDuration: 120)
    const { runPipeline } = require('./run');
    await runPipeline(report_id, week_start, week_end).catch(err =>
      console.error('[trigger] pipeline error:', err.message)
    );
  } catch (err) {
    console.error('[weekly-report/trigger] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
