const crypto = require('crypto');

const RESEND_KEY = process.env.RESEND_API_KEY;
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const WEBHOOK_SECRET = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;

const TIER_NAMES = { 1: 'AI Forensic Report', 2: 'Verified Human Check', 3: 'Expert Investigation' };

// Notify Vlad that manual review is needed
async function sendManualReviewNotification(caseId, tier, customerEmail, reportToken) {
  const caseUrl = `https://phishscore.ai/report?token=${reportToken}`;
  const supabaseUrl = `${SUPABASE_URL}/rest/v1/deep_intel_cases?id=eq.${caseId}&select=*`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'PhishScore Deep Intel <reports@phishscore.ai>',
      to: 'vkrasikov@gmail.com',
      subject: `[ACTION REQUIRED] ${TIER_NAMES[tier]} — Case #${caseId.slice(0,8).toUpperCase()}`,
      html: `
        <div style="font-family:monospace;max-width:600px;margin:0 auto;padding:24px;">
          <h2 style="color:#dc2626;">New ${TIER_NAMES[tier]} Purchase</h2>
          <p><strong>Case ID:</strong> ${caseId}</p>
          <p><strong>Tier:</strong> ${TIER_NAMES[tier]} ($${tier === 2 ? '9.99' : '29.99'})</p>
          <p><strong>Customer:</strong> ${customerEmail}</p>
          <p><strong>Case Link:</strong> <a href="${caseUrl}">${caseUrl}</a></p>
          <hr/>
          <p>The AI Forensic Report has already been generated and emailed to the customer. Your job is to review it and follow up directly with the customer at <strong>${customerEmail}</strong>.</p>
          <p><a href="${supabaseUrl}" style="color:#7c3aed;">View full case data in Supabase</a></p>
        </div>
      `
    })
  });
}

// Send confirmation to customer for T2/T3
async function sendManualTierConfirmation(customerEmail, caseId, tier, reportToken) {
  const t3CheckoutUrl = `https://phishscore.ai`; // They can upgrade from status page
  const isT2 = tier === 2;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'PhishScore Deep Intel <reports@phishscore.ai>',
      to: customerEmail,
      subject: `Your ${TIER_NAMES[tier]} Request — Case #${caseId.slice(0,8).toUpperCase()}`,
      html: `
        <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:32px;">
          <div style="margin-bottom:20px;">
            <span style="font-family:monospace;font-size:20px;font-weight:800;">PHISH</span><span style="font-family:monospace;font-size:20px;font-weight:800;color:#dc2626;">SCORE</span><span style="font-family:monospace;font-size:13px;color:#9ca3af;">.ai</span>
            <p style="font-family:monospace;font-size:10px;letter-spacing:3px;color:#6b7280;margin:4px 0 0;">DEEP INTEL — ${TIER_NAMES[tier].toUpperCase()}</p>
          </div>

          <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:12px;padding:20px;margin-bottom:24px;">
            <p style="font-family:monospace;font-size:11px;letter-spacing:2px;color:#7c3aed;margin:0 0 4px;">CASE ID</p>
            <p style="font-family:monospace;font-size:14px;font-weight:700;margin:0;">#${caseId.slice(0,8).toUpperCase()}</p>
          </div>

          ${isT2 ? `
          <p style="font-size:15px;line-height:1.8;color:#374151;">
            Thank you for purchasing a <strong>Verified Human Check</strong>. A human expert has been notified and will review your AI forensic report carefully to ensure nothing was missed.
          </p>
          <p style="font-size:14px;line-height:1.8;color:#6b7280;">
            You will receive a follow-up email from our team within <strong>24 hours</strong> with our findings and any additional recommendations.
          </p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
          <p style="font-size:13px;color:#6b7280;">
            <strong>Want the deepest possible investigation?</strong> Our Expert Investigation tier includes full manual OSINT research, source verification, and a 1-on-1 strategy session at $29.99. Reply to this email to upgrade.
          </p>
          ` : `
          <p style="font-size:15px;line-height:1.8;color:#374151;">
            Thank you for purchasing an <strong>Expert Investigation</strong>. Your case has been assigned to an expert investigator who will conduct full OSINT research, source verification, and build a custom recovery strategy for your situation.
          </p>
          <p style="font-size:14px;line-height:1.8;color:#6b7280;">
            You will be contacted at this email address within <strong>24-48 hours</strong> with your complete investigation report and to schedule your 1-on-1 strategy session.
          </p>
          `}

          <p style="font-size:12px;color:#9ca3af;margin-top:32px;font-family:monospace;">
            Questions? Reply to this email or contact <a href="mailto:contact@phishscore.ai" style="color:#dc2626;">contact@phishscore.ai</a>
          </p>
        </div>
      `
    })
  });
}

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
    const tier = parseInt(customData?.tier || '1');
    const orderId = order?.id;
    const orderNumber = attributes?.order_number;
    const status = attributes?.status;
    const customerEmail = attributes?.user_email || '';

    console.log('Order data:', { caseId, tier, orderId, orderNumber, status });

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
        tier,
        updated_at: new Date().toISOString()
      })
    });

    if (tier === 2 || tier === 3) {
      // Notify Vlad — manual review required
      await sendManualReviewNotification(caseId, tier, customerEmail, reportToken);
      // Send confirmation to customer
      await sendManualTierConfirmation(customerEmail, caseId, tier, reportToken);
    }
    // T1 is triggered from the frontend status page

    return res.status(200).json({ received: true });

  } catch (err) {
    console.error('Webhook processing error:', err);
    return res.status(200).json({ received: true });
  }
};

module.exports.config = { api: { bodyParser: false } };
