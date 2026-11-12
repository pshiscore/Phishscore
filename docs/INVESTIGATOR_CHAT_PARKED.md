# Investigator chat is parked

The floating "AI chat" widget (Investigator) was switched off on 2026-11-12.
The code is kept; nothing was deleted.

## What is turned off

- **Backend:** `/api/investigator-chat` answers
  `503 {"error":"The AI chat is currently turned off"}` as its very first
  step, before rate limiting, reCAPTCHA, Supabase or Cohere. The switch is
  `INVESTIGATOR_CHAT_ENABLED`, read per request by
  [`api/_utils/investigatorChatGate.js`](../api/_utils/investigatorChatGate.js).
  It is fail-closed: only the literal string `true` turns it on. It is **not
  set** in Vercel.
- **Frontend:** `INVESTIGATOR_CHAT_ENABLED = false` in
  [`src/components/InvestigatorChat.jsx`](../src/components/InvestigatorChat.jsx),
  and `src/App.js` mounts the widget only when it is `true`. The browser never
  shows the chat button and never calls the endpoint.

## How to turn it back on

1. Fix the known issues below first, at least the first one.
2. In Vercel, set `INVESTIGATOR_CHAT_ENABLED` = `true` for Production.
3. Set `INVESTIGATOR_CHAT_ENABLED = true` in `src/components/InvestigatorChat.jsx`.
4. Deploy, then ask the chat one question on www.phishscore.ai.

## Known issues to fix before relaunch

1. **It does not work.** On 2026-11-12 two real messages passed rate limiting
   and reCAPTCHA, then failed with `investigator-chat error: fetch failed`, a
   network-level error from the Cohere SDK call or the two Supabase reads
   before it. Suspects: the `command-r-08-2024` model or the Cohere SDK's API
   endpoint may be retired, or `COHERE_API_KEY` may be stale.
2. **Answers are rendered as raw HTML** in the widget (an `innerHTML` sink).
   Model output that echoes attacker text could inject script. Render as text
   or sanitise before relaunch.
3. **No usage logging.** Cohere calls are not written to `api_usage_log`, so
   cost cannot be tracked.
4. **Limits in place if relaunched:** 5 messages/min and 40/day per IP (shared
   Postgres limiter, fails closed), reCAPTCHA v3 on every message (action
   `investigator_chat`), messages capped at 1,000 characters. The server is
   stateless: no conversation history is sent to the model.
