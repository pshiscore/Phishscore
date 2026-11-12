const { authorizeSession } = require('./_utils/cronAuth');
const { analyzeContactData } = require('../lib/ipqs');

module.exports = async function handler(req, res) {
  // Dev-dashboard diagnostic (/devs): admin session cookie required. Same-origin
  // only, so no CORS headers.
  if (!authorizeSession(req).ok) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { contact } = req.body || {};
  if (!contact) return res.status(400).json({ error: 'contact is required' });

  const start = Date.now();
  try {
    const result = await analyzeContactData(contact);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    return res.status(200).json({ ok: true, elapsed, ...result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
