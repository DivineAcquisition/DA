create type public.payout_batch_status as enum ('draft', 'approved', 'executing', 'completed');
create type public.payout_status as enum ('pending', 'sent', 'confirmed', 'failed', 'returned');

create table public.payout_batch (
  id uuid primary key default gen_random_uuid(),
  period_id text not null references public.pay_period (id) on delete cascade,
  status public.payout_batch_status not null default 'draft',
  total_amount numeric(12, 2) not null default 0,
  payout_count integer not null default 0,
  approved_by uuid references public.profile (id),
  approved_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_by uuid references public.profile (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (period_id)
);

comment on table public.payout_batch is 'Vistrial produces the batch; the admin executes it through their transfer provider and records confirmation. Automating cross-border execution adds real risk for a handful of monthly transfers, and can be added later without changing this model.';

create trigger payout_batch_touch before update on public.payout_batch
  for each row execute function app.touch_updated_at();

create table public.payout (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.payout_batch (id) on delete cascade,
  operator_id uuid not null references public.operator (id) on delete restrict,
  statement_id uuid references public.pay_statement (id) on delete set null,
  placement_id uuid references public.placement (id) on delete set null,
  period_id text not null references public.pay_period (id) on delete cascade,
  -- The components are copied onto the payout so the record stands alone even if
  -- a statement is later superseded.
  base_amount numeric(12, 2) not null default 0,
  commission_amount numeric(12, 2) not null default 0,
  bonus_amount numeric(12, 2) not null default 0,
  adjustment_total numeric(12, 2) not null default 0,
  amount numeric(12, 2) not null,
  method public.payout_method,
  payout_reference text,
  status public.payout_status not null default 'pending',
  sent_at timestamptz,
  sent_reference text,
  confirmed_at timestamptz,
  failure_reason text,
  -- A failed or returned payout rolls forward rather than disappearing.
  rolled_into_payout_id uuid references public.payout (id) on delete set null,
  rolled_from_payout_id uuid references public.payout (id) on delete set null,
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payout_batch_idx on public.payout (batch_id);
create index payout_operator_idx on public.payout (operator_id, created_at desc);
create index payout_open_idx on public.payout (status) where status in ('pending', 'sent', 'failed', 'returned');

create trigger payout_touch before update on public.payout
  for each row execute function app.touch_updated_at();

create table public.payout_adjustment (
  id uuid primary key default gen_random_uuid(),
  payout_id uuid not null references public.payout (id) on delete cascade,
  label text not null,
  reason text not null,
  amount numeric(12, 2) not null,
  added_by uuid references public.profile (id),
  added_at timestamptz not null default now()
);

-- Rule 7: once confirmed, a payout record locks. It is the receipt.
create or replace function app.guard_payout_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.locked then
    -- The forward pointer is the one field a locked payout may still gain, so a
    -- returned amount can be traced into the batch that re-sent it.
    if to_jsonb(new) - 'rolled_into_payout_id' - 'updated_at' <> to_jsonb(old) - 'rolled_into_payout_id' - 'updated_at' then
      raise exception 'payout_locked: payout % was confirmed on % and is now a fixed record', old.id, old.confirmed_at using errcode = '23514';
    end if;
  end if;

  -- Confirming is what locks it.
  if new.status = 'confirmed' and not new.locked then
    new.locked := true;
    new.confirmed_at := coalesce(new.confirmed_at, now());
  end if;

  return new;
end;
$$;

create trigger payout_guard_update before update on public.payout
  for each row execute function app.guard_payout_update();

create trigger payout_guard_delete before delete on public.payout
  for each row execute function app.forbid_mutation();
