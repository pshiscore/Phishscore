// Deep Intel report status — the phase a case is in, derived in one place.
//
// ReportStatusModal previously juggled `loading`, `error`, `caseData`, and
// `pollCount` plus two derived booleans, and had two defects hiding in the gaps:
//   - it re-triggered /api/deep-intel on EVERY 15s poll while a report was
//     generating, so one paid case could launch several concurrent forensic
//     pipelines (the server only guards against re-running a FINISHED report);
//   - `pollCount` was incremented but never read, so a report that failed
//     server-side left the user on an infinite spinner.
//
// Phases (exactly one applies):
//   loading           first fetch has not returned
//   error             case could not be loaded
//   awaiting_payment  case exists but payment_status !== 'paid'
//   manual_review     tier 2/3 — a human delivers; nothing to poll
//   generating        tier 1, paid, no report yet — poll
//   ready             tier 1, report_generated_at set
//   stalled           tier 1, still no report after MAX_REPORT_POLLS — stop polling
//
// CommonJS so `node --test` can require it directly; CRA imports it fine.

const POLL_INTERVAL_MS = 15000;
const MAX_REPORT_POLLS = 12; // × 15s = 3 minutes, comfortably above the 30–120s pipeline

const PHASE = Object.freeze({
  LOADING: 'loading',
  ERROR: 'error',
  AWAITING_PAYMENT: 'awaiting_payment',
  MANUAL_REVIEW: 'manual_review',
  GENERATING: 'generating',
  READY: 'ready',
  STALLED: 'stalled',
});

function deriveReportPhase({ error, caseData, pollCount = 0, maxPolls = MAX_REPORT_POLLS }) {
  if (error) return PHASE.ERROR;
  if (!caseData) return PHASE.LOADING;
  if (caseData.payment_status !== 'paid') return PHASE.AWAITING_PAYMENT;
  if (Number(caseData.tier) !== 1) return PHASE.MANUAL_REVIEW;
  if (caseData.report_generated_at) return PHASE.READY;
  if (pollCount >= maxPolls) return PHASE.STALLED;
  return PHASE.GENERATING;
}

// Only the generating phase keeps the timer alive.
function shouldPoll(phase) {
  return phase === PHASE.GENERATING;
}

// Fire the analysis exactly once per modal lifetime, and only when it is
// actually needed. The server will no-op a finished case, but it will happily
// start a second pipeline for one that is merely in progress.
function shouldTriggerAnalysis(caseData, alreadyTriggered) {
  if (alreadyTriggered || !caseData) return false;
  return Number(caseData.tier) === 1
    && caseData.payment_status === 'paid'
    && !caseData.report_generated_at;
}

module.exports = {
  PHASE, POLL_INTERVAL_MS, MAX_REPORT_POLLS,
  deriveReportPhase, shouldPoll, shouldTriggerAnalysis,
};
