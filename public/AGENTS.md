# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project Overview

PhishScore.ai is a community-driven scam and phishing intelligence platform.
The frontend is a Create React App (CRA) single-page app (`src/`), and the
backend is a set of Vercel serverless functions (`api/`) backed by Supabase.

## Setup

- Requires Node.js and npm.
- Install dependencies: `npm install`
- Environment variables are read from `.env.local` (not committed). Copy the
  required keys from your team's secret store before running locally —
  the app will not function correctly without Supabase and AI provider keys
  configured.

## Development

- Start the local dev server: `npm start` (serves at `http://localhost:3000`)
- Production build: `npm run build` (outputs to `build/`)
- Serverless functions in `api/` run on Vercel's Node runtime; use the
  Vercel CLI (`vercel dev`) to run them locally alongside the frontend.

## Code Structure

- `src/App.js` — main dashboard SPA (homepage)
- `src/components/` — UI components, including alternate views
  (FAQ, Glossary, Radar, News, Dev/Beta dashboards)
- `src/constants.js` — shared constants (scam categories, themes, helpers)
- `src/views.js` — the view ↔ URL path map; `src/App.js` routes from it
- `src/asyncStatus.js`, `src/hooks/useAsyncStatus.js` — the shared
  request state machine (`idle → running → success | error`)
- `src/reportPhase.js` — Deep Intel report phase derivation
- `src/score-bands.js` — score bands shared by the prompt and the UI
- `api/` — Vercel serverless API routes (analysis, scans, webhooks, cron jobs)
- `lib/` — shared server-side helper libraries
- `supabase/migrations/` — database schema migrations
- `docs/STATE_MACHINES.md` — every multi-step flow, its states and transitions
- `test/` — `node:test` suites for the pure modules above

## Testing

- `npm test` runs the `node:test` suites in `test/` (no extra dependencies;
  the modules under test are CommonJS so Node can require them directly).
  They cover domain-age selection, IPQS normalization, score bands,
  categories, the async request machine, report phases and view routing.
- Components are not unit-tested. Verify UI changes by running `npm start`
  and exercising the affected views/flows manually in a browser.
- For serverless function changes, test the relevant `api/*.js` handler
  directly (e.g. via `vercel dev` and `curl`) before relying on the UI.

## Conventions

- Styling is done via inline `style` objects (no CSS files); match this
  pattern when adding new UI.
- Do not commit `.env.local` or any file containing API keys/secrets.
- Keep `public/llms.txt`, `public/sitemap.xml`, and `public/robots.txt`
  in sync when adding or removing public-facing routes. Views are routed
  from `src/views.js`; add a new view there first.
- Any flow with more than two states gets a single `status`/`phase`/`step`
  string, not a cluster of booleans. For "fetch and show the outcome" use
  `useAsyncStatus`. See `docs/STATE_MACHINES.md` for the full list and the
  two vocabularies (client `idle/running/success/error`, server
  `pending/running/completed/failed`).
