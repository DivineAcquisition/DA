-- Outcomes can be mapped to tag combinations, and a client introduction can be held for preview.
-- A calendar or a stage still counts. A tag rule counts when every "all" tag is present and,
-- when "any" is set, at least one of those tags is present. The sync reads those tags from
-- contacts. A held introduction is queued and is not claimed until someone releases it.

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
  v_launch public.placement_launch;
  v_offer jsonb := '{}'::jsonb;
  v_map jsonb := '{}'::jsonb;
  v_stage text;
  v_role text;
  v_profile uuid;
  v_ready boolean;
  v_agreement boolean;
  v_cert boolean;
  v_offer_ok boolean;
  v_recipients integer := 0;
  v_outcomes integer := 0;
  v_mapped integer := 0;
  v_today date;
  v_elapsed integer := 0;
  v_href text;
  v_op text;
  v_items jsonb := '[]'::jsonb;
  v_intro boolean;
begin
  select * into v_pl from public.placement where id = p_placement;
  if v_pl.id is null then
    return '[]'::jsonb;
  end if;
  select * into v_w from public.placement_wizard where placement_id = p_placement;
  select * into v_launch from public.placement_launch where placement_id = p_placement;
  select o.profile_id, j.stage into v_profile, v_stage
  from public.operator o
  left join public.operator_journey j on j.operator_id = o.id
  where o.id = v_pl.operator_id;
  v_offer := coalesce(v_w.payload -> 'offer', '{}'::jsonb);
  v_today := (now() at time zone v_pl.time_zone)::date;
  v_elapsed := coalesce(app.placement_days_elapsed(v_pl, v_today), 0);
  v_href := '/workspace/sales-ops/placements/' || p_placement::text;
  v_op := '/workspace/team/workspace/operators/' || v_pl.operator_id::text;
  v_ready := app.hire_ready(v_pl.operator_id)
    or (v_stage in ('placed', 'paused') and v_pl.status in ('active', 'paused', 'scheduled', 'ended'))
    or (v_stage is null and v_pl.status <> 'draft');
  v_agreement := (v_stage is null and v_pl.status <> 'draft') or app.hire_agreement_signed(v_pl.operator_id);
  v_cert := (v_stage is null and v_pl.status <> 'draft')
    or coalesce(app.cert_override_access(v_pl.operator_id), false)
    or (v_profile is not null and coalesce(app.so_certification_level(v_profile), 0) >= 1);
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
  if jsonb_typeof(v_map -> 'outcomes') = 'array' then
    select count(*) into v_mapped from jsonb_array_elements(v_map -> 'outcomes') item
    where nullif(item ->> 'calendar_id', '') is not null
       or nullif(item ->> 'stage_id', '') is not null
       or jsonb_array_length(coalesce(item #> '{tags,all}', '[]'::jsonb)) > 0
       or jsonb_array_length(coalesce(item #> '{tags,any}', '[]'::jsonb)) > 0;
  end if;
  v_intro := coalesce(v_launch.intro_not_needed, false)
    or coalesce(v_w.payload #>> '{reporting,intro}', 'activation') = 'none'
    or exists (
      select 1 from public.email_log e
      where e.placement_id = p_placement and e.template = 'client.operator_introduction'
        and e.status in ('sent', 'delivered', 'queued', 'delayed')
    )
    or exists (
      select 1 from public.placement_mail_job j
      where j.placement_id = p_placement and j.kind = 'client.operator_introduction' and j.sent_at is not null
    );

  v_items := jsonb_build_array(
    jsonb_build_object('key', 'readiness', 'gate', 'activation', 'automatic', true,
      'label', 'Operator readiness is complete.',
      'fix', 'Finish the readiness checklist, or have DA Admin waive it with a reason.',
      'href', v_op, 'met', v_ready),
    jsonb_build_object('key', 'agreement', 'gate', 'activation', 'automatic', true,
      'label', 'The operator agreement is signed.',
      'fix', 'The operator signs the agreement, or DA Admin waives it with a reason.',
      'href', v_op, 'met', v_agreement),
    jsonb_build_object('key', 'certification', 'gate', 'activation', 'automatic', true,
      'label', 'Certification is current, or an override is active.',
      'fix', 'Finish Academy Level 1, or ask DA Admin for an override.',
      'href', v_op, 'met', v_cert),
    jsonb_build_object('key', 'schedule', 'gate', 'activation', 'automatic', true,
      'label', 'Schedule is complete: time zone, working days, shift, and EOD deadline.',
      'fix', 'Set the time zone, at least one working day, the shift, and the EOD deadline.',
      'href', v_href || '?tab=schedule',
      'met', v_pl.time_zone is not null and cardinality(v_pl.working_days) > 0
        and v_pl.shift_start is not null and v_pl.shift_end is not null
        and coalesce(v_pl.eod_deadline, v_pl.shift_end) is not null
        and (v_w.id is null or coalesce((v_w.payload ->> 'schedule_confirmed')::boolean, false) or v_pl.status <> 'draft')),
    jsonb_build_object('key', 'outcomes', 'gate', 'activation', 'automatic', true,
      'label', 'At least one positive outcome is defined.',
      'fix', 'Add one positive outcome and what counts as that win.',
      'href', v_href || '?tab=schedule', 'met', v_outcomes > 0),
    jsonb_build_object('key', 'offer', 'gate', 'activation', 'automatic', true,
      'label', 'The offer brief has its required fields.',
      'fix', 'Write the business line, service area, ideal customer, booking rules, and what never to do.',
      'href', v_href || '?tab=offer', 'met', v_offer_ok),
    jsonb_build_object('key', 'recipients', 'gate', 'activation', 'automatic', true,
      'label', 'At least one client report recipient is chosen.',
      'fix', 'Pick a contact on the client, or add an extra recipient.',
      'href', v_href || '?tab=reporting', 'met', v_recipients > 0),
    jsonb_build_object('key', 'ghl_test', 'gate', 'activation', 'automatic', true,
      'label', 'The GHL connection test passed.',
      'fix', 'DA Admin runs Test connection on the GHL step until the sub-account answers.',
      'href', v_href || '?tab=ghl',
      'met', exists (
        select 1 from public.ghl_connection c
        where c.case_file_id = v_pl.case_file_id and c.retired_at is null and c.replaces_id is null
          and c.level = 'location' and c.status = 'healthy' and c.last_success_at is not null
      )),
    jsonb_build_object('key', 'ghl_user', 'gate', 'activation', 'automatic', true,
      'label', 'The operator''s GHL user is mapped.',
      'fix', 'Choose the operator''s own user in the client sub-account.',
      'href', v_href || '?tab=ghl',
      'met', exists (
        select 1 from public.sales_ghl_link l
        where l.placement_id = p_placement and nullif(btrim(coalesce(l.ghl_user_id, '')), '') is not null
      )),
    jsonb_build_object('key', 'ghl_signin', 'gate', 'activation', 'automatic', false,
      'label', 'The operator confirmed they can sign in to this client''s GHL with their own user.',
      'fix', 'The operator opens their workspace and confirms the GHL sign-in.',
      'href', '/workspace/operator/workspace',
      'met', exists (
        select 1 from public.placement_ghl_readiness r
        where r.operator_id = v_pl.operator_id and r.client_case_file_id = v_pl.case_file_id
          and r.operator_confirmed_at is not null
      ) or exists (
        select 1 from public.placement_launch_confirm c
        where c.placement_id = p_placement and c.item = 'ghl_signin'
      )),
    jsonb_build_object('key', 'one_active', 'gate', 'activation', 'automatic', true,
      'label', 'This operator does not already have another open placement.',
      'fix', 'Pause or end the other open placement before this one is activated.',
      'href', v_op,
      'met', not exists (
        select 1 from public.placement other
        where other.operator_id = v_pl.operator_id and other.id <> v_pl.id and other.status in ('active', 'scheduled')
      )),
    jsonb_build_object('key', 'outcome_mapping', 'gate', 'two_days', 'automatic', true,
      'label', 'Every positive outcome is mapped in GHL.',
      'fix', 'Map each outcome to a calendar, a stage, or a tag combination. This is due within two working days.',
      'href', v_href || '?tab=ghl', 'met', v_outcomes > 0 and v_mapped >= v_outcomes),
    jsonb_build_object('key', 'speed', 'gate', 'two_days', 'automatic', true,
      'label', 'Speed-to-lead leads are mapped.',
      'fix', 'Choose the leads used for speed-to-lead. This is due within two working days.',
      'href', v_href || '?tab=ghl',
      'met', jsonb_typeof(v_map #> '{speed,ids}') = 'array' and jsonb_array_length(v_map #> '{speed,ids}') > 0),
    jsonb_build_object('key', 'first_sync', 'gate', 'two_days', 'automatic', true,
      'label', 'The first sync returned real activity for this operator.',
      'fix', 'Wait for the next GHL sync, or confirm the operator''s user is the one placing calls and texts.',
      'href', v_href || '?tab=ghl',
      'met', exists (
        select 1 from public.activity_value val
        join public.activity_day d on d.id = val.activity_day_id
        where d.placement_id = p_placement and val.source = 'ghl' and val.value > 0
          and val.metric_key in ('dials_made', 'texts_sent', 'emails_sent', 'conversations_held', 'connects')
      )),
    jsonb_build_object('key', 'first_eod', 'gate', 'two_days', 'automatic', true,
      'label', 'The first EOD is submitted.',
      'fix', 'The operator submits an end of day.',
      'href', '/workspace/team/workspace/eods',
      'met', exists (
        select 1 from public.sales_eod e where e.placement_id = p_placement and e.submitted_at is not null
      )),
    jsonb_build_object('key', 'test_report', 'gate', 'first_report', 'automatic', false,
      'label', 'The manager sent a test report to themselves and reviewed it.',
      'fix', 'Send a test report from Client reporting, then confirm you reviewed it.',
      'href', v_href || '?tab=reporting',
      'met', v_launch.test_report_at is not null or exists (
        select 1 from public.sales_report r where r.placement_id = p_placement and r.test
      )),
    jsonb_build_object('key', 'introduction', 'gate', 'first_report', 'automatic', true,
      'label', 'The client introduction was sent, or marked not needed.',
      'fix', 'Send the introduction from the reporting step, or mark it not needed.',
      'href', v_href || '?tab=reporting', 'met', v_intro)
  );
  if 'reactivation' = any (v_pl.activity_categories) then
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'key', 'reactivation', 'gate', 'two_days', 'automatic', true,
      'label', 'The reactivation list is mapped.',
      'fix', 'Map the reactivation list. This is due within two working days.',
      'href', v_href || '?tab=ghl',
      'met', jsonb_typeof(v_map #> '{reactivation,ids}') = 'array' and jsonb_array_length(v_map #> '{reactivation,ids}') > 0
    ));
  end if;

  return coalesce((
    select jsonb_agg(
      item || jsonb_build_object(
        'waived', w.reason is not null,
        'waiver_reason', w.reason,
        'overdue', (item ->> 'gate') = 'two_days' and coalesce((item ->> 'met')::boolean, false) = false and w.reason is null and v_elapsed > 2,
        'blocking', (item ->> 'gate') = 'activation' and coalesce((item ->> 'met')::boolean, false) = false and w.reason is null,
        'open', coalesce((item ->> 'met')::boolean, false) = false and w.reason is null and (
          (item ->> 'gate') = 'activation'
          or ((item ->> 'gate') = 'two_days' and v_elapsed > 2)
          or ((item ->> 'gate') = 'first_report' and v_pl.status in ('active', 'paused', 'scheduled'))
        ),
        'checked_at', conf.confirmed_at,
        'checked_by', coalesce(nullif(btrim(pr.full_name), ''), pr.email)
      )
      order by item ->> 'key')
    from jsonb_array_elements(v_items) item
    left join public.placement_launch_waiver w on w.placement_id = p_placement and w.item = item ->> 'key'
    left join public.placement_launch_confirm conf on conf.placement_id = p_placement and conf.item = item ->> 'key'
    left join public.profile pr on pr.id = conf.confirmed_by
  ), '[]'::jsonb);
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
  -- hold queues the letter and the dispatcher skips it until a person releases it.
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
          'start', v_first, 'operator_id', v_pl.operator_id, 'case_file_id', v_pl.case_file_id,
          'hold', v_intro = 'hold'));
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
        and coalesce(payload ->> 'hold', '') is distinct from 'true'
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
        or l.last_success_at is null
        or l.last_success_at < now() - make_interval(mins => coalesce(v_minutes, 15))
      )
  ), '[]'::jsonb);
end;
$$;


revoke all on function public.so_ghl_due() from public, anon, authenticated;
grant execute on function public.so_ghl_due() to service_role;

create or replace function public.so_placement_release_intro(p_placement uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_case uuid;
begin
  if app.is_impersonating() then
    raise exception 'view_as_read_only: exit View As to send the introduction' using errcode = '42501';
  end if;
  if not app.is_admin() and not app.so_manages_placement(p_placement) then
    raise exception 'permission_denied: managers and DA Admin only' using errcode = '42501';
  end if;
  select id into v_id
  from public.placement_mail_job
  where placement_id = p_placement
    and kind = 'client.operator_introduction'
    and sent_at is null
    and coalesce(payload ->> 'hold', '') = 'true'
  for update;
  if v_id is null then
    raise exception 'not_held: there is no held introduction to release' using errcode = 'P0002';
  end if;
  update public.placement_mail_job
     set payload = payload - 'hold',
         send_on = current_date,
         claimed_at = null
   where id = v_id;
  select case_file_id into v_case from public.placement where id = p_placement;
  perform app.audit('workspace.placement.introduction_released', 'placement', p_placement::text,
    'Released the held client introduction', null, jsonb_build_object('mail_job_id', v_id), v_case);
end;
$$;

revoke all on function public.so_placement_release_intro(uuid) from public, anon;
grant execute on function public.so_placement_release_intro(uuid) to authenticated;
