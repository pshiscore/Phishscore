// The code has to match what the privacy policy and the UI promise
// (2026-11-14): no visitor input in server logs, nothing identifying on
// anonymous rows, no message text in training data, public summaries only to
// Google Natural Language, unlisted Cloudflare scans, one copy of the policy.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const { dbError, safeError } = require('../api/_utils/safeLog');

// ── A. logs ──────────────────────────────────────────────────────────────────

test('dbError keeps the code and message but drops details and quoted values', () => {
  const dup = JSON.stringify({ code: '23505', message: 'duplicate key value violates unique constraint "subscribers_email_key"', details: 'Key (email)=(someone@example.com) already exists.', hint: null });
  assert.strictEqual(dbError(dup), '23505 duplicate key value violates unique constraint "subscribers_email_key"');
  const bad = JSON.stringify({ code: '22P02', message: 'invalid input syntax for type uuid: "someone@example.com"' });
  assert.strictEqual(dbError(bad), '22P02 invalid input syntax for type uuid: <redacted>');
  assert.ok(!dbError(JSON.stringify({ code: '23514', message: 'violates check constraint "x"', details: 'Failing row contains (secret text)' })).includes('secret'));
  assert.strictEqual(dbError('<html>'), '(non-JSON error body)');
});

test('safeError reduces JSON parse errors to their type', () => {
  let e; try { JSON.parse('{"summary": "call +1 555 0100 now'); } catch (x) { e = x; }
  assert.strictEqual(safeError(e), 'SyntaxError: invalid JSON');
  assert.strictEqual(safeError(new Error('Claude error [500]')), 'Claude error [500]');
});

test('no server log line prints visitor input, report tokens or customer emails', () => {
  const files = require('node:child_process').execSync('git ls-files api lib', { cwd: ROOT }).toString().split('\n')
    .filter(f => f.endsWith('.js') && !f.startsWith('api/test-') && fs.existsSync(path.join(ROOT, f)));
  // Visitor input, secrets and raw upstream bodies (Supabase and Polar echo
  // submitted values) must not be logged; dbError()/safeError() are the way.
  const bad = /console\.(log|warn|error|info)\([^\n]*(, trimmed|, extracted\)|justDigits|report_token|customerEmail|\brawText\b|, domain,|URL=\$\{url\}|', JSON\.stringify\((caseRows|polarData)\)|, errorText\);|polarRes\.status, errText|response\.status, text\)|, await (res|res2|result|patchRes)\.text\(\)\);)/;
  const hits = [];
  for (const f of files) read(f).split('\n').forEach((l, i) => { if (bad.test(l)) hits.push(`${f}:${i + 1}: ${l.trim().slice(0, 120)}`); });
  assert.deepStrictEqual(hits, []);
});

// ── B. feed and trends ───────────────────────────────────────────────────────

test('the feed shows the AI summary only, never the raw message preview', () => {
  const app = read('src/App.js');
  assert.ok(!/s\.summary \|\| s\.preview/.test(app));
  assert.match(app, /const summaryText = s\.summary \|\| "Summary not available\.";/);
});

test('trends send only public summaries to Google Natural Language', () => {
  process.env.REACT_APP_SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || 'https://db.example';
  const { publicSummaries, config } = require('../api/generate-trends');
  const rows = [{ visibility: 'public', summary: 'a' }, { visibility: 'private', summary: 'b' }, { visibility: 'anonymous', summary: 'c' }, { visibility: 'public', summary: null }, null];
  assert.deepStrictEqual(publicSummaries(rows), ['a']);
  assert.match(read('api/generate-trends.js'), /submissions\?select=category,score,tags,summary,visibility&/);
  assert.deepStrictEqual(config, { maxDuration: 60 }, 'config survives module.exports = handler');
});

// ── C. anonymous rows ────────────────────────────────────────────────────────

test('anonymous rows keep no links, sender email or phone in metadata', () => {
  const { buildSubmissionRow } = require('../src/submissionRow');
  const parsed = { score: 90, tags: ['x'], summary: 's', extracted_iocs: ['http://evil.example'], detectedSources: ['+15550100'], impersonated_brand: 'USPS' };
  const ipqs = { type: 'email', input: 'sender@example.com', data: { fraud_score: 99 } };
  const anon = buildSubmissionRow({ parsed, input: { visibility: 'anonymous', isAnonymous: true, text: 'hello', ipqs } });
  assert.deepStrictEqual(anon.radar_metadata.extracted_iocs, []);
  assert.strictEqual(anon.radar_metadata.ipqs, null);
  assert.strictEqual(anon.source, null); assert.strictEqual(anon.preview, null); assert.strictEqual(anon.summary, null);
  assert.strictEqual(anon.radar_metadata.impersonated_brand, 'USPS');
  const priv = buildSubmissionRow({ parsed, input: { visibility: 'private', text: 'hello', ipqs } });
  assert.deepStrictEqual(priv.radar_metadata.extracted_iocs, ['http://evil.example']);
  assert.deepStrictEqual(priv.radar_metadata.ipqs, ipqs);
});

// ── D. training data ─────────────────────────────────────────────────────────

test('training rows store no message text and no extracted identifiers', () => {
  const { trainingAnalysis } = require('../api/analyze');
  const parsed = { score: 80, tags: ['t'], detectedSources: ['a@b.c'], extracted_iocs: ['evil.example'], redFlags: ['r'] };
  const out = trainingAnalysis(parsed);
  assert.ok(!('detectedSources' in out) && !('extracted_iocs' in out));
  assert.deepStrictEqual(out.redFlags, ['r']); assert.ok('detectedSources' in parsed, 'input not mutated');
  const src = read('api/analyze.js');
  assert.match(src, /original_text: null,/);
  assert.ok(!/rawText/.test(src), 'no message excerpt is passed to storeTrainingData');
});

// ── Cloudflare, legal pages, newsletter copy ─────────────────────────────────

test('Cloudflare Radar scans are unlisted', () => {
  const src = read('api/analyze.js');
  assert.match(src, /visibility: 'Unlisted'/); assert.ok(!/visibility: 'Public'/.test(src));
});

test('there is one copy of the policy: footer links go to the static pages', () => {
  assert.ok(!fs.existsSync(path.join(ROOT, 'src/components/LegalPage.jsx')));
  const app = read('src/App.js');
  assert.ok(!/LegalPage|showLegal|legalTab/.test(app));
  assert.match(app, /<a href="\/privacy\.html"[^>]*>PRIVACY<\/a>/);
  assert.match(app, /<a href="\/terms\.html"[^>]*>TERMS<\/a>/);
  assert.match(read('src/index.js'), /window\.location\.replace\(`\/\$\{legal\}\.html`\)/);
});

test('the newsletter box promises no email and credits the right model', () => {
  const news = read('src/components/NewsPanel.jsx');
  for (const phrase of ['Check your inbox', 'arrives next week', 'One email per week', 'Unsubscribe anytime', 'Cohere', 'zero-hallucination']) {
    assert.ok(!news.includes(phrase), phrase);
  }
  assert.match(news, /Anthropic's Claude summarizes articles from public security news sources/);
  assert.match(news, /const SHOW_WEEKLY_BRIEF = false;/, 'the box stays hidden');
});
