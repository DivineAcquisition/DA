-- Staff side of the Sales Operator portal: View As, the admin panel, and the
-- sweep that flags missed shifts and late answers.
--
-- View As reuses the impersonation record (kind = 'view_as'). Starting one needs
-- the existing step-up purpose, a reason, and either accounts.impersonate
-- (owner, admin) or the narrower operators.view_as (manager, operators in scope
-- only). The target is always an operator and never the viewer.
--
-- Everything the panel does is in the staff member's own name: each action calls
-- app.require_own_name(), which evaluates the real signed-in person, and writes
-- auth.uid() as the reviewer, answerer or decider. app.audit() attaches the View
-- As session automatically.

-- Helpers --------------------------------------------------------------------

create or replace function app.actor_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profile p where p.id = auth.uid();
$$;

-- The engine's answer for the real signed-in person, including during View As
-- of an operator (the own-name exception), without raising.
create or replace function app.actor_allowed(p_permission text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  d record;
begin
  perform set_config('app.own_name_action', 'on', true);
  select * into d from app.decide(p_permission, auth.uid()) limit 1;
  perform set_config('app.own_name_action', 'off', true);
  return coalesce(d.allowed, false);
end;
$$;

create or replace function app.staff_can_reach_placement(p_placement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
     and app.effective_state(auth.uid()) = 'active'
     and case app.actor_role()
           when 'owner' then true
           when 'admin' then true
           when 'manager' then app.scope_includes_placement(auth.uid(), p_placement_id)
           else false
         end;
$$;

create or replace function app.staff_can_reach_operator(p_operator_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
     and app.effective_state(auth.uid()) = 'active'
     and exists (select 1 from public.operator o where o.id = p_operator_id)
     and case app.actor_role()
           when 'owner' then true
           when 'admin' then true
           when 'manager' then exists (
             select 1 from public.placement pl
             where pl.operator_id = p_operator_id and app.scope_includes_placement(auth.uid(), pl.id))
           else false
         end;
$$;

create or replace function app.require_reach_operator(p_operator_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app.staff_can_reach_operator(p_operator_id) then
    raise exception 'out_of_scope: that operator is not in your scope' using errcode = '42501';
  end if;
end;
$$;

create or replace function app.require_reach_placement(p_placement_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app.staff_can_reach_placement(p_placement_id) then
    raise exception 'out_of_scope: that placement is not in your scope' using errcode = '42501';
  end if;
end;
$$;

-- A manager viewing as a VA sees only the placements in the manager's own scope.
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
    )
    and (
      not app.is_impersonating()
      or app.actor_role() in ('owner', 'admin')
      or app.scope_includes_placement(auth.uid(), pl.id)
    );
$$;

create or replace function app.reason_kind_label(p_kind text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_kind
    when 'support_request' then 'Support request'
    when 'dispute_investigation' then 'Dispute investigation'
    when 'quality_review' then 'Quality review'
    when 'pay_question' then 'Pay question'
    else 'Other'
  end;
$$;

-- View As ------------------------------------------------------------------------

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

  -- Expired but never stamped: close them, so only a live session counts below.
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
  if not app.staff_can_reach_operator(v_op.id) then
    raise exception 'out_of_scope: that operator is not in your scope' using errcode = '42501';
  end if;
  if coalesce(p_reason_kind, '') not in ('support_request', 'dispute_investigation', 'quality_review', 'pay_question', 'other') then
    raise exception 'reason_required: pick why you are viewing this account' using errcode = '23514';
  end if;
  if length(btrim(coalesce(p_note, ''))) not between 5 and 1000 then
    raise exception 'note_required: add a short note. The operator is told, and they will read it.' using errcode = '23514';
  end if;

  v_step_up := app.require_step_up('start an impersonation session');
  v_reason := app.reason_kind_label(p_reason_kind) || ': ' || btrim(p_note);

  insert into public.impersonation (
    actor_profile_id, target_profile_id, reason, expires_at, step_up_id, kind, reason_kind
  ) values (
    auth.uid(), v_target.id, v_reason,
    now() + make_interval(mins => least(greatest(coalesce(p_minutes, 30), 5), 30)),
    v_step_up, 'view_as', p_reason_kind
  ) returning * into v_row;

  v_audit := app.audit('view_as.started', 'profile', v_target.id::text,
    format('Started viewing as %s: %s', v_op.name, v_reason),
    null, jsonb_build_object('expires_at', v_row.expires_at, 'reason_kind', p_reason_kind, 'reason', v_reason),
    null, v_target.id);

  perform app.raise_owner_alert('view_as_started',
    format('%s started viewing as %s (%s)', app.profile_name(auth.uid()), v_op.name,
           app.reason_kind_label(p_reason_kind)),
    v_audit, v_target.id, 'urgent');

  -- The operator is told after the session starts, so viewing cannot be
  -- blocked, but they always find out.
  insert into public.account_notice (profile_id, body, severity, blocking, created_by)
  values (
    v_target.id,
    format('%s viewed your portal as you on %s UTC. Reason: %s.',
      app.profile_name(auth.uid()), to_char(now() at time zone 'UTC', 'FMDD Mon YYYY at HH24:MI'), v_reason),
    'important', false, auth.uid()
  );

  update public.impersonation set notified_target_at = now() where id = v_row.id;

  return jsonb_build_object('ok', true, 'session_id', v_row.id, 'expires_at', v_row.expires_at);
end;
$$;

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
     set expires_at = greatest(expires_at, now()) + interval '30 minutes',
         extended_at = now(),
         extension_reason = btrim(p_reason)
   where id = v_row.id
  returning * into v_row;

  perform app.audit('view_as.extended', 'profile', v_row.target_profile_id::text,
    format('Extended the View As session by 30 minutes: %s', btrim(p_reason)),
    null, jsonb_build_object('expires_at', v_row.expires_at), null, v_row.target_profile_id);

  return jsonb_build_object('ok', true, 'expires_at', v_row.expires_at);
end;
$$;

-- Session history: one operator's (anyone who can reach them), or every session
-- (owners only).
create or replace function public.view_as_sessions(
  p_operator_id uuid default null,
  p_actor_profile_id uuid default null,
  p_from date default null,
  p_to date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_target uuid;
begin
  if p_operator_id is null then
    if app.actor_role() is distinct from 'owner' then
      raise exception 'owners_only: only an Owner sees every session' using errcode = '42501';
    end if;
  else
    perform app.require_reach_operator(p_operator_id);
    select o.profile_id into v_target from public.operator o where o.id = p_operator_id;
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', i.id,
             'kind', i.kind,
             'actor_profile_id', i.actor_profile_id,
             'actor_name', app.profile_name(i.actor_profile_id),
             'actor_role', a.role,
             'target_name', coalesce(o.name, app.profile_name(i.target_profile_id)),
             'operator_id', o.id,
             'reason_kind', i.reason_kind,
             'reason', i.reason,
             'started_at', i.started_at,
             'expires_at', i.expires_at,
             'ended_at', i.ended_at,
             'ended_reason', case when i.ended_at is null and i.expires_at <= now() then 'expired' else i.ended_reason end,
             'live', i.ended_at is null and i.expires_at > now(),
             'extended_at', i.extended_at,
             'extension_reason', i.extension_reason,
             'minutes', round(extract(epoch from (least(coalesce(i.ended_at, i.expires_at), i.expires_at, now()) - i.started_at)) / 60.0),
             'pages', coalesce((
               select jsonb_agg(distinct ev.entity_id)
               from public.audit_event ev
               where ev.impersonation_id = i.id and ev.action = 'view_as.viewed'), '[]'::jsonb),
             'actions', coalesce((
               select jsonb_agg(jsonb_build_object('at', ev.at, 'action', ev.action, 'summary', ev.summary) order by ev.at)
               from public.audit_event ev
               where ev.impersonation_id = i.id and ev.action <> 'view_as.viewed'), '[]'::jsonb)
           ) order by i.started_at desc)
    from public.impersonation i
    join public.profile a on a.id = i.actor_profile_id
    join public.profile t on t.id = i.target_profile_id
    left join public.operator o on o.profile_id = i.target_profile_id
    where (v_target is null or i.target_profile_id = v_target)
      and (p_operator_id is not null or i.kind = 'view_as' or t.role = 'operator')
      and (p_actor_profile_id is null or i.actor_profile_id = p_actor_profile_id)
      and (p_from is null or i.started_at >= p_from::timestamp at time zone 'UTC')
      and (p_to is null or i.started_at < (p_to + 1)::timestamp at time zone 'UTC')
  ), '[]'::jsonb);
end;
$$;

-- Roster -------------------------------------------------------------------------

-- The operators this staff member can reach, with what needs attention.
create or replace function public.staff_operator_roster()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if app.actor_role() not in ('owner', 'admin', 'manager') or app.effective_state(auth.uid()) <> 'active' then
    raise exception 'permission_denied: the roster is for staff' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(x.r order by x.name)
    from (
      select o.name, jsonb_build_object(
        'id', o.id,
        'name', o.name,
        'status', o.status,
        'tier', o.tier,
        'has_account', o.profile_id is not null,
        'placements', coalesce((
          select jsonb_agg(jsonb_build_object('id', pl.id, 'client_name', app.placement_client_name(pl),
                                              'live', app.placement_is_live(pl)) order by pl.start_date desc)
          from public.placement pl
          where pl.operator_id = o.id and pl.status <> 'draft' and app.staff_can_reach_placement(pl.id)), '[]'::jsonb),
        'open_escalations', (select count(*) from public.escalation e
                             where e.operator_id = o.id and e.status = 'open' and app.staff_can_reach_placement(e.placement_id)),
        'overdue_escalations', (select count(*) from public.escalation e
                                where e.operator_id = o.id and e.status = 'open' and e.response_due_at < now()
                                  and app.staff_can_reach_placement(e.placement_id)),
        'pending_bookings', (select count(*) from public.booking b
                             where b.operator_id = o.id and b.state = 'pending_review' and app.staff_can_reach_placement(b.placement_id)),
        'flagged_shifts', (select count(*) from public.shift_attendance sa
                           where sa.operator_id = o.id and sa.status = 'suspected_missed' and sa.decided_at is null
                             and not exists (select 1 from public.eod_report r where r.placement_id = sa.placement_id
                                             and r.shift_date = sa.shift_date and r.superseded_by_id is null)
                             and app.staff_can_reach_placement(sa.placement_id))
      ) as r
      from public.operator o
      where app.staff_can_reach_operator(o.id)
    ) x
  ), '[]'::jsonb);
end;
$$;

-- The admin panel ----------------------------------------------------------------

create or replace function public.staff_panel(p_operator_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_op public.operator;
  v_admin boolean := app.actor_role() in ('owner', 'admin');
  v_pay boolean := app.actor_allowed('payroll.view');
  v_notes boolean := app.actor_allowed('operators.notes');
  v_ld boolean := v_admin and app.actor_allowed('approvals.financial');
  v_today date := (now() at time zone 'UTC')::date;
  v_month date := date_trunc('month', now() at time zone 'UTC')::date;
  v_attendance jsonb;
begin
  perform app.require_reach_operator(p_operator_id);
  select * into v_op from public.operator where id = p_operator_id;

  -- Shifts over the last 45 days and the next 14, for the placements in reach.
  select coalesce(jsonb_agg(jsonb_build_object(
           'placement_id', pl.id,
           'client_name', app.placement_client_name(pl),
           'shift_date', a.shift_date,
           'starts_at', a.starts_at,
           'ends_at', a.ends_at,
           'status', a.status,
           'late_notice', a.late_notice,
           'reason', a.reason,
           'decided_by', a.decided_by_name,
           'decided_at', a.decided_at
         ) order by a.shift_date desc), '[]'::jsonb)
    into v_attendance
  from public.placement pl
  cross join lateral app.placement_attendance(pl.id, v_today - 45, v_today + 14) a
  where pl.operator_id = v_op.id and pl.status <> 'draft' and app.staff_can_reach_placement(pl.id);

  return jsonb_build_object(
    'operator', jsonb_build_object(
      'id', v_op.id, 'profile_id', v_op.profile_id, 'name', v_op.name, 'email', v_op.email,
      'status', v_op.status, 'tier', v_op.tier, 'certified_on', v_op.certified_on, 'joined_on', v_op.joined_on,
      'time_zone', app.safe_tz(v_op.time_zone), 'account_state',
      case when v_op.profile_id is not null then app.effective_state(v_op.profile_id) end
    ),
    'viewer', jsonb_build_object(
      'role', app.actor_role(),
      'is_admin', v_admin,
      'can_review_bookings', app.actor_allowed('bookings.approve'),
      'can_answer_escalations', app.actor_allowed('escalations.answer'),
      'can_manage_attendance', app.actor_allowed('attendance.manage'),
      'can_assign', app.actor_allowed('tasks.assign'),
      'can_message', app.actor_allowed('accounts.message'),
      'can_notes', v_notes,
      'can_decide_ld', v_ld,
      'can_edit_playbooks', app.actor_allowed('playbooks.edit'),
      'can_see_pay', v_pay
    ),
    'placements', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', pl.id,
               'case_file_id', pl.case_file_id,
               'client_name', app.placement_client_name(pl),
               'status', pl.status,
               'live', app.placement_is_live(pl),
               'start_date', pl.start_date,
               'end_date', coalesce(pl.closed_on, pl.end_date),
               'shift_start', pl.shift_start,
               'shift_end', pl.shift_end,
               'time_zone', app.safe_tz(pl.time_zone),
               'working_days', to_jsonb(pl.working_days),
               'monthly_booking_quota', pl.monthly_booking_quota,
               'commission_per_booking', pl.commission_per_booking,
               'client_rate_per_booking', case when v_admin then pl.client_rate_per_booking end,
               'response_standard_minutes', pl.response_standard_minutes,
               'escalation_response_hours', pl.escalation_response_hours,
               'has_client_playbook', exists (select 1 from public.playbook pb
                                              where pb.case_file_id = pl.case_file_id and pb.placement_id is null),
               'has_override', exists (select 1 from public.playbook pb where pb.placement_id = pl.id)
             ) order by app.placement_is_live(pl) desc, pl.start_date desc)
      from public.placement pl
      where pl.operator_id = v_op.id and pl.status <> 'draft' and app.staff_can_reach_placement(pl.id)
    ), '[]'::jsonb),
    'attendance', jsonb_build_object(
      'shifts', v_attendance,
      'this_month', (
        select jsonb_build_object(
          'worked', count(*) filter (where x ->> 'status' = 'worked'),
          'report_missing', count(*) filter (where x ->> 'status' = 'worked_report_missing'),
          'suspected_missed', count(*) filter (where x ->> 'status' = 'suspected_missed'),
          'notified_absence', count(*) filter (where x ->> 'status' = 'notified_absence'),
          'excused', count(*) filter (where x ->> 'status' = 'excused_emergency'),
          'abandoned', count(*) filter (where x ->> 'status' = 'abandoned'))
        from jsonb_array_elements(v_attendance) x
        where (x ->> 'shift_date')::date >= v_month and (x ->> 'shift_date')::date <= v_today
      ),
      'abandonments_30_days', (select count(*) from public.shift_attendance sa
                               where sa.operator_id = v_op.id and sa.status = 'abandoned'
                                 and sa.shift_date > v_today - 30),
      'ghosting_alert_at', (select max(sa.ghosting_alerted_at) from public.shift_attendance sa
                            where sa.operator_id = v_op.id and sa.ghosting_alerted_at > now() - interval '14 days')
    ),
    'escalations', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', e.id, 'placement_id', e.placement_id, 'category', e.category,
               'customer_context', e.customer_context, 'needed', e.needed, 'status', e.status,
               'raised_at', e.raised_at, 'response_due_at', e.response_due_at,
               'overdue', e.status = 'open' and e.response_due_at < now(),
               'answer', e.answer, 'answered_by', app.profile_name(e.answered_by), 'answered_at', e.answered_at
             ) order by (e.status = 'open') desc, e.raised_at desc)
      from public.escalation e
      where e.operator_id = v_op.id and e.status in ('open', 'answered') and app.staff_can_reach_placement(e.placement_id)
    ), '[]'::jsonb),
    'pending_bookings', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', b.id, 'placement_id', b.placement_id, 'customer', b.customer_name,
               'customer_phone', b.customer_phone, 'customer_email', b.customer_email,
               'scheduled_for', b.scheduled_for, 'recorded_at', b.recorded_at,
               'operator_note', b.operator_note, 'live_transfer', b.live_transfer
             ) order by b.recorded_at)
      from public.booking b
      where b.operator_id = v_op.id and b.state = 'pending_review' and app.staff_can_reach_placement(b.placement_id)
    ), '[]'::jsonb),
    'reports', coalesce((
      select jsonb_agg(x.r order by x.shift_date desc)
      from (
        select r.shift_date, jsonb_build_object(
                 'id', r.id, 'placement_id', r.placement_id, 'shift_date', r.shift_date, 'version', r.version,
                 'shift_start_actual', r.shift_start_actual, 'shift_end_actual', r.shift_end_actual,
                 'conversations_handled', r.conversations_handled, 'appointments_booked', r.appointments_booked,
                 'follow_ups_completed', r.follow_ups_completed, 'escalations_raised', r.escalations_raised,
                 'blockers', r.blockers, 'notes', r.notes, 'system_counts', r.system_counts,
                 'variance_explanation', r.variance_explanation, 'correction_reason', r.correction_reason,
                 'period_closed', app.pay_period_closed_for(r.shift_date)) as r
        from public.eod_report r
        where r.operator_id = v_op.id and r.superseded_by_id is null and app.staff_can_reach_placement(r.placement_id)
        order by r.shift_date desc
        limit 20
      ) x
    ), '[]'::jsonb),
    'onboarding', (
      select jsonb_build_object('status', s.status, 'protocol_name', coalesce(p.name, s.protocol_key),
                                'completed_at', s.completed_at)
      from public.da_onboarding_submission s
      join public.da_recipient d on d.id = s.recipient_id
      left join public.da_onboarding_protocol p on p.key = s.protocol_key
      where d.operator_id = v_op.id
      order by (s.status = 'pending') desc, s.created_at desc
      limit 1
    ),
    'training', coalesce((
      select jsonb_agg(jsonb_build_object('id', tr.id, 'title', tr.title, 'completed_on', tr.completed_on)
                       order by tr.created_at)
      from public.operator_training tr where tr.operator_id = v_op.id
    ), '[]'::jsonb),
    'tasks', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'due_on', t.due_on,
                                          'overdue', t.due_on < v_today)
                       order by t.due_on nulls last)
      from public.operator_task t where t.operator_id = v_op.id and t.completed_on is null
    ), '[]'::jsonb),
    'pay', case when v_pay then jsonb_build_object(
      'statements', coalesce((
        select jsonb_agg(x.s order by x.start_date desc nulls last)
        from (
          select pp.start_date, jsonb_build_object(
                   'id', s.id, 'period_id', s.period_id, 'period_start', pp.start_date, 'period_end', pp.end_date,
                   'base_amount', s.base_amount, 'commission_amount', s.commission_amount,
                   'speed_bonus_amount', s.speed_bonus_amount, 'adjustment_total', s.adjustment_total,
                   'total', s.total, 'locked', s.locked) as s
          from public.pay_statement s
          left join public.pay_period pp on pp.id = s.period_id
          where s.operator_id = v_op.id
          order by pp.start_date desc nulls last
          limit 6
        ) x
      ), '[]'::jsonb),
      'questions', coalesce((
        select jsonb_agg(jsonb_build_object('id', q.id, 'statement_id', q.statement_id, 'body', q.body,
                                            'asked_at', q.asked_at, 'answer', q.answer, 'answered_at', q.answered_at)
                         order by (q.answered_at is null) desc, q.asked_at desc)
        from public.pay_question q where q.operator_id = v_op.id
      ), '[]'::jsonb),
      'payout_method', v_op.payout_method,
      'payout_last4', case when v_op.payout_reference is not null then right(btrim(v_op.payout_reference), 4) end,
      'tax_doc_status', v_op.tax_doc_status
    ) end,
    'ld_proposals', case when v_ld then coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', l.id, 'placement_id', l.placement_id, 'shift_date', l.shift_date, 'amount', l.amount,
               'status', l.status, 'decided_by', app.profile_name(l.decided_by), 'decided_at', l.decided_at,
               'decision_reason', l.decision_reason, 'applied_amount', l.applied_amount, 'created_at', l.created_at
             ) order by (l.status = 'proposed') desc, l.created_at desc)
      from public.ld_proposal l where l.operator_id = v_op.id
    ), '[]'::jsonb) end,
    'notes', case when v_notes then coalesce((
      select jsonb_agg(jsonb_build_object('id', n.id, 'body', n.body, 'author', n.author_name,
                                          'created_at', n.created_at, 'during_view_as', n.impersonation_id is not null)
                       order by n.created_at desc)
      from public.operator_note n where n.operator_id = v_op.id
    ), '[]'::jsonb) end
  );
end;
$$;

-- Admin-panel actions, in the staff member's own name ------------------------------

create or replace function public.staff_review_booking(p_booking_id uuid, p_decision text, p_reason text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_b public.booking;
begin
  perform app.require_own_name('bookings.approve');
  select * into v_b from public.booking where id = p_booking_id;
  if v_b.id is null then
    raise exception 'booking_not_found' using errcode = 'P0002';
  end if;
  perform app.require_reach_placement(v_b.placement_id);
  if v_b.state <> 'pending_review' then
    raise exception 'already_reviewed: that booking is no longer waiting for review' using errcode = '23514';
  end if;
  if coalesce(p_decision, '') not in ('approve', 'reject') then
    raise exception 'decision_required' using errcode = '23514';
  end if;
  if p_decision = 'reject' and length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'reason_required: a rejection needs a reason; it goes on the operator record' using errcode = '23514';
  end if;

  -- The same change the admin booking queue makes (reviewClaimAction).
  update public.booking
     set state = case when p_decision = 'approve' then 'confirmed'::public.booking_state else 'rejected'::public.booking_state end,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         rejection_reason = case when p_decision = 'reject' then btrim(p_reason) end
   where id = v_b.id
  returning * into v_b;

  perform app.audit('booking.reviewed', 'booking', v_b.id::text,
    format('%s the booking for %s', case when p_decision = 'approve' then 'Approved' else 'Rejected' end, v_b.customer_name),
    null, jsonb_build_object('state', v_b.state, 'rejection_reason', v_b.rejection_reason), v_b.case_file_id);

  return jsonb_build_object('ok', true, 'state', v_b.state, 'reviewed_by', app.profile_name(auth.uid()));
end;
$$;

create or replace function public.staff_answer_escalation(p_escalation_id uuid, p_answer text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_e public.escalation;
begin
  perform app.require_own_name('escalations.answer');
  select * into v_e from public.escalation where id = p_escalation_id;
  if v_e.id is null then
    raise exception 'escalation_not_found' using errcode = 'P0002';
  end if;
  perform app.require_reach_placement(v_e.placement_id);
  if v_e.status <> 'open' then
    raise exception 'already_answered: that escalation is not open' using errcode = '23514';
  end if;
  if length(btrim(coalesce(p_answer, ''))) not between 2 and 4000 then
    raise exception 'answer_required: write the answer the operator will act on' using errcode = '23514';
  end if;

  update public.escalation
     set status = 'answered', answer = btrim(p_answer), answered_by = auth.uid(), answered_at = now(), answer_read_at = null
   where id = v_e.id
  returning * into v_e;

  insert into public.operator_notification (operator_id, placement_id, severity, title, body, sent_by)
  values (v_e.operator_id, v_e.placement_id, 'important', 'Your escalation has an answer',
          'Open Escalations to read it and act on it.', app.profile_name(auth.uid()));

  perform app.audit('escalation.answered', 'escalation', v_e.id::text, 'Answered the escalation',
    null, jsonb_build_object('answer', v_e.answer), v_e.case_file_id);

  return jsonb_build_object('ok', true);
end;
$$;

-- Attendance: confirm, excuse or correct one shift. A confirmed abandonment
-- proposes $250; nothing reaches pay until an admin approves it.
create or replace function public.staff_set_attendance(
  p_placement_id uuid,
  p_shift_date date,
  p_status text,
  p_reason text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_pl public.placement;
  v_op public.operator;
  v_starts timestamptz;
  v_ends timestamptz;
  v_before public.shift_attendance;
  v_row public.shift_attendance;
  v_ld public.ld_proposal;
  v_abandoned_30 integer;
begin
  perform app.require_own_name('attendance.manage');
  select * into v_pl from public.placement where id = p_placement_id;
  if v_pl.id is null then
    raise exception 'placement_not_found' using errcode = 'P0002';
  end if;
  perform app.require_reach_placement(v_pl.id);
  select * into v_op from public.operator where id = v_pl.operator_id;

  if coalesce(p_status, '') not in ('worked', 'excused_emergency', 'abandoned', 'notified_absence') then
    raise exception 'status_invalid: pick worked, excused, abandoned or notified absence' using errcode = '23514';
  end if;
  if length(btrim(coalesce(p_reason, ''))) not between 5 and 2000 then
    raise exception 'reason_required: every attendance decision records why' using errcode = '23514';
  end if;
  if p_shift_date is null or p_shift_date < v_pl.start_date
     or not (extract(isodow from p_shift_date)::smallint = any(v_pl.working_days)) then
    raise exception 'not_a_shift: that date is not a scheduled shift on this placement' using errcode = '23514';
  end if;

  select sb.starts_at, sb.ends_at into v_starts, v_ends from app.shift_bounds(v_pl, p_shift_date) sb;
  if p_status in ('abandoned', 'worked') and (v_ends is null or v_ends > now()) then
    raise exception 'shift_not_over: that shift has not ended yet' using errcode = '23514';
  end if;

  select * into v_before from public.shift_attendance where placement_id = v_pl.id and shift_date = p_shift_date;

  if v_before.status = 'abandoned' and p_status <> 'abandoned'
     and exists (select 1 from public.ld_proposal l where l.attendance_id = v_before.id and l.status = 'approved') then
    raise exception 'ld_applied: the $250 for this abandonment is already on a pay statement. Reverse that adjustment in Payroll first.'
      using errcode = '23514';
  end if;

  insert into public.shift_attendance (placement_id, operator_id, shift_date, status, reason, decided_by, decided_at)
  values (v_pl.id, v_pl.operator_id, p_shift_date, p_status, btrim(p_reason), auth.uid(), now())
  on conflict (placement_id, shift_date) do update
    set status = excluded.status, reason = excluded.reason, decided_by = excluded.decided_by, decided_at = excluded.decided_at
  returning * into v_row;

  if p_status = 'abandoned' then
    insert into public.ld_proposal (attendance_id, operator_id, placement_id, shift_date)
    values (v_row.id, v_row.operator_id, v_row.placement_id, v_row.shift_date)
    on conflict (attendance_id) do update
      set status = 'proposed', decided_by = null, decided_at = null, decision_reason = null,
          statement_id = null, applied_amount = null
      where public.ld_proposal.status = 'dismissed'
    returning * into v_ld;

    perform app.notify_staff(app.admin_recipient_ids(), 'ld.proposed', 'important',
      format('Proposed $250 liquidated damages for %s', v_op.name),
      format('Abandoned shift on %s (Section 6.3). Approve or dismiss it; it can only come from unearned bonus or commission.',
             to_char(p_shift_date, 'FMDy DD Mon')),
      v_op.id);

    select count(*) into v_abandoned_30 from public.shift_attendance sa
    where sa.operator_id = v_op.id and sa.status = 'abandoned'
      and sa.shift_date between p_shift_date - 29 and p_shift_date + 29;
    if v_abandoned_30 >= 2 then
      perform app.notify_staff(app.admin_recipient_ids(), 'attendance.two_abandonments', 'urgent',
        format('%s: two abandoned shifts within 30 days', v_op.name),
        'Section 6.4 applies. Review the attendance record and decide what happens next; nothing changes automatically.',
        v_op.id);
    end if;

    insert into public.operator_notification (operator_id, placement_id, severity, title, body, sent_by)
    values (v_op.id, v_pl.id, 'urgent', 'A shift was recorded as abandoned',
            format('%s: %s', to_char(p_shift_date, 'FMDy DD Mon'), btrim(p_reason)), app.profile_name(auth.uid()));
  else
    update public.ld_proposal
       set status = 'dismissed', decided_by = auth.uid(), decided_at = now(),
           decision_reason = 'Attendance corrected: ' || btrim(p_reason)
     where attendance_id = v_row.id and status = 'proposed';

    if p_status = 'excused_emergency' then
      insert into public.operator_notification (operator_id, placement_id, severity, title, body, sent_by)
      values (v_op.id, v_pl.id, 'informational', 'Shift excused',
              format('%s was excused: %s', to_char(p_shift_date, 'FMDy DD Mon'), btrim(p_reason)), app.profile_name(auth.uid()));
    end if;
  end if;

  perform app.audit('attendance.decided', 'shift_attendance', v_row.id::text,
    format('Recorded the %s shift as %s: %s', p_shift_date, replace(p_status, '_', ' '), btrim(p_reason)),
    case when v_before.id is not null then jsonb_build_object('status', v_before.status, 'reason', v_before.reason) end,
    jsonb_build_object('status', v_row.status, 'reason', v_row.reason), v_pl.case_file_id, v_op.profile_id);

  return jsonb_build_object('ok', true, 'status', v_row.status, 'ld_proposal_id', v_ld.id);
end;
$$;

create or replace function public.staff_assign_task(
  p_operator_id uuid,
  p_title text,
  p_detail text default null,
  p_due_on date default null,
  p_placement_id uuid default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.operator_task;
begin
  perform app.require_own_name('tasks.assign');
  perform app.require_reach_operator(p_operator_id);
  if p_placement_id is not null then
    if not exists (select 1 from public.placement where id = p_placement_id and operator_id = p_operator_id) then
      raise exception 'placement_not_found: that placement is not this operator''s' using errcode = '23514';
    end if;
    perform app.require_reach_placement(p_placement_id);
  end if;
  if length(btrim(coalesce(p_title, ''))) not between 3 and 200 then
    raise exception 'title_required: say what needs doing' using errcode = '23514';
  end if;

  insert into public.operator_task (operator_id, placement_id, title, detail, due_on, assigned_by)
  values (p_operator_id, p_placement_id, btrim(p_title), nullif(btrim(coalesce(p_detail, '')), ''), p_due_on, auth.uid())
  returning * into v_row;

  insert into public.operator_notification (operator_id, placement_id, severity, title, body, sent_by)
  values (p_operator_id, p_placement_id, 'informational', 'New task: ' || v_row.title,
          case when v_row.due_on is not null then format('Due %s.', to_char(v_row.due_on, 'FMDy DD Mon')) else 'No due date.' end,
          app.profile_name(auth.uid()));

  perform app.audit('task.assigned', 'operator_task', v_row.id::text, format('Assigned the task %s', v_row.title),
    null, null, null, (select profile_id from public.operator where id = p_operator_id));
  return jsonb_build_object('ok', true, 'id', v_row.id);
end;
$$;

create or replace function public.staff_assign_training(
  p_operator_id uuid,
  p_title text,
  p_detail text default null,
  p_asset_id uuid default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.operator_training;
begin
  perform app.require_own_name('tasks.assign');
  perform app.require_reach_operator(p_operator_id);
  if length(btrim(coalesce(p_title, ''))) not between 3 and 200 then
    raise exception 'title_required: name the training item' using errcode = '23514';
  end if;
  if p_asset_id is not null and not exists (select 1 from public.internal_asset where id = p_asset_id and archived_at is null) then
    raise exception 'asset_not_found: that library item is missing or archived' using errcode = '23514';
  end if;

  insert into public.operator_training (operator_id, title, detail, asset_id)
  values (p_operator_id, btrim(p_title), nullif(btrim(coalesce(p_detail, '')), ''), p_asset_id)
  returning * into v_row;

  insert into public.operator_notification (operator_id, severity, title, body, sent_by)
  values (p_operator_id, 'informational', 'New training: ' || v_row.title, 'Find it under Tasks & Training.',
          app.profile_name(auth.uid()));

  perform app.audit('training.assigned', 'operator_training', v_row.id::text,
    format('Assigned the training item %s', v_row.title), null, null, null,
    (select profile_id from public.operator where id = p_operator_id));
  return jsonb_build_object('ok', true, 'id', v_row.id);
end;
$$;

create or replace function public.staff_send_notification(
  p_operator_id uuid,
  p_title text,
  p_body text,
  p_severity text default 'informational',
  p_blocking boolean default false
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_op public.operator;
  v_id uuid;
begin
  perform app.require_own_name('accounts.message');
  perform app.require_reach_operator(p_operator_id);
  select * into v_op from public.operator where id = p_operator_id;
  if coalesce(p_severity, '') not in ('informational', 'important', 'urgent') then
    raise exception 'severity_invalid' using errcode = '23514';
  end if;
  if length(btrim(coalesce(p_title, ''))) not between 2 and 200 or length(btrim(coalesce(p_body, ''))) not between 2 and 4000 then
    raise exception 'message_required: add a title and a message' using errcode = '23514';
  end if;

  if coalesce(p_blocking, false) then
    if v_op.profile_id is null then
      raise exception 'no_account: this operator has no sign-in, so a blocking notice cannot be shown' using errcode = '23514';
    end if;
    insert into public.account_notice (profile_id, body, severity, blocking, created_by)
    values (v_op.profile_id, btrim(p_title) || E'\n\n' || btrim(p_body), p_severity::public.notification_severity, true, auth.uid())
    returning id into v_id;
    perform app.audit('account.notice_set', 'account_notice', v_id::text,
      'Set a notice the account must confirm before continuing to work', null,
      jsonb_build_object('blocking', true, 'severity', p_severity), null, v_op.profile_id);
  else
    insert into public.operator_notification (operator_id, severity, title, body, sent_by)
    values (v_op.id, p_severity::public.notification_severity, btrim(p_title), btrim(p_body), app.profile_name(auth.uid()))
    returning id into v_id;
    perform app.audit('operator.notified', 'operator_notification', v_id::text,
      format('Sent the notification %s', btrim(p_title)), null, null, null, v_op.profile_id);
  end if;

  return jsonb_build_object('ok', true, 'id', v_id, 'blocking', coalesce(p_blocking, false));
end;
$$;

create or replace function public.staff_add_note(p_operator_id uuid, p_body text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.operator_note;
begin
  perform app.require_own_name('operators.notes');
  perform app.require_reach_operator(p_operator_id);
  if length(btrim(coalesce(p_body, ''))) not between 2 and 5000 then
    raise exception 'note_required' using errcode = '23514';
  end if;

  insert into public.operator_note (operator_id, body, author_profile_id, author_name, impersonation_id)
  values (p_operator_id, btrim(p_body), auth.uid(), app.profile_name(auth.uid()), (app.live_impersonation()).id)
  returning * into v_row;

  perform app.audit('operator.note_added', 'operator_note', v_row.id::text, 'Added an internal note',
    null, null, null, (select profile_id from public.operator where id = p_operator_id));
  return jsonb_build_object('ok', true, 'id', v_row.id);
end;
$$;

-- Liquidated damages. Approval applies the proposal to the open statement for
-- that shift, capped at the statement's commission and speed bonus (less any
-- earlier deduction), so earned base pay is never touched.
create or replace function public.staff_decide_ld(p_proposal_id uuid, p_approve boolean, p_reason text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_ld public.ld_proposal;
  v_s public.pay_statement;
  v_prior numeric;
  v_available numeric;
  v_applied numeric;
  v_adjustments numeric;
begin
  perform app.require_own_name('approvals.financial');
  if app.actor_role() not in ('owner', 'admin') then
    raise exception 'permission_denied: only owners and admins decide liquidated damages' using errcode = '42501';
  end if;
  select * into v_ld from public.ld_proposal where id = p_proposal_id;
  if v_ld.id is null then
    raise exception 'proposal_not_found' using errcode = 'P0002';
  end if;
  if v_ld.status <> 'proposed' then
    raise exception 'already_decided: that proposal was already %', v_ld.status using errcode = '23514';
  end if;
  if length(btrim(coalesce(p_reason, ''))) not between 5 and 2000 then
    raise exception 'reason_required: record why' using errcode = '23514';
  end if;

  if not coalesce(p_approve, false) then
    update public.ld_proposal
       set status = 'dismissed', decided_by = auth.uid(), decided_at = now(), decision_reason = btrim(p_reason)
     where id = v_ld.id;
    perform app.audit('ld.dismissed', 'ld_proposal', v_ld.id::text,
      format('Dismissed the $%s liquidated damages proposal for %s: %s', v_ld.amount, v_ld.shift_date, btrim(p_reason)),
      null, null, null, (select profile_id from public.operator where id = v_ld.operator_id));
    return jsonb_build_object('ok', true, 'status', 'dismissed');
  end if;

  -- The open statement for the period holding that shift, else the latest open one.
  select s.* into v_s
  from public.pay_statement s
  left join public.pay_period pp on pp.id = s.period_id
  where s.operator_id = v_ld.operator_id and s.placement_id = v_ld.placement_id and not s.locked
  order by (pp.start_date <= v_ld.shift_date and pp.end_date >= v_ld.shift_date) desc nulls last,
           pp.start_date desc nulls last
  limit 1;

  if v_s.id is null then
    raise exception 'no_open_statement: there is no open pay statement to apply this to yet. Approve it once payroll has built the statement.'
      using errcode = '23514';
  end if;

  select coalesce(sum(l.applied_amount), 0) into v_prior
  from public.ld_proposal l where l.statement_id = v_s.id and l.status = 'approved';

  v_available := greatest(0, coalesce(v_s.commission_amount, 0) + coalesce(v_s.speed_bonus_amount, 0) - v_prior);
  v_applied := least(v_ld.amount, v_available);

  if v_applied > 0 then
    insert into public.pay_adjustment (statement_id, label, reason, amount, added_by)
    values (v_s.id, 'Liquidated damages (Section 6.3)',
            format('Abandoned shift on %s. %s%s', to_char(v_ld.shift_date, 'FMDD Mon YYYY'), btrim(p_reason),
                   case when v_applied < v_ld.amount
                        then format(' Capped at $%s: only unearned commission and bonus can be deducted, never earned base pay.', v_applied)
                        else '' end),
            -v_applied, auth.uid());

    -- The same recalculation the payroll screen does when an adjustment is added.
    select coalesce(sum(a.amount), 0) into v_adjustments from public.pay_adjustment a where a.statement_id = v_s.id;
    update public.pay_statement
       set adjustment_total = v_adjustments,
           total = base_amount + commission_amount + speed_bonus_amount + v_adjustments
     where id = v_s.id;
  end if;

  update public.ld_proposal
     set status = 'approved', decided_by = auth.uid(), decided_at = now(), decision_reason = btrim(p_reason),
         statement_id = v_s.id, applied_amount = v_applied
   where id = v_ld.id;

  insert into public.operator_notification (operator_id, placement_id, severity, title, body, sent_by)
  values (v_ld.operator_id, v_ld.placement_id, 'important', 'Liquidated damages applied',
          format('$%s for the abandoned shift on %s was applied to your open statement under Section 6.3.',
                 v_applied, to_char(v_ld.shift_date, 'FMDy DD Mon')),
          app.profile_name(auth.uid()));

  perform app.audit('ld.approved', 'ld_proposal', v_ld.id::text,
    format('Approved liquidated damages for %s: $%s applied of $%s', v_ld.shift_date, v_applied, v_ld.amount),
    null, jsonb_build_object('statement_id', v_s.id, 'applied_amount', v_applied), null,
    (select profile_id from public.operator where id = v_ld.operator_id));

  return jsonb_build_object('ok', true, 'status', 'approved', 'applied_amount', v_applied, 'statement_id', v_s.id);
end;
$$;

create or replace function public.staff_answer_pay_question(p_question_id uuid, p_answer text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_q public.pay_question;
begin
  perform app.require_own_name('payroll.view');
  select * into v_q from public.pay_question where id = p_question_id;
  if v_q.id is null then
    raise exception 'question_not_found' using errcode = 'P0002';
  end if;
  perform app.require_reach_operator(v_q.operator_id);
  if length(btrim(coalesce(p_answer, ''))) not between 2 and 4000 then
    raise exception 'answer_required' using errcode = '23514';
  end if;

  update public.pay_question
     set answer = btrim(p_answer), answered_by = auth.uid(), answered_at = now(), answer_read_at = null
   where id = v_q.id;

  insert into public.operator_notification (operator_id, severity, title, body, sent_by)
  values (v_q.operator_id, 'important', 'Your pay question has an answer', 'Open Pay to read it.',
          app.profile_name(auth.uid()));

  perform app.audit('pay.question_answered', 'pay_question', v_q.id::text, 'Answered a pay question',
    null, null, null, (select profile_id from public.operator where id = v_q.operator_id));
  return jsonb_build_object('ok', true);
end;
$$;

-- A booking a VA can no longer log (before the current pay period), added by a
-- manager or admin with a reason. It still goes through review.
create or replace function public.staff_log_booking(
  p_placement_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_scheduled_for timestamptz,
  p_reason text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_pl public.placement;
  v_claim public.booking;
begin
  perform app.require_own_name('bookings.approve');
  select * into v_pl from public.placement where id = p_placement_id;
  if v_pl.id is null then
    raise exception 'placement_not_found' using errcode = 'P0002';
  end if;
  perform app.require_reach_placement(v_pl.id);
  if btrim(coalesce(p_customer_name, '')) = '' or p_scheduled_for is null then
    raise exception 'details_required: add the customer and the appointment time' using errcode = '23514';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'reason_required: say why this is being added by staff' using errcode = '23514';
  end if;

  v_claim := app.insert_booking_claim(v_pl, p_customer_name, p_scheduled_for, p_customer_phone, p_customer_email,
    format('Added by %s: %s', app.profile_name(auth.uid()), btrim(p_reason)), false);
  return jsonb_build_object('ok', true, 'id', v_claim.id, 'state', v_claim.state);
end;
$$;

-- A correction to a shift report made by staff: the only way once the pay
-- period is closed. The original stays on record, superseded.
create or replace function public.staff_correct_report(
  p_report_id uuid,
  p_shift_start_actual text,
  p_shift_end_actual text,
  p_conversations_handled integer,
  p_appointments_booked integer,
  p_follow_ups_completed integer,
  p_escalations_raised integer,
  p_reason text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_orig public.eod_report;
  v_row public.eod_report;
begin
  perform app.require_own_name('attendance.manage');
  select * into v_orig from public.eod_report where id = p_report_id;
  if v_orig.id is null then
    raise exception 'report_not_found' using errcode = 'P0002';
  end if;
  perform app.require_reach_placement(v_orig.placement_id);
  if v_orig.superseded_by_id is not null then
    raise exception 'already_corrected: correct the current version instead' using errcode = '23514';
  end if;
  if length(btrim(coalesce(p_reason, ''))) not between 5 and 2000 then
    raise exception 'reason_required' using errcode = '23514';
  end if;
  perform app.check_report_values(p_conversations_handled, p_appointments_booked, p_follow_ups_completed,
                                  p_escalations_raised, p_shift_start_actual, p_shift_end_actual, null);

  insert into public.eod_report (
    placement_id, operator_id, shift_date, shift_start_actual, shift_end_actual,
    conversations_handled, appointments_booked, follow_ups_completed, escalations_raised,
    blockers, notes, configured, version, supersedes_id, correction_reason, system_counts, variance_explanation
  ) values (
    v_orig.placement_id, v_orig.operator_id, v_orig.shift_date, p_shift_start_actual, p_shift_end_actual,
    p_conversations_handled, p_appointments_booked, p_follow_ups_completed, p_escalations_raised,
    v_orig.blockers, v_orig.notes, v_orig.configured, v_orig.version + 1, v_orig.id,
    format('Corrected by %s: %s', app.profile_name(auth.uid()), btrim(p_reason)),
    v_orig.system_counts, v_orig.variance_explanation
  ) returning * into v_row;

  update public.eod_report set superseded_by_id = v_row.id where id = v_orig.id;

  perform app.audit('eod.corrected', 'eod_report', v_row.id::text,
    format('Corrected the shift report for %s (version %s) as staff: %s', v_orig.shift_date, v_row.version, btrim(p_reason)),
    null, null, (select pl.case_file_id from public.placement pl where pl.id = v_orig.placement_id),
    (select profile_id from public.operator where id = v_orig.operator_id));
  return jsonb_build_object('ok', true, 'id', v_row.id, 'version', v_row.version);
end;
$$;

-- Playbooks ----------------------------------------------------------------------

create or replace function public.staff_playbook(p_placement_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pl public.placement;
  v_base public.playbook;
  v_over public.playbook;
begin
  select * into v_pl from public.placement where id = p_placement_id;
  if v_pl.id is null then
    raise exception 'placement_not_found' using errcode = 'P0002';
  end if;
  perform app.require_reach_placement(v_pl.id);
  select * into v_base from public.playbook where case_file_id = v_pl.case_file_id and placement_id is null;
  select * into v_over from public.playbook where placement_id = v_pl.id;

  return jsonb_build_object(
    'placement_id', v_pl.id,
    'case_file_id', v_pl.case_file_id,
    'client_name', app.placement_client_name(v_pl),
    'operator_name', (select o.name from public.operator o where o.id = v_pl.operator_id),
    'can_edit_client', app.actor_role() in ('owner', 'admin') or app.scope_includes_case_file(auth.uid(), v_pl.case_file_id),
    'client', case when v_base.id is not null then to_jsonb(v_base) || jsonb_build_object(
      'assets', coalesce((select jsonb_agg(jsonb_build_object('asset_id', pa.asset_id, 'label', pa.label) order by pa.sort_order)
                          from public.playbook_asset pa where pa.playbook_id = v_base.id), '[]'::jsonb),
      'updated_by_name', app.profile_name(v_base.updated_by)) end,
    'override', case when v_over.id is not null then to_jsonb(v_over) || jsonb_build_object(
      'assets', coalesce((select jsonb_agg(jsonb_build_object('asset_id', pa.asset_id, 'label', pa.label) order by pa.sort_order)
                          from public.playbook_asset pa where pa.playbook_id = v_over.id), '[]'::jsonb),
      'updated_by_name', app.profile_name(v_over.updated_by)) end,
    'versions', coalesce((
      select jsonb_agg(jsonb_build_object('id', v.id, 'scope', case when pb.placement_id is null then 'client' else 'placement' end,
                                          'version', v.version, 'saved_at', v.saved_at, 'saved_by', app.profile_name(v.saved_by),
                                          'change_note', v.change_note, 'major', v.major, 'snapshot', v.snapshot)
                       order by v.saved_at desc)
      from public.playbook_version v join public.playbook pb on pb.id = v.playbook_id
      where v.playbook_id in (v_base.id, v_over.id)
    ), '[]'::jsonb),
    'library', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title, 'audience', a.audience) order by a.title)
      from public.internal_asset a where a.archived_at is null
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.staff_save_playbook(
  p_placement_id uuid,
  p_scope text,
  p_fields jsonb,
  p_asset_ids uuid[],
  p_change_note text,
  p_major boolean default false
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_pl public.placement;
  v_row public.playbook;
  v_holding text[];
  v_client text;
  v_op record;
begin
  perform app.require_own_name('playbooks.edit');
  select * into v_pl from public.placement where id = p_placement_id;
  if v_pl.id is null then
    raise exception 'placement_not_found' using errcode = 'P0002';
  end if;
  if coalesce(p_scope, '') not in ('client', 'placement') then
    raise exception 'scope_invalid' using errcode = '23514';
  end if;
  if p_scope = 'client' then
    if not (app.actor_role() in ('owner', 'admin') or app.scope_includes_case_file(auth.uid(), v_pl.case_file_id)) then
      raise exception 'out_of_scope: that client is not in your scope' using errcode = '42501';
    end if;
  else
    perform app.require_reach_placement(v_pl.id);
  end if;
  if jsonb_typeof(coalesce(p_fields, '{}'::jsonb)) <> 'object' then
    raise exception 'fields_invalid' using errcode = '23514';
  end if;
  if nullif(p_fields ->> 'handoff_method', '') is not null and p_fields ->> 'handoff_method' not in ('calendar', 'live_transfer') then
    raise exception 'handoff_invalid: calendar or live transfer' using errcode = '23514';
  end if;
  if length(btrim(coalesce(p_change_note, ''))) not between 3 and 1000 then
    raise exception 'note_required: say what changed, so the history means something' using errcode = '23514';
  end if;
  if p_asset_ids is not null and exists (
    select 1 from unnest(p_asset_ids) x(id)
    where not exists (select 1 from public.internal_asset a where a.id = x.id and a.archived_at is null)) then
    raise exception 'asset_not_found: a linked library item is missing or archived' using errcode = '23514';
  end if;

  select coalesce(array_agg(btrim(x)) filter (where btrim(x) <> ''), '{}'::text[]) into v_holding
  from jsonb_array_elements_text(case when jsonb_typeof(p_fields -> 'holding_lines') = 'array'
                                      then p_fields -> 'holding_lines' else '[]'::jsonb end) x;

  if p_scope = 'client' then
    select * into v_row from public.playbook where case_file_id = v_pl.case_file_id and placement_id is null;
  else
    select * into v_row from public.playbook where placement_id = v_pl.id;
  end if;

  if v_row.id is null then
    insert into public.playbook (case_file_id, placement_id, version, updated_by, updated_at)
    values (v_pl.case_file_id, case when p_scope = 'placement' then v_pl.id end, 0, auth.uid(), now())
    returning * into v_row;
  end if;

  update public.playbook
     set business_name = nullif(btrim(p_fields ->> 'business_name'), ''),
         offer = nullif(btrim(p_fields ->> 'offer'), ''),
         locations = nullif(btrim(p_fields ->> 'locations'), ''),
         hours = nullif(btrim(p_fields ->> 'hours'), ''),
         qualifies = nullif(btrim(p_fields ->> 'qualifies'), ''),
         disqualifiers = nullif(btrim(p_fields ->> 'disqualifiers'), ''),
         handoff_method = nullif(p_fields ->> 'handoff_method', ''),
         handoff_steps = nullif(btrim(p_fields ->> 'handoff_steps'), ''),
         escalation_contacts = nullif(btrim(p_fields ->> 'escalation_contacts'), ''),
         never_say = nullif(btrim(p_fields ->> 'never_say'), ''),
         approved_pricing = nullif(btrim(p_fields ->> 'approved_pricing'), ''),
         holding_lines = v_holding,
         version = version + 1,
         updated_by = auth.uid(),
         updated_at = now()
   where id = v_row.id
  returning * into v_row;

  delete from public.playbook_asset where playbook_id = v_row.id;
  insert into public.playbook_asset (playbook_id, asset_id, sort_order)
  select v_row.id, x.id, x.ord * 10
  from unnest(coalesce(p_asset_ids, '{}'::uuid[])) with ordinality x(id, ord)
  on conflict do nothing;

  insert into public.playbook_version (playbook_id, version, snapshot, change_note, major, saved_by)
  values (v_row.id, v_row.version,
          to_jsonb(v_row) || jsonb_build_object('asset_ids', to_jsonb(coalesce(p_asset_ids, '{}'::uuid[]))),
          btrim(p_change_note), coalesce(p_major, false), auth.uid());

  v_client := app.placement_client_name(v_pl);

  -- Every VA working this client now (or this one placement) is told; a major
  -- change must be read and confirmed before they continue.
  for v_op in
    select distinct o.id, o.profile_id
    from public.placement pl join public.operator o on o.id = pl.operator_id
    where app.placement_is_live(pl)
      and (case when p_scope = 'client' then pl.case_file_id = v_pl.case_file_id else pl.id = v_pl.id end)
  loop
    insert into public.operator_notification (operator_id, severity, title, body, sent_by)
    values (v_op.id, case when p_major then 'urgent'::public.notification_severity else 'important'::public.notification_severity end,
            format('Playbook updated: %s', v_client), btrim(p_change_note), app.profile_name(auth.uid()));
    if coalesce(p_major, false) and v_op.profile_id is not null then
      insert into public.account_notice (profile_id, body, severity, blocking, created_by)
      values (v_op.profile_id,
              format('The playbook for %s changed: %s' || E'\n\n' || 'Open the Playbook tab and read it before your next conversation.',
                     v_client, btrim(p_change_note)),
              'urgent', true, auth.uid());
    end if;
  end loop;

  perform app.audit('playbook.saved', 'playbook', v_row.id::text,
    format('Saved the %s playbook for %s (version %s)%s: %s', p_scope, v_client, v_row.version,
           case when p_major then ', marked major' else '' end, btrim(p_change_note)),
    null, null, v_pl.case_file_id);

  return jsonb_build_object('ok', true, 'id', v_row.id, 'version', v_row.version);
end;
$$;

-- Staff inbox --------------------------------------------------------------------

create or replace function public.staff_notifications(p_limit integer default 50)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'unread', (select count(*) from public.staff_notification n where n.recipient_profile_id = auth.uid() and n.read_at is null),
    'items', coalesce((
      select jsonb_agg(x.j order by x.created_at desc)
      from (
        select n.created_at, jsonb_build_object('id', n.id, 'kind', n.kind, 'severity', n.severity, 'title', n.title,
                                                'body', n.body, 'operator_id', n.operator_id, 'created_at', n.created_at,
                                                'read_at', n.read_at) as j
        from public.staff_notification n
        where n.recipient_profile_id = auth.uid()
        order by n.created_at desc
        limit least(greatest(coalesce(p_limit, 50), 1), 200)
      ) x
    ), '[]'::jsonb)
  );
$$;

create or replace function public.staff_mark_notifications_read(p_ids uuid[] default null)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.staff_notification set read_at = now()
   where recipient_profile_id = auth.uid() and read_at is null and (p_ids is null or id = any(p_ids));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- The sweep ----------------------------------------------------------------------

-- Every 15 minutes: flag suspected missed shifts for review, raise the ghosting
-- alert (Section 6.5), tell everyone about late escalation answers, and stamp
-- View As sessions that ran out. It decides nothing about anyone.
create or replace function app.sweep_va_portal()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'UTC')::date;
  v_pl public.placement;
  v_op public.operator;
  v_flagged integer := 0;
  v_ghosting integer := 0;
  v_overdue integer := 0;
  v_expired integer := 0;
  v_new integer;
  v_last record;
  v_e record;
begin
  for v_pl in select * from public.placement pl where pl.status = 'active' loop
    select * into v_op from public.operator where id = v_pl.operator_id;

    -- 1. Suspected missed: over for three hours, no report, no activity, no notice.
    with inserted as (
      insert into public.shift_attendance (placement_id, operator_id, shift_date, status, flagged_at)
      select v_pl.id, v_pl.operator_id, a.shift_date, 'suspected_missed', now()
      from app.placement_attendance(v_pl.id, v_today - 7, v_today) a
      where a.status = 'suspected_missed' and a.attendance_id is null
        and a.ends_at < now() - interval '3 hours'
      on conflict (placement_id, shift_date) do nothing
      returning shift_date
    )
    select count(*) into v_new from inserted;

    if v_new > 0 then
      v_flagged := v_flagged + v_new;
      perform app.notify_staff(app.admin_recipient_ids() || app.placement_manager_ids(v_pl.id),
        'attendance.suspected_missed', 'important',
        format('%s: %s shift%s may have been missed', v_op.name, v_new, case when v_new = 1 then '' else 's' end),
        format('%s. No report, no logged activity and no notice. Review it: confirm, excuse or correct. Nothing is decided automatically.',
               app.placement_client_name(v_pl)),
        v_op.id);
    end if;

    -- 2. Ghosting: the two most recent finished shifts both missed with no notice.
    select
      bool_and(x.status = 'suspected_missed') as both_missed,
      count(*) as n,
      max(x.shift_date) as latest
      into v_last
    from (
      select a.shift_date, a.status
      from app.placement_attendance(v_pl.id, v_today - 21, v_today) a
      where a.status <> 'scheduled'
      order by a.shift_date desc
      limit 2
    ) x;

    if v_last.n = 2 and v_last.both_missed and exists (
      select 1 from public.shift_attendance sa
      where sa.placement_id = v_pl.id and sa.shift_date = v_last.latest and sa.ghosting_alerted_at is null
    ) then
      update public.shift_attendance set ghosting_alerted_at = now()
       where placement_id = v_pl.id and shift_date = v_last.latest;
      v_ghosting := v_ghosting + 1;
      perform app.notify_staff(app.admin_recipient_ids(), 'attendance.ghosting', 'urgent',
        format('Ghosting alert: %s missed two shifts in a row', v_op.name),
        format('%s. Two consecutive scheduled shifts with no work and no notice (Section 6.5). Access has not been changed; that decision is yours.',
               app.placement_client_name(v_pl)),
        v_op.id);
    end if;
  end loop;

  -- 3. Escalations past their due time: DA is late, never the VA.
  for v_e in
    select e.*, o.name as operator_name
    from public.escalation e join public.operator o on o.id = e.operator_id
    where e.status = 'open' and e.response_due_at < now() and e.overdue_alerted_at is null
  loop
    update public.escalation set overdue_alerted_at = now() where id = v_e.id;
    v_overdue := v_overdue + 1;
    perform app.notify_staff(app.admin_recipient_ids() || app.case_file_manager_ids(v_e.case_file_id),
      'escalation.overdue', 'urgent',
      format('Late answer: %s is waiting on an escalation', v_e.operator_name),
      format('%s. It was due %s UTC. %s', initcap(replace(v_e.category::text, '_', ' ')),
             to_char(v_e.response_due_at at time zone 'UTC', 'FMDD Mon HH24:MI'), left(v_e.needed, 300)),
      v_e.operator_id);
    insert into public.operator_notification (operator_id, placement_id, severity, title, body, sent_by)
    values (v_e.operator_id, v_e.placement_id, 'important', 'DA is late responding',
            'Your escalation is past its answer time. Keep the customer warm with your holding line; this delay is on DA, not you.',
            'System');
  end loop;

  -- 4. View As sessions that ran out.
  update public.impersonation set ended_at = expires_at, ended_reason = 'expired'
   where ended_at is null and expires_at <= now();
  get diagnostics v_expired = row_count;

  return jsonb_build_object('flagged', v_flagged, 'ghosting', v_ghosting, 'overdue', v_overdue, 'expired', v_expired);
end;
$$;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'va-portal-sweep') then
    perform cron.unschedule('va-portal-sweep');
  end if;
  perform cron.schedule('va-portal-sweep', '*/15 * * * *', 'select app.sweep_va_portal()');
end
$$;

-- Grants -------------------------------------------------------------------------

do $$
declare
  f text;
begin
  foreach f in array array[
    'app.actor_role()',
    'app.actor_allowed(text)',
    'app.staff_can_reach_placement(uuid)',
    'app.staff_can_reach_operator(uuid)',
    'app.require_reach_operator(uuid)',
    'app.require_reach_placement(uuid)',
    'app.portal_placement_ids(public.operator)',
    'app.reason_kind_label(text)',
    'app.sweep_va_portal()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;

  foreach f in array array[
    'public.start_view_as(uuid, text, text, integer)',
    'public.extend_view_as(text)',
    'public.view_as_sessions(uuid, uuid, date, date)',
    'public.staff_operator_roster()',
    'public.staff_panel(uuid)',
    'public.staff_review_booking(uuid, text, text)',
    'public.staff_answer_escalation(uuid, text)',
    'public.staff_set_attendance(uuid, date, text, text)',
    'public.staff_assign_task(uuid, text, text, date, uuid)',
    'public.staff_assign_training(uuid, text, text, uuid)',
    'public.staff_send_notification(uuid, text, text, text, boolean)',
    'public.staff_add_note(uuid, text)',
    'public.staff_decide_ld(uuid, boolean, text)',
    'public.staff_answer_pay_question(uuid, text)',
    'public.staff_log_booking(uuid, text, text, text, timestamptz, text)',
    'public.staff_correct_report(uuid, text, text, integer, integer, integer, integer, text)',
    'public.staff_playbook(uuid)',
    'public.staff_save_playbook(uuid, text, jsonb, uuid[], text, boolean)',
    'public.staff_notifications(integer)',
    'public.staff_mark_notifications_read(uuid[])'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end
$$;
