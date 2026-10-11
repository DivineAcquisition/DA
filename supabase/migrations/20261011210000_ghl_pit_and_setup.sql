-- The DivineACQ GHL Private Integration Token can live on da_settings, the way
-- the Airtable token does, so it can be set from Workspace settings. An env
-- GHL_PIT_TOKEN still wins. Only the service role can read it back.

alter table public.da_settings
  add column if not exists ghl_pit_token text not null default '';

comment on column public.da_settings.ghl_pit_token is
  'GoHighLevel Private Integration Token for the DivineACQ location. Server-side only. Never select it into a client response.';

create or replace function public.da_get_ghl_pit()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  return (select ghl_pit_token from public.da_settings where id = 1);
end;
$$;

revoke all on function public.da_get_ghl_pit() from public, anon, authenticated;
grant execute on function public.da_get_ghl_pit() to service_role;

-- What each "Build in GHL" run found and changed. Names and counts only.
create table if not exists public.ghl_setup_run (
  id bigint generated always as identity primary key,
  ran_at timestamptz not null default now(),
  trigger text not null,
  ok boolean not null,
  summary jsonb not null default '{}'::jsonb
);

alter table public.ghl_setup_run enable row level security;

create policy ghl_setup_run_admin_read on public.ghl_setup_run
  for select to authenticated using (app.is_admin());
