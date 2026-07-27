-- Every existing policy on this database gates on app.is_admin(). Rather than
-- rewrite them all, the function learns the new roles: an Owner is an Admin and
-- more, and impersonation resolves through it so an Owner viewing the application
-- as an Operator stops seeing admin surfaces.
--
-- Rule 9 lands here too. The state check means a suspended Admin loses every admin
-- policy on their next query, not at their next sign in.
create or replace function app.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profile p
    where p.id = app.acting_profile()
      and p.role in ('owner', 'admin')
      and app.effective_state(p.id) = 'active'
  );
$$;

-- A Manager reads and writes inside their assigned clients. Additive policies
-- rather than edits to the admin ones: Postgres ORs permissive policies together,
-- so the admin path is untouched.
create or replace function app.is_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profile p
    where p.id = app.acting_profile()
      and p.role = 'manager'
      and app.effective_state(p.id) = 'active'
  );
$$;

-- A Contractor sees the client's identity and their own tasks, never the
-- commercial terms, the revenue or the growth reporting.
create or replace function app.is_contractor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profile p
    where p.id = app.acting_profile()
      and p.role = 'contractor'
      and app.effective_state(p.id) = 'active'
  );
$$;

-- The client case file, read only, for a Manager inside scope and for a Contractor
-- with a task on it. The commercial columns are withheld from a Contractor by the
-- view they read rather than by this policy, since RLS is row level.
create policy case_file_manager_read on public.client_case_file
  for select to authenticated
  using (app.is_manager() and app.in_scope_case_file(id));

create policy case_file_manager_write on public.client_case_file
  for update to authenticated
  using (app.is_manager() and app.in_scope_case_file(id) and app.can('clients.edit'))
  with check (app.is_manager() and app.in_scope_case_file(id) and app.can('clients.edit'));

-- Everything keyed to a case file, for a Manager inside scope.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'snapshot', 'milestone', 'evidence_item', 'effort_entry', 'scope_request',
    'decision', 'document', 'placement', 'escalation', 'client_message',
    'growth_report', 'case_file_drive_folder', 'contractor_task'
  ]
  loop
    execute format(
      'create policy %I on public.%I for all to authenticated using (app.is_manager() and app.in_scope_case_file(case_file_id)) with check (app.is_manager() and app.in_scope_case_file(case_file_id))',
      v_table || '_manager_scope', v_table
    );
  end loop;
end $$;

-- A Contractor reads only the tasks assigned to them.
create policy contractor_task_own on public.contractor_task
  for select to authenticated
  using (profile_id = app.acting_profile());

create policy contractor_task_complete on public.contractor_task
  for update to authenticated
  using (profile_id = app.acting_profile())
  with check (profile_id = app.acting_profile());

-- The one thing a Contractor may read about the client itself: who it is. The
-- commercial columns are simply not selected.
create or replace view public.v_contractor_brief
with (security_invoker = true)
as
select
  t.id as task_id,
  t.title,
  t.spec,
  t.due_on,
  t.completed_at,
  cf.id as case_file_id,
  cf.name as client_name,
  cf.vertical
from public.contractor_task t
join public.client_case_file cf on cf.id = t.case_file_id
where t.profile_id = app.acting_profile();

revoke all on public.v_contractor_brief from anon;
