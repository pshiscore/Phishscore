// Tests for src/reportPhase.js — Deep Intel status derivation.

const test = require('node:test');
const assert = require('node:assert');
const { PHASE, MAX_REPORT_POLLS, deriveReportPhase, shouldPoll, shouldTriggerAnalysis } = require('../src/reportPhase');

const paidT1 = { tier: 1, payment_status: 'paid', report_generated_at: null };

test('no case data yet → loading; an error wins over everything', () => {
  assert.strictEqual(deriveReportPhase({ caseData: null }), PHASE.LOADING);
  assert.strictEqual(deriveReportPhase({ error: 'boom', caseData: paidT1 }), PHASE.ERROR);
});

test('unpaid case is awaiting_payment, not "generating"', () => {
  // Previously an unpaid case rendered "Our AI agent is running forensic checks now".
  const unpaid = { ...paidT1, payment_status: 'pending' };
  assert.strictEqual(deriveReportPhase({ caseData: unpaid }), PHASE.AWAITING_PAYMENT);
});

test('tier 2 and 3 are manual_review and never poll', () => {
  for (const tier of [2, 3, '2', '3']) {
    const phase = deriveReportPhase({ caseData: { ...paidT1, tier } });
    assert.strictEqual(phase, PHASE.MANUAL_REVIEW, `tier ${tier}`);
    assert.strictEqual(shouldPoll(phase), false);
  }
});

test('paid tier 1 without a report is generating and polls', () => {
  const phase = deriveReportPhase({ caseData: paidT1, pollCount: 0 });
  assert.strictEqual(phase, PHASE.GENERATING);
  assert.strictEqual(shouldPoll(phase), true);
});

test('a generated report is ready regardless of poll count', () => {
  const done = { ...paidT1, report_generated_at: '2026-10-29T03:00:00Z' };
  assert.strictEqual(deriveReportPhase({ caseData: done, pollCount: 999 }), PHASE.READY);
});

test('polling stops at the cap and the phase becomes stalled', () => {
  assert.strictEqual(deriveReportPhase({ caseData: paidT1, pollCount: MAX_REPORT_POLLS - 1 }), PHASE.GENERATING);
  const stalled = deriveReportPhase({ caseData: paidT1, pollCount: MAX_REPORT_POLLS });
  assert.strictEqual(stalled, PHASE.STALLED);
  assert.strictEqual(shouldPoll(stalled), false, 'stalled must not keep polling forever');
});

test('the poll cap covers the longest expected pipeline', () => {
  // The pipeline takes 30–120s; the cap must not give up before that.
  assert.ok(MAX_REPORT_POLLS * 15 >= 120, 'cap shorter than the pipeline would stall healthy reports');
});

test('analysis is triggered exactly once, and only when needed', () => {
  assert.strictEqual(shouldTriggerAnalysis(paidT1, false), true);
  assert.strictEqual(shouldTriggerAnalysis(paidT1, true), false, 'must not re-trigger on later polls');
  assert.strictEqual(shouldTriggerAnalysis({ ...paidT1, report_generated_at: 'x' }, false), false);
  assert.strictEqual(shouldTriggerAnalysis({ ...paidT1, payment_status: 'pending' }, false), false);
  assert.strictEqual(shouldTriggerAnalysis({ ...paidT1, tier: 2 }, false), false);
  assert.strictEqual(shouldTriggerAnalysis(null, false), false);
});

test('tier arrives as a string from PostgREST and still classifies', () => {
  assert.strictEqual(deriveReportPhase({ caseData: { ...paidT1, tier: '1' } }), PHASE.GENERATING);
});
