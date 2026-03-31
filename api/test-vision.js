const { getAccessToken } = require('./lib/google-auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageBase64, imageUrl } = req.body;
  if (!imageBase64 && !imageUrl) return res.status(400).json({ error: 'imageBase64 or imageUrl required' });

  try {
    const token = await getAccessToken();

    const imageSource = imageBase64
      ? { content: imageBase64 }
      : { source: { imageUri: imageUrl } };

    const r = await fetch('https://vision.googleapis.com/v1/images:annotate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [{
          image: imageSource,
          features: [
            { type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 },
            { type: 'LOGO_DETECTION', maxResults: 5 },
            { type: 'SAFE_SEARCH_DETECTION', maxResults: 1 },
          ]
        }]
      })
    });

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return res.status(200).json({ error: `Vision API error ${r.status}: ${JSON.stringify(err)}` });
    }

    const data = await r.json();
    const result = data.responses?.[0];
    if (!result) return res.status(200).json({ error: 'No response from Vision API' });

    const ocrText = result.fullTextAnnotation?.text || result.textAnnotations?.[0]?.description || '';
    const logos = (result.logoAnnotations || []).map(l => ({ description: l.description, score: Math.round((l.score || 0) * 100) }));
    const safeSearch = result.safeSearchAnnotation || null;

    return res.status(200).json({
      ocr: {
        text: ocrText.slice(0, 500),
        charCount: ocrText.length,
      },
      logos,
      safeSearch,
    });
  } catch (err) {
    return res.status(200).json({ error: err.message });
  }
};

module.exports.config = { api: { bodyParser: { sizeLimit: '10mb' } } };
