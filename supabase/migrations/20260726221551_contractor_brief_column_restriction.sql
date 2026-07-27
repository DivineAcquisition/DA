-- RLS is row level, so giving a Contractor a policy on client_case_file would hand
-- them the retainer and the revenue goal alongside the client's name. The
-- restriction they need is column level, which is what a definer view gives: it
-- selects only the safe columns, and the WHERE clause inside is the boundary.
drop view if exists public.v_contractor_brief;

create view public.v_contractor_brief as
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
where t.profile_id = app.acting_profile()
  and app.effective_state(app.acting_profile()) = 'active';

comment on view public.v_contractor_brief is
  'Deliberately not security_invoker. A Contractor needs the client name and the task spec but must never reach the commercial terms, and that is a column restriction rather than a row one.';

revoke all on public.v_contractor_brief from anon;
grant select on public.v_contractor_brief to authenticated;
