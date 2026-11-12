// The submissions row for an Analyze Threat result, built in ONE place.
//
// The browser used to assemble this row and insert it with the anon key. The
// insert now happens in api/analyze.js with the service key (so anon INSERT and
// SELECT on submissions can be revoked); the server requires this module to
// build the stored row, and SubmitModal imports it to show the same category
// and to keep a display-only row in the feed if the save fails.
//
// CommonJS so node --test and the Vercel function can require it; CRA imports
// it fine (same pattern as src/reportPhase.js).

const VISIBILITIES = ['public', 'private', 'anonymous'];
const PREVIEW_CHARS = 80;
const MAX_SOURCES = 3;

// Same rule the result screen has always applied: an "other" pick adopts the
// model's category; a specific pick is replaced only when the model says so.
function resolveCategory(selected, parsed = {}) {
  const detected = parsed.detectedCategory;
  if (detected && detected !== selected) {
    if (selected === 'other') return { finalCategory: detected, classificationNote: 'auto' };
    if (parsed.categoryReclassified === true) return { finalCategory: detected, classificationNote: 'reclassified' };
  }
  return { finalCategory: selected, classificationNote: null };
}

function isPhoneOrEmail(val) {
  if (!val || typeof val !== 'string' || !val.trim()) return false;
  const v = val.trim();
  return /^[+\d\s\-()]{7,}$/.test(v) || v.includes('@');
}

// Phone numbers and email addresses only — never URLs or free text.
function resolveSource(sourceInput, parsed = {}) {
  const all = [];
  if (isPhoneOrEmail(sourceInput)) all.push(sourceInput.trim());
  if (Array.isArray(parsed.detectedSources)) {
    for (const s of parsed.detectedSources) {
      if (isPhoneOrEmail(s) && !all.includes(s.trim())) all.push(s.trim());
    }
  }
  return all.length > 0 ? JSON.stringify(all.slice(0, MAX_SOURCES)) : 'user-submitted';
}

function previewOf(text) {
  const t = typeof text === 'string' ? text : '';
  return t.slice(0, PREVIEW_CHARS) + (t.length > PREVIEW_CHARS ? '...' : '');
}

// parsed: the model's JSON verdict. input: what the user submitted.
// Returns null when the verdict has no usable score — such a row could never
// satisfy the 0–100 range and must not be stored.
function buildSubmissionRow({ parsed, input = {} }) {
  if (!parsed || typeof parsed !== 'object') return null;
  const score = Number(parsed.score);
  if (!Number.isFinite(score)) return null;

  const visibility = VISIBILITIES.includes(input.visibility) ? input.visibility : 'private';
  const isAnon = visibility === 'anonymous';
  const text = input.hasImage && !(input.text || '').trim() ? '[Screenshot submitted]' : (input.text || '');
  const { finalCategory, classificationNote } = resolveCategory(input.category || 'other', parsed);
  const deliveryChannel = typeof input.deliveryChannel === 'string' && input.deliveryChannel ? input.deliveryChannel.slice(0, 32) : 'other';

  return {
    category: finalCategory,
    source: isAnon ? null : resolveSource(input.source, parsed),
    summary: isAnon ? null : (typeof parsed.summary === 'string' ? parsed.summary : null),
    preview: isAnon ? null : previewOf(text),
    score: Math.max(0, Math.min(100, Math.round(score))),
    tags: Array.isArray(parsed.tags) ? parsed.tags.filter(t => typeof t === 'string') : [],
    visibility,
    classification_note: classificationNote,
    gsb_flagged: parsed.safeBrowsingFlagged === true,
    radar_flagged: parsed.radarFlagged === true,
    urlhaus_flagged: parsed.urlhausFlagged === true,
    // First-class submission field, not gated behind train_ai.
    delivery_channel: deliveryChannel,
    radar_metadata: {
      shows_ai_patterns: parsed.shows_ai_patterns ?? null,
      impersonated_brand: parsed.impersonated_brand ?? null,
      extracted_iocs: Array.isArray(parsed.extracted_iocs) ? parsed.extracted_iocs : [],
      vector: parsed.vector ?? deliveryChannel,
      ipqs: input.ipqs ?? null,
    },
  };
}

module.exports = { VISIBILITIES, resolveCategory, resolveSource, previewOf, buildSubmissionRow };
