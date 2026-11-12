// The submissions row is built by src/submissionRow.js and saved by
// api/analyze.js with the service key. The browser no longer inserts.

const test = require('node:test');
const assert = require('node:assert');

process.env.REACT_APP_SUPABASE_URL = 'https://db.example';
process.env.SUPABASE_SERVICE_KEY = 'service-key';
process.env.ANTHROPIC_API_KEY = 'anthropic-key';
delete process.env.RECAPTCHA_SECRET_KEY;

const { resolveCategory, resolveSource, buildSubmissionRow } = require('../src/submissionRow');
const analyze = require('../api/analyze');
const rateLimit = require('../api/_utils/rateLimit');
rateLimit.setRateLimitStore(rateLimit.createMemoryStore());
const recaptcha = require('../api/_utils/recaptcha');
const feedback = require('../api/submit-feedback');

const UUID = '3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const VERDICT = {
  score: 87, tags: ['phishing', 'urgency'], summary: 'Fake parcel fee notice.', detectedCategory: 'delivery',
  categoryReclassified: false, detectedSources: ['+1 555 010 0199', 'https://evil.example', 'scam@evil.example'],
  shows_ai_patterns: true, impersonated_brand: 'USPS', extracted_iocs: ['evil.example'], vector: 'sms',
};

function res() { const r = { code: null, body: null, headers: {} }; r.status = c => { r.code = c; return r; }; r.json = b => { r.body = b; return r; }; r.setHeader = (k, v) => { r.headers[k] = v; }; return r; }
function reply(data, ok = true, status) { return { ok, status: status || (ok ? 200 : 500), json: async () => data, text: async () => JSON.stringify(data) }; }

// ── Row builder ────────────────────────────────────────────────────────────────

test('category: "other" adopts the detected category; a specific pick changes only on reclassification', () => {
  assert.deepStrictEqual(resolveCategory('other', { detectedCategory: 'delivery' }), { finalCategory: 'delivery', classificationNote: 'auto' });
  assert.deepStrictEqual(resolveCategory('finance', { detectedCategory: 'delivery' }), { finalCategory: 'finance', classificationNote: null });
  assert.deepStrictEqual(resolveCategory('finance', { detectedCategory: 'delivery', categoryReclassified: true }), { finalCategory: 'delivery', classificationNote: 'reclassified' });
  assert.deepStrictEqual(resolveCategory('finance', {}), { finalCategory: 'finance', classificationNote: null });
});

test('source keeps phone numbers and emails only, max three, deduplicated', () => {
  assert.strictEqual(resolveSource('', VERDICT), JSON.stringify(['+1 555 010 0199', 'scam@evil.example']));
  assert.strictEqual(resolveSource('a@b.c', { detectedSources: ['a@b.c', 'x@y.z', '5550100000', '5550100001'] }), JSON.stringify(['a@b.c', 'x@y.z', '5550100000']));
  assert.strictEqual(resolveSource('hello', { detectedSources: ['https://u.example'] }), 'user-submitted');
});

test('public row: preview truncated to 80 chars, score from the verdict, flags and metadata set', () => {
  const text = 'x'.repeat(100);
  const row = buildSubmissionRow({ parsed: { ...VERDICT, urlhausFlagged: true }, input: { category: 'other', text, source: '', visibility: 'public', deliveryChannel: 'sms', ipqs: { type: 'phone' } } });
  assert.strictEqual(row.preview, 'x'.repeat(80) + '...');
  assert.strictEqual(row.score, 87);
  assert.strictEqual(row.category, 'delivery');
  assert.strictEqual(row.classification_note, 'auto');
  assert.strictEqual(row.visibility, 'public');
  assert.strictEqual(row.urlhaus_flagged, true);
  assert.strictEqual(row.gsb_flagged, false);
  assert.strictEqual(row.delivery_channel, 'sms');
  assert.deepStrictEqual(row.radar_metadata, { shows_ai_patterns: true, impersonated_brand: 'USPS', extracted_iocs: ['evil.example'], vector: 'sms', ipqs: { type: 'phone' } });
  assert.ok(!('id' in row) && !('created_at' in row), 'the database assigns id and created_at');
});

test('anonymous row stores no preview, source or summary', () => {
  const row = buildSubmissionRow({ parsed: VERDICT, input: { category: 'delivery', text: 'my name is Jo', visibility: 'anonymous' } });
  assert.strictEqual(row.preview, null);
  assert.strictEqual(row.source, null);
  assert.strictEqual(row.summary, null);
  assert.strictEqual(row.visibility, 'anonymous');
});

test('screenshot-only submissions get a placeholder preview', () => {
  const row = buildSubmissionRow({ parsed: VERDICT, input: { category: 'delivery', text: '  ', hasImage: true, visibility: 'public' } });
  assert.strictEqual(row.preview, '[Screenshot submitted]');
});

test('score is clamped to 0–100 and rounded; no usable score means no row', () => {
  assert.strictEqual(buildSubmissionRow({ parsed: { score: 140 }, input: {} }).score, 100);
  assert.strictEqual(buildSubmissionRow({ parsed: { score: -3 }, input: {} }).score, 0);
  assert.strictEqual(buildSubmissionRow({ parsed: { score: 44.6 }, input: {} }).score, 45);
  assert.strictEqual(buildSubmissionRow({ parsed: { score: 'high' }, input: {} }), null);
  assert.strictEqual(buildSubmissionRow({ parsed: {}, input: {} }), null);
  assert.strictEqual(buildSubmissionRow({ parsed: null, input: {} }), null);
});

test('unknown visibility falls back to private, never public', () => {
  assert.strictEqual(buildSubmissionRow({ parsed: VERDICT, input: { visibility: 'everyone' } }).visibility, 'private');
  assert.strictEqual(buildSubmissionRow({ parsed: VERDICT, input: {} }).visibility, 'private');
});

// ── /api/analyze save path ─────────────────────────────────────────────────────

function stubAnalyze(t, { insertOk = true, verdict = VERDICT } = {}) {
  const calls = [];
  t.mock.method(recaptcha, 'verifyRecaptcha', async () => ({ ok: true, score: 0.9 }));
  t.mock.method(globalThis, 'fetch', async (url, opts) => {
    url = String(url); calls.push({ url, opts });
    if (url.includes('api.anthropic.com')) return reply({ model: 'claude-sonnet-4-6', content: [{ type: 'text', text: JSON.stringify(verdict) }], usage: { input_tokens: 1, output_tokens: 1 } });
    if (url.includes('/rest/v1/submissions')) {
      const row = JSON.parse(opts.body);
      return insertOk ? reply([{ ...row, id: UUID, created_at: '2026-11-12T00:00:00Z' }], true, 201) : reply({ code: '42501' }, false, 401);
    }
    return reply({}); // usage log and anything else
  });
  return calls;
}
const FORM = (extra = {}) => ({
  method: 'POST', headers: { 'x-forwarded-for': `10.0.0.${Math.floor(Math.random() * 250)}` }, connection: {},
  body: { text: 'Your parcel is held, pay $1.99', category: 'other', visibility: 'public', deliveryChannel: 'sms', ipqs: null, source: '', recaptchaToken: 'tok', ...extra },
});

test('analyze: a form submission is saved with the service key and the stored row is returned', async (t) => {
  const calls = stubAnalyze(t);
  const r = res();
  await analyze(FORM(), r);
  assert.strictEqual(r.code, 200);
  assert.strictEqual(r.body.submission.id, UUID, 'the client gets the case id for the feedback widget');
  const insert = calls.find(c => c.url.endsWith('/rest/v1/submissions'));
  assert.ok(insert, 'one insert');
  assert.strictEqual(insert.opts.headers.apikey, 'service-key');
  assert.strictEqual(insert.opts.headers.Prefer, 'return=representation');
  const row = JSON.parse(insert.opts.body);
  assert.strictEqual(row.score, 87);
  assert.strictEqual(row.category, 'delivery');
  assert.strictEqual(row.preview, 'Your parcel is held, pay $1.99');
});

test('analyze: the Claude request carries only model, max_tokens, system and messages', async (t) => {
  const calls = stubAnalyze(t);
  await analyze(FORM({ trainAI: false }), res());
  const claude = JSON.parse(calls.find(c => c.url.includes('api.anthropic.com')).opts.body);
  assert.deepStrictEqual(Object.keys(claude).sort(), ['max_tokens', 'messages', 'model', 'system']);
});

test('analyze: dryRun requests (dev dashboard pings) never insert', async (t) => {
  const calls = stubAnalyze(t);
  const r = res();
  await analyze(FORM({ dryRun: true }), r);
  assert.strictEqual(r.code, 200);
  assert.strictEqual(r.body.submission, null);
  assert.ok(!calls.some(c => c.url.includes('/rest/v1/submissions')));
});

test('analyze: a failed save still returns the verdict, with submission null', async (t) => {
  stubAnalyze(t, { insertOk: false });
  const r = res();
  await analyze(FORM(), r);
  assert.strictEqual(r.code, 200);
  assert.strictEqual(r.body.submission, null);
  assert.ok(r.body.content, 'verdict still delivered');
});

test('analyze: an invented category id is stored as "other"', async (t) => {
  const calls = stubAnalyze(t, { verdict: { ...VERDICT, detectedCategory: 'Suspicious Educational Domain' } });
  await analyze(FORM(), res());
  assert.strictEqual(JSON.parse(calls.find(c => c.url.endsWith('/rest/v1/submissions')).opts.body).category, 'other');
});

test('analyze: a verdict without a score is not stored', async (t) => {
  const calls = stubAnalyze(t, { verdict: { tags: [] } });
  const r = res();
  await analyze(FORM(), r);
  assert.strictEqual(r.body.submission, null);
  assert.ok(!calls.some(c => c.url.includes('/rest/v1/submissions')));
});

// ── /api/submit-feedback ───────────────────────────────────────────────────────

test('feedback: PATCH only sends columns that exist on submissions', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, opts) => { calls.push({ url: String(url), opts }); return reply(null); });
  const r = res();
  await feedback({ method: 'POST', body: { caseId: UUID, is_accurate: true, feedbackText: 'spot on' } }, r);
  assert.strictEqual(r.code, 200);
  const patch = calls.find(c => c.url.includes(`/rest/v1/submissions?id=eq.${UUID}`));
  assert.deepStrictEqual(Object.keys(JSON.parse(patch.opts.body)).sort(), ['is_accurate', 'user_feedback']);
});
