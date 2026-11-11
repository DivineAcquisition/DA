-- Weekly billing. DA Admin enters the operator's pay for a week, adds the
-- management fee, and emails the client a receipt built from that week's EODs:
-- each day's hours, the outputs logged, and the wins written.
--
-- One row per seat and week (Monday start). The table is reached only through
-- the functions below; sending is done by the app with the service role.

create table if not exists public.weekly_charge (
  id uuid primary key default gen_random_uuid(),
  placement_id uuid not null references public.placement (id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  days jsonb not null default '[]'::jsonb,
  hours_total numeric(7, 2) not null default 0 check (hours_total >= 0 and hours_total <= 168),
  hourly_rate numeric(10, 2) check (hourly_rate is null or hourly_rate >= 0),
  operator_pay numeric(10, 2) not null default 0 check (operator_pay >= 0),
  management_fee numeric(10, 2) not null default 100 check (management_fee >= 0),
  total numeric(10, 2) generated always as (operator_pay + management_fee) stored,
  note text check (note is null or length(note) <= 2000),
  status text not null default 'draft' check (status in ('draft', 'sent')),
  sent_at timestamptz,
  sent_to text[] not null default '{}',
  sent_cc text[] not null default '{}',
  sent_by uuid references public.profile (id) on delete set null,
  send_count integer not null default 0,
  email_log_id uuid,
  updated_by uuid references public.profile (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (placement_id, week_start)
);

alter table public.weekly_charge enable row level security;
revoke all on public.weekly_charge from public, anon, authenticated;
grant select, insert, update on public.weekly_charge to service_role;

-- Who gets the client letters for a seat: the report recipients and the
-- client contact, with the seat's extra CC.
create or replace function app.placement_client_recipients(p_placement_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with pl as (
    select p.id, cf.contact_email
    from public.placement p
    join public.client_case_file cf on cf.id = p.case_file_id
    where p.id = p_placement_id
  ),
  to_list as (
    select distinct lower(btrim(email)) as email
    from (
      select unnest(coalesce(c.recipient_emails, '{}') || coalesce(c.extra_emails, '{}')) as email
      from public.sales_report_config c
      where c.placement_id = p_placement_id
      union all
      select contact_email from pl
    ) e
    where email is not null and btrim(email) ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),
  cc_list as (
    select distinct lower(btrim(email)) as email
    from (
      select unnest(coalesce(c.extra_cc, '{}')) as email
      from public.sales_report_config c
      where c.placement_id = p_placement_id
    ) e
    where email is not null and btrim(email) ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
      and lower(btrim(email)) not in (select email from to_list)
  )
  select jsonb_build_object(
    'to', coalesce((select jsonb_agg(email order by email) from to_list), '[]'::jsonb),
    'cc', coalesce((select jsonb_agg(email order by email) from cc_list), '[]'::jsonb)
  );
$$;

-- The billing desk for one seat and week. Admin only.
create or replace function public.so_week_charge(p_placement_id uuid default null, p_week date default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pl public.placement;
  v_today date;
  v_week date;
  v_days jsonb := '[]'::jsonb;
  v_day date;
  v_eod public.sales_eod;
  v_working boolean;
  v_shift_hours numeric;
  v_charge public.weekly_charge;
  v_last_rate numeric;
  v_operator public.operator;
  v_client text;
begin
  if not app.is_admin() then
    raise exception 'forbidden: only DA Admin can open billing' using errcode = '42501';
  end if;

  if p_placement_id is not null then
    select * into v_pl from public.placement where id = p_placement_id;
  end if;
  if v_pl.id is null then
    select * into v_pl from public.placement
    where status in ('active', 'paused', 'scheduled')
    order by (status = 'active') desc, start_date desc
    limit 1;
  end if;

  if v_pl.id is null then
    return jsonb_build_object('placements', '[]'::jsonb, 'placement', null);
  end if;

  v_today := (now() at time zone app.safe_tz(v_pl.time_zone))::date;
  v_week := coalesce(p_week, v_today);
  v_week := v_week - (extract(isodow from v_week)::int - 1);

  v_shift_hours := case
    when nullif(v_pl.shift_start, '') is null or nullif(v_pl.shift_end, '') is null then null
    else round((extract(epoch from (v_pl.shift_end::time - v_pl.shift_start::time + case when v_pl.shift_end::time <= v_pl.shift_start::time then interval '24 hours' else interval '0' end)) / 3600)::numeric, 2)
  end;

  select * into v_operator from public.operator where id = v_pl.operator_id;
  select name into v_client from public.client_case_file where id = v_pl.case_file_id;

  for v_day in select generate_series(v_week, v_week + 6, interval '1 day')::date loop
    v_working := extract(isodow from v_day)::smallint = any (v_pl.working_days);
    v_eod := null;
    select * into v_eod from public.sales_eod
    where placement_id = v_pl.id and work_date = v_day
    order by created_at desc limit 1;
    continue when not v_working and v_eod.id is null;
    v_days := v_days || jsonb_build_array(jsonb_build_object(
      'date', v_day,
      'working', v_working,
      'future', v_day > v_today,
      'eod_id', v_eod.id,
      'status', coalesce(v_eod.status, case when v_day > v_today then 'upcoming' else 'none' end),
      'hours_worked', v_eod.hours_worked,
      'hours_start', v_eod.hours_start,
      'hours_end', v_eod.hours_end,
      'break_minutes', v_eod.break_minutes,
      'wins', coalesce(v_eod.wins, ''),
      'blockers', coalesce(v_eod.blockers, ''),
      'needs_help', coalesce(v_eod.needs_help, false),
      'was_late', coalesce(v_eod.was_late, false),
      'numbers', case when v_day > v_today then '[]'::jsonb else app.so_eod_numbers(v_pl, v_day) end
    ));
  end loop;

  select * into v_charge from public.weekly_charge where placement_id = v_pl.id and week_start = v_week;
  select hourly_rate into v_last_rate from public.weekly_charge
  where placement_id = v_pl.id and hourly_rate is not null
  order by week_start desc limit 1;

  return jsonb_build_object(
    'placements', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'operator_name', o.name,
        'client_name', cf.name,
        'status', p.status
      ) order by (p.status = 'active') desc, cf.name, o.name)
      from public.placement p
      join public.operator o on o.id = p.operator_id
      join public.client_case_file cf on cf.id = p.case_file_id
      where p.status in ('active', 'paused', 'scheduled', 'ended')
    ), '[]'::jsonb),
    'placement', jsonb_build_object(
      'id', v_pl.id,
      'operator_name', v_operator.name,
      'client_name', coalesce(v_client, 'the client'),
      'time_zone', v_pl.time_zone,
      'shift_start', v_pl.shift_start,
      'shift_end', v_pl.shift_end,
      'shift_hours', v_shift_hours,
      'working_days', to_jsonb(v_pl.working_days)
    ),
    'week_start', v_week,
    'week_end', v_week + 6,
    'today', v_today,
    'days', v_days,
    'recipients', app.placement_client_recipients(v_pl.id),
    'last_rate', v_last_rate,
    'charge', case when v_charge.id is null then null else jsonb_build_object(
      'id', v_charge.id,
      'days', v_charge.days,
      'hours_total', v_charge.hours_total,
      'hourly_rate', v_charge.hourly_rate,
      'operator_pay', v_charge.operator_pay,
      'management_fee', v_charge.management_fee,
      'total', v_charge.total,
      'note', v_charge.note,
      'status', v_charge.status,
      'sent_at', v_charge.sent_at,
      'sent_to', to_jsonb(v_charge.sent_to),
      'send_count', v_charge.send_count,
      'updated_at', v_charge.updated_at
    ) end
  );
end;
$$;

-- Save the week's hours and pay. A change after sending puts it back to draft
-- so the receipt the client has never silently differs from what is saved.
create or replace function public.so_week_charge_save(
  p_placement_id uuid,
  p_week date,
  p_days jsonb,
  p_hourly_rate numeric,
  p_operator_pay numeric,
  p_management_fee numeric,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_week date;
  v_days jsonb;
  v_hours numeric;
  v_row public.weekly_charge;
begin
  if not app.is_admin() then
    raise exception 'forbidden: only DA Admin can change billing' using errcode = '42501';
  end if;
  if not exists (select 1 from public.placement where id = p_placement_id) then
    raise exception 'not_found: that seat is not in the workspace' using errcode = 'P0002';
  end if;
  if p_week is null then
    raise exception 'invalid: choose a week' using errcode = '23514';
  end if;
  v_week := p_week - (extract(isodow from p_week)::int - 1);

  if p_operator_pay is null or p_operator_pay < 0 or p_operator_pay > 100000 then
    raise exception 'invalid: enter the week''s pay as a number from 0 to 100,000' using errcode = '23514';
  end if;
  if p_management_fee is null or p_management_fee < 0 or p_management_fee > 100000 then
    raise exception 'invalid: enter the management fee as a number from 0 to 100,000' using errcode = '23514';
  end if;
  if p_hourly_rate is not null and (p_hourly_rate < 0 or p_hourly_rate > 10000) then
    raise exception 'invalid: the hourly rate must be from 0 to 10,000' using errcode = '23514';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('date', d.date, 'hours', d.hours) order by d.date), '[]'::jsonb),
         coalesce(sum(d.hours), 0)
    into v_days, v_hours
  from (
    select (item ->> 'date')::date as date,
           round(greatest(0, least(24, coalesce(nullif(item ->> 'hours', '')::numeric, 0))), 2) as hours
    from jsonb_array_elements(case when jsonb_typeof(p_days) = 'array' then p_days else '[]'::jsonb end) item
    where (item ->> 'date')::date between v_week and v_week + 6
  ) d;

  insert into public.weekly_charge as w (
    placement_id, week_start, days, hours_total, hourly_rate, operator_pay, management_fee, note, updated_by, updated_at
  ) values (
    p_placement_id, v_week, v_days, v_hours, p_hourly_rate, round(p_operator_pay, 2), round(p_management_fee, 2),
    nullif(btrim(coalesce(p_note, '')), ''), app.acting_profile(), now()
  )
  on conflict (placement_id, week_start) do update
     set days = excluded.days,
         hours_total = excluded.hours_total,
         hourly_rate = excluded.hourly_rate,
         operator_pay = excluded.operator_pay,
         management_fee = excluded.management_fee,
         note = excluded.note,
         updated_by = excluded.updated_by,
         updated_at = now(),
         status = case
           when w.days is distinct from excluded.days
             or w.hourly_rate is distinct from excluded.hourly_rate
             or w.operator_pay is distinct from excluded.operator_pay
             or w.management_fee is distinct from excluded.management_fee
             or w.note is distinct from excluded.note
           then 'draft'
           else w.status
         end
  returning * into v_row;

  return jsonb_build_object('id', v_row.id, 'status', v_row.status, 'total', v_row.total, 'updated_at', v_row.updated_at);
end;
$$;

revoke all on function app.placement_client_recipients(uuid) from public, anon, authenticated;
revoke all on function public.so_week_charge(uuid, date) from public, anon;
revoke all on function public.so_week_charge_save(uuid, date, jsonb, numeric, numeric, numeric, text) from public, anon;
grant execute on function public.so_week_charge(uuid, date) to authenticated;
grant execute on function public.so_week_charge_save(uuid, date, jsonb, numeric, numeric, numeric, text) to authenticated;
