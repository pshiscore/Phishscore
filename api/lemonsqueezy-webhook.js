const crypto = require('crypto');

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const WEBHOOK_SECRET = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;

function verifySignature(rawBody, signature) {
  const hash = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  return hash === signature;
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function triggerForensicAnalysis(caseId) {
  const baseUrl = 'https://phishscore.ai';

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

  // Get raw body — Vercel provides it as a Buffer when bodyParser is disabled
  let rawBody;
  try {
    rawBody = await new Promise((resolve, reject) => {
      let data = '';
      req.on('data', chunk => { data += chunk; });
      req.on('end', () => resolve(data));
      req.on('error', reject);
    });
  } catch (err) {
    console.error('Failed to read raw body:', err);
    return res.status(400).json({ error: 'Failed to read body' });
  }

  const signature = req.headers['x-signature'];
  console.log('Webhook secret being used:', WEBHOOK_SECRET);
  console.log('Signature received:', signature);

  if (!signature || !verifySignature(rawBody, signature)) {
    console.error('Signature mismatch');
    console.error('Expected:', crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex'));
    console.error('Received:', signature);
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const eventName = req.headers['x-event-name'];
  console.log('Lemon Squeezy webhook:', eventName);

  if (eventName !== 'order_created') {
    return res.status(200).json({ received: true });
  }

  try {
    const body = JSON.parse(rawBody);
    const order = body?.data;
    const attributes = order?.attributes;
    const customData = attributes?.meta?.custom_data ||
                       body?.meta?.custom_data ||
                       attributes?.first_order_item?.custom_data || {};

    const caseId = customData?.case_id;
    const orderId = order?.id;
    const orderNumber = attributes?.order_number;
    const status = attributes?.status;

    console.log('Order data:', { caseId, orderId, orderNumber, status });

    if (!caseId) {
      console.error('No case_id in webhook custom data:', JSON.stringify(body?.meta));
      return res.status(200).json({ received: true });
    }

    if (status !== 'paid') {
      console.log('Order not paid yet, status:', status);
      return res.status(200).json({ received: true });
    }

    const reportToken = generateToken();

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

    triggerForensicAnalysis(caseId);

    return res.status(200).json({ received: true });

  } catch (err) {
    console.error('Webhook processing error:', err);
    return res.status(200).json({ received: true });
  }
};

module.exports.config = { api: { bodyParser: false } };
