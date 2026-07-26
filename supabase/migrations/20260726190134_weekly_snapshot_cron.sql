create extension if not exists pg_cron with schema extensions;

-- Snapshots are taken automatically once a week. Monday 06:00 UTC, so the
-- numbers are waiting before anyone opens the hub.
select cron.schedule(
  'vistrial-weekly-snapshots',
  '0 6 * * 1',
  $$select app.take_automatic_snapshots();$$
);
