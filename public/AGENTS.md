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
- `api/` — Vercel serverless API routes (analysis, scans, webhooks, cron jobs)
- `lib/` — shared server-side helper libraries
- `supabase/migrations/` — database schema migrations

## Testing

- There is currently no automated test suite. Verify changes by running
  `npm start` and exercising the affected views/flows manually in a browser.
- For serverless function changes, test the relevant `api/*.js` handler
  directly (e.g. via `vercel dev` and `curl`) before relying on the UI.

## Conventions

- Styling is done via inline `style` objects (no CSS files); match this
  pattern when adding new UI.
- Do not commit `.env.local` or any file containing API keys/secrets.
- Keep `public/llms.txt`, `public/sitemap.xml`, and `public/robots.txt`
  in sync when adding or removing public-facing routes.
