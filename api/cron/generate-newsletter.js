module.exports.config = { maxDuration: 60 };

// Disabled: this job's only output was an email dispatch via Resend, which has
// been disconnected. Left as a stub in case newsletter generation is revived
// with a different delivery mechanism (e.g. an on-site newsletter archive).
module.exports = async function handler(req, res) {
  return res.status(410).json({ error: 'Newsletter generation is disabled.' });
};
