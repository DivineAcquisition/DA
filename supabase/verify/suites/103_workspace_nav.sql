-- Manager limits for the sidebar: domain, GHL credentials, and outcome mapping.
\set ON_ERROR_STOP on
set search_path = public;
begin;

create or replace function pg_temp.as_user(p uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', p::text, true);
$$;

do $$
declare
  v_program uuid := (select id from public.academy_program where slug = 'da-operator-academy');
  v_uid uuid := '10300000-0000-4000-8000-0000000000c1';
  v_op uuid := '10300000-0000-4000-8000-0000000001c1';
  v_enr uuid;
  v_id uuid;
  v_panel jsonb;
begin
  insert into auth.users (id, email) values
    ('10300000-0000-4000-8000-0000000000a1', 'nav-admin@so.test'),
    ('10300000-0000-4000-8000-0000000000b1', 'nav-manager@so.test'),
    (v_uid, 'nav-op@so.test');
  update public.profile set role = 'admin', state = 'active', full_name = 'Nav Admin' where id = '10300000-0000-4000-8000-0000000000a1';
  update public.profile set role = 'manager', state = 'active', full_name = 'Nav Manager' where id = '10300000-0000-4000-8000-0000000000b1';
  update public.profile set role = 'operator', state = 'active', full_name = 'Nav Op' where id = v_uid;
  insert into public.operator (id, profile_id, name, email, status) values (v_op, v_uid, 'Nav Op', 'nav-op@so.test', 'certified');
  insert into public.academy_enrollment (profile_id, program_id, operator_id, track, status)
  values (v_uid, v_program, v_op, 'sales_operator', 'completed') returning id into v_enr;
  insert into public.academy_certification (enrollment_id, profile_id, level) values (v_enr, v_uid, 1);
  insert into public.client_case_file (id, name, slug) values ('10300000-0000-4000-8000-0000000000d1', 'Nav Client', 'so-nav-client');

  perform pg_temp.as_user('10300000-0000-4000-8000-0000000000a1');
  v_id := public.so_save_placement(jsonb_build_object(
    'operator_id', v_op, 'case_file_id', '10300000-0000-4000-8000-0000000000d1',
    'placement_type', 'client_placed', 'manager_profile_id', '10300000-0000-4000-8000-0000000000b1',
    'start_date', current_date - 3, 'time_zone', 'UTC',
    'working_days', '[1,2,3,4,5]'::jsonb, 'shift_start', '09:00', 'shift_end', '17:00',
    'campaign_summary', 'Nav.', 'activity_categories', '["outbound_calling"]'::jsonb, 'tracks_results', false
  ));
  perform public.so_save_outcome_type(v_id, null, 'Booked', 'A booking.');
  perform public.so_set_placement_status(v_id, 'active');
  assert (public.so_nav_counts() ->> 'escalations') is not null;

  perform pg_temp.as_user('10300000-0000-4000-8000-0000000000b1');
  assert (public.so_nav_counts() ->> 'escalations') = '0', 'managers do not receive the escalations count';
  assert (public.so_nav_counts() ->> 'holds') = '0', 'managers do not receive the holds count';
  assert (public.so_nav_counts() ->> 'eods') is not null;
  assert (public.so_nav_counts() ->> 'reports') is not null;
  begin
    perform public.so_sales_operator_ids();
    raise exception 'a manager listed sales operators';
  exception when others then
    if sqlerrm not like '%admin%' and sqlerrm not like 'permission_denied%' then raise; end if;
  end;
  begin
    perform public.so_ghl_panel(v_id);
    raise exception 'a manager opened the GHL connection';
  exception when others then
    if sqlerrm not like 'admin_required%' then raise; end if;
  end;
  begin
    perform public.so_ghl_save_user(v_id, 'user-1');
    raise exception 'a manager changed the GHL user';
  exception when others then
    if sqlerrm not like 'admin_required%' then raise; end if;
  end;
  begin
    perform public.so_ghl_disconnect(v_id);
    raise exception 'a manager disconnected GHL';
  exception when others then
    if sqlerrm not like 'admin_required%' then raise; end if;
  end;
  begin
    perform public.so_save_operator_domain('{"origin":"https://team.example.com"}'::jsonb);
    raise exception 'a manager changed the operator domain';
  exception when others then
    if sqlerrm not like 'admin_required%' then raise; end if;
  end;
  v_panel := public.so_ghl_outcome_panel(v_id);
  assert not (v_panel ? 'token_last4');
  assert not (v_panel ? 'location_id');
  assert not (v_panel ? 'ghl_user_id');
  perform public.so_ghl_save_mapping(v_id, '{"outcomes":[{"id":"booked"}]}'::jsonb);
  assert jsonb_array_length(public.so_ghl_outcome_panel(v_id) -> 'mapping' -> 'outcomes') = 1;
  assert not exists (
    select 1 from public.role_permission where role = 'manager' and permission_key = 'ghl.view'
  ), 'managers no longer have ghl.view';
  begin
    perform public.ghl_overview();
    raise exception 'a manager read GHL connections';
  exception when others then
    if sqlerrm not like 'permission_denied%' then raise; end if;
  end;

  perform pg_temp.as_user(v_uid);
  assert public.portal_training_due() ? 'recertify_on', 'training due date comes from the certification';
end $$;

rollback;
