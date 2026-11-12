// Real 404 for paths that used to exist. vercel.json rewrites removed pages
// here; without that they fall through to the app shell and answer 200.
// (Missing /api/* routes already 404 on their own.)
module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(404).json({ error: 'Not found' });
};
