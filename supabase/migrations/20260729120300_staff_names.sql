-- ---------------------------------------------------------------------------
-- Who did it, by name.
--
-- `operator_task.assigned_by` and `pay_adjustment.added_by` are profile
-- references, and the hub rendered both as the string 'DA Admin' because an
-- operator may only select their own row from `profile`. So an operator looking at
-- a deduction on their pay statement could not find out who made it, which is the
-- one thing they would want to know.
--
-- Staff names are not sensitive to the people they work with every day. Their
-- email addresses and everything else on the profile are, so this exposes the name
-- and nothing else.
-- ---------------------------------------------------------------------------

create or replace view public.v_staff_name
with (security_invoker = false)
as
select
  p.id as profile_id,
  coalesce(nullif(btrim(p.full_name), ''), split_part(p.email, '@', 1)) as display_name,
  p.role
from public.profile p
where p.role in ('owner', 'admin', 'manager')
  and app.effective_state(p.id) = 'active';

comment on view public.v_staff_name is
  'Names of the active staff, and nothing else about them. Definer so an operator can be told who assigned their task or adjusted their pay without being able to read the roster itself.';

grant select on public.v_staff_name to authenticated;
revoke all on public.v_staff_name from anon;
