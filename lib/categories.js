// Canonical scam-category ids, shared by the Quick Scan prompt and the
// dashboard normalizer.
//
// The model previously emitted free-text labels ("Suspicious Educational
// Domain"), and api/get-quick-scans.js slugified anything it could not pattern
// match — producing ids like `suspicious_educational_domain` that exist in no
// category list, so those scans silently vanished from dashboard counts.
// Constraining the model to this list is the fix; the pattern matcher stays as
// a fallback for historical rows written before the constraint.

const CATEGORY_IDS = [
  'publishing', 'delivery', 'retail', 'telecom', 'voip', 'traffic', 'social',
  'finance', 'government', 'prize', 'romance', 'job', 'tech', 'political',
  'travel', 'legal', 'health', 'other',
];

// Shown to the model so it picks an id rather than inventing prose.
const CATEGORY_GUIDE = [
  'publishing — fake literary agents, vanity presses, contest mills',
  'delivery — FedEx/UPS/USPS/DHL package notices',
  'retail — Amazon, eBay, online store scams',
  'telecom — carrier/rewards/points scams',
  'voip — scam calls from VOIP lines, spoofed numbers, robocalls',
  'traffic — tolls, speeding tickets, parking fines',
  'social — Instagram, Facebook, TikTok, X scams',
  'finance — banking, crypto, investment fraud',
  'government — IRS, Social Security, Medicare, DMV',
  'prize — lotteries, sweepstakes, gift cards',
  'romance — dating and relationship scams',
  'job — fake job offers, work-from-home, pyramid schemes',
  'tech — fake Microsoft/Apple support, virus alerts',
  'political — fake fundraising, candidate impersonation',
  'travel — fake hotels, airlines, vacation rentals',
  'legal — fake court notices, debt collection, legal threats',
  'health — fake cures, counterfeit pharma, medical fear-mongering',
  'other — nothing above fits, or there is too little signal to classify',
].join('\n');

const isValidCategoryId = (id) => CATEGORY_IDS.includes(id);

// Accepts the model's output and guarantees a valid id.
function coerceCategoryId(value) {
  if (typeof value !== 'string') return 'other';
  const id = value.trim().toLowerCase();
  return isValidCategoryId(id) ? id : 'other';
}

module.exports = { CATEGORY_IDS, CATEGORY_GUIDE, isValidCategoryId, coerceCategoryId };
