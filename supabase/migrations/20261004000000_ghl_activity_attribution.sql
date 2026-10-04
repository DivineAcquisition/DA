-- ===========================================================================
-- Prompt 9B: exact attribution that reaches the standards, unattributed
-- events an admin can resolve, and a respond-by time on the routing ping.
--
-- What this closes, found by auditing the live-activity layer against the spec:
--
--  1. A touch that was automated, by DA staff, by the client's own staff or by
--     an unmapped GHL user could still land in a VA's shift draft and response
--     figures, because those read touches by placement or by shift window. A
--     VA is now credited only for touches GHL attributes to them, and for a lead
--     only when their own first human touch is the one that answered it.
--  2. lead_touch is append-only, so a GHL user an admin later maps to a person
--     could not be re-attributed. Resolutions are an append-only overlay and
--     every reader goes through app.touch_eff.
--  3. The sender is read from the sending user field only. The workflow
--     contact "user" object is the contact owner, never the sender.
--  4. The new-lead ping states the respond-by time.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Resolutions: how an unattributed touch was later attributed
-- ---------------------------------------------------------------------------

create table if not exists public.lead_touch_resolution (
  touch_id uuid primary key references public.lead_touch (id) on delete cascade,
  actor_kind text not null check (actor_kind in ('va', 'staff', 'client')),
  attribution text not null default 'exact' check (attribution in ('exact')),
  is_human boolean not null default true,
  actor_profile_id uuid references public.profile (id) on delete set null,
  placement_id uuid references public.placement (id) on delete set null,
  ghl_user_id text not null,
  resolved_by uuid references public.profile (id) on delete set null,
  resolved_at timestamptz not null default now(),
  reason text not null
);

comment on table public.lead_touch_resolution is
  'Append-only overlay on lead_touch: an admin mapped the GHL user who sent an unattributed touch. The touch row itself is never changed.';

drop trigger if exists lead_touch_resolution_no_update on public.lead_touch_resolution;
create trigger lead_touch_resolution_no_update before update on public.lead_touch_resolution
  for each row execute function app.forbid_mutation();
drop trigger if exists lead_touch_resolution_no_delete on public.lead_touch_resolution;
create trigger lead_touch_resolution_no_delete before delete on public.lead_touch_resolution
  for each row execute function app.forbid_mutation();

alter table public.lead_touch_resolution enable row level security;
revoke all on public.lead_touch_resolution from anon, authenticated;

-- The touch as it is now attributed. Every reader of who touched a lead uses
-- this, never lead_touch directly.
create or replace view app.touch_eff as
select
  lt.id, lt.lead_id, lt.case_file_id,
  case when r.touch_id is null then lt.placement_id else r.placement_id end as placement_id,
  lt.channel, lt.direction, lt.occurred_at, lt.ingest_event_id, lt.created_at,
  coalesce(r.actor_kind, lt.actor_kind) as actor_kind,
  coalesce(r.attribution, lt.attribution) as attribution,
  coalesce(r.is_human, lt.is_human) as is_human,
  coalesce(r.ghl_user_id, lt.ghl_user_id) as ghl_user_id,
  coalesce(r.actor_profile_id, lt.actor_profile_id) as actor_profile_id,
  lt.message_source, lt.signal,
  (r.touch_id is not null) as resolved
from public.lead_touch lt
left join public.lead_touch_resolution r on r.touch_id = lt.id;

revoke all on app.touch_eff from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Whose standards a lead's first human touch counts toward
--
-- Nobody has touched it yet, or the touch predates GHL attribution: it stays
-- with the placement (pending, or the shift-window estimate). Otherwise only
-- the VA who actually sent the first human touch is credited. DA staff, the
-- client's staff and an unmapped user answering first answer the lead, but are
-- never anyone's response time.
-- ---------------------------------------------------------------------------

create or replace function app.first_touch_credits(p_touch_at timestamptz, p_kind text, p_touch_profile uuid, p_va_profile uuid)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_touch_at is null
      or p_kind is null
      or (p_kind = 'va' and p_touch_profile is not distinct from p_va_profile);
$$;

-- The placement a lead's response is credited to: the one it was routed to while
-- nobody has answered it, and the answering VA's own placement once one has.
-- Nobody's, when DA staff, the client or an unmapped user answered first.
create or replace function app.lead_credit_placement(p_lead public.lead)
returns uuid
language sql
stable
security definer
set search_path = ''
as $f$
  select case
    when p_lead.first_touch_at is null or p_lead.first_touch_kind is null then p_lead.placement_id
    when p_lead.first_touch_kind = 'va' then (
      select pl.id from public.placement pl join public.operator o on o.id = pl.operator_id
      where o.profile_id = p_lead.first_touch_profile_id and pl.case_file_id = p_lead.case_file_id and pl.status <> 'draft'
      order by pl.start_date desc limit 1)
  end;
$f$;

create or replace function app.first_touch_who(p_kind text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_kind
    when 'va' then 'another VA'
    when 'staff' then 'DA staff'
    when 'client' then 'the client''s own staff'
    else 'a GHL user who is not mapped to anyone yet' end;
$$;

-- Sender: the sending user field only. A workflow payload's "user" object is the contact owner.
create or replace function app.ghl_classify_touch(p_case_file_id uuid, p_payload jsonb, p_at timestamptz)
returns table (is_human boolean, actor_kind text, attribution text, ghl_user_id text, profile_id uuid, placement_id uuid, signal text, message_source text)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_source text := lower(app.jsonb_first(p_payload, 'source', 'message.source', 'messageSource'));
  v_type text := upper(app.jsonb_first(p_payload, 'messageType', 'message.messageType', 'message.type'));
  v_flag text := lower(app.jsonb_first(p_payload, 'automated', 'isAutomated', 'customData.automated'));
  v_wf text := app.jsonb_first(p_payload, 'workflowId', 'workflow_id', 'campaignId', 'campaign_id', 'meta.workflowId');
  v_user text := app.jsonb_first(p_payload, 'userId', 'message.userId', 'user_id');
  u public.ghl_user;
  p public.profile;
  v_pl uuid;
begin
  message_source := v_source;
  if v_flag in ('true', '1', 'yes') then
    return query select false, 'automated', 'exact', v_user, null::uuid, null::uuid, 'automated flag', v_source; return;
  end if;
  if v_wf is not null then
    return query select false, 'automated', 'exact', v_user, null::uuid, null::uuid, 'workflow or campaign id', v_source; return;
  end if;
  if v_source in ('workflow', 'bulk_actions', 'campaign', 'api', 'automation', 'trigger') then
    return query select false, 'automated', 'exact', v_user, null::uuid, null::uuid, 'source=' || v_source, v_source; return;
  end if;
  if v_type like 'TYPE_CAMPAIGN_%' then
    return query select false, 'automated', 'exact', v_user, null::uuid, null::uuid, 'messageType=' || v_type, v_source; return;
  end if;

  if v_user is not null then
    select * into u from public.ghl_user where ghl_user_id = v_user;
    if u.known_kind = 'client_staff' then
      return query select true, 'client', 'exact', v_user, null::uuid, null::uuid, 'userId', v_source; return;
    end if;
    if u.profile_id is null then
      -- A GHL user DA does not know. Recorded, never guessed.
      return query select true, case when u.known_kind = 'agency_staff' then 'staff' else 'unattributed' end,
        case when u.known_kind = 'agency_staff' then 'exact' else 'none' end, v_user, null::uuid, null::uuid, 'userId', v_source; return;
    end if;
    select * into p from public.profile where id = u.profile_id;
    select pl.id into v_pl
    from public.placement pl join public.operator o on o.id = pl.operator_id
    where o.profile_id = p.id and pl.case_file_id = p_case_file_id
      and pl.start_date <= (p_at at time zone app.safe_tz(pl.time_zone))::date
      and pl.end_date >= (p_at at time zone app.safe_tz(pl.time_zone))::date - 1
      and pl.status in ('active', 'renewed', 'ended')
    order by pl.start_date desc limit 1;
    if v_pl is not null or p.role in ('operator', 'contractor') then
      return query select true, 'va', 'exact', v_user, p.id, v_pl, 'userId', v_source; return;
    end if;
    return query select true, 'staff', 'exact', v_user, p.id, null::uuid, 'userId', v_source; return;
  end if;

  if v_source = 'app' then
    v_pl := app.ingest_placement_at(p_case_file_id, p_at);
    return query select true, case when v_pl is null then 'unattributed' else 'va' end,
      case when v_pl is null then 'none' else 'estimated' end, null::text,
      (select o.profile_id from public.placement pl join public.operator o on o.id = pl.operator_id where pl.id = v_pl),
      v_pl, 'source=app, no userId', v_source;
    return;
  end if;

  return query select null::boolean, 'unattributed', 'none', null::text, null::uuid, null::uuid, 'no signal', v_source;
end;
$$;

create or replace function app.ghl_recompute_first_touch(p_lead_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t record;
begin
  select lt.occurred_at, lt.actor_profile_id, lt.actor_kind into t
  from app.touch_eff lt
  where lt.lead_id = p_lead_id and lt.direction = 'outbound' and lt.channel <> 'note'
    and (lt.is_human or (lt.is_human is null and lt.actor_kind is null))
  order by lt.occurred_at limit 1;
  perform set_config('app.restamp', 'on', true);
  update public.lead
     set first_touch_at = t.occurred_at, first_touch_profile_id = t.actor_profile_id, first_touch_kind = t.actor_kind
   where id = p_lead_id
     and (first_touch_at is distinct from t.occurred_at or first_touch_profile_id is distinct from t.actor_profile_id or first_touch_kind is distinct from t.actor_kind);
  perform set_config('app.restamp', 'off', true);
end;
$$;

create or replace function app.ingest_handle_touch(p_event_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.ingest_event;
  v_contact text;
  v_at timestamptz;
  v_lead public.lead;
  c record;
  v_channel text;
begin
  select * into e from public.ingest_event where id = p_event_id;
  v_contact := app.ingest_contact_ref(e.payload);
  if v_contact is null then
    raise exception 'no_contact_id: a touch with no contact cannot be attributed to a lead'
      using errcode = '22023';
  end if;
  v_at := coalesce(
    app.ingest_ts(app.jsonb_first(e.payload, 'dateAdded', 'timestamp', 'createdAt', 'date_created')),
    e.received_at
  );
  select * into v_lead from public.lead
  where case_file_id = e.case_file_id and external_id = v_contact;
  if v_lead.id is null then
    insert into public.lead (case_file_id, placement_id, placement_basis, external_id, name, email, phone, lead_in_at, first_ingest_event_id)
    values (
      e.case_file_id, app.ingest_placement_at(e.case_file_id, v_at),
      case when app.ingest_placement_at(e.case_file_id, v_at) is not null then 'estimated' end,
      v_contact,
      app.ingest_contact_name(e.payload),
      lower(app.jsonb_first(e.payload, 'contact.email', 'email')),
      app.jsonb_first(e.payload, 'contact.phone', 'phone'),
      v_at, e.id
    )
    returning * into v_lead;
  end if;

  select * into c from app.ghl_classify_touch(e.case_file_id, e.payload, v_at);
  v_channel := case when e.event_type = 'NoteCreate' then 'note'
                    else coalesce(app.jsonb_first(e.payload, 'messageType', 'message.type', 'channel'), 'message') end;

  insert into public.lead_touch (lead_id, case_file_id, placement_id, channel, direction, occurred_at, ingest_event_id,
    actor_kind, attribution, is_human, ghl_user_id, actor_profile_id, message_source, signal)
  values (
    v_lead.id, e.case_file_id,
    -- Only a VA's touch belongs to a placement. Never an automation, staff, the client or an unknown user.
    case when c.actor_kind = 'va' then coalesce(c.placement_id, case when c.attribution = 'exact' then null else v_lead.placement_id end) end,
    v_channel, 'outbound', v_at, e.id,
    c.actor_kind, c.attribution, c.is_human, c.ghl_user_id, c.profile_id, c.message_source, c.signal
  );

  -- Only a human message to the customer stamps first touch. Recomputed from
  -- the log, so an earlier one arriving late takes its place.
  if c.is_human and v_channel <> 'note' then
    perform app.ghl_recompute_first_touch(v_lead.id);
    update public.lead_routing set state = 'touched', touched_at = coalesce(least(touched_at, v_at), v_at)
     where lead_id = v_lead.id and state in ('assigned', 'after_hours', 'no_one_eligible', 'reassigned');
  end if;

  perform app.refresh_lead_rollups(e.case_file_id, (v_lead.lead_in_at at time zone 'UTC')::date);
  return format('%s touch (%s, %s) on lead %s', coalesce(c.actor_kind, 'unknown'), coalesce(c.signal, 'no signal'),
    coalesce(c.attribution, 'none'), v_lead.id);
end;
$$;

create or replace function app.refresh_lead_rollups(p_case_file_id uuid, p_day date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.tracking_funnel_daily (
    case_file_id, day, source, leads, booked, avg_response_minutes, responded_within_standard, ingested_at
  )
  select
    l.case_file_id,
    p_day,
    coalesce(nullif(btrim(l.source), ''), 'unattributed'),
    count(*),
    count(l.first_booking_at),
    round(avg(l.response_minutes) filter (where l.counts_toward_response), 2),
    count(*) filter (
      where l.counts_toward_response
        and l.response_minutes is not null
        and l.response_minutes <= coalesce(pl.response_standard_minutes, 5)
    ),
    now()
  from public.lead l
  left join public.placement pl on pl.id = l.placement_id
  where l.case_file_id = p_case_file_id
    and (l.lead_in_at at time zone 'UTC')::date = p_day
  group by l.case_file_id, coalesce(nullif(btrim(l.source), ''), 'unattributed')
  on conflict (case_file_id, day, source) do update
    set leads = excluded.leads,
        booked = excluded.booked,
        avg_response_minutes = excluded.avg_response_minutes,
        responded_within_standard = excluded.responded_within_standard,
        ingested_at = excluded.ingested_at;
  insert into public.response_day (placement_id, day, conversations, within_standard)
  select
    pl.id,
    p_day,
    count(*),
    count(*) filter (
      where l.response_minutes is not null
        and l.response_minutes <= coalesce(pl.response_standard_minutes, 5)
    )
  from public.lead l
  join public.placement pl on pl.id = app.lead_credit_placement(l)
  where l.case_file_id = p_case_file_id
    and (l.lead_in_at at time zone 'UTC')::date = p_day
    and l.counts_toward_response
  group by pl.id
  on conflict (placement_id, day) do update
    set conversations = excluded.conversations,
        within_standard = excluded.within_standard;
end;
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

  -- In the app only, and no customer detail: the client, and by when.
  perform app.ghl_ping_operator(v_chosen.operator_id, 'lead_routed',
    format(case when p_kind = 'reassign' then 'Lead reassigned to you for %s, respond by %s' else 'New lead for %s, respond by %s' end,
      app.ghl_case_name(l.case_file_id),
      to_char((now() at time zone app.safe_tz((select time_zone from public.placement where id = v_chosen.placement_id)))
        + make_interval(mins => coalesce((select response_standard_minutes from public.placement where id = v_chosen.placement_id), 5)), 'FMHH12:MI AM')),
    format('Respond within %s minutes. The lead''s details are on My Day and in GHL.',
      coalesce((select response_standard_minutes from public.placement where id = v_chosen.placement_id), 5)),
    v_chosen.placement_id);

  return jsonb_build_object('state', 'assigned', 'placement_id', v_chosen.placement_id, 'operator_id', v_chosen.operator_id);
end;
$$;

create or replace function app.window_activity(p_pl public.placement, p_starts timestamptz, p_ends timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_tracking boolean := app.tracking_live(p_pl.case_file_id, p_ends);
  v_standard integer := coalesce(p_pl.response_standard_minutes, 5);
  v_profile uuid := (select o.profile_id from public.operator o where o.id = p_pl.operator_id);
  v_out jsonb;
begin
  with t as (
    select lt.*,
           (lt.placement_id is null and app.other_placement_on_shift(p_pl, lt.occurred_at)) as ambiguous
    from app.touch_eff lt
    where lt.case_file_id = p_pl.case_file_id
      and lt.occurred_at >= p_starts and lt.occurred_at < p_ends
      and (lt.placement_id = p_pl.id or lt.placement_id is null)
      -- Exact attribution: a touch with a known sender counts for this VA only
      -- when GHL says they sent it. Automations, staff, the client and unknown
      -- users are never a VA's activity. No actor at all is a touch from before
      -- GHL attribution, which keeps the shift-window rule.
      and (lt.actor_kind is null or lt.actor_kind = 'customer'
           or (lt.actor_kind = 'va' and lt.placement_id = p_pl.id))
  ),
  mine as (select * from t where not ambiguous),
  leads_in as (
    select l.*,
           (l.placement_id is null and app.other_placement_on_shift(p_pl, l.lead_in_at)) as ambiguous
    from public.lead l
    where l.case_file_id = p_pl.case_file_id
      and l.lead_in_at >= p_starts and l.lead_in_at < p_ends
      and (l.placement_id = p_pl.id or l.placement_id is null or l.first_touch_profile_id = v_profile)
      and app.first_touch_credits(l.first_touch_at, l.first_touch_kind, l.first_touch_profile_id, v_profile)
  ),
  booked as (
    select b.* from public.booking b
    where b.placement_id = p_pl.id and b.state <> 'rejected'
      and ((b.source = 'manual' and b.recorded_at >= p_starts and b.recorded_at < p_ends)
        or (b.source = 'ghl' and b.created_at >= p_starts and b.created_at < p_ends))
  ),
  esc as (
    select e.* from public.escalation e
    where e.placement_id = p_pl.id and e.raised_at >= p_starts and e.raised_at < p_ends
  ),
  activity as (
    select occurred_at as at from mine where direction = 'outbound'
    union all select recorded_at from booked where source = 'manual'
    union all select raised_at from esc
  )
  select jsonb_build_object(
    'tracking', v_tracking,
    'conversations', case when v_tracking then (select count(distinct lead_id) from mine where direction = 'outbound') end,
    'touches_outbound', case when v_tracking then (select count(*) from mine where direction = 'outbound') end,
    'touches_inbound', case when v_tracking then (select count(*) from mine where direction = 'inbound') end,
    'touches_by_channel', case when v_tracking then coalesce((
       select jsonb_object_agg(x.channel, x.n) from (select coalesce(channel, 'other') as channel, count(*) as n from mine group by 1) x
     ), '{}'::jsonb) end,
    'follow_ups', case when v_tracking then (
       select count(distinct m.lead_id) from mine m
       where m.direction = 'outbound'
         and exists (select 1 from public.lead_touch p where p.lead_id = m.lead_id and p.occurred_at < p_starts)) end,
    'appointments_booked', (select count(*) from booked),
    'escalations_raised', (select count(*) from esc),
    'leads_in', case when v_tracking then (select count(*) from leads_in where not ambiguous) end,
    'responded_in_standard', case when v_tracking then (
       select count(*) from leads_in
       where not ambiguous and first_touch_at is not null
         and first_touch_at <= lead_in_at + make_interval(mins => v_standard)) end,
    'median_response_minutes', case when v_tracking then (
       select round((percentile_cont(0.5) within group (order by extract(epoch from (first_touch_at - lead_in_at)) / 60.0))::numeric, 1)
       from leads_in where not ambiguous and first_touch_at is not null) end,
    'first_activity_at', case when v_tracking then (select min(at) from activity) else (select min(at) from activity) end,
    'last_activity_at', (select max(at) from activity),
    'answered_by_others', (select count(*) from public.lead l where l.case_file_id = p_pl.case_file_id
       and l.lead_in_at >= p_starts and l.lead_in_at < p_ends and (l.placement_id = p_pl.id or l.placement_id is null)
       and not app.first_touch_credits(l.first_touch_at, l.first_touch_kind, l.first_touch_profile_id, v_profile)),
    'ambiguous', (select count(*) from t where ambiguous) + (select count(*) from leads_in where ambiguous),
    'response_standard_minutes', v_standard
  ) into v_out;
  return v_out;
end;
$$;

create or replace function app.va_response_items(p_operator_id uuid, p_month date)
returns table(
  lead_id uuid,
  placement_id uuid,
  lead_in_at timestamptz,
  customer text,
  response_minutes numeric,
  hit boolean,
  counted boolean,
  excluded_reason text
)
language sql
stable
security definer
set search_path = ''
as $$
  with pl as (
    select p.*, date_trunc('month', p_month)::date as m_start
    from public.placement p
    where p.operator_id = p_operator_id and p.status <> 'draft'
  ),
  cand as (
    select l.*, p.id as pid, p.response_standard_minutes as rsm, app.safe_tz(p.time_zone) as tz, pp as prow
    from pl p
    join public.placement pp on pp.id = p.id
    join public.lead l
      on l.case_file_id = p.case_file_id and (l.placement_id = p.id or l.placement_id is null
         or l.first_touch_profile_id = (select o.profile_id from public.operator o where o.id = p_operator_id))
    where (l.lead_in_at at time zone app.safe_tz(p.time_zone))::date >= p.m_start
      and (l.lead_in_at at time zone app.safe_tz(p.time_zone))::date < (p.m_start + interval '1 month')::date
      and (l.lead_in_at at time zone app.safe_tz(p.time_zone))::date >= p.start_date
      and (l.lead_in_at at time zone app.safe_tz(p.time_zone))::date <= coalesce(p.closed_on, p.end_date)
  ),
  shaped as (
    select c.*,
           exists (
             select 1
             from (values ((c.lead_in_at at time zone c.tz)::date), ((c.lead_in_at at time zone c.tz)::date - 1)) d(day)
             cross join lateral app.shift_bounds(c.prow, d.day) b
             where extract(isodow from d.day)::smallint = any((c.prow).working_days)
               and b.starts_at <= c.lead_in_at and b.ends_at > c.lead_in_at
           ) as in_shift,
           (c.placement_id is null and app.other_placement_on_shift(c.prow, c.lead_in_at)) as ambiguous,
           (c.first_touch_at is not null and c.first_touch_at <= c.lead_in_at + make_interval(mins => coalesce(c.rsm, 5))) as met
    from cand c
  ),
  reasoned as (
    select s.*,
      case
        when not s.in_shift then 'Arrived outside your shift'
        when not app.first_touch_credits(s.first_touch_at, s.first_touch_kind, s.first_touch_profile_id,
                                         (select o.profile_id from public.operator o where o.id = p_operator_id))
          then 'Answered first by ' || app.first_touch_who(s.first_touch_kind) || ', so it is not your response time'
        when s.ambiguous then 'Two placements were on shift, so it is not attributed to you. A manager reviews these.'
        when nullif(btrim(coalesce(s.email, '')), '') is null and nullif(btrim(coalesce(s.phone, '')), '') is null
          then 'No valid contact method'
        when exists (select 1 from public.exclusion_window w
                     where w.placement_id = s.pid and s.lead_in_at >= w.starts_at and s.lead_in_at < w.ends_at)
          then (select case w.kind when 'outage' then 'System outage: ' else 'Client-side incident: ' end || w.reason
                from public.exclusion_window w
                where w.placement_id = s.pid and s.lead_in_at >= w.starts_at and s.lead_in_at < w.ends_at
                order by w.created_at limit 1)
        when exists (select 1 from public.shift_attendance sa
                     where sa.placement_id = s.pid and sa.status = 'excused_emergency'
                       and sa.shift_date in ((s.lead_in_at at time zone s.tz)::date, (s.lead_in_at at time zone s.tz)::date - 1))
          then 'Shift excused'
        when exists (select 1 from public.standard_dispute d
                     where d.item_kind = 'lead' and d.item_id = s.id::text and d.status = 'approved'
                       and d.operator_id = p_operator_id)
          then 'Dispute approved: ' || (select d.decision_reason from public.standard_dispute d
                                        where d.item_kind = 'lead' and d.item_id = s.id::text and d.status = 'approved'
                                          and d.operator_id = p_operator_id order by d.decided_at desc limit 1)
        when not s.met and exists (
               select 1 from public.escalation e
               where e.placement_id = s.pid and e.operator_id = p_operator_id
                 and e.response_due_at is not null
                 and coalesce(e.answered_at, now()) > e.response_due_at
                 and s.lead_in_at >= e.raised_at and s.lead_in_at < coalesce(e.answered_at, now()))
          then 'DA was late answering your escalation while this lead waited'
      end as reason
    from shaped s
  )
  select r.id, r.pid, r.lead_in_at, app.customer_short_name(r.name),
         case when r.first_touch_at is not null then round((extract(epoch from (r.first_touch_at - r.lead_in_at)) / 60.0)::numeric, 1) end,
         r.met, r.reason is null, r.reason
  from reasoned r
  order by r.lead_in_at;
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
        from (select lt.actor_kind, count(*) as n from app.touch_eff lt
              where lt.case_file_id = gl.case_file_id and lt.direction = 'outbound' and lt.occurred_at > now() - interval '24 hours'
              group by lt.actor_kind) t), '{}'::jsonb),
      'unattributed_24h', (select count(*) from app.touch_eff lt where lt.case_file_id = gl.case_file_id and lt.actor_kind = 'unattributed' and lt.occurred_at > now() - interval '24 hours'),
      'estimated_24h', (select count(*) from app.touch_eff lt where lt.case_file_id = gl.case_file_id and lt.attribution = 'estimated' and lt.occurred_at > now() - interval '24 hours'),
      'unrecognised_users', coalesce((select jsonb_agg(distinct lt.ghl_user_id) from app.touch_eff lt
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
-- ---------------------------------------------------------------------------
-- Unattributed events: what an admin sees, and how they resolve it
-- ---------------------------------------------------------------------------

create or replace function public.ghl_unattributed()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app.require('ghl.view');
  return jsonb_build_object(
    'can_manage', app.actor_allowed('ghl.access.manage'),
    'users', coalesce((
      select jsonb_agg(x order by (x ->> 'last_seen') desc) from (
        select jsonb_build_object(
          'ghl_user_id', t.ghl_user_id, 'case_file_id', t.case_file_id, 'client', app.ghl_case_name(t.case_file_id),
          'touches', count(*), 'first_seen', min(t.occurred_at), 'last_seen', max(t.occurred_at),
          'name', max(u.name), 'email', max(u.email), 'ghl_role', max(u.ghl_role), 'known_in_ghl', bool_or(u.ghl_user_id is not null)
        ) as x
        from app.touch_eff t
        left join public.ghl_user u on u.ghl_user_id = t.ghl_user_id
        where t.actor_kind = 'unattributed' and t.ghl_user_id is not null and app.ghl_can_see(t.case_file_id)
        group by t.ghl_user_id, t.case_file_id) s), '[]'::jsonb),
    -- Nothing to map: GHL named no user at all. Counted so it is visible, never guessed.
    'no_user', coalesce((
      select jsonb_agg(jsonb_build_object('case_file_id', t.case_file_id, 'client', app.ghl_case_name(t.case_file_id),
        'touches', t.n, 'last_seen', t.last_seen) order by t.last_seen desc)
      from (select t.case_file_id, count(*) as n, max(t.occurred_at) as last_seen
            from app.touch_eff t
            where t.actor_kind = 'unattributed' and t.ghl_user_id is null and t.direction = 'outbound' and app.ghl_can_see(t.case_file_id)
            group by t.case_file_id) t), '[]'::jsonb),
    'people', coalesce((
      select jsonb_agg(jsonb_build_object('profile_id', p.id, 'name', coalesce(p.full_name, p.email), 'role', p.role,
        'ghl_user_id', (select u.ghl_user_id from public.ghl_user u where u.profile_id = p.id)) order by coalesce(p.full_name, p.email))
      from public.profile p
      where p.role in ('operator', 'contractor', 'manager', 'admin', 'owner')
        and (app.is_admin() or exists (
          select 1 from public.operator o join public.placement pl on pl.operator_id = o.id
          where o.profile_id = p.id and app.in_scope_case_file(pl.case_file_id)))), '[]'::jsonb)
  );
end;
$$;

-- Resolve a GHL user: map them to a DA person, or mark them as the client's
-- staff (or agency staff). Their past unattributed touches are re-attributed
-- through the append-only overlay, and every lead they answered first has its
-- first touch and response time recomputed.
create or replace function public.ghl_resolve_user(
  p_ghl_user_id text, p_resolution text, p_profile_id uuid default null, p_case_file_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  t record;
  c record;
  v_leads uuid[] := '{}';
  v_lead uuid;
  v_touches integer := 0;
  v_case uuid;
  v_label text;
  v_day date;
begin
  perform app.require('ghl.access.manage');
  if p_resolution not in ('person', 'client_staff', 'agency_staff') then
    raise exception 'resolution_invalid: choose a person, client staff or DA staff' using errcode = '22023';
  end if;
  if coalesce(btrim(p_ghl_user_id), '') = '' then
    raise exception 'user_required' using errcode = '22023';
  end if;
  if p_case_file_id is not null and not app.ghl_can_see(p_case_file_id) then
    raise exception 'out_of_scope: that client is not in your scope' using errcode = '42501';
  end if;
  if p_resolution = 'client_staff' and p_case_file_id is null then
    raise exception 'client_required: say which client this person works for' using errcode = '22023';
  end if;
  -- Only a user that appears on touches this actor can see may be resolved.
  if not exists (select 1 from app.touch_eff x where x.ghl_user_id = p_ghl_user_id and app.ghl_can_see(x.case_file_id))
     and not exists (select 1 from public.ghl_user where ghl_user_id = p_ghl_user_id) then
    raise exception 'user_not_found: no touch from that GHL user is on record' using errcode = 'P0002';
  end if;

  insert into public.ghl_user (ghl_user_id, seen_at) values (p_ghl_user_id, now()) on conflict (ghl_user_id) do nothing;

  if p_resolution = 'person' then
    if not exists (select 1 from public.profile where id = p_profile_id and role in ('operator', 'contractor', 'manager', 'admin', 'owner')) then
      raise exception 'person_required: pick a DA person' using errcode = '22023';
    end if;
    if exists (select 1 from public.ghl_user where profile_id = p_profile_id and ghl_user_id <> p_ghl_user_id) then
      raise exception 'person_already_mapped: that person already has a different GHL user' using errcode = '23505';
    end if;
    update public.ghl_user
       set profile_id = p_profile_id, known_kind = null, known_case_file_id = null, known_marked_by = auth.uid(), known_marked_at = now()
     where ghl_user_id = p_ghl_user_id;
    select coalesce(full_name, email) into v_label from public.profile where id = p_profile_id;
  else
    update public.ghl_user
       set known_kind = p_resolution, known_case_file_id = case when p_resolution = 'client_staff' then p_case_file_id end,
           profile_id = null, known_marked_by = auth.uid(), known_marked_at = now()
     where ghl_user_id = p_ghl_user_id;
    v_label := replace(p_resolution, '_', ' ');
    update public.ghl_access_mismatch set resolved_at = now(), resolved_by = auth.uid(), resolution = 'marked ' || replace(p_resolution, '_', ' ')
     where ghl_user_id = p_ghl_user_id and resolved_at is null;
    update public.ghl_job set status = 'cancelled', finished_at = now(), last_error = 'user marked as staff'
     where kind = 'remove_extra' and payload ->> 'ghl_user_id' = p_ghl_user_id and status in ('queued', 'failed');
  end if;

  for t in
    select lt.id, lt.lead_id, lt.case_file_id, lt.occurred_at, lt.channel,
           coalesce(e.payload, '{}'::jsonb) || jsonb_build_object('userId', p_ghl_user_id) as payload
    from app.touch_eff lt
    left join public.ingest_event e on e.id = lt.ingest_event_id
    where lt.ghl_user_id = p_ghl_user_id and lt.actor_kind = 'unattributed' and lt.direction = 'outbound'
    order by lt.occurred_at
  loop
    select * into c from app.ghl_classify_touch(t.case_file_id, t.payload, t.occurred_at);
    if c.actor_kind in ('va', 'staff', 'client') and c.attribution = 'exact' then
      insert into public.lead_touch_resolution (touch_id, actor_kind, is_human, actor_profile_id, placement_id, ghl_user_id, resolved_by, reason)
      values (t.id, c.actor_kind, coalesce(c.is_human, true), c.profile_id, case when c.actor_kind = 'va' then c.placement_id end,
              p_ghl_user_id, auth.uid(), format('GHL user %s resolved as %s', p_ghl_user_id, v_label))
      on conflict (touch_id) do nothing;
      v_touches := v_touches + 1;
      if not (t.lead_id = any (v_leads)) then v_leads := v_leads || t.lead_id; end if;
    end if;
  end loop;

  foreach v_lead in array v_leads loop
    perform app.ghl_recompute_first_touch(v_lead);
    select l.case_file_id, (l.lead_in_at at time zone 'UTC')::date into v_case, v_day from public.lead l where l.id = v_lead;
    perform app.refresh_lead_rollups(v_case, v_day);
  end loop;

  perform app.audit('ghl.user_resolved', 'ghl_user', p_ghl_user_id,
    format('Resolved GHL user %s as %s; %s past touches re-attributed on %s leads', p_ghl_user_id, v_label, v_touches, coalesce(array_length(v_leads, 1), 0)),
    null, null, p_case_file_id);
  return jsonb_build_object('touches', v_touches, 'leads', coalesce(array_length(v_leads, 1), 0));
end;
$$;

revoke all on function public.ghl_unattributed() from public, anon;
revoke all on function public.ghl_resolve_user(text, text, uuid, uuid) from public, anon;
grant execute on function public.ghl_unattributed() to authenticated;
grant execute on function public.ghl_resolve_user(text, text, uuid, uuid) to authenticated;
