-- Placement wizard, vertical templates, launch checklist, and lifecycle.
-- A template only prefills a draft. The draft is the same placement row the
-- workspace already uses. Activation is a separate, checklist-gated step.

create table public.placement_template (
  slug text primary key,
  name text not null,
  vertical text not null,
  speed_tracked boolean not null default true,
  categories text[] not null,
  outcomes jsonb not null,
  offer_outline jsonb not null default '{}'::jsonb,
  ghl_suggestions jsonb not null default '{}'::jsonb,
  first_day jsonb not null,
  report_defaults jsonb not null,
  active boolean not null default true,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

create table public.placement_wizard (
  id uuid primary key default gen_random_uuid(),
  placement_id uuid unique references public.placement (id) on delete cascade,
  step integer not null default 1 check (step between 1 and 10),
  template_slug text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'activated')),
  scheduled_for date,
  pending_schedule jsonb,
  pending_on date,
  end_on date,
  pause_return date,
  created_by uuid,
  updated_at timestamptz not null default now()
);

create table public.placement_launch_waiver (
  placement_id uuid not null references public.placement (id) on delete cascade,
  item text not null,
  reason text not null,
  waived_by uuid,
  waived_at timestamptz not null default now(),
  primary key (placement_id, item)
);

create table public.placement_mail_job (
  id uuid primary key default gen_random_uuid(),
  placement_id uuid references public.placement (id) on delete cascade,
  kind text not null,
  send_on date not null default current_date,
  payload jsonb not null default '{}'::jsonb,
  claimed_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (placement_id, kind)
);

create index placement_mail_due_idx on public.placement_mail_job (send_on) where sent_at is null;

comment on table public.placement_template is
  'Vertical defaults for the placement wizard. A template never creates a placement.';
comment on table public.placement_wizard is
  'Draft state for one placement. Schedule edits for a live placement wait here until the next working day.';
comment on table public.placement_launch_waiver is
  'A required launch item DA Admin waived, with the reason. A manager cannot activate while any waiver exists.';

alter table public.placement_template enable row level security;
alter table public.placement_wizard enable row level security;
alter table public.placement_launch_waiver enable row level security;
alter table public.placement_mail_job enable row level security;

revoke all on public.placement_template from anon, authenticated;
revoke all on public.placement_wizard from anon, authenticated;
revoke all on public.placement_launch_waiver from anon, authenticated;
revoke all on public.placement_mail_job from anon, authenticated;

grant select, insert, update, delete on public.placement_template to service_role;
grant select, insert, update, delete on public.placement_wizard to service_role;
grant select, insert, update, delete on public.placement_launch_waiver to service_role;
grant select, insert, update, delete on public.placement_mail_job to service_role;

-- One operator, one open placement. Paused does not count. Drafts do not count.
create unique index if not exists placement_one_open_per_operator
  on public.placement (operator_id)
  where status in ('active', 'scheduled');

insert into public.placement_template (slug, name, vertical, speed_tracked, categories, outcomes, offer_outline, ghl_suggestions, first_day, report_defaults)
values
  ('cleaning', 'Cleaning', 'Cleaning (residential and commercial)', true,
    array['outbound_calling', 'follow_up', 'reactivation'],
    '[{"name":"Cleaning booked","definition":"A first clean scheduled with a confirmed date."},{"name":"Walkthrough booked","definition":"An in-person or video walkthrough scheduled for a larger home or commercial space."},{"name":"Recurring plan booked","definition":"A weekly, biweekly, or monthly recurring service set up with a start date."}]'::jsonb,
    '{"one_liner":"What the business does, in one sentence the operator can say out loud.","service_area":"Cities, neighborhoods, or the area they book.","prices":"Services and the price ranges the operator may quote.","ideal_customer":"Who a good booking is for.","objections":"The objections that come up, and the approved answer for each.","booking_rules":"Who to book, how far out, and what to collect.","never":"What the operator must not promise or do.","escalate":"When to stop and hand the conversation to the client."}'::jsonb,
    '{"calendars":["First Clean","Walkthrough"],"stage":"Recurring Plan Booked","tag":"reactivation-list"}'::jsonb,
    '["Sign in to [client]''s GHL with your own user and confirm your phone number works.","Read the offer brief on your client card.","Review what counts as a win.","Log your first conversation with quick log.","Submit your first EOD by [deadline]."]'::jsonb,
    '{"send_dow":1,"send_time":"09:00","daily":false,"approval":true,"cc_manager":true}'::jsonb),
  ('home_services', 'Home Services', 'Home Services', true,
    array['outbound_calling', 'follow_up', 'reactivation'],
    '[{"name":"Estimate booked","definition":"An on-site or virtual estimate scheduled."},{"name":"Job booked","definition":"A job scheduled with a confirmed date."},{"name":"Maintenance plan sold","definition":"A recurring service plan agreed."}]'::jsonb,
    '{"one_liner":"What the business does, in one sentence the operator can say out loud.","service_area":"Cities, neighborhoods, or the area they book.","prices":"Services and the price ranges the operator may quote.","ideal_customer":"Who a good booking is for.","objections":"The objections that come up, and the approved answer for each.","booking_rules":"Who to book, how far out, and what to collect.","never":"What the operator must not promise or do.","escalate":"When to stop and hand the conversation to the client."}'::jsonb,
    '{"calendars":["Estimate","Job"],"stage":"Maintenance Plan","tag":"reactivation-list"}'::jsonb,
    '["Sign in to [client]''s GHL with your own user and confirm your phone number works.","Read the offer brief on your client card.","Review what counts as a win.","Log your first conversation with quick log.","Submit your first EOD by [deadline]."]'::jsonb,
    '{"send_dow":1,"send_time":"09:00","daily":false,"approval":true,"cc_manager":true}'::jsonb),
  ('med_spa', 'Med Spa', 'Med Spa', true,
    array['outbound_calling', 'follow_up', 'reactivation'],
    '[{"name":"Consultation booked","definition":"A consult scheduled with a provider."},{"name":"Treatment booked","definition":"A paid treatment scheduled."},{"name":"Membership sold","definition":"A recurring membership agreed."}]'::jsonb,
    '{"one_liner":"What the business does, in one sentence the operator can say out loud.","service_area":"Cities, neighborhoods, or the area they book.","prices":"Services and the price ranges the operator may quote.","ideal_customer":"Who a good booking is for.","objections":"The objections that come up, and the approved answer for each.","booking_rules":"Who to book, how far out, and what to collect.","never":"What the operator must not promise or do.","escalate":"When to stop and hand the conversation to the client."}'::jsonb,
    '{"calendars":["Consultation","Treatment"],"stage":"Membership","tag":"reactivation-list"}'::jsonb,
    '["Sign in to [client]''s GHL with your own user and confirm your phone number works.","Read the offer brief on your client card.","Review what counts as a win.","Log your first conversation with quick log.","Submit your first EOD by [deadline]."]'::jsonb,
    '{"send_dow":1,"send_time":"09:00","daily":false,"approval":true,"cc_manager":true}'::jsonb),
  ('coaches', 'Coaches and Consultants', 'Coaches and Consultants', true,
    array['outbound_calling', 'follow_up'],
    '[{"name":"Discovery call booked","definition":"A first call scheduled."},{"name":"Strategy call booked","definition":"A sales call with the coach scheduled."},{"name":"Enrollment","definition":"A client paid or signed."}]'::jsonb,
    '{"one_liner":"What the business does, in one sentence the operator can say out loud.","service_area":"Cities, neighborhoods, or the area they book.","prices":"Services and the price ranges the operator may quote.","ideal_customer":"Who a good booking is for.","objections":"The objections that come up, and the approved answer for each.","booking_rules":"Who to book, how far out, and what to collect.","never":"What the operator must not promise or do.","escalate":"When to stop and hand the conversation to the client."}'::jsonb,
    '{"calendars":["Discovery Call","Strategy Call"],"stage":"Enrolled","tag":null}'::jsonb,
    '["Sign in to [client]''s GHL with your own user and confirm your phone number works.","Read the offer brief on your client card.","Review what counts as a win.","Log your first conversation with quick log.","Submit your first EOD by [deadline]."]'::jsonb,
    '{"send_dow":1,"send_time":"09:00","daily":false,"approval":true,"cc_manager":true}'::jsonb)
on conflict (slug) do nothing;

-- Helpers ---------------------------------------------------------------------

create or replace function app.placement_first_work_day(p public.placement)
returns date
language plpgsql
stable
set search_path = ''
as $$
declare
  v_day date := p.start_date;
  v_guard integer := 0;
begin
  while v_guard < 14 loop
    if extract(isodow from v_day)::smallint = any (p.working_days) then
      return v_day;
    end if;
    v_day := v_day + 1;
    v_guard := v_guard + 1;
  end loop;
  return p.start_date;
end;
$$;

create or replace function app.placement_next_work_day(p public.placement)
returns date
language plpgsql
stable
set search_path = ''
as $$
declare
  v_day date := (now() at time zone p.time_zone)::date + 1;
  v_guard integer := 0;
begin
  while v_guard < 14 loop
    if extract(isodow from v_day)::smallint = any (p.working_days) then
      return v_day;
    end if;
    v_day := v_day + 1;
    v_guard := v_guard + 1;
  end loop;
  return (now() at time zone p.time_zone)::date + 1;
end;
$$;

create or replace function app.placement_queue_mail(p_placement uuid, p_kind text, p_send date, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.placement_mail_job (placement_id, kind, send_on, payload)
  values (p_placement, p_kind, coalesce(p_send, current_date), coalesce(p_payload, '{}'::jsonb))
  on conflict (placement_id, kind) do update
    set send_on = excluded.send_on,
        payload = excluded.payload,
        claimed_at = null,
        sent_at = null
    where public.placement_mail_job.sent_at is null;
end;
$$;

-- Launch checklist. blocking means it stops activation until it is met or waived.
create or replace function app.placement_checklist(p_placement uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pl public.placement;
  v_w public.placement_wizard;
  v_offer jsonb := '{}'::jsonb;
  v_ghl jsonb := '{}'::jsonb;
  v_map jsonb := '{}'::jsonb;
  v_stage text;
  v_phone text;
  v_ready boolean;
  v_offer_ok boolean;
  v_recipients integer := 0;
  v_outcomes integer := 0;
  v_speed boolean := false;
  v_items jsonb := '[]'::jsonb;
begin
  select * into v_pl from public.placement where id = p_placement;
  if v_pl.id is null then
    return '[]'::jsonb;
  end if;
  select * into v_w from public.placement_wizard where placement_id = p_placement;
  v_offer := coalesce(v_w.payload -> 'offer', '{}'::jsonb);
  v_ghl := coalesce(v_w.payload -> 'ghl', '{}'::jsonb);
  v_speed := v_w.id is not null and coalesce((v_w.payload ->> 'speed_tracked')::boolean, false);
  select j.stage into v_stage from public.operator_journey j where j.operator_id = v_pl.operator_id;
  v_ready := v_stage = 'ready'
    or (v_stage in ('placed', 'paused') and v_pl.status in ('active', 'paused', 'scheduled', 'ended'))
    or (v_stage is null and v_pl.status <> 'draft');
  v_offer_ok := length(btrim(coalesce(v_offer ->> 'one_liner', ''))) > 0
    and length(btrim(coalesce(v_offer ->> 'service_area', ''))) > 0
    and length(btrim(coalesce(v_offer ->> 'ideal_customer', ''))) > 0
    and length(btrim(coalesce(v_offer ->> 'booking_rules', ''))) > 0
    and length(btrim(coalesce(v_offer ->> 'never', ''))) > 0;
  if not v_offer_ok and v_w.id is null and nullif(btrim(coalesce(v_pl.campaign_summary, '')), '') is not null then
    v_offer_ok := true;
  end if;
  select count(*) into v_outcomes from public.placement_outcome_type o where o.placement_id = p_placement and o.active;
  select coalesce(cardinality(c.recipient_emails) + cardinality(c.extra_emails), 0) into v_recipients
  from public.sales_report_config c where c.placement_id = p_placement;
  v_recipients := coalesce(v_recipients, 0);
  select l.mapping into v_map from public.sales_ghl_link l where l.placement_id = p_placement;
  v_map := coalesce(v_map, '{}'::jsonb);
  v_phone := nullif(v_ghl ->> 'phone', '');
  if v_phone is null then
    select case r.phone_assigned when 'yes' then 'assigned' when 'no' then 'not_assigned' else r.phone_assigned end
      into v_phone
    from public.placement_ghl_readiness r
    where r.operator_id = v_pl.operator_id and r.client_case_file_id = v_pl.case_file_id
    limit 1;
  end if;

  v_items := v_items || jsonb_build_array(jsonb_build_object('key', 'operator', 'label', 'The operator is Ready to place.', 'met', v_ready));
  v_items := v_items || jsonb_build_array(jsonb_build_object(
    'key', 'one_active', 'label', 'This operator already has another open placement.',
    'met', not exists (
      select 1 from public.placement other
      where other.operator_id = v_pl.operator_id and other.id <> v_pl.id and other.status in ('active', 'scheduled')
    )));
  v_items := v_items || jsonb_build_array(jsonb_build_object('key', 'client', 'label', 'Choose a client.', 'met', v_pl.case_file_id is not null));
  v_items := v_items || jsonb_build_array(jsonb_build_object(
    'key', 'schedule', 'label', 'Set the start date, working days, and shift.',
    'met', v_pl.start_date is not null and cardinality(v_pl.working_days) > 0
      and (v_w.id is null or coalesce((v_w.payload ->> 'schedule_confirmed')::boolean, false))));
  v_items := v_items || jsonb_build_array(jsonb_build_object(
    'key', 'categories', 'label', 'Choose at least one activity category.',
    'met', cardinality(v_pl.activity_categories) > 0
      and (v_w.id is null or coalesce((v_w.payload ->> 'work_confirmed')::boolean, false))));
  v_items := v_items || jsonb_build_array(jsonb_build_object(
    'key', 'outcomes', 'label', 'Add at least one positive outcome.', 'met', v_outcomes > 0));
  v_items := v_items || jsonb_build_array(jsonb_build_object(
    'key', 'offer', 'label', 'Finish the offer brief: business line, service area, ideal customer, booking rules, and what never to do.',
    'met', v_offer_ok));
  v_items := v_items || jsonb_build_array(jsonb_build_object(
    'key', 'recipients', 'label', 'Choose at least one client report recipient.', 'met', v_recipients > 0));
  v_items := v_items || jsonb_build_array(jsonb_build_object(
    'key', 'ghl_connection', 'label', 'Connect the client''s GHL sub-account.',
    'met', exists (
      select 1 from public.ghl_connection c
      where c.case_file_id = v_pl.case_file_id and c.retired_at is null and c.replaces_id is null and c.level = 'location'
    )));
  v_items := v_items || jsonb_build_array(jsonb_build_object(
    'key', 'ghl_user', 'label', 'Choose the operator''s GHL user. Marking it not created yet leaves this open.',
    'met', exists (
      select 1 from public.sales_ghl_link l
      where l.placement_id = p_placement and nullif(btrim(coalesce(l.ghl_user_id, '')), '') is not null
    )));
  v_items := v_items || jsonb_build_array(jsonb_build_object(
    'key', 'phone', 'label', 'Say whether a phone number is assigned, not assigned, or not needed.',
    'met', v_phone in ('assigned', 'not_assigned', 'not_needed')));
  v_items := v_items || jsonb_build_array(jsonb_build_object(
    'key', 'outcome_mapping', 'label', 'Map the positive outcomes to a GHL calendar or stage.',
    'met', v_outcomes > 0 and case
      when jsonb_typeof(v_map -> 'outcomes') = 'array' then (
        select count(*) from jsonb_array_elements(v_map -> 'outcomes') item
        where nullif(item ->> 'calendar_id', '') is not null or nullif(item ->> 'stage_id', '') is not null
      ) >= v_outcomes
      else false
    end));
  if v_speed then
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'key', 'speed', 'label', 'Map the leads used for speed-to-lead.',
      'met', jsonb_array_length(coalesce(v_map #> '{speed,ids}', '[]'::jsonb)) > 0));
  end if;
  if 'reactivation' = any (v_pl.activity_categories) then
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'key', 'reactivation', 'label', 'Map the reactivation list.',
      'met', jsonb_array_length(coalesce(v_map #> '{reactivation,ids}', '[]'::jsonb)) > 0));
  end if;
  if v_pl.tracks_results then
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'key', 'show_close', 'label', 'Map the show-rate calendars and the close pipelines.',
      'met', jsonb_array_length(coalesce(v_map -> 'show_calendar_ids', '[]'::jsonb)) > 0
        and jsonb_array_length(coalesce(v_map -> 'close_pipeline_ids', '[]'::jsonb)) > 0));
  end if;

  return coalesce((
    select jsonb_agg(item || jsonb_build_object(
      'waived', w.reason is not null,
      'waiver_reason', w.reason,
      'blocking', coalesce((item ->> 'met')::boolean, false) = false and w.reason is null
    ) order by item ->> 'key')
    from jsonb_array_elements(v_items) item
    left join public.placement_launch_waiver w on w.placement_id = p_placement and w.item = item ->> 'key'
  ), '[]'::jsonb);
end;
$$;

-- A waived outcomes item can go active. Every other active placement still needs a win defined.
create or replace function app.so_guard_placement_outcomes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.placement_type is not null and new.status = 'active'
     and (tg_op = 'INSERT' or old.status is distinct from 'active' or old.placement_type is null)
     and not exists (select 1 from public.placement_outcome_type o where o.placement_id = new.id and o.active)
     and not exists (select 1 from public.placement_launch_waiver w where w.placement_id = new.id and w.item = 'outcomes') then
    raise exception 'outcomes_required: define at least one positive outcome for this placement before it goes Active'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function app.so_guard_placement_outcomes() from public, anon, authenticated;

-- A scheduled placement counts as placed. The workspace itself stays closed until the shift starts.
create or replace function app.hire_refresh(p_operator uuid, p_reason text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_j public.operator_journey;
  v_next text;
  v_place text := 'none';
begin
  select * into v_j from public.operator_journey where operator_id = p_operator for update;
  if v_j.operator_id is null then
    return null;
  end if;
  if exists (
    select 1 from public.placement pl
    where pl.operator_id = p_operator and pl.placement_type is not null and pl.status in ('active', 'scheduled')
  ) then
    v_place := 'active';
  elsif exists (
    select 1 from public.placement pl
    where pl.operator_id = p_operator and pl.placement_type is not null and pl.status = 'paused'
  ) then
    v_place := 'paused';
  end if;

  v_next := case
    when v_j.stage = 'offboarded' or v_j.offboarded_at is not null then 'offboarded'
    when v_place = 'paused' or v_j.paused_at is not null and v_place <> 'active' then 'paused'
    when v_place = 'active' then 'placed'
    when app.hire_ready(p_operator) then 'ready'
    when v_j.signed_in_at is not null then 'onboarding'
    else 'invited'
  end;

  if v_next is distinct from v_j.stage then
    update public.operator_journey
       set stage = v_next,
           stage_reason = p_reason,
           ready_at = case when v_next = 'ready' then coalesce(ready_at, now()) else ready_at end,
           updated_at = now()
     where operator_id = p_operator;
    update public.operator
       set status = case v_next
         when 'ready' then 'on_bench'::public.operator_status
         when 'placed' then 'placed'::public.operator_status
         when 'offboarded' then case
           when v_j.last_day is not null and v_j.last_day < current_date then 'inactive'::public.operator_status
           else status
         end
         else status
       end
     where id = p_operator
       and status is distinct from case v_next
         when 'ready' then 'on_bench'::public.operator_status
         when 'placed' then 'placed'::public.operator_status
         when 'offboarded' then case
           when v_j.last_day is not null and v_j.last_day < current_date then 'inactive'::public.operator_status
           else status
         end
         else status
       end;
    perform app.hire_audit('operator.stage.' || v_next, p_operator,
      format('Stage is now %s. %s', v_next, coalesce(p_reason, '')),
      jsonb_build_object('from', v_j.stage, 'to', v_next));
  end if;

  if v_j.last_day is not null and v_j.last_day < current_date and v_j.offboarded_at is not null then
    update public.operator set status = 'inactive' where id = p_operator and status is distinct from 'inactive';
  end if;
  return v_next;
end;
$$;

-- Block a second open placement. Scheduled counts. The rest of the transition rules stay as they were.
create or replace function public.so_set_placement_status(p_placement_id uuid, p_status text, p_reason text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.placement;
  v_new public.placement;
  v_from text;
  v_to text := lower(btrim(coalesce(p_status, '')));
  v_name text;
begin
  if not app.is_admin() then
    raise exception 'admin_required: only DA Admin changes placement status' using errcode = '42501';
  end if;

  select * into v_old from public.placement where id = p_placement_id for update;
  if v_old.id is null then
    raise exception 'not_found: that placement does not exist' using errcode = 'P0002';
  end if;
  if v_old.placement_type is null then
    raise exception 'not_workspace: set the placement type first' using errcode = '23514';
  end if;
  v_from := app.so_status_label(v_old.status);
  select name into v_name from public.operator where id = v_old.operator_id;

  if v_from = v_to then
    return v_to;
  end if;
  if not (
    (v_from = 'pending' and v_to in ('active', 'ended'))
    or (v_from = 'active' and v_to in ('paused', 'ended'))
    or (v_from = 'paused' and v_to in ('active', 'ended'))
  ) then
    raise exception 'invalid_transition: a % placement cannot move to %', v_from, v_to using errcode = '23514';
  end if;

  if v_to = 'active' then
    if not exists (select 1 from public.placement_outcome_type o where o.placement_id = v_old.id and o.active) then
      raise exception 'outcomes_required: define at least one positive outcome for this placement before it goes Active'
        using errcode = '23514';
    end if;
    if exists (select 1 from public.placement pl
               where pl.operator_id = v_old.operator_id and pl.status in ('active', 'scheduled') and pl.id <> v_old.id) then
      raise exception 'already_active: % already has an open placement. Pause or end it first.', v_name
        using errcode = '23505';
    end if;
  end if;

  update public.placement set
    status = case v_to
      when 'active' then 'active'::public.placement_status
      when 'paused' then 'paused'::public.placement_status
      else 'ended'::public.placement_status
    end,
    paused_at = case when v_to = 'paused' then now() else null end,
    closed_on = case when v_to = 'ended' then current_date else closed_on end
  where id = v_old.id
  returning * into v_new;

  if v_to = 'ended' and not exists (
    select 1 from public.placement where operator_id = v_old.operator_id and status = 'active'
  ) then
    update public.operator set status = 'on_bench' where id = v_old.operator_id and status = 'placed';
  end if;

  perform app.audit('workspace.placement.status', 'placement', v_old.id::text,
    format('Placement for %s: %s to %s%s', v_name, v_from, v_to,
      case when nullif(btrim(coalesce(p_reason, '')), '') is null then '' else '. ' || btrim(p_reason) end),
    jsonb_build_object('status', v_from), jsonb_build_object('status', v_to, 'reason', nullif(btrim(coalesce(p_reason, '')), '')),
    v_old.case_file_id);
  return v_to;
end;
$$;

-- Templates -------------------------------------------------------------------

create or replace function public.so_template_list()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app.is_admin() and not app.is_manager() then
    raise exception 'permission_denied: managers and DA Admin only' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'slug', t.slug, 'name', t.name, 'vertical', t.vertical, 'speed_tracked', t.speed_tracked,
      'categories', t.categories, 'outcomes', t.outcomes, 'offer_outline', t.offer_outline,
      'ghl', t.ghl_suggestions, 'first_day', t.first_day, 'report', t.report_defaults, 'active', t.active
    ) order by t.name)
    from public.placement_template t
    where t.active or app.is_admin()
  ), '[]'::jsonb);
end;
$$;

create or replace function public.so_template_save(p_body jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug text := nullif(btrim(coalesce(p_body ->> 'slug', '')), '');
begin
  if not app.is_admin() or app.is_impersonating() then
    raise exception 'admin_required: only DA Admin edits placement templates' using errcode = '42501';
  end if;
  if v_slug is null then
    raise exception 'required: the template needs a slug' using errcode = '23514';
  end if;
  insert into public.placement_template (slug, name, vertical, speed_tracked, categories, outcomes, offer_outline, ghl_suggestions, first_day, report_defaults, active, updated_by)
  values (
    v_slug,
    coalesce(nullif(btrim(coalesce(p_body ->> 'name', '')), ''), v_slug),
    coalesce(nullif(btrim(coalesce(p_body ->> 'vertical', '')), ''), v_slug),
    coalesce((p_body ->> 'speed_tracked')::boolean, true),
    coalesce(array(select jsonb_array_elements_text(p_body -> 'categories')), array['outbound_calling']::text[]),
    coalesce(p_body -> 'outcomes', '[]'::jsonb),
    coalesce(p_body -> 'offer_outline', '{}'::jsonb),
    coalesce(p_body -> 'ghl', '{}'::jsonb),
    coalesce(p_body -> 'first_day', '[]'::jsonb),
    coalesce(p_body -> 'report', '{}'::jsonb),
    coalesce((p_body ->> 'active')::boolean, true),
    auth.uid()
  )
  on conflict (slug) do update set
    name = excluded.name,
    vertical = excluded.vertical,
    speed_tracked = excluded.speed_tracked,
    categories = excluded.categories,
    outcomes = excluded.outcomes,
    offer_outline = excluded.offer_outline,
    ghl_suggestions = excluded.ghl_suggestions,
    first_day = excluded.first_day,
    report_defaults = excluded.report_defaults,
    active = excluded.active,
    updated_by = auth.uid(),
    updated_at = now();
  perform app.audit('workspace.placement.template', 'placement_template', v_slug, 'Edited a placement template', null, p_body);
  return v_slug;
end;
$$;

-- Wizard ----------------------------------------------------------------------

create or replace function app.placement_apply_wizard(p_wizard uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_w public.placement_wizard;
  v_pl public.placement;
  v_payload jsonb;
  v_operator uuid;
  v_case uuid;
  v_manager uuid;
  v_start date;
  v_review date;
  v_days smallint[];
  v_categories text[];
  v_type text;
  v_tz text;
  v_shift_start text;
  v_shift_end text;
  v_deadline text;
  v_ready boolean;
  v_reason text;
  v_summary text;
  v_item jsonb;
  v_name text;
  v_def text;
  v_sort integer := 0;
  v_phone text;
begin
  select * into v_w from public.placement_wizard where id = p_wizard for update;
  v_payload := v_w.payload;
  v_operator := nullif(v_payload ->> 'operator_id', '')::uuid;
  v_case := nullif(v_payload ->> 'case_file_id', '')::uuid;
  if v_operator is not null then
    v_ready := exists (select 1 from public.operator_journey j where j.operator_id = v_operator and j.stage = 'ready');
    v_reason := nullif(btrim(coalesce(v_payload ->> 'not_ready_reason', '')), '');
    if not v_ready then
      if not app.is_admin() then
        raise exception 'not_ready: only DA Admin can place an operator who is not Ready to place' using errcode = '42501';
      end if;
      if v_reason is null or length(v_reason) < 8 then
        raise exception 'reason_required: say why this operator is being placed before they are Ready to place' using errcode = '23514';
      end if;
    end if;
  end if;

  begin
    v_start := nullif(v_payload ->> 'start_date', '')::date;
  exception when others then
    raise exception 'invalid: the start date is not a date' using errcode = '23514';
  end;
  if v_operator is null or v_case is null or v_start is null then
    return v_w.placement_id;
  end if;
  if not exists (select 1 from public.operator where id = v_operator) then
    raise exception 'not_found: that operator does not exist' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.client_case_file where id = v_case and record_kind = 'client') then
    raise exception 'not_found: that client does not exist' using errcode = 'P0002';
  end if;

  select coalesce(array_agg(distinct x::smallint order by x::smallint), '{1,2,3,4,5}'::smallint[])
    into v_days
  from jsonb_array_elements_text(coalesce(v_payload -> 'working_days', '[1,2,3,4,5]'::jsonb)) t(x)
  where x ~ '^[1-7]$';
  if v_days is null or cardinality(v_days) = 0 then
    v_days := '{1,2,3,4,5}'::smallint[];
  end if;
  select coalesce(array_agg(distinct x), '{}'::text[])
    into v_categories
  from jsonb_array_elements_text(coalesce(v_payload -> 'activity_categories', '[]'::jsonb)) t(x)
  where x in ('outbound_calling', 'follow_up', 'reactivation');

  v_tz := coalesce(nullif(btrim(coalesce(v_payload ->> 'time_zone', '')), ''), 'America/New_York');
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = v_tz) then
    v_tz := 'America/New_York';
  end if;
  v_shift_start := coalesce(nullif(v_payload ->> 'shift_start', ''), '09:00');
  v_shift_end := coalesce(nullif(v_payload ->> 'shift_end', ''), '17:00');
  v_deadline := nullif(v_payload ->> 'eod_deadline', '');
  if v_shift_start !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or v_shift_end !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
    raise exception 'invalid: shift times are HH:MM' using errcode = '23514';
  end if;
  if v_deadline is null then
    v_deadline := to_char(v_shift_end::time + interval '30 minutes', 'HH24:MI');
  end if;
  if v_deadline !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
    raise exception 'invalid: the EOD deadline is HH:MM' using errcode = '23514';
  end if;
  begin
    v_review := nullif(v_payload ->> 'review_on', '')::date;
  exception when others then
    v_review := null;
  end;
  v_manager := nullif(v_payload ->> 'manager_profile_id', '')::uuid;
  if v_manager is null and app.is_manager() then
    v_manager := auth.uid();
  end if;
  if v_manager is not null and not exists (
    select 1 from public.profile where id = v_manager and role in ('manager', 'admin', 'owner')
  ) then
    v_manager := null;
  end if;
  v_type := case when cardinality(v_categories) > 0 then coalesce(nullif(v_payload ->> 'placement_type', ''), 'client_placed') else null end;
  if v_type is not null and v_type not in ('client_placed', 'da_internal') then
    v_type := 'client_placed';
  end if;
  v_summary := nullif(concat_ws(e'\n',
    case when length(btrim(coalesce(v_payload #>> '{offer,one_liner}', ''))) > 0 then 'Business: ' || btrim(v_payload #>> '{offer,one_liner}') end,
    case when length(btrim(coalesce(v_payload #>> '{offer,service_area}', ''))) > 0 then 'Service area: ' || btrim(v_payload #>> '{offer,service_area}') end,
    case when length(btrim(coalesce(v_payload #>> '{offer,prices}', ''))) > 0 then 'Prices: ' || btrim(v_payload #>> '{offer,prices}') end,
    case when length(btrim(coalesce(v_payload #>> '{offer,ideal_customer}', ''))) > 0 then 'Ideal customer: ' || btrim(v_payload #>> '{offer,ideal_customer}') end,
    case when length(btrim(coalesce(v_payload #>> '{offer,objections}', ''))) > 0 then 'Objections: ' || btrim(v_payload #>> '{offer,objections}') end,
    case when length(btrim(coalesce(v_payload #>> '{offer,booking_rules}', ''))) > 0 then 'Booking rules: ' || btrim(v_payload #>> '{offer,booking_rules}') end,
    case when length(btrim(coalesce(v_payload #>> '{offer,never}', ''))) > 0 then 'Never: ' || btrim(v_payload #>> '{offer,never}') end,
    case when length(btrim(coalesce(v_payload #>> '{offer,escalate}', ''))) > 0 then 'Escalate: ' || btrim(v_payload #>> '{offer,escalate}') end
  ), '');

  if v_w.placement_id is null then
    insert into public.placement (
      operator_id, case_file_id, start_date, end_date, status,
      placement_type, manager_profile_id, time_zone, working_days, shift_start, shift_end,
      eod_deadline, campaign_summary, activity_categories, tracks_results, review_on
    ) values (
      v_operator, v_case, v_start, date '9999-12-31', 'draft',
      v_type, v_manager, v_tz, v_days, v_shift_start, v_shift_end,
      v_deadline, v_summary, coalesce(v_categories, '{}'), coalesce((v_payload ->> 'tracks_results')::boolean, false), v_review
    ) returning * into v_pl;
    update public.placement_wizard set placement_id = v_pl.id, updated_at = now() where id = p_wizard;
  else
    select * into v_pl from public.placement where id = v_w.placement_id for update;
    if v_pl.status in ('ended', 'renewed') then
      raise exception 'ended: an ended placement is a record. Start a new one.' using errcode = '23514';
    end if;
    if v_pl.status not in ('draft', 'scheduled') and (v_pl.operator_id <> v_operator or v_pl.case_file_id <> v_case) then
      raise exception 'locked: the operator and client are fixed once a placement has started' using errcode = '23514';
    end if;
    update public.placement set
      operator_id = v_operator,
      case_file_id = v_case,
      start_date = v_start,
      placement_type = coalesce(v_type, placement_type),
      manager_profile_id = v_manager,
      time_zone = v_tz,
      working_days = v_days,
      shift_start = v_shift_start,
      shift_end = v_shift_end,
      eod_deadline = v_deadline,
      campaign_summary = coalesce(v_summary, campaign_summary),
      activity_categories = case when cardinality(v_categories) > 0 then v_categories else activity_categories end,
      tracks_results = coalesce((v_payload ->> 'tracks_results')::boolean, tracks_results),
      review_on = coalesce(v_review, review_on)
    where id = v_pl.id
    returning * into v_pl;
  end if;

  if v_ready = false and v_reason is not null then
    insert into public.placement_launch_waiver (placement_id, item, reason, waived_by)
    values (v_pl.id, 'operator', v_reason, auth.uid())
    on conflict (placement_id, item) do update set reason = excluded.reason, waived_by = auth.uid(), waived_at = now();
  elsif v_ready then
    delete from public.placement_launch_waiver where placement_id = v_pl.id and item = 'operator';
  end if;

  if coalesce((v_payload ->> 'work_confirmed')::boolean, false) and jsonb_typeof(v_payload -> 'outcomes') = 'array' then
    for v_item in select value from jsonb_array_elements(v_payload -> 'outcomes') loop
      v_name := btrim(coalesce(v_item ->> 'name', ''));
      v_def := btrim(coalesce(v_item ->> 'definition', ''));
      v_sort := v_sort + 1;
      if v_name = '' or v_def = '' then
        continue;
      end if;
      update public.placement_outcome_type
         set definition = v_def, active = true, sort_order = v_sort, updated_by = auth.uid()
       where placement_id = v_pl.id and lower(btrim(name)) = lower(v_name);
      if not found then
        insert into public.placement_outcome_type (placement_id, name, definition, active, sort_order, created_by, updated_by)
        values (v_pl.id, v_name, v_def, true, v_sort, auth.uid(), auth.uid());
      end if;
    end loop;
    if v_pl.status = 'draft' then
      update public.placement_outcome_type o
         set active = false
       where o.placement_id = v_pl.id and o.active
         and lower(btrim(o.name)) not in (
           select lower(btrim(value ->> 'name')) from jsonb_array_elements(v_payload -> 'outcomes')
         );
    end if;
  end if;

  if coalesce((v_payload ->> 'reporting_confirmed')::boolean, false) then
    begin
      perform public.so_report_save_config(v_pl.id, jsonb_build_object(
        'weekly_enabled', true,
        'daily_enabled', coalesce((v_payload #>> '{reporting,daily}')::boolean, false),
        'send_dow', nullif(v_payload #>> '{reporting,send_dow}', ''),
        'send_time', nullif(v_payload #>> '{reporting,send_time}', ''),
        'require_approval', coalesce((v_payload #>> '{reporting,approval}')::boolean, true),
        'include_speed', true,
        'include_plan', true,
        'include_results', v_pl.tracks_results,
        'cc_manager', coalesce((v_payload #>> '{reporting,cc_manager}')::boolean, true),
        'recipient_emails', coalesce(v_payload #> '{reporting,recipients}', '[]'::jsonb),
        'extra_emails', coalesce(v_payload #> '{reporting,extra}', '[]'::jsonb),
        'extra_cc', '[]'::jsonb
      ));
    exception when others then
      null;
    end;
  end if;

  v_phone := nullif(v_payload #>> '{ghl,phone}', '');
  if v_phone in ('assigned', 'not_assigned', 'not_needed') then
    insert into public.placement_ghl_readiness (operator_id, placement_id, client_case_file_id, phone_assigned, ghl_user_exists, mapped)
    values (
      v_pl.operator_id, v_pl.id, v_pl.case_file_id,
      case v_phone when 'assigned' then 'yes' when 'not_assigned' then 'no' else 'not_needed' end,
      nullif(v_payload #>> '{ghl,user_id}', '') is not null,
      coalesce((v_payload ->> 'mapping_confirmed')::boolean, false)
    )
    on conflict (operator_id, client_case_file_id) do update
      set placement_id = excluded.placement_id,
          phone_assigned = excluded.phone_assigned,
          ghl_user_exists = excluded.ghl_user_exists,
          mapped = excluded.mapped;
  end if;

  if app.is_admin() and nullif(v_payload #>> '{ghl,user_id}', '') is not null then
    begin
      perform public.so_ghl_save_user(v_pl.id, v_payload #>> '{ghl,user_id}');
    exception when others then
      null;
    end;
  end if;
  if coalesce((v_payload ->> 'mapping_confirmed')::boolean, false) and jsonb_typeof(v_payload #> '{ghl,mapping}') = 'object' then
    begin
      perform public.so_ghl_save_mapping(v_pl.id, v_payload #> '{ghl,mapping}');
    exception when others then
      null;
    end;
  end if;

  if coalesce((v_payload ->> 'targets_confirmed')::boolean, false)
     and not coalesce((v_payload ->> 'targets_applied')::boolean, false) then
    if v_payload ->> 'targets_mode' = 'copy' and nullif(v_payload ->> 'copy_from', '') is not null then
      insert into public.activity_target (layer, metric_key, placement_id, daily, weekly, effective_from, note, set_by)
      select 'override', s.metric_key, v_pl.id, s.daily, s.weekly, greatest(v_pl.start_date, (now() at time zone v_pl.time_zone)::date),
             'Copied from another placement', auth.uid()
      from (
        select distinct on (t.metric_key) t.metric_key, t.daily, t.weekly
        from public.activity_target t
        where t.placement_id = (v_payload ->> 'copy_from')::uuid and t.layer = 'override'
        order by t.metric_key, t.effective_from desc, t.set_at desc
      ) s;
    elsif v_payload ->> 'targets_mode' = 'set' and jsonb_typeof(v_payload -> 'targets') = 'array' then
      for v_item in select value from jsonb_array_elements(v_payload -> 'targets') loop
        if nullif(v_item ->> 'metric', '') is not null then
          begin
            perform public.so_set_override_target(
              v_pl.id, v_item ->> 'metric',
              nullif(v_item ->> 'daily', '')::numeric, nullif(v_item ->> 'weekly', '')::numeric,
              greatest(v_pl.start_date, (now() at time zone v_pl.time_zone)::date), 'Set in the placement wizard');
          exception when others then
            null;
          end;
        end if;
      end loop;
    end if;
    update public.placement_wizard
       set payload = payload || jsonb_build_object('targets_applied', true), updated_at = now()
     where id = p_wizard;
  end if;

  return v_pl.id;
end;
$$;

create or replace function public.so_wizard_bundle(p_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_w public.placement_wizard;
begin
  if not app.is_admin() and not app.is_manager() then
    raise exception 'permission_denied: managers and DA Admin only' using errcode = '42501';
  end if;
  if p_id is not null then
    select * into v_w from public.placement_wizard where id = p_id;
    if v_w.id is not null and not app.is_admin() and v_w.created_by is distinct from auth.uid()
       and not exists (select 1 from public.placement pl where pl.id = v_w.placement_id and pl.manager_profile_id = auth.uid()) then
      raise exception 'out_of_scope: that draft is not yours' using errcode = '42501';
    end if;
  end if;
  return jsonb_build_object(
    'role', case when app.is_admin() then 'admin' else 'manager' end,
    'wizard', case when v_w.id is null then null else jsonb_build_object(
      'id', v_w.id, 'placement_id', v_w.placement_id, 'step', v_w.step, 'status', v_w.status, 'payload', v_w.payload
    ) end,
    'checklist', case when v_w.placement_id is null then '[]'::jsonb else app.placement_checklist(v_w.placement_id) end,
    'templates', public.so_template_list(),
    'operators', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id, 'name', o.name, 'stage', coalesce(j.stage, 'legacy'),
        'ready', j.stage = 'ready',
        'has_open', exists (select 1 from public.placement pl where pl.operator_id = o.id and pl.status in ('active', 'scheduled')),
        'missing', case when j.stage = 'ready' then '' else coalesce((
          select string_agg(item ->> 'detail', '; ')
          from jsonb_array_elements(app.hire_readiness(o.id)) item
          where item ->> 'state' = 'missing'
        ), case when j.operator_id is null then 'No hire record yet' else '' end) end,
        'time_zone', ob.answers ->> 'time_zone',
        'work_days', ob.answers -> 'work_days',
        'work_hours', ob.answers ->> 'work_hours'
      ) order by o.name)
      from public.operator o
      left join public.operator_journey j on j.operator_id = o.id
      left join public.operator_onboarding ob on ob.operator_id = o.id
      where o.status is distinct from 'inactive'
    ), '[]'::jsonb),
    'clients', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', c.name, 'contact_name', c.contact_name, 'contact_email', c.contact_email,
        'ghl', exists (
          select 1 from public.ghl_connection g
          where g.case_file_id = c.id and g.retired_at is null and g.replaces_id is null and g.level = 'location'
        ),
        'placements', coalesce((
          select jsonb_agg(jsonb_build_object('id', pl.id, 'operator', op.name, 'status', pl.status) order by op.name)
          from public.placement pl
          join public.operator op on op.id = pl.operator_id
          where pl.case_file_id = c.id and pl.status in ('draft', 'scheduled', 'active', 'paused')
        ), '[]'::jsonb)
      ) order by c.name)
      from public.client_case_file c
      where c.record_kind = 'client'
    ), '[]'::jsonb),
    'managers', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'name', coalesce(nullif(btrim(p.full_name), ''), p.email)) order by p.full_name)
      from public.profile p
      where p.role in ('manager', 'admin', 'owner') and p.state = 'active'
    ), '[]'::jsonb),
    'metrics', coalesce((
      select jsonb_agg(jsonb_build_object('key', m.key, 'label', m.label) order by m.sort_order)
      from public.activity_metric m where m.active
    ), '[]'::jsonb),
    'copy_from', coalesce((
      select jsonb_agg(jsonb_build_object('id', pl.id, 'label', op.name || ' at ' || c.name) order by op.name)
      from public.placement pl
      join public.operator op on op.id = pl.operator_id
      join public.client_case_file c on c.id = pl.case_file_id
      where pl.placement_type is not null and pl.status in ('active', 'paused', 'ended')
        and (app.is_admin() or pl.manager_profile_id = auth.uid())
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.so_wizard_save(p_body jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_body ->> 'id', '')::uuid;
  v_w public.placement_wizard;
  v_payload jsonb;
  v_placement uuid;
begin
  if app.is_impersonating() then
    raise exception 'view_as_read_only: exit View As to change a placement' using errcode = '42501';
  end if;
  if not app.is_admin() and not app.is_manager() then
    raise exception 'permission_denied: managers and DA Admin only' using errcode = '42501';
  end if;
  v_payload := coalesce(p_body -> 'payload', '{}'::jsonb) - 'token';
  if jsonb_typeof(v_payload -> 'ghl') = 'object' then
    v_payload := jsonb_set(v_payload, '{ghl}', (v_payload -> 'ghl') - 'token' - 'private_token');
  end if;

  if v_id is null then
    insert into public.placement_wizard (step, template_slug, payload, created_by)
    values (
      least(10, greatest(1, coalesce((p_body ->> 'step')::integer, 1))),
      nullif(v_payload ->> 'template_slug', ''),
      v_payload,
      auth.uid()
    ) returning * into v_w;
  else
    select * into v_w from public.placement_wizard where id = v_id for update;
    if v_w.id is null then
      raise exception 'not_found: that draft does not exist' using errcode = 'P0002';
    end if;
    if not app.is_admin() and v_w.created_by is distinct from auth.uid()
       and not exists (select 1 from public.placement pl where pl.id = v_w.placement_id and pl.manager_profile_id = auth.uid()) then
      raise exception 'out_of_scope: that draft is not yours' using errcode = '42501';
    end if;
    if v_w.status <> 'draft' then
      raise exception 'locked: this placement has left the wizard. Edit it from the placement page.' using errcode = '23514';
    end if;
    if coalesce((v_w.payload ->> 'targets_applied')::boolean, false) then
      v_payload := v_payload || jsonb_build_object('targets_applied', true);
    end if;
    update public.placement_wizard set
      step = least(10, greatest(step, coalesce((p_body ->> 'step')::integer, step))),
      template_slug = nullif(v_payload ->> 'template_slug', ''),
      payload = v_payload,
      updated_at = now()
    where id = v_id
    returning * into v_w;
  end if;

  v_placement := app.placement_apply_wizard(v_w.id);
  perform app.audit('workspace.placement.wizard', 'placement', coalesce(v_placement::text, v_w.id::text),
    format('Saved placement wizard step %s', least(10, greatest(1, coalesce((p_body ->> 'step')::integer, 1)))),
    null, jsonb_build_object('wizard_id', v_w.id, 'step', p_body ->> 'step'), nullif(v_payload ->> 'case_file_id', '')::uuid);
  return jsonb_build_object(
    'id', v_w.id,
    'placement_id', v_placement,
    'checklist', case when v_placement is null then '[]'::jsonb else app.placement_checklist(v_placement) end
  );
end;
$$;

create or replace function public.so_launch_waive(p_placement uuid, p_item text, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not app.is_admin() or app.is_impersonating() then
    raise exception 'admin_required: only DA Admin can waive a launch item' using errcode = '42501';
  end if;
  if v_reason is null or length(v_reason) < 8 then
    raise exception 'reason_required: a waiver needs a reason' using errcode = '23514';
  end if;
  if p_item is null or p_item = '' then
    raise exception 'required: choose the checklist item' using errcode = '23514';
  end if;
  insert into public.placement_launch_waiver (placement_id, item, reason, waived_by)
  values (p_placement, p_item, v_reason, auth.uid())
  on conflict (placement_id, item) do update set reason = excluded.reason, waived_by = auth.uid(), waived_at = now();
  perform app.audit('workspace.placement.waiver', 'placement', p_placement::text,
    format('Waived launch item %s', p_item), null, jsonb_build_object('item', p_item, 'reason', v_reason));
end;
$$;

create or replace function public.so_wizard_activate(p_wizard uuid, p_mode text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_w public.placement_wizard;
  v_pl public.placement;
  v_block text;
  v_first date;
  v_live boolean;
  v_task text;
  v_title text;
  v_client text;
  v_email text;
  v_name text;
  v_intro text;
  v_recipients text[];
begin
  if app.is_impersonating() then
    raise exception 'view_as_read_only: exit View As to activate a placement' using errcode = '42501';
  end if;
  if not app.is_admin() and not app.is_manager() then
    raise exception 'permission_denied: managers and DA Admin only' using errcode = '42501';
  end if;
  select * into v_w from public.placement_wizard where id = p_wizard for update;
  if v_w.id is null or v_w.placement_id is null then
    raise exception 'not_found: save the draft before activating it' using errcode = 'P0002';
  end if;
  if not app.is_admin() and v_w.created_by is distinct from auth.uid()
     and not app.so_manages_placement(v_w.placement_id) then
    raise exception 'out_of_scope: that placement is not yours' using errcode = '42501';
  end if;
  select * into v_pl from public.placement where id = v_w.placement_id for update;
  if v_pl.status not in ('draft', 'scheduled') then
    raise exception 'locked: this placement is already %s', v_pl.status using errcode = '23514';
  end if;
  select string_agg(item ->> 'label', ' ') into v_block
  from jsonb_array_elements(app.placement_checklist(v_pl.id)) item
  where (item ->> 'blocking')::boolean;
  if v_block is not null then
    raise exception 'checklist: %', v_block using errcode = '23514';
  end if;
  if not app.is_admin() and exists (select 1 from public.placement_launch_waiver w where w.placement_id = v_pl.id) then
    raise exception 'waiver_blocked: a manager can activate only when every checklist item is met and nothing is waived' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.placement other
    where other.operator_id = v_pl.operator_id and other.id <> v_pl.id and other.status in ('active', 'scheduled')
  ) then
    raise exception 'already_active: this operator already has an open placement' using errcode = '23505';
  end if;

  if v_pl.placement_type is null or cardinality(v_pl.activity_categories) = 0 then
    update public.placement set
      placement_type = coalesce(placement_type, 'client_placed'),
      activity_categories = case when cardinality(activity_categories) = 0 then array['outbound_calling']::text[] else activity_categories end
    where id = v_pl.id
    returning * into v_pl;
  end if;

  v_first := app.placement_first_work_day(v_pl);
  v_live := coalesce(p_mode, 'now') = 'now'
    and now() >= ((v_first + v_pl.shift_start::time) at time zone v_pl.time_zone);
  select c.name into v_client from public.client_case_file c where c.id = v_pl.case_file_id;
  if jsonb_array_length(coalesce(v_w.payload -> 'first_day', '[]'::jsonb)) = 0 then
    v_w.payload := jsonb_set(v_w.payload, '{first_day}', '[
      "Sign in to [client]''s GHL with your own user and confirm your phone number works.",
      "Read the offer brief on your client card.",
      "Review what counts as a win.",
      "Log your first conversation with quick log.",
      "Submit your first EOD by [deadline]."
    ]'::jsonb);
  end if;
  for v_task in
    select value from jsonb_array_elements_text(coalesce(v_w.payload -> 'first_day', '[]'::jsonb))
  loop
    v_title := left(replace(replace(v_task, '[client]', coalesce(v_client, 'the client')), '[deadline]', coalesce(v_pl.eod_deadline, v_pl.shift_end)), 140);
    if length(btrim(v_title)) >= 3 then
      perform public.so_save_task(null, v_pl.operator_id, v_pl.id, v_title, '', v_first, null, 'normal', false);
    end if;
  end loop;

  if v_live then
    update public.placement set status = 'active' where id = v_pl.id;
    update public.placement_wizard set status = 'activated', scheduled_for = null, updated_at = now() where id = v_w.id;
  else
    update public.placement set status = 'scheduled' where id = v_pl.id;
    update public.placement_wizard set status = 'scheduled', scheduled_for = v_first, updated_at = now() where id = v_w.id;
  end if;
  perform app.hire_refresh(v_pl.operator_id, 'Placement activated');
  update public.operator set status = 'placed' where id = v_pl.operator_id and status is distinct from 'placed';

  select coalesce(p.email, o.email), o.name into v_email, v_name
  from public.operator o left join public.profile p on p.id = o.profile_id
  where o.id = v_pl.operator_id;
  if v_email is not null then
    perform app.placement_queue_mail(v_pl.id, 'operator.placement_assigned', current_date, jsonb_build_object(
      'to', jsonb_build_array(v_email), 'name', v_name, 'client', v_client,
      'shift', v_pl.shift_start || '–' || v_pl.shift_end, 'zone', v_pl.time_zone, 'start', v_first,
      'operator_id', v_pl.operator_id, 'case_file_id', v_pl.case_file_id));
    perform app.placement_queue_mail(v_pl.id, 'operator.first_shift_reminder', greatest(v_first - 1, current_date), jsonb_build_object(
      'to', jsonb_build_array(v_email), 'name', v_name, 'client', v_client, 'start', v_first,
      'shift', v_pl.shift_start || '–' || v_pl.shift_end, 'zone', v_pl.time_zone,
      'operator_id', v_pl.operator_id, 'case_file_id', v_pl.case_file_id));
  end if;
  v_intro := coalesce(v_w.payload #>> '{reporting,intro}', 'activation');
  if v_intro <> 'none' then
    select coalesce(c.recipient_emails || c.extra_emails, '{}') into v_recipients
    from public.sales_report_config c where c.placement_id = v_pl.id;
    if v_recipients is null or cardinality(v_recipients) = 0 then
      select array[lower(btrim(contact_email))] into v_recipients
      from public.client_case_file where id = v_pl.case_file_id and contact_email is not null;
    end if;
    if v_recipients is not null and cardinality(v_recipients) > 0 then
      perform app.placement_queue_mail(v_pl.id, 'client.operator_introduction',
        case when v_intro = 'date' then coalesce(nullif(v_w.payload #>> '{reporting,intro_on}', '')::date, current_date) else current_date end,
        jsonb_build_object('to', to_jsonb(v_recipients), 'operator', v_name, 'client', v_client,
          'start', v_first, 'operator_id', v_pl.operator_id, 'case_file_id', v_pl.case_file_id));
    end if;
  end if;
  if app.is_manager() and not app.is_admin() then
    perform app.placement_queue_mail(v_pl.id, 'alerts.manager_activated', current_date, jsonb_build_object(
      'to', coalesce((select jsonb_agg(p.email) from public.profile p where p.role in ('admin', 'owner') and p.state = 'active' and p.email is not null), '[]'::jsonb),
      'operator', v_name, 'client', v_client, 'manager', coalesce(app.profile_name(auth.uid()), 'A manager'),
      'operator_id', v_pl.operator_id, 'case_file_id', v_pl.case_file_id));
  end if;

  perform app.audit('workspace.placement.activated', 'placement', v_pl.id::text,
    format('Activated the placement for %s. Status is %s.', v_name, case when v_live then 'active' else 'scheduled' end),
    null, jsonb_build_object('mode', p_mode, 'first_day', v_first), v_pl.case_file_id);
  return jsonb_build_object('placement_id', v_pl.id, 'status', case when v_live then 'active' else 'scheduled' end);
end;
$$;

-- Lifecycle -------------------------------------------------------------------

create or replace function public.so_placement_lifecycle(p_placement uuid, p_action text, p_body jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pl public.placement;
  v_reason text := nullif(btrim(coalesce(p_body ->> 'reason', '')), '');
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_email text;
  v_name text;
  v_client text;
  v_weekly boolean;
  v_daily boolean;
  v_last date;
  v_return date;
  v_today date;
begin
  if app.is_impersonating() then
    raise exception 'view_as_read_only: exit View As to change a placement' using errcode = '42501';
  end if;
  if not app.is_admin() and not app.so_manages_placement(p_placement) then
    raise exception 'permission_denied: managers and DA Admin only' using errcode = '42501';
  end if;
  if v_reason is null or length(v_reason) < 8 then
    raise exception 'reason_required: this change needs a reason' using errcode = '23514';
  end if;
  select * into v_pl from public.placement where id = p_placement for update;
  if v_pl.id is null then
    raise exception 'not_found: that placement does not exist' using errcode = 'P0002';
  end if;
  select coalesce(p.email, o.email), o.name into v_email, v_name
  from public.operator o left join public.profile p on p.id = o.profile_id where o.id = v_pl.operator_id;
  select name into v_client from public.client_case_file where id = v_pl.case_file_id;
  v_today := (now() at time zone v_pl.time_zone)::date;

  if v_action = 'pause' then
    if v_pl.status <> 'active' then
      raise exception 'invalid_transition: only an active placement can be paused' using errcode = '23514';
    end if;
    begin
      v_return := nullif(p_body ->> 'return_on', '')::date;
    exception when others then
      v_return := null;
    end;
    if v_return is null then
      raise exception 'required: an expected return date is required' using errcode = '23514';
    end if;
    select c.weekly_enabled, c.daily_enabled into v_weekly, v_daily from public.sales_report_config c where c.placement_id = v_pl.id;
    update public.sales_report_config set weekly_enabled = false, daily_enabled = false, updated_at = now() where placement_id = v_pl.id;
    update public.placement set status = 'paused', paused_at = now() where id = v_pl.id;
    insert into public.placement_wizard (placement_id, pause_return, payload, created_by)
    values (v_pl.id, v_return, jsonb_build_object('report_hold', jsonb_build_object('weekly', v_weekly, 'daily', v_daily)), auth.uid())
    on conflict (placement_id) do update
      set pause_return = excluded.pause_return,
          payload = public.placement_wizard.payload || jsonb_build_object('report_hold', excluded.payload -> 'report_hold'),
          updated_at = now();
    insert into public.sales_excused_day (operator_id, placement_id, work_date, reason, note, excused_by)
    values (v_pl.operator_id, v_pl.id, v_today, 'other', 'Placement paused. ' || v_reason, auth.uid())
    on conflict (placement_id, work_date) do nothing;
    if v_email is not null then
      perform app.placement_queue_mail(v_pl.id, 'operator.placement_paused', current_date, jsonb_build_object(
        'to', jsonb_build_array(v_email), 'name', v_name, 'client', v_client, 'reason', v_reason, 'return_on', v_return,
        'operator_id', v_pl.operator_id, 'case_file_id', v_pl.case_file_id));
    end if;
    if coalesce((p_body ->> 'tell_client')::boolean, false) then
      perform app.placement_queue_mail(v_pl.id, 'client.placement_paused', current_date, jsonb_build_object(
        'to', coalesce(
          (select to_jsonb(c.recipient_emails || c.extra_emails) from public.sales_report_config c where c.placement_id = v_pl.id and cardinality(c.recipient_emails || c.extra_emails) > 0),
          (select to_jsonb(array[lower(btrim(cf.contact_email))]) from public.client_case_file cf where cf.id = v_pl.case_file_id and cf.contact_email is not null),
          '[]'::jsonb),
        'operator', v_name, 'client', v_client, 'return_on', v_return, 'case_file_id', v_pl.case_file_id));
    end if;
    perform app.hire_refresh(v_pl.operator_id, v_reason);
  elsif v_action = 'resume' then
    if v_pl.status <> 'paused' then
      raise exception 'invalid_transition: only a paused placement can resume' using errcode = '23514';
    end if;
    if exists (select 1 from public.placement other where other.operator_id = v_pl.operator_id and other.id <> v_pl.id and other.status in ('active', 'scheduled')) then
      raise exception 'already_active: this operator already has an open placement' using errcode = '23505';
    end if;
    update public.placement set status = 'active', paused_at = null where id = v_pl.id;
    update public.sales_report_config c set
      weekly_enabled = coalesce((w.payload #>> '{report_hold,weekly}')::boolean, true),
      daily_enabled = coalesce((w.payload #>> '{report_hold,daily}')::boolean, false),
      updated_at = now()
    from public.placement_wizard w
    where w.placement_id = v_pl.id and c.placement_id = v_pl.id;
    update public.placement_wizard set pause_return = null, updated_at = now() where placement_id = v_pl.id;
    insert into public.sales_excused_day (operator_id, placement_id, work_date, reason, note, excused_by)
    values (v_pl.operator_id, v_pl.id, v_today, 'other', 'EODs restart the next working day.', auth.uid())
    on conflict (placement_id, work_date) do nothing;
    perform app.hire_refresh(v_pl.operator_id, v_reason);
  elsif v_action = 'end' then
    begin
      v_last := nullif(p_body ->> 'last_day', '')::date;
    exception when others then
      v_last := null;
    end;
    if v_last is null then
      raise exception 'required: a last day is required' using errcode = '23514';
    end if;
    if v_last > v_today then
      update public.placement set end_date = v_last where id = v_pl.id;
      insert into public.placement_wizard (placement_id, end_on, payload, created_by)
      values (v_pl.id, v_last, '{}'::jsonb, auth.uid())
      on conflict (placement_id) do update set end_on = excluded.end_on, updated_at = now();
    else
      update public.placement set status = 'ended', end_date = v_last, closed_on = v_last, paused_at = null where id = v_pl.id;
      insert into public.operator_offboard_item (operator_id, item_key, label)
      values (v_pl.operator_id, 'ghl_user_' || v_pl.case_file_id::text, 'Remove this operator''s user in ' || coalesce(v_client, 'the client') || ' GHL')
      on conflict (operator_id, item_key) do nothing;
      perform app.hire_refresh(v_pl.operator_id, v_reason);
    end if;
    if v_email is not null then
      perform app.placement_queue_mail(v_pl.id, 'operator.placement_ended', v_last, jsonb_build_object(
        'to', jsonb_build_array(v_email), 'name', v_name, 'client', v_client, 'last_day', v_last, 'reason', v_reason,
        'operator_id', v_pl.operator_id, 'case_file_id', v_pl.case_file_id));
    end if;
  else
    raise exception 'invalid: action is pause, resume, or end' using errcode = '23514';
  end if;

  perform app.audit('workspace.placement.' || v_action, 'placement', v_pl.id::text,
    format('%s the placement for %s. %s', initcap(v_action), v_name, v_reason),
    null, p_body, v_pl.case_file_id);
  return jsonb_build_object('placement_id', v_pl.id, 'action', v_action);
end;
$$;

create or replace function public.so_placement_swap(p_placement uuid, p_body jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_w public.placement_wizard;
  v_new uuid;
  v_payload jsonb;
begin
  perform public.so_placement_lifecycle(p_placement, 'end', p_body);
  select * into v_w from public.placement_wizard where placement_id = p_placement;
  v_payload := coalesce(v_w.payload, '{}'::jsonb);
  v_payload := v_payload || jsonb_build_object('operator_id', '', 'not_ready_reason', '');
  v_payload := jsonb_set(v_payload, '{reporting,intro}', '"activation"'::jsonb, true);
  if jsonb_typeof(v_payload -> 'ghl') = 'object' then
    v_payload := jsonb_set(v_payload, '{ghl,user_id}', '""'::jsonb, true);
    v_payload := jsonb_set(v_payload, '{ghl,user_pending}', 'false'::jsonb, true);
  end if;
  insert into public.placement_wizard (step, template_slug, payload, created_by)
  values (1, v_w.template_slug, v_payload, auth.uid())
  returning id into v_new;
  perform app.audit('workspace.placement.swap', 'placement', p_placement::text,
    'Opened a new draft on this client for a replacement operator',
    null, jsonb_build_object('wizard_id', v_new, 'reason', p_body ->> 'reason'));
  return jsonb_build_object('wizard_id', v_new, 'placement_id', p_placement);
end;
$$;

create or replace function public.so_placement_edit(p_placement uuid, p_body jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pl public.placement;
  v_reason text := nullif(btrim(coalesce(p_body ->> 'reason', '')), '');
  v_schedule jsonb := p_body -> 'schedule';
  v_offer jsonb := p_body -> 'offer';
  v_summary text;
  v_days smallint[];
begin
  if app.is_impersonating() then
    raise exception 'view_as_read_only: exit View As to edit a placement' using errcode = '42501';
  end if;
  if not app.is_admin() and not app.so_manages_placement(p_placement) then
    raise exception 'permission_denied: managers and DA Admin only' using errcode = '42501';
  end if;
  if v_reason is null or length(v_reason) < 8 then
    raise exception 'reason_required: an edit needs a reason' using errcode = '23514';
  end if;
  select * into v_pl from public.placement where id = p_placement for update;
  if v_pl.status in ('ended', 'renewed') then
    raise exception 'ended: an ended placement is a record' using errcode = '23514';
  end if;

  if jsonb_typeof(v_offer) = 'object' then
    v_summary := nullif(concat_ws(e'\n',
      case when length(btrim(coalesce(v_offer ->> 'one_liner', ''))) > 0 then 'Business: ' || btrim(v_offer ->> 'one_liner') end,
      case when length(btrim(coalesce(v_offer ->> 'service_area', ''))) > 0 then 'Service area: ' || btrim(v_offer ->> 'service_area') end,
      case when length(btrim(coalesce(v_offer ->> 'ideal_customer', ''))) > 0 then 'Ideal customer: ' || btrim(v_offer ->> 'ideal_customer') end,
      case when length(btrim(coalesce(v_offer ->> 'booking_rules', ''))) > 0 then 'Booking rules: ' || btrim(v_offer ->> 'booking_rules') end,
      case when length(btrim(coalesce(v_offer ->> 'never', ''))) > 0 then 'Never: ' || btrim(v_offer ->> 'never') end
    ), '');
    update public.placement set campaign_summary = coalesce(v_summary, campaign_summary) where id = p_placement;
    insert into public.placement_wizard (placement_id, payload, created_by)
    values (p_placement, jsonb_build_object('offer', v_offer), auth.uid())
    on conflict (placement_id) do update
      set payload = jsonb_set(public.placement_wizard.payload, '{offer}', v_offer, true), updated_at = now();
  end if;

  if jsonb_typeof(v_schedule) = 'object' then
    if v_pl.status in ('draft', 'scheduled') then
      select coalesce(array_agg(distinct x::smallint order by x::smallint), v_pl.working_days) into v_days
      from jsonb_array_elements_text(coalesce(v_schedule -> 'working_days', '[]'::jsonb)) t(x)
      where x ~ '^[1-7]$';
      update public.placement set
        time_zone = coalesce(nullif(v_schedule ->> 'time_zone', ''), time_zone),
        working_days = coalesce(v_days, working_days),
        shift_start = coalesce(nullif(v_schedule ->> 'shift_start', ''), shift_start),
        shift_end = coalesce(nullif(v_schedule ->> 'shift_end', ''), shift_end),
        eod_deadline = coalesce(nullif(v_schedule ->> 'eod_deadline', ''), eod_deadline)
      where id = p_placement;
    else
      insert into public.placement_wizard (placement_id, pending_schedule, pending_on, created_by)
      values (p_placement, v_schedule, app.placement_next_work_day(v_pl), auth.uid())
      on conflict (placement_id) do update
        set pending_schedule = excluded.pending_schedule,
            pending_on = excluded.pending_on,
            updated_at = now();
    end if;
  end if;

  perform app.audit('workspace.placement.edited', 'placement', p_placement::text,
    'Edited the placement. Schedule changes on a live placement start the next working day. ' || v_reason,
    null, p_body, v_pl.case_file_id);
end;
$$;

create or replace function public.so_placement_board()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app.is_admin() and not app.is_manager() then
    raise exception 'permission_denied: managers and DA Admin only' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.start_date desc nulls last, x.operator)
    from (
      select pl.id as placement_id, w.id as wizard_id, op.name as operator, c.name as client,
        coalesce(nullif(btrim(m.full_name), ''), m.email) as manager,
        pl.start_date,
        case
          when pl.status = 'scheduled' then 'scheduled'
          when pl.status = 'draft' then 'draft'
          when pl.status = 'renewed' then 'ended'
          else pl.status::text
        end as display_status,
        case
          when not exists (
            select 1 from public.ghl_connection g
            where g.case_file_id = pl.case_file_id and g.retired_at is null and g.replaces_id is null and g.level = 'location'
          ) then 'not_connected'
          when l.status = 'connected' then 'connected'
          when l.status = 'needs_attention' then 'needs_attention'
          else 'disconnected'
        end as ghl_status,
        (
          select count(*) from jsonb_array_elements(app.placement_checklist(pl.id)) item
          where (item ->> 'blocking')::boolean
        ) as open_items
      from public.placement pl
      join public.operator op on op.id = pl.operator_id
      join public.client_case_file c on c.id = pl.case_file_id
      left join public.profile m on m.id = pl.manager_profile_id
      left join public.placement_wizard w on w.placement_id = pl.id
      left join public.sales_ghl_link l on l.placement_id = pl.id
      where app.is_admin() or pl.manager_profile_id = auth.uid() or w.created_by = auth.uid()
      union all
      select null::uuid, w.id, op.name, c.name, null::text, null::date, 'draft', 'not_connected', null::bigint
      from public.placement_wizard w
      left join public.operator op on op.id = nullif(w.payload ->> 'operator_id', '')::uuid
      left join public.client_case_file c on c.id = nullif(w.payload ->> 'case_file_id', '')::uuid
      where w.placement_id is null and (app.is_admin() or w.created_by = auth.uid())
    ) x
  ), '[]'::jsonb);
end;
$$;

create or replace function public.so_placement_extras(p_placement uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pl public.placement;
  v_w public.placement_wizard;
begin
  if not app.is_admin() and not app.so_manages_placement(p_placement) and not exists (
    select 1 from public.placement_wizard w where w.placement_id = p_placement and w.created_by = auth.uid()
  ) then
    raise exception 'out_of_scope: that placement is not yours' using errcode = '42501';
  end if;
  select * into v_pl from public.placement where id = p_placement;
  select * into v_w from public.placement_wizard where placement_id = p_placement;
  return jsonb_build_object(
    'wizard_id', v_w.id,
    'wizard_status', v_w.status,
    'scheduled_for', v_w.scheduled_for,
    'pending_on', v_w.pending_on,
    'pending_schedule', v_w.pending_schedule,
    'end_on', v_w.end_on,
    'pause_return', v_w.pause_return,
    'offer', coalesce(v_w.payload -> 'offer', '{}'::jsonb),
    'phone', v_w.payload #>> '{ghl,phone}',
    'launch_week', coalesce((v_w.payload ->> 'launch_week')::boolean, true),
    'template_slug', v_w.template_slug,
    'checklist', app.placement_checklist(p_placement),
    'targets', coalesce((
      select jsonb_agg(jsonb_build_object('metric', t.metric_key, 'daily', t.daily, 'weekly', t.weekly, 'from', t.effective_from) order by t.effective_from desc)
      from (
        select distinct on (metric_key) metric_key, daily, weekly, effective_from
        from public.activity_target
        where placement_id = p_placement and layer = 'override'
        order by metric_key, effective_from desc, set_at desc
      ) t
    ), '[]'::jsonb),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object('at', e.at, 'action', e.action, 'summary', e.summary, 'actor', e.actor_email) order by e.at desc)
      from (
        select at, action, summary, actor_email from public.audit_event
        where entity_id = p_placement::text
        order by at desc
        limit 40
      ) e
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.so_offer_brief(p_placement uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pl public.placement;
  v_w public.placement_wizard;
  v_offer jsonb;
begin
  if p_placement is null then
    select pl.* into v_pl
    from public.placement pl
    join public.operator o on o.id = pl.operator_id
    where o.profile_id = app.acting_profile() and pl.status in ('active', 'scheduled')
    order by (pl.status = 'active') desc, pl.start_date desc
    limit 1;
  else
    select * into v_pl from public.placement where id = p_placement;
    if v_pl.id is null then
      return null;
    end if;
    if not app.is_admin() and not app.so_manages_placement(p_placement) and not exists (
      select 1 from public.operator o where o.id = v_pl.operator_id and o.profile_id = app.acting_profile()
    ) then
      raise exception 'out_of_scope: that placement is not yours' using errcode = '42501';
    end if;
  end if;
  if v_pl.id is null then
    return null;
  end if;
  select * into v_w from public.placement_wizard where placement_id = v_pl.id;
  v_offer := coalesce(v_w.payload -> 'offer', '{}'::jsonb);
  if nullif(btrim(coalesce(v_offer ->> 'one_liner', '')), '') is null and nullif(btrim(coalesce(v_pl.campaign_summary, '')), '') is not null then
    v_offer := v_offer || jsonb_build_object('one_liner', v_pl.campaign_summary);
  end if;
  return jsonb_build_object(
    'placement_id', v_pl.id,
    'client', (select name from public.client_case_file where id = v_pl.case_file_id),
    'status', v_pl.status,
    'start_date', v_pl.start_date,
    'time_zone', v_pl.time_zone,
    'shift_start', v_pl.shift_start,
    'shift_end', v_pl.shift_end,
    'working_days', to_jsonb(v_pl.working_days),
    'offer', v_offer,
    'outcomes', coalesce((
      select jsonb_agg(jsonb_build_object('name', o.name, 'definition', o.definition) order by o.sort_order, o.name)
      from public.placement_outcome_type o where o.placement_id = v_pl.id and o.active
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.so_placement_mail_claim()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.is_admin() and not app.is_manager() then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  return coalesce((
    with due as (
      select id from public.placement_mail_job
      where sent_at is null and send_on <= current_date
        and (claimed_at is null or claimed_at < now() - interval '15 minutes')
      order by send_on
      limit 20
      for update skip locked
    ),
    marked as (
      update public.placement_mail_job j
         set claimed_at = now()
        from due
       where j.id = due.id
       returning j.id, j.placement_id, j.kind, j.payload
    )
    select jsonb_agg(jsonb_build_object('id', id, 'placement_id', placement_id, 'kind', kind, 'payload', payload))
    from marked
  ), '[]'::jsonb);
end;
$$;

create or replace function public.so_placement_mail_finish(p_id uuid, p_ok boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.is_admin() and not app.is_manager() then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if coalesce(p_ok, false) then
    update public.placement_mail_job set sent_at = now() where id = p_id;
  else
    update public.placement_mail_job set claimed_at = null where id = p_id and sent_at is null;
  end if;
end;
$$;

create or replace function public.so_placement_sweep()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pl public.placement;
  v_w public.placement_wizard;
  v_days smallint[];
  v_client text;
begin
  for v_pl in
    select pl.* from public.placement pl
    where pl.status = 'scheduled'
      and now() >= ((app.placement_first_work_day(pl) + pl.shift_start::time) at time zone pl.time_zone)
  loop
    update public.placement set status = 'active' where id = v_pl.id and status = 'scheduled';
    update public.placement_wizard set status = 'activated', updated_at = now() where placement_id = v_pl.id;
    perform app.hire_refresh(v_pl.operator_id, 'Scheduled placement reached its shift start');
  end loop;

  for v_w in
    select * from public.placement_wizard
    where end_on is not null and end_on <= current_date
  loop
    select * into v_pl from public.placement where id = v_w.placement_id and status in ('active', 'paused', 'scheduled');
    if v_pl.id is null then
      continue;
    end if;
    select name into v_client from public.client_case_file where id = v_pl.case_file_id;
    update public.placement set status = 'ended', closed_on = v_w.end_on, end_date = v_w.end_on, paused_at = null where id = v_pl.id;
    insert into public.operator_offboard_item (operator_id, item_key, label)
    values (v_pl.operator_id, 'ghl_user_' || v_pl.case_file_id::text, 'Remove this operator''s user in ' || coalesce(v_client, 'the client') || ' GHL')
    on conflict (operator_id, item_key) do nothing;
    update public.placement_wizard set end_on = null, updated_at = now() where id = v_w.id;
    perform app.hire_refresh(v_pl.operator_id, 'Placement reached its last day');
  end loop;

  for v_w in
    select w.*
    from public.placement_wizard w
    join public.placement pl on pl.id = w.placement_id
    where w.pending_on is not null and w.pending_schedule is not null
      and w.pending_on <= (now() at time zone pl.time_zone)::date
      and pl.status in ('active', 'paused')
  loop
    select * into v_pl from public.placement where id = v_w.placement_id;
    select coalesce(array_agg(distinct x::smallint order by x::smallint), v_pl.working_days) into v_days
    from jsonb_array_elements_text(coalesce(v_w.pending_schedule -> 'working_days', '[]'::jsonb)) t(x)
    where x ~ '^[1-7]$';
    update public.placement set
      time_zone = coalesce(nullif(v_w.pending_schedule ->> 'time_zone', ''), time_zone),
      working_days = coalesce(v_days, working_days),
      shift_start = coalesce(nullif(v_w.pending_schedule ->> 'shift_start', ''), shift_start),
      shift_end = coalesce(nullif(v_w.pending_schedule ->> 'shift_end', ''), shift_end),
      eod_deadline = coalesce(nullif(v_w.pending_schedule ->> 'eod_deadline', ''), eod_deadline)
    where id = v_pl.id;
    update public.placement_wizard set pending_schedule = null, pending_on = null, updated_at = now() where id = v_w.id;
  end loop;
end;
$$;

revoke all on function public.so_template_list() from public, anon;
revoke all on function public.so_template_save(jsonb) from public, anon;
revoke all on function public.so_wizard_bundle(uuid) from public, anon;
revoke all on function public.so_wizard_save(jsonb) from public, anon;
revoke all on function public.so_launch_waive(uuid, text, text) from public, anon;
revoke all on function public.so_wizard_activate(uuid, text) from public, anon;
revoke all on function public.so_placement_lifecycle(uuid, text, jsonb) from public, anon;
revoke all on function public.so_placement_swap(uuid, jsonb) from public, anon;
revoke all on function public.so_placement_edit(uuid, jsonb) from public, anon;
revoke all on function public.so_placement_board() from public, anon;
revoke all on function public.so_placement_extras(uuid) from public, anon;
revoke all on function public.so_offer_brief(uuid) from public, anon;
revoke all on function public.so_placement_mail_claim() from public, anon;
revoke all on function public.so_placement_mail_finish(uuid, boolean) from public, anon;
revoke all on function public.so_placement_sweep() from public, anon;

grant execute on function public.so_template_list() to authenticated;
grant execute on function public.so_template_save(jsonb) to authenticated;
grant execute on function public.so_wizard_bundle(uuid) to authenticated;
grant execute on function public.so_wizard_save(jsonb) to authenticated;
grant execute on function public.so_launch_waive(uuid, text, text) to authenticated;
grant execute on function public.so_wizard_activate(uuid, text) to authenticated;
grant execute on function public.so_placement_lifecycle(uuid, text, jsonb) to authenticated;
grant execute on function public.so_placement_swap(uuid, jsonb) to authenticated;
grant execute on function public.so_placement_edit(uuid, jsonb) to authenticated;
grant execute on function public.so_placement_board() to authenticated;
grant execute on function public.so_placement_extras(uuid) to authenticated;
grant execute on function public.so_offer_brief(uuid) to authenticated;
grant execute on function public.so_placement_mail_claim() to authenticated;
grant execute on function public.so_placement_mail_finish(uuid, boolean) to authenticated;
grant execute on function public.so_placement_sweep() to authenticated;

select cron.schedule('placement-wizard-sweep', '*/15 * * * *', 'select public.so_placement_sweep()');
