// IVS = Intel Value Score
// Uses Claude Sonnet to evaluate how much value a deep investigation would provide
// Called before purchase — free, fast, honest

const { rejectIfParked } = require('./_utils/deepIntelGate');

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

module.exports = async function handler(req, res) {
  if (rejectIfParked(req, res)) return; // Deep Intel is parked — docs/DEEP_INTEL_PARKED.md
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message, story, originalScore, originalCategory, caseId } = req.body;

  if (!message && !story) {
    return res.status(400).json({ error: 'Message or story required' });
  }

  try {
    // Build context for Sonnet
    const context = [
      originalScore ? `Original PhishScore: ${originalScore}/100` : '',
      originalCategory ? `Category: ${originalCategory}` : '',
      message ? `Suspicious message/content:\n${message.slice(0, 2000)}` : '',
      story ? `What the user reported happened: ${story}` : '',
    ].filter(Boolean).join('\n\n');

    const prompt = `You are PhishScore Deep Intel's intake analyst. Your job is to evaluate how much value a full forensic investigation would provide to this user, and give them an honest assessment before they spend money.

A full investigation includes: live website screenshot, domain age and ownership (WHOIS), IP abuse history, and a personalized recovery checklist based on their situation.

User's situation:
${context}

Evaluate the Intel Value Score (IVS) — the likelihood that a deep investigation will uncover actionable, important information for this user.

Consider:
- Is there a URL or domain that can be investigated? (high value)
- Did the user interact with the scam (clicked, entered credentials, made payment)? (high value — needs specific recovery steps)
- Is the domain likely young/suspicious based on the message? (high value)
- Is the scam generic with no specific infrastructure to investigate? (lower value)
- Is this a phone/SMS scam with no web presence to scan? (lower value)
- Would the user benefit from a specific recovery checklist? (always adds value if they interacted)

Respond ONLY with valid JSON:
{
  "ivs": <0-100>,
  "label": <"LOW" | "MODERATE" | "HIGH" | "CRITICAL">,
  "headline": "<8 words max — what the investigation is most likely to reveal, specific>",
  "explanation": "<2 sentences — what the investigation would specifically uncover for this person and why it matters. Be concrete. If they entered credentials, say so. If the domain is likely fake, say so. Do not be vague.>",
  "recommend": <true if IVS >= 50, false if not worth purchasing>,
  "honest_note": "<if recommend is false, one honest sentence explaining why a deep investigation is unlikely to help them in this specific case. Leave empty string if recommend is true.>"
}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    const raw = data.content?.map(c => c.text || '').join('') || '';
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());

    // Update case with IVS if we have a caseId
    if (caseId) {
      await fetch(`${SUPABASE_URL}/rest/v1/deep_intel_cases?id=eq.${caseId}`, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify({
          ivs_score: parsed.ivs,
          ivs_label: parsed.label,
          ivs_explanation: parsed.explanation,
          updated_at: new Date().toISOString()
        })
      });
    }

    return res.status(200).json(parsed);

  } catch (err) {
    console.error('IVS scoring error:', err);
    return res.status(500).json({ error: 'IVS scoring failed' });
  }
};
