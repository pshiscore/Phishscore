// Single source of truth for Quick Scan score bands.
//
// These bands are consumed in two places that MUST agree:
//   1. the Quick Scan prompt (api/quick-scan.js) — tells the model what a score means
//   2. the Quick Scan result UI (src/components/ActionRow.jsx) — tells the user
// They previously disagreed by a whole band: the prompt called 21-50 "suspicious"
// while the UI rendered the same score as "LOW RISK", so a scan could be described
// as suspicious by the model and low-risk by the interface at the same time.
//
// CommonJS, because api/ is CommonJS and CRA's webpack can import it from src/.

const SCORE_BANDS = [
  { min: 76, max: 100, label: 'HIGH RISK',   promptLabel: 'confirmed threat', color: '#f43f5e' },
  { min: 51, max: 75,  label: 'LIKELY THREAT', promptLabel: 'likely threat',  color: '#fb923c' },
  { min: 21, max: 50,  label: 'SUSPICIOUS',  promptLabel: 'suspicious',       color: '#fbbf24' },
  { min: 0,  max: 20,  label: 'LIKELY SAFE', promptLabel: 'safe / low risk',  color: '#34d399' },
];

function getScoreBand(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return SCORE_BANDS[SCORE_BANDS.length - 1];
  return SCORE_BANDS.find(b => n >= b.min) || SCORE_BANDS[SCORE_BANDS.length - 1];
}

const getScoreLabel = (score) => getScoreBand(score).label;
const getScoreColor = (score) => getScoreBand(score).color;

// Rendered into the prompt so the model's scale is literally the UI's scale.
function describeScoreBands() {
  return SCORE_BANDS
    .slice()
    .sort((a, b) => a.min - b.min)
    .map(b => `- ${b.min}-${b.max} = ${b.promptLabel} (shown to the user as "${b.label}")`)
    .join('\n');
}

module.exports = { SCORE_BANDS, getScoreBand, getScoreLabel, getScoreColor, describeScoreBands };
