const { CohereClient } = require('cohere-ai');

module.exports.config = { maxDuration: 60 };

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const PERPLEXITY_KEY = process.env.PERPLEXITY_API_KEY;
const COHERE_KEY = process.env.COHERE_API_KEY;
const RESEND_KEY = process.env.RESEND_API_KEY;
const INTERNAL_SECRET = process.env.INTERNAL_SECRET;

// ── Supabase helpers ───────────────────────────────────────────────────────────

async function sbFetch(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Supabase fetch failed [${res.status}]: ${path}`);
  return res.json();
}

async function sbInsert(table, record) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(record),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase insert failed [${res.status}]: ${err}`);
  }
}

// ── Step 1: Extract data from Supabase ────────────────────────────────────────

async function extractData() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [latestTrends, recentNews, topSubmissions] = await Promise.all([
    sbFetch('trends?select=cnl_top_categories,threat_warning,intelligence_summary&order=created_at.desc&limit=1'),
    sbFetch(`threat_news?select=title,hook,impact,takeaway,source_name,published_at&order=published_at.desc&published_at=gte.${sevenDaysAgo}&limit=5`),
    sbFetch(`submissions?select=score,category,summary,preview,created_at&visibility=eq.public&score=gte.75&order=score.desc&created_at=gte.${sevenDaysAgo}&limit=3`),
  ]);

  const trend = Array.isArray(latestTrends) ? latestTrends[0] : null;
  return {
    trend,
    topCategories: trend?.cnl_top_categories || [],
    threatWarning: trend?.threat_warning || trend?.intelligence_summary || '',
    recentNews: Array.isArray(recentNews) ? recentNews : [],
    topSubmissions: Array.isArray(topSubmissions) ? topSubmissions : [],
  };
}

// ── Step 2: Perplexity live web enrichment ────────────────────────────────────

async function enrichWithPerplexity(topCategories) {
  if (!PERPLEXITY_KEY) {
    console.warn('PERPLEXITY_API_KEY not set — skipping web enrichment');
    return 'Live web enrichment unavailable (API key not configured).';
  }

  const categoryList = Array.isArray(topCategories) && topCategories.length
    ? topCategories.map(c => (typeof c === 'string' ? c : c.category || JSON.stringify(c))).join(', ')
    : 'phishing, banking fraud, tech support scams';

  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PERPLEXITY_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar-pro',
      messages: [
        { role: 'system', content: 'You are a cyber intelligence researcher.' },
        {
          role: 'user',
          content: `Search the web for recent news, statistics, or FBI/CISA warnings from the past 7 days related to these specific threat categories: ${categoryList}. Provide a concise, factual summary of the current real-world landscape for these threats.`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`Perplexity error [${res.status}]:`, err);
    return 'Live web enrichment unavailable at this time.';
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content || 'No web context retrieved.';
}

// ── Step 3: Cohere RAG synthesis ──────────────────────────────────────────────

async function synthesiseWithCohere(extractedData, perplexityContext) {
  const cohere = new CohereClient({ token: COHERE_KEY });

  const { threatWarning, recentNews, topSubmissions } = extractedData;

  const newsSummary = recentNews.length
    ? recentNews.map(n => `- ${n.title} (${n.source_name}): ${n.hook || ''} Impact: ${n.impact || ''} Action: ${n.takeaway || ''}`).join('\n')
    : 'No recent threat news available.';

  const submissionSummary = topSubmissions.length
    ? topSubmissions.map(s => `- Score ${s.score}/100 · ${s.category}: ${s.summary || s.preview || '(no preview)'}`).join('\n')
    : 'No high-scoring public submissions this week.';

  const documents = [
    {
      title: 'Radar Trends',
      snippet: `Current threat warning: ${threatWarning || 'No active warning.'}\n\nTop categories: ${JSON.stringify(extractedData.topCategories)}`,
    },
    {
      title: 'Perplexity Live Web Context',
      snippet: perplexityContext,
    },
    {
      title: 'Recent Threat News',
      snippet: newsSummary,
    },
    {
      title: 'Community Submissions',
      snippet: submissionSummary,
    },
  ];

  const response = await cohere.chat({
    model: 'command-r-08-2024',
    documents,
    message: `You are the Lead Editor for PhishScore.ai. Write our Weekly Cyber Intelligence Briefing. You must synthesize the provided documents into a cohesive, professional newsletter. Use Markdown formatting. Include these sections:

1. **Executive Summary** (Combine our radar trends with the live web context to describe the current threat landscape in 2-3 paragraphs).
2. **Community Threat Board** (Highlight our top user-submitted cases with context on what scammers are targeting).
3. **Curated Intelligence** (Summarize the news articles into digestible threat briefs, one paragraph each).

Write in a direct, authoritative style. Be specific. Name real tactics and real targets where the data supports it.`,
  });

  return response.text || '';
}

// ── Step 4: Fetch subscribers ─────────────────────────────────────────────────

async function fetchSubscribers() {
  const rows = await sbFetch('subscribers?select=email,unsubscribe_token');
  return Array.isArray(rows) ? rows : [];
}

// ── Step 5: Dispatch emails via Resend ────────────────────────────────────────

function buildEmailHtml(bodyHtml, unsubscribeToken) {
  const unsubscribeUrl = `https://phishscore.ai/api/unsubscribe?token=${unsubscribeToken}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>PhishScore Weekly Intelligence Brief</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:Georgia,serif;color:#e2e8f0;">
<div style="max-width:640px;margin:0 auto;padding:32px 24px;">
  <div style="margin-bottom:28px;padding-bottom:20px;border-bottom:1px solid #1e293b;">
    <div style="font-family:monospace;font-size:10px;letter-spacing:4px;color:#38bdf8;margin-bottom:8px;">WEEKLY INTELLIGENCE BRIEFING</div>
    <div style="font-family:monospace;font-size:22px;font-weight:800;color:#f1f5f9;letter-spacing:0.5px;">PhishScore<span style="color:#f43f5e;">.ai</span></div>
  </div>
  <div style="line-height:1.75;font-size:14px;color:#cbd5e1;">
    ${bodyHtml}
  </div>
  <div style="margin-top:40px;padding-top:20px;border-top:1px solid #1e293b;font-family:monospace;font-size:10px;color:#475569;text-align:center;line-height:1.8;">
    <div>You're receiving this because you subscribed at phishscore.ai</div>
    <div><a href="${unsubscribeUrl}" style="color:#64748b;text-decoration:underline;">Unsubscribe</a> &nbsp;·&nbsp; PhishScore.ai &nbsp;·&nbsp; AI-powered phishing intelligence</div>
  </div>
</div>
</body>
</html>`;
}

async function dispatchEmails(markdownContent, subscribers) {
  if (!RESEND_KEY) {
    console.warn('RESEND_API_KEY not set — skipping email dispatch');
    return 0;
  }

  const { marked } = await import('marked');
  const bodyHtml = marked.parse(markdownContent);
  let dispatched = 0;

  for (const sub of subscribers) {
    const { email, unsubscribe_token } = sub;
    if (!email) continue;

    const html = buildEmailHtml(bodyHtml, unsubscribe_token || '');

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'PhishScore Weekly <brief@phishscore.ai>',
          to: email,
          subject: `PhishScore Weekly Intelligence Brief — ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
          html,
        }),
      });

      if (res.ok) {
        dispatched++;
      } else {
        const err = await res.text();
        console.error(`Resend failed for ${email} [${res.status}]:`, err.slice(0, 120));
      }
    } catch (err) {
      console.error(`Resend error for ${email}:`, err.message);
    }

    // Rate-limit: 200ms between sends
    await new Promise(r => setTimeout(r, 200));
  }

  return dispatched;
}

// ── Main handler ───────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secret = req.headers['x-internal-secret'] || req.query.secret;
  if (secret !== (INTERNAL_SECRET || 'phiscore-radara-2026')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!COHERE_KEY) return res.status(500).json({ error: 'COHERE_API_KEY not configured' });

  try {
    console.log('generate-newsletter: extracting data...');
    const extractedData = await extractData();

    console.log('generate-newsletter: enriching with Perplexity...');
    const perplexityContext = await enrichWithPerplexity(extractedData.topCategories);

    console.log('generate-newsletter: synthesising with Cohere...');
    const newsletterContent = await synthesiseWithCohere(extractedData, perplexityContext);

    if (!newsletterContent) throw new Error('Cohere returned empty content');

    console.log('generate-newsletter: storing in Supabase...');
    await sbInsert('newsletters', {
      content: newsletterContent,
      created_at: new Date().toISOString(),
    });

    console.log('generate-newsletter: fetching subscribers...');
    const subscribers = await fetchSubscribers();

    console.log(`generate-newsletter: dispatching to ${subscribers.length} subscribers...`);
    const dispatched = await dispatchEmails(newsletterContent, subscribers);

    console.log(`generate-newsletter: complete — dispatched ${dispatched}/${subscribers.length}`);
    return res.status(200).json({ ok: true, message: 'Newsletter generated and stored successfully.', dispatched, total: subscribers.length });

  } catch (err) {
    console.error('generate-newsletter error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
