-- Details the new-engagement form never asked for, plus the Stripe customer
-- the revenue on the case file is read from.

alter table public.client_case_file
  add column if not exists phone text,
  add column if not exists billing_email text,
  add column if not exists offer text,
  add column if not exists monthly_ad_spend numeric(12, 2),
  add column if not exists crm_stack text,
  add column if not exists time_zone text,
  add column if not exists stripe_customer_id text;

create unique index if not exists invoice_processor_id_uq
  on public.invoice (processor, processor_invoice_id)
  where processor_invoice_id is not null;

-- A placement is blocked when a GoHighLevel location is linked and not ready.
-- A client with no location yet can still be staffed.
create or replace function app.guard_placement_ghl_ready()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ready jsonb;
  v_failed text;
begin
  if new.status = 'active' and (tg_op = 'INSERT' or old.status is distinct from 'active')
     and exists (select 1 from public.ghl_location where case_file_id = new.case_file_id) then
    v_ready := app.ghl_readiness(new.case_file_id);
    if not (v_ready ->> 'ready')::boolean then
      select string_agg(c ->> 'label', '; ') into v_failed
      from jsonb_array_elements(v_ready -> 'checks') c
      where (c ->> 'blocking')::boolean and not (c ->> 'ok')::boolean;
      raise exception 'ghl_not_ready: % is linked in GHL but not ready (%). Fix the connection, or remove the location, before this placement starts.',
        app.ghl_case_name(new.case_file_id), v_failed using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.save_engagement_details(
  p_case_file_id uuid,
  p_phone text,
  p_billing_email text,
  p_offer text,
  p_monthly_ad_spend numeric,
  p_crm_stack text,
  p_time_zone text,
  p_notes text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.is_admin() then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  update public.client_case_file
     set phone = nullif(btrim(coalesce(p_phone, '')), ''),
         billing_email = nullif(lower(btrim(coalesce(p_billing_email, ''))), ''),
         offer = nullif(btrim(coalesce(p_offer, '')), ''),
         monthly_ad_spend = p_monthly_ad_spend,
         crm_stack = nullif(btrim(coalesce(p_crm_stack, '')), ''),
         time_zone = nullif(btrim(coalesce(p_time_zone, '')), ''),
         notes = nullif(btrim(coalesce(p_notes, '')), '')
   where id = p_case_file_id;
  if not found then
    raise exception 'not_found: that engagement does not exist' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.save_engagement_details(uuid, text, text, text, numeric, text, text, text) from public, anon;
grant execute on function public.save_engagement_details(uuid, text, text, text, numeric, text, text, text) to authenticated;

create or replace function public.place_sales_operator(
  p_case_file_id uuid,
  p_email text,
  p_start date,
  p_term_months integer,
  p_quota integer,
  p_commission numeric,
  p_client_rate numeric,
  p_time_zone text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_name text;
  v_operator uuid;
  v_id uuid;
  v_months integer := greatest(coalesce(p_term_months, 3), 1);
begin
  if not app.is_admin() then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  if v_email = '' or p_start is null then
    raise exception 'required: choose an operator and a start date' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.placement
    where case_file_id = p_case_file_id and status = 'active'
  ) then
    raise exception 'already_placed: end the live placement before starting another' using errcode = '23514';
  end if;

  select full_name into v_name
  from public.da_recipient
  where recipient_type = 'operator' and lower(email) = v_email
  limit 1;
  if v_name is null then
    raise exception 'unknown_operator: that person is not a sales operator recipient' using errcode = 'P0002';
  end if;

  select id into v_operator from public.operator where lower(email) = v_email;
  if v_operator is null then
    insert into public.operator (name, email, status)
    values (v_name, v_email, 'placed')
    returning id into v_operator;
  else
    update public.operator set status = 'placed', name = v_name where id = v_operator;
  end if;

  insert into public.placement (
    operator_id, case_file_id, start_date, end_date, status,
    term_months, monthly_booking_quota, commission_per_booking, client_rate_per_booking,
    time_zone
  ) values (
    v_operator, p_case_file_id, p_start, (p_start + make_interval(months => v_months))::date, 'active',
    v_months, greatest(coalesce(p_quota, 0), 0), greatest(coalesce(p_commission, 0), 0), p_client_rate,
    coalesce(nullif(btrim(coalesce(p_time_zone, '')), ''), 'America/New_York')
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.place_sales_operator(uuid, text, date, integer, integer, numeric, numeric, text) from public, anon;
grant execute on function public.place_sales_operator(uuid, text, date, integer, integer, numeric, numeric, text) to authenticated;

create or replace function public.end_placement(p_placement_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operator uuid;
begin
  if not app.is_admin() then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  update public.placement
     set status = 'ended', closed_on = current_date
   where id = p_placement_id and status = 'active'
  returning operator_id into v_operator;
  if v_operator is null then
    raise exception 'not_live: that placement is not active' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.placement where operator_id = v_operator and status = 'active') then
    update public.operator set status = 'on_bench' where id = v_operator and status = 'placed';
  end if;
end;
$$;

revoke all on function public.end_placement(uuid) from public, anon;
grant execute on function public.end_placement(uuid) to authenticated;

drop function if exists public.record_stripe_revenue(uuid, text, text, numeric, jsonb);

create or replace function public.record_stripe_revenue(
  p_case_file_id uuid,
  p_customer_id text,
  p_subscription_id text,
  p_amount numeric,
  p_invoices jsonb,
  p_subscription_status text default 'active',
  p_cancelled_on date default null
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb;
  v_invoice uuid;
  v_total numeric := 0;
  v_status public.subscription_status;
begin
  if not app.is_admin() then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  update public.client_case_file
     set stripe_customer_id = nullif(btrim(coalesce(p_customer_id, '')), '')
   where id = p_case_file_id;
  if not found then
    raise exception 'not_found: that engagement does not exist' using errcode = 'P0002';
  end if;

  v_status := case lower(btrim(coalesce(p_subscription_status, 'active')))
    when 'canceled' then 'cancelled'::public.subscription_status
    when 'cancelled' then 'cancelled'::public.subscription_status
    when 'incomplete_expired' then 'cancelled'::public.subscription_status
    when 'past_due' then 'past_due'::public.subscription_status
    when 'unpaid' then 'past_due'::public.subscription_status
    when 'incomplete' then 'past_due'::public.subscription_status
    when 'paused' then 'paused'::public.subscription_status
    else 'active'::public.subscription_status
  end;

  if nullif(btrim(coalesce(p_subscription_id, '')), '') is not null then
    update public.subscription
       set amount = coalesce(p_amount, amount),
           status = v_status,
           cancelled_on = case
             when v_status = 'cancelled' then coalesce(p_cancelled_on, cancelled_on, current_date)
             else cancelled_on
           end
     where processor_subscription_id = p_subscription_id;
    if not found and coalesce(p_amount, 0) > 0 then
      insert into public.subscription (
        case_file_id, charge_type, amount, interval_months, status, started_on, cancelled_on, processor_subscription_id
      ) values (
        p_case_file_id,
        'retainer',
        p_amount,
        1,
        v_status,
        current_date,
        case when v_status = 'cancelled' then coalesce(p_cancelled_on, current_date) else null end,
        p_subscription_id
      );
    end if;
  end if;

  for v_row in select * from jsonb_array_elements(coalesce(p_invoices, '[]'::jsonb)) loop
    if coalesce((v_row ->> 'amount')::numeric, 0) <= 0 then
      continue;
    end if;
    if exists (
      select 1 from public.invoice
      where processor = 'stripe' and processor_invoice_id = v_row ->> 'id'
    ) then
      v_total := v_total + (v_row ->> 'amount')::numeric;
      continue;
    end if;
    insert into public.invoice (
      case_file_id, number, status, charge_type, currency, subtotal, total,
      processor, processor_invoice_id, notes
    ) values (
      p_case_file_id,
      v_row ->> 'number',
      'draft',
      'retainer',
      'USD',
      (v_row ->> 'amount')::numeric,
      (v_row ->> 'amount')::numeric,
      'stripe',
      v_row ->> 'id',
      v_row ->> 'description'
    )
    returning id into v_invoice;
    insert into public.invoice_line (invoice_id, description, quantity, unit_amount, amount)
    values (v_invoice, coalesce(v_row ->> 'description', 'Stripe payment'), 1, (v_row ->> 'amount')::numeric, (v_row ->> 'amount')::numeric);
    update public.invoice
       set status = 'paid',
           issued_at = coalesce((v_row ->> 'paid_at')::timestamptz, now()),
           paid_at = coalesce((v_row ->> 'paid_at')::timestamptz, now())
     where id = v_invoice;
    v_total := v_total + (v_row ->> 'amount')::numeric;
  end loop;

  return v_total;
end;
$$;

revoke all on function public.record_stripe_revenue(uuid, text, text, numeric, jsonb, text, date) from public, anon;
grant execute on function public.record_stripe_revenue(uuid, text, text, numeric, jsonb, text, date) to authenticated;

-- Bay Area Cleaning Pros already pays in Stripe under the matching email.
-- Link that customer so the engagement shows collected revenue.
do $$
declare
  v_case uuid;
  v_invoice uuid;
  v_row record;
begin
  select id into v_case from public.client_case_file where slug = 'bay-area-cleaning-pros';
  if v_case is null then
    return;
  end if;
  update public.client_case_file
     set stripe_customer_id = 'cus_RnojlDJ1K3c2q1'
   where id = v_case and stripe_customer_id is null;

  if not exists (select 1 from public.subscription where processor_subscription_id = 'sub_1QuDpsCDlMOOe86cTKuwaQmu') then
    insert into public.subscription (
      case_file_id, charge_type, amount, interval_months, status, started_on, cancelled_on, processor_subscription_id
    ) values (
      v_case, 'retainer', 97, 1, 'cancelled', date '2025-02-19', date '2025-09-04', 'sub_1QuDpsCDlMOOe86cTKuwaQmu'
    );
  else
    update public.subscription
       set status = 'cancelled', cancelled_on = date '2025-09-04'
     where processor_subscription_id = 'sub_1QuDpsCDlMOOe86cTKuwaQmu'
       and status is distinct from 'cancelled';
  end if;

  for v_row in
    select * from (values
      ('in_1Qyw2HCDlMOOe86ctf2Vvx11', '56884325-0002', 97::numeric, timestamptz '2025-03-04 16:00+00'),
      ('in_1RAAoICDlMOOe86c5Z5LTHXv', '56884325-0003', 97::numeric, timestamptz '2025-04-04 16:00+00'),
      ('in_1RL36xCDlMOOe86cToF1MlNu', '56884325-0004', 97::numeric, timestamptz '2025-05-04 16:00+00'),
      ('in_1RWHtNCDlMOOe86cbw3ZU5dQ', '56884325-0005', 97::numeric, timestamptz '2025-06-04 16:00+00'),
      ('in_1RhABfCDlMOOe86cGh4KLrUE', '56884325-0006', 97::numeric, timestamptz '2025-07-04 16:00+00'),
      ('in_1RsOxbCDlMOOe86csRCujpcH', '56884325-0007', 97::numeric, timestamptz '2025-08-04 16:00+00'),
      ('in_1S3dixCDlMOOe86cwGimtr5d', '56884325-0008', 97::numeric, timestamptz '2025-09-04 16:00+00')
    ) as paid(id, invoice_number, amount, paid_at)
  loop
    if exists (select 1 from public.invoice where processor = 'stripe' and processor_invoice_id = v_row.id) then
      continue;
    end if;
    insert into public.invoice (
      case_file_id, number, status, charge_type, currency, subtotal, total,
      processor, processor_invoice_id, notes
    ) values (
      v_case, v_row.invoice_number, 'draft', 'retainer', 'USD', v_row.amount, v_row.amount,
      'stripe', v_row.id, 'Selestial Essential'
    )
    returning id into v_invoice;
    insert into public.invoice_line (invoice_id, description, quantity, unit_amount, amount)
    values (v_invoice, 'Selestial Essential', 1, v_row.amount, v_row.amount);
    update public.invoice
       set status = 'paid', issued_at = v_row.paid_at, paid_at = v_row.paid_at
     where id = v_invoice;
  end loop;
end;
$$;
