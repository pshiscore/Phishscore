module.exports = async function handler(req, res) {
  return res.status(503).json({ 
    error: 'payments_unavailable',
    message: 'Payment processing is temporarily unavailable. Please contact contact@phishscore.ai for manual investigation.'
  });
};
