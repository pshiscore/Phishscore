const { authorizeSession } = require('./_utils/cronAuth');
module.exports = async function handler(req, res) {
  // Dev-dashboard diagnostic (/devs): admin session cookie required. Same-origin
  // only, so no CORS headers.
  if (!authorizeSession(req).ok) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.RECAPTCHA_SECRET_KEY) return res.status(200).json({ skipped: true, message: 'RECAPTCHA_SECRET_KEY not configured' });

  // We can't get a real token server-side, so just verify the key is accepted
  // by sending a dummy token — Google will reject it but confirm the secret key is valid
  try {
    const r = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=test-token`
    });
    const data = await r.json();
    // A valid secret key returns success:false with error-codes, not an auth error
    const keyValid = !data['error-codes']?.includes('invalid-input-secret');
    return res.status(200).json({
      keyValid,
      status: keyValid ? 'Secret key accepted by Google' : 'Secret key rejected — check RECAPTCHA_SECRET_KEY',
      errorCodes: data['error-codes'] || [],
    });
  } catch (err) {
    return res.status(200).json({ error: err.message });
  }
};
