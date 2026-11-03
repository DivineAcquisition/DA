-- The checklist joined a jsonb element aliased as item onto waiver.item and confirm.item.
-- Postgres then treated the bare name item as the text column, so every wizard save failed
-- when it read the checklist. The element is now entry.

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
      entry || jsonb_build_object(
        'waived', w.reason is not null,
        'waiver_reason', w.reason,
        'overdue', (entry ->> 'gate') = 'two_days' and coalesce((entry ->> 'met')::boolean, false) = false and w.reason is null and v_elapsed > 2,
        'blocking', (entry ->> 'gate') = 'activation' and coalesce((entry ->> 'met')::boolean, false) = false and w.reason is null,
        'open', coalesce((entry ->> 'met')::boolean, false) = false and w.reason is null and (
          (entry ->> 'gate') = 'activation'
          or ((entry ->> 'gate') = 'two_days' and v_elapsed > 2)
          or ((entry ->> 'gate') = 'first_report' and v_pl.status in ('active', 'paused', 'scheduled'))
        ),
        'checked_at', conf.confirmed_at,
        'checked_by', coalesce(nullif(btrim(pr.full_name), ''), pr.email)
      )
      order by entry ->> 'key')
    from jsonb_array_elements(v_items) entry
    left join public.placement_launch_waiver w on w.placement_id = p_placement and w.item = entry ->> 'key'
    left join public.placement_launch_confirm conf on conf.placement_id = p_placement and conf.item = entry ->> 'key'
    left join public.profile pr on pr.id = conf.confirmed_by
  ), '[]'::jsonb);
end;
$$;


