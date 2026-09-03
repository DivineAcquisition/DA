-- Public onboard runs as anon (publishable key). Keep operators from reading
-- the token; allow anon / service_role / admin, matching da_get_docuseal_api_key.

create or replace function public.da_get_pipeline_airtable_pat()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if app.is_admin()
     or coalesce(auth.role(), '') in ('service_role', 'anon') then
    return (select pipeline_airtable_pat from public.da_settings where id = 1);
  end if;
  raise exception 'admin_required: only an admin can read the pipeline Airtable token'
    using errcode = '42501';
end;
$$;

revoke all on function public.da_get_pipeline_airtable_pat() from public;
grant execute on function public.da_get_pipeline_airtable_pat() to anon, authenticated, service_role;
