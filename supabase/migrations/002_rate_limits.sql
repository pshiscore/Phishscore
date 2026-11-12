-- ── Shared rate limiter ───────────────────────────────────────────────────────
-- Fixed-window counters shared by every serverless instance. Replaces the
-- in-memory Map in api/_utils/rateLimit.js, which reset on every cold start and
-- was per-instance, so limits never held under load.
--
-- Only the service role may touch either object: RLS on with no policies, table
-- privileges revoked from anon/authenticated, function EXECUTE revoked from
-- PUBLIC/anon/authenticated and granted to service_role.

CREATE TABLE IF NOT EXISTS public.rate_limits (
  bucket        text        NOT NULL,              -- '<route>:<client ip>'
  window_start  timestamptz NOT NULL,              -- start of the fixed window
  count         integer     NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window_start)
);

-- Cleanup deletes by age across all buckets.
CREATE INDEX IF NOT EXISTS rate_limits_window_start_idx ON public.rate_limits (window_start);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limits FROM anon, authenticated;

-- Count this request in the current window and say whether it is allowed.
-- The INSERT ... ON CONFLICT ... RETURNING is one atomic statement, so
-- concurrent requests for the same bucket serialize on the row and each sees a
-- distinct count. Requests over the limit are still counted.
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_bucket          text,
  p_max             integer,
  p_window_seconds  integer
)
RETURNS TABLE (allowed boolean, current_count integer)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_window timestamptz;
  v_count  integer;
BEGIN
  IF p_bucket IS NULL OR length(p_bucket) = 0 OR length(p_bucket) > 200
     OR p_max IS NULL OR p_max < 1
     OR p_window_seconds IS NULL OR p_window_seconds < 1 OR p_window_seconds > 86400 THEN
    RAISE EXCEPTION 'check_rate_limit: invalid arguments' USING ERRCODE = '22023';
  END IF;

  v_window := to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds);

  INSERT INTO public.rate_limits AS r (bucket, window_start, count)
  VALUES (p_bucket, v_window, 1)
  ON CONFLICT (bucket, window_start) DO UPDATE SET count = r.count + 1
  RETURNING r.count INTO v_count;

  -- Opportunistic cleanup on ~1 in 50 calls keeps the table to about a day of rows.
  IF random() < 0.02 THEN
    DELETE FROM public.rate_limits WHERE window_start < now() - interval '1 day';
  END IF;

  RETURN QUERY SELECT v_count <= p_max, v_count;
END;
$$;

REVOKE ALL     ON FUNCTION public.check_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) TO service_role;

-- Make the function visible to PostgREST's RPC endpoint immediately.
NOTIFY pgrst, 'reload schema';
