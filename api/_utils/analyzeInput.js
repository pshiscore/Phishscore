// The /api/analyze request contract. The client sends ONLY the user's content;
// the server builds the Anthropic request (lib/analyze-prompt.js). Any
// Anthropic field a caller adds — system, messages, model, max_tokens, tools,
// tool_choice, temperature, stream, metadata, … — is never read: validation
// copies the known fields below into a fresh object and nothing else survives.

const { CATEGORY_IDS } = require('../../lib/categories');

const MAX_TEXT_CHARS = 12000;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;   // decoded; the client sends a ≤1200px JPEG
const MAX_SOURCE_CHARS = 200;
const MAX_IPQS_JSON_CHARS = 8000;
const MAX_RECAPTCHA_TOKEN_CHARS = 4000;

const VISIBILITIES = ['public', 'private', 'anonymous'];
const DELIVERY_CHANNELS = ['email', 'sms', 'social', 'other'];
const IPQS_TYPES = ['email', 'phone', 'url', 'unknown'];

// Leading bytes of each allowed image type, so a declared type must match the data.
const IMAGE_SIGNATURES = {
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/png':  [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  'image/gif':  [[0x47, 0x49, 0x46, 0x38]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // "RIFF" … "WEBP" checked below
};
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

function fail(error) { return { ok: false, error }; }
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function validateImage(image) {
  if (image === undefined || image === null) return { ok: true, value: null };
  if (!isPlainObject(image)) return fail('image must be an object with data and mediaType');
  const { data, mediaType } = image;
  if (!Object.prototype.hasOwnProperty.call(IMAGE_SIGNATURES, mediaType)) return fail('image.mediaType must be image/jpeg, image/png, image/gif or image/webp');
  if (typeof data !== 'string' || data.length === 0) return fail('image.data must be base64');
  // Cheap size bound before decoding: 4 base64 chars encode 3 bytes.
  if (Math.floor(data.length * 3 / 4) > MAX_IMAGE_BYTES + 2) return fail(`image is larger than ${MAX_IMAGE_BYTES / (1024 * 1024)} MB`);
  if (data.length % 4 !== 0 || !BASE64_RE.test(data)) return fail('image.data must be base64');
  const bytes = Buffer.from(data, 'base64');
  if (bytes.length > MAX_IMAGE_BYTES) return fail(`image is larger than ${MAX_IMAGE_BYTES / (1024 * 1024)} MB`);
  const matches = IMAGE_SIGNATURES[mediaType].some(sig => sig.every((b, i) => bytes[i] === b));
  const webpOk = mediaType !== 'image/webp' || bytes.slice(8, 12).toString('latin1') === 'WEBP';
  if (!matches || !webpOk) return fail('image.data does not match image.mediaType');
  return { ok: true, value: { data, mediaType } };
}

function validateIpqs(ipqs) {
  if (ipqs === undefined || ipqs === null) return { ok: true, value: null };
  if (!isPlainObject(ipqs)) return fail('ipqs must be an object or null');
  if (ipqs.type !== undefined && !IPQS_TYPES.includes(ipqs.type)) return fail('ipqs.type is not recognised');
  if (ipqs.data !== undefined && ipqs.data !== null && !isPlainObject(ipqs.data)) return fail('ipqs.data must be an object');
  let json;
  try { json = JSON.stringify(ipqs); } catch { return fail('ipqs is not serialisable'); }
  if (json.length > MAX_IPQS_JSON_CHARS) return fail('ipqs is too large');
  return { ok: true, value: JSON.parse(json) };
}

// Returns { ok: true, value } with exactly the fields the server uses, or
// { ok: false, error } for a 400.
function validateAnalyzeInput(body) {
  if (!isPlainObject(body)) return fail('request body must be a JSON object');

  const text = body.text === undefined || body.text === null ? '' : body.text;
  if (typeof text !== 'string') return fail('text must be a string');
  if (text.length > MAX_TEXT_CHARS) return fail(`text is longer than ${MAX_TEXT_CHARS} characters`);

  const image = validateImage(body.image);
  if (!image.ok) return image;
  if (!text.trim() && !image.value) return fail('text or image is required');

  if (!CATEGORY_IDS.includes(body.category)) return fail('category is not recognised');
  if (!VISIBILITIES.includes(body.visibility)) return fail('visibility must be public, private or anonymous');
  if (!DELIVERY_CHANNELS.includes(body.deliveryChannel)) return fail('deliveryChannel must be email, sms, social or other');

  const source = body.source === undefined || body.source === null ? '' : body.source;
  if (typeof source !== 'string') return fail('source must be a string');
  if (source.length > MAX_SOURCE_CHARS) return fail(`source is longer than ${MAX_SOURCE_CHARS} characters`);

  for (const k of ['trainAI', 'isAnonymous', 'dryRun']) {
    if (body[k] !== undefined && typeof body[k] !== 'boolean') return fail(`${k} must be a boolean`);
  }
  // isAnonymous is derived from visibility; a contradicting value is a client bug.
  const isAnonymous = body.visibility === 'anonymous';
  if (body.isAnonymous !== undefined && body.isAnonymous !== isAnonymous) return fail('isAnonymous contradicts visibility');

  const token = body.recaptchaToken;
  if (token !== undefined && token !== null && (typeof token !== 'string' || token.length > MAX_RECAPTCHA_TOKEN_CHARS)) return fail('recaptchaToken must be a string');

  const ipqs = validateIpqs(body.ipqs);
  if (!ipqs.ok) return ipqs;

  return {
    ok: true,
    value: {
      text, image: image.value, category: body.category, source,
      visibility: body.visibility, isAnonymous, deliveryChannel: body.deliveryChannel,
      trainAI: body.trainAI === true, dryRun: body.dryRun === true,
      recaptchaToken: typeof token === 'string' ? token : null,
      ipqs: ipqs.value,
    },
  };
}

module.exports = {
  validateAnalyzeInput,
  MAX_TEXT_CHARS, MAX_IMAGE_BYTES, MAX_SOURCE_CHARS, VISIBILITIES, DELIVERY_CHANNELS,
};
