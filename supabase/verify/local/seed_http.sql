-- Refuses to run anywhere but the throwaway verify database. Production holds
-- live data only (Prompt 8B); a seed must never reach it.
do $$
begin
  if current_database() not like '%verify%' then
    raise exception 'refusing to seed %: fixtures run only in the local verify database', current_database();
  end if;
end $$;

\set ON_ERROR_STOP on
set search_path = public;

insert into auth.users (id, email) values ('aaaaaaaa-0000-0000-0000-000000000001', 'admin@divineacquisition.io');
update profile set role = 'admin', state = 'active' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);

insert into client_case_file (id, name, slug, status)
values ('cccccccc-0000-0000-0000-000000000001', 'Northside Dental', 'northside-dental', 'active');

insert into operator (id, name, email, status, base_monthly)
values ('11111111-2222-0000-0000-000000000001', 'Joy Mensah', 'joy@example.com', 'placed', 600);

insert into placement (
  id, operator_id, case_file_id, start_date, end_date, status,
  monthly_booking_quota, commission_per_booking, client_rate_per_booking, response_standard_minutes
)
values (
  '22222222-3333-0000-0000-000000000001', '11111111-2222-0000-0000-000000000001',
  'cccccccc-0000-0000-0000-000000000001', '2026-07-01', '2026-09-30', 'active', 20, 15, 60, 5
);

insert into invoice (id, case_file_id, number, status, charge_type, subtotal, total, issued_at)
values ('dddddddd-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
        'DA-1001', 'issued', 'retainer', 2500, 2500, now());

create table door (name text primary key, key text, secret text);

insert into door
select 'ghl', v ->> 'key', v ->> 'secret'
from (select register_ingest_endpoint('gohighlevel', 'Northside GHL', 'cccccccc-0000-0000-0000-000000000001')) t(v);

insert into door
select 'pay', v ->> 'key', v ->> 'secret'
from (select register_ingest_endpoint('payments', 'Processor platform door', null, 'hmac_sha256')) t(v);
