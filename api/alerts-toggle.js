
const { authorizeSession } = require('./_utils/cronAuth');

// In-memory state — resets on cold start (alerts off by default)
let alertsEnabled = false;

function isAuthorized(req) {
  // The /devs session cookie, validated by the shared gate in api/_utils/cronAuth.js.
  return authorizeSession(req).ok;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'GET') {
    return res.status(200).json({ enabled: alertsEnabled });
  }

  if (req.method === 'POST') {
    if (!isAuthorized(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    alertsEnabled = !alertsEnabled;
    return res.status(200).json({ enabled: alertsEnabled });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
