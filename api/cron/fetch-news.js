const Parser = require('rss-parser');
const { logUsage } = require('../_utils/logUsage');
const { requireJobAuth } = require('../_utils/cronAuth');
const { dbError } = require('../_utils/safeLog');

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

const FEEDS = [
  { name: 'BleepingComputer', url: 'https://www.bleepingcomputer.com/feed/' },
  { name: 'Writer Beware',    url: 'https://writerbeware.blog/feed/' },
  { name: 'The Record',       url: 'https://therecord.media/feed' },
  { name: 'Ars Technica',     url: 'https://arstechnica.com/tag/security/feed/' },
  { name: 'TorrentFreak',     url: 'https://torrentfreak.com/feed' },
];

const ITEMS_PER_FEED = 2;

// published_at drives the 7-day News window. Every current feed gives an
// accurate date (checked 2026-11-14 against the live feeds). If an item has
// no date, an unparseable one, or one more than an hour in the future, the
// fetch time is used instead. Before this, a missing date failed the insert
// (the column is NOT NULL) and an unparseable one threw and ended the run.
const FUTURE_TOLERANCE_MS = 60 * 60 * 1000;
function publishedAt(item, fetchedAt = new Date()) {
  const raw = item && (item.isoDate || item.pubDate);
  const t = raw ? Date.parse(raw) : NaN;
  if (!Number.isFinite(t) || t > fetchedAt.getTime() + FUTURE_TOLERANCE_MS) {
    return { iso: fetchedAt.toISOString(), fallback: true };
  }
  return { iso: new Date(t).toISOString(), fallback: false };
}

// ── Duplicate check ────────────────────────────────────────────────────────────

async function articleExists(articleUrl) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/threat_news?select=id&article_url=eq.${encodeURIComponent(articleUrl)}&limit=1`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );
    if (!res.ok) return false;
    const data = await res.json();
    return Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}

// ── Claude summarisation with model fallback ───────────────────────────────────

async function summariseWithClaude(title, snippet) {
  const prompt = `You are a Cyber Threat Intelligence Analyst. Summarize this news article into a JSON object. Return ONLY valid JSON with three keys: "hook" (one bold sentence summarizing the threat/news), "impact" (who/what it affects), and "takeaway" (one actionable security recommendation).

Do not include markdown, backticks, or any text outside the JSON object.

Title: ${title}
Snippet: ${snippet || '(no snippet available)'}`;

  const body = {
    max_tokens: 256,
    messages: [{ role: 'user', content: prompt }],
  };

  const callClaude = async (model) => {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...body, model }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic ${model} error [${res.status}]: ${err}`);
    }
    return res.json();
  };

  let data;
  try {
    data = await callClaude('claude-sonnet-4-6');
  } catch (primaryErr) {
    console.warn('Sonnet failed, falling back to Haiku:', primaryErr.message);
    data = await callClaude('claude-haiku-4-5-20251001');
  }

  logUsage({ endpoint: 'fetch-news', model: data.model || 'claude-sonnet-4-6', input_tokens: data?.usage?.input_tokens, output_tokens: data?.usage?.output_tokens }).catch(() => {});
  const raw = data?.content?.[0]?.text || '';
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON found in Claude response: ' + raw.slice(0, 100));
  return JSON.parse(match[0]);
}

// ── Supabase insert ────────────────────────────────────────────────────────────

async function insertArticle(record) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/threat_news`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=ignore-duplicates,return=minimal',
    },
    body: JSON.stringify(record),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`Supabase insert failed [${res.status}]:`, dbError(err));
  }
}

// ── Main handler ───────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Cron presents Bearer <CRON_SECRET>; the dashboard presents its session cookie.
  const auth = requireJobAuth(req, res);
  if (!auth) return;
  console.log('fetch-news start, actor:', auth.actor);

  const parser = new Parser({ timeout: 10000 });
  const results = { processed: 0, skipped: 0, errors: [], dateFallbacks: [] };

  for (const feed of FEEDS) {
    let feedData;
    try {
      feedData = await parser.parseURL(feed.url);
    } catch (err) {
      console.error(`Failed to fetch feed ${feed.name}:`, err.message);
      results.errors.push({ feed: feed.name, error: err.message });
      continue;
    }

    const items = (feedData.items || []).slice(0, ITEMS_PER_FEED);

    for (const item of items) {
      const articleUrl = item.link;
      if (!articleUrl) { results.skipped++; continue; }

      // Skip already-stored articles
      const exists = await articleExists(articleUrl);
      if (exists) { results.skipped++; continue; }

      const title = item.title || '(no title)';
      const snippet = item.contentSnippet || item.content || '';

      let summary;
      try {
        summary = await summariseWithClaude(title, snippet.slice(0, 800));
      } catch (err) {
        console.error(`Claude failed for "${title}":`, err.message);
        results.errors.push({ url: articleUrl, error: err.message });
        results.skipped++;
        continue;
      }

      const published = publishedAt(item);
      if (published.fallback) {
        results.dateFallbacks.push(feed.name);
        console.warn(`[fetch-news] ${feed.name}: item has no usable publish date; using fetch time`);
      }
      await insertArticle({
        source_name: feed.name,
        article_url: articleUrl,
        title,
        hook: summary.hook || null,
        impact: summary.impact || null,
        takeaway: summary.takeaway || null,
        published_at: published.iso,
      });

      results.processed++;
    }
  }

  console.log('fetch-news complete:', results);
  return res.status(200).json({ ok: true, ...results });
};

// Assigned after module.exports = handler (it used to be assigned first and lost).
module.exports.config = { maxDuration: 60 };
module.exports.publishedAt = publishedAt;
