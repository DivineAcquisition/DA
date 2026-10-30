-- Report clock, approval, the public token, and the delivery queue.
-- Sending itself runs in the Next.js cron, which calls the claim functions.

create or replace function app.so_report_auto_summary(p_report uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_json jsonb := app.so_report_client_json(p_report);
  v_line text;
  v_text text := '';
  v_item jsonb;
begin
  for v_item in select value from jsonb_array_elements(coalesce(v_json -> 'headline', '[]'::jsonb)) loop
    v_line := v_item ->> 'label' || ' ' || coalesce(v_item ->> 'value', 'none');
    if v_item ->> 'target' is not null then
      v_line := v_line || ' of ' || (v_item ->> 'target');
    end if;
    v_text := v_text || case when v_text = '' then '' else '. ' end || v_line;
  end loop;
  if v_text = '' then
    return 'No numbers were verified for this period.';
  end if;
  return v_text || '.';
end;
$$;

revoke all on function app.so_report_auto_summary(uuid) from public, anon, authenticated;

create or replace function app.so_report_recipients(p_placement uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select app.so_clean_emails(
    coalesce(c.recipient_emails, '{}') || coalesce(c.extra_emails, '{}')
  )
  from public.sales_report_config c
  where c.placement_id = p_placement;
$$;

revoke all on function app.so_report_recipients(uuid) from public, anon, authenticated;

create or replace function public.so_report_ensure(p_placement uuid, p_kind text, p_start date, p_end date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_pl public.placement;
  v_cfg public.sales_report_config;
  v_setting public.team_setting;
  v_count integer;
  v_summary text;
begin
  if p_kind not in ('weekly', 'daily') or p_end < p_start then
    raise exception 'invalid: report period' using errcode = '23514';
  end if;
  select * into v_pl from public.placement where id = p_placement and status = 'active' and placement_type is not null;
  if v_pl.id is null then
    return null;
  end if;
  select * into v_cfg from public.sales_report_config where placement_id = p_placement;
  if p_kind = 'weekly' and not coalesce(v_cfg.weekly_enabled, true) then
    return null;
  end if;
  if p_kind = 'daily' and not coalesce(v_cfg.daily_enabled, false) then
    return null;
  end if;
  select id into v_id from public.sales_report
  where placement_id = p_placement and kind = p_kind and period_start = p_start and period_end = p_end and not test;
  if v_id is not null then
    return v_id;
  end if;
  if exists (
    select 1 from public.sales_report_skip s
    where s.placement_id = p_placement and s.kind = p_kind and s.period_start = p_start and s.period_end = p_end
  ) then
    return null;
  end if;
  select count(*) into v_count from public.sales_eod e
  where e.placement_id = p_placement and e.submitted_at is not null and e.work_date between p_start and p_end;
  if v_count = 0 then
    insert into public.sales_report_skip (placement_id, kind, period_start, period_end)
    values (p_placement, p_kind, p_start, p_end)
    on conflict do nothing;
    perform app.so_staff_alert('report_empty', v_pl.operator_id, v_pl.id, v_pl.manager_profile_id, p_end,
      format('No report sent for %s. No EOD was submitted in that period.', p_start));
    return null;
  end if;
  select * into v_setting from public.team_setting where id = 1;
  insert into public.sales_report (
    placement_id, kind, period_start, period_end, status, approval_due_at, scheduled_for, summary, next_focus, auto_summary
  ) values (
    p_placement, p_kind, p_start, p_end,
    case when coalesce(v_cfg.require_approval, true) then 'ready' else 'approved' end,
    case when coalesce(v_cfg.require_approval, true) then now() + make_interval(hours => v_setting.report_approval_hours) else null end,
    case when coalesce(v_cfg.require_approval, true) then null else now() end,
    null, null, not coalesce(v_cfg.require_approval, true)
  ) returning id into v_id;
  if not coalesce(v_cfg.require_approval, true) then
    v_summary := app.so_report_auto_summary(v_id);
    update public.sales_report set summary = v_summary, next_focus = 'Keep the current focus.' where id = v_id;
  else
    perform app.so_staff_alert('report_ready', v_pl.operator_id, v_pl.id, v_pl.manager_profile_id, p_end,
      format('A %s report is ready for review.', p_kind));
  end if;
  perform app.so_system_audit('workspace.report.opened', 'sales_report', v_id::text,
    format('Opened the %s report for %s to %s', p_kind, p_start, p_end),
    null, jsonb_build_object('status', (select status from public.sales_report where id = v_id)), v_pl.case_file_id);
  return v_id;
end;
$$;

revoke all on function public.so_report_ensure(uuid, text, date, date) from public, anon, authenticated;
grant execute on function public.so_report_ensure(uuid, text, date, date) to service_role;

create or replace function public.so_report_sweep()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pl public.placement;
  v_cfg public.sales_report_config;
  v_setting public.team_setting;
  v_local timestamp;
  v_dow integer;
  v_send_dow integer;
  v_back integer;
  v_send_date date;
  v_send_ts timestamptz;
  v_start date;
  v_end date;
  v_r public.sales_report;
  v_n integer := 0;
begin
  if auth.uid() is not null and coalesce(auth.role(), '') <> 'service_role' then
    perform app.so_require_team_staff();
  end if;
  perform set_config('app.report_sweep', 'on', true);
  select * into v_setting from public.team_setting where id = 1;
  for v_pl in
    select * from public.placement p where p.status = 'active' and p.placement_type is not null
  loop
    select * into v_cfg from public.sales_report_config where placement_id = v_pl.id;
    if coalesce(v_cfg.weekly_enabled, true) then
      v_local := now() at time zone v_pl.time_zone;
      v_dow := extract(isodow from v_local)::integer;
      v_send_dow := coalesce(v_cfg.send_dow, v_setting.report_weekly_dow);
      v_back := (v_dow - v_send_dow + 7) % 7;
      v_send_date := v_local::date - v_back;
      v_send_ts := (v_send_date + coalesce(v_cfg.send_time, v_setting.report_weekly_time)::time) at time zone v_pl.time_zone;
      if v_send_ts > now() then
        v_send_date := v_send_date - 7;
      end if;
      v_end := v_send_date - 1;
      v_start := v_end - 6;
      if public.so_report_ensure(v_pl.id, 'weekly', v_start, v_end) is not null then
        v_n := v_n + 1;
      end if;
    end if;
  end loop;

  for v_r in
    select * from public.sales_report r
    where r.status = 'ready' and r.approval_due_at is not null and r.approval_due_at <= now() and r.approval_alerted_at is null and not r.test
  loop
    select * into v_pl from public.placement where id = v_r.placement_id;
    perform app.so_staff_alert('report_approval_due', v_pl.operator_id, v_pl.id, null, v_r.period_end,
      format('The %s report for %s to %s was not approved within the window. It was not sent.', v_r.kind, v_r.period_start, v_r.period_end));
    update public.sales_report set approval_alerted_at = now(), updated_at = now() where id = v_r.id;
    insert into public.sales_delivery (report_id, placement_id, channel, destination, status, subject_type, subject_id, payload)
    values (v_r.id, v_r.placement_id, 'discord', 'escalations', 'retrying', 'report', v_r.id::text || ':approval',
      jsonb_build_object('text', format('Report not approved: %s to %s. It was not sent.', v_r.period_start, v_r.period_end)))
    on conflict (channel, destination, subject_type, subject_id) do nothing;
  end loop;
  perform set_config('app.report_sweep', 'off', true);
  return v_n;
end;
$$;

revoke all on function public.so_report_sweep() from public, anon;
grant execute on function public.so_report_sweep() to authenticated, service_role;

create or replace function app.so_report_on_submit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.submitted_at is not null and (tg_op = 'INSERT' or old.submitted_at is null) then
    perform set_config('app.report_sweep', 'on', true);
    begin
      perform public.so_report_ensure(new.placement_id, 'daily', new.work_date, new.work_date);
    exception when others then
      null;
    end;
    perform set_config('app.report_sweep', 'off', true);
  end if;
  return new;
end;
$$;

revoke all on function app.so_report_on_submit() from public, anon, authenticated;

drop trigger if exists sales_eod_client_report on public.sales_eod;
create trigger sales_eod_client_report
  after insert or update of submitted_at on public.sales_eod
  for each row execute function app.so_report_on_submit();

-- 5. Approval ---------------------------------------------------------------------

create or replace function public.so_report_approve(p_id uuid, p_summary text, p_next text, p_wins uuid[], p_when text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r public.sales_report;
  v_pl public.placement;
  v_cfg public.sales_report_config;
  v_setting public.team_setting;
  v_when timestamptz;
  v_local timestamp;
  v_dow integer;
  v_send_dow integer;
  v_back integer;
  v_send_date date;
begin
  perform app.so_require_team_staff();
  if app.is_impersonating() then
    raise exception 'view_as_read_only: exit View As to approve a report' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_summary, ''))) < 1 or length(btrim(coalesce(p_next, ''))) < 1 then
    raise exception 'required: write the summary and the next focus' using errcode = '23514';
  end if;
  select * into v_r from public.sales_report where id = p_id and not test;
  if v_r.id is null or v_r.status not in ('ready', 'held') then
    raise exception 'not_ready: this report is not waiting for review' using errcode = '23514';
  end if;
  if coalesce(cardinality(app.so_report_recipients(v_r.placement_id)), 0) < 1 then
    raise exception 'recipient_required: choose at least one recipient before this report can send' using errcode = '23514';
  end if;
  select * into v_pl from public.placement where id = v_r.placement_id;
  select * into v_cfg from public.sales_report_config where placement_id = v_pl.id;
  select * into v_setting from public.team_setting where id = 1;
  if p_when = 'now' then
    v_when := now();
  else
    v_local := now() at time zone v_pl.time_zone;
    v_dow := extract(isodow from v_local)::integer;
    v_send_dow := coalesce(v_cfg.send_dow, v_setting.report_weekly_dow);
    v_back := (v_send_dow - v_dow + 7) % 7;
    v_send_date := v_local::date + v_back;
    v_when := (v_send_date + coalesce(v_cfg.send_time, v_setting.report_weekly_time)::time) at time zone v_pl.time_zone;
    if v_when <= now() then
      v_when := v_when + interval '7 days';
    end if;
  end if;
  update public.sales_report set
    status = case when v_when <= now() then 'approved' else 'scheduled' end,
    summary = btrim(p_summary),
    next_focus = btrim(p_next),
    win_eod_ids = coalesce(p_wins, '{}'),
    approved_by = auth.uid(),
    approved_at = now(),
    scheduled_for = v_when,
    hold_note = null,
    updated_at = now()
  where id = p_id;
  perform app.audit('workspace.report.approved', 'sales_report', p_id::text, 'Approved a client report',
    jsonb_build_object('status', v_r.status), jsonb_build_object('when', p_when), v_pl.case_file_id);
end;
$$;

revoke all on function public.so_report_approve(uuid, text, text, uuid[], text) from public, anon;
grant execute on function public.so_report_approve(uuid, text, text, uuid[], text) to authenticated;

create or replace function public.so_report_hold(p_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r public.sales_report;
  v_case uuid;
begin
  perform app.so_require_team_staff();
  if app.is_impersonating() then
    raise exception 'view_as_read_only: exit View As to hold a report' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_note, ''))) < 1 then
    raise exception 'required: write why this report is held' using errcode = '23514';
  end if;
  select * into v_r from public.sales_report where id = p_id and not test and status in ('ready', 'approved', 'scheduled');
  if v_r.id is null then
    raise exception 'not_ready: this report cannot be held' using errcode = '23514';
  end if;
  update public.sales_report set status = 'held', hold_note = btrim(p_note), scheduled_for = null, updated_at = now() where id = p_id;
  select case_file_id into v_case from public.placement where id = v_r.placement_id;
  perform app.audit('workspace.report.held', 'sales_report', p_id::text, 'Held a client report', null, jsonb_build_object('note', btrim(p_note)), v_case);
  insert into public.sales_delivery (report_id, placement_id, channel, destination, status, subject_type, subject_id, payload)
  values (p_id, v_r.placement_id, 'discord', 'escalations', 'retrying', 'report', p_id::text || ':held',
    jsonb_build_object('text', 'Report held. ' || left(btrim(p_note), 180)))
  on conflict (channel, destination, subject_type, subject_id) do nothing;
end;
$$;

revoke all on function public.so_report_hold(uuid, text) from public, anon;
grant execute on function public.so_report_hold(uuid, text) to authenticated;

create or replace function public.so_report_list(p_status text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_rows jsonb;
begin
  perform app.so_require_team_staff();
  select coalesce(jsonb_agg(row_to_json(x) order by x.period_end desc), '[]'::jsonb) into v_rows
  from (
    select r.id, r.kind, r.status, r.period_start, r.period_end, r.test, r.sent_at, r.approval_due_at,
      r.drive_url, c.name as client, split_part(btrim(o.name), ' ', 1) as operator,
      (select count(*) from public.sales_report_feedback f where f.report_id = r.id) as feedback_count,
      (select max(f.rating) from public.sales_report_feedback f where f.report_id = r.id) as latest_rating
    from public.sales_report r
    join public.placement p on p.id = r.placement_id
    join public.client_case_file c on c.id = p.case_file_id
    join public.operator o on o.id = p.operator_id
    where p_status is null or p_status = '' or r.status = p_status
  ) x;
  return v_rows;
end;
$$;

revoke all on function public.so_report_list(text) from public, anon;
grant execute on function public.so_report_list(text) to authenticated;

create or replace function public.so_report_get(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_r public.sales_report;
  v_admin boolean;
  v_wins jsonb;
  v_feedback jsonb;
  v_deliveries jsonb;
begin
  v_admin := app.so_require_team_staff();
  select * into v_r from public.sales_report where id = p_id;
  if v_r.id is null then
    raise exception 'not_found: report' using errcode = 'P0002';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'date', e.work_date, 'text', left(btrim(e.wins), 500)) order by e.work_date desc), '[]'::jsonb)
  into v_wins
  from public.sales_eod e
  where e.placement_id = v_r.placement_id and e.submitted_at is not null
    and e.work_date between v_r.period_start and v_r.period_end
    and btrim(coalesce(e.wins, '')) <> '';
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', f.id, 'rating', f.rating, 'working', f.working, 'change', f.change_note,
    'inaccurate', f.inaccurate, 'inaccurate_note', f.inaccurate_note, 'name', f.author_name,
    'at', f.created_at, 'reviewed', f.reviewed_at is not null
  ) order by f.created_at), '[]'::jsonb)
  into v_feedback
  from public.sales_report_feedback f where f.report_id = p_id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', d.id, 'channel', d.channel, 'destination', d.destination, 'status', d.status,
    'at', d.updated_at, 'error', case when v_admin then d.error else null end
  ) order by d.created_at), '[]'::jsonb)
  into v_deliveries
  from public.sales_delivery d where d.report_id = p_id;
  return jsonb_build_object(
    'id', v_r.id,
    'status', v_r.status,
    'kind', v_r.kind,
    'test', v_r.test,
    'hold_note', v_r.hold_note,
    'summary', v_r.summary,
    'next_focus', v_r.next_focus,
    'win_eod_ids', v_r.win_eod_ids,
    'drive_url', v_r.drive_url,
    'sent_at', v_r.sent_at,
    'approval_due_at', v_r.approval_due_at,
    'client', app.so_report_client_json(p_id),
    'win_choices', v_wins,
    'feedback', v_feedback,
    'deliveries', v_deliveries
  );
end;
$$;

revoke all on function public.so_report_get(uuid) from public, anon;
grant execute on function public.so_report_get(uuid) to authenticated;

create or replace function public.so_eod_client_feedback(p_eod uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_eod public.sales_eod;
  v_rows jsonb;
begin
  select * into v_eod from public.sales_eod where id = p_eod;
  if v_eod.id is null then
    raise exception 'not_found: EOD' using errcode = 'P0002';
  end if;
  if not app.is_admin() and not app.is_manager() and v_eod.operator_id is distinct from (
    select id from public.operator where profile_id = app.acting_profile()
  ) then
    raise exception 'permission_denied: this EOD is not yours' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'rating', f.rating, 'working', f.working, 'change', f.change_note,
    'inaccurate', f.inaccurate, 'inaccurate_note', f.inaccurate_note,
    'name', f.author_name, 'at', f.created_at
  ) order by f.created_at), '[]'::jsonb)
  into v_rows
  from public.sales_report_feedback f
  join public.sales_report r on r.id = f.report_id
  where r.placement_id = v_eod.placement_id
    and v_eod.work_date between r.period_start and r.period_end
    and not r.test;
  return v_rows;
end;
$$;

revoke all on function public.so_eod_client_feedback(uuid) from public, anon;
grant execute on function public.so_eod_client_feedback(uuid) to authenticated;

-- 6. Public token ------------------------------------------------------------------

create or replace function app.so_token_hash(p_token text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;

revoke all on function app.so_token_hash(text) from public, anon, authenticated;

create or replace function public.so_report_mint(p_report uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r public.sales_report;
  v_days integer;
  v_raw text;
  v_id uuid;
begin
  select * into v_r from public.sales_report where id = p_report and not test;
  if v_r.id is null then
    return null;
  end if;
  if v_r.token_id is not null and exists (
    select 1 from public.client_feedback_token t
    where t.id = v_r.token_id and t.revoked_at is null and t.expires_at > now()
  ) then
    return null;
  end if;
  select client_feedback_token_days into v_days from public.team_setting where id = 1;
  v_raw := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.client_feedback_token (placement_id, period_start, period_end, token_hash, expires_at, report_id, created_by)
  values (v_r.placement_id, v_r.period_start, v_r.period_end, app.so_token_hash(v_raw), now() + make_interval(days => coalesce(v_days, 14)), v_r.id, auth.uid())
  returning id into v_id;
  update public.sales_report set token_id = v_id, updated_at = now() where id = p_report;
  return v_raw;
end;
$$;

revoke all on function public.so_report_mint(uuid) from public, anon, authenticated;
grant execute on function public.so_report_mint(uuid) to service_role;

create or replace function public.so_report_open(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t public.client_feedback_token;
  v_reply text;
  v_name text;
  v_emails text[];
begin
  if p_token is null or length(p_token) < 32 then
    return jsonb_build_object('state', 'expired');
  end if;
  select * into v_t from public.client_feedback_token where token_hash = app.so_token_hash(p_token);
  select coalesce(report_reply_to, reply_to) into v_reply from public.team_setting where id = 1;
  if v_t.id is null or v_t.expires_at <= now() then
    return jsonb_build_object('state', 'expired', 'reply_to', v_reply);
  end if;
  if v_t.revoked_at is not null then
    return jsonb_build_object('state', 'revoked', 'reply_to', v_reply);
  end if;
  insert into public.sales_token_event (token_id, kind) values (v_t.id, 'view');
  update public.client_feedback_token set
    first_used_at = coalesce(first_used_at, now()),
    last_used_at = now(),
    use_count = use_count + 1
  where id = v_t.id;
  v_emails := app.so_report_recipients(v_t.placement_id);
  if cardinality(v_emails) = 1 then
    select coalesce(c.contact_name, a.full_name) into v_name
    from public.placement p
    left join public.client_case_file c on c.id = p.case_file_id and lower(btrim(c.contact_email)) = v_emails[1]
    left join public.client_account a on a.case_file_id = p.case_file_id
    left join public.profile pr on pr.id = a.profile_id and lower(btrim(pr.email)) = v_emails[1]
    where p.id = v_t.placement_id
    limit 1;
  end if;
  return jsonb_build_object(
    'state', 'ok',
    'reply_to', v_reply,
    'suggested_name', v_name,
    'report', app.so_report_client_json(v_t.report_id)
  );
end;
$$;

revoke all on function public.so_report_open(text) from public;
grant execute on function public.so_report_open(text) to anon, authenticated, service_role;

create or replace function public.so_report_leave(
  p_token text, p_rating integer, p_working text, p_change text, p_inaccurate boolean, p_note text, p_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t public.client_feedback_token;
  v_r public.sales_report;
  v_pl public.placement;
  v_setting public.team_setting;
  v_id uuid;
  v_hour integer;
begin
  select * into v_t from public.client_feedback_token where token_hash = app.so_token_hash(coalesce(p_token, ''));
  if v_t.id is null or v_t.expires_at <= now() or v_t.revoked_at is not null or v_t.report_id is null then
    raise exception 'token_closed: this link is no longer open' using errcode = '42501';
  end if;
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception 'required: choose a rating from 1 to 5' using errcode = '23514';
  end if;
  if coalesce(p_inaccurate, false) and length(btrim(coalesce(p_note, ''))) < 1 then
    raise exception 'required: say what looks inaccurate' using errcode = '23514';
  end if;
  select count(*) into v_hour from public.sales_report_feedback f
  where f.token_id = v_t.id and f.created_at > now() - interval '1 hour';
  if v_hour >= 8 then
    raise exception 'rate_limited: this link has sent several notes this hour. Try again later.' using errcode = '23514';
  end if;
  insert into public.sales_report_feedback (report_id, token_id, rating, working, change_note, inaccurate, inaccurate_note, author_name)
  values (v_t.report_id, v_t.id, p_rating, nullif(btrim(coalesce(p_working, '')), ''), nullif(btrim(coalesce(p_change, '')), ''),
    coalesce(p_inaccurate, false), nullif(btrim(coalesce(p_note, '')), ''), nullif(btrim(coalesce(p_name, '')), ''))
  returning id into v_id;
  insert into public.sales_token_event (token_id, kind) values (v_t.id, 'submit');
  select * into v_r from public.sales_report where id = v_t.report_id;
  select * into v_pl from public.placement where id = v_r.placement_id;
  select * into v_setting from public.team_setting where id = 1;
  perform app.so_staff_alert('client_feedback', v_pl.operator_id, v_pl.id, v_pl.manager_profile_id, v_r.period_end,
    format('Client feedback arrived. Rating %s.', p_rating));
  perform app.so_operator_alert(v_pl.operator_id, v_pl.id, 'feedback_received', 'Client feedback',
    format('A client rated the report %s out of 5.', p_rating),
    '/workspace/operator/workspace/history/' || (
      select e.id::text from public.sales_eod e
      where e.placement_id = v_pl.id and e.work_date between v_r.period_start and v_r.period_end and e.submitted_at is not null
      order by e.work_date desc limit 1
    ));
  if p_rating <= v_setting.report_low_rating or coalesce(p_inaccurate, false) then
    perform app.so_staff_alert('client_feedback_low', v_pl.operator_id, v_pl.id, null, v_r.period_end,
      format('Client rating %s%s needs a look.', p_rating, case when coalesce(p_inaccurate, false) then ' and was marked inaccurate' else '' end));
    insert into public.sales_delivery (report_id, placement_id, channel, destination, status, subject_type, subject_id, payload)
    values (v_r.id, v_pl.id, 'discord', 'escalations', 'retrying', 'feedback', v_id::text,
      jsonb_build_object('text', format('Low client rating %s/5%s.', p_rating, case when coalesce(p_inaccurate, false) then '. Marked inaccurate.' else '.' end)))
    on conflict (channel, destination, subject_type, subject_id) do nothing;
    insert into public.sales_delivery (report_id, placement_id, channel, destination, status, subject_type, subject_id, payload)
    values (v_r.id, v_pl.id, 'clickup', 'escalations', 'retrying', 'feedback', v_id::text,
      jsonb_build_object('title', format('Client rating %s', p_rating), 'low', true))
    on conflict (channel, destination, subject_type, subject_id) do nothing;
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.so_report_leave(text, integer, text, text, boolean, text, text) from public;
grant execute on function public.so_report_leave(text, integer, text, text, boolean, text, text) to anon, authenticated, service_role;

create or replace function public.so_report_revoke(p_token uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t public.client_feedback_token;
begin
  perform app.so_require_team_staff();
  if app.is_impersonating() then
    raise exception 'view_as_read_only: exit View As to revoke a link' using errcode = '42501';
  end if;
  select * into v_t from public.client_feedback_token where id = p_token;
  if v_t.id is null then
    raise exception 'not_found: link' using errcode = 'P0002';
  end if;
  update public.client_feedback_token set revoked_at = now(), revoked_by = auth.uid() where id = p_token and revoked_at is null;
  perform app.audit('workspace.report.revoke', 'client_feedback_token', p_token::text, 'Revoked a client report link', null, null,
    (select case_file_id from public.placement where id = v_t.placement_id));
end;
$$;

revoke all on function public.so_report_revoke(uuid) from public, anon;
grant execute on function public.so_report_revoke(uuid) to authenticated;

create or replace function public.so_report_feedback_review(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_f public.sales_report_feedback;
begin
  perform app.so_require_team_staff();
  if app.is_impersonating() then
    raise exception 'view_as_read_only: exit View As to review feedback' using errcode = '42501';
  end if;
  select * into v_f from public.sales_report_feedback where id = p_id;
  if v_f.id is null then
    raise exception 'not_found: feedback' using errcode = 'P0002';
  end if;
  update public.sales_report_feedback set reviewed_at = now(), reviewed_by = auth.uid() where id = p_id and reviewed_at is null;
  insert into public.sales_delivery (report_id, placement_id, channel, destination, status, subject_type, subject_id, payload)
  select f.report_id, r.placement_id, 'clickup', 'comment', 'retrying', 'feedback', f.id::text || ':review',
    jsonb_build_object('comment', 'Reviewed in DA.')
  from public.sales_report_feedback f
  join public.sales_report r on r.id = f.report_id
  where f.id = p_id
  on conflict (channel, destination, subject_type, subject_id) do nothing;
end;
$$;

revoke all on function public.so_report_feedback_review(uuid) from public, anon;
grant execute on function public.so_report_feedback_review(uuid) to authenticated;

-- 7. Claim, finish, deliveries ------------------------------------------------------

create or replace function public.so_report_claim(p_limit integer default 5)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r public.sales_report;
  v_rows jsonb := '[]'::jsonb;
  v_pl public.placement;
  v_cfg public.sales_report_config;
  v_setting public.team_setting;
  v_to text[];
  v_cc text[];
  v_manager text;
begin
  perform set_config('app.report_sweep', 'on', true);
  select * into v_setting from public.team_setting where id = 1;
  for v_r in
    select * from public.sales_report r
    where (
      (r.sent_at is null and r.status in ('approved', 'scheduled', 'failed') and not r.resend_pending
        and (r.scheduled_for is null or r.scheduled_for <= now())
        and r.email_attempts < v_setting.report_fail_alert_after)
      or r.resend_pending
      or (r.test and r.sent_at is null and r.status = 'approved')
    )
    and (r.send_claimed_at is null or r.send_claimed_at < now() - interval '10 minutes')
    order by r.created_at
    limit greatest(p_limit, 1)
    for update skip locked
  loop
    update public.sales_report set send_claimed_at = now(), updated_at = now() where id = v_r.id;
    select * into v_pl from public.placement where id = v_r.placement_id;
    select * into v_cfg from public.sales_report_config where placement_id = v_pl.id;
    if v_r.test then
      v_to := array[v_r.test_to];
      v_cc := '{}';
    elsif v_r.resend_pending and v_r.resend_emails is not null then
      v_to := v_r.resend_emails;
      v_cc := '{}';
    else
      v_to := coalesce(app.so_report_recipients(v_pl.id), '{}');
      v_cc := coalesce(v_cfg.extra_cc, '{}');
      if coalesce(v_cfg.cc_manager, true) and v_pl.manager_profile_id is not null then
        select email into v_manager from public.profile where id = v_pl.manager_profile_id;
        if v_manager is not null then
          v_cc := v_cc || array[lower(v_manager)];
        end if;
      end if;
    end if;
    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'id', v_r.id,
      'test', v_r.test,
      'kind', v_r.kind,
      'resend_count', v_r.resend_count,
      'resend_pending', v_r.resend_pending,
      'token_id', v_r.token_id,
      'drive_file_id', v_r.drive_file_id,
      'to', to_jsonb(v_to),
      'cc', to_jsonb(v_cc),
      'reply_to', coalesce(v_setting.report_reply_to, v_setting.reply_to),
      'from_name', v_setting.from_name,
      'from_address', v_setting.from_address,
      'origin', coalesce(v_setting.report_page_origin, v_setting.base_url),
      'drive_enabled', v_setting.report_drive_enabled and not v_r.test,
      'drive_folder_id', v_setting.report_drive_folder_id,
      'discord_enabled', v_setting.report_discord_enabled and not v_r.test,
      'airtable_enabled', v_setting.report_airtable_enabled and not v_r.test,
      'clickup_enabled', v_setting.report_clickup_enabled and not v_r.test,
      'client', app.so_report_client_json(v_r.id)
    ));
  end loop;
  perform set_config('app.report_sweep', 'off', true);
  return v_rows;
end;
$$;

revoke all on function public.so_report_claim(integer) from public, anon, authenticated;
grant execute on function public.so_report_claim(integer) to service_role;

create or replace function public.so_report_finish(p_id uuid, p_ok boolean, p_error text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r public.sales_report;
  v_pl public.placement;
  v_after integer;
begin
  perform set_config('app.report_sweep', 'on', true);
  select * into v_r from public.sales_report where id = p_id;
  select * into v_pl from public.placement where id = v_r.placement_id;
  select report_fail_alert_after into v_after from public.team_setting where id = 1;
  if p_ok then
    update public.sales_report set
      status = 'sent',
      sent_at = coalesce(sent_at, now()),
      send_claimed_at = null,
      resend_pending = false,
      email_attempts = 0,
      updated_at = now()
    where id = p_id;
    if not v_r.test then
      perform app.so_staff_alert('report_sent', v_pl.operator_id, v_pl.id, v_pl.manager_profile_id, v_r.period_end,
        format('The %s report went out.', v_r.kind));
    end if;
  elsif v_r.resend_pending then
    update public.sales_report set
      send_claimed_at = null,
      email_attempts = email_attempts + 1,
      resend_pending = email_attempts + 1 < v_after,
      updated_at = now()
    where id = p_id;
  else
    update public.sales_report set
      status = 'failed',
      send_claimed_at = null,
      email_attempts = email_attempts + 1,
      updated_at = now()
    where id = p_id;
    if v_r.email_attempts + 1 >= v_after then
      perform app.so_staff_alert('report_failed', v_pl.operator_id, v_pl.id, v_pl.manager_profile_id, v_r.period_end,
        format('The report email failed. %s', left(coalesce(p_error, 'Send failed'), 180)));
    end if;
  end if;
  perform set_config('app.report_sweep', 'off', true);
end;
$$;

revoke all on function public.so_report_finish(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.so_report_finish(uuid, boolean, text) to service_role;

create or replace function public.so_report_resend(p_id uuid, p_emails text[] default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r public.sales_report;
  v_emails text[];
begin
  perform app.so_require_team_staff();
  if app.is_impersonating() then
    raise exception 'view_as_read_only: exit View As to resend' using errcode = '42501';
  end if;
  select * into v_r from public.sales_report where id = p_id and status = 'sent' and not test;
  if v_r.id is null then
    raise exception 'not_sent: resend a report that has already gone out' using errcode = '23514';
  end if;
  v_emails := case when p_emails is null then app.so_report_recipients(v_r.placement_id) else app.so_clean_emails(p_emails) end;
  if coalesce(cardinality(v_emails), 0) < 1 then
    raise exception 'recipient_required: choose at least one recipient' using errcode = '23514';
  end if;
  update public.sales_report set
    resend_pending = true,
    resend_emails = v_emails,
    resend_count = resend_count + 1,
    send_claimed_at = null,
    email_attempts = 0,
    updated_at = now()
  where id = p_id;
  perform app.audit('workspace.report.resend', 'sales_report', p_id::text, 'Queued a resend of a client report',
    null, jsonb_build_object('recipients', v_emails), (select case_file_id from public.placement where id = v_r.placement_id));
end;
$$;

revoke all on function public.so_report_resend(uuid, text[]) from public, anon;
grant execute on function public.so_report_resend(uuid, text[]) to authenticated;

create or replace function public.so_report_test(p_placement uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_src public.sales_report;
  v_id uuid;
  v_start date;
  v_end date;
begin
  perform app.so_require_team_staff();
  if app.is_impersonating() then
    raise exception 'view_as_read_only: exit View As to send a test' using errcode = '42501';
  end if;
  select email into v_email from public.profile where id = auth.uid();
  if v_email is null then
    raise exception 'required: your profile has no email' using errcode = '23514';
  end if;
  select * into v_src from public.sales_report
  where placement_id = p_placement and not test
  order by period_end desc limit 1;
  if v_src.id is null then
    v_end := (now() at time zone (select time_zone from public.placement where id = p_placement))::date - 1;
    v_start := v_end - 6;
  else
    v_start := v_src.period_start;
    v_end := v_src.period_end;
  end if;
  insert into public.sales_report (placement_id, kind, period_start, period_end, status, test, test_to, summary, next_focus, win_eod_ids, scheduled_for, approved_at, auto_summary)
  values (p_placement, coalesce(v_src.kind, 'weekly'), v_start, v_end, 'approved', true, lower(v_email),
    coalesce(v_src.summary, 'Test report.'), coalesce(v_src.next_focus, 'Test only.'), coalesce(v_src.win_eod_ids, '{}'), now(), now(), true)
  returning id into v_id;
  perform app.audit('workspace.report.test', 'sales_report', v_id::text, 'Queued a test report to the person who clicked it',
    null, jsonb_build_object('to', lower(v_email)), (select case_file_id from public.placement where id = p_placement));
  return v_id;
end;
$$;

revoke all on function public.so_report_test(uuid) from public, anon;
grant execute on function public.so_report_test(uuid) to authenticated;

create or replace function public.so_delivery_list(p_channel text, p_status text, p_placement uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_admin boolean;
  v_rows jsonb;
begin
  v_admin := app.so_require_team_staff();
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', d.id, 'channel', d.channel, 'destination', d.destination, 'status', d.status,
    'subject_type', d.subject_type, 'at', d.updated_at, 'attempt', d.attempt,
    'error', case when v_admin then d.error else null end,
    'client', c.name
  ) order by d.updated_at desc), '[]'::jsonb)
  into v_rows
  from public.sales_delivery d
  left join public.placement p on p.id = d.placement_id
  left join public.client_case_file c on c.id = p.case_file_id
  where (p_channel is null or p_channel = '' or d.channel = p_channel)
    and (p_status is null or p_status = '' or d.status = p_status)
    and (p_placement is null or d.placement_id = p_placement)
    and (p_from is null or d.created_at::date >= p_from)
    and (p_to is null or d.created_at::date <= p_to)
    and (v_admin or p.manager_profile_id = app.acting_profile());
  return v_rows;
end;
$$;

revoke all on function public.so_delivery_list(text, text, uuid, date, date) from public, anon;
grant execute on function public.so_delivery_list(text, text, uuid, date, date) to authenticated;

create or replace function public.so_delivery_retry(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_d public.sales_delivery;
begin
  if not app.is_admin() or app.is_impersonating() then
    raise exception 'admin_required: only DA Admin retries a delivery' using errcode = '42501';
  end if;
  select * into v_d from public.sales_delivery where id = p_id;
  if v_d.id is null then
    raise exception 'not_found: delivery' using errcode = 'P0002';
  end if;
  update public.sales_delivery set status = 'retrying', error = null, updated_at = now() where id = p_id;
  if v_d.channel = 'email' and v_d.report_id is not null then
    update public.sales_report set status = 'approved', send_claimed_at = null, email_attempts = 0, scheduled_for = now(), updated_at = now()
    where id = v_d.report_id and sent_at is null;
  end if;
  perform app.audit('workspace.report.retry', 'sales_delivery', p_id::text, 'Retry a failed delivery', null, jsonb_build_object('channel', v_d.channel), null);
end;
$$;

revoke all on function public.so_delivery_retry(uuid) from public, anon;
grant execute on function public.so_delivery_retry(uuid) to authenticated;

create or replace function public.so_delivery_due(p_limit integer default 20)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows jsonb;
begin
  perform set_config('app.report_sweep', 'on', true);
  with due as (
    select d.id from public.sales_delivery d
    where d.status = 'retrying' and d.attempt < (select report_fail_alert_after from public.team_setting where id = 1)
    order by d.created_at
    limit greatest(p_limit, 1)
    for update skip locked
  )
  update public.sales_delivery d set attempt = d.attempt + 1, updated_at = now()
  from due where d.id = due.id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', d.id, 'channel', d.channel, 'destination', d.destination,
    'subject_type', d.subject_type, 'subject_id', d.subject_id,
    'report_id', d.report_id, 'placement_id', d.placement_id, 'payload', d.payload, 'external_id', d.external_id
  )), '[]'::jsonb) into v_rows
  from public.sales_delivery d
  where d.status = 'retrying' and d.updated_at > now() - interval '5 seconds';
  perform set_config('app.report_sweep', 'off', true);
  return v_rows;
end;
$$;

revoke all on function public.so_delivery_due(integer) from public, anon, authenticated;
grant execute on function public.so_delivery_due(integer) to service_role;

create or replace function public.so_delivery_result(p_id uuid, p_ok boolean, p_error text, p_external text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_d public.sales_delivery;
  v_after integer;
  v_pl public.placement;
begin
  perform set_config('app.report_sweep', 'on', true);
  select * into v_d from public.sales_delivery where id = p_id;
  select report_fail_alert_after into v_after from public.team_setting where id = 1;
  if p_ok then
    update public.sales_delivery set status = 'sent', error = null, external_id = coalesce(p_external, external_id), updated_at = now() where id = p_id;
  else
    update public.sales_delivery set
      status = case when attempt >= v_after then 'failed' else 'retrying' end,
      error = left(coalesce(p_error, 'Delivery failed'), 500),
      updated_at = now()
    where id = p_id;
    if v_d.attempt >= v_after then
      select * into v_pl from public.placement where id = v_d.placement_id;
      if v_pl.id is not null then
        perform app.so_staff_alert('report_failed', v_pl.operator_id, v_pl.id, null, current_date,
          format('%s to %s failed. %s', v_d.channel, v_d.destination, left(coalesce(p_error, ''), 140)));
      end if;
    end if;
  end if;
  if p_ok and v_d.channel = 'drive' and v_d.report_id is not null and p_external is not null then
    update public.sales_report set drive_file_id = split_part(p_external, '|', 1), drive_url = nullif(split_part(p_external, '|', 2), ''), updated_at = now()
    where id = v_d.report_id;
  end if;
  perform set_config('app.report_sweep', 'off', true);
end;
$$;

revoke all on function public.so_delivery_result(uuid, boolean, text, text) from public, anon, authenticated;
grant execute on function public.so_delivery_result(uuid, boolean, text, text) to service_role;

create or replace function public.so_delivery_note(
  p_report uuid, p_placement uuid, p_channel text, p_destination text,
  p_subject text, p_ok boolean, p_error text, p_external text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform set_config('app.report_sweep', 'on', true);
  insert into public.sales_delivery (report_id, placement_id, channel, destination, status, subject_type, subject_id, attempt, error, external_id)
  values (
    p_report, p_placement, p_channel, p_destination,
    case when p_ok then 'sent' when p_channel = 'email' or p_channel = 'pdf' then 'failed' else 'retrying' end,
    'report', p_subject, 1, case when p_ok then null else left(coalesce(p_error, 'Failed'), 500) end, p_external
  )
  on conflict (channel, destination, subject_type, subject_id) do update set
    status = excluded.status,
    error = excluded.error,
    external_id = coalesce(excluded.external_id, public.sales_delivery.external_id),
    attempt = public.sales_delivery.attempt + 1,
    updated_at = now()
  returning id into v_id;
  if p_ok and p_channel = 'drive' and p_report is not null and p_external is not null then
    update public.sales_report set
      drive_file_id = split_part(p_external, '|', 1),
      drive_url = nullif(split_part(p_external, '|', 2), ''),
      updated_at = now()
    where id = p_report;
  end if;
  perform set_config('app.report_sweep', 'off', true);
  return v_id;
end;
$$;

revoke all on function public.so_delivery_note(uuid, uuid, text, text, text, boolean, text, text) from public, anon, authenticated;
grant execute on function public.so_delivery_note(uuid, uuid, text, text, text, boolean, text, text) to service_role;

-- Discord copy for an EOD. Verified numbers, plus wins and blockers for the ops channel.
-- Mismatch rows are not read.
create or replace function public.so_outbound_catchup()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eod public.sales_eod;
  v_pl public.placement;
  v_op text;
  v_client text;
  v_num jsonb;
  v_lines text := '';
  v_metric text;
  v_n integer := 0;
  v_dest text;
  v_alert record;
begin
  perform set_config('app.report_sweep', 'on', true);
  for v_eod in
    select * from public.sales_eod e
    where e.submitted_at is not null and e.submitted_at > now() - interval '3 days'
  loop
    select * into v_pl from public.placement where id = v_eod.placement_id;
    select name into v_op from public.operator where id = v_eod.operator_id;
    select name into v_client from public.client_case_file where id = v_pl.case_file_id;
    v_lines := '';
    foreach v_metric in array array['conversations_held', 'dials_made', 'texts_sent', 'replies_received'] loop
      v_num := app.so_client_metric(v_pl.id, v_eod.work_date, v_eod.work_date, v_metric, null, false);
      if v_num is not null then
        v_lines := v_lines || format(E'\n%s: %s%s',
          (select label from public.activity_metric where key = v_metric),
          v_num ->> 'value',
          case when (v_num ->> 'reported')::boolean then ' (Operator reported)' else '' end);
      end if;
    end loop;
    v_dest := case when exists (
      select 1 from public.sales_report_config c where c.placement_id = v_pl.id and c.discord_webhook_secret is not null
    ) then 'client' else 'ops' end;
    insert into public.sales_delivery (placement_id, channel, destination, status, subject_type, subject_id, payload)
    values (v_pl.id, 'discord', v_dest, 'retrying', 'eod', v_eod.id::text, jsonb_build_object(
      'text', format(E'%s · %s · %s · %s%s%s%s%s\n%s',
        v_op, v_client, v_eod.work_date, case when v_eod.was_late then 'Late' else 'On time' end,
        v_lines,
        case when btrim(coalesce(v_eod.wins, '')) = '' then '' else E'\nWins: ' || left(btrim(v_eod.wins), 200) end,
        case when btrim(coalesce(v_eod.blockers, '')) = '' or v_eod.blockers = 'No blockers today.' then '' else E'\nBlockers: ' || left(btrim(v_eod.blockers), 200) end,
        case when v_eod.needs_help then E'\nNeeds manager help' else '' end,
        '/workspace/team/workspace/eods/' || v_eod.id::text)
    ))
    on conflict (channel, destination, subject_type, subject_id) do nothing;
    if v_eod.status = 'missed' or v_eod.was_late then
      insert into public.sales_delivery (placement_id, channel, destination, status, subject_type, subject_id, payload)
      values (v_pl.id, 'clickup', 'comment', 'retrying', 'eod', v_eod.id::text || ':resolved',
        jsonb_build_object('comment', 'EOD submitted in DA.', 'match_placement', v_pl.id))
      on conflict (channel, destination, subject_type, subject_id) do nothing;
    end if;
    v_n := v_n + 1;
  end loop;

  for v_alert in
    select a.id, a.kind, a.placement_id, a.summary, a.period_on
    from public.workspace_alert a
    where a.kind in ('eod_late', 'eod_manager', 'eod_missed', 'eod_needs_help', 'ghl_sync')
      and a.created_at > now() - interval '3 days'
  loop
    insert into public.sales_delivery (placement_id, channel, destination, status, subject_type, subject_id, payload)
    values (v_alert.placement_id, 'discord', 'escalations', 'retrying', 'alert', v_alert.id::text, jsonb_build_object(
      'text', case v_alert.kind
        when 'ghl_sync' then format('Sync connection needs attention (%s).', v_alert.period_on)
        else left(v_alert.summary, 300)
      end
    ))
    on conflict (channel, destination, subject_type, subject_id) do nothing;
    if v_alert.kind in ('eod_missed', 'eod_needs_help') then
      insert into public.sales_delivery (placement_id, channel, destination, status, subject_type, subject_id, payload)
      values (v_alert.placement_id, 'clickup', 'escalations', 'retrying', 'alert', v_alert.id::text,
        jsonb_build_object('title', left(v_alert.summary, 120), 'link', '/workspace/team/workspace',
          'manager', (select pl.manager_profile_id from public.placement pl where pl.id = v_alert.placement_id)))
      on conflict (channel, destination, subject_type, subject_id) do nothing;
    end if;
  end loop;
  perform set_config('app.report_sweep', 'off', true);
  return v_n;
end;
$$;

revoke all on function public.so_outbound_catchup() from public, anon, authenticated;
grant execute on function public.so_outbound_catchup() to service_role;

-- One-way Airtable rows. Verified numbers only. No pay, mismatches, or emails.
create or replace function public.so_airtable_export()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ops jsonb;
  v_pl jsonb;
  v_eod jsonb;
  v_metrics jsonb;
  v_reports jsonb;
  v_feedback jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'DA ID', o.id, 'Name', o.name, 'Role', 'Sales Operator',
    'Placement status', p.status::text, 'Client', c.name,
    'Manager', m.full_name, 'Certification level', app.so_certification_level(o.profile_id)
  )), '[]'::jsonb) into v_ops
  from public.operator o
  join public.placement p on p.operator_id = o.id and p.status = 'active' and p.placement_type is not null
  join public.client_case_file c on c.id = p.case_file_id
  left join public.profile m on m.id = p.manager_profile_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'DA ID', p.id, 'Operator', o.name, 'Client', c.name, 'Type', p.placement_type,
    'Status', p.status::text, 'Start date', p.start_date, 'Manager', m.full_name
  )), '[]'::jsonb) into v_pl
  from public.placement p
  join public.operator o on o.id = p.operator_id
  join public.client_case_file c on c.id = p.case_file_id
  left join public.profile m on m.id = p.manager_profile_id
  where p.placement_type is not null;

  select coalesce(jsonb_agg(jsonb_build_object(
    'DA ID', e.id, 'Operator', o.name, 'Client', c.name, 'Date', e.work_date,
    'Status', e.status, 'On time', case when e.was_late then 'Late' else 'On time' end,
    'Submitted time', e.submitted_at, 'Wins', left(coalesce(e.wins, ''), 1000),
    'Blockers', left(coalesce(e.blockers, ''), 1000),
    'Tomorrow plan', left(coalesce(e.tomorrow_plan, ''), 1000),
    'Needs help', e.needs_help,
    'Feedback count', (select count(*) from public.sales_report_feedback f join public.sales_report r on r.id = f.report_id
      where r.placement_id = e.placement_id and e.work_date between r.period_start and r.period_end)
  )), '[]'::jsonb) into v_eod
  from public.sales_eod e
  join public.operator o on o.id = e.operator_id
  join public.placement p on p.id = e.placement_id
  join public.client_case_file c on c.id = p.case_file_id
  where e.submitted_at is not null and e.submitted_at > now() - interval '45 days';

  select coalesce(jsonb_agg(jsonb_build_object(
    'DA ID', d.id::text || ':' || m.key, 'Operator', o.name, 'Client', c.name, 'Date', d.work_date,
    'Metric', m.label, 'Value', (app.so_client_metric(d.placement_id, d.work_date, d.work_date, m.key, null, m.by_outcome) ->> 'value')::numeric
  )), '[]'::jsonb) into v_metrics
  from public.activity_day d
  join public.placement p on p.id = d.placement_id
  join public.operator o on o.id = d.operator_id
  join public.client_case_file c on c.id = p.case_file_id
  join public.activity_metric m on m.active
  where d.work_date > current_date - 14
    and app.so_client_metric(d.placement_id, d.work_date, d.work_date, m.key, null, m.by_outcome) is not null;

  select coalesce(jsonb_agg(jsonb_build_object(
    'DA ID', r.id, 'Client', c.name, 'Period', r.period_start::text || ' to ' || r.period_end::text,
    'Type', r.kind, 'Status', r.status, 'Sent time', r.sent_at,
    'Recipients count', coalesce(cardinality(app.so_report_recipients(r.placement_id)), 0),
    'Drive link', r.drive_url
  )), '[]'::jsonb) into v_reports
  from public.sales_report r
  join public.placement p on p.id = r.placement_id
  join public.client_case_file c on c.id = p.case_file_id
  where not r.test;

  select coalesce(jsonb_agg(jsonb_build_object(
    'DA ID', f.id, 'Client', c.name, 'Report', f.report_id, 'Rating', f.rating,
    'Comments', left(concat_ws(' ', f.working, f.change_note, f.inaccurate_note), 1000),
    'Inaccurate', f.inaccurate, 'Submitted time', f.created_at
  )), '[]'::jsonb) into v_feedback
  from public.sales_report_feedback f
  join public.sales_report r on r.id = f.report_id
  join public.placement p on p.id = r.placement_id
  join public.client_case_file c on c.id = p.case_file_id;

  return jsonb_build_object(
    'Operators', v_ops, 'Placements', v_pl, 'EODs', v_eod,
    'Daily Metrics', v_metrics, 'Reports', v_reports, 'Client Feedback', v_feedback
  );
end;
$$;

revoke all on function public.so_airtable_export() from public, anon, authenticated;
grant execute on function public.so_airtable_export() to service_role;

-- Settings. Keeps every earlier field.
create or replace function public.so_save_settings(p_settings jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.team_setting;
  v_new public.team_setting;
  v_fields constant text[] := array[
    'mismatch_tolerance_pct', 'mismatch_small_count_under', 'mismatch_small_count_gap',
    'eod_reminder_minutes_before', 'eod_late_minutes_after', 'eod_manager_alert_minutes_after',
    'eod_missed_rule', 'eod_missed_hours_after', 'eod_edit_rule', 'eod_edit_hours_after',
    'eod_hours_worked_enabled', 'eod_note_to_manager_enabled', 'eod_min_text_chars',
    'client_feedback_token_days', 'speed_to_lead_target_seconds',
    'target_override_min_pct', 'target_override_max_pct',
    'cert_warning_days', 'cert_grace_days', 'view_as_idle_minutes', 'placement_review_months',
    'ghl_sync_interval_minutes', 'ghl_connect_seconds', 'ghl_conversation_seconds',
    'ghl_reply_window_days', 'ghl_noshow_window_days', 'ghl_stl_pause_outside_shift',
    'ghl_stl_notouch_hours', 'ghl_backfill_days', 'ghl_sync_fail_after',
    'report_reply_to', 'report_weekly_dow', 'report_weekly_time', 'report_approval_hours',
    'report_low_rating', 'report_page_origin', 'report_drive_enabled', 'report_discord_enabled',
    'report_airtable_enabled', 'report_clickup_enabled', 'report_drive_folder_id', 'report_fail_alert_after'];
  s jsonb := p_settings;
begin
  if not app.is_admin() then
    raise exception 'admin_required: only DA Admin changes workspace settings' using errcode = '42501';
  end if;
  if app.is_impersonating() then
    raise exception 'view_as_read_only: exit View As to change settings' using errcode = '42501';
  end if;
  if s ? 'eod_min_text_chars' and (s ->> 'eod_min_text_chars')::integer not between 1 and 500 then
    raise exception 'invalid: the minimum length is between 1 and 500 characters' using errcode = '23514';
  end if;
  if s ? 'report_page_origin' and nullif(s ->> 'report_page_origin', '') is not null then
    perform app.so_origin(s ->> 'report_page_origin');
  end if;
  select * into v_old from public.team_setting where id = 1 for update;
  update public.team_setting set
    mismatch_tolerance_pct = coalesce((s ->> 'mismatch_tolerance_pct')::numeric, mismatch_tolerance_pct),
    mismatch_small_count_under = coalesce((s ->> 'mismatch_small_count_under')::integer, mismatch_small_count_under),
    mismatch_small_count_gap = coalesce((s ->> 'mismatch_small_count_gap')::numeric, mismatch_small_count_gap),
    eod_reminder_minutes_before = coalesce((s ->> 'eod_reminder_minutes_before')::integer, eod_reminder_minutes_before),
    eod_late_minutes_after = coalesce((s ->> 'eod_late_minutes_after')::integer, eod_late_minutes_after),
    eod_manager_alert_minutes_after = coalesce((s ->> 'eod_manager_alert_minutes_after')::integer, eod_manager_alert_minutes_after),
    eod_missed_rule = coalesce(s ->> 'eod_missed_rule', eod_missed_rule),
    eod_missed_hours_after = case when s ? 'eod_missed_hours_after' then (s ->> 'eod_missed_hours_after')::integer else eod_missed_hours_after end,
    eod_edit_rule = coalesce(s ->> 'eod_edit_rule', eod_edit_rule),
    eod_edit_hours_after = case when s ? 'eod_edit_hours_after' then (s ->> 'eod_edit_hours_after')::integer else eod_edit_hours_after end,
    eod_hours_worked_enabled = coalesce((s ->> 'eod_hours_worked_enabled')::boolean, eod_hours_worked_enabled),
    eod_note_to_manager_enabled = coalesce((s ->> 'eod_note_to_manager_enabled')::boolean, eod_note_to_manager_enabled),
    eod_min_text_chars = coalesce((s ->> 'eod_min_text_chars')::integer, eod_min_text_chars),
    client_feedback_token_days = coalesce((s ->> 'client_feedback_token_days')::integer, client_feedback_token_days),
    speed_to_lead_target_seconds = case when s ? 'speed_to_lead_target_seconds' then (s ->> 'speed_to_lead_target_seconds')::integer else speed_to_lead_target_seconds end,
    target_override_min_pct = case when s ? 'target_override_min_pct' then (s ->> 'target_override_min_pct')::integer else target_override_min_pct end,
    target_override_max_pct = case when s ? 'target_override_max_pct' then (s ->> 'target_override_max_pct')::integer else target_override_max_pct end,
    cert_warning_days = coalesce((s ->> 'cert_warning_days')::integer, cert_warning_days),
    cert_grace_days = coalesce((s ->> 'cert_grace_days')::integer, cert_grace_days),
    view_as_idle_minutes = coalesce((s ->> 'view_as_idle_minutes')::integer, view_as_idle_minutes),
    placement_review_months = coalesce((s ->> 'placement_review_months')::integer, placement_review_months),
    ghl_sync_interval_minutes = coalesce((s ->> 'ghl_sync_interval_minutes')::integer, ghl_sync_interval_minutes),
    ghl_connect_seconds = coalesce((s ->> 'ghl_connect_seconds')::integer, ghl_connect_seconds),
    ghl_conversation_seconds = coalesce((s ->> 'ghl_conversation_seconds')::integer, ghl_conversation_seconds),
    ghl_reply_window_days = coalesce((s ->> 'ghl_reply_window_days')::integer, ghl_reply_window_days),
    ghl_noshow_window_days = coalesce((s ->> 'ghl_noshow_window_days')::integer, ghl_noshow_window_days),
    ghl_stl_pause_outside_shift = coalesce((s ->> 'ghl_stl_pause_outside_shift')::boolean, ghl_stl_pause_outside_shift),
    ghl_stl_notouch_hours = coalesce((s ->> 'ghl_stl_notouch_hours')::integer, ghl_stl_notouch_hours),
    ghl_backfill_days = coalesce((s ->> 'ghl_backfill_days')::integer, ghl_backfill_days),
    ghl_sync_fail_after = coalesce((s ->> 'ghl_sync_fail_after')::integer, ghl_sync_fail_after),
    report_reply_to = case when s ? 'report_reply_to' then nullif(s ->> 'report_reply_to', '') else report_reply_to end,
    report_weekly_dow = coalesce((s ->> 'report_weekly_dow')::smallint, report_weekly_dow),
    report_weekly_time = coalesce(nullif(s ->> 'report_weekly_time', ''), report_weekly_time),
    report_approval_hours = coalesce((s ->> 'report_approval_hours')::integer, report_approval_hours),
    report_low_rating = coalesce((s ->> 'report_low_rating')::smallint, report_low_rating),
    report_page_origin = case when s ? 'report_page_origin' then app.so_origin(s ->> 'report_page_origin') else report_page_origin end,
    report_drive_enabled = coalesce((s ->> 'report_drive_enabled')::boolean, report_drive_enabled),
    report_discord_enabled = coalesce((s ->> 'report_discord_enabled')::boolean, report_discord_enabled),
    report_airtable_enabled = coalesce((s ->> 'report_airtable_enabled')::boolean, report_airtable_enabled),
    report_clickup_enabled = coalesce((s ->> 'report_clickup_enabled')::boolean, report_clickup_enabled),
    report_drive_folder_id = case when s ? 'report_drive_folder_id' then nullif(s ->> 'report_drive_folder_id', '') else report_drive_folder_id end,
    report_clickup_folder_id = case when s ? 'report_clickup_folder_id' then nullif(s ->> 'report_clickup_folder_id', '') else report_clickup_folder_id end,
    report_airtable_base_id = case when s ? 'report_airtable_base_id' then nullif(s ->> 'report_airtable_base_id', '') else report_airtable_base_id end,
    report_clickup_escalation_list_id = case when s ? 'report_clickup_escalation_list_id' then nullif(s ->> 'report_clickup_escalation_list_id', '') else report_clickup_escalation_list_id end,
    report_clickup_users = case when s ? 'report_clickup_users' then coalesce(s -> 'report_clickup_users', '{}'::jsonb) else report_clickup_users end,
    report_fail_alert_after = coalesce((s ->> 'report_fail_alert_after')::integer, report_fail_alert_after),
    updated_by = auth.uid(),
    updated_at = now()
  where id = 1
  returning * into v_new;
  if v_new.eod_missed_rule = 'hours_after_deadline' and v_new.eod_missed_hours_after is null then
    raise exception 'required: set how many hours after the deadline an EOD becomes Missed' using errcode = '23514';
  end if;
  if v_new.eod_edit_rule = 'hours_after_submit' and v_new.eod_edit_hours_after is null then
    raise exception 'required: set how many hours after submitting an EOD stays editable' using errcode = '23514';
  end if;
  if v_new.target_override_min_pct is not null and v_new.target_override_max_pct is not null
     and v_new.target_override_min_pct > v_new.target_override_max_pct then
    raise exception 'invalid: the override floor is above the ceiling' using errcode = '23514';
  end if;
  perform app.audit('workspace.settings', 'team_setting', '1', 'Changed Sales Operator workspace settings',
    (select jsonb_object_agg(k, to_jsonb(v_old) -> k) from unnest(v_fields) k),
    (select jsonb_object_agg(k, to_jsonb(v_new) -> k) from unnest(v_fields) k));
end;
$$;

revoke all on function public.so_save_settings(jsonb) from public, anon;
grant execute on function public.so_save_settings(jsonb) to authenticated;

create or replace function public.so_report_payload(p_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select app.so_report_client_json(p_id);
$$;

revoke all on function public.so_report_payload(uuid) from public, anon, authenticated;
grant execute on function public.so_report_payload(uuid) to service_role;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'sales-report-sweep') then
    perform cron.unschedule('sales-report-sweep');
  end if;
  perform cron.schedule('sales-report-sweep', '*/15 * * * *', 'select public.so_report_sweep()');
end $$;
