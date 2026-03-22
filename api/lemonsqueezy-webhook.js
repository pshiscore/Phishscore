const crypto = require('crypto');

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const WEBHOOK_SECRET = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;

// Verify the webhook signature from Lemon Squeezy
function verifySignature(payload, signature) {
  const hash = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
  return hash === signature;
}

// Generate a secure random token for report access
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Trigger the forensic analysis in the background
async function triggerForensicAnalysis(caseId) {
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

  fetch(`${baseUrl}/api/deep-intel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': process.env.INTERNAL_SECRET
    },
    body: JSON.stringify({ caseId })
  }).catch(err => console.error('Failed to trigger forensic analysis:', err));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Get raw body for signature verification
  const rawBody = JSON.stringify(req.body);
  const signature = req.headers['x-signature'];

  if (!signature || !verifySignature(rawBody, signature)) {
    console.error('Invalid webhook signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const eventName = req.headers['x-event-name'];
  console.log('Lemon Squeezy webhook:', eventName);

  // Only process successful orders
  if (eventName !== 'order_created') {
    return res.status(200).json({ received: true });
  }

  try {
    const order = req.body?.data;
    const attributes = order?.attributes;
    const customData = attributes?.first_order_item?.custom_data ||
                       attributes?.custom_data || {};

    const caseId = customData?.case_id;
    const orderId = order?.id;
    const orderNumber = attributes?.order_number;
    const status = attributes?.status;

    if (!caseId) {
      console.error('No case_id in webhook custom data');
      return res.status(200).json({ received: true });
    }

    if (status !== 'paid') {
      console.log('Order not paid yet, status:', status);
      return res.status(200).json({ received: true });
    }

    // Generate report access token
    const reportToken = generateToken();

    // Update case as paid
    await fetch(`${SUPABASE_URL}/rest/v1/deep_intel_cases?id=eq.${caseId}`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({
        payment_status: 'paid',
        lemon_order_id: String(orderId),
        lemon_order_number: String(orderNumber),
        report_token: reportToken,
        updated_at: new Date().toISOString()
      })
    });

    // Fire and forget — trigger the forensic analysis
    triggerForensicAnalysis(caseId);

    return res.status(200).json({ received: true });

  } catch (err) {
    console.error('Webhook processing error:', err);
    // Always return 200 to Lemon Squeezy so it doesn't retry
    return res.status(200).json({ received: true });
  }
};
