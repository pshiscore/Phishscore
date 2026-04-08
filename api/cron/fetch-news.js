const Parser = require('rss-parser');

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const INTERNAL_SECRET = process.env.INTERNAL_SECRET;

const FEEDS = [
  { name: 'BleepingComputer', url: 'https://www.bleepingcomputer.com/feed/' },
];

const ITEMS_PER_FEED = 5;

// ── Claude call with model fallback ───────────────────────────────────────────

async function summariseWithClaude(title, snippet) {
  const prompt = `Act as a Cyber Threat Analyst. Given the following news article title and snippet, output ONLY a valid JSON object with exactly these three keys:
- "hook": One bold sentence summarizing the core threat or news.
- "impact": Who is targeted or what is the specific risk.
- "takeaway": One actionable sentence for an everyday user or IT professional.

Do not include markdown, backticks, or any text outside the JSON object.

Title: ${title}
Snippet: ${snippet || '(no snippet available)'}`;

  const body = {
    model: 'claude-sonnet-4-6',
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

// ── Supabase upsert ────────────────────────────────────────────────────────────

async function upsertArticle(record) {
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
    console.error(`Supabase upsert failed [${res.status}]:`, err);
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

      await upsertArticle({
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
