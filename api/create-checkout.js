const POLAR_API_KEY = process.env.POLAR_ACCESS_TOKEN;
const POLAR_PRODUCT_ID = process.env.POLAR_DEEP_INTEL_PRODUCT_ID;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { caseId, email } = req.body || {};

  try {
    const response = await fetch('https://api.polar.sh/v1/checkouts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${POLAR_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        product_id: POLAR_PRODUCT_ID,
        customer_email: email,
        success_url: `https://www.phishscore.ai/report/${caseId}?payment=success`,
        metadata: { caseId },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Polar checkout error:', response.status, text);
      throw new Error('Polar API returned non-ok response');
    }

    const data = await response.json();
    return res.status(200).json({ url: data.url });
  } catch (err) {
    console.error('create-checkout error:', err);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
};
