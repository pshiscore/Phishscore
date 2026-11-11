# State machines in PhishScore

Every multi-step flow in this codebase is listed here with its states, its
transitions, and the file that owns it. If you add a flow with more than two
states, add it to this table and give it a single `status`/`phase`/`step`
string — not a cluster of booleans.

## Vocabulary

Two vocabularies, never mixed:

| context | states | why |
|---|---|---|
| **client request** (fetch something, show the outcome) | `idle → running → success \| error` | `src/asyncStatus.js` — use the `useAsyncStatus` hook |
| **server job** (stored in Postgres, outlives a request) | `pending → running → completed \| failed` | matches the `weekly_report_status` SQL enum |

A UI that shows a server job maps the server states onto its own display; it
does not invent a third set of names.

## Client

### Async request — `src/asyncStatus.js`, `src/hooks/useAsyncStatus.js`

```
idle ──run()──▶ running ──resolve──▶ success(data)
                   │
                   └──reject───▶ error(message)
any ──reset()──▶ idle            (also discards an in-flight result)
```

Invariant: exactly one state holds; `running`/`idle` carry no data or error.
Used by: `ActionRow` (Quick Scan), `NewsPanel` (article feed, fetched on
mount), `NewsPanel › SubscribeModal`, `APITestDashboard › RadarRefreshPanel`,
`APITestDashboard › NewsRefreshPanel`.

For a fetch-on-mount feed, alias `loading` as "not settled" —
`!isSuccess && !isError` — so the spinner shows from the first frame.

### Scanner — `src/components/SubmitModal.jsx › ScannerPanel` (`step`)

```
compose ──analyze()──▶ analyzing ──ok──▶ result
                           │
                           └──429 / !ok / throw──▶ error ──TRY AGAIN──▶ compose
result ──resetForm()──▶ compose
```

`extracting` (sender/IPQS auto-extraction) and `duplicate` (similar prior
submission) are independent flags that only matter inside `compose`.

### Accuracy feedback — `src/components/SubmitModal.jsx › AccuracyFeedback` (`status`)

`idle → form_open → submitting → success`, with CANCEL from `form_open` back
to `idle`. `form_open` is a UI state, not a request state, so this does not
use `useAsyncStatus`; a failed submit currently returns to `form_open`
silently (no error state).

### Deep Intel report status — `src/reportPhase.js`, `src/components/ReportStatusModal.jsx` (`phase`)

Derived from the case row, not stored:

| phase | when | polls? |
|---|---|---|
| `loading` | first fetch not back | — |
| `error` | case not found / fetch failed | — |
| `awaiting_payment` | `payment_status !== 'paid'` | no |
| `manual_review` | tier 2 or 3 (a human delivers) | no |
| `generating` | tier 1, paid, `report_generated_at` null | **yes**, every 15 s |
| `ready` | `report_generated_at` set | no |
| `stalled` | still generating after `MAX_REPORT_POLLS` (12 × 15 s = 3 min) | no — offers CHECK AGAIN |

`/api/deep-intel` is triggered **once** per modal lifetime (`triggeredRef`).
The server only refuses a *finished* case, so re-triggering on each poll —
the previous behaviour — launched parallel forensic pipelines.

### Views — `src/views.js`, `src/App.js` (`activeView`)

One view at a time, each with a URL path. `switchView()` pushes history;
`popstate` restores. Unknown paths resolve to `dashboard`.

| view | path |
|---|---|
| `dashboard` | `/` |
| `faq` | `/faq` |
| `radar` | `/radar` |
| `news` | `/news` |
| `deep-intel` | `/deep-intel` |
| `glossary` | `/glossary` |
| `scanner` | `/scanner` |

`/beta` and `/devs` are routed by `src/index.js` before `<App>` mounts;
`/report?token=…` opens `ReportStatusModal` over whatever view is active.
Adding a view: add it to `VIEW_PATHS`, then to `public/sitemap.xml` and
`public/llms.txt` if it is public content.

Overlays (`showModal`, `showTransparency`, `showLegal`, `showInvestigation`,
and the mobile-only `isScannerOpen` / `isDeepIntelOpen`) are independent
booleans. No current path opens two at once; they are not a machine.

### Deep Intel intake — `src/components/DeepIntelModal.jsx` (`step`)

`intake → scoring → tiers`, with BACK from `scoring` to `intake`. `scoring`
additionally requires an `ivs` result to render.

### Dev dashboard — `src/components/DevDashboard.jsx`

- `authState`: `loading → login | authenticated`
- `reportState`: `idle → running → completed | failed` (display of the weekly
  report job below; `reportBusy` = `running`)
- `evalStatus`: `null → success | error`

### API test row — `src/components/APITestDashboard.jsx › ApiTestRow` (`status`)

`idle → running → pass | fail | skip`. These are **test outcomes**, not
request states, so this intentionally does not use `useAsyncStatus`.

### Classifiers (not flows, but fixed state sets)

- Domain age — `lib/domain-age.js`, `lib/ipqs.js`: `known(days) | unknown`.
  `unknown` is never rendered as "new" or 0 days.
- Score bands — `src/score-bands.js`: `LIKELY SAFE | SUSPICIOUS | LIKELY THREAT | HIGH RISK`,
  shared by the prompt and the UI.
- Categories — `lib/categories.js`: the canonical ids; anything else coerces to `other`.

## Server / database

### Weekly report — `weekly_reports.status` (`weekly_report_status` enum)

```
pending ──run.js──▶ running ──▶ completed
                       └──────▶ failed(error_message)
```

`api/devs/weekly-report/trigger.js` inserts `pending` and refuses a second
report for the same week while one is `pending` or `running`.
`api/devs/weekly-report/run.js` moves it through `running` to a terminal state.
**This is the reference implementation** — an explicit enum, written in one
place, read everywhere.

### Deep Intel case — `deep_intel_cases.payment_status`

```
pending ──polar-webhook (order.created)──▶ paid
```

Only `order.created` is handled; there is no `refunded` or `failed` state.
If refunds matter, add the state and handle Polar's refund event.

### Deep Intel case — report generation

Tracked by `report_generated_at` (null → timestamp) in `api/deep-intel.js`.
There is **no in-progress marker**: the server rejects a case that is done, not
one that is running. The client's trigger-once guard covers the normal case; a
page refresh during the 30–120 s window can still start one extra run. A
`report_started_at` column would close that fully (needs a migration).
