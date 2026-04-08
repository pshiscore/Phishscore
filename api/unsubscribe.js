const SUPABASE_URL = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).send('Method not allowed');
  }

  const { token } = req.query || {};

  if (!token || typeof token !== 'string' || !token.trim()) {
    return res.status(400).send(html('Invalid unsubscribe link.', false));
  }

  try {
    const result = await fetch(
      `${SUPABASE_URL}/rest/v1/subscribers?unsubscribe_token=eq.${encodeURIComponent(token.trim())}`,
      {
        method: 'DELETE',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          Prefer: 'return=minimal',
        },
      }
    );

    if (!result.ok) {
      const err = await result.text();
      console.error(`unsubscribe: Supabase delete failed [${result.status}]:`, err);
      return res.status(500).send(html('Something went wrong. Please try again or contact us at contact@phishscore.ai.', false));
    }
  } catch (err) {
    console.error('unsubscribe: unexpected error:', err.message);
    return res.status(500).send(html('Something went wrong. Please try again or contact us at contact@phishscore.ai.', false));
  }

  res.setHeader('Content-Type', 'text/html');
  return res.status(200).send(html('You have been successfully unsubscribed.', true));
};

function html(message, success) {
  const color = success ? '#10b981' : '#f43f5e';
  const icon = success ? '✓' : '✗';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${success ? 'Unsubscribed' : 'Error'} — PhishScore.ai</title>
  <style>
    body { margin: 0; background: #f8fafc; font-family: Georgia, serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 48px 40px; max-width: 480px; width: 90%; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.06); }
    .icon { font-size: 40px; color: ${color}; margin-bottom: 20px; }
    .title { font-family: monospace; font-size: 13px; font-weight: 700; letter-spacing: 3px; color: ${color}; margin: 0 0 12px; }
    .message { font-size: 15px; color: #475569; line-height: 1.7; margin: 0 0 28px; }
    .brand { font-family: monospace; font-size: 11px; color: #94a3b8; letter-spacing: 2px; }
    a { color: #f43f5e; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <p class="title">${success ? 'UNSUBSCRIBED' : 'ERROR'}</p>
    <p class="message">${message}</p>
    <p class="brand"><a href="https://phishscore.ai">PHISHSCORE.AI</a></p>
  </div>
</body>
</html>`;
}
