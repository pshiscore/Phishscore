
const { authorizeSession } = require('./_utils/cronAuth');

// In-memory state — resets on cold start (maintenance mode is never "stuck on")
let maintenanceOn = false;

function isAuthorized(req) {
  // The /devs session cookie, validated by the shared gate in api/_utils/cronAuth.js.
  return authorizeSession(req).ok;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'GET') {
    return res.status(200).json({ maintenance: maintenanceOn });
  }

  if (req.method === 'POST') {
    if (!isAuthorized(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    maintenanceOn = !maintenanceOn;
    return res.status(200).json({ maintenance: maintenanceOn });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
