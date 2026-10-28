-- Sales Operator workspace foundation. Self-contained and rolled back.
--
-- Access states from the operator's own record. One active placement per
-- operator. No Active without a positive outcome. Operators read none of the
-- workspace tables directly; a manager reads only assigned placements; nobody
-- but DA Admin reads mismatches, pay impact or client tokens. GHL-only metrics
-- cannot be logged by an operator. Targets keep their history. EOD edits after
-- submission are kept and audited. Placement, target, outcome and settings
-- changes land in the audit log.
\set ON_ERROR_STOP on
set search_path = public;

begin;

-- Fixtures ----------------------------------------------------------------------
create temp table ids (k text primary key, v uuid) on commit drop;

do $$
declare
  v_program uuid := (select id from public.academy_program where slug = 'da-operator-academy');
  n int;
  v_uid uuid;
  v_op uuid;
  v_enr uuid;
begin
  insert into auth.users (id, email) values
    ('98000000-0000-4000-8000-0000000000a1', 'admin@so.test'),
    ('98000000-0000-4000-8000-0000000000b1', 'manager1@so.test'),
    ('98000000-0000-4000-8000-0000000000b2', 'manager2@so.test'),
    ('98000000-0000-4000-8000-0000000000b3', 'manager3@so.test');
  update public.profile set role = 'admin', state = 'active', full_name = 'Admin' where id = '98000000-0000-4000-8000-0000000000a1';
  update public.profile set role = 'manager', state = 'active', full_name = 'Manager One' where id = '98000000-0000-4000-8000-0000000000b1';
  update public.profile set role = 'manager', state = 'active', full_name = 'Manager Two' where id = '98000000-0000-4000-8000-0000000000b2';
  update public.profile set role = 'manager', state = 'active', full_name = 'Manager Three' where id = '98000000-0000-4000-8000-0000000000b3';

  insert into public.client_case_file (id, name, slug) values
    ('98000000-0000-4000-8000-0000000000d1', 'Client One', 'so-client-one'),
    ('98000000-0000-4000-8000-0000000000d2', 'Client Two', 'so-client-two');

  -- c1 active, c2 active (other manager), c3 not certified, c4 awaiting,
  -- c5 paused, c6 ended, c7 deactivated.
  for n in 1..7 loop
    v_uid := ('98000000-0000-4000-8000-0000000000c' || n)::uuid;
    v_op := ('98000000-0000-4000-8000-0000000001c' || n)::uuid;
    insert into auth.users (id, email) values (v_uid, 'op' || n || '@so.test');
    update public.profile set role = 'operator', state = 'active', full_name = 'Operator ' || n where id = v_uid;
    insert into public.operator (id, profile_id, name, email, status) values (v_op, v_uid, 'Operator ' || n, 'op' || n || '@so.test', 'certified');
    insert into ids values ('op' || n, v_op), ('user' || n, v_uid);
    insert into public.academy_enrollment (profile_id, program_id, operator_id, track, status)
    values (v_uid, v_program, v_op, 'sales_operator', 'completed') returning id into v_enr;
    insert into public.academy_certification (enrollment_id, profile_id, level)
    values (v_enr, v_uid, case when n = 3 then 0 else 1 end);
  end loop;
  update public.profile set state = 'suspended' where id = '98000000-0000-4000-8000-0000000000c7';
end $$;

-- Act as someone. Functions read auth.uid(); RLS checks also need the role.
create or replace function pg_temp.as_user(p uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', p::text, true);
$$;

create or replace function pg_temp.placement_input(p_op uuid, p_case uuid, p_manager uuid) returns jsonb language sql as $$
  select jsonb_build_object(
    'operator_id', p_op, 'case_file_id', p_case, 'placement_type', 'client_placed',
    'manager_profile_id', p_manager, 'start_date', current_date, 'time_zone', 'America/New_York',
    'working_days', '[1,2,3,4,5]'::jsonb, 'shift_start', '09:00', 'shift_end', '17:30',
    'campaign_summary', 'Roof inspections for storm-damaged homes.',
    'activity_categories', '["outbound_calling","follow_up"]'::jsonb);
$$;

\echo '== placements are created Pending and only admin creates them =='
do $$
declare v_id uuid;
begin
  perform pg_temp.as_user('98000000-0000-4000-8000-0000000000c1');
  begin
    perform public.so_save_placement(pg_temp.placement_input((select v from ids where k = 'op1'), '98000000-0000-4000-8000-0000000000d1', null));
    raise exception 'an operator created a placement';
  exception when others then
    if sqlerrm not like 'admin_required%' then raise; end if;
  end;

  perform pg_temp.as_user('98000000-0000-4000-8000-0000000000a1');
  v_id := public.so_save_placement(pg_temp.placement_input((select v from ids where k = 'op1'), '98000000-0000-4000-8000-0000000000d1', '98000000-0000-4000-8000-0000000000b1'));
  insert into ids values ('p1', v_id);
  assert (select status from public.placement where id = v_id) = 'draft', 'a new placement is Pending';
  assert (select end_date from public.placement where id = v_id) = date '9999-12-31', 'a blank end date stays open';
  assert (select review_on from public.placement where id = v_id) = (current_date + interval '3 months')::date, 'the review date is three months out';
  assert (select count(*) from public.audit_event where action = 'workspace.placement.created' and entity_id = v_id::text) = 1;
  assert (select count(*) from public.audit_event where action = 'workspace.placement.manager_assigned' and entity_id = v_id::text) = 1;
end $$;

\echo '== no Active without a positive outcome =='
do $$
declare v_p1 uuid := (select v from ids where k = 'p1');
begin
  perform pg_temp.as_user('98000000-0000-4000-8000-0000000000a1');
  begin
    perform public.so_set_placement_status(v_p1, 'active');
    raise exception 'a placement went Active with no outcomes';
  exception when others then
    if sqlerrm not like 'outcomes_required%' then raise; end if;
  end;
  -- The data layer refuses it too, whatever path the write takes.
  begin
    update public.placement set status = 'active' where id = v_p1;
    raise exception 'a direct update skipped the outcome rule';
  exception when others then
    if sqlerrm not like 'outcomes_required%' then raise; end if;
  end;

  perform public.so_save_outcome_type(v_p1, null, 'Inspection booked', 'A homeowner booked a roof inspection.');
  assert public.so_set_placement_status(v_p1, 'active') = 'active';
  assert (select count(*) from public.audit_event where action = 'workspace.placement.status' and entity_id = v_p1::text) = 1;
  assert (select count(*) from public.audit_event where action = 'workspace.outcome.created') = 1;

  begin
    update public.placement_outcome_type set active = false where placement_id = v_p1;
    raise exception 'the last outcome was removed from an Active placement';
  exception when others then
    if sqlerrm not like 'outcomes_required%' then raise; end if;
  end;
end $$;

\echo '== one active placement per operator =='
do $$
declare v_second uuid;
begin
  perform pg_temp.as_user('98000000-0000-4000-8000-0000000000a1');
  v_second := public.so_save_placement(pg_temp.placement_input((select v from ids where k = 'op1'), '98000000-0000-4000-8000-0000000000d2', null));
  perform public.so_save_outcome_type(v_second, null, 'Estimate booked', 'An estimate visit is on the calendar.');
  begin
    perform public.so_set_placement_status(v_second, 'active');
    raise exception 'a second placement went Active';
  exception when others then
    if sqlerrm not like 'already_active%' then raise; end if;
  end;
  begin
    insert into public.placement (operator_id, case_file_id, start_date, end_date, status)
    values ((select v from ids where k = 'op1'), '98000000-0000-4000-8000-0000000000d2', current_date, current_date + 30, 'active');
    raise exception 'a direct insert held two active placements';
  exception when unique_violation then null;
  end;
end $$;

\echo '== the other placements: active (other manager), paused, ended =='
do $$
declare v_pl uuid;
begin
  perform pg_temp.as_user('98000000-0000-4000-8000-0000000000a1');
  v_pl := public.so_save_placement(pg_temp.placement_input((select v from ids where k = 'op2'), '98000000-0000-4000-8000-0000000000d2', '98000000-0000-4000-8000-0000000000b2'));
  insert into ids values ('p2', v_pl);
  perform public.so_save_outcome_type(v_pl, null, 'Call booked', 'A sales call is booked.');
  perform public.so_set_placement_status(v_pl, 'active');

  v_pl := public.so_save_placement(pg_temp.placement_input((select v from ids where k = 'op5'), '98000000-0000-4000-8000-0000000000d1', '98000000-0000-4000-8000-0000000000b1'));
  perform public.so_save_outcome_type(v_pl, null, 'Call booked', 'A sales call is booked.');
  perform public.so_set_placement_status(v_pl, 'active');
  perform public.so_set_placement_status(v_pl, 'paused', 'Client on holiday');

  v_pl := public.so_save_placement(pg_temp.placement_input((select v from ids where k = 'op6'), '98000000-0000-4000-8000-0000000000d1', '98000000-0000-4000-8000-0000000000b1'));
  perform public.so_save_outcome_type(v_pl, null, 'Call booked', 'A sales call is booked.');
  perform public.so_set_placement_status(v_pl, 'active');
  perform public.so_set_placement_status(v_pl, 'ended');
  begin
    perform public.so_set_placement_status(v_pl, 'active');
    raise exception 'an ended placement restarted';
  exception when others then
    if sqlerrm not like 'invalid_transition%' then raise; end if;
  end;
end $$;

\echo '== every access state =='
do $$
declare w jsonb;
begin
  perform pg_temp.as_user((select v from ids where k = 'user1'));
  w := public.so_workspace();
  assert w ->> 'state' = 'active', 'active: ' || w::text;
  assert w #>> '{placement,client_name}' = 'Client One';
  assert w #>> '{placement,manager_name}' = 'Manager One';
  assert w #>> '{placement,shift_end}' = '17:30';
  assert w #>> '{placement,eod_deadline}' = '17:30', 'the deadline defaults to the shift end';

  perform pg_temp.as_user((select v from ids where k = 'user3'));
  assert public.so_workspace() ->> 'state' = 'not_certified';
  perform pg_temp.as_user((select v from ids where k = 'user4'));
  assert public.so_workspace() ->> 'state' = 'awaiting_placement';
  perform pg_temp.as_user((select v from ids where k = 'user5'));
  assert public.so_workspace() ->> 'state' = 'paused';
  perform pg_temp.as_user((select v from ids where k = 'user6'));
  w := public.so_workspace();
  assert w ->> 'state' = 'no_access' and w ->> 'reason' = 'placement_ended', w::text;
  perform pg_temp.as_user((select v from ids where k = 'user7'));
  w := public.so_workspace();
  assert w ->> 'state' = 'no_access' and w ->> 'reason' = 'deactivated', w::text;
end $$;

\echo '== certification warning, grace, then not certified =='
do $$
declare w jsonb;
begin
  perform pg_temp.as_user((select v from ids where k = 'user4'));
  update public.academy_certification set recertify_on = current_date + 10 where profile_id = (select v from ids where k = 'user4');
  w := public.so_workspace();
  assert w ->> 'state' = 'awaiting_placement', w::text;
  assert w #>> '{certification,phase}' = 'warning', w::text;
  assert (w #>> '{certification,days_left}')::int = 10;

  update public.academy_certification set recertify_on = current_date - 1 where profile_id = (select v from ids where k = 'user4');
  w := public.so_workspace();
  assert w ->> 'state' = 'awaiting_placement', 'grace keeps access: ' || w::text;
  assert w #>> '{certification,phase}' = 'grace', w::text;
  assert (select count(*) from public.workspace_alert where kind = 'cert_grace') = 1;

  update public.academy_certification set recertify_on = current_date - 8 where profile_id = (select v from ids where k = 'user4');
  w := public.so_workspace();
  assert w ->> 'state' = 'not_certified', w::text;
  assert (w ->> 'grace_ended')::boolean;

  update public.academy_certification set recertify_on = null where profile_id = (select v from ids where k = 'user4');
end $$;

\echo '== activity, EODs, feedback and mismatches for both active placements =='
do $$
declare
  r public.placement;
  v_day uuid;
  v_eod uuid;
begin
  for r in select pl.* from public.placement pl where pl.id in ((select v from ids where k = 'p1'), (select v from ids where k = 'p2')) loop
    insert into public.activity_day (operator_id, placement_id, work_date) values (r.operator_id, r.id, current_date) returning id into v_day;
    insert into public.activity_value (activity_day_id, metric_key, source, value) values (v_day, 'conversations_held', 'operator', 12);
    insert into public.activity_value (activity_day_id, metric_key, source, value) values (v_day, 'conversations_held', 'ghl', 9);
    insert into public.sales_eod (operator_id, placement_id, work_date, activity_day_id, deadline_at)
    values (r.operator_id, r.id, current_date, v_day, app.so_eod_deadline(r, current_date)) returning id into v_eod;
    insert into public.sales_eod_feedback (eod_id, author_kind, author_profile_id, body)
    values (v_eod, 'manager', r.manager_profile_id, 'Good day.');
    insert into public.activity_mismatch (operator_id, placement_id, work_date, metric_key, operator_value, ghl_value, gap)
    values (r.operator_id, r.id, current_date, 'conversations_held', 12, 9, 3);
  end loop;
  assert (select count(*) from public.activity_value) = 4, 'operator and GHL values are stored apart';
end $$;

\echo '== an operator reads no workspace table directly =='
set local role authenticated;
select set_config('request.jwt.claim.sub', '98000000-0000-4000-8000-0000000000c1', true);
do $$
begin
  assert (select count(*) from public.sales_eod) = 0;
  assert (select count(*) from public.activity_day) = 0;
  assert (select count(*) from public.activity_value) = 0;
  assert (select count(*) from public.sales_eod_feedback) = 0;
  assert (select count(*) from public.placement_outcome_type) = 0;
  assert (select count(*) from public.activity_target) = 0;
  assert (select count(*) from public.activity_mismatch) = 0, 'operators never see mismatches';
  assert (select count(*) from public.client_feedback_token) = 0;
  assert (select count(*) from public.operator_pay_impact) = 0;
  begin
    insert into public.sales_eod_feedback (eod_id, author_kind, body) select id, 'admin', 'x' from public.sales_eod limit 1;
    raise exception 'an operator wrote to a workspace table';
  exception when insufficient_privilege then null;
  end;
end $$;

\echo '== a manager reads every operator, and still cannot read mismatches =='
select set_config('request.jwt.claim.sub', '98000000-0000-4000-8000-0000000000b1', true);
do $$
begin
  assert (select count(*) from public.sales_eod) = 2;
  assert (select count(*) from public.activity_day) = 2;
  assert (select count(*) from public.activity_value) = 4;
  assert (select count(*) from public.sales_eod_feedback) = 2;
  assert (select count(*) from public.activity_mismatch) = 0, 'managers never see mismatches';
  assert (select count(*) from public.client_feedback_token) = 0;
  assert (select count(*) from public.operator_pay_impact) = 0;
  assert (select count(*) from public.placement_outcome_type) = 5;
  -- Active, paused, and the pending second placement. The ended one is not listed.
  assert jsonb_array_length(public.so_manager_operators()) = 4, public.so_manager_operators()::text;
end $$;

select set_config('request.jwt.claim.sub', '98000000-0000-4000-8000-0000000000b3', true);
do $$
begin
  assert (select count(*) from public.sales_eod) = 2, 'a manager with nobody assigned still sees every operator';
  assert jsonb_array_length(public.so_manager_operators()) = 4;
  assert (select count(*) from public.activity_mismatch) = 0;
end $$;

\echo '== DA Admin reads everything, mismatches included =='
select set_config('request.jwt.claim.sub', '98000000-0000-4000-8000-0000000000a1', true);
do $$
begin
  assert (select count(*) from public.sales_eod) = 2;
  assert (select count(*) from public.activity_mismatch) = 2;
end $$;
reset role;

\echo '== anon reaches none of it =='
set local role anon;
do $$
begin
  perform count(*) from public.sales_eod;
  raise exception 'anon read sales_eod';
exception when insufficient_privilege then null;
end $$;
reset role;

\echo '== metric definitions load as configuration; GHL-only is never editable =='
do $$
begin
  assert (select count(*) from public.activity_metric) = 18;
  assert (select count(*) from public.activity_metric where source = 'ghl') = 5;
  assert (select source from public.activity_metric where key = 'show_rate') = 'ghl';
  assert (select source from public.activity_metric where key = 'closes') = 'ghl';
  assert not exists (select 1 from public.activity_metric where source = 'ghl' and operator_editable);
  begin
    update public.activity_metric set operator_editable = true where key = 'dials_made';
    raise exception 'a GHL-only metric became editable';
  exception when check_violation then null;
  end;
  begin
    insert into public.activity_value (activity_day_id, metric_key, source, value)
    select id, 'dials_made', 'operator', 50 from public.activity_day limit 1;
    raise exception 'an operator value was stored for a GHL-only metric';
  exception when others then
    if sqlerrm not like 'ghl_only%' then raise; end if;
  end;
  begin
    insert into public.activity_value (activity_day_id, metric_key, source, value)
    select id, 'positive_outcomes', 'operator', 1 from public.activity_day limit 1;
    raise exception 'a positive outcome was logged without its outcome type';
  exception when others then
    if sqlerrm not like 'outcome_required%' then raise; end if;
  end;
end $$;

\echo '== targets: defaults, manager overrides within limits, history kept =='
do $$
declare
  v_p1 uuid := (select v from ids where k = 'p1');
  v_p2 uuid := (select v from ids where k = 'p2');
  t public.activity_target;
begin
  assert (app.so_target(v_p1, 'conversations_held', current_date)).id is null, 'no target until one is set';

  perform pg_temp.as_user('98000000-0000-4000-8000-0000000000a1');
  perform public.so_set_default_target('conversations_held', null, 40, 200);
  perform public.so_save_settings('{"target_override_min_pct": 50}'::jsonb);
  t := app.so_target(v_p1, 'conversations_held', current_date);
  assert t.layer = 'default' and t.daily = 40;

  perform pg_temp.as_user('98000000-0000-4000-8000-0000000000b1');
  begin
    perform public.so_set_override_target(v_p1, 'conversations_held', 10, null);
    raise exception 'a manager went below the floor';
  exception when others then
    if sqlerrm not like 'below_limit%' then raise; end if;
  end;
  begin
    perform public.so_set_override_target(v_p2, 'conversations_held', 30, null);
    raise exception 'a manager set a target outside their assignment';
  exception when others then
    if sqlerrm not like 'out_of_scope%' then raise; end if;
  end;
  begin
    perform public.so_save_outcome_type(v_p2, null, 'Sneaky', 'Not my placement.');
    raise exception 'a manager edited outcomes outside their assignment';
  exception when others then
    if sqlerrm not like 'out_of_scope%' then raise; end if;
  end;
  perform public.so_set_override_target(v_p1, 'conversations_held', 30, 150);
  t := app.so_target(v_p1, 'conversations_held', current_date);
  assert t.layer = 'override' and t.daily = 30;
  assert (app.so_target(v_p2, 'conversations_held', current_date)).daily = 40, 'an override is for that operator only';

  begin
    update public.activity_target set daily = 1;
    raise exception 'target history was rewritten';
  exception when others then
    if sqlerrm not like 'append_only%' then raise; end if;
  end;
  begin
    perform public.so_set_override_target(v_p1, 'conversations_held', 30, 150, current_date - 7);
    raise exception 'a target was backdated';
  exception when others then
    if sqlerrm not like 'no_backdating%' then raise; end if;
  end;
  assert (select count(*) from public.audit_event where action = 'workspace.target.default') = 1;
  assert (select count(*) from public.audit_event where action = 'workspace.target.override') = 1;
  assert (select count(*) from public.audit_event where action = 'workspace.settings') = 1;
end $$;

\echo '== EOD: edits after submission are kept, audited, and lock =='
do $$
declare v_eod uuid := (select id from public.sales_eod where placement_id = (select v from ids where k = 'p1'));
begin
  perform pg_temp.as_user('98000000-0000-4000-8000-0000000000c1');
  update public.sales_eod set status = 'draft', wins = 'Two inspections.' where id = v_eod;
  assert (select count(*) from public.sales_eod_revision) = 0, 'drafts are not revisions';
  update public.sales_eod set status = 'submitted', submitted_at = now() where id = v_eod;
  update public.sales_eod set wins = 'Three inspections.' where id = v_eod;
  assert (select edited_after_submit and edit_count = 1 from public.sales_eod where id = v_eod);
  assert (select before_value ->> 'wins' from public.sales_eod_revision where eod_id = v_eod) = 'Two inspections.';
  assert (select count(*) from public.audit_event where action = 'workspace.eod.edited' and entity_id = v_eod::text) = 1;

  update public.sales_eod set locked_at = now() - interval '1 minute' where id = v_eod;
  begin
    update public.sales_eod set wins = 'Four.' where id = v_eod;
    raise exception 'a locked EOD was edited';
  exception when others then
    if sqlerrm not like 'eod_locked%' then raise; end if;
  end;
  begin
    update public.sales_eod set deadline_at = now() where id = v_eod;
    raise exception 'the deadline that applied was changed';
  exception when others then
    if sqlerrm not like 'immutable%' then raise; end if;
  end;
end $$;

\echo '== a client token reaches its own report only =='
do $$
declare
  v_tok uuid;
  v_other_eod uuid := (select id from public.sales_eod where placement_id = (select v from ids where k = 'p2'));
begin
  insert into public.client_feedback_token (placement_id, period_start, period_end, token_hash, expires_at)
  values ((select v from ids where k = 'p1'), current_date - 6, current_date,
          encode(extensions.digest('token-one', 'sha256'), 'hex'), now() + interval '14 days')
  returning id into v_tok;
  begin
    insert into public.sales_eod_feedback (eod_id, author_kind, client_token_id, body) values (v_other_eod, 'client', v_tok, 'x');
    raise exception 'a token left feedback on another placement';
  exception when others then
    if sqlerrm not like 'token_scope%' then raise; end if;
  end;
end $$;

\echo '== settings start at the agreed defaults =='
do $$
declare s public.team_setting := (select t from public.team_setting t where id = 1);
begin
  assert s.mismatch_tolerance_pct = 10 and s.mismatch_small_count_under = 30 and s.mismatch_small_count_gap = 3;
  assert s.eod_reminder_minutes_before = 60 and s.eod_late_minutes_after = 0 and s.eod_manager_alert_minutes_after = 120;
  assert s.eod_missed_rule = 'next_shift_start' and s.eod_edit_rule = 'until_next_shift';
  assert not s.eod_hours_worked_enabled and not s.eod_note_to_manager_enabled;
  assert s.client_feedback_token_days = 14 and s.speed_to_lead_target_seconds is null;
  assert s.cert_warning_days = 14 and s.cert_grace_days = 7;
  assert s.view_as_idle_minutes = 30 and s.placement_review_months = 3;
end $$;

\echo '== view as cannot change logged numbers =='
insert into public.impersonation (actor_profile_id, target_profile_id, reason, expires_at, last_activity_at, kind, reason_kind)
values ('98000000-0000-4000-8000-0000000000a1', '98000000-0000-4000-8000-0000000000c1', 'test', now() + interval '30 minutes', now(), 'view_as', 'other');
select set_config('request.jwt.claim.sub', '98000000-0000-4000-8000-0000000000a1', true);
do $$
begin
  begin
    update public.activity_value set value = 99 where source = 'operator';
    raise exception 'view as changed a logged number';
  exception when others then
    if sqlerrm not like 'view_as_read_only%' then raise; end if;
  end;
  begin
    update public.sales_eod set wins = 'Changed while viewing.' where placement_id = (select v from ids where k = 'p1');
    raise exception 'view as edited an EOD';
  exception when others then
    if sqlerrm not like 'view_as_read_only%' then raise; end if;
  end;
end $$;

rollback;
\echo 'sales workspace: ok'
