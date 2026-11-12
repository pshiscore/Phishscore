// The Analyze Threat scoring prompt — server-side only.
//
// This used to be assembled in the browser (SubmitModal.jsx) and sent to
// /api/analyze, which forwarded whatever system prompt, messages, model and
// max_tokens the caller supplied, making the endpoint an open Claude proxy.
// The server now owns the prompt, the message layout, the model and the token
// budget; the client sends only the user's content.

const { CATEGORY_IDS } = require('./categories');

const MAX_TOKENS = 1000;

const categoryList = "publishing, delivery, retail, telecom, voip, traffic, social, finance, government, prize, romance, job, tech, political, travel, legal, health, other";
const jsonSchema = `{"score":<0-100>,"tags":[<2-4 labels>],"summary":"<ONE plain-English sentence describing what this scam is and how it operates, written for a community feed — no raw email fields, no technical jargon>","verdict":"<one sentence>","analysis":"<2-3 sentences>","redFlags":[<up to 5>],"whatToDo":"<one action sentence — NEVER include any URLs, domain names, or web addresses of any kind, not even official ones. Say 'go to the official website' or 'contact your bank directly' instead>","detectedSources":["<only phone numbers with country code if present, and sender email addresses — nothing else, empty array if none found>"],"detectedCategory":<best category id string or null>,"categoryReclassified":<true if user category was wrong, false otherwise>,"shows_ai_patterns":<true if the content shows signs of AI-generated text such as unnatural fluency, templated structure, or LLM-style phrasing; false otherwise>,"impersonated_brand":"<the primary brand/org being impersonated, e.g. 'USPS', 'Chase Bank', 'IRS', 'Apple'; null if none>","extracted_iocs":["<suspicious domains, URLs, or IPs found in the content — empty array if none>"],"vector":"<primary delivery vector: email | sms | social | phone | web | other>"}`;
// Static system prompt — identical for every request, so it is cached.
const staticSystem = `You are PhishScore.ai. Analyze submitted content for scam indicators and return only valid JSON.\n\nIMPORTANT TASKS:\n1. Extract ONLY phone numbers (with country code if visible) and sender email addresses. Do NOT extract domains, URLs, names, usernames, or any other identifiers.\n2. If the user selected "other", determine the best category from: ${categoryList}. Return it in detectedCategory if 70%+ confident, else null.\n3. If the user selected a specific category but the content clearly belongs to a DIFFERENT category with 85%+ confidence, return the correct category in detectedCategory and set categoryReclassified to true.\n4. For category "health": apply relevant sub-tags from — "Fake Research Claims", "Miracle Cure / Panacea", "Medical Fear-mongering", "Counterfeit Pharmaceuticals".\n5. For category distinction: use "voip" when the content involves a scam call or message originating from a VOIP/internet-based phone number, robocall, or spoofed caller ID. Use "telecom" for carrier impersonation scams (e.g. fake T-Mobile reward emails). The IPQS pre-score may indicate VOIP line type — factor that in.\n6. For radar fields: shows_ai_patterns should be true if the text feels LLM-generated; impersonated_brand should be the exact brand name impersonated or null; extracted_iocs should list any suspicious domains or IPs visible in the content; vector should be the delivery channel the scam arrived through.\n\nRespond ONLY with valid JSON (no markdown):\n${jsonSchema}`;

// Label and description per category id, as shown in the submit form.
// test/analyze-contract.test.js asserts these match src/constants.js.
const CATEGORY_CONTEXT = {
  publishing: { label: "Publishing & Literary", description: "Fake agents, vanity presses, contest mills" },
  delivery: { label: "Package & Delivery", description: "FedEx, UPS, USPS, DHL fake notices" },
  retail: { label: "Retail & Shopping", description: "Amazon, eBay, online store scams" },
  telecom: { label: "Phone & Telecom", description: "T-Mobile, Verizon, AT&T points/rewards scams" },
  voip: { label: "VOIP Fraud", description: "Scam calls from VOIP lines, spoofed numbers, robocall fraud" },
  traffic: { label: "Traffic & Tolls", description: "Fake speeding tickets, toll violations, parking" },
  social: { label: "Social Media", description: "Instagram, Facebook, TikTok, Twitter scams" },
  finance: { label: "Banking & Finance", description: "Bank alerts, crypto, investment scams" },
  government: { label: "Government & IRS", description: "IRS, Social Security, Medicare, DMV" },
  prize: { label: "Prize & Lottery", description: "You've won!, sweepstakes, gift cards" },
  romance: { label: "Romance & Friendship", description: "Dating app scams, fake relationships" },
  job: { label: "Job & Employment", description: "Fake job offers, work from home, pyramid schemes" },
  tech: { label: "Tech Support", description: "Microsoft, Apple, virus alerts, fake support" },
  political: { label: "Political Campaign", description: "Fake fundraising, candidate impersonation, polling scams" },
  travel: { label: "Travel & Vacation", description: "Fake hotels, airline scams, vacation rental fraud, bogus travel deals" },
  legal: { label: "Legal & Compliance", description: "Fake court notices, debt collection scams, fake legal threats, compliance impersonation" },
  health: { label: "Health Scams", description: "Fake cures, miracle treatments, counterfeit pharmaceuticals, medical fear-mongering" },
  other: { label: "Unknown / AI Detect", description: "Don't know the type? AI will automatically detect and classify your submission" },
};

// Builds the exact Anthropic request body for one submission.
// input: validated { text, image: { data, mediaType } | null, category }
function buildScoringRequest({ text, image, category }) {
  const content = [];
  if (image) content.push({ type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.data } });
  if (text && text.trim()) content.push({ type: 'text', text: `User Message:\n${text}` });
  const cat = CATEGORY_CONTEXT[category] || CATEGORY_CONTEXT.other;
  // Per-request context appended as volatile user content
  content.push({ type: 'text', text: `User selected category: "${cat.label}" (id: "${category}") - ${cat.description}` });
  return {
    max_tokens: MAX_TOKENS,
    system: [{ type: 'text', text: staticSystem, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content }],
  };
}

module.exports = { MAX_TOKENS, categoryList, jsonSchema, staticSystem, CATEGORY_CONTEXT, buildScoringRequest };

// Keep the category list in the prompt in sync with the canonical ids.
if (categoryList.split(', ').join() !== CATEGORY_IDS.join()) {
  throw new Error('lib/analyze-prompt.js: categoryList drifted from lib/categories.js');
}
