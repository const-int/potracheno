-- Run after 20261017_recently_deleted.sql as the project administrator.
-- Supabase Cron: https://supabase.com/docs/guides/cron/quickstart
create extension if not exists pg_cron with schema pg_catalog;
-- Scheduling the same name again updates this job instead of duplicating it.
select cron.schedule(
  'potracheno-purge-deleted-expenses',
  '0 2 * * *',
  $$delete from public.expenses where deleted_at <= now() - interval '30 days';$$
);
