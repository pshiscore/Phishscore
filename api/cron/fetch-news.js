const Parser = require('rss-parser');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const INTERNAL_SECRET = process.env.INTERNAL_SECRET;

const FEEDS = [
  { name: 'BleepingComputer', url: 'https://www.bleepingcomputer.com/feed/' },
  { name: 'Writer Beware',    url: 'https://writerbeware.blog/feed/' },
  { name: 'The Record',       url: 'https://therecord.media/feed' },
  { name: 'Ars Technica',     url: 'https://arstechnica.com/tag/security/feed/' },
  { name: 'Fraud of the Day', url: 'https://fraudoftheday.com/feed' },
  { name: 'TorrentFreak',     url: 'https://torrentfreak.com/feed' },
];

const ITEMS_PER_FEED = 2;

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
    console.error(`Supabase insert failed [${res.status}]:`, err);
  }
}

// ── Main handler ───────────────────────────────────────────────────────────────

module.exports.config = { maxDuration: 60 };

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secret = req.headers['x-internal-secret'] || req.query.secret;
  if (secret !== (INTERNAL_SECRET || 'phiscore-radara-2026')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const parser = new Parser({ timeout: 10000 });
  const results = { processed: 0, skipped: 0, errors: [] };

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

      await insertArticle({
        source_name: feed.name,
        article_url: articleUrl,
        title,
        hook: summary.hook || null,
        impact: summary.impact || null,
        takeaway: summary.takeaway || null,
        published_at: item.pubDate ? new Date(item.pubDate).toISOString() : null,
      });

      results.processed++;
    }
  }

  console.log('fetch-news complete:', results);
  return res.status(200).json({ ok: true, ...results });
};
