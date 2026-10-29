// Tests for src/score-bands.js — the shared band definition.
//
// Before this module, the Quick Scan prompt called 21-50 "suspicious" while the
// UI rendered the same score as "LOW RISK": a full band apart. The complainant's
// 35/100 was described as suspicious by the scorer and low-risk by the interface
// at the same time. These tests keep the two from drifting again.

const test = require('node:test');
const assert = require('node:assert');
const { SCORE_BANDS, getScoreBand, getScoreLabel, describeScoreBands } = require('../src/score-bands');

test('bands cover 0-100 with no gaps and no overlaps', () => {
  const asc = SCORE_BANDS.slice().sort((a, b) => a.min - b.min);
  assert.strictEqual(asc[0].min, 0);
  assert.strictEqual(asc[asc.length - 1].max, 100);
  for (let i = 1; i < asc.length; i++) {
    assert.strictEqual(asc[i].min, asc[i - 1].max + 1,
      `gap or overlap between ${asc[i - 1].label} and ${asc[i].label}`);
  }
});

test('every score 0-100 maps to exactly one band', () => {
  for (let s = 0; s <= 100; s++) {
    const matches = SCORE_BANDS.filter(b => s >= b.min && s <= b.max);
    assert.strictEqual(matches.length, 1, `score ${s} matched ${matches.length} bands`);
    assert.strictEqual(getScoreBand(s).label, matches[0].label);
  }
});

test('boundary scores land in the right band', () => {
  for (const [score, label] of [
    [0, 'LIKELY SAFE'], [20, 'LIKELY SAFE'],
    [21, 'SUSPICIOUS'], [50, 'SUSPICIOUS'],
    [51, 'LIKELY THREAT'], [75, 'LIKELY THREAT'],
    [76, 'HIGH RISK'], [100, 'HIGH RISK'],
  ]) {
    assert.strictEqual(getScoreLabel(score), label, `score ${score}`);
  }
});

test('the complained-about scores are no longer labelled "low risk"', () => {
  // 35 is what the user saw; 40 is what the scan returns today.
  for (const score of [35, 40]) {
    assert.strictEqual(getScoreLabel(score), 'SUSPICIOUS');
  }
});

test('the prompt description matches the band table exactly', () => {
  const text = describeScoreBands();
  for (const b of SCORE_BANDS) {
    assert.ok(text.includes(`${b.min}-${b.max}`), `missing range for ${b.label}`);
    assert.ok(text.includes(b.promptLabel), `missing prompt label ${b.promptLabel}`);
    // The model must be told the user-facing wording, so the two cannot diverge.
    assert.ok(text.includes(`"${b.label}"`), `missing UI label ${b.label}`);
  }
});

test('out-of-range and malformed scores degrade to the safe band', () => {
  for (const bad of [null, undefined, NaN, 'abc', {}]) {
    assert.strictEqual(getScoreLabel(bad), 'LIKELY SAFE', `input ${JSON.stringify(bad)}`);
  }
});
