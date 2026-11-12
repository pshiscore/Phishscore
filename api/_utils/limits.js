// Rate limits for the paid routes, in one place.
//
// Per-IP limits stop one client; GLOBAL daily ceilings are a hard stop across
// all clients (a distributed attack, or a bug in a loop). Global ceilings are
// counted only after reCAPTCHA passes, right before the paid call.
//
// Sized from real traffic up to 2026-11-12: busiest day ever was 41 analyses
// and 24 quick scans (typical active day: ~4 each). Ceilings are >10x those
// peaks; worst-case spend at the ceiling is in the comments.

module.exports = {
  analyze: {
    perMinute: 5,
    perIpDay: 30,
    globalDay: 500,   // ~$0.01 per call → ≤ ~$6/day
  },
  quickScan: {
    perMinute: 6,
    perIpDay: 60,
    globalDay: 300,   // ~$0.0015 Claude + 1 IPQS lookup per call → ≤ ~$0.50/day + 300 lookups
  },
  extractEmail: {
    perMinute: 10,
    perIpDay: 100,
    globalDay: 300,   // Haiku parse + 1 IPQS lookup per call
  },
  investigatorChat: { // parked; numbers apply if it is switched back on
    perMinute: 5,
    perIpDay: 40,
    globalDay: 200,
  },
};
