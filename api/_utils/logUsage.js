// Per-request LLM token + cost logger → api_usage_log table
// Rates: claude-sonnet-4-6 $3/$15 per 1M, claude-haiku-4-5 $1/$5, claude-opus-4-6 $5/$25

const COST_RATES = {
  'claude-sonnet-4-6':       { input: 3 / 1_000_000,   output: 15 / 1_000_000 },
  'claude-haiku-4-5-20251001':{ input: 1 / 1_000_000,  output: 5  / 1_000_000 },
  'claude-opus-4-6':         { input: 5 / 1_000_000,   output: 25 / 1_000_000 },
  'claude-opus-4-7':         { input: 5 / 1_000_000,   output: 25 / 1_000_000 },
};

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL?.replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

/**
 * Fire-and-forget token usage log. Never throws — failures are console-only.
 *
 * @param {object} opts
 * @param {string} opts.endpoint   - e.g. 'analyze', 'quick-scan'
 * @param {string} opts.model      - full model ID
 * @param {number} opts.input_tokens
 * @param {number} opts.output_tokens
 * @param {string} [opts.submission_id]
 * @param {number} [opts.latency_ms]
 */
async function logUsage({ endpoint, model, input_tokens, output_tokens, submission_id, latency_ms }) {
  try {
    if (!SUPABASE_URL || !SUPABASE_KEY) return;

    const rates = COST_RATES[model] || { input: 0, output: 0 };
    const cost_usd = (input_tokens || 0) * rates.input + (output_tokens || 0) * rates.output;

    await fetch(`${SUPABASE_URL}/rest/v1/api_usage_log`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        endpoint,
        model,
        input_tokens: input_tokens || 0,
        output_tokens: output_tokens || 0,
        cost_usd: Math.round(cost_usd * 1_000_000) / 1_000_000,
        submission_id: submission_id || null,
        latency_ms: latency_ms || null,
      }),
    });
  } catch (err) {
    console.warn('[logUsage] failed (non-fatal):', err.message);
  }
}

module.exports = { logUsage };
