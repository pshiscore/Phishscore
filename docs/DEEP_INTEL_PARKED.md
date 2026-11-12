# Deep Intel is parked

Deep Intel (the paid forensic-investigation tier) is switched off at the
backend as of 2026-11-12. The code and the `deep_intel_cases` data are kept
intact. The "Deep Intel" tab still exists and shows the "Available by Request
Only" overlay with the request-access mail button; nothing else is reachable.

## What is turned off

One switch controls the backend: `DEEP_INTEL_ENABLED`. It is read on every
request by [`api/_utils/deepIntelGate.js`](../api/_utils/deepIntelGate.js) and
is fail-closed: unset, empty, `false`, `1`, `TRUE` all mean **off**. Only the
literal string `true` means on. It is **not set** in Vercel.

While off, these endpoints answer `503 {"error":"Deep Intel is currently
available by request only"}` before they parse a body, touch the database or
call any external API:

| endpoint | normal role |
|---|---|
| `POST /api/polar-checkout` | create case + Polar checkout (intake flow) |
| `POST /api/create-checkout` | tier 2/3 upgrade checkout |
| `POST /api/deep-intel` | run the forensic pipeline for a paid case |
| `POST /api/ivs-score` | pre-purchase Intel Value Score (Claude call) |
| `GET /api/report` | case status / report by token |

`POST /api/polar-webhook` still verifies the Svix signature and still rejects
bad signatures with 401. A **verified** event is logged and acknowledged with
`200 {"received":true,"parked":true}` so Polar stops retrying, but nothing is
written to `deep_intel_cases`.

Client side, `DEEP_INTEL_GATED = true` in
[`src/components/DeepIntelModal.jsx`](../src/components/DeepIntelModal.jsx)
renders the overlay over a static placeholder. The intake form is not mounted,
so the browser never calls `/api/ivs-score` or `/api/polar-checkout`.
`ReportStatusModal` shows the same plain message when `/api/report` returns
503 and does not call `/api/deep-intel` or `/api/create-checkout` in that
state. The "Request Deep Intel" prefill flow from the scanner still opens the
gated overlay and nothing else. The investigator chat and the scanner do not
depend on any gated endpoint.

## How to turn it back on

1. In Vercel → Project → Settings → Environment Variables, add
   `DEEP_INTEL_ENABLED` = `true` for Production (and Preview if wanted).
   Redeploy, or wait for the next deploy; serverless functions read it at
   request time.
2. In `src/components/DeepIntelModal.jsx`, set `DEEP_INTEL_GATED = false`.
   This mounts the real intake form again and removes the overlay.
3. Deploy. Verify: `curl -X POST https://www.phishscore.ai/api/ivs-score -d '{}'
   -H 'content-type: application/json'` should return 400 (validation), not 503.

To park again: remove the env var (or set it to anything but `true`) and flip
`DEEP_INTEL_GATED` back to `true`.

## Known issues to fix before relaunch

These were open when the feature was parked and are **not** fixed by parking:

1. **Report is never delivered.** Since the Resend integration was removed,
   nothing emails the customer their report link. The only way to the report
   is the `/report?token=` page, which the post-checkout status modal shows
   when generation finishes, and the token is otherwise unknown to the buyer.
2. **Checkout is hardcoded to the Polar sandbox.** Both `api/polar-checkout.js`
   and `api/create-checkout.js` call `https://sandbox-api.polar.sh`. Real
   customers would be charged nothing and the order would never settle.
3. **No in-progress lock on `/api/deep-intel`.** The server only refuses cases
   that already have `report_generated_at`. Two concurrent triggers for the
   same paid case run two full forensic pipelines (Opus, urlscan, VirusTotal,
   WHOIS, IPQS, Vision) and the second overwrites the first.
4. **T2/T3 purchase notification is gone.** The webhook only `console.log`s
   "manual follow-up required" for tier 2 and 3 orders. Nobody is notified, so
   a human review or expert investigation would never start.
5. **No rate limit or captcha on `/api/polar-checkout` and `/api/ivs-score`.**
   Both are unauthenticated. `ivs-score` costs a Claude call per request and
   `polar-checkout` inserts a `deep_intel_cases` row per request.
6. **`api/lemonsqueezy-webhook.js` is a dead stub** that returns 200 for any
   body with no signature check. Delete it or wire it properly.
7. ~~Anon RLS policies on `deep_intel_cases`~~ **Fixed 2026-11-12.** The
   public-role SELECT, INSERT and UPDATE policies were dropped; RLS stays on
   with no policies, so only the service key can read or write the table. The
   original definitions are in
   `db/rollback/2026-11-12-anon-policies-deep-intel-cases-and-submissions.sql`.
   Every existing `report_token` (13 paid cases) was rotated the same day,
   because the old ones were readable by anyone with the anon key. **Links sent
   to earlier customers no longer work;** a relaunch needs a way to re-issue
   them (see issue 1).

## Tests

`test/deep-intel-gate.test.js` covers: the gate accepts only `true`; each of the
five endpoints returns 503 with no outbound call while parked (including with
a wrong method and no body, proving the gate runs first); each behaves as
before with `DEEP_INTEL_ENABLED=true`; the webhook rejects bad signatures and
acknowledges verified events without writing while parked, and writes when
enabled.
