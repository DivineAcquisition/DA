-- Prompt 1 decisions.
--
-- Managers and DA Admin see every operator's workspace data. The assigned
-- manager routes alerts and feedback, and does not limit who can read.
-- Mismatches, tokens, and pay stay DA Admin only.
--
-- A certification stays valid through a grace period after its re-certify date.
-- A placement with no end date stays open until someone ends it. Three months
-- after the start is a review date, not an end date. The coverage date stored
-- for an open placement is 9999-12-31 so existing reports, which treat
-- end_date as the last covered day, keep including it. Nothing ends a
-- placement when that date arrives.
--
-- Show rate and closes come from GHL. Operators cannot edit them.
-- View As stays read-only, ends after an idle window, and is not shown to the
-- operator.

-- 1. Settings -----------------------------------------------------------------------

alter table public.team_setting
  add column if not exists cert_warning_days integer not null default 14
    check (cert_warning_days between 1 and 365),
  add column if not exists cert_grace_days integer not null default 7
    check (cert_grace_days between 0 and 365),
  add column if not exists view_as_idle_minutes integer not null default 30
    check (view_as_idle_minutes between 5 and 240),
  add column if not exists placement_review_months integer not null default 3
    check (placement_review_months between 1 and 36);

comment on column public.team_setting.cert_warning_days is
  'Show the operator a re-certification warning this many days before the date.';
comment on column public.team_setting.cert_grace_days is
  'Full workspace access continues this many days after the re-certify date. Then the operator sees the not-certified page.';
comment on column public.team_setting.view_as_idle_minutes is
  'A View As session ends after this many minutes with no page view.';
comment on column public.team_setting.placement_review_months is
  'A new placement with no end date is reviewed this many months after it starts. The placement stays active until someone ends it.';

-- 2. Review date, and open placements ------------------------------------------------

alter table public.placement
  add column if not exists review_on date;

comment on column public.placement.review_on is
  'When the assigned manager and DA Admin review the placement. Not an end date. Null on placements that are not part of the workspace.';
comment on column public.placement.end_date is
  'Last day the placement covers for existing reports. 9999-12-31 means no end date: it stays active until someone ends it.';

-- Open workspace placements get a review date. Direct inserts included.
create or replace function app.so_placement_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_months integer;
begin
  if new.placement_type is not null and new.review_on is null then
    select s.placement_review_months into v_months from public.team_setting s where s.id = 1;
    new.review_on := (new.start_date + make_interval(months => coalesce(v_months, 3)))::date;
  end if;
  if new.end_date is null then
    new.end_date := date '9999-12-31';
  end if;
  return new;
end;
$$;

revoke all on function app.so_placement_review() from public, anon, authenticated;

drop trigger if exists placement_review_on on public.placement;
create trigger placement_review_on
  before insert or update of start_date, placement_type, review_on, end_date on public.placement
  for each row execute function app.so_placement_review();

-- 3. Show rate and closes come from GHL ----------------------------------------------

update public.activity_metric set
  source = 'ghl',
  operator_editable = false,
  description = 'Share of booked appointments that showed, from appointment status in GHL. Tracked only when the placement tracks results. Operators cannot edit it.'
where key = 'show_rate';

update public.activity_metric set
  source = 'ghl',
  operator_editable = false,
  description = 'Opportunities marked won in GHL. Tracked only when the placement tracks results. Operators cannot edit it.'
where key = 'closes';

-- 4. Staff alerts for grace and review -----------------------------------------------

create table if not exists public.workspace_alert (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('cert_grace', 'placement_review')),
  operator_id uuid not null references public.operator (id) on delete cascade,
  placement_id uuid references public.placement (id) on delete cascade,
  manager_profile_id uuid references public.profile (id) on delete set null,
  period_on date not null,
  summary text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists workspace_alert_cert_once
  on public.workspace_alert (operator_id, period_on) where kind = 'cert_grace';
create unique index if not exists workspace_alert_review_once
  on public.workspace_alert (placement_id, period_on) where kind = 'placement_review';

comment on table public.workspace_alert is
  'Alerts for the assigned manager and DA Admin. Operators cannot read this table. Mismatches are a different table and stay admin-only.';

alter table public.workspace_alert enable row level security;
revoke all on public.workspace_alert from anon, authenticated;
grant select on public.workspace_alert to authenticated;
grant select, insert, update, delete on public.workspace_alert to service_role;

drop policy if exists workspace_alert_admin_read on public.workspace_alert;
create policy workspace_alert_admin_read on public.workspace_alert
  for select to authenticated using (app.is_admin());

drop policy if exists workspace_alert_manager_read on public.workspace_alert;
create policy workspace_alert_manager_read on public.workspace_alert
  for select to authenticated
  using (app.is_manager() and manager_profile_id = app.acting_profile());

-- 5. Managers read every operator's workspace data -----------------------------------

drop policy if exists placement_outcome_type_manager_read on public.placement_outcome_type;
create policy placement_outcome_type_manager_read on public.placement_outcome_type
  for select to authenticated using (app.is_manager());

drop policy if exists activity_target_manager_read on public.activity_target;
create policy activity_target_manager_read on public.activity_target
  for select to authenticated using (app.is_manager());

drop policy if exists activity_day_manager_read on public.activity_day;
create policy activity_day_manager_read on public.activity_day
  for select to authenticated using (app.is_manager());

drop policy if exists activity_value_manager_read on public.activity_value;
create policy activity_value_manager_read on public.activity_value
  for select to authenticated using (app.is_manager());

drop policy if exists sales_eod_manager_read on public.sales_eod;
create policy sales_eod_manager_read on public.sales_eod
  for select to authenticated using (app.is_manager());

drop policy if exists sales_eod_revision_manager_read on public.sales_eod_revision;
create policy sales_eod_revision_manager_read on public.sales_eod_revision
  for select to authenticated using (app.is_manager());

drop policy if exists sales_eod_feedback_manager_read on public.sales_eod_feedback;
create policy sales_eod_feedback_manager_read on public.sales_eod_feedback
  for select to authenticated using (app.is_manager());

drop policy if exists operator_performance_week_manager_read on public.operator_performance_week;
create policy operator_performance_week_manager_read on public.operator_performance_week
  for select to authenticated using (app.is_manager());

drop policy if exists operator_recert_flag_manager_read on public.operator_recert_flag;
create policy operator_recert_flag_manager_read on public.operator_recert_flag
  for select to authenticated using (app.is_manager());

-- 6. Certification, with warning and grace -------------------------------------------

create or replace function app.so_certification_level(p_profile_id uuid)
returns smallint
language sql
stable
security definer
set search_path = ''
as $$
  select max(c.level)
  from public.academy_certification c
  join public.academy_enrollment e on e.id = c.enrollment_id
  where c.profile_id = p_profile_id
    and e.status <> 'withdrawn'
    and (
      c.recertify_on is null
      or c.recertify_on + (select s.cert_grace_days from public.team_setting s where s.id = 1) >= current_date
    );
$$;

revoke all on function app.so_certification_level(uuid) from public, anon, authenticated;

-- Files each grace and review alert once. Idempotent.
create or replace function app.so_file_due_alerts()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_grace integer;
  r record;
  v_id uuid;
begin
  select s.cert_grace_days into v_grace from public.team_setting s where s.id = 1;

  for r in
    select distinct on (o.id, c.recertify_on)
      o.id as operator_id, o.name, c.recertify_on, c.profile_id,
      (
        select pl.manager_profile_id from public.placement pl
        where pl.operator_id = o.id and pl.placement_type is not null
          and pl.status in ('draft', 'active', 'paused')
        order by (pl.status = 'active') desc, pl.created_at desc
        limit 1
      ) as manager_id
    from public.academy_certification c
    join public.academy_enrollment e on e.id = c.enrollment_id and e.status <> 'withdrawn'
    join public.operator o on o.profile_id = c.profile_id
    where c.level >= 1
      and c.recertify_on is not null
      and c.recertify_on < current_date
      and c.recertify_on + v_grace >= current_date
    order by o.id, c.recertify_on
  loop
    v_id := null;
    insert into public.workspace_alert (kind, operator_id, manager_profile_id, period_on, summary)
    values (
      'cert_grace', r.operator_id, r.manager_id, r.recertify_on,
      format('%s certification lapsed on %s. Full access continues through the grace period.', r.name, to_char(r.recertify_on, 'FMMon FMDD, YYYY'))
    )
    on conflict (operator_id, period_on) where kind = 'cert_grace' do nothing
    returning id into v_id;
    if v_id is not null then
      perform app.audit('workspace.alert.cert_grace', 'operator', r.operator_id::text,
        format('Certification grace started for %s', r.name),
        null, jsonb_build_object('recertify_on', r.recertify_on, 'manager_profile_id', r.manager_id),
        null, r.profile_id);
      perform app.raise_owner_alert('cert_grace',
        format('%s certification lapsed on %s. Full access continues through the grace period.', r.name, to_char(r.recertify_on, 'FMMon FMDD, YYYY')),
        null, r.profile_id, 'important');
    end if;
  end loop;

  for r in
    select pl.id, pl.review_on, pl.manager_profile_id, pl.case_file_id, o.id as operator_id, o.name, o.profile_id, cf.name as client_name
    from public.placement pl
    join public.operator o on o.id = pl.operator_id
    join public.client_case_file cf on cf.id = pl.case_file_id
    where pl.placement_type is not null
      and pl.status in ('active', 'paused')
      and pl.review_on is not null
      and pl.review_on <= current_date
  loop
    v_id := null;
    insert into public.workspace_alert (kind, operator_id, placement_id, manager_profile_id, period_on, summary)
    values (
      'placement_review', r.operator_id, r.id, r.manager_profile_id, r.review_on,
      format('Review %s at %s. The placement stays active until someone ends it.', r.name, r.client_name)
    )
    on conflict (placement_id, period_on) where kind = 'placement_review' do nothing
    returning id into v_id;
    if v_id is not null then
      perform app.audit('workspace.alert.placement_review', 'placement', r.id::text,
        format('Placement review due for %s', r.name),
        null, jsonb_build_object('review_on', r.review_on, 'manager_profile_id', r.manager_profile_id),
        r.case_file_id, r.profile_id);
      perform app.raise_owner_alert('placement_review',
        format('Review %s at %s. The placement stays active until someone ends it.', r.name, r.client_name),
        null, r.profile_id, 'important');
    end if;
  end loop;
end;
$$;

revoke all on function app.so_file_due_alerts() from public, anon, authenticated;

create or replace function public.so_workspace()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile uuid := app.acting_profile();
  v_op public.operator;
  v_level smallint;
  v_pl public.placement;
  v_latest public.placement;
  v_name text;
  v_recert date;
  v_warn integer;
  v_grace integer;
  v_phase text;
  v_days integer;
  v_lapsed date;
  v_cert jsonb;
begin
  if v_profile is null then
    raise exception 'not_signed_in: sign in first' using errcode = '42501';
  end if;

  perform app.portal_view_audit('workspace');
  perform app.so_file_due_alerts();

  select * into v_op from public.operator where profile_id = v_profile;
  if v_op.id is null then
    return jsonb_build_object('state', 'no_access', 'reason', 'not_an_operator');
  end if;
  v_name := coalesce(nullif(btrim(v_op.name), ''), v_op.email);

  if exists (select 1 from public.lockdown l where l.released_at is null) then
    return jsonb_build_object('state', 'no_access', 'reason', 'lockdown', 'operator_name', v_name);
  end if;

  if app.effective_state(v_profile) is distinct from 'active' or app.operator_stage(v_op) = 'inactive' then
    return jsonb_build_object('state', 'no_access', 'reason', 'deactivated', 'operator_name', v_name);
  end if;

  select s.cert_warning_days, s.cert_grace_days into v_warn, v_grace
  from public.team_setting s where s.id = 1;

  v_level := app.so_certification_level(v_profile);
  if coalesce(v_level, -1) < 1 then
    select max(c.recertify_on) into v_lapsed
    from public.academy_certification c
    join public.academy_enrollment e on e.id = c.enrollment_id
    where c.profile_id = v_profile and e.status <> 'withdrawn' and c.level >= 1
      and c.recertify_on is not null
      and c.recertify_on + v_grace < current_date;
    return jsonb_build_object(
      'state', 'not_certified', 'operator_name', v_name, 'certification_level', v_level,
      'grace_ended', v_lapsed is not null, 'recertify_on', v_lapsed);
  end if;

  select c.recertify_on into v_recert
  from public.academy_certification c
  join public.academy_enrollment e on e.id = c.enrollment_id
  where c.profile_id = v_profile and e.status <> 'withdrawn' and c.level = v_level
    and (c.recertify_on is null or c.recertify_on + v_grace >= current_date)
  order by c.recertify_on nulls first
  limit 1;

  if v_recert is null then
    v_phase := 'current';
    v_days := null;
  elsif v_recert < current_date then
    v_phase := 'grace';
    v_days := (v_recert + v_grace) - current_date;
  elsif v_recert <= current_date + v_warn then
    v_phase := 'warning';
    v_days := v_recert - current_date;
  else
    v_phase := 'current';
    v_days := v_recert - current_date;
  end if;
  v_cert := jsonb_build_object('phase', v_phase, 'recertify_on', v_recert, 'days_left', v_days);

  select * into v_pl from public.placement
  where operator_id = v_op.id and placement_type is not null and status = 'active'
  limit 1;

  if v_pl.id is null then
    select * into v_pl from public.placement
    where operator_id = v_op.id and placement_type is not null and status = 'paused'
    order by paused_at desc nulls last, created_at desc
    limit 1;
  end if;

  if v_pl.id is null then
    select * into v_latest from public.placement
    where operator_id = v_op.id and placement_type is not null
    order by (status = 'draft') desc, coalesce(closed_on, start_date) desc, created_at desc
    limit 1;
    if v_latest.id is not null and v_latest.status in ('ended', 'renewed') then
      return jsonb_build_object('state', 'no_access', 'reason', 'placement_ended', 'operator_name', v_name, 'certification', v_cert);
    end if;
    return jsonb_build_object('state', 'awaiting_placement', 'operator_name', v_name,
      'certification_level', v_level, 'pending', v_latest.id is not null, 'certification', v_cert);
  end if;

  return jsonb_build_object(
    'state', case when v_pl.status = 'active' then 'active' else 'paused' end,
    'operator_name', v_name,
    'certification_level', v_level,
    'certification', v_cert,
    'placement', jsonb_build_object(
      'id', v_pl.id,
      'client_name', (select cf.name from public.client_case_file cf where cf.id = v_pl.case_file_id),
      'manager_name', (select coalesce(nullif(btrim(p.full_name), ''), p.email) from public.profile p where p.id = v_pl.manager_profile_id),
      'placement_type', v_pl.placement_type,
      'time_zone', v_pl.time_zone,
      'working_days', to_jsonb(v_pl.working_days),
      'shift_start', v_pl.shift_start,
      'shift_end', v_pl.shift_end,
      'eod_deadline', coalesce(v_pl.eod_deadline, v_pl.shift_end),
      'paused_at', v_pl.paused_at
    )
  );
end;
$$;

revoke all on function public.so_workspace() from public, anon;
grant execute on function public.so_workspace() to authenticated;

create or replace function public.so_manager_operators()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not app.is_admin() and not app.is_manager() then
    raise exception 'permission_denied: managers and DA Admin only' using errcode = '42501';
  end if;
  perform app.so_file_due_alerts();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'placement_id', pl.id,
      'operator_id', o.id,
      'operator_name', o.name,
      'client_name', cf.name,
      'status', app.so_status_label(pl.status),
      'shift', pl.shift_start || '–' || pl.shift_end,
      'time_zone', pl.time_zone,
      'eod_deadline', coalesce(pl.eod_deadline, pl.shift_end),
      'manager_name', coalesce(nullif(btrim(m.full_name), ''), m.email),
      'review_on', pl.review_on
    ) order by o.name)
    from public.placement pl
    join public.operator o on o.id = pl.operator_id
    join public.client_case_file cf on cf.id = pl.case_file_id
    left join public.profile m on m.id = pl.manager_profile_id
    where pl.placement_type is not null
      and pl.status in ('draft', 'active', 'paused')
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.so_manager_operators() from public, anon;
grant execute on function public.so_manager_operators() to authenticated;

-- One placement, without commercial terms, payout, or GHL secrets.
create or replace function public.so_placement_detail(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pl public.placement;
begin
  if not app.is_admin() and not app.is_manager() then
    raise exception 'permission_denied: managers and DA Admin only' using errcode = '42501';
  end if;
  select * into v_pl from public.placement where id = p_id;
  if v_pl.id is null then
    return null;
  end if;
  return jsonb_build_object(
    'placement', jsonb_build_object(
      'id', v_pl.id,
      'status', app.so_status_label(v_pl.status),
      'placement_type', v_pl.placement_type,
      'operator_name', (select o.name from public.operator o where o.id = v_pl.operator_id),
      'client_name', (select cf.name from public.client_case_file cf where cf.id = v_pl.case_file_id),
      'manager_name', (select coalesce(nullif(btrim(p.full_name), ''), p.email) from public.profile p where p.id = v_pl.manager_profile_id),
      'start_date', v_pl.start_date,
      'end_date', v_pl.end_date,
      'review_on', v_pl.review_on,
      'time_zone', v_pl.time_zone,
      'working_days', to_jsonb(v_pl.working_days),
      'shift_start', v_pl.shift_start,
      'shift_end', v_pl.shift_end,
      'eod_deadline', coalesce(v_pl.eod_deadline, v_pl.shift_end),
      'campaign_summary', v_pl.campaign_summary,
      'activity_categories', to_jsonb(v_pl.activity_categories),
      'tracks_results', v_pl.tracks_results,
      'paused_at', v_pl.paused_at
    ),
    'outcomes', coalesce((
      select jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'definition', o.definition, 'active', o.active) order by o.sort_order, o.name)
      from public.placement_outcome_type o where o.placement_id = v_pl.id
    ), '[]'::jsonb),
    'eods', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'work_date', e.work_date, 'status', e.status, 'submitted_at', e.submitted_at, 'was_late', e.was_late) order by e.work_date desc)
      from public.sales_eod e where e.placement_id = v_pl.id
    ), '[]'::jsonb),
    'feedback', coalesce((
      select jsonb_agg(jsonb_build_object('id', f.id, 'body', f.body, 'author_kind', f.author_kind, 'created_at', f.created_at) order by f.created_at)
      from public.sales_eod_feedback f
      join public.sales_eod e on e.id = f.eod_id
      where e.placement_id = v_pl.id
    ), '[]'::jsonb),
    'targets', coalesce((
      select jsonb_agg(jsonb_build_object('metric_key', t.metric_key, 'daily', t.daily, 'weekly', t.weekly, 'effective_from', t.effective_from) order by t.effective_from desc)
      from public.activity_target t
      where t.layer = 'override' and t.placement_id = v_pl.id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.so_placement_detail(uuid) from public, anon;
grant execute on function public.so_placement_detail(uuid) to authenticated;

create or replace function public.so_workspace_alerts()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_admin boolean := app.is_admin();
begin
  if not v_admin and not app.is_manager() then
    raise exception 'permission_denied: managers and DA Admin only' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id, 'kind', a.kind, 'summary', a.summary, 'period_on', a.period_on, 'created_at', a.created_at,
      'operator_name', o.name, 'placement_id', a.placement_id
    ) order by a.created_at desc)
    from public.workspace_alert a
    join public.operator o on o.id = a.operator_id
    where v_admin or a.manager_profile_id = app.acting_profile()
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.so_workspace_alerts() from public, anon;
grant execute on function public.so_workspace_alerts() to authenticated;

-- 7. Open end date instead of a three-month term -------------------------------------

create or replace function app.so_placement_audit(p public.placement)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'operator_id', p.operator_id, 'case_file_id', p.case_file_id, 'status', p.status,
    'placement_type', p.placement_type, 'manager_profile_id', p.manager_profile_id,
    'start_date', p.start_date, 'end_date', p.end_date, 'review_on', p.review_on, 'closed_on', p.closed_on,
    'time_zone', p.time_zone, 'working_days', p.working_days,
    'shift_start', p.shift_start, 'shift_end', p.shift_end, 'eod_deadline', p.eod_deadline,
    'campaign_summary', p.campaign_summary, 'activity_categories', p.activity_categories,
    'tracks_results', p.tracks_results);
$$;

revoke all on function app.so_placement_audit(public.placement) from public, anon, authenticated;

-- The body matches so_save_placement, except a blank end date stays open.
create or replace function public.so_save_placement(p_placement jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_placement ->> 'id', '')::uuid;
  v_operator uuid := nullif(p_placement ->> 'operator_id', '')::uuid;
  v_case uuid := nullif(p_placement ->> 'case_file_id', '')::uuid;
  v_type text := nullif(btrim(coalesce(p_placement ->> 'placement_type', '')), '');
  v_manager uuid := nullif(p_placement ->> 'manager_profile_id', '')::uuid;
  v_start date := nullif(p_placement ->> 'start_date', '')::date;
  v_end date := nullif(p_placement ->> 'end_date', '')::date;
  v_tz text := coalesce(nullif(btrim(coalesce(p_placement ->> 'time_zone', '')), ''), 'America/New_York');
  v_shift_start text := coalesce(nullif(btrim(coalesce(p_placement ->> 'shift_start', '')), ''), '09:00');
  v_shift_end text := coalesce(nullif(btrim(coalesce(p_placement ->> 'shift_end', '')), ''), '18:00');
  v_deadline text := nullif(btrim(coalesce(p_placement ->> 'eod_deadline', '')), '');
  v_summary text := nullif(btrim(coalesce(p_placement ->> 'campaign_summary', '')), '');
  v_results boolean := coalesce((p_placement ->> 'tracks_results')::boolean, false);
  v_days smallint[];
  v_categories text[];
  v_old public.placement;
  v_new public.placement;
  v_operator_name text;
begin
  if not app.is_admin() then
    raise exception 'admin_required: only DA Admin manages placements' using errcode = '42501';
  end if;

  select coalesce(array_agg(distinct x::smallint order by x::smallint), '{}')
    into v_days
  from jsonb_array_elements_text(coalesce(p_placement -> 'working_days', '[1,2,3,4,5]'::jsonb)) x;
  select coalesce(array_agg(distinct x), '{}')
    into v_categories
  from jsonb_array_elements_text(coalesce(p_placement -> 'activity_categories', '[]'::jsonb)) x;

  if v_operator is null or v_case is null or v_start is null then
    raise exception 'required: choose an operator, a client, and a start date' using errcode = '23514';
  end if;
  if v_type is null or v_type not in ('client_placed', 'da_internal') then
    raise exception 'required: choose client-placed or DA internal' using errcode = '23514';
  end if;
  if cardinality(v_categories) = 0 then
    raise exception 'required: choose at least one activity category' using errcode = '23514';
  end if;
  if not (v_categories <@ array['outbound_calling', 'follow_up', 'reactivation']::text[]) then
    raise exception 'invalid: unknown activity category' using errcode = '23514';
  end if;
  if cardinality(v_days) = 0 then
    raise exception 'required: choose at least one working day' using errcode = '23514';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = v_tz) then
    raise exception 'invalid: % is not a time zone', v_tz using errcode = '23514';
  end if;
  if v_shift_start !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or v_shift_end !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
     or (v_deadline is not null and v_deadline !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') then
    raise exception 'invalid: times are HH:MM, 24-hour' using errcode = '23514';
  end if;
  -- Blank means no end date. 9999-12-31 is the coverage date existing reports read.
  v_end := coalesce(v_end, date '9999-12-31');
  if v_end < v_start then
    raise exception 'invalid: the term cannot end before it starts' using errcode = '23514';
  end if;

  select name into v_operator_name from public.operator where id = v_operator;
  if v_operator_name is null then
    raise exception 'not_found: that operator does not exist' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.client_case_file where id = v_case and record_kind = 'client') then
    raise exception 'not_found: that client does not exist' using errcode = 'P0002';
  end if;
  if v_manager is not null and not exists (
    select 1 from public.profile where id = v_manager and role in ('manager', 'admin', 'owner')
  ) then
    raise exception 'invalid: the assigned manager must hold the Manager or DA Admin role' using errcode = '23514';
  end if;

  if v_id is null then
    insert into public.placement (
      operator_id, case_file_id, start_date, end_date, status,
      placement_type, manager_profile_id, time_zone, working_days, shift_start, shift_end,
      eod_deadline, campaign_summary, activity_categories, tracks_results
    ) values (
      v_operator, v_case, v_start, v_end, 'draft',
      v_type, v_manager, v_tz, v_days, v_shift_start, v_shift_end,
      v_deadline, v_summary, v_categories, v_results
    )
    returning * into v_new;
    perform app.audit('workspace.placement.created', 'placement', v_new.id::text,
      format('Created a Pending placement for %s', v_operator_name),
      null, app.so_placement_audit(v_new), v_case);
    if v_manager is not null then
      perform app.audit('workspace.placement.manager_assigned', 'placement', v_new.id::text,
        format('Assigned a manager to %s', v_operator_name),
        null, jsonb_build_object('manager_profile_id', v_manager), v_case, v_manager);
    end if;
    return v_new.id;
  end if;

  select * into v_old from public.placement where id = v_id for update;
  if v_old.id is null then
    raise exception 'not_found: that placement does not exist' using errcode = 'P0002';
  end if;
  if v_old.status in ('ended', 'renewed') then
    raise exception 'ended: an ended placement is a record. Start a new one.' using errcode = '23514';
  end if;
  if v_old.status <> 'draft' and (v_old.operator_id <> v_operator or v_old.case_file_id <> v_case) then
    raise exception 'locked: the operator and client are fixed once a placement has started' using errcode = '23514';
  end if;

  update public.placement set
    operator_id = v_operator, case_file_id = v_case, start_date = v_start,
    end_date = v_end, placement_type = v_type, manager_profile_id = v_manager,
    time_zone = v_tz, working_days = v_days, shift_start = v_shift_start, shift_end = v_shift_end,
    eod_deadline = v_deadline, campaign_summary = v_summary, activity_categories = v_categories,
    tracks_results = v_results
  where id = v_id
  returning * into v_new;

  perform app.audit('workspace.placement.updated', 'placement', v_id::text,
    format('Edited the placement for %s', v_operator_name),
    app.so_placement_audit(v_old), app.so_placement_audit(v_new), v_case);
  if v_old.manager_profile_id is distinct from v_manager then
    perform app.audit('workspace.placement.manager_assigned', 'placement', v_id::text,
      format('Changed the manager for %s', v_operator_name),
      jsonb_build_object('manager_profile_id', v_old.manager_profile_id),
      jsonb_build_object('manager_profile_id', v_manager), v_case, v_manager);
  end if;
  return v_id;
end;
$$;

revoke all on function public.so_save_placement(jsonb) from public, anon;
grant execute on function public.so_save_placement(jsonb) to authenticated;

-- An open placement still shows up on the client's GHL routing form.
create or replace function public.ghl_case_file_placements(p_case_file_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app.require('ghl.view');
  if not app.ghl_can_see(p_case_file_id) then
    raise exception 'out_of_scope: that client is not in your scope' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('placement_id', pl.id, 'operator', o.name, 'status', pl.status,
      'shift', pl.shift_start || '–' || pl.shift_end || ' ' || pl.time_zone, 'on_shift_now', app.on_shift_now(pl)) order by o.name)
    from public.placement pl join public.operator o on o.id = pl.operator_id
    where pl.case_file_id = p_case_file_id and pl.status in ('active', 'draft')
      and (pl.end_date is null or pl.end_date >= current_date)), '[]'::jsonb);
end;
$$;

revoke all on function public.ghl_case_file_placements(uuid) from public, anon;
grant execute on function public.ghl_case_file_placements(uuid) to authenticated;

-- 8. Settings save, including the new values. DA Admin only. -------------------------

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
    'eod_hours_worked_enabled', 'eod_note_to_manager_enabled', 'client_feedback_token_days',
    'speed_to_lead_target_seconds', 'target_override_min_pct', 'target_override_max_pct',
    'cert_warning_days', 'cert_grace_days', 'view_as_idle_minutes', 'placement_review_months'];
  s jsonb := p_settings;
begin
  if not app.is_admin() then
    raise exception 'admin_required: only DA Admin changes workspace settings' using errcode = '42501';
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
    client_feedback_token_days = coalesce((s ->> 'client_feedback_token_days')::integer, client_feedback_token_days),
    speed_to_lead_target_seconds = case when s ? 'speed_to_lead_target_seconds' then (s ->> 'speed_to_lead_target_seconds')::integer else speed_to_lead_target_seconds end,
    target_override_min_pct = case when s ? 'target_override_min_pct' then (s ->> 'target_override_min_pct')::integer else target_override_min_pct end,
    target_override_max_pct = case when s ? 'target_override_max_pct' then (s ->> 'target_override_max_pct')::integer else target_override_max_pct end,
    cert_warning_days = coalesce((s ->> 'cert_warning_days')::integer, cert_warning_days),
    cert_grace_days = coalesce((s ->> 'cert_grace_days')::integer, cert_grace_days),
    view_as_idle_minutes = coalesce((s ->> 'view_as_idle_minutes')::integer, view_as_idle_minutes),
    placement_review_months = coalesce((s ->> 'placement_review_months')::integer, placement_review_months),
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

-- 9. View As: idle window, no operator notice, no writes --------------------------------

alter table public.impersonation
  add column if not exists last_activity_at timestamptz;

comment on column public.impersonation.last_activity_at is
  'Last page view. A View As session ends view_as_idle_minutes after this.';

create or replace function app.view_as_idle()
returns interval
language sql
stable
security definer
set search_path = ''
as $$
  select make_interval(mins => coalesce((select s.view_as_idle_minutes from public.team_setting s where s.id = 1), 30));
$$;

revoke all on function app.view_as_idle() from public, anon, authenticated;

create or replace function app.portal_view_audit(p_tab text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_imp public.impersonation := app.live_impersonation();
  v_tab text := left(coalesce(nullif(btrim(coalesce(p_tab, '')), ''), 'today'), 80);
begin
  if v_imp.id is null then
    return;
  end if;
  update public.impersonation
     set last_activity_at = now(),
         expires_at = now() + app.view_as_idle()
   where id = v_imp.id;
  perform app.audit('view_as.viewed', 'portal', v_tab,
    format('Viewed the %s page as the operator', v_tab),
    null, null, null, v_imp.target_profile_id);
end;
$$;

revoke all on function app.portal_view_audit(text) from public, anon, authenticated;

-- Replaces start_view_as. The idle window comes from settings. The operator is
-- not told and has no session list of their own. The audit row remains.
create or replace function public.start_view_as(
  p_operator_id uuid,
  p_reason_kind text,
  p_note text,
  p_minutes integer default 30
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor public.profile;
  v_op public.operator;
  v_target public.profile;
  v_row public.impersonation;
  v_step_up uuid;
  v_audit bigint;
  v_reason text;
begin
  select * into v_actor from public.profile where id = auth.uid();
  if v_actor.id is null then
    raise exception 'not_signed_in: sign in first' using errcode = '42501';
  end if;

  update public.impersonation
     set ended_at = expires_at, ended_reason = 'expired'
   where actor_profile_id = auth.uid() and ended_at is null and expires_at <= now();

  if exists (select 1 from public.impersonation where actor_profile_id = auth.uid() and ended_at is null) then
    raise exception 'already_viewing: exit the session you are in first' using errcode = '23514';
  end if;

  if v_actor.role in ('owner', 'admin') then
    perform app.require('accounts.impersonate');
  elsif v_actor.role = 'manager' then
    perform app.require('operators.view_as');
  else
    raise exception 'permission_denied: View As is for owners, admins and managers' using errcode = '42501';
  end if;

  select * into v_op from public.operator where id = p_operator_id;
  if v_op.id is null then
    raise exception 'operator_not_found' using errcode = 'P0002';
  end if;
  if v_op.profile_id is null then
    raise exception 'no_account: this operator has no sign-in yet, so there is nothing to view' using errcode = '23514';
  end if;
  select * into v_target from public.profile where id = v_op.profile_id;
  if v_target.id = auth.uid() then
    raise exception 'cannot_view_self: you cannot View As yourself' using errcode = '23514';
  end if;
  if v_target.role is distinct from 'operator' then
    raise exception 'not_an_operator: View As opens Sales Operator accounts only, never an admin or owner' using errcode = '42501';
  end if;
  -- Managers and DA Admin can open any operator. The assigned manager does not limit this.
  if coalesce(p_reason_kind, '') not in ('support_request', 'dispute_investigation', 'quality_review', 'pay_question', 'other') then
    raise exception 'reason_required: pick why you are viewing this account' using errcode = '23514';
  end if;
  if length(btrim(coalesce(p_note, ''))) not between 5 and 1000 then
    raise exception 'note_required: add a short note. It is stored on the audit record.' using errcode = '23514';
  end if;

  -- p_minutes is kept so existing callers still run. The setting decides the window.
  v_step_up := app.require_step_up('start an impersonation session');
  v_reason := app.reason_kind_label(p_reason_kind) || ': ' || btrim(p_note);

  insert into public.impersonation (
    actor_profile_id, target_profile_id, reason, expires_at, last_activity_at, step_up_id, kind, reason_kind
  ) values (
    auth.uid(), v_target.id, v_reason, now() + app.view_as_idle(), now(), v_step_up, 'view_as', p_reason_kind
  ) returning * into v_row;

  v_audit := app.audit('view_as.started', 'profile', v_target.id::text,
    format('Started viewing as %s: %s', v_op.name, v_reason),
    null, jsonb_build_object('expires_at', v_row.expires_at, 'reason_kind', p_reason_kind, 'reason', v_reason),
    null, v_target.id);

  perform app.raise_owner_alert('view_as_started',
    format('%s started viewing as %s (%s)', app.profile_name(auth.uid()), v_op.name, app.reason_kind_label(p_reason_kind)),
    v_audit, v_target.id, 'urgent');

  return jsonb_build_object('ok', true, 'session_id', v_row.id, 'expires_at', v_row.expires_at);
end;
$$;

revoke all on function public.start_view_as(uuid, text, text, integer) from public, anon;
grant execute on function public.start_view_as(uuid, text, text, integer) to authenticated;

create or replace function public.extend_view_as(p_reason text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.impersonation := app.live_impersonation();
begin
  if v_row.id is null or v_row.kind <> 'view_as' then
    raise exception 'no_session: there is no View As session to extend' using errcode = 'P0002';
  end if;
  if v_row.extended_at is not null then
    raise exception 'already_extended: a session can be extended once. Exit and start a new one.' using errcode = '23514';
  end if;
  if length(btrim(coalesce(p_reason, ''))) not between 5 and 1000 then
    raise exception 'reason_required: say why you need more time' using errcode = '23514';
  end if;

  update public.impersonation
     set expires_at = now() + app.view_as_idle(),
         last_activity_at = now(),
         extended_at = now(),
         extension_reason = btrim(p_reason)
   where id = v_row.id
  returning * into v_row;

  perform app.audit('view_as.extended', 'profile', v_row.target_profile_id::text,
    format('Extended the View As session: %s', btrim(p_reason)),
    null, jsonb_build_object('expires_at', v_row.expires_at), null, v_row.target_profile_id);

  return jsonb_build_object('ok', true, 'expires_at', v_row.expires_at);
end;
$$;

revoke all on function public.extend_view_as(text) from public, anon;
grant execute on function public.extend_view_as(text) to authenticated;

create or replace function public.portal_mark_escalation_read(p_escalation_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_op public.operator := app.portal_operator();
begin
  if app.is_impersonating() then
    raise exception 'view_as_read_only: viewing as this person cannot mark their alerts as read'
      using errcode = '42501';
  end if;
  update public.escalation set answer_read_at = now()
   where id = p_escalation_id and operator_id = v_op.id and status = 'answered' and answer_read_at is null;
end;
$$;

create or replace function public.portal_mark_notification_read(p_notification_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_op public.operator := app.portal_operator();
begin
  if app.is_impersonating() then
    raise exception 'view_as_read_only: viewing as this person cannot mark their alerts as read'
      using errcode = '42501';
  end if;
  update public.operator_notification set read_at = now()
   where id = p_notification_id and operator_id = v_op.id and read_at is null;
end;
$$;

create or replace function public.portal_mark_pay_answer_read(p_question_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_op public.operator := app.portal_operator();
begin
  if app.is_impersonating() then
    raise exception 'view_as_read_only: viewing as this person cannot mark their alerts as read'
      using errcode = '42501';
  end if;
  update public.pay_question set answer_read_at = now()
   where id = p_question_id and operator_id = v_op.id and answered_at is not null and answer_read_at is null;
end;
$$;

create or replace function app.so_block_impersonated_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if app.is_impersonating() then
    raise exception 'view_as_read_only: viewing as this person cannot change their numbers, reports, or alerts. Exit View As to make a change.'
      using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function app.so_block_impersonated_write() from public, anon, authenticated;

-- Named so this runs before the row guards. Postgres fires BEFORE triggers in name order.
drop trigger if exists activity_value_block_view_as on public.activity_value;
create trigger activity_value_block_view_as
  before insert or update or delete on public.activity_value
  for each row execute function app.so_block_impersonated_write();

drop trigger if exists sales_eod_block_view_as on public.sales_eod;
create trigger sales_eod_block_view_as
  before insert or update or delete on public.sales_eod
  for each row execute function app.so_block_impersonated_write();

drop trigger if exists operator_notification_view_as_read on public.operator_notification;
create trigger operator_notification_view_as_read
  before update of read_at on public.operator_notification
  for each row execute function app.so_block_impersonated_write();
