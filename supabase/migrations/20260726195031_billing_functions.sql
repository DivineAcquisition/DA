-- Sequential, human-readable document numbers.
create sequence if not exists public.invoice_number_seq start 1001;
create sequence if not exists public.credit_note_number_seq start 501;

create or replace function public.create_invoice_draft(
  p_case_file_id uuid,
  p_charge_type public.charge_type,
  p_period_start date default null,
  p_period_end date default null,
  p_due_at date default null,
  p_notes text default null
)
returns public.invoice
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_invoice public.invoice;
begin
  insert into public.invoice (case_file_id, charge_type, period_start, period_end, due_at, notes, created_by)
  values (p_case_file_id, p_charge_type, p_period_start, p_period_end, p_due_at, p_notes, auth.uid())
  returning * into v_invoice;
  return v_invoice;
end;
$$;

create or replace function public.add_invoice_line(
  p_invoice_id uuid,
  p_description text,
  p_unit_amount numeric,
  p_quantity numeric default 1
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  insert into public.invoice_line (invoice_id, description, quantity, unit_amount, amount, sort_order)
  values (
    p_invoice_id, p_description, p_quantity, p_unit_amount, round(p_quantity * p_unit_amount, 2),
    coalesce((select max(sort_order) + 1 from public.invoice_line where invoice_id = p_invoice_id), 0)
  )
  returning id into v_id;

  perform public.recalculate_invoice(p_invoice_id);
  return v_id;
end;
$$;

create or replace function public.recalculate_invoice(p_invoice_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_subtotal numeric(12, 2);
  v_credited numeric(12, 2);
begin
  select coalesce(sum(amount), 0) into v_subtotal from public.invoice_line where invoice_id = p_invoice_id;
  select coalesce(sum(amount), 0) into v_credited from public.credit_note where invoice_id = p_invoice_id;

  update public.invoice
     set subtotal = v_subtotal,
         credited_total = v_credited,
         total = greatest(v_subtotal - v_credited, 0)
   where id = p_invoice_id;
end;
$$;

-- Rule 4, and the heart of performance billing. Only confirmed bookings reach an
-- invoice; a pending claim is one DA cannot evidence, and billing it invites the
-- one dispute that ends an engagement. Every line carries its booking id so the
-- client can open the breakdown and see exactly what they are paying for.
create or replace function public.build_performance_invoice(
  p_case_file_id uuid,
  p_period_start date,
  p_period_end date,
  p_rate_override numeric default null,
  p_due_at date default null
)
returns public.invoice
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_invoice public.invoice;
  v_booking record;
  v_rate numeric(10, 2);
  v_count integer := 0;
begin
  v_invoice := public.create_invoice_draft(
    p_case_file_id, 'performance', p_period_start, p_period_end,
    coalesce(p_due_at, p_period_end + 14),
    format('Per-appointment billing for %s to %s. Confirmed bookings only.', p_period_start, p_period_end)
  );

  for v_booking in
    select b.id, b.customer_name, b.scheduled_for, b.state,
           coalesce(p_rate_override, pl.client_rate_per_booking) as rate
    from public.booking b
    join public.placement pl on pl.id = b.placement_id
    where b.case_file_id = p_case_file_id
      and b.scheduled_for::date between p_period_start and p_period_end
      -- Rule 4 in one clause.
      and public.booking_is_creditable(b.state, b.source, b.matched_booking_id)
      -- And never twice.
      and not exists (select 1 from public.invoice_line l where l.booking_id = b.id)
    order by b.scheduled_for
  loop
    if v_booking.rate is null then
      raise exception 'client_rate_missing: the placement has no client_rate_per_booking and no override was supplied' using errcode = '23514';
    end if;

    insert into public.invoice_line (invoice_id, description, quantity, unit_amount, amount, booking_id, sort_order)
    values (
      v_invoice.id,
      format('Confirmed appointment — %s, %s', v_booking.customer_name, to_char(v_booking.scheduled_for, 'DD Mon YYYY HH24:MI')),
      1, v_booking.rate, v_booking.rate, v_booking.id, v_count
    );

    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    delete from public.invoice where id = v_invoice.id;
    raise exception 'no_confirmed_bookings: nothing confirmed in this period, so there is nothing to bill' using errcode = '23514';
  end if;

  perform public.recalculate_invoice(v_invoice.id);

  select * into v_invoice from public.invoice where id = v_invoice.id;
  return v_invoice;
end;
$$;

comment on function public.build_performance_invoice is 'Rule 4: draws only confirmed and system-only bookings, one line each, never billing the same booking twice.';

-- Issuing freezes the invoice. From here, corrections are credit notes.
create or replace function public.issue_invoice(p_invoice_id uuid)
returns public.invoice
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_invoice public.invoice;
  v_lines integer;
  v_pending integer;
begin
  select * into v_invoice from public.invoice where id = p_invoice_id;

  if v_invoice.id is null then
    raise exception 'invoice_not_found: %', p_invoice_id using errcode = 'P0002';
  end if;

  if v_invoice.status <> 'draft' then
    raise exception 'invoice_already_issued: invoice % is %, and only a draft can be issued', coalesce(v_invoice.number, v_invoice.id::text), v_invoice.status using errcode = '23514';
  end if;

  select count(*) into v_lines from public.invoice_line where invoice_id = p_invoice_id;
  if v_lines = 0 then
    raise exception 'invoice_empty: an invoice with no lines cannot be issued' using errcode = '23514';
  end if;

  -- Belt and braces on rule 4: refuse to issue if any line points at a booking
  -- that is not creditable, however it got there.
  select count(*) into v_pending
  from public.invoice_line l
  join public.booking b on b.id = l.booking_id
  where l.invoice_id = p_invoice_id
    and not public.booking_is_creditable(b.state, b.source, b.matched_booking_id);

  if v_pending > 0 then
    raise exception 'unconfirmed_bookings_on_invoice: % line(s) reference a booking that is not confirmed. Billing a booking DA cannot evidence is worse than not billing it.', v_pending using errcode = '23514';
  end if;

  perform public.recalculate_invoice(p_invoice_id);

  update public.invoice
     set status = 'issued',
         number = coalesce(number, 'INV-' || nextval('public.invoice_number_seq')),
         issued_at = now(),
         due_at = coalesce(due_at, (current_date + 14))
   where id = p_invoice_id
  returning * into v_invoice;

  return v_invoice;
end;
$$;

create or replace function public.issue_credit_note(
  p_invoice_id uuid,
  p_amount numeric,
  p_reason text
)
returns public.credit_note
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_invoice public.invoice;
  v_note public.credit_note;
  v_outstanding numeric(12, 2);
begin
  select * into v_invoice from public.invoice where id = p_invoice_id;

  if v_invoice.id is null then
    raise exception 'invoice_not_found: %', p_invoice_id using errcode = 'P0002';
  end if;

  if v_invoice.status = 'draft' then
    raise exception 'draft_needs_no_credit_note: edit the draft instead' using errcode = '23514';
  end if;

  if coalesce(nullif(trim(p_reason), ''), '') = '' then
    raise exception 'credit_reason_required: a credit note has to say why' using errcode = '23514';
  end if;

  v_outstanding := v_invoice.subtotal - v_invoice.credited_total;
  if p_amount > v_outstanding then
    raise exception 'credit_exceeds_invoice: cannot credit % against an outstanding balance of %', p_amount, v_outstanding using errcode = '23514';
  end if;

  insert into public.credit_note (invoice_id, number, amount, reason, created_by)
  values (p_invoice_id, 'CN-' || nextval('public.credit_note_number_seq'), p_amount, p_reason, auth.uid())
  returning * into v_note;

  perform public.recalculate_invoice(p_invoice_id);
  return v_note;
end;
$$;

-- Rule 6: paying an invoice writes exactly one typed revenue row.
create or replace function public.record_payment(
  p_invoice_id uuid,
  p_status public.payment_attempt_status,
  p_amount numeric default null,
  p_processor_intent_id text default null,
  p_failure_code text default null,
  p_failure_message text default null
)
returns public.invoice
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_invoice public.invoice;
  v_amount numeric(12, 2);
  v_step smallint;
begin
  select * into v_invoice from public.invoice where id = p_invoice_id;

  if v_invoice.id is null then
    raise exception 'invoice_not_found: %', p_invoice_id using errcode = 'P0002';
  end if;

  if v_invoice.status = 'draft' then
    raise exception 'draft_cannot_be_paid: issue the invoice first' using errcode = '23514';
  end if;

  v_amount := coalesce(p_amount, v_invoice.total);

  insert into public.payment_attempt (invoice_id, status, amount, processor_intent_id, failure_code, failure_message)
  values (p_invoice_id, p_status, v_amount, p_processor_intent_id, p_failure_code, p_failure_message);

  if p_status = 'succeeded' then
    update public.invoice set status = 'paid', paid_at = now() where id = p_invoice_id;

    -- Single source of truth for DA revenue. Unique on invoice_id, so a repeated
    -- webhook cannot double-count.
    insert into public.revenue_record (case_file_id, invoice_id, occurred_on, revenue_type, amount)
    values (v_invoice.case_file_id, p_invoice_id, current_date, v_invoice.charge_type, v_amount)
    on conflict (invoice_id) do nothing;

  elsif p_status = 'failed' then
    update public.invoice set status = 'failed' where id = p_invoice_id;

    select coalesce(max(step), 0) + 1 into v_step from public.dunning_event where invoice_id = p_invoice_id;

    -- A defined retry and reminder sequence: retry after 1, 3 and 7 days, then
    -- flag the engagement rather than retrying forever.
    insert into public.dunning_event (invoice_id, step, action, next_attempt_at, detail)
    values (
      p_invoice_id, v_step,
      case v_step when 1 then 'retry_scheduled' when 2 then 'retry_scheduled' when 3 then 'final_reminder' else 'engagement_flagged' end,
      case v_step when 1 then now() + interval '1 day' when 2 then now() + interval '3 days' when 3 then now() + interval '7 days' else null end,
      coalesce(p_failure_message, p_failure_code)
    );

  elsif p_status = 'refunded' then
    update public.invoice set status = 'refunded' where id = p_invoice_id;
  end if;

  select * into v_invoice from public.invoice where id = p_invoice_id;
  return v_invoice;
end;
$$;

comment on function public.record_payment is 'Rule 6: a successful payment writes one typed revenue row. A failure opens the next dunning step so it cannot go unnoticed.';

create or replace function public.write_off_invoice(p_invoice_id uuid, p_reason text)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if coalesce(nullif(trim(p_reason), ''), '') = '' then
    raise exception 'write_off_reason_required' using errcode = '23514';
  end if;

  update public.invoice
     set status = 'written_off',
         notes = coalesce(notes || E'\n', '') || 'Written off: ' || p_reason
   where id = p_invoice_id and status <> 'draft';
end;
$$;

-- Marks issued invoices overdue once past due. Safe to run repeatedly.
create or replace function public.mark_overdue_invoices()
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  update public.invoice
     set status = 'overdue'
   where status = 'issued' and due_at is not null and due_at < current_date;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
