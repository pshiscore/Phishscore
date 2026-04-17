// ── Polar Checkout — creates a Polar checkout session and returns the URL ──────

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const POLAR_API_KEY = process.env.POLAR_API_KEY;

const PRODUCT_IDS = {
  1: process.env.POLAR_PRODUCT_T1,
  2: process.env.POLAR_PRODUCT_T2,
  3: process.env.POLAR_PRODUCT_T3,
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    tier, email, message, story, contactInfo,
    originalScore, originalCategory,
    ivsScore, ivsLabel, ivsExplanation, entryPoint,
    evidenceUrls,
  } = req.body;

  if (!tier || !email) return res.status(400).json({ error: 'tier and email required' });

  const tierNum = Number(tier);
  if (![1, 2, 3].includes(tierNum)) return res.status(400).json({ error: 'Invalid tier' });

  const productId = PRODUCT_IDS[tierNum];
  if (!productId) {
    return res.status(500).json({ error: `POLAR_PRODUCT_T${tierNum} env var not configured` });
  }

  try {
    // 1. Create the case record in Supabase to get a caseId
    const caseRes = await fetch(`${SUPABASE_URL}/rest/v1/deep_intel_cases`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        email,
        tier: tierNum,
        original_message: message || null,
        story: story || null,
        contact_info: contactInfo || null,
        original_score: originalScore || null,
        original_category: originalCategory || null,
        ivs_score: ivsScore || null,
        ivs_label: ivsLabel || null,
        ivs_explanation: ivsExplanation || null,
        entry_point: entryPoint || 'unknown',
        payment_status: 'pending',
        evidence_urls: Array.isArray(evidenceUrls) && evidenceUrls.length > 0 ? evidenceUrls : null,
      }),
    });

    const caseRows = await caseRes.json();
    if (!Array.isArray(caseRows) || !caseRows[0]) {
      console.error('Supabase case insert failed:', JSON.stringify(caseRows));
      throw new Error('Failed to create case record');
    }
    const caseId = caseRows[0].id;

    // 2. Create Polar checkout session
    const polarRes = await fetch('https://sandbox-api.polar.sh/v1/checkouts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${POLAR_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        product_id: productId,
        customer_email: email,
        success_url: `https://www.phishscore.ai/report?case=${caseId}`,
        metadata: { caseId, tier: tierNum },
      }),
    });

    if (!polarRes.ok) {
      const errText = await polarRes.text();
      console.error('Polar checkout error:', polarRes.status, errText);
      throw new Error(`Polar API returned ${polarRes.status}: ${errText}`);
    }

    const polarData = await polarRes.json();
    if (!polarData.url) {
      console.error('Polar response missing URL:', JSON.stringify(polarData));
      throw new Error('Polar API did not return a checkout URL');
    }

    return res.status(200).json({ checkoutUrl: polarData.url });

  } catch (err) {
    console.error('polar-checkout error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
