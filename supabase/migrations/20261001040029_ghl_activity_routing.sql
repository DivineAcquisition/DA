-- ===========================================================================
-- GHL connection layer, part 4: live activity, attribution, routing, screens
--
-- Attribution is exact or it is not made. A touch is credited to a person only
-- when GHL names the user who sent it. The shift-window guess survives only as
-- a fallback, for a human message GHL sent without a user, and is marked
-- "estimated". Automated sends never stamp first touch or response minutes.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- First touch: earliest human outbound wins, so a late-arriving earlier event
-- corrects it. Never later: overwriting with a more recent contact is what
-- makes a slow response look fast. lead_in_at follows the same rule.
-- ---------------------------------------------------------------------------

create or replace function app.stamp_earliest()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_column text;
  v_row jsonb := to_jsonb(new);
  v_was jsonb := to_jsonb(old);
begin
  -- A recompute from the touch log (below) may move the value either way.
  if current_setting('app.restamp', true) = 'on' then
    return new;
  end if;
  foreach v_column in array tg_argv loop
    if v_was -> v_column is not null and jsonb_typeof(v_was -> v_column) <> 'null'
       and (v_row -> v_column is null or jsonb_typeof(v_row -> v_column) = 'null'
            or (v_row ->> v_column)::timestamptz > (v_was ->> v_column)::timestamptz) then
      v_row := jsonb_set(v_row, array[v_column], v_was -> v_column);
    end if;
  end loop;
  return jsonb_populate_record(new, v_row);
end;
$$;

comment on function app.stamp_earliest() is
  'The named timestamps only ever move earlier, so an out-of-order event corrects them and a later one never overwrites them.';

drop trigger if exists lead_stamp_once on public.lead;
create trigger lead_stamp_once before update on public.lead
  for each row execute function app.stamp_once('first_booking_at');
drop trigger if exists lead_stamp_earliest on public.lead;
create trigger lead_stamp_earliest before update on public.lead
  for each row execute function app.stamp_earliest('lead_in_at', 'first_touch_at');

-- ---------------------------------------------------------------------------
-- Shift windows
-- ---------------------------------------------------------------------------

create or replace function app.on_shift_at(p_pl public.placement, p_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from (values ((p_at at time zone app.safe_tz(p_pl.time_zone))::date), ((p_at at time zone app.safe_tz(p_pl.time_zone))::date - 1)) d(day)
    cross join lateral app.shift_bounds(p_pl, d.day) b
    where extract(isodow from d.day)::smallint = any(p_pl.working_days) and b.starts_at <= p_at and b.ends_at > p_at
  );
$$;

-- Was not a guess before it was replaced: it now answers only when exactly one
-- placement was on shift at that moment, and null otherwise.
create or replace function app.ingest_placement_at(p_case_file_id uuid, p_at timestamptz)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select case when count(*) = 1 then (array_agg(pl.id))[1] end
  from public.placement pl
  where pl.case_file_id = p_case_file_id
    and pl.status in ('active', 'renewed', 'ended')
    and pl.start_date <= (p_at at time zone app.safe_tz(pl.time_zone))::date
    and pl.end_date >= (p_at at time zone app.safe_tz(pl.time_zone))::date - 1
    and app.on_shift_at(pl, p_at);
$$;

comment on function app.ingest_placement_at is
  'Shift-window fallback only: the one placement on shift at that moment, or null when none or several were. Callers mark what it returns as estimated.';

-- ---------------------------------------------------------------------------
-- Human or automated, and who
--
-- Signals, in order (GHL Conversations API message fields):
--   automated / isAutomated flag from a snapshot workflow  -> automated
--   source in workflow, bulk_actions, campaign, api         -> automated
--   messageType TYPE_CAMPAIGN_*                             -> automated
--   userId present                                          -> human, exact
--   source = app (sent from the GHL web or mobile app)      -> human, no user
--   none of these                                           -> unknown, not stamped
-- ---------------------------------------------------------------------------

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
  v_user text := app.jsonb_first(p_payload, 'userId', 'message.userId', 'user.id', 'sentBy');
  u public.ghl_user;
  p public.profile;
  v_pl uuid;
begin
  message_source := v_source;
  if v_flag in ('true', '1', 'yes') then
    return query select false, 'automated', 'exact', v_user, null::uuid, null::uuid, 'automated flag', v_source; return;
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

-- Recompute a lead's first touch from its touch log: earliest human outbound
-- message (notes are internal and never count).
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
  from public.lead_touch lt
  where lt.lead_id = p_lead_id and lt.direction = 'outbound' and lt.channel <> 'note'
    and (lt.is_human or (lt.is_human is null and lt.actor_kind is null))
  order by lt.occurred_at limit 1;
  perform set_config('app.restamp', 'on', true);
  update public.lead
     set first_touch_at = t.occurred_at, first_touch_profile_id = t.actor_profile_id, first_touch_kind = t.actor_kind
   where id = p_lead_id
     and (first_touch_at is distinct from t.occurred_at or first_touch_profile_id is distinct from t.actor_profile_id);
  perform set_config('app.restamp', 'off', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Handlers, extended
-- ---------------------------------------------------------------------------

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
    v_lead.id, e.case_file_id, coalesce(c.placement_id, case when c.attribution = 'exact' then null else v_lead.placement_id end),
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

create or replace function app.ingest_handle_lead(p_event_id uuid)
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
  v_lead_id uuid;
  v_new boolean;
  v_old_day date;
begin
  select * into e from public.ingest_event where id = p_event_id;
  v_contact := app.ingest_contact_ref(e.payload);
  if v_contact is null then
    raise exception 'no_contact_id: the payload names no contact, so there is no lead to key on'
      using errcode = '22023';
  end if;
  v_at := coalesce(
    app.ingest_ts(app.jsonb_first(e.payload,
      'contact.dateAdded', 'dateAdded', 'date_created', 'createdAt', 'timestamp')),
    e.received_at
  );
  select (lead_in_at at time zone 'UTC')::date into v_old_day from public.lead
  where case_file_id = e.case_file_id and external_id = v_contact;

  insert into public.lead (
    case_file_id, placement_id, placement_basis, external_id, name, email, phone, source,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content,
    lead_in_at, first_ingest_event_id
  )
  values (
    e.case_file_id,
    app.ingest_placement_at(e.case_file_id, v_at),
    case when app.ingest_placement_at(e.case_file_id, v_at) is not null then 'estimated' end,
    v_contact,
    app.ingest_contact_name(e.payload),
    lower(app.jsonb_first(e.payload, 'contact.email', 'email', 'customer.email')),
    app.jsonb_first(e.payload, 'contact.phone', 'phone', 'customer.phone'),
    app.jsonb_first(e.payload, 'contact.source', 'source', 'contact.attributionSource.medium'),
    app.jsonb_first(e.payload, 'contact.attributionSource.utmSource', 'attributionSource.utmSource', 'utm_source', 'utmSource'),
    app.jsonb_first(e.payload, 'contact.attributionSource.medium', 'attributionSource.medium', 'utm_medium', 'utmMedium'),
    app.jsonb_first(e.payload, 'contact.attributionSource.campaign', 'attributionSource.campaign', 'utm_campaign', 'utmCampaign'),
    app.jsonb_first(e.payload, 'contact.attributionSource.utmTerm', 'utm_term', 'utmTerm'),
    app.jsonb_first(e.payload, 'contact.attributionSource.utmContent', 'utm_content', 'utmContent'),
    v_at,
    e.id
  )
  on conflict (case_file_id, external_id) do update
    set name = coalesce(excluded.name, public.lead.name),
        email = coalesce(excluded.email, public.lead.email),
        phone = coalesce(excluded.phone, public.lead.phone),
        -- Earliest wins (see the trigger), so a ContactCreate arriving after
        -- the first message still sets the real lead-in time.
        lead_in_at = excluded.lead_in_at,
        source = coalesce(public.lead.source, excluded.source),
        utm_source = coalesce(public.lead.utm_source, excluded.utm_source),
        utm_medium = coalesce(public.lead.utm_medium, excluded.utm_medium),
        utm_campaign = coalesce(public.lead.utm_campaign, excluded.utm_campaign),
        utm_term = coalesce(public.lead.utm_term, excluded.utm_term),
        utm_content = coalesce(public.lead.utm_content, excluded.utm_content)
  returning id, (xmax = 0) into v_lead_id, v_new;
  select * into v_lead from public.lead where id = v_lead_id;

  if e.event_type in ('InboundMessage', 'lead.inbound') then
    insert into public.lead_touch (lead_id, case_file_id, placement_id, channel, direction, occurred_at, ingest_event_id, actor_kind, attribution, is_human)
    values (
      v_lead.id, e.case_file_id, v_lead.placement_id,
      coalesce(app.jsonb_first(e.payload, 'messageType', 'message.type', 'channel'), 'message'),
      'inbound', v_at, e.id, 'customer', 'exact', true
    );
  end if;

  -- A new lead nobody has touched yet is routed.
  if v_new and v_lead.first_touch_at is null then
    perform app.route_lead(v_lead.id, 'initial');
  end if;

  perform app.refresh_lead_rollups(e.case_file_id, (v_lead.lead_in_at at time zone 'UTC')::date);
  if v_old_day is not null and v_old_day <> (v_lead.lead_in_at at time zone 'UTC')::date then
    perform app.refresh_lead_rollups(e.case_file_id, v_old_day);
  end if;
  return format('lead %s%s', v_lead.id, case when v_new then ' (new, routed)' else '' end);
end;
$$;

-- Rollups: a lead held in the after-hours queue is never counted against anyone.
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
    l.placement_id,
    p_day,
    count(*),
    count(*) filter (
      where l.response_minutes is not null
        and l.response_minutes <= coalesce(pl.response_standard_minutes, 5)
    )
  from public.lead l
  join public.placement pl on pl.id = l.placement_id
  where l.case_file_id = p_case_file_id
    and (l.lead_in_at at time zone 'UTC')::date = p_day
    and l.counts_toward_response
  group by l.placement_id
  on conflict (placement_id, day) do update
    set conversations = excluded.conversations,
        within_standard = excluded.within_standard;
end;
$$;

-- ---------------------------------------------------------------------------
-- Messages read by the conversation poller (service role)
--
-- A Private Integration Token cannot subscribe to GHL webhook events (that is
-- a Marketplace app feature), and a workflow has no "message sent by a user"
-- trigger. The poller reads the Conversations API, which names the sending
-- user and the source of every message, and logs each one here the same way a
-- webhook delivery is logged: raw first, deduplicated on the message id, then
-- dispatched to the existing handlers.
-- ---------------------------------------------------------------------------

create or replace function public.ghl_ingest_polled(p_case_file_id uuid, p_events jsonb, p_cursor timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.ghl_location;
  ev jsonb;
  v_event public.ingest_event;
  v_new integer := 0;
  v_dupe integer := 0;
  v_type text;
begin
  select * into v_link from public.ghl_location where case_file_id = p_case_file_id;
  if v_link.case_file_id is null then
    raise exception 'not_linked' using errcode = 'P0002';
  end if;

  for ev in select * from jsonb_array_elements(coalesce(p_events, '[]'::jsonb)) loop
    v_type := coalesce(ev ->> 'type', case lower(ev ->> 'direction') when 'inbound' then 'InboundMessage' else 'OutboundMessage' end);
    insert into public.ingest_event (provider, endpoint_id, dedupe_key, external_event_id, raw_body, payload, headers,
      event_type, account_ref, case_file_id, status)
    values ('gohighlevel', v_link.ingest_endpoint_id, coalesce(ev ->> 'messageId', 'sha256:' || encode(extensions.digest(ev::text, 'sha256'), 'hex')),
      ev ->> 'messageId', ev::text, ev || jsonb_build_object('type', v_type, 'locationId', v_link.location_id),
      jsonb_build_object('x-da-source', 'conversation-poll'), v_type, v_link.location_id, p_case_file_id, 'received')
    on conflict (provider, dedupe_key) do nothing
    returning * into v_event;
    if v_event.id is null then
      v_dupe := v_dupe + 1;
    else
      v_new := v_new + 1;
      perform app.ingest_dispatch(v_event.id);
    end if;
  end loop;

  update public.ghl_location set polled_at = now(), poll_cursor = coalesce(greatest(poll_cursor, p_cursor), p_cursor, poll_cursor)
   where case_file_id = p_case_file_id;
  if v_link.ingest_endpoint_id is not null and v_new > 0 then
    update public.ingest_endpoint set last_event_at = now() where id = v_link.ingest_endpoint_id;
  end if;
  return jsonb_build_object('new', v_new, 'duplicate', v_dupe);
end;
$$;

-- ---------------------------------------------------------------------------
-- Per-client activity endpoint (webhook door for the snapshot workflows)
-- ---------------------------------------------------------------------------

create or replace function public.ghl_setup_activity_endpoint(p_case_file_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.ghl_location;
  v_result jsonb;
  v_key text;
begin
  perform app.require('ghl.connections.manage');
  perform app.require_step_up('set up GHL live activity');
  select * into v_link from public.ghl_location where case_file_id = p_case_file_id;
  if v_link.case_file_id is null then
    raise exception 'not_linked: link the client to its GHL sub-account first' using errcode = 'P0002';
  end if;

  if v_link.ingest_endpoint_id is null then
    v_result := public.register_ingest_endpoint('gohighlevel', format('GHL live activity: %s', app.ghl_case_name(p_case_file_id)), p_case_file_id, 'shared_secret');
    update public.ghl_location set ingest_endpoint_id = (v_result ->> 'id')::uuid where case_file_id = p_case_file_id;
    v_key := v_result ->> 'key';
  else
    -- Already open: a new secret is the only way to see one again.
    v_result := public.rotate_ingest_secret(v_link.ingest_endpoint_id);
    select key into v_key from public.ingest_endpoint where id = v_link.ingest_endpoint_id;
  end if;

  return jsonb_build_object('endpoint_id', coalesce(v_result ->> 'id', v_link.ingest_endpoint_id::text),
    'path', '/api/webhooks/ghl/' || v_key, 'secret', v_result ->> 'secret', 'header', 'x-vistrial-secret');
end;
$$;

-- ---------------------------------------------------------------------------
-- Routing
-- ---------------------------------------------------------------------------

create or replace function app.ghl_routing(p_case_file_id uuid)
returns public.ghl_routing_setting
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select s from public.ghl_routing_setting s where s.case_file_id = p_case_file_id),
    row(p_case_file_id, true, 4, 8, 8, false, 15, 180, null, now())::public.ghl_routing_setting
  );
$$;

-- An in-app ping. Never emailed: a lead alert is only useful in the app, and
-- nothing about the customer leaves it.
create or replace function app.ghl_ping_operator(p_operator_id uuid, p_kind text, p_title text, p_body text, p_placement_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  v_id := app.notify_operator(p_operator_id, p_kind, 'urgent', p_title, p_body, '/vistrial/operator', 'normal', null, p_placement_id, false);
  update public.operator_notification set email_claimed_at = now() where id = v_id;
  insert into public.notification_attempt (notification_id, channel, status, attempted_at, detail)
  values (v_id, 'email', 'skipped', now(), 'In-app only: routing alerts never leave the app');
  return v_id;
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
    if v_on_shift = 0 then
      v_state := 'after_hours';
      v_reason := 'Nobody on shift: held in the after-hours queue for the next shift start, and not counted against anyone';
    else
      v_state := 'no_one_eligible';
      v_reason := 'VAs are on shift but none is eligible (see each one''s reason). Waiting for one to become eligible';
    end if;
    insert into public.lead_routing (lead_id, case_file_id, state, placement_id, operator_id, assigned_at, owner_state)
    values (l.id, l.case_file_id, v_state, null, null, null, 'not_needed')
    on conflict (lead_id) do update set state = case when public.lead_routing.state = 'touched' then 'touched' else excluded.state end;
    if v_state = 'after_hours' then
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

-- ---------------------------------------------------------------------------
-- The minute sweep: escalations, after-hours release, access sync, silence
-- and rotation reminders. pg_cron, every minute.
-- ---------------------------------------------------------------------------

create or replace function app.ghl_minute_sweep()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  s public.ghl_routing_setting;
  v_reminded integer := 0;
  v_escalated integer := 0;
  v_released integer := 0;
  v_reassigned integer := 0;
  v_mgrs uuid[];
  v_last timestamptz;
begin
  -- Touched leads close.
  update public.lead_routing lr set state = 'touched', touched_at = coalesce(lr.touched_at, l.first_touch_at)
  from public.lead l
  where l.id = lr.lead_id and l.first_touch_at is not null and lr.state in ('assigned', 'reassigned', 'after_hours', 'no_one_eligible');

  -- Escalation: remind the VA, then alert the manager. Reassign only when an
  -- admin turned it on for that client.
  for r in
    select lr.*, l.case_file_id as cf from public.lead_routing lr join public.lead l on l.id = lr.lead_id
    where lr.state in ('assigned', 'reassigned') and lr.assigned_at > now() - interval '24 hours'
  loop
    s := app.ghl_routing(r.cf);
    if s.auto_reassign and now() - r.assigned_at >= make_interval(mins => s.reassign_after_minutes) then
      perform app.route_lead(r.lead_id, 'reassign', r.placement_id);
      v_reassigned := v_reassigned + 1;
      continue;
    end if;
    if r.reminded_at is null and now() - r.assigned_at >= make_interval(mins => s.remind_after_minutes) then
      perform app.ghl_ping_operator(r.operator_id, 'lead_reminder', 'A lead is waiting for you',
        format('A lead for %s has waited %s minutes without a reply. Respond now.', app.ghl_case_name(r.cf),
          floor(extract(epoch from now() - r.assigned_at) / 60)::integer), r.placement_id);
      update public.lead_routing set reminded_at = now() where lead_id = r.lead_id;
      v_reminded := v_reminded + 1;
    end if;
    if r.manager_alerted_at is null and now() - r.assigned_at >= make_interval(mins => s.manager_after_minutes) then
      v_mgrs := app.placement_manager_ids(r.placement_id);
      if coalesce(array_length(v_mgrs, 1), 0) = 0 then v_mgrs := app.admin_recipient_ids(); end if;
      perform app.notify_staff(v_mgrs, 'lead_unanswered', 'urgent',
        format('Lead unanswered for %s minutes on %s', floor(extract(epoch from now() - r.assigned_at) / 60)::integer, app.ghl_case_name(r.cf)),
        format('%s was reminded and has not replied. %s',
          coalesce((select name from public.operator where id = r.operator_id), 'The VA'),
          case when s.auto_reassign then 'It will be reassigned automatically.' else 'Reassign it from the routing log if needed.' end),
        r.operator_id);
      update public.lead_routing set manager_alerted_at = now() where lead_id = r.lead_id;
      v_escalated := v_escalated + 1;
    end if;
  end loop;

  -- The after-hours queue and leads nobody was eligible for: assigned when a
  -- shift starts or someone becomes eligible. After-hours leads still never
  -- count against anyone.
  for r in
    select lr.lead_id, lr.state from public.lead_routing lr
    where lr.state in ('after_hours', 'no_one_eligible') and lr.created_at > now() - interval '7 days'
    order by lr.created_at
  loop
    if exists (
      select 1 from public.placement pl join public.lead l on l.case_file_id = pl.case_file_id
      where l.id = r.lead_id and pl.status = 'active' and app.on_shift_now(pl)
    ) then
      if (app.route_lead(r.lead_id, case when r.state = 'after_hours' then 'after_hours_release' else 'initial' end) ->> 'state') = 'assigned' then
        v_released := v_released + 1;
      end if;
    end if;
  end loop;

  -- Same-day removal when a placement's end date passes, and anything else the
  -- triggers did not see.
  perform app.ghl_sync_access(null);

  -- Silence during business hours: no activity from a connected client while
  -- one of its VAs is on shift.
  for r in
    select gl.*, rs.silence_alert_minutes from public.ghl_location gl
    join public.ghl_connection c on c.case_file_id = gl.case_file_id and c.retired_at is null and c.replaces_id is null and c.status in ('healthy', 'degraded')
    left join public.ghl_routing_setting rs on rs.case_file_id = gl.case_file_id
  loop
    if not exists (select 1 from public.placement pl where pl.case_file_id = r.case_file_id and pl.status = 'active' and app.on_shift_now(pl)) then
      continue;
    end if;
    select max(received_at) into v_last from public.ingest_event where case_file_id = r.case_file_id;
    if coalesce(v_last, r.linked_at) < now() - make_interval(mins => coalesce(r.silence_alert_minutes, 180))
       and (r.silence_alerted_at is null or r.silence_alerted_at < coalesce(v_last, r.linked_at)) then
      perform app.notify_staff(app.case_file_manager_ids(r.case_file_id) || app.admin_recipient_ids(), 'ghl.silence', 'important',
        format('No live activity from %s', app.ghl_case_name(r.case_file_id)),
        format('Nothing has arrived from GHL for %s in %s minutes during business hours. Check the activity health view.',
          app.ghl_case_name(r.case_file_id), floor(extract(epoch from now() - coalesce(v_last, r.linked_at)) / 60)::integer), null);
      update public.ghl_location set silence_alerted_at = now() where case_file_id = r.case_file_id;
    end if;
  end loop;

  -- Rotation reminders: two weeks before due, then weekly until rotated.
  for r in
    select * from public.ghl_connection
    where retired_at is null and replaces_id is null
      and token_created_on + rotation_interval_days - 14 <= current_date
      and (rotation_reminded_at is null or rotation_reminded_at < now() - interval '7 days')
  loop
    perform app.ghl_alert_admins('ghl.rotation_due', 'GHL token rotation due',
      format('The token for %s (ending %s) was created %s and is due for rotation by %s. Rotate it in GHL Connections; the new token is tested before the old one is retired.',
        case when r.level = 'agency' then 'the agency connection' else app.ghl_case_name(r.case_file_id) end,
        r.token_last4, r.token_created_on, r.token_created_on + r.rotation_interval_days));
    update public.ghl_connection set rotation_reminded_at = now() where id = r.id;
  end loop;

  return jsonb_build_object('reminded', v_reminded, 'escalated', v_escalated, 'released', v_released, 'reassigned', v_reassigned);
end;
$$;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'ghl-minute-sweep') then
    perform cron.unschedule('ghl-minute-sweep');
  end if;
  perform cron.schedule('ghl-minute-sweep', '* * * * *', 'select app.ghl_minute_sweep()');
end $$;

-- ---------------------------------------------------------------------------
-- Routing settings and manual assignment
-- ---------------------------------------------------------------------------

create or replace function public.ghl_save_routing(
  p_case_file_id uuid, p_enabled boolean, p_remind_after integer, p_manager_after integer,
  p_max_open integer, p_auto_reassign boolean, p_reassign_after integer, p_silence_minutes integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.require('ghl.routing.manage');
  insert into public.ghl_routing_setting (case_file_id, enabled, remind_after_minutes, manager_after_minutes, max_open_leads,
    auto_reassign, reassign_after_minutes, silence_alert_minutes, updated_by, updated_at)
  values (p_case_file_id, p_enabled, p_remind_after, p_manager_after, p_max_open, p_auto_reassign, p_reassign_after, p_silence_minutes, auth.uid(), now())
  on conflict (case_file_id) do update
    set enabled = excluded.enabled, remind_after_minutes = excluded.remind_after_minutes,
        manager_after_minutes = excluded.manager_after_minutes, max_open_leads = excluded.max_open_leads,
        auto_reassign = excluded.auto_reassign, reassign_after_minutes = excluded.reassign_after_minutes,
        silence_alert_minutes = excluded.silence_alert_minutes, updated_by = auth.uid(), updated_at = now();
  perform app.audit('ghl.routing_changed', 'ghl_routing_setting', p_case_file_id::text,
    format('Changed lead routing for %s (remind %s min, manager %s min, auto-reassign %s)', app.ghl_case_name(p_case_file_id),
      p_remind_after, p_manager_after, case when p_auto_reassign then 'on' else 'off' end), null, null, p_case_file_id);
end;
$$;

create or replace function public.ghl_reroute_lead(p_lead_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_case uuid;
  v_current uuid;
begin
  perform app.require('ghl.routing.manage');
  select case_file_id into v_case from public.lead where id = p_lead_id;
  if v_case is null or not (app.is_admin() or app.in_scope_case_file(v_case)) then
    raise exception 'lead_not_found' using errcode = 'P0002';
  end if;
  select placement_id into v_current from public.lead_routing where lead_id = p_lead_id;
  return app.route_lead(p_lead_id, 'manual', v_current, auth.uid());
end;
$$;

-- ---------------------------------------------------------------------------
-- Screen reads. Permission first; managers see their scope only.
-- ---------------------------------------------------------------------------

create or replace function app.ghl_can_see(p_case_file_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select app.is_admin() or app.in_scope_case_file(p_case_file_id); $$;

create or replace function app.ghl_connection_json(c public.ghl_connection)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when c.id is null then null else jsonb_build_object(
    'id', c.id, 'level', c.level, 'label', c.label, 'auth_kind', c.auth_kind, 'last4', c.token_last4,
    'location_id', c.location_id, 'company_id', c.company_id, 'status', c.status,
    'scopes_present', to_jsonb(c.scopes_present), 'scopes_missing', to_jsonb(c.scopes_missing),
    'last_checked_at', c.last_checked_at, 'last_success_at', c.last_success_at, 'last_failure_at', c.last_failure_at,
    'last_error', c.last_error, 'paused_reason', c.paused_reason, 'token_created_on', c.token_created_on,
    'rotation_interval_days', c.rotation_interval_days, 'rotation_due_on', c.token_created_on + c.rotation_interval_days,
    'next_check_at', c.next_check_at, 'check_requested', c.check_requested_at is not null,
    'candidate', (select jsonb_build_object('id', x.id, 'last4', x.token_last4, 'status', x.status, 'created_at', x.created_at)
                  from public.ghl_connection x where x.replaces_id = c.id and x.retired_at is null)
  ) end;
$$;

create or replace function public.ghl_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app.require('ghl.view');
  return jsonb_build_object(
    'can_manage', app.actor_allowed('ghl.connections.manage'),
    'agency', app.ghl_connection_json(app.ghl_live_connection(null)),
    'required_scopes', jsonb_build_object('agency', to_jsonb(app.ghl_required_scopes('agency')), 'location', to_jsonb(app.ghl_required_scopes('location'))),
    'clients', coalesce((
      select jsonb_agg(jsonb_build_object(
        'case_file_id', cf.id, 'name', cf.name, 'status', cf.status,
        'location_id', gl.location_id, 'location_name', gl.location_name, 'is_test', coalesce(gl.is_test, false),
        'connection', app.ghl_connection_json(app.ghl_live_connection(cf.id)),
        'readiness', app.ghl_readiness(cf.id),
        'drift', coalesce(gl.mapping_drift, 0) + coalesce(gl.mapping_missing, 0),
        'endpoint', gl.ingest_endpoint_id is not null,
        'last_event_at', (select max(received_at) from public.ingest_event e where e.case_file_id = cf.id),
        'open_mismatches', (select count(*) from public.ghl_access_mismatch m where m.case_file_id = cf.id and m.resolved_at is null),
        'pending_access', (select count(*) from public.ghl_access_grant g where g.case_file_id = cf.id and g.state in ('pending', 'failed', 'revoking'))
      ) order by cf.name)
      from public.client_case_file cf
      left join public.ghl_location gl on gl.case_file_id = cf.id
      where app.ghl_can_see(cf.id) and (gl.case_file_id is not null or cf.status <> 'ended')
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.ghl_case_file_detail(p_case_file_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  gl public.ghl_location;
  ep public.ingest_endpoint;
begin
  perform app.require('ghl.view');
  if not app.ghl_can_see(p_case_file_id) then
    raise exception 'out_of_scope: that client is not in your scope' using errcode = '42501';
  end if;
  select * into gl from public.ghl_location where case_file_id = p_case_file_id;
  select * into ep from public.ingest_endpoint where id = gl.ingest_endpoint_id;
  return jsonb_build_object(
    'case_file_id', p_case_file_id, 'name', app.ghl_case_name(p_case_file_id),
    'can_manage', app.actor_allowed('ghl.connections.manage'),
    'can_manage_access', app.actor_allowed('ghl.access.manage'),
    'can_manage_routing', app.actor_allowed('ghl.routing.manage'),
    'location', case when gl.case_file_id is null then null else jsonb_build_object(
      'location_id', gl.location_id, 'location_name', gl.location_name, 'time_zone', gl.location_time_zone,
      'is_test', gl.is_test, 'mapping_checked_at', gl.mapping_checked_at, 'users_checked_at', gl.users_checked_at,
      'polled_at', gl.polled_at, 'a2p_recorded_at', gl.a2p_recorded_at, 'a2p_reference', gl.a2p_reference) end,
    'connection', app.ghl_connection_json(app.ghl_live_connection(p_case_file_id)),
    'readiness', app.ghl_readiness(p_case_file_id),
    'mapping', coalesce((
      select jsonb_agg(jsonb_build_object('kind', s.kind, 'name', s.name, 'parent', s.parent_name, 'position', s.position,
        'field_type', s.field_type, 'status', coalesce(m.status, 'unchecked'), 'ghl_id', m.ghl_id, 'detail', m.detail)
        order by s.kind, s.parent_name nulls first, s.position nulls last, s.name)
      from public.ghl_standard_item s
      left join public.ghl_location_map m on m.standard_item_id = s.id and m.case_file_id = p_case_file_id
      where s.active), '[]'::jsonb),
    'endpoint', case when ep.id is null then null else jsonb_build_object('id', ep.id, 'path', '/api/webhooks/ghl/' || ep.key,
      'active', ep.active, 'last_event_at', ep.last_event_at, 'rotated_at', ep.rotated_at, 'header', 'x-vistrial-secret') end,
    'routing', to_jsonb(app.ghl_routing(p_case_file_id)),
    'access', coalesce((
      select jsonb_agg(jsonb_build_object('grant_id', g.id, 'profile_id', g.profile_id, 'name', coalesce(p.full_name, p.email),
        'role', p.role, 'reason', g.reason, 'state', g.state, 'ghl_user_id', g.ghl_user_id, 'granted_at', g.granted_at,
        'revoke_reason', g.revoke_reason, 'last_error', g.last_error, 'verify_manually', to_jsonb(g.verify_manually))
        order by g.state, p.full_name)
      from public.ghl_access_grant g join public.profile p on p.id = g.profile_id
      where g.case_file_id = p_case_file_id and (g.state <> 'revoked' or g.revoked_at > now() - interval '14 days')), '[]'::jsonb),
    'ghl_users', coalesce((
      select jsonb_agg(jsonb_build_object('ghl_user_id', u.ghl_user_id, 'name', u.name, 'email', u.email, 'role', u.ghl_role,
        'type', u.ghl_type, 'known_kind', u.known_kind, 'created_by_app', u.created_by_app,
        'da_person', (select coalesce(full_name, email) from public.profile where id = u.profile_id)) order by u.name)
      from public.ghl_user_location ul join public.ghl_user u on u.ghl_user_id = ul.ghl_user_id
      where ul.location_id = gl.location_id), '[]'::jsonb),
    'mismatches', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'kind', m.kind, 'detail', m.detail, 'found_at', m.found_at,
        'ghl_user_id', m.ghl_user_id, 'resolution', m.resolution) order by m.found_at desc)
      from public.ghl_access_mismatch m where m.case_file_id = p_case_file_id and m.resolved_at is null), '[]'::jsonb),
    'changes', coalesce((
      select jsonb_agg(x order by x.at desc) from (
        select c.at, c.action, c.outcome, c.detail, c.actor_label, (select coalesce(full_name, email) from public.profile where id = c.profile_id) as person
        from public.ghl_user_change c where c.case_file_id = p_case_file_id order by c.at desc limit 25) x), '[]'::jsonb),
    'requests', coalesce((
      select jsonb_agg(x order by x.at desc) from (
        select r.at, r.method, r.path, r.purpose, r.status_code, r.outcome, r.duration_ms, r.burst_remaining, r.daily_remaining, r.error
        from public.ghl_request_log r where r.case_file_id = p_case_file_id order by r.at desc limit 25) x), '[]'::jsonb)
  );
end;
$$;

create or replace function public.ghl_access_overview()
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
    'people', coalesce((
      select jsonb_agg(x order by x->>'name') from (
        select jsonb_build_object(
          'profile_id', p.id, 'name', coalesce(p.full_name, p.email), 'email', p.email, 'role', p.role,
          'state', app.effective_state(p.id), 'barrier', app.ghl_access_barrier(p.id),
          'ghl_user_id', u.ghl_user_id, 'admin_optin', exists (select 1 from public.ghl_access_optin o where o.profile_id = p.id),
          'blocked', exists (select 1 from public.ghl_access_block b where b.profile_id = p.id),
          'should_have', coalesce((select jsonb_agg(jsonb_build_object('case_file_id', s.case_file_id, 'name', app.ghl_case_name(s.case_file_id), 'reason', s.reason))
                                    from app.ghl_should_have(p.id) s), '[]'::jsonb),
          'grants', coalesce((select jsonb_agg(jsonb_build_object('grant_id', g.id, 'case_file_id', g.case_file_id, 'name', app.ghl_case_name(g.case_file_id), 'state', g.state, 'last_error', g.last_error))
                              from public.ghl_access_grant g where g.profile_id = p.id and g.state <> 'revoked'), '[]'::jsonb),
          'has', coalesce((select jsonb_agg(jsonb_build_object('case_file_id', gl.case_file_id, 'name', app.ghl_case_name(gl.case_file_id)))
                           from public.ghl_user_location ul join public.ghl_location gl on gl.location_id = ul.location_id
                           where ul.ghl_user_id = u.ghl_user_id), '[]'::jsonb)
        ) as x
        from public.profile p
        left join public.ghl_user u on u.profile_id = p.id
        where p.role in ('owner', 'admin', 'manager', 'operator', 'contractor')
          and (app.is_admin() or exists (select 1 from public.ghl_access_grant g where g.profile_id = p.id and app.in_scope_case_file(g.case_file_id)))
          and (u.ghl_user_id is not null or exists (select 1 from public.ghl_access_grant g where g.profile_id = p.id)
               or exists (select 1 from app.ghl_should_have(p.id)) or p.role in ('owner', 'admin'))
      ) t), '[]'::jsonb),
    'mismatches', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'case_file_id', m.case_file_id, 'client', app.ghl_case_name(m.case_file_id),
        'kind', m.kind, 'detail', m.detail, 'found_at', m.found_at, 'resolution', m.resolution, 'ghl_user_id', m.ghl_user_id) order by m.found_at desc)
      from public.ghl_access_mismatch m where m.resolved_at is null and app.ghl_can_see(m.case_file_id)), '[]'::jsonb),
    'jobs', coalesce((
      select jsonb_agg(x order by x.created_at desc) from (
        select j.id, j.kind, j.status, j.attempts, j.last_error, j.created_at, j.next_attempt_at, app.ghl_case_name(j.case_file_id) as client
        from public.ghl_job j where j.status in ('queued', 'running', 'failed', 'dead') and (j.case_file_id is null or app.ghl_can_see(j.case_file_id))
        order by j.created_at desc limit 50) x), '[]'::jsonb),
    'profiles', coalesce((select jsonb_agg(jsonb_build_object('key', key, 'label', label, 'ghl_role', ghl_role, 'permissions', permissions,
        'verify_manually', to_jsonb(verify_manually), 'updated_at', updated_at)) from public.ghl_permission_profile), '[]'::jsonb)
  );
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
      where lr.state in ('after_hours', 'no_one_eligible') and app.ghl_can_see(lr.case_file_id)
        and (p_case_file_id is null or lr.case_file_id = p_case_file_id)), '[]'::jsonb)
  );
end;
$$;

create or replace function public.ghl_standard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app.require('ghl.view');
  return jsonb_build_object(
    'can_manage', app.actor_allowed('ghl.standard.manage'),
    'items', coalesce((select jsonb_agg(to_jsonb(s) order by s.kind, s.parent_name nulls first, s.position nulls last, s.name) from public.ghl_standard_item s), '[]'::jsonb),
    'profiles', coalesce((select jsonb_agg(jsonb_build_object('key', key, 'label', label, 'ghl_role', ghl_role, 'ghl_type', ghl_type,
        'permissions', permissions, 'verify_manually', to_jsonb(verify_manually))) from public.ghl_permission_profile), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- VA: access status per client on My Day, and the leads routed to them.
-- ---------------------------------------------------------------------------

create or replace function public.portal_ghl()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_op public.operator := app.portal_operator();
begin
  return jsonb_build_object(
    'clients', coalesce((
      select jsonb_agg(jsonb_build_object(
        'case_file_id', pl.case_file_id, 'client', app.ghl_case_name(pl.case_file_id),
        'location_id', gl.location_id,
        'state', case
          when gl.case_file_id is null then 'not_connected'
          when g.state = 'active' then 'ready'
          when g.state in ('pending', 'failed') then 'pending'
          when g.state = 'revoking' then 'removing'
          else 'none' end,
        'connection_ok', coalesce((app.ghl_live_connection(pl.case_file_id)).status in ('healthy', 'degraded'), false)
      ) order by app.ghl_case_name(pl.case_file_id))
      from public.placement pl
      left join public.ghl_location gl on gl.case_file_id = pl.case_file_id
      left join public.ghl_access_grant g on g.profile_id = v_op.profile_id and g.case_file_id = pl.case_file_id and g.state <> 'revoked'
      where pl.operator_id = v_op.id and pl.status = 'active' and pl.end_date >= current_date), '[]'::jsonb),
    'leads', coalesce((
      select jsonb_agg(jsonb_build_object('lead_id', l.id, 'name', l.name, 'client', app.ghl_case_name(l.case_file_id),
        'assigned_at', lr.assigned_at, 'minutes_waiting', floor(extract(epoch from now() - lr.assigned_at) / 60)::integer,
        'reminded', lr.reminded_at is not null, 'contact_id', l.external_id, 'location_id', gl.location_id,
        'standard_minutes', coalesce(pl.response_standard_minutes, 5)) order by lr.assigned_at)
      from public.lead_routing lr
      join public.lead l on l.id = lr.lead_id
      join public.placement pl on pl.id = lr.placement_id
      left join public.ghl_location gl on gl.case_file_id = l.case_file_id
      where lr.operator_id = v_op.id and lr.state in ('assigned', 'reassigned') and lr.assigned_at > now() - interval '24 hours'), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants of execute
-- ---------------------------------------------------------------------------

revoke all on function public.ghl_ingest_polled(uuid, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.ghl_ingest_polled(uuid, jsonb, timestamptz) to service_role;

revoke all on function public.ghl_setup_activity_endpoint(uuid) from public, anon;
revoke all on function public.ghl_save_routing(uuid, boolean, integer, integer, integer, boolean, integer, integer) from public, anon;
revoke all on function public.ghl_reroute_lead(uuid) from public, anon;
revoke all on function public.ghl_overview() from public, anon;
revoke all on function public.ghl_case_file_detail(uuid) from public, anon;
revoke all on function public.ghl_access_overview() from public, anon;
revoke all on function public.ghl_activity_health() from public, anon;
revoke all on function public.ghl_routing_log(uuid, integer) from public, anon;
revoke all on function public.ghl_standard() from public, anon;
revoke all on function public.portal_ghl() from public, anon;
grant execute on function public.ghl_setup_activity_endpoint(uuid) to authenticated;
grant execute on function public.ghl_save_routing(uuid, boolean, integer, integer, integer, boolean, integer, integer) to authenticated;
grant execute on function public.ghl_reroute_lead(uuid) to authenticated;
grant execute on function public.ghl_overview() to authenticated;
grant execute on function public.ghl_case_file_detail(uuid) to authenticated;
grant execute on function public.ghl_access_overview() to authenticated;
grant execute on function public.ghl_activity_health() to authenticated;
grant execute on function public.ghl_routing_log(uuid, integer) to authenticated;
grant execute on function public.ghl_standard() to authenticated;
grant execute on function public.portal_ghl() to authenticated;
