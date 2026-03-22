const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const LS_API_KEY = process.env.LEMONSQUEEZY_API_KEY;
const LS_STORE_ID = process.env.LEMONSQUEEZY_STORE_ID;

// Variant IDs from Lemon Squeezy
const VARIANTS = {
  1: 1433891, // AI Forensic Report $2.99
  2: 1433924, // Verified Human Check $9.99
  3: 1433934, // Expert Investigation $29.99
};

const TIER_NAMES = {
  1: 'AI Forensic Report',
  2: 'Verified Human Check',
  3: 'Expert Investigation',
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    tier = 1,
    email,
    message,
    story,
    originalScore,
    originalCategory,
    ivsScore,
    ivsLabel,
    ivsExplanation,
    entryPoint = 'scan'
  } = req.body;

  if (!email) return res.status(400).json({ error: 'Email required' });
  if (!message && !story) return res.status(400).json({ error: 'Message or story required' });

  const variantId = VARIANTS[tier];
  if (!variantId) return res.status(400).json({ error: 'Invalid tier' });

  try {
    // 1. Save case to Supabase first
    const caseRes = await fetch(`${SUPABASE_URL}/rest/v1/deep_intel_cases`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify({
        email,
        original_message: message || null,
        original_score: originalScore || null,
        original_category: originalCategory || null,
        story: story || null,
        ivs_score: ivsScore || null,
        ivs_label: ivsLabel || null,
        ivs_explanation: ivsExplanation || null,
        tier,
        payment_status: 'pending',
        entry_point: entryPoint,
      })
    });

    const caseData = await caseRes.json();
    const caseId = Array.isArray(caseData) ? caseData[0]?.id : caseData?.id;

    if (!caseId) throw new Error('Failed to create case record');

    // 2. Create Lemon Squeezy checkout
    const checkoutPayload = {
      data: {
        type: 'checkouts',
        attributes: {
          checkout_data: {
            email,
            custom: {
              case_id: caseId,
              tier: String(tier),
            }
          },
          product_options: {
            name: `PhishScore Deep Intel — ${TIER_NAMES[tier]}`,
            receipt_thank_you_note: `Thank you for trusting PhishScore Deep Intel. Our AI Agent is performing a forensic scan now. Your case file will be emailed to ${email} within a few minutes.`,
            redirect_url: `https://phishscore.ai/report?case=${caseId}`,
          },
          checkout_options: {
            embed: false,
          }
        },
        relationships: {
          store: { data: { type: 'stores', id: String(LS_STORE_ID) } },
          variant: { data: { type: 'variants', id: String(variantId) } }
        }
      }
    };

    const lsRes = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        'Authorization': `Bearer ${LS_API_KEY}`
      },
      body: JSON.stringify(checkoutPayload)
    });

    const lsData = await lsRes.json();
    const checkoutUrl = lsData?.data?.attributes?.url;

    if (!checkoutUrl) {
      console.error('Lemon Squeezy error:', JSON.stringify(lsData));
      throw new Error('Failed to create checkout');
    }

    // 3. Save checkout URL to case
    await fetch(`${SUPABASE_URL}/rest/v1/deep_intel_cases?id=eq.${caseId}`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({ checkout_url: checkoutUrl, updated_at: new Date().toISOString() })
    });

    return res.status(200).json({ checkoutUrl, caseId });

  } catch (err) {
    console.error('Checkout creation error:', err);
    return res.status(500).json({ error: 'Failed to create checkout' });
  }
};
