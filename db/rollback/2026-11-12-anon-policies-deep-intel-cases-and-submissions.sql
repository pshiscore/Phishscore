-- Rollback for the anon RLS policy removal of 2026-11-12.
-- Captured verbatim from pg_policies on the live project (oqwunrpzeufxwkdwbztm)
-- immediately before the policies were dropped. Running this file restores
-- the pre-change state: anon could read, insert and update deep_intel_cases
-- and read + insert submissions. Do not run it unless you mean to reopen that.
--
-- Dropped in Part A (deep_intel_cases: read, insert, update) and
-- Part B (submissions: read, insert). RLS stayed enabled throughout.

create policy "Anyone can insert cases" on public.deep_intel_cases
  as PERMISSIVE for INSERT
  to public
  with check (true);

create policy "Anyone can read by token" on public.deep_intel_cases
  as PERMISSIVE for SELECT
  to public
  using (true);

create policy "Service can update cases" on public.deep_intel_cases
  as PERMISSIVE for UPDATE
  to public
  using (true);

create policy "Anyone can insert submissions" on public.submissions
  as PERMISSIVE for INSERT
  to public
  with check (((score >= 0) AND (score <= 100) AND ((auth.role() = 'anon'::text) OR (auth.role() = 'authenticated'::text))));

create policy "Anyone can read submissions" on public.submissions
  as PERMISSIVE for SELECT
  to public
  using (true);

