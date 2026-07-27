-- An Operator reaches the client they are placed inside, through the placement
-- rather than through a client assignment. Found by probing as an Operator: scope
-- resolved correctly but no policy consulted it, so the account read nothing.
--
-- Deliberately excludes a Contractor. RLS is row level, so a row policy here would
-- hand them the retainer and the revenue goal alongside the client's name;
-- v_contractor_brief gives them the two columns they need instead.
create or replace function app.reads_case_file_rows()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profile p
    where p.id = app.acting_profile()
      and p.role in ('owner', 'admin', 'manager', 'operator')
      and app.effective_state(p.id) = 'active'
  );
$$;

create policy case_file_scope_read on public.client_case_file
  for select to authenticated
  using (app.reads_case_file_rows() and app.in_scope_case_file(id));
