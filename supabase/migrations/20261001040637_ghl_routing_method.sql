-- ===========================================================================
-- GHL connection layer, part 5: routing method and after-hours behavior per
-- client, and status counts on the activity health view.
-- ===========================================================================

alter table public.ghl_routing_setting
  add column if not exists routing_method text not null default 'round_robin',
  add column if not exists single_owner_placement_id uuid references public.placement (id) on delete set null,
  add column if not exists after_hours_behavior text not null default 'next_shift';

do $$ begin
  alter table public.ghl_routing_setting add constraint ghl_routing_method_chk
    check (routing_method in ('round_robin', 'single_owner', 'manual'));
  alter table public.ghl_routing_setting add constraint ghl_routing_after_hours_chk
    check (after_hours_behavior in ('next_shift', 'manual'));
exception when duplicate_object then null; end $$;

alter table public.lead_routing drop constraint if exists lead_routing_state_check;
alter table public.lead_routing add constraint lead_routing_state_check
  check (state in ('assigned', 'after_hours', 'no_one_eligible', 'manual', 'touched', 'reassigned'));

create or replace function app.ghl_routing(p_case_file_id uuid)
returns public.ghl_routing_setting
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select s from public.ghl_routing_setting s where s.case_file_id = p_case_file_id),
    row(p_case_file_id, true, 4, 8, 8, false, 15, 180, null, now(), 'round_robin', null, 'next_shift')::public.ghl_routing_setting
  );
$$;

create or replace function app.route_lead(p_lead_id uuid, p_kind text default 'initial', p_exclude_placement uuid default null, p_decided_by uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.lead;
  s public.ghl_routing_setting;
  v_candidates jsonb := '[]'::jsonb;
  v_chosen record;
  v_eligible integer;
  v_on_shift integer;
  v_reason text;
  v_state text;
  v_user text;
  r record;
begin
  select * into l from public.lead where id = p_lead_id;
  if l.id is null then return null; end if;
  s := app.ghl_routing(l.case_file_id);

  if not s.enabled then
    insert into public.lead_routing_decision (lead_id, case_file_id, kind, reason, decided_by)
    values (l.id, l.case_file_id, p_kind, 'Routing is off for this client', p_decided_by);
    return jsonb_build_object('state', 'off');
  end if;

  -- Manual method: nobody is picked automatically. An admin's reroute
  -- (p_kind 'manual') still picks among the eligible.
  if s.routing_method = 'manual' and p_kind <> 'manual' then
    insert into public.lead_routing (lead_id, case_file_id, state, owner_state)
    values (l.id, l.case_file_id, 'manual', 'not_needed')
    on conflict (lead_id) do nothing;
    insert into public.lead_routing_decision (lead_id, case_file_id, kind, reason, decided_by)
    values (l.id, l.case_file_id, p_kind, 'Routing method is manual: waiting for an admin or manager to assign it', p_decided_by);
    if p_kind = 'initial' then
      perform app.notify_staff(app.case_file_manager_ids(l.case_file_id) || app.admin_recipient_ids(), 'lead_manual', 'urgent',
        format('A new lead for %s needs assigning', app.ghl_case_name(l.case_file_id)),
        'Routing for this client is manual. Assign it from the routing log.', null);
    end if;
    return jsonb_build_object('state', 'manual');
  end if;

  create temporary table if not exists pg_temp.ghl_candidates (
    placement_id uuid, operator_id uuid, profile_id uuid, name text, on_shift boolean, open_leads integer,
    last_assigned timestamptz, skipped text) on commit drop;
  truncate pg_temp.ghl_candidates;

  insert into pg_temp.ghl_candidates
  select pl.id, o.id, o.profile_id, o.name, app.on_shift_now(pl),
    (select count(*) from public.lead_routing lr where lr.placement_id = pl.id and lr.state in ('assigned', 'reassigned')
       and lr.assigned_at > now() - interval '24 hours')::integer,
    (select max(lr.assigned_at) from public.lead_routing lr where lr.placement_id = pl.id),
    null
  from public.placement pl
  join public.operator o on o.id = pl.operator_id
  where pl.case_file_id = l.case_file_id and pl.status = 'active'
    -- Single owner: only that placement is ever considered.
    and (s.routing_method <> 'single_owner' or pl.id = s.single_owner_placement_id or p_kind = 'manual')
    and pl.start_date <= (now() at time zone app.safe_tz(pl.time_zone))::date
    and pl.end_date >= (now() at time zone app.safe_tz(pl.time_zone))::date;

  update pg_temp.ghl_candidates c set skipped = case
      when not c.on_shift then 'not on shift'
      when c.placement_id = p_exclude_placement then 'already had this lead'
      when exists (select 1 from public.shift_attendance a
                   join public.placement pl on pl.id = a.placement_id
                   where a.placement_id = c.placement_id
                     and a.shift_date = (now() at time zone app.safe_tz(pl.time_zone))::date
                     and a.status in ('notified_absence', 'excused_emergency', 'abandoned')) then 'away (notified absence)'
      when c.profile_id is null or app.effective_state(c.profile_id) is distinct from 'active' then 'account not active'
      when c.open_leads >= s.max_open_leads then format('at the open-lead limit (%s)', s.max_open_leads)
      else null end;

  select coalesce(jsonb_agg(jsonb_build_object('placement_id', c.placement_id, 'operator_id', c.operator_id, 'name', c.name,
    'on_shift', c.on_shift, 'open_leads', c.open_leads, 'last_assigned', c.last_assigned, 'skipped', c.skipped) order by c.name), '[]'::jsonb),
    count(*) filter (where c.skipped is null), count(*) filter (where c.on_shift)
    into v_candidates, v_eligible, v_on_shift
  from pg_temp.ghl_candidates c;

  if v_eligible = 0 then
    if v_on_shift = 0 and s.after_hours_behavior = 'manual' then
      v_state := 'manual';
      v_reason := 'Nobody on shift: held for manual assignment (this client''s after-hours setting), and not counted against anyone';
    elsif v_on_shift = 0 then
      v_state := 'after_hours';
      v_reason := 'Nobody on shift: held in the after-hours queue for the next shift start, and not counted against anyone';
    else
      v_state := 'no_one_eligible';
      v_reason := 'VAs are on shift but none is eligible (see each one''s reason). Waiting for one to become eligible';
    end if;
    insert into public.lead_routing (lead_id, case_file_id, state, placement_id, operator_id, assigned_at, owner_state)
    values (l.id, l.case_file_id, v_state, null, null, null, 'not_needed')
    on conflict (lead_id) do update set state = case when public.lead_routing.state = 'touched' then 'touched' else excluded.state end;
    if v_state in ('after_hours', 'manual') then
      update public.lead set counts_toward_response = false where id = l.id;
    elsif p_kind = 'initial' then
      perform app.notify_staff(app.case_file_manager_ids(l.case_file_id) || app.admin_recipient_ids(), 'lead_unrouted', 'urgent',
        format('A new lead for %s has no eligible VA', app.ghl_case_name(l.case_file_id)),
        'VAs are on shift but all are away or at their open-lead limit. Open the routing log to assign it.', null);
    end if;
    insert into public.lead_routing_decision (lead_id, case_file_id, kind, candidates, reason, decided_by)
    values (l.id, l.case_file_id, p_kind, v_candidates, v_reason, p_decided_by);
    return jsonb_build_object('state', v_state);
  end if;

  -- One eligible: that VA. Several: round robin, the one assigned longest ago.
  select * into v_chosen from pg_temp.ghl_candidates c where c.skipped is null
  order by c.last_assigned nulls first, c.placement_id limit 1;
  v_reason := case when v_eligible = 1 then format('%s is the only eligible VA on shift', v_chosen.name)
                   else format('Round robin among %s eligible VAs: %s was assigned longest ago', v_eligible, v_chosen.name) end;

  select u.ghl_user_id into v_user from public.ghl_user u where u.profile_id = v_chosen.profile_id and u.deactivated_at is null;

  insert into public.lead_routing (lead_id, case_file_id, placement_id, operator_id, state, assigned_at, owner_state, owner_error, reminded_at, manager_alerted_at)
  values (l.id, l.case_file_id, v_chosen.placement_id, v_chosen.operator_id,
          case when p_kind = 'reassign' then 'reassigned' else 'assigned' end, now(),
          case when v_user is null then 'failed' else 'pending' end,
          case when v_user is null then 'The VA has no GHL user yet (access pending)' end, null, null)
  on conflict (lead_id) do update
    set placement_id = excluded.placement_id, operator_id = excluded.operator_id, state = excluded.state,
        assigned_at = excluded.assigned_at, owner_state = excluded.owner_state, owner_error = excluded.owner_error,
        reminded_at = null, manager_alerted_at = null;

  update public.lead set placement_id = v_chosen.placement_id, placement_basis = 'routed' where id = l.id;

  insert into public.lead_routing_decision (lead_id, case_file_id, kind, candidates, chosen_placement_id, chosen_operator_id, reason, decided_by)
  values (l.id, l.case_file_id, p_kind, v_candidates, v_chosen.placement_id, v_chosen.operator_id, v_reason, p_decided_by);

  if v_user is not null then
    perform app.ghl_enqueue('assign_owner', l.case_file_id, 'owner:' || l.id || ':' || v_chosen.placement_id,
      jsonb_build_object('lead_id', l.id), 2);
  else
    perform app.ghl_alert_admins('ghl.owner_unset', 'Lead routed without a GHL owner',
      format('A lead for %s was routed to %s, who has no GHL user yet, so the contact owner was not set in GHL.',
        app.ghl_case_name(l.case_file_id), v_chosen.name));
  end if;

  perform app.ghl_ping_operator(v_chosen.operator_id, 'lead_routed',
    case when p_kind = 'reassign' then 'A lead was reassigned to you' else 'New lead assigned to you' end,
    format('A new lead for %s is yours. Respond now: the standard is %s minutes. Details are on My Day and in GHL.',
      app.ghl_case_name(l.case_file_id),
      coalesce((select response_standard_minutes from public.placement where id = v_chosen.placement_id), 5)),
    v_chosen.placement_id);

  return jsonb_build_object('state', 'assigned', 'placement_id', v_chosen.placement_id, 'operator_id', v_chosen.operator_id);
end;
$$;

create or replace function public.ghl_activity_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app.require('ghl.view');
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'case_file_id', gl.case_file_id, 'name', app.ghl_case_name(gl.case_file_id), 'is_test', gl.is_test,
      'endpoint', gl.ingest_endpoint_id is not null, 'polled_at', gl.polled_at,
      'last_event_at', (select max(e.received_at) from public.ingest_event e where e.case_file_id = gl.case_file_id),
      'by_type', coalesce((select jsonb_object_agg(t.event_type, jsonb_build_object('last', t.last, 'day', t.day))
        from (select e.event_type, max(e.received_at) as last, count(*) filter (where e.received_at > now() - interval '24 hours') as day
              from public.ingest_event e where e.case_file_id = gl.case_file_id and e.event_type is not null group by e.event_type) t), '{}'::jsonb),
      'status_24h', coalesce((select jsonb_object_agg(t.status, t.n) from (
          select e.status::text as status, count(*) as n from public.ingest_event e
          where e.case_file_id = gl.case_file_id and e.received_at > now() - interval '24 hours' group by e.status) t), '{}'::jsonb),
      'waiting', (select count(*) from public.ingest_event e where e.case_file_id = gl.case_file_id and e.status = 'received'),
      'failed_24h', (select count(*) from public.ingest_event e where e.case_file_id = gl.case_file_id and e.status = 'failed' and e.received_at > now() - interval '24 hours'),
      'unknown_24h', (select count(*) from public.ingest_event e where e.case_file_id = gl.case_file_id and e.status = 'unknown_type' and e.received_at > now() - interval '24 hours'),
      'auth_failures_24h', (select count(*) from public.ingest_auth_failure f join public.ingest_endpoint ep on ep.key = f.endpoint_key
                            where ep.id = gl.ingest_endpoint_id and f.at > now() - interval '24 hours'),
      'touches_24h', coalesce((select jsonb_object_agg(coalesce(t.actor_kind, 'unknown'), t.n)
        from (select lt.actor_kind, count(*) as n from public.lead_touch lt
              where lt.case_file_id = gl.case_file_id and lt.direction = 'outbound' and lt.occurred_at > now() - interval '24 hours'
              group by lt.actor_kind) t), '{}'::jsonb),
      'estimated_24h', (select count(*) from public.lead_touch lt where lt.case_file_id = gl.case_file_id and lt.attribution = 'estimated' and lt.occurred_at > now() - interval '24 hours'),
      'unrecognised_users', coalesce((select jsonb_agg(distinct lt.ghl_user_id) from public.lead_touch lt
        where lt.case_file_id = gl.case_file_id and lt.actor_kind = 'unattributed' and lt.ghl_user_id is not null and lt.occurred_at > now() - interval '7 days'), '[]'::jsonb),
      'silence_alerted_at', gl.silence_alerted_at,
      'on_shift_now', exists (select 1 from public.placement pl where pl.case_file_id = gl.case_file_id and pl.status = 'active' and app.on_shift_now(pl)),
      'recent_failures', coalesce((select jsonb_agg(x) from (
          select e.id, e.event_type, e.status, e.error, e.received_at from public.ingest_event e
          where e.case_file_id = gl.case_file_id and e.status in ('failed', 'unknown_type') order by e.received_at desc limit 5) x), '[]'::jsonb)
    ) order by app.ghl_case_name(gl.case_file_id))
    from public.ghl_location gl
    where app.ghl_can_see(gl.case_file_id)
  ), '[]'::jsonb);
end;
$$;

-- The sweep releases the after-hours queue; leads held for manual assignment
-- are left for a person. Its query already selects only after_hours and
-- no_one_eligible, so 'manual' is never auto-released.

drop function if exists public.ghl_save_routing(uuid, boolean, integer, integer, integer, boolean, integer, integer);
create or replace function public.ghl_save_routing(
  p_case_file_id uuid, p_enabled boolean, p_method text, p_single_owner_placement_id uuid,
  p_after_hours text, p_remind_after integer, p_manager_after integer,
  p_max_open integer, p_auto_reassign boolean, p_reassign_after integer, p_silence_minutes integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.require('ghl.routing.manage');
  if p_method = 'single_owner' and not exists (
    select 1 from public.placement where id = p_single_owner_placement_id and case_file_id = p_case_file_id) then
    raise exception 'owner_required: pick the placement that owns every lead' using errcode = '23514';
  end if;
  insert into public.ghl_routing_setting (case_file_id, enabled, routing_method, single_owner_placement_id, after_hours_behavior,
    remind_after_minutes, manager_after_minutes, max_open_leads,
    auto_reassign, reassign_after_minutes, silence_alert_minutes, updated_by, updated_at)
  values (p_case_file_id, p_enabled, p_method, case when p_method = 'single_owner' then p_single_owner_placement_id end, p_after_hours,
    p_remind_after, p_manager_after, p_max_open, p_auto_reassign, p_reassign_after, p_silence_minutes, auth.uid(), now())
  on conflict (case_file_id) do update
    set enabled = excluded.enabled, routing_method = excluded.routing_method,
        single_owner_placement_id = excluded.single_owner_placement_id, after_hours_behavior = excluded.after_hours_behavior,
        remind_after_minutes = excluded.remind_after_minutes,
        manager_after_minutes = excluded.manager_after_minutes, max_open_leads = excluded.max_open_leads,
        auto_reassign = excluded.auto_reassign, reassign_after_minutes = excluded.reassign_after_minutes,
        silence_alert_minutes = excluded.silence_alert_minutes, updated_by = auth.uid(), updated_at = now();
  perform app.audit('ghl.routing_changed', 'ghl_routing_setting', p_case_file_id::text,
    format('Changed lead routing for %s (%s, after hours: %s, remind %s min, manager %s min, auto-reassign %s)', app.ghl_case_name(p_case_file_id),
      replace(p_method, '_', ' '), replace(p_after_hours, '_', ' '), p_remind_after, p_manager_after,
      case when p_auto_reassign then 'on' else 'off' end), null, null, p_case_file_id);
end;
$$;

revoke all on function public.ghl_save_routing(uuid, boolean, text, uuid, text, integer, integer, integer, boolean, integer, integer) from public, anon;
grant execute on function public.ghl_save_routing(uuid, boolean, text, uuid, text, integer, integer, integer, boolean, integer, integer) to authenticated;

-- The routing log's queue also shows leads held for manual assignment.
create or replace function public.ghl_routing_log(p_case_file_id uuid default null, p_limit integer default 100)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app.require('ghl.view');
  return jsonb_build_object(
    'can_manage', app.actor_allowed('ghl.routing.manage'),
    'decisions', coalesce((
      select jsonb_agg(x order by x.at desc) from (
        select d.id, d.at, d.kind, d.reason, d.candidates, d.lead_id, d.case_file_id, app.ghl_case_name(d.case_file_id) as client,
          (select name from public.operator where id = d.chosen_operator_id) as chosen,
          l.name as lead_name, lr.state, lr.owner_state, lr.owner_error, lr.touched_at, lr.assigned_at,
          l.response_minutes, l.counts_toward_response
        from public.lead_routing_decision d
        join public.lead l on l.id = d.lead_id
        left join public.lead_routing lr on lr.lead_id = d.lead_id
        where (p_case_file_id is null or d.case_file_id = p_case_file_id) and app.ghl_can_see(d.case_file_id)
        order by d.at desc limit greatest(least(coalesce(p_limit, 100), 500), 1)) x), '[]'::jsonb),
    'queue', coalesce((
      select jsonb_agg(jsonb_build_object('lead_id', lr.lead_id, 'client', app.ghl_case_name(lr.case_file_id), 'state', lr.state,
        'created_at', lr.created_at, 'lead_name', l.name) order by lr.created_at)
      from public.lead_routing lr join public.lead l on l.id = lr.lead_id
      where lr.state in ('after_hours', 'no_one_eligible', 'manual') and app.ghl_can_see(lr.case_file_id)
        and (p_case_file_id is null or lr.case_file_id = p_case_file_id)), '[]'::jsonb)
  );
end;
$$;
