-- The retry queue kept claiming email it had given up on.
--
-- A permanent failure (rejected address, unauthorized sender) is recorded as
-- failed with next_attempt_at null. The old claim treated a null as "due now"
-- and let failed rows skip the two-minute guard, and it ordered by created_at.
-- So the twenty oldest dead rows were claimed on every run, each retry sent
-- another "gave up" alert, and newer email never reached the front.
--
-- Now:
--   * failed rows are claimed only when they carry a next_attempt_at that is due
--     (a null means the send gave up; a person can still retry it by hand);
--   * queued rows are claimed only once they have sat untouched for two
--     minutes, which is a send that died mid-request;
--   * the earliest due row goes first, and a claimed row is pushed back five
--     minutes so a crash mid-retry cannot hand it straight to the next run.

create or replace function public.email_claim_due(p_limit integer default 20)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows jsonb;
begin
  with due as (
    select l.id
    from public.email_log l
    where l.attempt_count < 8
      and (
        (l.status = 'failed' and l.next_attempt_at is not null and l.next_attempt_at <= now())
        or (
          l.status = 'queued'
          and l.updated_at < now() - interval '2 minutes'
          and (l.next_attempt_at is null or l.next_attempt_at <= now())
        )
      )
    order by coalesce(l.next_attempt_at, l.created_at), l.created_at
    limit greatest(coalesce(p_limit, 20), 1)
    for update skip locked
  ),
  claimed as (
    update public.email_log l
       set updated_at = now(),
           next_attempt_at = now() + interval '5 minutes'
      from due
     where l.id = due.id
    returning l.id
  )
  select coalesce(jsonb_agg(id), '[]'::jsonb) into v_rows from claimed;
  return v_rows;
end;
$$;

revoke all on function public.email_claim_due(integer) from public, anon, authenticated;
grant execute on function public.email_claim_due(integer) to service_role;

create index if not exists email_log_retry_due_idx
  on public.email_log (coalesce(next_attempt_at, created_at))
  where status in ('queued', 'failed') and attempt_count < 8;
