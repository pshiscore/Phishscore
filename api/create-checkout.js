// create-checkout.js

// Check for both naming conventions to prevent undefined errors
const POLAR_API_KEY = process.env.POLAR_ACCESS_TOKEN || process.env.POLAR_API_KEY;

const POLAR_PRODUCTS = {
  1: process.env.POLAR_TIER_1_ID || process.env.POLAR_PRODUCT_T1,
  2: process.env.POLAR_TIER_2_ID || process.env.POLAR_PRODUCT_T2,
  3: process.env.POLAR_TIER_3_ID || process.env.POLAR_PRODUCT_T3
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { caseId, email, tier = 1 } = req.body || {};

  try {
    const productId = POLAR_PRODUCTS[tier];
    if (!productId) {
      console.error(`Missing Environment Variable for Tier ${tier} Product ID`);
      throw new Error(`No product configured for tier ${tier}`);
    }

    if (!POLAR_API_KEY) {
      console.error("Missing Polar API Key Environment Variable");
      throw new Error("Missing API Key");
    }

    // CRITICAL: Pointing to sandbox-api for testing
    const response = await fetch('https://sandbox-api.polar.sh/v1/checkouts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${POLAR_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        product_id: productId,
        customer_email: email,
        success_url: `https://www.phishscore.ai/report/${caseId}?payment=success`,
        metadata: { caseId, tier },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Polar checkout error:', response.status, text);
      throw new Error(`Polar API returned ${response.status}: ${text}`);
    }

    const data = await response.json();
    if (!data.url) {
      console.error("Polar response missing URL:", data);
      throw new Error("Polar API did not return a checkout URL");
    }
    return res.status(200).json({ url: data.url });

  } catch (err) {
    console.error("create-checkout error:", err.message);
    return res.status(500).json({ error: 'Failed to create checkout session', details: err.message });
  }
};
