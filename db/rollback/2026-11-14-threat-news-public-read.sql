-- Rollback for the 2026-11-14 removal of anon read access to threat_news.
-- Captured from pg_policies before the drop:
--   policyname 'Allow public read access', PERMISSIVE, roles {public},
--   cmd SELECT, qual true, with_check null.
-- Running this restores direct read access to every row for anyone holding
-- the anon key, which bypasses the 7-day window in /api/get-news.

create policy "Allow public read access"
  on public.threat_news
  as permissive
  for select
  to public
  using (true);
