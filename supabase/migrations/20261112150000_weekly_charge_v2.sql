-- Weekly billing, second pass.
--
--  * Commission: the operator's commission for the week. It is part of what
--    the operator earns and what the client is charged. The client total is
--    pay + commission + the management fee.
--  * Stripe: sending the receipt charges the client's card on file. The
--    invoice id, status and amount are kept, and a charged week's money is
--    locked so the receipt can never disagree with what was charged.
--  * Operator statement: the operator gets their own email with their hours,
--    pay per shift and commission. No management fee, no client total.
--  * History: the desk lists every saved week for the seat (the hours log).

alter table public.weekly_charge
  add column if not exists commission numeric(10, 2) not null default 0 check (commission >= 0),
  add column if not exists stripe_invoice_id text,
  add column if not exists stripe_status text,
  add column if not exists stripe_invoice_url text,
  add column if not exists charged_amount numeric(10, 2),
  add column if not exists charged_at timestamptz,
  add column if not exists charge_error text check (charge_error is null or length(charge_error) <= 1000),
  add column if not exists operator_sent_at timestamptz,
  add column if not exists operator_sent_to text,
  add column if not exists operator_send_count integer not null default 0,
  add column if not exists operator_email_log_id uuid;

alter table public.weekly_charge drop column if exists total;
alter table public.weekly_charge
  add column total numeric(10, 2) generated always as (operator_pay + commission + management_fee) stored;

drop function if exists public.so_week_charge_save(uuid, date, jsonb, numeric, numeric, numeric, text);

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
  v_case public.client_case_file;
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
  select * into v_case from public.client_case_file where id = v_pl.case_file_id;

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
      'operator_email', nullif(lower(btrim(coalesce(v_operator.email, ''))), ''),
      'client_name', coalesce(v_case.name, 'the client'),
      'stripe_linked', nullif(btrim(coalesce(v_case.stripe_customer_id, '')), '') is not null,
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
      'commission', v_charge.commission,
      'management_fee', v_charge.management_fee,
      'total', v_charge.total,
      'note', v_charge.note,
      'status', v_charge.status,
      'sent_at', v_charge.sent_at,
      'sent_to', to_jsonb(v_charge.sent_to),
      'send_count', v_charge.send_count,
      'updated_at', v_charge.updated_at,
      'stripe_invoice_id', v_charge.stripe_invoice_id,
      'stripe_status', v_charge.stripe_status,
      'stripe_invoice_url', v_charge.stripe_invoice_url,
      'charged_amount', v_charge.charged_amount,
      'charged_at', v_charge.charged_at,
      'charge_error', v_charge.charge_error,
      'operator_sent_at', v_charge.operator_sent_at,
      'operator_sent_to', v_charge.operator_sent_to,
      'operator_send_count', v_charge.operator_send_count
    ) end,
    'history', coalesce((
      select jsonb_agg(jsonb_build_object(
        'week_start', w.week_start,
        'hours_total', w.hours_total,
        'operator_pay', w.operator_pay,
        'commission', w.commission,
        'management_fee', w.management_fee,
        'total', w.total,
        'status', w.status,
        'charged_at', w.charged_at,
        'stripe_status', w.stripe_status,
        'operator_sent_at', w.operator_sent_at
      ) order by w.week_start desc)
      from (
        select * from public.weekly_charge where placement_id = v_pl.id order by week_start desc limit 26
      ) w
    ), '[]'::jsonb)
  );
end;
$$;

-- Save the week's hours and money. A charged week's money is locked; a change
-- after the receipt was sent puts it back to draft.
create or replace function public.so_week_charge_save(
  p_placement_id uuid,
  p_week date,
  p_days jsonb,
  p_hourly_rate numeric,
  p_operator_pay numeric,
  p_commission numeric,
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
  v_existing public.weekly_charge;
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
  if p_commission is null or p_commission < 0 or p_commission > 100000 then
    raise exception 'invalid: enter the commission as a number from 0 to 100,000' using errcode = '23514';
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

  select * into v_existing from public.weekly_charge where placement_id = p_placement_id and week_start = v_week for update;
  if v_existing.charged_at is not null and (
       v_existing.days is distinct from v_days
    or v_existing.operator_pay is distinct from round(p_operator_pay, 2)
    or v_existing.commission is distinct from round(p_commission, 2)
    or v_existing.management_fee is distinct from round(p_management_fee, 2)
  ) then
    raise exception 'locked: this week was charged % on %. Its hours and money cannot change here; refund or adjust it in Stripe.',
      to_char(v_existing.charged_amount, 'FM$999,990.00'), to_char(v_existing.charged_at, 'Mon FMDD')
      using errcode = '42501';
  end if;

  insert into public.weekly_charge as w (
    placement_id, week_start, days, hours_total, hourly_rate, operator_pay, commission, management_fee, note, updated_by, updated_at
  ) values (
    p_placement_id, v_week, v_days, v_hours, p_hourly_rate, round(p_operator_pay, 2), round(p_commission, 2),
    round(p_management_fee, 2), nullif(btrim(coalesce(p_note, '')), ''), app.acting_profile(), now()
  )
  on conflict (placement_id, week_start) do update
     set days = excluded.days,
         hours_total = excluded.hours_total,
         hourly_rate = excluded.hourly_rate,
         operator_pay = excluded.operator_pay,
         commission = excluded.commission,
         management_fee = excluded.management_fee,
         note = excluded.note,
         updated_by = excluded.updated_by,
         updated_at = now(),
         status = case
           when w.days is distinct from excluded.days
             or w.hourly_rate is distinct from excluded.hourly_rate
             or w.operator_pay is distinct from excluded.operator_pay
             or w.commission is distinct from excluded.commission
             or w.management_fee is distinct from excluded.management_fee
             or w.note is distinct from excluded.note
           then 'draft'
           else w.status
         end
  returning * into v_row;

  return jsonb_build_object('id', v_row.id, 'status', v_row.status, 'total', v_row.total, 'updated_at', v_row.updated_at);
end;
$$;

-- What the server needs to charge the client: the Stripe customer for the seat's
-- client file. Service role only; the app checks the caller is DA Admin first.
create or replace function public.week_charge_stripe_customer(p_charge_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select nullif(btrim(coalesce(cf.stripe_customer_id, '')), '')
  from public.weekly_charge w
  join public.placement p on p.id = w.placement_id
  join public.client_case_file cf on cf.id = p.case_file_id
  where w.id = p_charge_id;
$$;

revoke all on function public.so_week_charge(uuid, date) from public, anon;
revoke all on function public.so_week_charge_save(uuid, date, jsonb, numeric, numeric, numeric, numeric, text) from public, anon;
revoke all on function public.week_charge_stripe_customer(uuid) from public, anon, authenticated;
grant execute on function public.so_week_charge(uuid, date) to authenticated;
grant execute on function public.so_week_charge_save(uuid, date, jsonb, numeric, numeric, numeric, numeric, text) to authenticated;
grant execute on function public.week_charge_stripe_customer(uuid) to service_role;
