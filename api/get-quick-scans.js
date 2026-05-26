const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Map free-text ai_category labels → SCAM_CATEGORIES ids so dashboard counts work.
// Quick-scan Claude outputs prose labels ("VOIP Fraud", "Tech Support Fraud") not ids.
const CAT_PATTERNS = [
  { id: 'voip',       pattern: /voip|robocall|spoofed.*(call|number)|internet.*call/i },
  { id: 'tech',       pattern: /tech.?support|microsoft|apple.*support|virus.?alert|fake.*support/i },
  { id: 'finance',    pattern: /bank|crypto|invest|financial|wire.?fraud|ponzi/i },
  { id: 'government', pattern: /irs|social.?security|medicare|dmv|government|federal/i },
  { id: 'delivery',   pattern: /fedex|ups|usps|dhl|package|parcel|delivery/i },
  { id: 'prize',      pattern: /prize|lottery|sweepstake|you.?ve.?won|gift.?card/i },
  { id: 'romance',    pattern: /romance|dating|relationship|friendship.?scam/i },
  { id: 'job',        pattern: /job|employ|work.?from.?home|pyramid|recruit/i },
  { id: 'retail',     pattern: /amazon|ebay|shopif|retail|shopping|order.?confirm/i },
  { id: 'telecom',    pattern: /t.?mobile|verizon|at&t|carrier|telecom|phone.?plan|reward.*point/i },
  { id: 'traffic',    pattern: /toll|speeding|traffic|parking.?ticket|dmv.?fine/i },
  { id: 'social',     pattern: /instagram|facebook|tiktok|twitter|social.?media/i },
  { id: 'travel',     pattern: /hotel|airline|vacation|travel|airbnb/i },
  { id: 'legal',      pattern: /court|lawsuit|debt.?collect|legal.?threat|compliance/i },
  { id: 'health',     pattern: /medicare|health|pharma|cure|medical|supplement/i },
  { id: 'political',  pattern: /political|campaign|candidate|fundrais|election/i },
  { id: 'publishing', pattern: /publish|literary|agent|vanity.?press|manuscript/i },
];

function normalizeCatId(aiCategory) {
  if (!aiCategory) return 'other';
  const str = aiCategory.trim();
  for (const { id, pattern } of CAT_PATTERNS) {
    if (pattern.test(str)) return id;
  }
  return str.toLowerCase().replace(/\s+/g, '_');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('get-quick-scans: missing env vars. SUPABASE_URL:', !!SUPABASE_URL, 'SUPABASE_SERVICE_KEY:', !!SUPABASE_KEY);
    return res.status(200).json([]);
  }

  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/quick_scans?select=id,input_type,ai_score,ai_category,ai_tags,created_at&order=created_at.desc&limit=500`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );

    if (!r.ok) {
      const errBody = await r.text();
      console.error('get-quick-scans Supabase error:', r.status, errBody);
      return res.status(200).json([]);
    }
    const rows = await r.json();

    // Strip PII — never send raw_input or ipqs_data to the browser
    const safe = (Array.isArray(rows) ? rows : []).map(q => ({
      id: `qs_${q.id}`,
      _isQuickScan: true,
      score: q.ai_score,
      category: normalizeCatId(q.ai_category),
      visibility: 'private',
      input_type: q.input_type,
      preview: `Private ${q.input_type || 'quick'} scan — OSINT details hidden.`,
      tags: [],
      ai_tags: Array.isArray(q.ai_tags) ? q.ai_tags : [],
      created_at: q.created_at,
    }));

    return res.status(200).json(safe);
  } catch (err) {
    console.error('get-quick-scans error:', err.message);
    return res.status(200).json([]); // degrade gracefully — never 500 to the browser
  }
};
