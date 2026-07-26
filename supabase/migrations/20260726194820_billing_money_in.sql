create type public.charge_type as enum ('audit_fee', 'install_fee', 'retainer', 'bundled_term', 'performance');

create type public.invoice_status as enum ('draft', 'issued', 'paid', 'overdue', 'failed', 'refunded', 'written_off');

create type public.subscription_status as enum ('active', 'past_due', 'paused', 'cancelled');

create type public.payment_attempt_status as enum ('requires_action', 'processing', 'succeeded', 'failed', 'refunded');

create table public.invoice (
  id uuid primary key default gen_random_uuid(),
  case_file_id uuid not null references public.client_case_file (id) on delete cascade,
  number text unique,
  status public.invoice_status not null default 'draft',
  charge_type public.charge_type not null,
  currency text not null default 'USD',
  period_start date,
  period_end date,
  subtotal numeric(12, 2) not null default 0,
  credited_total numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  issued_at timestamptz,
  due_at date,
  paid_at timestamptz,
  notes text,
  -- Vistrial records intent and status. It never holds card details.
  processor text,
  processor_invoice_id text,
  created_by uuid references public.profile (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.invoice is 'Rule 5: a draft can be edited, an issued invoice cannot. Corrections are credit notes so history stays intact.';
comment on column public.invoice.processor_invoice_id is 'Reference at the external processor. Rule 10: no card details are ever stored or displayed.';

create index invoice_case_file_idx on public.invoice (case_file_id, created_at desc);
create index invoice_status_idx on public.invoice (status);
create index invoice_overdue_idx on public.invoice (due_at) where status in ('issued', 'overdue', 'failed');

create trigger invoice_touch before update on public.invoice
  for each row execute function app.touch_updated_at();

create table public.invoice_line (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoice (id) on delete cascade,
  description text not null,
  quantity numeric(10, 2) not null default 1,
  unit_amount numeric(12, 2) not null,
  amount numeric(12, 2) not null,
  -- Set on a performance line. This is what lets the client open the breakdown
  -- and see the individual bookings that produced the amount.
  booking_id uuid references public.booking (id) on delete restrict,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index invoice_line_invoice_idx on public.invoice_line (invoice_id, sort_order);

-- A booking may only ever be billed once.
create unique index invoice_line_one_per_booking on public.invoice_line (booking_id) where booking_id is not null;

create table public.credit_note (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoice (id) on delete cascade,
  number text unique,
  amount numeric(12, 2) not null check (amount > 0),
  reason text not null,
  issued_at timestamptz not null default now(),
  created_by uuid references public.profile (id)
);

comment on table public.credit_note is 'Rule 5: the only way to correct an issued invoice.';

create index credit_note_invoice_idx on public.credit_note (invoice_id);

create table public.payment_attempt (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoice (id) on delete cascade,
  processor text not null default 'stripe',
  processor_intent_id text,
  status public.payment_attempt_status not null,
  amount numeric(12, 2) not null,
  attempted_at timestamptz not null default now(),
  failure_code text,
  failure_message text
);

create index payment_attempt_invoice_idx on public.payment_attempt (invoice_id, attempted_at desc);

create table public.subscription (
  id uuid primary key default gen_random_uuid(),
  case_file_id uuid not null references public.client_case_file (id) on delete cascade,
  charge_type public.charge_type not null,
  amount numeric(12, 2) not null,
  interval_months smallint not null default 1,
  status public.subscription_status not null default 'active',
  current_period_start date,
  current_period_end date,
  started_on date not null,
  cancelled_on date,
  processor_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.subscription.interval_months is '1 for the monthly retainer, 3 for the bundled term where the operator is included.';

create index subscription_case_file_idx on public.subscription (case_file_id);

create trigger subscription_touch before update on public.subscription
  for each row execute function app.touch_updated_at();

-- The retry and reminder sequence. A failed payment nobody notices for three
-- weeks is a client who quietly left, so each step is a row the dashboard can see.
create table public.dunning_event (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoice (id) on delete cascade,
  step smallint not null,
  action text not null,
  occurred_at timestamptz not null default now(),
  next_attempt_at timestamptz,
  detail text
);

create index dunning_event_invoice_idx on public.dunning_event (invoice_id, step);

-- Rule 6. This is DA's revenue from the client, which is a different thing from
-- the client's own business revenue in tracking_metric_daily. Keeping them apart
-- is deliberate: the client dashboard reports their revenue, the margin view
-- reports ours, and conflating the two would make both wrong.
create table public.revenue_record (
  id uuid primary key default gen_random_uuid(),
  case_file_id uuid not null references public.client_case_file (id) on delete cascade,
  invoice_id uuid references public.invoice (id) on delete set null,
  occurred_on date not null,
  revenue_type public.charge_type not null,
  amount numeric(12, 2) not null,
  created_at timestamptz not null default now(),
  unique (invoice_id)
);

comment on table public.revenue_record is 'Rule 6: every paid invoice writes exactly one row here, typed by charge. Single source of truth for DA revenue and the margin view. Not the client''s own revenue -- that lives in tracking_metric_daily.';

create index revenue_record_case_file_idx on public.revenue_record (case_file_id, occurred_on desc);
create index revenue_record_type_idx on public.revenue_record (revenue_type, occurred_on desc);

-- Rule 5, enforced. An issued invoice may only move through its lifecycle; its
-- content is frozen.
create or replace function app.guard_invoice_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'draft' then
    return new;
  end if;

  if new.charge_type <> old.charge_type
     or new.case_file_id <> old.case_file_id
     or new.subtotal <> old.subtotal
     or new.currency <> old.currency
     or new.number is distinct from old.number
     or new.period_start is distinct from old.period_start
     or new.period_end is distinct from old.period_end
     or new.issued_at is distinct from old.issued_at then
    raise exception 'invoice_issued_is_immutable: invoice % was issued on %. Correct it with a credit note rather than editing history.', coalesce(old.number, old.id::text), old.issued_at::date using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger invoice_guard_update before update on public.invoice
  for each row execute function app.guard_invoice_update();

-- Lines and credit notes on an issued invoice are equally frozen.
create or replace function app.guard_invoice_line()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status public.invoice_status;
  v_invoice uuid := coalesce(new.invoice_id, old.invoice_id);
begin
  select status into v_status from public.invoice where id = v_invoice;

  if v_status is not null and v_status <> 'draft' then
    raise exception 'invoice_issued_is_immutable: the line items of an issued invoice cannot change. Raise a credit note.' using errcode = '23514';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger invoice_line_guard before insert or update or delete on public.invoice_line
  for each row execute function app.guard_invoice_line();

create trigger credit_note_immutable before update or delete on public.credit_note
  for each row execute function app.forbid_mutation();

create trigger revenue_record_immutable before update or delete on public.revenue_record
  for each row execute function app.forbid_mutation();
