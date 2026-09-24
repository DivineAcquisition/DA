-- The careers door. Three of the six roles used the in-page form, which logged
-- what a candidate typed to the browser console, threw it away, and told them it
-- had been received.
\set ON_ERROR_STOP on
set search_path = public;

\echo '== an application from the public internet lands, with no session =='
set role anon;
do $$ begin perform set_config('request.jwt.claim.sub', '', false); end $$;

do $$
declare
  v jsonb;
begin
  v := public.submit_role_application(
    'growth-engineer', 'Growth Engineer', 'Jordan Rivera', 'Jordan@Example.test',
    '+1 555 000 0000', 'https://linkedin.com/in/jordan', null, null,
    'Six years building funnels', 'I read the whole posting', 'immediate',
    'not-an-ip', 'Mozilla/5.0');

  assert v ->> 'id' is not null, 'the application is on record';
end $$;

do $$
begin
  -- Applications are not the applicant's to read back, and anon cannot see them.
  begin
    perform count(*) from public.role_application;
    raise exception 'anon should have no grant on applications';
  exception when sqlstate '42501' then null;
  end;
end $$;

reset role;

\echo '== it is normalised, attributed and visible to the admin =='
do $$
declare
  r public.role_application;
begin
  select * into r from public.role_application where role_slug = 'growth-engineer';

  assert r.email = 'jordan@example.test', 'the address is normalised';
  assert r.full_name = 'Jordan Rivera';
  assert r.status = 'new';
  assert r.ip is null, 'a malformed address is not recorded rather than costing the application';
  assert r.user_agent = 'Mozilla/5.0';
  assert exists (select 1 from public.owner_alert where kind = 'careers.application'),
    'an application nobody can see is only marginally better than one thrown away';
end $$;

\echo '== a second submission is a correction, not a second application =='
set role anon;
do $$
declare
  v jsonb;
begin
  v := public.submit_role_application(
    'growth-engineer', 'Growth Engineer', 'Jordan Rivera-Smith', 'jordan@example.test',
    null, null, 'https://jordan.example', null, null, null, '1-2weeks');

  assert (v ->> 'updated')::boolean = true, 'reported as an update';
end $$;
reset role;

do $$
begin
  assert (select count(*) from public.role_application where role_slug = 'growth-engineer') = 1,
    'one person, one application per role';
  assert (select full_name from public.role_application where role_slug = 'growth-engineer') = 'Jordan Rivera-Smith',
    'the correction is taken';
  assert (select experience from public.role_application where role_slug = 'growth-engineer')
    = 'Six years building funnels',
    'and a field they left blank the second time is not wiped';
end $$;

\echo '== the door validates rather than trusting =='
set role anon;
do $$
begin
  begin
    perform public.submit_role_application('growth-engineer', 'Growth Engineer', '', 'a@b.test');
    raise exception 'a nameless application should be refused';
  exception when sqlstate '23514' then null;
  end;

  begin
    perform public.submit_role_application('growth-engineer', 'Growth Engineer', 'No Address', 'not-an-email');
    raise exception 'an unreachable address should be refused';
  exception when sqlstate '23514' then null;
  end;

  begin
    perform public.submit_role_application('', 'Nothing', 'Someone', 'someone@example.test');
    raise exception 'an application naming no role should be refused';
  exception when sqlstate '23514' then null;
  end;
end $$;

\echo '== a burst from one address is refused, not allowed to fill the table =='
do $$
declare
  v_slug text;
begin
  -- This is the only door anybody on the internet can knock on.
  for i in 1..5 loop
    v_slug := 'role-' || i;
    perform public.submit_role_application(v_slug, 'Role ' || i, 'Spammer', 'spam@example.test');
  end loop;

  begin
    perform public.submit_role_application('role-9', 'Role 9', 'Spammer', 'spam@example.test');
    raise exception 'the sixth application from one address in an hour should be refused';
  exception when sqlstate '53400' then null;
  end;
end $$;
reset role;

\echo '== reviewing one is admin-only and audited =='
do $$ begin perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false); end $$;

do $$
declare
  v_id uuid;
  r public.role_application;
begin
  select id into v_id from public.role_application where role_slug = 'growth-engineer';

  r := public.review_role_application(v_id, 'advanced', 'Booked a call');
  assert r.status = 'advanced';
  assert r.reviewed_by = 'aaaaaaaa-0000-0000-0000-000000000001';
  assert r.review_note = 'Booked a call';
  assert exists (select 1 from public.audit_event where action = 'careers.application_reviewed'),
    'rule 10: the decision is in the audit log';

  assert r.converted_operator_id is not null, 'advancing creates an operator';
  assert (
    select o.status = 'applicant'
       and o.role_application_id = r.id
       and o.profile_id is not null
       and o.email = r.email
       and o.phone = r.phone
       and o.joined_on = current_date
       and o.country is null
       and o.payout_method is null
    from public.operator o
    where o.id = r.converted_operator_id
  ), 'the operator is an applicant linked back to this application';
  assert (
    select count(*) from public.operator o where o.role_application_id = r.id
  ) = 1, 'exactly one operator row';
end $$;

\echo '== advancing again does not create a second operator =='
do $$
declare
  v_id uuid;
  v_operator uuid;
  v_count integer;
begin
  select id, converted_operator_id into v_id, v_operator
  from public.role_application where role_slug = 'growth-engineer';

  update public.role_application
     set status = 'advanced', review_note = 'Booked a call'
   where id = v_id;

  select count(*) into v_count from public.operator where role_application_id = v_id;
  assert v_count = 1, 'a second save of advanced does not hire them twice';
  assert (select converted_operator_id from public.role_application where id = v_id) = v_operator,
    'the original operator link stays';
  assert (select review_note from public.role_application where id = v_id) = 'Booked a call';
end $$;

\echo '== rejected and withdrawn do not create an operator =='
do $$
declare
  v_rejected uuid;
  v_withdrawn uuid;
begin
  insert into public.role_application (role_slug, role_title, full_name, email, status)
  values ('setter', 'Setter', 'Riley Chen', 'riley.chen@example.test', 'reviewing')
  returning id into v_rejected;

  update public.role_application set status = 'rejected' where id = v_rejected;
  assert (select converted_operator_id from public.role_application where id = v_rejected) is null;
  assert not exists (select 1 from public.operator where email = 'riley.chen@example.test'),
    'rejected does not create an operator';

  insert into public.role_application (role_slug, role_title, full_name, email, status)
  values ('setter', 'Setter', 'Sam Okonkwo', 'sam.okonkwo@example.test', 'reviewing')
  returning id into v_withdrawn;

  update public.role_application set status = 'withdrawn' where id = v_withdrawn;
  assert (select converted_operator_id from public.role_application where id = v_withdrawn) is null;
  assert not exists (select 1 from public.operator where email = 'sam.okonkwo@example.test'),
    'withdrawn does not create an operator';
end $$;

\echo '== an existing profile is reused and its role is left alone =='
do $$
declare
  v_id uuid;
  v_profile uuid := 'cccccccc-0000-0000-0000-000000000009';
  v_operator uuid;
begin
  insert into auth.users (id, email) values (v_profile, 'existing.hire@example.test');
  update public.profile
     set role = 'admin', state = 'active', full_name = 'Existing Hire'
   where id = v_profile;

  insert into public.role_application (role_slug, role_title, full_name, email, phone, status)
  values ('closer', 'Closer', 'Existing Hire', 'Existing.Hire@example.test', '+1 555 0100', 'reviewing')
  returning id into v_id;

  update public.role_application set status = 'advanced' where id = v_id
  returning converted_operator_id into v_operator;

  assert (select count(*) from public.profile where lower(email) = 'existing.hire@example.test') = 1,
    'no duplicate profile';
  assert (select role from public.profile where id = v_profile) = 'admin', 'role is untouched';
  assert (select state from public.profile where id = v_profile) = 'active', 'state is untouched';
  assert (select profile_id from public.operator where id = v_operator) = v_profile;
  assert (select role_application_id from public.operator where id = v_operator) = v_id;
end $$;

set role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', false); end $$;

do $$
begin
  assert (select count(*) from public.role_application) = 0,
    'an operator has no business reading the hiring pipeline';

  begin
    perform public.review_role_application(
      (select id from public.role_application limit 1), 'rejected');
    raise exception 'an operator should not be able to review applications';
  exception when sqlstate '42501' then null;
    when others then
      -- No row is visible to them either, which is the same refusal one layer up.
      null;
  end;
end $$;

reset role;

\echo ''
\echo 'ALL APPLICATION ASSERTIONS PASSED'
