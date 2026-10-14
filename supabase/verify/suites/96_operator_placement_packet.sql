-- Placing a sales operator queues one packet and marks them placed.
-- A second placement does not queue a second packet.
\set ON_ERROR_STOP on
set search_path = public;

\echo '== an active placement queues the packet and places the operator =='
do $$
declare
  v_operator uuid := 'f96f96f9-0000-4000-8000-000000000012';
  v_case uuid := 'f96f96f9-0000-4000-8000-0000000000c1';
  v_client uuid := 'f96f96f9-0000-4000-8000-0000000000c2';
begin
  insert into auth.users (id, email) values
    ('f96f96f9-0000-4000-8000-000000000011', 'packet.va@operators.test');
  update public.profile set role = 'operator', state = 'active', full_name = 'Packet VA'
   where id = 'f96f96f9-0000-4000-8000-000000000011';
  insert into public.operator (id, profile_id, name, email, status) values
    (v_operator, 'f96f96f9-0000-4000-8000-000000000011', 'Packet VA', 'packet.va@operators.test', 'in_training');
  insert into public.client_case_file (id, name, slug, record_kind, operator_id)
  values (v_case, 'Packet VA', 'operator-packet-va-f96', 'operator', v_operator);
  insert into public.client_case_file (id, name, slug)
  values (v_client, 'Packet Client', 'packet-client-f96');

  insert into public.placement (operator_id, case_file_id, start_date, end_date, status)
  values (v_operator, v_client, current_date, current_date + 90, 'active');

  assert (select status from public.operator where id = v_operator) = 'placed';
  assert (select count(*) from public.operator_packet where operator_id = v_operator) = 1;
  assert (select status from public.operator_packet where operator_id = v_operator) = 'pending';
  assert (select case_file_id from public.operator_packet where operator_id = v_operator) = v_case;

  insert into public.placement (operator_id, case_file_id, start_date, end_date, status)
  values (v_operator, v_client, current_date, current_date + 30, 'active');
  assert (select count(*) from public.operator_packet where operator_id = v_operator) = 1,
    'a second placement does not open a second packet';
end $$;

\echo '== a draft placement does not file a packet or place the operator =='
do $$
declare
  v_operator uuid := 'f96f96f9-0000-4000-8000-000000000022';
  v_client uuid := 'f96f96f9-0000-4000-8000-0000000000c3';
begin
  insert into auth.users (id, email) values
    ('f96f96f9-0000-4000-8000-000000000021', 'draft.va@operators.test');
  update public.profile set role = 'operator', state = 'active', full_name = 'Draft VA'
   where id = 'f96f96f9-0000-4000-8000-000000000021';
  insert into public.operator (id, profile_id, name, email, status) values
    (v_operator, 'f96f96f9-0000-4000-8000-000000000021', 'Draft VA', 'draft.va@operators.test', 'in_training');
  insert into public.client_case_file (id, name, slug) values (v_client, 'Draft Client', 'draft-client-f96');
  insert into public.placement (operator_id, case_file_id, start_date, end_date, status)
  values (v_operator, v_client, current_date, current_date + 90, 'draft');
  assert (select status from public.operator where id = v_operator) = 'in_training';
  assert (select count(*) from public.operator_packet where operator_id = v_operator) = 0;
end $$;
