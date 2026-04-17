const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

/**
 * Embed rawText, check for a cached match in scam_reports via pgvector,
 * and return either the cached result or a flag to run a deep scan.
 *
 * @param {string} rawText
 * @returns {Promise<
 *   { cached: true, result: object } |
 *   { cached: false, requiresDeepScan: true, newEmbedding: number[] }
 * >}
 */
async function checkAndAnalyzeScam(rawText) {
  // Step A — embed
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: rawText,
  });
  const vector = embeddingResponse.data[0].embedding;

  // Step B — vector similarity search via Supabase RPC
  const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/match_scams`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query_embedding: vector,
      match_threshold: 0.95,
      match_count: 1,
    }),
  });

  if (!rpcRes.ok) {
    const err = await rpcRes.text();
    throw new Error(`match_scams RPC failed [${rpcRes.status}]: ${err}`);
  }

  const matches = await rpcRes.json();

  // Step C — branch on cache hit
  if (Array.isArray(matches) && matches.length > 0) {
    return { cached: true, result: matches[0].analysis_result };
  }

  return { cached: false, requiresDeepScan: true, newEmbedding: vector };
}

/**
 * Persist a new scam report with its embedding so future identical scams hit the cache.
 *
 * @param {string} rawText
 * @param {number[]} newEmbedding
 * @param {object} analysisResult
 */
async function saveNewScam(rawText, newEmbedding, analysisResult) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/scam_reports`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      raw_text: rawText,
      embedding: newEmbedding,
      analysis_result: analysisResult,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`scam_reports insert failed [${res.status}]: ${err}`);
  }
}

module.exports = { checkAndAnalyzeScam, saveNewScam };
