-- Pipeline Airtable token lives on da_settings, not in the Next app or the
-- browser bundle. Admins and the service role may read it; anon cannot.

alter table public.da_settings
  add column if not exists pipeline_airtable_pat text not null default '';

comment on column public.da_settings.pipeline_airtable_pat is
  'Personal access token for DA Pipeline Airtable. Server-side only. Empty means Airtable writes wait until this is set. Never grant this to anon or send it to a client.';

create or replace function public.da_get_pipeline_airtable_pat()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app.is_admin() and coalesce(auth.role(), '') is distinct from 'service_role' then
    raise exception 'admin_required: only an admin can read the pipeline Airtable token'
      using errcode = '42501';
  end if;
  return (select pipeline_airtable_pat from public.da_settings where id = 1);
end;
$$;

revoke all on function public.da_get_pipeline_airtable_pat() from public;
grant execute on function public.da_get_pipeline_airtable_pat() to authenticated, service_role;
