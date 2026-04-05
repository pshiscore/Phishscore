// ── Polar Webhook — handles post-payment events from Polar via Svix ───────────

const crypto = require('crypto');

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const RESEND_KEY = process.env.RESEND_API_KEY;
const POLAR_WEBHOOK_SECRET = process.env.POLAR_WEBHOOK_SECRET;

// Svix signature verification (used by Polar)
// Signed content: "{webhook-id}.{webhook-timestamp}.{raw-body}"
function verifySignature(rawBody, headers) {
  const msgId = headers['webhook-id'];
  const msgTimestamp = headers['webhook-timestamp'];
  const msgSignature = headers['webhook-signature'];

  if (!msgId || !msgTimestamp || !msgSignature) return false;

  // Reject replays older than 5 minutes
  if (Math.abs(Date.now() / 1000 - Number(msgTimestamp)) > 300) return false;

  const signingInput = `${msgId}.${msgTimestamp}.${rawBody}`;
  // Polar webhook secrets are base64-encoded, prefixed with "whsec_"
  const secret = POLAR_WEBHOOK_SECRET.startsWith('whsec_')
    ? POLAR_WEBHOOK_SECRET.slice(6)
    : POLAR_WEBHOOK_SECRET;
  const secretBytes = Buffer.from(secret, 'base64');
  const computed = crypto.createHmac('sha256', secretBytes).update(signingInput).digest('base64');

  // Extract all passed signatures (stripping the 'v1,' prefix)
  const passedSignatures = msgSignature.split(' ').map(sig => sig.split(',')[1]);

  // Check if our computed signature matches ANY of the passed signatures
  return passedSignatures.includes(computed);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Read raw body as Buffers to preserve byte-perfect encoding for HMAC
  const rawBodyBuffer = await new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
  const rawBody = rawBodyBuffer.toString('utf8');

  if (!verifySignature(rawBody, req.headers)) {
    console.error('polar-webhook: invalid signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  // Only handle order.created
  if (event.type !== 'order.created') {
    return res.status(200).json({ received: true });
  }

  const order = event.data;
  const { caseId, tier } = order.metadata || {};

  if (!caseId) {
    console.error('polar-webhook: order.created missing caseId in metadata', order.id);
    return res.status(200).json({ received: true });
  }

  // Generate 64-char report token
  const reportToken = crypto.randomBytes(32).toString('hex');

  // Mark case as paid in Supabase
  const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/deep_intel_cases?id=eq.${caseId}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      payment_status: 'paid',
      tier: Number(tier),
      report_token: reportToken,
      updated_at: new Date().toISOString(),
    }),
  });

  if (!patchRes.ok) {
    console.error('polar-webhook: Supabase PATCH failed', await patchRes.text());
  }

  console.log(`polar-webhook: case ${caseId} marked paid (tier ${tier})`);

  // T2/T3: notify admin — T1 frontend polls and triggers /api/deep-intel itself
  if (Number(tier) >= 2) {
    const customerEmail = order.customer?.email || 'unknown';
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'PhishScore Deep Intel <reports@phishscore.ai>',
        to: 'vkrasikov@gmail.com',
        subject: `New Tier ${tier} Case — #${caseId.slice(0, 8).toUpperCase()}`,
        html: `
          <p>A new Tier ${tier} Deep Intel case has been paid.</p>
          <p><strong>Case ID:</strong> ${caseId}</p>
          <p><strong>Customer:</strong> ${customerEmail}</p>
          <p><strong>Report token:</strong> <code>${reportToken}</code></p>
          <p><strong>Polar order:</strong> ${order.id}</p>
        `,
      }),
    });
    console.log(`polar-webhook: T${tier} notification sent for case ${caseId}`);
  }

  return res.status(200).json({ received: true });
};

// Disable Vercel's built-in body parsing so we can read raw bytes for signature verification
module.exports.config = { api: { bodyParser: false } };
