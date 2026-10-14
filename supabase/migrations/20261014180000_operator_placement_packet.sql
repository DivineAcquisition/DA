-- When a sales operator is placed, queue the packet that the admin app files:
-- the branded onboarding PDF, the signed agreement, Airtable, and Drive.
-- The queue is the database's job. The bytes are written by the app, which
-- is the only place that can build the PDF and talk to Drive.

create table public.operator_packet (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null unique references public.operator (id) on delete cascade,
  placement_id uuid references public.placement (id) on delete set null,
  case_file_id uuid references public.client_case_file (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'filed', 'failed')),
  error text,
  onboarding_pdf_b64 text,
  agreement_pdf_b64 text,
  agreement_filename text,
  drive_folder_url text,
  drive_onboarding_url text,
  drive_agreement_url text,
  airtable_record_id text,
  filed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.operator_packet is
  'One placement packet per sales operator. Pending until the admin app files the onboarding PDF, the signed agreement, Airtable, and Drive.';

create trigger operator_packet_touch
  before update on public.operator_packet
  for each row execute function app.touch_updated_at();

alter table public.operator_packet enable row level security;

drop policy if exists operator_packet_admin on public.operator_packet;
create policy operator_packet_admin on public.operator_packet
  for all to authenticated
  using (app.is_admin())
  with check (app.is_admin());

revoke all on public.operator_packet from anon;
grant select, update on public.operator_packet to authenticated;
grant select, insert, update, delete on public.operator_packet to service_role;

create or replace function app.queue_operator_packet()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_case uuid;
begin
  if new.status is distinct from 'active' then
    return new;
  end if;

  select id into v_case
    from public.client_case_file
   where operator_id = new.operator_id
     and record_kind = 'operator';

  insert into public.operator_packet (operator_id, placement_id, case_file_id)
  values (new.operator_id, new.id, v_case)
  on conflict (operator_id) do nothing;

  update public.operator
     set status = 'placed'
   where id = new.operator_id
     and status in ('applicant', 'in_training', 'certified', 'on_bench');

  return new;
end;
$$;

revoke all on function app.queue_operator_packet() from public, anon, authenticated;

drop trigger if exists placement_queue_operator_packet on public.placement;
create trigger placement_queue_operator_packet
  after insert on public.placement
  for each row
  execute function app.queue_operator_packet();
