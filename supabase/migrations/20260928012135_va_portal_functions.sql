-- Sales Operator portal: every read and every action a VA has.
--
-- The portal belongs to app.acting_profile(): the signed-in VA, or the VA being
-- viewed in View As. Every function below returns a fixed list of fields, so
-- nothing a VA must not see (the client rate, revenue, other operators,
-- internal notes, customer details of an ended placement) can reach them by
-- calling it directly.
--
-- Reads are allowed while someone views as the VA. Every VA action is a
-- permission with blocked_during_impersonation, so app.require() refuses it
-- during View As on the server, whatever the browser does.
--
-- Pay dates follow payroll, which files a booking under its UTC calendar day
-- (lib/vistrial/rules/pay.ts). Shifts follow the placement's own time zone.

-- Staff inbox ------------------------------------------------------------------

-- The owner alert feed is readable by anyone with audit.view, managers included,
-- so it cannot carry pay. Portal events go to named people instead: admins for
-- anything about money, and the managers whose scope covers the placement for
-- day-to-day work.
create table if not exists public.staff_notification (
  id uuid primary key default gen_random_uuid(),
  recipient_profile_id uuid not null references public.profile (id) on delete cascade,
  kind text not null,
  severity public.notification_severity not null default 'important',
  title text not null,
  body text not null default '',
  operator_id uuid references public.operator (id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists staff_notification_recipient_idx
  on public.staff_notification (recipient_profile_id, created_at desc);

alter table public.staff_notification enable row level security;
revoke all on public.staff_notification from anon, authenticated;
grant select on public.staff_notification to authenticated;

drop policy if exists staff_notification_own_read on public.staff_notification;
create policy staff_notification_own_read on public.staff_notification for select to authenticated
  using (recipient_profile_id = auth.uid());

create or replace function app.admin_recipient_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(p.id), '{}'::uuid[])
  from public.profile p
  where p.role in ('owner', 'admin') and app.effective_state(p.id) = 'active';
$$;

-- The managers an escalation on this client is already routed to
-- (app.escalation_recipients), as profile ids.
create or replace function app.case_file_manager_ids(p_case_file_id uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(p.id), '{}'::uuid[])
  from public.profile p
  where p.role = 'manager' and app.scope_includes_case_file(p.id, p_case_file_id);
$$;

create or replace function app.placement_manager_ids(p_placement_id uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(p.id), '{}'::uuid[])
  from public.profile p
  where p.role = 'manager' and app.scope_includes_placement(p.id, p_placement_id);
$$;

create or replace function app.notify_staff(
  p_recipients uuid[],
  p_kind text,
  p_severity public.notification_severity,
  p_title text,
  p_body text,
  p_operator_id uuid default null
)
returns integer
language sql
volatile
security definer
set search_path = ''
as $$
  with sent as (
    insert into public.staff_notification (recipient_profile_id, kind, severity, title, body, operator_id)
    select r, p_kind, p_severity, p_title, coalesce(p_body, ''), p_operator_id
    from (select distinct unnest(coalesce(p_recipients, '{}'::uuid[])) as r) recipients
    where r is not null and r is distinct from auth.uid()
    returning 1
  )
  select count(*)::integer from sent;
$$;

-- Helpers --------------------------------------------------------------------

-- A time zone Postgres understands, or UTC. Checked by using it: the catalogue
-- view of zone names costs ~50ms a call, and this runs once per shift.
create or replace function app.safe_tz(p_tz text)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v text := nullif(btrim(coalesce(p_tz, '')), '');
begin
  if v is null then
    return 'UTC';
  end if;
  perform now() at time zone v;
  return v;
exception when others then
  return 'UTC';
end;
$$;

create or replace function app.placement_today(p public.placement)
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone app.safe_tz(p.time_zone))::date;
$$;

-- Status active, not closed, and not past its end date.
create or replace function app.placement_is_live(p public.placement)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p.status = 'active'
     and p.closed_on is null
     and (p.end_date is null or p.end_date >= app.placement_today(p));
$$;

-- Whether customer details on this placement may be shown to its VA: while it is
-- live, or while its renewal (same VA, same client) is.
create or replace function app.placement_customer_access(p public.placement)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with recursive chain as (
    select p.id, 0 as depth
    union all
    select n.id, c.depth + 1
    from chain c
    join public.placement n on n.renewed_from_id = c.id and n.operator_id = p.operator_id
    where c.depth < 24
  )
  select exists (
    select 1 from chain c join public.placement x on x.id = c.id
    where app.placement_is_live(x)
  );
$$;

-- One shift's start and end, in real time, from the placement's HH:MM window and
-- time zone. A window that ends at or before it starts runs past midnight.
create or replace function app.shift_bounds(p public.placement, p_date date, out starts_at timestamptz, out ends_at timestamptz)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_tz text := app.safe_tz(p.time_zone);
  v_start time;
  v_end time;
begin
  if coalesce(p.shift_start, '') !~ '^\d{1,2}:\d{2}' or coalesce(p.shift_end, '') !~ '^\d{1,2}:\d{2}' then
    starts_at := null;
    ends_at := null;
    return;
  end if;
  v_start := p.shift_start::time;
  v_end := p.shift_end::time;
  starts_at := (p_date + v_start) at time zone v_tz;
  ends_at := ((p_date + (case when v_end <= v_start then 1 else 0 end)) + v_end) at time zone v_tz;
end;
$$;

-- The operator whose portal this request shows. Refuses anyone without one, and
-- closes the portal the moment the account is suspended, offboarded, or the
-- system is locked down.
create or replace function app.portal_operator()
returns public.operator
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile uuid := app.acting_profile();
  v_row public.operator;
begin
  if v_profile is null then
    raise exception 'not_signed_in: sign in first' using errcode = '42501';
  end if;

  select * into v_row from public.operator where profile_id = v_profile;
  if v_row.id is null then
    raise exception 'not_an_operator: this account has no Sales Operator portal' using errcode = '42501';
  end if;

  if app.effective_state(v_profile) is distinct from 'active' then
    raise exception 'portal_closed: this account is not active, so the portal is closed' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.offboarding ob
    where ob.profile_id = v_profile
      and (ob.suspended_at is not null or ob.archived_at is not null or ob.completed_at is not null)
  ) then
    raise exception 'portal_closed: this account has been offboarded' using errcode = '42501';
  end if;

  if exists (select 1 from public.lockdown l where l.released_at is null) then
    raise exception 'lockdown: the system is locked down until the Owner releases it' using errcode = '42501';
  end if;

  return v_row;
end;
$$;

-- Placements this operator may see: their own, not drafts, and inside their
-- account scope when one is set. An operator with no scope configured sees
-- their own placements only.
create or replace function app.portal_placement_ids(p_operator public.operator)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select pl.id
  from public.placement pl
  where pl.operator_id = p_operator.id
    and pl.status <> 'draft'
    and (
      not exists (select 1 from public.account_scope s where s.profile_id = p_operator.profile_id)
      or app.scope_includes_placement(p_operator.profile_id, pl.id)
    );
$$;

create or replace function app.portal_placement(p_operator public.operator, p_placement_id uuid)
returns public.placement
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_row public.placement;
begin
  if p_placement_id is null or p_placement_id not in (select app.portal_placement_ids(p_operator)) then
    raise exception 'placement_not_found: that placement is not one of yours' using errcode = '42501';
  end if;
  select * into v_row from public.placement where id = p_placement_id;
  return v_row;
end;
$$;

-- "Ana C." Never more than a first name and an initial in a list, and never an
-- email address or phone number that was typed into the name field.
create or replace function app.customer_short_name(p_name text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_parts text[] := regexp_split_to_array(btrim(coalesce(p_name, '')), '\s+');
begin
  if btrim(coalesce(p_name, '')) = '' or v_parts[1] ~ '@' or v_parts[1] ~ '^[+0-9().-]{5,}$' then
    return 'Customer';
  end if;
  if cardinality(v_parts) = 1 then
    return v_parts[1];
  end if;
  return v_parts[1] || ' ' || upper(left(v_parts[cardinality(v_parts)], 1)) || '.';
end;
$$;

create or replace function app.profile_name(p_profile uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(btrim(p.full_name), ''), split_part(p.email, '@', 1))
  from public.profile p where p.id = p_profile;
$$;

-- The client's name as the VA should say it: the playbook's business name when
-- one is set, otherwise the case file name.
create or replace function app.placement_client_name(p public.placement)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select nullif(btrim(pb.business_name), '') from public.playbook pb where pb.placement_id = p.id),
    (select nullif(btrim(pb.business_name), '') from public.playbook pb
      where pb.case_file_id = p.case_file_id and pb.placement_id is null),
    (select cf.name from public.client_case_file cf where cf.id = p.case_file_id),
    'Client'
  );
$$;

-- The start of the pay period a VA may still log bookings into (pay calendar,
-- UTC). With no pay periods set up yet, the start of the month.
create or replace function app.current_pay_period_start(p_today date)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select pp.start_date from public.pay_period pp
      where pp.start_date <= p_today and pp.end_date >= p_today
      order by pp.start_date desc limit 1),
    date_trunc('month', p_today)::date
  );
$$;

-- Whether the pay period containing a date has been closed.
create or replace function app.pay_period_closed_for(p_date date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.pay_period pp
    where pp.start_date <= p_date and pp.end_date >= p_date and pp.status <> 'open'
  );
$$;

-- The holding line a VA uses while waiting on DA: the placement's, the client's,
-- or the house default.
create or replace function app.placement_holding_line(p public.placement)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select pb.holding_lines[1] from public.playbook pb
      where pb.placement_id = p.id and cardinality(pb.holding_lines) > 0),
    (select pb.holding_lines[1] from public.playbook pb
      where pb.case_file_id = p.case_file_id and pb.placement_id is null and cardinality(pb.holding_lines) > 0),
    'Let me confirm that with the team and get right back to you.'
  );
$$;

-- Every scheduled shift in a range and what happened to it. Only what a person
-- decided or said is stored (shift_attendance); the rest is derived here, so a
-- missed shift is only ever "suspected" until a manager or admin confirms it.
create or replace function app.placement_attendance(p_placement_id uuid, p_from date, p_to date)
returns table(
  shift_date date,
  starts_at timestamptz,
  ends_at timestamptz,
  status text,
  late_notice boolean,
  reason text,
  recorded_status text,
  decided_by_name text,
  decided_at timestamptz,
  notice_at timestamptz,
  has_report boolean,
  has_activity boolean,
  attendance_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_pl public.placement;
  v_first date;
  v_last date;
begin
  select * into v_pl from public.placement where id = p_placement_id;
  if v_pl.id is null or v_pl.status = 'draft'
     or coalesce(v_pl.shift_start, '') !~ '^\d{1,2}:\d{2}'
     or coalesce(v_pl.shift_end, '') !~ '^\d{1,2}:\d{2}' then
    return;
  end if;

  v_first := greatest(p_from, v_pl.start_date);
  v_last := least(p_to, coalesce(v_pl.closed_on, v_pl.end_date, p_to));
  -- Ended with no end date on record: nothing is scheduled after its last report.
  if v_pl.status <> 'active' and v_pl.closed_on is null and v_pl.end_date is null then
    v_last := least(v_last, coalesce(
      (select max(r.shift_date) from public.eod_report r where r.placement_id = v_pl.id), v_first - 1));
  end if;
  if v_first > v_last then
    return;
  end if;

  return query
  with days as (
    select d::date as day
    from generate_series(v_first::timestamp, v_last::timestamp, interval '1 day') d
    where extract(isodow from d)::smallint = any(v_pl.working_days)
  ),
  bounds as (
    select days.day, sb.starts_at as s_at, sb.ends_at as e_at
    from days cross join lateral app.shift_bounds(v_pl, days.day) sb
  )
  select
    bo.day,
    bo.s_at,
    bo.e_at,
    case
      when sa.status in ('excused_emergency', 'abandoned', 'worked') then sa.status
      when rep.has_report then 'worked'
      when sa.status = 'notified_absence' then 'notified_absence'
      when now() < bo.e_at then 'scheduled'
      when act.has_activity then 'worked_report_missing'
      else 'suspected_missed'
    end,
    coalesce(sa.late_notice, false),
    sa.reason,
    sa.status,
    app.profile_name(sa.decided_by),
    sa.decided_at,
    sa.notice_at,
    rep.has_report,
    act.has_activity,
    sa.id
  from bounds bo
  left join public.shift_attendance sa on sa.placement_id = v_pl.id and sa.shift_date = bo.day
  cross join lateral (
    select exists (
      select 1 from public.eod_report r
      where r.placement_id = v_pl.id and r.shift_date = bo.day and r.superseded_by_id is null
    ) as has_report
  ) rep
  cross join lateral (
    select (
      exists (select 1 from public.booking bk
              where bk.placement_id = v_pl.id and bk.source = 'manual'
                and bk.recorded_at between bo.s_at and bo.e_at)
      or exists (select 1 from public.escalation e
                 where e.placement_id = v_pl.id and e.raised_at between bo.s_at and bo.e_at)
    ) as has_activity
  ) act
  order by bo.day;
end;
$$;

-- In View As, every page the viewer opens is on the audit record.
create or replace function app.portal_view_audit(p_tab text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_imp public.impersonation := app.live_impersonation();
  v_tab text := left(coalesce(nullif(btrim(coalesce(p_tab, '')), ''), 'today'), 60);
begin
  if v_imp.id is not null then
    perform app.audit('view_as.viewed', 'portal', v_tab,
      format('Viewed the %s page as the operator', v_tab),
      null, null, null, v_imp.target_profile_id);
  end if;
end;
$$;

-- Bookings: the claim itself, shared by the operator's portal, staff backfill and
-- the original claim_booking(). Callers do their own checks first.
create or replace function app.insert_booking_claim(
  p_placement public.placement,
  p_customer_name text,
  p_scheduled_for timestamptz,
  p_customer_phone text,
  p_customer_email text,
  p_operator_note text,
  p_live_transfer boolean default false
)
returns public.booking
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_claim public.booking;
begin
  insert into public.booking (
    placement_id, case_file_id, operator_id, scheduled_for,
    source, state, customer_name, customer_phone, customer_email, operator_note, live_transfer
  )
  values (
    p_placement.id, p_placement.case_file_id, p_placement.operator_id, p_scheduled_for,
    'manual', 'pending_review',
    btrim(p_customer_name),
    nullif(btrim(coalesce(p_customer_phone, '')), ''),
    lower(nullif(btrim(coalesce(p_customer_email, '')), '')),
    nullif(btrim(coalesce(p_operator_note, '')), ''),
    coalesce(p_live_transfer, false)
  )
  returning * into v_claim;

  perform app.reconcile_booking_claims(p_placement.id);

  select * into v_claim from public.booking where id = v_claim.id;

  perform app.audit('booking.claimed', 'booking', v_claim.id::text,
    format('Claimed a booking for %s at %s, %s',
           v_claim.customer_name, v_claim.scheduled_for,
           case when v_claim.state = 'confirmed'
                then 'confirmed against an ingested event'
                else 'pending review' end),
    null,
    jsonb_build_object('state', v_claim.state, 'matched_booking_id', v_claim.matched_booking_id,
                       'live_transfer', v_claim.live_transfer),
    p_placement.case_file_id);

  return v_claim;
end;
$$;

-- The original entry point stays for admins. An operator logs through the
-- portal, which checks for duplicates and refuses backfilled dates.
create or replace function public.claim_booking(
  p_placement_id uuid,
  p_customer_name text,
  p_scheduled_for timestamptz,
  p_customer_phone text default null,
  p_customer_email text default null,
  p_operator_note text default null
)
returns public.booking
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_placement public.placement;
begin
  select * into v_placement from public.placement where id = p_placement_id;

  if v_placement.id is null then
    raise exception 'placement_not_found: that placement no longer exists' using errcode = 'P0002';
  end if;

  if not app.is_admin() then
    raise exception 'use_the_portal: operators log bookings from their portal, which checks for duplicates and the pay period'
      using errcode = '42501';
  end if;

  if btrim(coalesce(p_customer_name, '')) = '' then
    raise exception 'customer_name_required: a claim with no customer cannot be matched against anything'
      using errcode = '23514';
  end if;

  if p_scheduled_for is null then
    raise exception 'appointment_time_required' using errcode = '23514';
  end if;

  return app.insert_booking_claim(v_placement, p_customer_name, p_scheduled_for,
    p_customer_phone, p_customer_email, p_operator_note, false);
end;
$$;

-- Portal reads -------------------------------------------------------------------

-- Everything the shell needs on every page: who, which placement, what must be
-- read first, the badge counts, and whether this is someone viewing as the VA.
create or replace function public.portal_context(p_tab text default 'today', p_placement_id uuid default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_op public.operator := app.portal_operator();
  v_imp public.impersonation := app.live_impersonation();
  v_op_today date := (now() at time zone app.safe_tz(v_op.time_zone))::date;
  v_selected uuid;
  v_placements jsonb;
  v_onboarding jsonb;
begin
  perform app.portal_view_audit(p_tab);

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', pl.id,
           'client_name', app.placement_client_name(pl),
           'status', pl.status,
           'live', app.placement_is_live(pl),
           'start_date', pl.start_date,
           'end_date', coalesce(pl.closed_on, pl.end_date),
           'shift_start', pl.shift_start,
           'shift_end', pl.shift_end,
           'time_zone', app.safe_tz(pl.time_zone),
           'working_days', to_jsonb(pl.working_days)
         ) order by app.placement_is_live(pl) desc, pl.start_date desc), '[]'::jsonb)
    into v_placements
  from public.placement pl
  where pl.id in (select app.portal_placement_ids(v_op));

  if p_placement_id is not null and p_placement_id in (select app.portal_placement_ids(v_op)) then
    v_selected := p_placement_id;
  else
    v_selected := (v_placements -> 0 ->> 'id')::uuid;
  end if;

  -- Onboarding from the hiring flow. The private link is the VA's own; nobody
  -- viewing as them is handed it.
  select jsonb_build_object(
           'status', s.status,
           'protocol_name', coalesce(p.name, s.protocol_key),
           'link_token', case when v_imp.id is null and s.status = 'pending' then s.access_token end
         )
    into v_onboarding
  from public.da_onboarding_submission s
  join public.da_recipient d on d.id = s.recipient_id
  left join public.da_onboarding_protocol p on p.key = s.protocol_key
  where d.operator_id = v_op.id
  order by (s.status = 'pending') desc, s.created_at desc
  limit 1;

  return jsonb_build_object(
    'operator', jsonb_build_object(
      'id', v_op.id,
      'name', v_op.name,
      'first_name', split_part(btrim(v_op.name), ' ', 1),
      'time_zone', app.safe_tz(v_op.time_zone),
      'status', v_op.status
    ),
    'viewer', jsonb_build_object(
      'view_as', v_imp.id is not null,
      'kind', v_imp.kind,
      'read_only', v_imp.id is not null,
      'session_id', v_imp.id,
      'actor_name', case when v_imp.id is not null then app.profile_name(v_imp.actor_profile_id) end,
      'actor_role', case when v_imp.id is not null
                         then (select pr.role from public.profile pr where pr.id = v_imp.actor_profile_id) end,
      'reason_kind', v_imp.reason_kind,
      'started_at', v_imp.started_at,
      'expires_at', v_imp.expires_at,
      'extended', v_imp.extended_at is not null,
      'can_see_pay', v_imp.id is null or app.actor_can('payroll.view')
    ),
    'placements', v_placements,
    'selected_placement_id', v_selected,
    'blocking_notices', coalesce((
      select jsonb_agg(jsonb_build_object('id', n.id, 'body', n.body, 'severity', n.severity,
                                          'created_at', n.created_at) order by n.created_at)
      from public.account_notice n
      where n.profile_id = v_op.profile_id and n.blocking
        and n.acknowledged_at is null and n.cleared_at is null
    ), '[]'::jsonb),
    'badges', jsonb_build_object(
      'answers_ready', (select count(*) from public.escalation e
                        where e.operator_id = v_op.id and e.status = 'answered' and e.answer_read_at is null
                          and e.placement_id in (select app.portal_placement_ids(v_op))),
      'overdue_escalations', (select count(*) from public.escalation e
                              where e.operator_id = v_op.id and e.status = 'open' and e.response_due_at < now()
                                and e.placement_id in (select app.portal_placement_ids(v_op))),
      'unread_notifications', (select count(*) from public.operator_notification n
                               where n.operator_id = v_op.id and n.read_at is null),
      'open_tasks', (select count(*) from public.operator_task t
                     where t.operator_id = v_op.id and t.completed_on is null and t.due_on <= v_op_today),
      'pay_answers', case when v_imp.id is null or app.actor_can('payroll.view') then
                       (select count(*) from public.pay_question q
                        where q.operator_id = v_op.id and q.answered_at is not null and q.answer_read_at is null)
                     else 0 end
    ),
    'onboarding', v_onboarding
  );
end;
$$;

create or replace function public.portal_today(p_placement_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_op public.operator := app.portal_operator();
  v_pl public.placement := app.portal_placement(v_op, p_placement_id);
  v_tz text := app.safe_tz(v_pl.time_zone);
  v_op_tz text := app.safe_tz(v_op.time_zone);
  v_today date := (now() at time zone v_tz)::date;
  v_op_today date := (now() at time zone v_op_tz)::date;
  v_pay_month date := date_trunc('month', (now() at time zone 'UTC'))::date;
  v_live boolean := app.placement_is_live(v_pl);
  v_today_starts timestamptz;
  v_today_ends timestamptz;
  v_next_starts timestamptz;
  v_next_ends timestamptz;
  v_creditable integer;
  v_pending integer;
begin
  if v_live then
    -- The shift running now, or the next one: the earliest that has not ended,
    -- from yesterday (an overnight shift may still be running) to two weeks out.
    select sb.starts_at, sb.ends_at into v_next_starts, v_next_ends
    from generate_series((v_today - 1)::timestamp, (v_today + 14)::timestamp, interval '1 day') d
    cross join lateral app.shift_bounds(v_pl, d::date) sb
    where extract(isodow from d)::smallint = any(v_pl.working_days)
      and d::date >= v_pl.start_date
      and (v_pl.end_date is null or d::date <= v_pl.end_date)
      and sb.ends_at > now()
    order by sb.starts_at
    limit 1;

    if extract(isodow from v_today)::smallint = any(v_pl.working_days) and v_today >= v_pl.start_date then
      select sb.starts_at, sb.ends_at into v_today_starts, v_today_ends from app.shift_bounds(v_pl, v_today) sb;
    end if;
  end if;

  select count(*) filter (where public.booking_is_creditable(b.state, b.source, b.matched_booking_id)),
         count(*) filter (where b.state = 'pending_review')
    into v_creditable, v_pending
  from public.booking b
  where b.placement_id = v_pl.id
    and b.scheduled_for >= (v_pay_month::timestamp at time zone 'UTC')
    and b.scheduled_for < ((v_pay_month + interval '1 month')::timestamp at time zone 'UTC');

  return jsonb_build_object(
    'placement_id', v_pl.id,
    'client_name', app.placement_client_name(v_pl),
    'live', v_live,
    'time_zone', v_tz,
    'operator_time_zone', v_op_tz,
    'shift_start', v_pl.shift_start,
    'shift_end', v_pl.shift_end,
    'working_days', to_jsonb(v_pl.working_days),
    'today', v_today,
    'shift_today', case when v_today_starts is not null
      then jsonb_build_object('starts_at', v_today_starts, 'ends_at', v_today_ends) end,
    'next_shift', case when v_next_starts is not null
      then jsonb_build_object('starts_at', v_next_starts, 'ends_at', v_next_ends) end,
    'response_standard_minutes', v_pl.response_standard_minutes,
    'escalation_response_hours', v_pl.escalation_response_hours,
    'month', jsonb_build_object(
      'label', to_char(v_pay_month, 'FMMonth YYYY'),
      'confirmed', v_creditable,
      'pending', v_pending,
      'quota', v_pl.monthly_booking_quota,
      'commission_per_booking', v_pl.commission_per_booking,
      'estimated_commission', greatest(0, v_creditable - coalesce(v_pl.monthly_booking_quota, 0))
                              * coalesce(v_pl.commission_per_booking, 0)
    ),
    'missing_reports', coalesce((
      select jsonb_agg(a.shift_date order by a.shift_date desc)
      from app.placement_attendance(v_pl.id, v_today - 14, v_today) a
      where a.status in ('worked_report_missing', 'suspected_missed')
    ), '[]'::jsonb),
    'answers_ready', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'category', e.category, 'answered_at', e.answered_at)
                       order by e.answered_at desc)
      from public.escalation e
      where e.operator_id = v_op.id and e.placement_id = v_pl.id
        and e.status = 'answered' and e.answer_read_at is null
    ), '[]'::jsonb),
    'overdue_escalations', (
      select count(*) from public.escalation e
      where e.operator_id = v_op.id and e.placement_id = v_pl.id
        and e.status = 'open' and e.response_due_at < now()
    ),
    'tasks_due', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'due_on', t.due_on,
                                          'overdue', t.due_on < v_op_today)
                       order by t.due_on)
      from public.operator_task t
      where t.operator_id = v_op.id and t.completed_on is null and t.due_on <= v_op_today
        and (t.placement_id is null or t.placement_id = v_pl.id)
    ), '[]'::jsonb),
    'notifications', coalesce((
      select jsonb_agg(x.n order by x.created_at desc)
      from (
        select jsonb_build_object('id', n.id, 'title', n.title, 'body', n.body, 'severity', n.severity,
                                  'created_at', n.created_at) as n, n.created_at
        from public.operator_notification n
        where n.operator_id = v_op.id and n.read_at is null
        order by n.created_at desc
        limit 10
      ) x
    ), '[]'::jsonb),
    'notices', coalesce((
      select jsonb_agg(jsonb_build_object('id', n.id, 'body', n.body, 'severity', n.severity,
                                          'created_at', n.created_at) order by n.created_at desc)
      from public.account_notice n
      where n.profile_id = v_op.profile_id and not n.blocking
        and n.acknowledged_at is null and n.cleared_at is null
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.portal_bookings(p_placement_id uuid, p_month date default null, p_state text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_op public.operator := app.portal_operator();
  v_pl public.placement := app.portal_placement(v_op, p_placement_id);
  v_month date := date_trunc('month', coalesce(p_month, (now() at time zone 'UTC')::date))::date;
  v_from timestamptz := v_month::timestamp at time zone 'UTC';
  v_to timestamptz := (v_month + interval '1 month')::timestamp at time zone 'UTC';
begin
  return jsonb_build_object(
    'placement_id', v_pl.id,
    'live', app.placement_is_live(v_pl),
    'month', v_month,
    'time_zone', app.safe_tz(v_pl.time_zone),
    'current_period_start', app.current_pay_period_start((now() at time zone 'UTC')::date),
    'counts', (
      select jsonb_build_object(
        'counted', count(*) filter (where public.booking_is_creditable(b.state, b.source, b.matched_booking_id)),
        'pending_review', count(*) filter (where b.state = 'pending_review'),
        'rejected', count(*) filter (where b.state = 'rejected'))
      from public.booking b
      where b.placement_id = v_pl.id and b.scheduled_for >= v_from and b.scheduled_for < v_to
    ),
    'bookings', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', b.id,
               'customer', app.customer_short_name(b.customer_name),
               'scheduled_for', b.scheduled_for,
               'recorded_at', b.recorded_at,
               'source', b.source,
               'state', b.state,
               'counts', public.booking_is_creditable(b.state, b.source, b.matched_booking_id),
               'matched', b.matched_booking_id is not null
                          or exists (select 1 from public.booking m where m.matched_booking_id = b.id),
               'live_transfer', b.live_transfer,
               'rejection_reason', b.rejection_reason
             ) order by b.scheduled_for desc)
      from public.booking b
      where b.placement_id = v_pl.id and b.scheduled_for >= v_from and b.scheduled_for < v_to
        and (p_state is null or b.state::text = p_state)
    ), '[]'::jsonb)
  );
end;
$$;

-- A single booking. Contact details only while the placement is live; after it
-- ends the history stays and the customer's details are gone (Section 13.1).
create or replace function public.portal_booking(p_booking_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_op public.operator := app.portal_operator();
  v_b public.booking;
  v_pl public.placement;
  v_open boolean;
begin
  select * into v_b from public.booking where id = p_booking_id;
  if v_b.id is null then
    raise exception 'booking_not_found: that booking is not one of yours' using errcode = '42501';
  end if;
  v_pl := app.portal_placement(v_op, v_b.placement_id);
  v_open := app.placement_customer_access(v_pl);

  return jsonb_build_object(
    'id', v_b.id,
    'placement_id', v_b.placement_id,
    'contacts_visible', v_open,
    'customer', case when v_open then v_b.customer_name else app.customer_short_name(v_b.customer_name) end,
    'customer_phone', case when v_open then v_b.customer_phone end,
    'customer_email', case when v_open then v_b.customer_email end,
    'scheduled_for', v_b.scheduled_for,
    'recorded_at', v_b.recorded_at,
    'source', v_b.source,
    'state', v_b.state,
    'counts', public.booking_is_creditable(v_b.state, v_b.source, v_b.matched_booking_id),
    'matched', v_b.matched_booking_id is not null
               or exists (select 1 from public.booking m where m.matched_booking_id = v_b.id),
    'live_transfer', v_b.live_transfer,
    'operator_note', case when v_open then v_b.operator_note end,
    'rejection_reason', v_b.rejection_reason,
    'reviewed_at', v_b.reviewed_at,
    'time_zone', app.safe_tz(v_pl.time_zone)
  );
end;
$$;

create or replace function public.portal_escalations(p_placement_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_op public.operator := app.portal_operator();
  v_pl public.placement := app.portal_placement(v_op, p_placement_id);
  v_open boolean := app.placement_customer_access(v_pl);
begin
  return jsonb_build_object(
    'placement_id', v_pl.id,
    'live', app.placement_is_live(v_pl),
    'escalation_response_hours', v_pl.escalation_response_hours,
    'holding_line', app.placement_holding_line(v_pl),
    'escalations', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', e.id,
               'category', e.category,
               'customer_context', case when v_open then e.customer_context end,
               'needed', case when v_open then e.needed end,
               'status', e.status,
               'raised_at', e.raised_at,
               'response_due_at', e.response_due_at,
               'answered_at', e.answered_at,
               'answer', case when v_open then e.answer end,
               'answered_by', app.profile_name(e.answered_by),
               'closed_at', e.closed_at,
               'overdue', e.status = 'open' and e.response_due_at < now(),
               'answer_ready', e.status = 'answered' and e.answer_read_at is null
             ) order by (e.status = 'answered' and e.answer_read_at is null) desc,
                        (e.status = 'open') desc, e.raised_at desc)
      from public.escalation e
      where e.operator_id = v_op.id and e.placement_id = v_pl.id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.portal_shift_reports(p_placement_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_op public.operator := app.portal_operator();
  v_pl public.placement := app.portal_placement(v_op, p_placement_id);
  v_today date := app.placement_today(v_pl);
begin
  return jsonb_build_object(
    'placement_id', v_pl.id,
    'live', app.placement_is_live(v_pl),
    'today', v_today,
    'start_date', v_pl.start_date,
    'time_zone', app.safe_tz(v_pl.time_zone),
    'shift_start', v_pl.shift_start,
    'shift_end', v_pl.shift_end,
    'configured_fields', coalesce((
      select jsonb_agg(jsonb_build_object('key', f.key, 'label', f.label, 'type', f.field_type,
                                          'options', to_jsonb(f.options), 'required', f.required, 'help', f.help)
                       order by f.sort_order)
      from public.eod_fields_for_case_file(v_pl.case_file_id) f
    ), '[]'::jsonb),
    'due', coalesce((
      select jsonb_agg(a.shift_date order by a.shift_date desc)
      from app.placement_attendance(v_pl.id, v_today - 30, v_today) a
      where a.status in ('worked_report_missing', 'suspected_missed')
        and not app.pay_period_closed_for(a.shift_date)
    ), '[]'::jsonb),
    'reports', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id,
               'shift_date', r.shift_date,
               'version', r.version,
               'current', r.superseded_by_id is null,
               'supersedes_id', r.supersedes_id,
               'submitted_at', r.submitted_at,
               'shift_start_actual', r.shift_start_actual,
               'shift_end_actual', r.shift_end_actual,
               'conversations_handled', r.conversations_handled,
               'appointments_booked', r.appointments_booked,
               'follow_ups_completed', r.follow_ups_completed,
               'escalations_raised', r.escalations_raised,
               'blockers', r.blockers,
               'notes', r.notes,
               'configured', r.configured,
               'system_counts', r.system_counts,
               'variance_explanation', r.variance_explanation,
               'correction_reason', r.correction_reason,
               'correctable', r.superseded_by_id is null and not app.pay_period_closed_for(r.shift_date),
               'comments', coalesce((
                 select jsonb_agg(jsonb_build_object('author', c.author_name, 'body', c.body, 'created_at', c.created_at)
                                  order by c.created_at)
                 from public.eod_comment c where c.eod_report_id = r.id), '[]'::jsonb)
             ) order by r.shift_date desc, r.version desc)
      from public.eod_report r
      where r.placement_id = v_pl.id and r.operator_id = v_op.id
    ), '[]'::jsonb),
    'attendance', coalesce((
      select jsonb_agg(jsonb_build_object(
               'shift_date', a.shift_date,
               'starts_at', a.starts_at,
               'ends_at', a.ends_at,
               'status', a.status,
               'late_notice', a.late_notice,
               'reason', a.reason,
               'decided_by', a.decided_by_name,
               'decided_at', a.decided_at
             ) order by a.shift_date desc)
      from app.placement_attendance(v_pl.id, v_today - 60, v_today + 14) a
    ), '[]'::jsonb)
  );
end;
$$;

-- What the system recorded during one shift, so the report form can prefill it.
create or replace function public.portal_shift_prefill(p_placement_id uuid, p_shift_date date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_op public.operator := app.portal_operator();
  v_pl public.placement := app.portal_placement(v_op, p_placement_id);
  v_starts timestamptz;
  v_ends timestamptz;
begin
  select sb.starts_at, sb.ends_at into v_starts, v_ends from app.shift_bounds(v_pl, p_shift_date) sb;
  return jsonb_build_object(
    'shift_date', p_shift_date,
    'starts_at', v_starts,
    'ends_at', v_ends,
    'appointments_booked', (
      select count(*) from public.booking b
      where b.placement_id = v_pl.id and b.source = 'manual' and b.state <> 'rejected'
        and b.recorded_at between v_starts and v_ends),
    'escalations_raised', (
      select count(*) from public.escalation e
      where e.placement_id = v_pl.id and e.raised_at between v_starts and v_ends),
    'has_report', exists (
      select 1 from public.eod_report r
      where r.placement_id = v_pl.id and r.shift_date = p_shift_date and r.superseded_by_id is null),
    'period_closed', app.pay_period_closed_for(p_shift_date)
  );
end;
$$;

-- The merged playbook for a live placement: client-level fields, with the
-- placement's override winning wherever it says something.
create or replace function public.portal_playbook(p_placement_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_op public.operator := app.portal_operator();
  v_pl public.placement := app.portal_placement(v_op, p_placement_id);
  v_base public.playbook;
  v_over public.playbook;
begin
  if not app.placement_is_live(v_pl) then
    return jsonb_build_object('placement_id', v_pl.id, 'available', false, 'exists', false,
                              'client_name', app.placement_client_name(v_pl));
  end if;

  select * into v_base from public.playbook where case_file_id = v_pl.case_file_id and placement_id is null;
  select * into v_over from public.playbook where placement_id = v_pl.id;

  if v_base.id is null and v_over.id is null then
    return jsonb_build_object('placement_id', v_pl.id, 'available', true, 'exists', false,
                              'client_name', app.placement_client_name(v_pl));
  end if;

  return jsonb_build_object(
    'placement_id', v_pl.id,
    'available', true,
    'exists', true,
    'client_name', app.placement_client_name(v_pl),
    'business_name', coalesce(nullif(btrim(v_over.business_name), ''), v_base.business_name),
    'offer', coalesce(nullif(btrim(v_over.offer), ''), v_base.offer),
    'locations', coalesce(nullif(btrim(v_over.locations), ''), v_base.locations),
    'hours', coalesce(nullif(btrim(v_over.hours), ''), v_base.hours),
    'qualifies', coalesce(nullif(btrim(v_over.qualifies), ''), v_base.qualifies),
    'disqualifiers', coalesce(nullif(btrim(v_over.disqualifiers), ''), v_base.disqualifiers),
    'handoff_method', coalesce(v_over.handoff_method, v_base.handoff_method),
    'handoff_steps', coalesce(nullif(btrim(v_over.handoff_steps), ''), v_base.handoff_steps),
    'escalation_contacts', coalesce(nullif(btrim(v_over.escalation_contacts), ''), v_base.escalation_contacts),
    'never_say', coalesce(nullif(btrim(v_over.never_say), ''), v_base.never_say),
    'approved_pricing', coalesce(nullif(btrim(v_over.approved_pricing), ''), v_base.approved_pricing),
    'holding_lines', to_jsonb(coalesce(case when cardinality(v_over.holding_lines) > 0 then v_over.holding_lines end,
                                       case when cardinality(v_base.holding_lines) > 0 then v_base.holding_lines end,
                                       array['Let me confirm that with the team and get right back to you.'])),
    'scripts', coalesce((
      select jsonb_agg(jsonb_build_object('title', coalesce(nullif(btrim(pa.label), ''), a.title),
                                          'description', a.description, 'url', a.drive_url)
                       order by pa.sort_order, a.title)
      from public.playbook_asset pa
      join public.internal_asset a on a.id = pa.asset_id and a.archived_at is null
      where pa.playbook_id in (v_base.id, v_over.id)
    ), '[]'::jsonb),
    'has_override', v_over.id is not null,
    'version', coalesce(v_base.version, 0) + coalesce(v_over.version, 0),
    'updated_at', greatest(v_base.updated_at, v_over.updated_at),
    'updated_by', app.profile_name(case when v_over.id is not null
                                             and (v_base.id is null or v_over.updated_at > v_base.updated_at)
                                        then v_over.updated_by else v_base.updated_by end)
  );
end;
$$;

-- The VA's own money. Never the client rate, revenue, margin, or anyone else's
-- pay. Someone viewing as the VA without payroll access (a manager) is refused.
create or replace function public.portal_pay()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_op public.operator := app.portal_operator();
begin
  if app.is_impersonating() and not app.actor_can('payroll.view') then
    raise exception 'pay_hidden: pay is not available to your role' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'statements', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id,
               'period_id', s.period_id,
               'period_start', pp.start_date,
               'period_end', pp.end_date,
               'period_status', pp.status,
               'closes_month', pp.closes_month,
               'client_name', app.placement_client_name(pl),
               'base_amount', s.base_amount,
               'base_detail', s.base_detail,
               'commission_amount', s.commission_amount,
               'commission_detail', s.commission_detail,
               'commission_bookings', coalesce((
                 select jsonb_agg(jsonb_build_object('id', b.id, 'customer', app.customer_short_name(b.customer_name),
                                                     'scheduled_for', b.scheduled_for, 'state', b.state,
                                                     'source', b.source)
                                  order by b.scheduled_for)
                 from unnest(s.commission_booking_ids) ids(booking_id)
                 join public.booking b on b.id = ids.booking_id), '[]'::jsonb),
               'speed_bonus_amount', s.speed_bonus_amount,
               'speed_bonus_detail', s.speed_bonus_detail,
               'adjustments', coalesce((
                 select jsonb_agg(jsonb_build_object('label', a.label, 'reason', a.reason, 'amount', a.amount,
                                                     'added_at', a.added_at) order by a.added_at)
                 from public.pay_adjustment a where a.statement_id = s.id), '[]'::jsonb),
               'adjustment_total', s.adjustment_total,
               'total', s.total,
               'locked', s.locked,
               'locked_at', s.locked_at,
               'payouts', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'id', po.id, 'amount', po.amount, 'method', po.method, 'status', po.status,
                          'sent_at', po.sent_at, 'confirmed_at', po.confirmed_at, 'failure_reason', po.failure_reason,
                          'rolled_into_period', (select r.period_id from public.payout r where r.id = po.rolled_into_payout_id),
                          'rolled_from_period', (select r.period_id from public.payout r where r.id = po.rolled_from_payout_id)
                        ) order by po.created_at)
                 from public.payout po where po.statement_id = s.id and po.operator_id = v_op.id), '[]'::jsonb),
               'questions', coalesce((
                 select jsonb_agg(jsonb_build_object('id', q.id, 'body', q.body, 'asked_at', q.asked_at,
                                                     'answer', q.answer, 'answered_at', q.answered_at,
                                                     'answered_by', app.profile_name(q.answered_by),
                                                     'unread', q.answered_at is not null and q.answer_read_at is null)
                                  order by q.asked_at)
                 from public.pay_question q where q.statement_id = s.id and q.operator_id = v_op.id), '[]'::jsonb)
             ) order by pp.start_date desc nulls last, s.created_at desc)
      from public.pay_statement s
      join public.placement pl on pl.id = s.placement_id
      left join public.pay_period pp on pp.id = s.period_id
      where s.operator_id = v_op.id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.portal_tasks()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_op public.operator := app.portal_operator();
  v_today date := (now() at time zone app.safe_tz(v_op.time_zone))::date;
begin
  return jsonb_build_object(
    'today', v_today,
    'status', v_op.status,
    'tier', v_op.tier,
    'certified_on', v_op.certified_on,
    'tasks', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'detail', t.detail, 'due_on', t.due_on,
                                          'completed_on', t.completed_on,
                                          'overdue', t.completed_on is null and t.due_on < v_today,
                                          'assigned_by', app.profile_name(t.assigned_by))
                       order by (t.completed_on is null) desc, t.due_on nulls last, t.created_at desc)
      from public.operator_task t where t.operator_id = v_op.id
    ), '[]'::jsonb),
    'training', coalesce((
      select jsonb_agg(jsonb_build_object('id', tr.id, 'title', tr.title, 'detail', tr.detail,
                                          'completed_on', tr.completed_on,
                                          'material', case when a.id is not null
                                            then jsonb_build_object('title', a.title, 'url', a.drive_url) end)
                       order by (tr.completed_on is null) desc, tr.created_at)
      from public.operator_training tr
      left join public.internal_asset a on a.id = tr.asset_id and a.archived_at is null
      where tr.operator_id = v_op.id
    ), '[]'::jsonb),
    'notifications', coalesce((
      select jsonb_agg(x.n order by x.created_at desc)
      from (
        select jsonb_build_object('id', n.id, 'title', n.title, 'body', n.body, 'severity', n.severity,
                                  'created_at', n.created_at, 'read_at', n.read_at, 'sent_by', n.sent_by) as n,
               n.created_at
        from public.operator_notification n
        where n.operator_id = v_op.id
        order by n.created_at desc
        limit 200
      ) x
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.portal_profile()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_op public.operator := app.portal_operator();
  v_pay boolean := not app.is_impersonating() or app.actor_can('payroll.view');
begin
  return jsonb_build_object(
    'name', v_op.name,
    'email', v_op.email,
    'phone', v_op.phone,
    'handle', v_op.handle,
    'country', v_op.country,
    'time_zone', app.safe_tz(v_op.time_zone),
    'preferred_channel', v_op.preferred_channel,
    'status', v_op.status,
    'tier', v_op.tier,
    'certified_on', v_op.certified_on,
    'joined_on', v_op.joined_on,
    'pay_visible', v_pay,
    'payout_method', case when v_pay then v_op.payout_method end,
    'payout_last4', case when v_pay and v_op.payout_reference is not null then right(btrim(v_op.payout_reference), 4) end,
    'tax_doc_status', case when v_pay then v_op.tax_doc_status end,
    'mfa_enabled', exists (select 1 from auth.mfa_factors f
                           where f.user_id = v_op.profile_id and f.status = 'verified'),
    'devices', coalesce((
      select jsonb_agg(jsonb_build_object('fingerprint', d.fingerprint, 'label', d.label,
                                          'first_seen_at', d.first_seen_at, 'last_seen_at', d.last_seen_at)
                       order by d.last_seen_at desc)
      from public.known_device d where d.profile_id = v_op.profile_id
    ), '[]'::jsonb),
    'sign_ins', coalesce((
      select jsonb_agg(x.e order by x.at desc)
      from (
        select jsonb_build_object('at', l.at, 'outcome', l.outcome, 'city', l.city, 'country', l.country,
                                  'surface', l.surface) as e, l.at
        from public.login_event l
        where l.profile_id = v_op.profile_id
        order by l.at desc
        limit 10
      ) x
    ), '[]'::jsonb),
    'agreements', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', a.id,
               'name', coalesce(t.name, 'Agreement'),
               'status', a.status,
               'sent_at', a.sent_at,
               'completed_at', a.completed_at,
               'has_copy', v_pay and a.status = 'completed'
                           and (a.signed_document_url is not null or a.docuseal_submission_id is not null)
             ) order by a.sent_at desc nulls last)
      from public.da_agreement a
      join public.da_recipient d on d.id = a.recipient_id
      left join public.da_agreement_template t on t.id = a.template_id
      where d.operator_id = v_op.id and a.superseded_by_id is null
    ), '[]'::jsonb)
  );
end;
$$;

-- The VA's own signed agreement, for the portal to stream. The agreement carries
-- pay terms, so a viewer without payroll access does not get it.
create or replace function public.portal_agreement_copy(p_agreement_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_op public.operator := app.portal_operator();
  v_row record;
begin
  if app.is_impersonating() and not app.actor_can('payroll.view') then
    raise exception 'agreement_hidden: agreements carry pay terms, which your role does not see' using errcode = '42501';
  end if;

  select a.id, a.signed_document_url, a.docuseal_submission_id, t.name as template_name
    into v_row
  from public.da_agreement a
  join public.da_recipient d on d.id = a.recipient_id
  left join public.da_agreement_template t on t.id = a.template_id
  where a.id = p_agreement_id and d.operator_id = v_op.id and a.status = 'completed';

  if v_row.id is null then
    raise exception 'agreement_not_found: that signed agreement is not yours' using errcode = 'P0002';
  end if;

  perform app.portal_view_audit('agreement');

  return jsonb_build_object(
    'signed_document_url', v_row.signed_document_url,
    'docuseal_submission_id', v_row.docuseal_submission_id,
    'template_name', v_row.template_name
  );
end;
$$;

-- Portal actions: the VA's own statements. Each one is a permission that is
-- blocked during impersonation, so nobody viewing as the VA can make it. --------

create or replace function public.portal_log_booking(
  p_placement_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_scheduled_for timestamptz,
  p_live_transfer boolean default false,
  p_note text default null,
  p_confirm_distinct_from uuid default null,
  p_distinct_reason text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_op public.operator;
  v_pl public.placement;
  v_at timestamptz;
  v_period_start date;
  v_dup public.booking;
  v_phone text := nullif(regexp_replace(coalesce(p_customer_phone, ''), '\D', '', 'g'), '');
  v_email text := lower(nullif(btrim(coalesce(p_customer_email, '')), ''));
  v_claim public.booking;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  perform app.require('portal.bookings.log');
  v_op := app.portal_operator();
  v_pl := app.portal_placement(v_op, p_placement_id);

  if not app.placement_is_live(v_pl) then
    raise exception 'placement_ended: this placement has ended, so no new bookings can be logged on it' using errcode = '23514';
  end if;
  if btrim(coalesce(p_customer_name, '')) = '' then
    raise exception 'customer_name_required: add the customer''s name' using errcode = '23514';
  end if;
  if length(btrim(p_customer_name)) > 200 then
    raise exception 'customer_name_too_long: keep the name under 200 characters' using errcode = '23514';
  end if;
  if v_phone is null and v_email is null then
    raise exception 'contact_required: add the customer''s phone or email so the booking can be matched' using errcode = '23514';
  end if;
  if v_phone is not null and length(v_phone) not between 7 and 20 then
    raise exception 'phone_invalid: that phone number does not look right' using errcode = '23514';
  end if;
  if v_email is not null and (v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(v_email) > 254) then
    raise exception 'email_invalid: that email address does not look right' using errcode = '23514';
  end if;
  if length(coalesce(v_note, '')) > 2000 then
    raise exception 'note_too_long: keep the note under 2,000 characters' using errcode = '23514';
  end if;

  v_at := case when coalesce(p_live_transfer, false) then now() else p_scheduled_for end;
  if v_at is null then
    raise exception 'appointment_time_required: add the appointment date and time, or mark it a live transfer' using errcode = '23514';
  end if;

  v_period_start := app.current_pay_period_start((now() at time zone 'UTC')::date);
  if (v_at at time zone 'UTC')::date < v_period_start then
    raise exception 'backfill_not_allowed: bookings before % belong to a pay period you can no longer log into. Ask your manager or DA to add it.',
      to_char(v_period_start, 'FMMonth FMDD') using errcode = '23514';
  end if;
  if v_at > now() + interval '120 days' then
    raise exception 'too_far_ahead: that appointment is more than four months away. Check the date.' using errcode = '23514';
  end if;

  -- Same customer, same placement, within two hours: very probably the same
  -- booking. The VA sees the existing one instead of creating a duplicate.
  select * into v_dup
  from public.booking b
  where b.placement_id = v_pl.id
    and b.state <> 'rejected'
    and abs(extract(epoch from (b.scheduled_for - v_at))) <= 2 * 3600
    and (
      (v_phone is not null and length(regexp_replace(coalesce(b.customer_phone, ''), '\D', '', 'g')) >= 7
        and right(regexp_replace(b.customer_phone, '\D', '', 'g'), 10) = right(v_phone, 10))
      or (v_email is not null and lower(b.customer_email) = v_email)
    )
  order by abs(extract(epoch from (b.scheduled_for - v_at)))
  limit 1;

  if v_dup.id is not null
     and (p_confirm_distinct_from is distinct from v_dup.id
          or length(btrim(coalesce(p_distinct_reason, ''))) < 10) then
    return jsonb_build_object(
      'ok', false,
      'duplicate', jsonb_build_object(
        'id', v_dup.id,
        'customer', app.customer_short_name(v_dup.customer_name),
        'scheduled_for', v_dup.scheduled_for,
        'state', v_dup.state,
        'source', v_dup.source
      )
    );
  end if;

  if v_dup.id is not null then
    v_note := concat_ws(E'\n', v_note,
      format('Logged as a different booking from %s: %s', v_dup.id, left(btrim(p_distinct_reason), 500)));
  end if;

  v_claim := app.insert_booking_claim(v_pl, p_customer_name, v_at, p_customer_phone, p_customer_email,
                                      v_note, coalesce(p_live_transfer, false));

  return jsonb_build_object(
    'ok', true,
    'booking', jsonb_build_object('id', v_claim.id, 'state', v_claim.state,
                                  'matched', v_claim.matched_booking_id is not null)
  );
end;
$$;

create or replace function public.portal_raise_escalation(
  p_placement_id uuid,
  p_category text,
  p_customer_context text,
  p_needed text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_op public.operator;
  v_pl public.placement;
  v_row public.escalation;
begin
  perform app.require('portal.escalations.raise');
  v_op := app.portal_operator();
  v_pl := app.portal_placement(v_op, p_placement_id);

  if not app.placement_is_live(v_pl) then
    raise exception 'placement_ended: this placement has ended' using errcode = '23514';
  end if;
  if coalesce(p_category, '') not in ('clinical', 'pricing_exception', 'complaint', 'scheduling_conflict', 'scope', 'other') then
    raise exception 'category_required: pick what kind of question this is' using errcode = '23514';
  end if;
  if length(btrim(coalesce(p_customer_context, ''))) not between 5 and 4000 then
    raise exception 'context_required: say what is happening with the customer' using errcode = '23514';
  end if;
  if length(btrim(coalesce(p_needed, ''))) not between 5 and 4000 then
    raise exception 'need_required: say exactly what you need decided or answered' using errcode = '23514';
  end if;

  -- Routing is the existing trigger's (app.escalation_recipients).
  insert into public.escalation (placement_id, operator_id, case_file_id, category, customer_context, needed,
                                 response_due_at)
  values (v_pl.id, v_op.id, v_pl.case_file_id, p_category::public.escalation_category,
          btrim(p_customer_context), btrim(p_needed),
          now() + make_interval(hours => coalesce(v_pl.escalation_response_hours, 4)))
  returning * into v_row;

  perform app.audit('escalation.raised', 'escalation', v_row.id::text,
    format('Raised a %s escalation', replace(p_category, '_', ' ')), null,
    jsonb_build_object('response_due_at', v_row.response_due_at, 'routed_to', v_row.routed_to),
    v_pl.case_file_id);

  -- And the people it is routed to are told.
  perform app.notify_staff(
    app.admin_recipient_ids() || app.case_file_manager_ids(v_pl.case_file_id),
    'escalation.raised', 'important',
    format('%s needs an answer on %s', v_op.name, app.placement_client_name(v_pl)),
    format('%s. Due by %s UTC. %s', initcap(replace(p_category, '_', ' ')),
           to_char(v_row.response_due_at at time zone 'UTC', 'FMDD Mon HH24:MI'), left(btrim(p_needed), 500)),
    v_op.id);

  return jsonb_build_object(
    'ok', true,
    'id', v_row.id,
    'response_due_at', v_row.response_due_at,
    'holding_line', app.placement_holding_line(v_pl)
  );
end;
$$;

create or replace function public.portal_close_escalation(p_escalation_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_op public.operator;
  v_row public.escalation;
begin
  perform app.require('portal.escalations.raise');
  v_op := app.portal_operator();

  update public.escalation
     set status = 'closed', closed_at = now(), answer_read_at = coalesce(answer_read_at, now())
   where id = p_escalation_id and operator_id = v_op.id and status <> 'closed'
     and placement_id in (select app.portal_placement_ids(v_op))
  returning * into v_row;

  if v_row.id is null then
    raise exception 'escalation_not_found: that escalation is not open, or not yours' using errcode = 'P0002';
  end if;

  perform app.audit('escalation.closed', 'escalation', v_row.id::text, 'Closed the escalation after acting on it',
    null, null, v_row.case_file_id);
  return jsonb_build_object('ok', true);
end;
$$;

-- Opening an answer clears its badge, but only for the VA: someone viewing as
-- them does not mark anything read.
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
    return;
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
    return;
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
    return;
  end if;
  update public.pay_question set answer_read_at = now()
   where id = p_question_id and operator_id = v_op.id and answered_at is not null and answer_read_at is null;
end;
$$;

-- Shift reports. Filed once; a change is a new version with a reason, and the
-- original stays on record as superseded.
create or replace function app.check_report_values(
  p_conversations integer, p_appointments integer, p_follow_ups integer, p_escalations integer,
  p_start text, p_end text, p_configured jsonb
)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if coalesce(p_conversations, -1) < 0 or coalesce(p_appointments, -1) < 0
     or coalesce(p_follow_ups, -1) < 0 or coalesce(p_escalations, -1) < 0
     or greatest(p_conversations, p_appointments, p_follow_ups, p_escalations) > 5000 then
    raise exception 'numbers_required: every count has to be a number from 0 up' using errcode = '23514';
  end if;
  if coalesce(p_start, '') !~ '^([01]?\d|2[0-3]):[0-5]\d$' or coalesce(p_end, '') !~ '^([01]?\d|2[0-3]):[0-5]\d$' then
    raise exception 'times_required: add the time you actually started and finished, as HH:MM' using errcode = '23514';
  end if;
  if p_configured is not null and jsonb_typeof(p_configured) <> 'object' then
    raise exception 'answers_invalid: the extra answers were not in the expected shape' using errcode = '23514';
  end if;
end;
$$;

create or replace function public.portal_submit_report(
  p_placement_id uuid,
  p_shift_date date,
  p_shift_start_actual text,
  p_shift_end_actual text,
  p_conversations_handled integer,
  p_appointments_booked integer,
  p_follow_ups_completed integer,
  p_escalations_raised integer,
  p_blockers text default '',
  p_notes text default '',
  p_configured jsonb default '{}'::jsonb,
  p_variance_explanation text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_op public.operator;
  v_pl public.placement;
  v_prefill jsonb;
  v_row public.eod_report;
begin
  perform app.require('portal.reports.submit');
  v_op := app.portal_operator();
  v_pl := app.portal_placement(v_op, p_placement_id);

  if p_shift_date is null or p_shift_date > app.placement_today(v_pl) then
    raise exception 'future_shift: a report is filed for today or a past shift' using errcode = '23514';
  end if;
  if p_shift_date < v_pl.start_date then
    raise exception 'before_placement: that date is before this placement started' using errcode = '23514';
  end if;
  if app.pay_period_closed_for(p_shift_date) then
    raise exception 'period_closed: that pay period is closed, so your manager or DA files this report' using errcode = '23514';
  end if;
  if exists (select 1 from public.eod_report r
             where r.placement_id = v_pl.id and r.shift_date = p_shift_date and r.superseded_by_id is null) then
    raise exception 'already_filed: there is already a report for that shift. Correct it instead.' using errcode = '23514';
  end if;

  perform app.check_report_values(p_conversations_handled, p_appointments_booked, p_follow_ups_completed,
                                  p_escalations_raised, p_shift_start_actual, p_shift_end_actual, p_configured);

  v_prefill := public.portal_shift_prefill(v_pl.id, p_shift_date);
  if (p_appointments_booked <> (v_prefill ->> 'appointments_booked')::integer
      or p_escalations_raised <> (v_prefill ->> 'escalations_raised')::integer)
     and length(btrim(coalesce(p_variance_explanation, ''))) < 5 then
    raise exception 'explanation_required: your numbers differ from what the system recorded that shift (% bookings, % escalations). Say why.',
      v_prefill ->> 'appointments_booked', v_prefill ->> 'escalations_raised' using errcode = '23514';
  end if;

  insert into public.eod_report (
    placement_id, operator_id, shift_date, shift_start_actual, shift_end_actual,
    conversations_handled, appointments_booked, follow_ups_completed, escalations_raised,
    blockers, notes, configured, system_counts, variance_explanation
  ) values (
    v_pl.id, v_op.id, p_shift_date, p_shift_start_actual, p_shift_end_actual,
    p_conversations_handled, p_appointments_booked, p_follow_ups_completed, p_escalations_raised,
    left(coalesce(p_blockers, ''), 4000), left(coalesce(p_notes, ''), 4000), coalesce(p_configured, '{}'::jsonb),
    jsonb_build_object('appointments_booked', (v_prefill ->> 'appointments_booked')::integer,
                       'escalations_raised', (v_prefill ->> 'escalations_raised')::integer),
    nullif(btrim(coalesce(p_variance_explanation, '')), '')
  ) returning * into v_row;

  perform app.audit('eod.submitted', 'eod_report', v_row.id::text,
    format('Filed the shift report for %s', p_shift_date), null, null, v_pl.case_file_id);

  return jsonb_build_object('ok', true, 'id', v_row.id);
end;
$$;

create or replace function public.portal_correct_report(
  p_report_id uuid,
  p_shift_start_actual text,
  p_shift_end_actual text,
  p_conversations_handled integer,
  p_appointments_booked integer,
  p_follow_ups_completed integer,
  p_escalations_raised integer,
  p_blockers text,
  p_notes text,
  p_configured jsonb,
  p_reason text,
  p_variance_explanation text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_op public.operator;
  v_orig public.eod_report;
  v_prefill jsonb;
  v_row public.eod_report;
begin
  perform app.require('portal.reports.submit');
  v_op := app.portal_operator();

  select * into v_orig from public.eod_report where id = p_report_id and operator_id = v_op.id;
  if v_orig.id is null then
    raise exception 'report_not_found: that report is not one of yours' using errcode = 'P0002';
  end if;
  perform app.portal_placement(v_op, v_orig.placement_id);
  if v_orig.superseded_by_id is not null then
    raise exception 'already_corrected: correct the current version instead' using errcode = '23514';
  end if;
  if length(btrim(coalesce(p_reason, ''))) not between 5 and 2000 then
    raise exception 'reason_required: a correction has to say why, or the history proves nothing' using errcode = '23514';
  end if;
  if app.pay_period_closed_for(v_orig.shift_date) then
    raise exception 'period_closed: that pay period is closed, so a manager or admin makes this correction' using errcode = '23514';
  end if;

  perform app.check_report_values(p_conversations_handled, p_appointments_booked, p_follow_ups_completed,
                                  p_escalations_raised, p_shift_start_actual, p_shift_end_actual, p_configured);

  v_prefill := public.portal_shift_prefill(v_orig.placement_id, v_orig.shift_date);
  if (p_appointments_booked <> (v_prefill ->> 'appointments_booked')::integer
      or p_escalations_raised <> (v_prefill ->> 'escalations_raised')::integer)
     and length(btrim(coalesce(p_variance_explanation, ''))) < 5 then
    raise exception 'explanation_required: your numbers differ from what the system recorded that shift (% bookings, % escalations). Say why.',
      v_prefill ->> 'appointments_booked', v_prefill ->> 'escalations_raised' using errcode = '23514';
  end if;

  insert into public.eod_report (
    placement_id, operator_id, shift_date, shift_start_actual, shift_end_actual,
    conversations_handled, appointments_booked, follow_ups_completed, escalations_raised,
    blockers, notes, configured, version, supersedes_id, correction_reason, system_counts, variance_explanation
  ) values (
    v_orig.placement_id, v_orig.operator_id, v_orig.shift_date, p_shift_start_actual, p_shift_end_actual,
    p_conversations_handled, p_appointments_booked, p_follow_ups_completed, p_escalations_raised,
    left(coalesce(p_blockers, ''), 4000), left(coalesce(p_notes, ''), 4000), coalesce(p_configured, v_orig.configured),
    v_orig.version + 1, v_orig.id, btrim(p_reason),
    jsonb_build_object('appointments_booked', (v_prefill ->> 'appointments_booked')::integer,
                       'escalations_raised', (v_prefill ->> 'escalations_raised')::integer),
    nullif(btrim(coalesce(p_variance_explanation, '')), '')
  ) returning * into v_row;

  update public.eod_report set superseded_by_id = v_row.id where id = v_orig.id;

  perform app.audit('eod.corrected', 'eod_report', v_row.id::text,
    format('Corrected the shift report for %s (version %s): %s', v_orig.shift_date, v_row.version, btrim(p_reason)),
    null, null, (select pl.case_file_id from public.placement pl where pl.id = v_orig.placement_id));

  return jsonb_build_object('ok', true, 'id', v_row.id, 'version', v_row.version);
end;
$$;

-- Absences. Told before the shift starts is advance notice; after it has
-- started it is recorded as late notice. Nothing is decided here.
create or replace function public.portal_report_absence(p_placement_id uuid, p_shift_date date, p_reason text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_op public.operator;
  v_pl public.placement;
  v_starts timestamptz;
  v_ends timestamptz;
  v_existing public.shift_attendance;
  v_late boolean;
begin
  perform app.require('portal.attendance.report_absence');
  v_op := app.portal_operator();
  v_pl := app.portal_placement(v_op, p_placement_id);

  if not app.placement_is_live(v_pl) then
    raise exception 'placement_ended: this placement has ended' using errcode = '23514';
  end if;
  if length(btrim(coalesce(p_reason, ''))) not between 3 and 2000 then
    raise exception 'reason_required: say briefly why you cannot make it' using errcode = '23514';
  end if;
  if p_shift_date is null or not (extract(isodow from p_shift_date)::smallint = any(v_pl.working_days))
     or p_shift_date < v_pl.start_date or (v_pl.end_date is not null and p_shift_date > v_pl.end_date) then
    raise exception 'not_a_shift: you are not scheduled that day' using errcode = '23514';
  end if;
  if p_shift_date > app.placement_today(v_pl) + 90 then
    raise exception 'too_far_ahead: report absences up to three months ahead' using errcode = '23514';
  end if;

  select sb.starts_at, sb.ends_at into v_starts, v_ends from app.shift_bounds(v_pl, p_shift_date) sb;
  if v_ends is null or v_ends <= now() then
    raise exception 'shift_over: that shift is already over. Talk to your manager.' using errcode = '23514';
  end if;

  select * into v_existing from public.shift_attendance where placement_id = v_pl.id and shift_date = p_shift_date;
  if v_existing.status in ('excused_emergency', 'abandoned', 'worked') then
    raise exception 'already_decided: DA has already recorded that shift' using errcode = '23514';
  end if;

  v_late := now() >= v_starts;

  insert into public.shift_attendance (placement_id, operator_id, shift_date, status, notice_at, late_notice, reason)
  values (v_pl.id, v_op.id, p_shift_date, 'notified_absence', now(), v_late, btrim(p_reason))
  on conflict (placement_id, shift_date) do update
    set status = 'notified_absence', notice_at = now(), late_notice = excluded.late_notice, reason = excluded.reason;

  perform app.audit('attendance.absence_reported', 'placement', v_pl.id::text,
    format('Reported an absence for %s (%s notice): %s', p_shift_date,
           case when v_late then 'late' else 'advance' end, btrim(p_reason)),
    null, null, v_pl.case_file_id);

  perform app.notify_staff(
    app.admin_recipient_ids() || app.placement_manager_ids(v_pl.id),
    'attendance.absence', case when v_late then 'urgent'::public.notification_severity
                                else 'important'::public.notification_severity end,
    format('%s cannot work %s (%s notice)', v_op.name, to_char(p_shift_date, 'FMDy DD Mon'),
           case when v_late then 'late' else 'advance' end),
    format('%s shift. Reason: %s', app.placement_client_name(v_pl), left(btrim(p_reason), 500)),
    v_op.id);

  return jsonb_build_object('ok', true, 'late_notice', v_late);
end;
$$;

create or replace function public.portal_acknowledge_notice(p_notice_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.account_notice;
begin
  perform app.portal_operator();
  v_row := public.acknowledge_notice(p_notice_id);
  return jsonb_build_object('ok', true, 'acknowledged_at', v_row.acknowledged_at);
end;
$$;

create or replace function public.portal_complete_task(p_task_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_op public.operator;
  v_row public.operator_task;
begin
  perform app.require('portal.tasks.complete');
  v_op := app.portal_operator();
  update public.operator_task
     set completed_on = (now() at time zone app.safe_tz(v_op.time_zone))::date
   where id = p_task_id and operator_id = v_op.id and completed_on is null
  returning * into v_row;
  if v_row.id is null then
    raise exception 'task_not_found: that task is already done, or not yours' using errcode = 'P0002';
  end if;
  perform app.audit('task.completed', 'operator_task', v_row.id::text, format('Completed the task %s', v_row.title),
    null, null, null, v_op.profile_id);
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.portal_complete_training(p_training_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_op public.operator;
  v_row public.operator_training;
begin
  perform app.require('portal.tasks.complete');
  v_op := app.portal_operator();
  update public.operator_training
     set completed_on = (now() at time zone app.safe_tz(v_op.time_zone))::date
   where id = p_training_id and operator_id = v_op.id and completed_on is null
  returning * into v_row;
  if v_row.id is null then
    raise exception 'training_not_found: that item is already done, or not yours' using errcode = 'P0002';
  end if;
  perform app.audit('training.completed', 'operator_training', v_row.id::text,
    format('Completed the training item %s', v_row.title), null, null, null, v_op.profile_id);
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.portal_update_profile(
  p_name text,
  p_phone text,
  p_handle text,
  p_time_zone text,
  p_preferred_channel text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_op public.operator;
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_handle text := nullif(btrim(coalesce(p_handle, '')), '');
begin
  perform app.require('portal.profile.edit');
  v_op := app.portal_operator();

  if length(btrim(coalesce(p_name, ''))) not between 2 and 120 then
    raise exception 'name_required: add your name' using errcode = '23514';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = btrim(coalesce(p_time_zone, ''))) then
    raise exception 'time_zone_invalid: pick a time zone from the list' using errcode = '23514';
  end if;
  if coalesce(p_preferred_channel, '') not in ('in_app', 'discord', 'email', 'whatsapp') then
    raise exception 'channel_invalid: pick how you want to be notified' using errcode = '23514';
  end if;
  if v_phone is not null and v_phone !~ '^\+?[0-9 ()./-]{6,40}$' then
    raise exception 'phone_invalid: use digits, with the country code' using errcode = '23514';
  end if;
  if length(coalesce(v_handle, '')) > 80 then
    raise exception 'handle_invalid: keep the handle under 80 characters' using errcode = '23514';
  end if;

  update public.operator
     set name = btrim(p_name),
         phone = v_phone,
         handle = v_handle,
         time_zone = btrim(p_time_zone),
         preferred_channel = p_preferred_channel::public.notification_channel
   where id = v_op.id;

  update public.profile set full_name = btrim(p_name), updated_at = now() where id = v_op.profile_id;

  perform app.audit('operator.profile_updated', 'operator', v_op.id::text, 'Updated their own profile',
    jsonb_build_object('name', v_op.name, 'phone', v_op.phone, 'handle', v_op.handle,
                       'time_zone', v_op.time_zone, 'preferred_channel', v_op.preferred_channel),
    jsonb_build_object('name', btrim(p_name), 'phone', v_phone, 'handle', v_handle,
                       'time_zone', btrim(p_time_zone), 'preferred_channel', p_preferred_channel),
    null, v_op.profile_id);
  return jsonb_build_object('ok', true);
end;
$$;

-- A changed payout destination is how contractor pay gets stolen: a fresh
-- password confirmation, an alert, the details to admins only, and a notice to
-- the VA in case it was not them.
create or replace function public.portal_change_payout(p_method text, p_reference text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_op public.operator;
  v_audit bigint;
  v_ref text := btrim(coalesce(p_reference, ''));
begin
  perform app.require('portal.payout.change');
  v_op := app.portal_operator();

  if coalesce(p_method, '') not in ('wise', 'payoneer', 'bank_transfer', 'paypal', 'crypto_usdc') then
    raise exception 'method_invalid: pick a payout method' using errcode = '23514';
  end if;
  if length(v_ref) not between 4 and 200 then
    raise exception 'reference_required: add the account, email or wallet the money goes to' using errcode = '23514';
  end if;

  perform app.require_step_up('change your payout method');

  update public.operator
     set payout_method = p_method::public.payout_method, payout_reference = v_ref
   where id = v_op.id;

  v_audit := app.audit('operator.payout_changed', 'operator', v_op.id::text,
    format('Changed their payout method to %s ending %s', replace(p_method, '_', ' '), right(v_ref, 4)),
    jsonb_build_object('method', v_op.payout_method,
                       'ending', case when v_op.payout_reference is not null then right(v_op.payout_reference, 4) end),
    jsonb_build_object('method', p_method, 'ending', right(v_ref, 4)),
    null, v_op.profile_id);

  -- The alert feed is shared with managers: it says that it changed, not to what.
  perform app.raise_owner_alert('payout.method_changed',
    format('%s changed where their pay goes. Details are with admins.', v_op.name),
    v_audit, v_op.profile_id, 'urgent');

  perform app.notify_staff(app.admin_recipient_ids(), 'payout.method_changed', 'urgent',
    format('%s changed their payout method', v_op.name),
    format('Now %s ending %s. Confirm it with them before the next payout.', replace(p_method, '_', ' '), right(v_ref, 4)),
    v_op.id);

  insert into public.operator_notification (operator_id, severity, title, body, sent_by)
  values (v_op.id, 'important', 'Your payout method changed',
          format('Your pay will now go to %s ending %s. If you did not make this change, contact DA immediately.',
                 replace(p_method, '_', ' '), right(v_ref, 4)),
          'System');

  return jsonb_build_object('ok', true, 'last4', right(v_ref, 4));
end;
$$;

create or replace function public.portal_submit_tax_document(p_reference text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_op public.operator;
begin
  perform app.require('portal.tax.submit');
  v_op := app.portal_operator();

  if coalesce(btrim(p_reference), '') !~ '^https://[^[:space:]]{4,}$' or length(btrim(p_reference)) > 1000 then
    raise exception 'link_required: share the document as a link starting with https://' using errcode = '23514';
  end if;
  if v_op.tax_doc_status = 'on_file' then
    raise exception 'already_on_file: DA already has your tax document' using errcode = '23514';
  end if;

  update public.operator
     set tax_doc_status = 'submitted', tax_doc_reference = btrim(p_reference)
   where id = v_op.id;

  perform app.audit('operator.tax_document_submitted', 'operator', v_op.id::text,
    'Submitted a tax document for review', null, null, null, v_op.profile_id);
  perform app.notify_staff(app.admin_recipient_ids(), 'tax.document_submitted', 'important',
    format('%s submitted a tax document', v_op.name), 'Review it and mark it on file.', v_op.id);
  return jsonb_build_object('ok', true);
end;
$$;

-- A question about one statement. Admins answer; managers, who do not see pay,
-- are not told.
create or replace function public.portal_ask_pay_question(p_statement_id uuid, p_body text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_op public.operator;
  v_row public.pay_question;
begin
  perform app.require('portal.pay.ask');
  v_op := app.portal_operator();

  if not exists (select 1 from public.pay_statement s where s.id = p_statement_id and s.operator_id = v_op.id) then
    raise exception 'statement_not_found: that statement is not yours' using errcode = 'P0002';
  end if;
  if length(btrim(coalesce(p_body, ''))) not between 5 and 2000 then
    raise exception 'question_required: ask your question in a sentence or two' using errcode = '23514';
  end if;

  insert into public.pay_question (operator_id, statement_id, body)
  values (v_op.id, p_statement_id, btrim(p_body))
  returning * into v_row;

  perform app.audit('pay.question_asked', 'pay_question', v_row.id::text,
    'Asked a question about a pay statement', null, null, null, v_op.profile_id);
  perform app.notify_staff(app.admin_recipient_ids(), 'pay.question', 'important',
    format('%s has a question about a pay statement', v_op.name), left(btrim(p_body), 500), v_op.id);
  return jsonb_build_object('ok', true, 'id', v_row.id);
end;
$$;

create or replace function public.portal_remove_device(p_fingerprint text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_op public.operator;
begin
  perform app.require('portal.security.manage');
  v_op := app.portal_operator();
  delete from public.known_device where profile_id = v_op.profile_id and fingerprint = p_fingerprint;
  if not found then
    raise exception 'device_not_found: that device is not on your account' using errcode = 'P0002';
  end if;
  perform app.audit('account.device_removed', 'known_device', left(p_fingerprint, 12), 'Removed a known device',
    null, null, null, v_op.profile_id);
  return jsonb_build_object('ok', true);
end;
$$;

-- Grants -------------------------------------------------------------------------

do $$
declare
  f text;
begin
  foreach f in array array[
    'app.admin_recipient_ids()',
    'app.case_file_manager_ids(uuid)',
    'app.placement_manager_ids(uuid)',
    'app.notify_staff(uuid[], text, public.notification_severity, text, text, uuid)',
    'app.safe_tz(text)',
    'app.placement_today(public.placement)',
    'app.placement_is_live(public.placement)',
    'app.placement_customer_access(public.placement)',
    'app.shift_bounds(public.placement, date)',
    'app.portal_operator()',
    'app.portal_placement_ids(public.operator)',
    'app.portal_placement(public.operator, uuid)',
    'app.customer_short_name(text)',
    'app.profile_name(uuid)',
    'app.placement_client_name(public.placement)',
    'app.current_pay_period_start(date)',
    'app.pay_period_closed_for(date)',
    'app.placement_holding_line(public.placement)',
    'app.placement_attendance(uuid, date, date)',
    'app.portal_view_audit(text)',
    'app.insert_booking_claim(public.placement, text, timestamptz, text, text, text, boolean)',
    'app.check_report_values(integer, integer, integer, integer, text, text, jsonb)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;

  foreach f in array array[
    'public.portal_context(text, uuid)',
    'public.portal_today(uuid)',
    'public.portal_bookings(uuid, date, text)',
    'public.portal_booking(uuid)',
    'public.portal_escalations(uuid)',
    'public.portal_shift_reports(uuid)',
    'public.portal_shift_prefill(uuid, date)',
    'public.portal_playbook(uuid)',
    'public.portal_pay()',
    'public.portal_tasks()',
    'public.portal_profile()',
    'public.portal_agreement_copy(uuid)',
    'public.portal_log_booking(uuid, text, text, text, timestamptz, boolean, text, uuid, text)',
    'public.portal_raise_escalation(uuid, text, text, text)',
    'public.portal_close_escalation(uuid)',
    'public.portal_mark_escalation_read(uuid)',
    'public.portal_mark_notification_read(uuid)',
    'public.portal_mark_pay_answer_read(uuid)',
    'public.portal_submit_report(uuid, date, text, text, integer, integer, integer, integer, text, text, jsonb, text)',
    'public.portal_correct_report(uuid, text, text, integer, integer, integer, integer, text, text, jsonb, text, text)',
    'public.portal_report_absence(uuid, date, text)',
    'public.portal_acknowledge_notice(uuid)',
    'public.portal_complete_task(uuid)',
    'public.portal_complete_training(uuid)',
    'public.portal_update_profile(text, text, text, text, text)',
    'public.portal_change_payout(text, text)',
    'public.portal_submit_tax_document(text)',
    'public.portal_ask_pay_question(uuid, text)',
    'public.portal_remove_device(text)',
    'public.claim_booking(uuid, text, timestamptz, text, text, text)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end
$$;
