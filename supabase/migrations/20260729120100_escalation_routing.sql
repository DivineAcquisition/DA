-- ---------------------------------------------------------------------------
-- Who an escalation actually goes to.
--
-- The hub set `routed_to: ['DA Admin']` on every escalation it created. There is
-- nobody called DA Admin. When an operator asked who was looking at their
-- escalation, and when an admin asked whether anyone had been told, the answer
-- was a string literal — which is exactly the question section 9 says the
-- delivery log exists to answer.
--
-- The roster is in `profile`. It cannot be read from the application on this path
-- because an operator may only select their own profile row, so the routing is
-- resolved here, by the database, on the way in.
-- ---------------------------------------------------------------------------

create or replace function app.escalation_recipients(p_case_file_id uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct name order by name), '{}')
  from (
    -- Everyone who can actually answer it: the owners and admins, plus any
    -- manager whose scope covers this client.
    select coalesce(nullif(btrim(p.full_name), ''), p.email) as name
    from public.profile p
    where app.effective_state(p.id) = 'active'
      and (
        p.role in ('owner', 'admin')
        -- Mirrors app.in_scope_case_file(), which resolves the acting profile and
        -- so cannot be reused for a third party.
        or (p.role = 'manager' and exists (
          select 1 from public.account_scope s
          where s.profile_id = p.id
            and (
              s.kind = 'all_clients'
              or (s.kind = 'clients' and exists (
                select 1 from public.account_scope_client c
                where c.profile_id = s.profile_id and c.case_file_id = p_case_file_id
              ))
              or (s.kind = 'placements' and exists (
                select 1 from public.account_scope_placement sp
                join public.placement pl on pl.id = sp.placement_id
                where sp.profile_id = s.profile_id and pl.case_file_id = p_case_file_id
              ))
            )
        ))
      )
  ) recipients;
$$;

comment on function app.escalation_recipients is
  'The people who can answer an escalation for this client, by name. Definer because an operator may not read the roster and still has to be told who has it.';

create or replace function app.set_escalation_routing()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Only when the caller left it empty, so an explicit routing decision stands.
  if new.routed_to is null or array_length(new.routed_to, 1) is null then
    new.routed_to := app.escalation_recipients(new.case_file_id);
  end if;
  return new;
end;
$$;

create trigger escalation_routing before insert on public.escalation
  for each row execute function app.set_escalation_routing();

-- ---------------------------------------------------------------------------
-- Existing rows
--
-- The literal is replaced with the roster as it stands. Where the roster cannot
-- be resolved the column is left empty rather than filled with another placeholder:
-- an empty list reads as "nobody recorded", which is true, and a name that was
-- never accurate reads as fact.
-- ---------------------------------------------------------------------------

update public.escalation e
   set routed_to = app.escalation_recipients(e.case_file_id)
 where e.routed_to = array['DA Admin'];
