-- The admin-triggered path previously reached into the private `app` schema,
-- which authenticated has no USAGE on, so an operator got an opaque "permission
-- denied for schema app" instead of a clear refusal. The check is inlined
-- against `profile` instead, which RLS already lets a user read for themselves,
-- so the function stays SECURITY INVOKER and `app` stays fully private.
--
-- auth.uid() is null when pg_cron runs it, and in that path the caller is the
-- definer wrapper below, which is not reachable from the API at all.
create or replace function public.take_due_snapshots()
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_case_file record;
  v_taken integer := 0;
  v_start date := (current_date - interval '7 days')::date;
  v_snapshot_id uuid;
begin
  if auth.uid() is not null
     and not exists (select 1 from public.profile p where p.id = auth.uid() and p.role = 'admin') then
    raise exception 'admin_only: this surface is restricted to Divine Acquisition admins'
      using errcode = '42501';
  end if;

  for v_case_file in
    select cf.id
    from public.client_case_file cf
    join public.snapshot b on b.case_file_id = cf.id and b.kind = 'baseline' and b.locked_at is not null
    where cf.status in ('installing', 'active')
  loop
    insert into public.snapshot (case_file_id, kind, period_start, period_end, trigger, notes, created_by)
    values (v_case_file.id, 'progress', v_start, current_date, 'automatic', 'Weekly automatic snapshot.', auth.uid())
    returning id into v_snapshot_id;

    insert into public.snapshot_metric (snapshot_id, metric_key, value, source)
    select v_snapshot_id, r.key, r.value::numeric, 'measured'
    from jsonb_each_text(public.rollup_tracking(v_case_file.id, v_start, current_date)) r(key, value)
    where r.value is not null;

    -- An automatic snapshot with nothing behind it is noise, so drop it rather
    -- than leaving a row of nulls in the series.
    if not exists (select 1 from public.snapshot_metric where snapshot_id = v_snapshot_id) then
      delete from public.snapshot where id = v_snapshot_id;
    else
      update public.snapshot set locked_at = now() where id = v_snapshot_id;
      v_taken := v_taken + 1;
      perform public.detect_milestones(v_case_file.id);
    end if;
  end loop;

  return v_taken;
end;
$$;

comment on function public.take_due_snapshots is
  'Takes this week''s automatic snapshot for every installed engagement. Shared by the cron job and the admin button so there is one code path.';

revoke all on function public.take_due_snapshots() from anon;

-- Cron has no authenticated user, so it needs a definer entry point. It takes no
-- arguments and simply delegates, so there is no injection surface. Kept in the
-- private schema and not reachable from the API.
create or replace function app.take_automatic_snapshots()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.take_due_snapshots();
end;
$$;

drop function if exists public.run_weekly_snapshots();
