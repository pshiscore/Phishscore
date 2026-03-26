module.exports = async function handler(req, res) {
  return res.status(200).json({ received: true });
};
module.exports.config = { api: { bodyParser: false } };
