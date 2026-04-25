-- ── api_usage_log ─────────────────────────────────────────────────────────────
-- Lightweight per-request token + cost logging for every LLM call.
-- Required before cost-anomaly detection in weekly reports has real data.

CREATE TABLE IF NOT EXISTS public.api_usage_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  endpoint        text NOT NULL,          -- e.g. 'analyze', 'quick-scan', 'fetch-news'
  model           text NOT NULL,          -- e.g. 'claude-sonnet-4-6'
  input_tokens    integer,
  output_tokens   integer,
  cost_usd        numeric(10,6),          -- computed: (input * rate) + (output * rate)
  submission_id   uuid,                   -- nullable FK to submissions/quick_scans
  latency_ms      integer
);

CREATE INDEX IF NOT EXISTS api_usage_log_created_at_idx ON public.api_usage_log (created_at DESC);
CREATE INDEX IF NOT EXISTS api_usage_log_endpoint_idx   ON public.api_usage_log (endpoint);

-- ── weekly_reports ─────────────────────────────────────────────────────────────

CREATE TYPE IF NOT EXISTS weekly_report_status AS ENUM ('pending', 'running', 'completed', 'failed');

CREATE TABLE IF NOT EXISTS public.weekly_reports (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  completed_at          timestamptz,
  week_start_date       date NOT NULL,
  week_end_date         date NOT NULL,
  status                weekly_report_status NOT NULL DEFAULT 'pending',
  triggered_by          text NOT NULL DEFAULT 'cron',   -- 'cron' | 'manual:<username>'
  metrics_json          jsonb,
  health_json           jsonb,
  analysis_markdown     text,
  recommendations_json  jsonb,
  cost_usd              numeric(10,4),
  email_sent_at         timestamptz,
  email_recipients      text[],
  error_message         text
);

CREATE INDEX IF NOT EXISTS weekly_reports_week_start_idx ON public.weekly_reports (week_start_date DESC);
CREATE INDEX IF NOT EXISTS weekly_reports_status_idx     ON public.weekly_reports (status);

-- Prevent double-sending the same week
CREATE UNIQUE INDEX IF NOT EXISTS weekly_reports_unique_completed_week
  ON public.weekly_reports (week_start_date)
  WHERE status = 'completed';
