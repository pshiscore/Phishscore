// REACT_APP_SUPABASE_URL is the live project. SUPABASE_URL was set by the old
// Supabase integration and points at a deleted project; preferring it sent
// these writes to a dead database.
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body || {};

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required' });
  }

  const trimmed = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  try {
    const res2 = await fetch(`${SUPABASE_URL}/rest/v1/subscribers`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ email: trimmed }),
    });

    // 409 = unique constraint violation (already subscribed) — treat as success
    if (!res2.ok && res2.status !== 409) {
      const err = await res2.text();
      console.error(`subscribe: Supabase insert failed [${res2.status}]:`, err);
      return res.status(500).json({ error: 'Could not save subscription. Please try again.' });
    }
  } catch (err) {
    console.error('subscribe: unexpected error:', err.message);
    return res.status(500).json({ error: 'Could not save subscription. Please try again.' });
  }

  return res.status(200).json({ ok: true });
};
