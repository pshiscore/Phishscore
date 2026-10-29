// Tests for lib/categories.js — the canonical category constraint.
//
// Before this, the model emitted free-text labels and api/get-quick-scans.js
// slugified anything its patterns missed, producing ids like
// `suspicious_educational_domain` that exist in no category list. 54 of 147
// stored scans (37%) mapped to such ids and vanished from dashboard counts.

const test = require('node:test');
const assert = require('node:assert');
const { CATEGORY_IDS, CATEGORY_GUIDE, isValidCategoryId, coerceCategoryId } = require('../lib/categories');

test('ids match the SCAM_CATEGORIES list in src/constants.js', () => {
  const constants = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'src', 'constants.js'), 'utf8');
  const block = constants.slice(constants.indexOf('SCAM_CATEGORIES'), constants.indexOf('VISIBILITY_OPTIONS'));
  const fromConstants = [...block.matchAll(/\{\s*id:\s*"([a-z]+)"/g)].map(m => m[1]);
  assert.deepStrictEqual(CATEGORY_IDS.slice().sort(), fromConstants.slice().sort(),
    'lib/categories.js and src/constants.js have drifted apart');
});

test('every id appears in the guide shown to the model', () => {
  for (const id of CATEGORY_IDS) {
    assert.ok(new RegExp(`^${id} —`, 'm').test(CATEGORY_GUIDE), `guide is missing ${id}`);
  }
});

test('free-text labels are coerced to "other", never slugified', () => {
  // These are real ai_category values from the stored scans.
  for (const label of [
    'Suspicious Educational Domain', 'Unverified Phone Number', 'Insufficient Signal',
    'No Threat Detected', 'Legitimate Business Domain', 'Suspicious Activity',
  ]) {
    const id = coerceCategoryId(label);
    assert.strictEqual(id, 'other', `${label} should fall back to "other"`);
    assert.ok(isValidCategoryId(id), 'result must always be a valid id');
    assert.ok(!id.includes('_'), 'must never produce a slug');
  }
});

test('valid ids pass through, case-insensitively', () => {
  for (const id of CATEGORY_IDS) {
    assert.strictEqual(coerceCategoryId(id), id);
    assert.strictEqual(coerceCategoryId(id.toUpperCase()), id);
    assert.strictEqual(coerceCategoryId(`  ${id}  `), id);
  }
});

test('malformed input always yields a valid id', () => {
  for (const bad of [null, undefined, '', '   ', 42, {}, [], true]) {
    const id = coerceCategoryId(bad);
    assert.strictEqual(id, 'other', `input ${JSON.stringify(bad)}`);
    assert.ok(isValidCategoryId(id));
  }
});

test('isValidCategoryId rejects slugs produced by the old normalizer', () => {
  for (const slug of ['suspicious_educational_domain', 'unverified_phone_number', 'scam']) {
    assert.strictEqual(isValidCategoryId(slug), false, `${slug} must not be treated as valid`);
  }
});
