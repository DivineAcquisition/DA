-- Phase 5: harden.
--
-- 1. The pipeline Airtable token was readable by the anon role, and the anon
--    key ships in the browser. Only an admin or the service role can read it.
-- 2. Functions that need a signed-in user or an admin no longer accept anon
--    calls. They refused anon inside already; this closes the door in front.
--    Public token flows, public forms, sign-in, and webhooks keep anon.
-- 3. GoHighLevel: a token missing scopes was retried every minute (about
--    33,000 failed calls a day). Open mapping and user requests no longer
--    force a check every minute while scopes are missing, the placement sync
--    backs off after failures, and the request log keeps 14 days.

-- 1 ---------------------------------------------------------------------------

create or replace function public.da_get_pipeline_airtable_pat()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if app.is_admin() or coalesce(auth.role(), '') = 'service_role' then
    return (select pipeline_airtable_pat from public.da_settings where id = 1);
  end if;
  raise exception 'admin_required: only an admin can read the pipeline Airtable token' using errcode = '42501';
end;
$$;

revoke all on function public.da_get_pipeline_airtable_pat() from public, anon;
grant execute on function public.da_get_pipeline_airtable_pat() to authenticated, service_role;

-- 2 ---------------------------------------------------------------------------

do $$
declare
  v_fn record;
  v_names text[] := array[
    -- account and access control (each checks the caller's permission)
    'accept_account_invite', 'advance_offboarding', 'archive_account', 'change_account_role',
    'clear_permission_override', 'engage_lockdown', 'release_lockdown', 'lockdown_status',
    'grant_credential_access', 'revoke_credential_access', 'reveal_credential', 'rotate_credential',
    'store_credential', 'archive_credential', 'permanently_delete_account', 'reactivate_account',
    'require_password_reset', 'reset_second_factor', 'restore_account', 'revoke_account_sessions',
    'revoke_one_session', 'set_account_expiry', 'set_account_notice', 'clear_account_notice',
    'set_account_scope', 'set_mfa_requirement', 'set_permission_override', 'set_sign_in_restrictions',
    'soft_delete_account', 'start_impersonation', 'suspend_account', 'invite_account', 'resend_invite',
    'cancel_invite',
    -- read-outs about a person's access (admin screens)
    'account_sessions', 'credentials_reachable_by', 'explain_permission', 'scoped_case_files',
    'offboarding_state', 'role_change_preview', 'open_work_for',
    -- the Academy (signed-in learners, managers and reviewers)
    'academy_calibration_report', 'academy_calibration_save', 'academy_drill_answer',
    'academy_drill_import', 'academy_drill_start', 'academy_drill_state', 'academy_drill_submit',
    'academy_grade_override', 'academy_hold_practice', 'academy_manual_queue', 'academy_offer_save',
    'academy_practical_file', 'academy_practical_queue', 'academy_practical_review',
    'academy_practical_save', 'academy_practical_state', 'academy_practical_submit',
    'academy_practice_catalog', 'academy_practice_settings', 'academy_reflection_override',
    'academy_reflection_save', 'academy_reflection_state', 'academy_reflection_submit',
    'academy_rubric_save', 'academy_sim_abandon_due', 'academy_sim_admin', 'academy_sim_begin',
    'academy_sim_post_operator', 'academy_sim_preview_state', 'academy_sim_review', 'academy_sim_save',
    'academy_sim_state', 'academy_sim_submit'
  ];
begin
  for v_fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any (v_names)
  loop
    execute format('revoke execute on function %s from public, anon', v_fn.sig);
    execute format('grant execute on function %s to authenticated, service_role', v_fn.sig);
  end loop;
end;
$$;

-- 3 ---------------------------------------------------------------------------

-- A requested mapping or user check waits for the regular schedule while the
-- token is missing scopes: the check cannot succeed until the token changes,
-- and saving a new token requests a check anyway.
create or replace function public.ghl_due_checks(p_limit integer default 20)
returns setof jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('connection_id', c.id, 'level', c.level, 'case_file_id', c.case_file_id,
    'location_id', c.location_id, 'company_id', c.company_id, 'is_candidate', c.replaces_id is not null,
    'mapping_due', c.level = 'location' and c.replaces_id is null and (
      l.mapping_requested_at is not null or l.mapping_checked_at is null or l.mapping_checked_at < now() - interval '6 hours'),
    'users_due', c.level = 'location' and c.replaces_id is null and (
      l.reconcile_requested_at is not null or l.users_checked_at is null or l.users_checked_at < now() - interval '24 hours'))
  from public.ghl_connection c
  left join public.ghl_location l on l.case_file_id = c.case_file_id
  where c.retired_at is null
    and (
      c.check_requested_at is not null
      or c.next_check_at <= now()
      or (
        (l.mapping_requested_at is not null or l.reconcile_requested_at is not null)
        and (
          coalesce(cardinality(c.scopes_missing), 0) = 0
          or c.last_checked_at is null
          or c.last_checked_at < now() - interval '6 hours'
        )
      )
    )
  order by c.check_requested_at nulls last, c.next_check_at
  limit greatest(coalesce(p_limit, 20), 1);
$$;

-- The placement sync is due on its interval after a success. After failures it
-- waits longer each time (15, 30, 60 ... minutes, at most 6 hours) instead of
-- retrying every minute. An admin's "sync now" still runs at once.
create or replace function public.so_ghl_due()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_minutes integer;
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  select ghl_sync_interval_minutes into v_minutes from public.team_setting where id = 1;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'placement_id', l.placement_id,
      'case_file_id', pl.case_file_id,
      'ghl_user_id', l.ghl_user_id,
      'time_zone', pl.time_zone,
      'shift_start', pl.shift_start,
      'shift_end', pl.shift_end,
      'start_date', pl.start_date,
      'mapping', l.mapping,
      'catalog', coalesce(l.catalog, '{}'::jsonb),
      'outcome_types', coalesce((
        select jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name) order by o.sort_order, o.name)
        from public.placement_outcome_type o
        where o.placement_id = l.placement_id and o.active
      ), '[]'::jsonb),
      'rerun_from', l.rerun_from,
      'rerun_to', l.rerun_to,
      'backfill_days', (select ghl_backfill_days from public.team_setting where id = 1),
      'connect_seconds', (select ghl_connect_seconds from public.team_setting where id = 1),
      'conversation_seconds', (select ghl_conversation_seconds from public.team_setting where id = 1),
      'reply_window_days', (select ghl_reply_window_days from public.team_setting where id = 1)
    ))
    from public.sales_ghl_link l
    join public.placement pl on pl.id = l.placement_id
    where l.status in ('connected', 'needs_attention')
      and l.ghl_user_id is not null
      and pl.status = 'active'
      and (
        l.sync_requested_at is not null
        or (
          (l.last_success_at is null or l.last_success_at < now() - make_interval(mins => coalesce(v_minutes, 15)))
          and (
            coalesce(l.consecutive_failures, 0) = 0
            or l.last_sync_at is null
            or l.last_sync_at < now() - least(
              interval '6 hours',
              make_interval(mins => coalesce(v_minutes, 15) * (2 ^ least(coalesce(l.consecutive_failures, 0), 5))::integer)
            )
          )
        )
      )
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.ghl_due_checks(integer) from public, anon, authenticated;
grant execute on function public.ghl_due_checks(integer) to service_role;
revoke all on function public.so_ghl_due() from public, anon, authenticated;
grant execute on function public.so_ghl_due() to service_role;

-- Keep 14 days of GoHighLevel request logs. Older rows are removed nightly.
create index if not exists ghl_request_log_at_idx on public.ghl_request_log (at);

do $$
begin
  if exists (select 1 from cron.job where jobname = 'ghl-request-log-retention') then
    perform cron.unschedule('ghl-request-log-retention');
  end if;
  perform cron.schedule(
    'ghl-request-log-retention',
    '17 9 * * *',
    $job$delete from public.ghl_request_log where at < now() - interval '14 days'$job$
  );
end;
$$;

-- 4 ---------------------------------------------------------------------------
-- A daily health check. Each row is one thing that is not right, in words a
-- person can act on. The daily cron emails the list when it is not empty.

create or replace function public.ops_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_rows jsonb := '[]'::jsonb;
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'service_role_required' using errcode = '42501';
  end if;

  -- GoHighLevel connections: missing scopes or no success in a day.
  v_rows := v_rows || coalesce((
    select jsonb_agg(jsonb_build_object(
      'area', 'GoHighLevel',
      'problem', format('%s: the token is missing %s of its scopes (%s).',
        coalesce(cf.name, c.label, 'A connection'), cardinality(c.scopes_missing), array_to_string(c.scopes_missing, ', ')),
      'fix', 'Create a new private integration token in GoHighLevel with every scope and save it under Account, GoHighLevel.'
    ))
    from public.ghl_connection c
    left join public.client_case_file cf on cf.id = c.case_file_id
    where c.retired_at is null and c.replaces_id is null and coalesce(cardinality(c.scopes_missing), 0) > 0
  ), '[]'::jsonb);
  v_rows := v_rows || coalesce((
    select jsonb_agg(jsonb_build_object(
      'area', 'GoHighLevel',
      'problem', format('%s: no successful call since %s.', coalesce(cf.name, c.label, 'A connection'),
        coalesce(to_char(c.last_success_at at time zone 'America/Chicago', 'Mon FMDD'), 'it was connected')),
      'fix', coalesce('Last error: ' || left(c.last_error, 200), 'Open Account, GoHighLevel and run a check.')
    ))
    from public.ghl_connection c
    left join public.client_case_file cf on cf.id = c.case_file_id
    where c.retired_at is null and c.replaces_id is null and c.paused_at is null
      and (c.last_success_at is null or c.last_success_at < now() - interval '24 hours')
  ), '[]'::jsonb);

  -- Placement sales numbers that stopped syncing.
  v_rows := v_rows || coalesce((
    select jsonb_agg(jsonb_build_object(
      'area', 'Sales numbers',
      'problem', format('%s on %s: GoHighLevel numbers have not synced since %s.', o.name, cf.name,
        coalesce(to_char(l.last_success_at at time zone 'America/Chicago', 'Mon FMDD'), 'the seat started')),
      'fix', 'EODs show these numbers as "Pending sync" until the GoHighLevel token is fixed.'
    ))
    from public.sales_ghl_link l
    join public.placement p on p.id = l.placement_id
    join public.operator o on o.id = p.operator_id
    join public.client_case_file cf on cf.id = p.case_file_id
    where p.status = 'active' and l.status in ('connected', 'needs_attention')
      and (l.last_success_at is null or l.last_success_at < now() - interval '24 hours')
  ), '[]'::jsonb);

  -- Email that failed or is stuck.
  v_rows := v_rows || coalesce((
    select jsonb_build_array(jsonb_build_object(
      'area', 'Email',
      'problem', format('%s email%s failed in the last day.', count(*), case when count(*) = 1 then '' else 's' end),
      'fix', 'Latest error: ' || left(max(error), 200)
    ))
    from public.email_log
    where status = 'failed' and coalesce(failed_at, updated_at) > now() - interval '24 hours'
    having count(*) > 0
  ), '[]'::jsonb);
  v_rows := v_rows || coalesce((
    select jsonb_build_array(jsonb_build_object(
      'area', 'Email',
      'problem', format('%s email%s waiting to send for more than an hour.', count(*), case when count(*) = 1 then ' is' else 's are' end),
      'fix', 'The email retry job sends these. If the count grows, check the email log.'
    ))
    from public.email_log
    where status = 'queued' and created_at < now() - interval '1 hour'
    having count(*) > 0
  ), '[]'::jsonb);
  v_rows := v_rows || coalesce((
    select jsonb_build_array(jsonb_build_object(
      'area', 'End of day',
      'problem', format('%s end-of-day letter%s not sent after an hour.', count(*), case when count(*) = 1 then ' was' else 's were' end),
      'fix', 'The eod-mail job sends these every minute. Check its runs in Vercel.'
    ))
    from public.sales_eod_mail
    where sent_at is null and created_at < now() - interval '1 hour'
    having count(*) > 0
  ), '[]'::jsonb);

  -- Database jobs that failed.
  v_rows := v_rows || coalesce((
    select jsonb_agg(jsonb_build_object(
      'area', 'Scheduled jobs',
      'problem', format('%s failed %s time%s in the last day.', j.jobname, f.n, case when f.n = 1 then '' else 's' end),
      'fix', 'Latest error: ' || left(f.msg, 200)
    ))
    from (
      select jobid, count(*) n, max(return_message) msg
      from cron.job_run_details
      where status <> 'succeeded' and start_time > now() - interval '24 hours'
      group by jobid
    ) f
    join cron.job j on j.jobid = f.jobid
  ), '[]'::jsonb);

  return v_rows;
end;
$$;

revoke all on function public.ops_health() from public, anon, authenticated;
grant execute on function public.ops_health() to service_role;
