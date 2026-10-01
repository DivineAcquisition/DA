-- ===========================================================================
-- GHL connection layer, part 3: access map, provisioning, reconciliation
--
-- "Should have" is computed from DA's own records. "Has" is what GHL reports.
-- Provisioning moves GHL toward should-have through the job queue; the worker
-- makes the GHL calls. Removal is immediate on suspend, offboard, terminate,
-- lockdown and "Revoke all GHL access": the triggers below queue it at once,
-- at the highest priority, and the server kicks the worker.
--
-- Users the app did not create are never removed without an admin confirming,
-- and users an admin marked as client or agency staff are never touched.
-- Nothing here deletes a GHL user. Deactivate means: every DA location
-- removed and every permission turned off.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Should have
-- ---------------------------------------------------------------------------

create or replace function app.ghl_lockdown_engaged()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select exists (select 1 from public.lockdown where released_at is null); $$;

-- Why a person may not hold GHL access at all right now, or null.
create or replace function app.ghl_access_barrier(p_profile_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when app.ghl_lockdown_engaged() then 'lockdown'
    when exists (select 1 from public.ghl_access_block b where b.profile_id = p_profile_id) then 'revoked by an admin'
    when exists (select 1 from public.offboarding ob where ob.profile_id = p_profile_id) then 'offboarding'
    when app.effective_state(p_profile_id) in ('suspended', 'archived', 'expired') then 'account ' || app.effective_state(p_profile_id)::text
    when app.effective_state(p_profile_id) is null then 'no account'
    else null
  end;
$$;

create or replace function app.ghl_should_have(p_profile_id uuid default null)
returns table (profile_id uuid, case_file_id uuid, location_id text, reason text, placement_id uuid, profile_key text)
language sql
stable
security definer
set search_path = ''
as $$
  with candidates as (
    -- VAs: while they hold an active placement with that client.
    select o.profile_id, pl.case_file_id, l.location_id, 'placement'::text as reason, pl.id as placement_id, 'va'::text as profile_key, 1 as rank
    from public.placement pl
    join public.operator o on o.id = pl.operator_id
    join public.ghl_location l on l.case_file_id = pl.case_file_id
    where pl.status = 'active' and pl.end_date >= current_date and o.profile_id is not null
      and (p_profile_id is null or o.profile_id = p_profile_id)
    union all
    -- Managers: the clients in their scope.
    select p.id, l.case_file_id, l.location_id, 'manager_scope', null, 'manager', 2
    from public.profile p
    join public.ghl_location l on app.scope_includes_case_file(p.id, l.case_file_id)
    where p.role = 'manager' and (p_profile_id is null or p.id = p_profile_id)
    union all
    -- Admins and owners: only when explicitly enabled for that person.
    select p.id, l.case_file_id, l.location_id, 'admin_optin', null, 'manager', 3
    from public.ghl_access_optin oi
    join public.profile p on p.id = oi.profile_id
    cross join public.ghl_location l
    where p.role in ('owner', 'admin') and (p_profile_id is null or p.id = p_profile_id)
  )
  select distinct on (c.profile_id, c.case_file_id)
    c.profile_id, c.case_file_id, c.location_id, c.reason, c.placement_id, c.profile_key
  from candidates c
  where app.ghl_access_barrier(c.profile_id) is null
  order by c.profile_id, c.case_file_id, c.rank;
$$;

-- ---------------------------------------------------------------------------
-- Queue
-- ---------------------------------------------------------------------------

create or replace function app.ghl_enqueue(p_kind text, p_case_file_id uuid, p_dedupe text, p_payload jsonb, p_priority integer default 5)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  insert into public.ghl_job (kind, case_file_id, dedupe_key, payload, priority, created_by)
  values (p_kind, p_case_file_id, p_dedupe, coalesce(p_payload, '{}'::jsonb), p_priority, auth.uid())
  on conflict (dedupe_key) where status in ('queued', 'running', 'failed') do nothing
  returning id into v_id;
  if v_id is null then
    -- Already queued: bring it forward rather than doubling it.
    update public.ghl_job set next_attempt_at = least(next_attempt_at, now()), priority = least(priority, p_priority)
     where dedupe_key = p_dedupe and status in ('queued', 'failed')
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

-- Move grants toward should-have, for one person or for everyone.
create or replace function app.ghl_sync_access(p_profile_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_grant uuid;
  v_added integer := 0;
  v_removed integer := 0;
  v_barrier text;
begin
  -- Grant what is missing.
  for r in
    select s.* from app.ghl_should_have(p_profile_id) s
    where not exists (
      select 1 from public.ghl_access_grant g
      where g.profile_id = s.profile_id and g.case_file_id = s.case_file_id and g.state <> 'revoked')
  loop
    insert into public.ghl_access_grant (profile_id, case_file_id, location_id, reason, placement_id, profile_key, ghl_user_id)
    values (r.profile_id, r.case_file_id, r.location_id, r.reason, r.placement_id, r.profile_key,
            (select u.ghl_user_id from public.ghl_user u where u.profile_id = r.profile_id))
    returning id into v_grant;
    perform app.ghl_enqueue('grant', r.case_file_id, 'grant:' || v_grant, jsonb_build_object('grant_id', v_grant), 5);
    v_added := v_added + 1;
  end loop;

  -- Keep the basis current on grants that still stand.
  update public.ghl_access_grant g
     set placement_id = s.placement_id, reason = s.reason
    from app.ghl_should_have(p_profile_id) s
   where g.profile_id = s.profile_id and g.case_file_id = s.case_file_id
     and g.state in ('pending', 'active', 'failed')
     and (g.placement_id is distinct from s.placement_id or g.reason <> s.reason);

  -- Remove what should no longer be there. Highest priority.
  for r in
    select g.* from public.ghl_access_grant g
    where g.state in ('pending', 'active', 'failed')
      and (p_profile_id is null or g.profile_id = p_profile_id)
      and not exists (
        select 1 from app.ghl_should_have(g.profile_id) s where s.case_file_id = g.case_file_id)
  loop
    v_barrier := app.ghl_access_barrier(r.profile_id);
    update public.ghl_access_grant
       set state = 'revoking', revoke_requested_at = now(),
           revoke_reason = coalesce(v_barrier, case r.reason when 'placement' then 'placement ended' else 'no longer in scope' end)
     where id = r.id;
    update public.ghl_job set status = 'cancelled', finished_at = now(), last_error = 'access no longer needed'
     where dedupe_key = 'grant:' || r.id and status in ('queued', 'failed');
    perform app.ghl_enqueue('revoke', r.case_file_id, 'revoke:' || r.id, jsonb_build_object('grant_id', r.id), 1);
    v_removed := v_removed + 1;
  end loop;

  return jsonb_build_object('granted', v_added, 'revoking', v_removed);
end;
$$;

-- ---------------------------------------------------------------------------
-- Immediate triggers
-- ---------------------------------------------------------------------------

create or replace function app.ghl_sync_on_placement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.ghl_sync_access(o.profile_id) from public.operator o where o.id = new.operator_id and o.profile_id is not null;
  return null;
end;
$$;

drop trigger if exists placement_ghl_sync on public.placement;
create trigger placement_ghl_sync after insert or update of status, end_date, operator_id on public.placement
  for each row execute function app.ghl_sync_on_placement();

create or replace function app.ghl_sync_on_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.ghl_sync_access(new.id);
  return null;
end;
$$;

drop trigger if exists profile_ghl_sync on public.profile;
create trigger profile_ghl_sync after update of state, role, suspended_at, archived_at, soft_deleted_at, expires_on on public.profile
  for each row execute function app.ghl_sync_on_profile();

create or replace function app.ghl_sync_on_profile_ref()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.ghl_sync_access(case when tg_op = 'DELETE' then old.profile_id else new.profile_id end);
  return null;
end;
$$;

drop trigger if exists offboarding_ghl_sync on public.offboarding;
create trigger offboarding_ghl_sync after insert or update on public.offboarding
  for each row execute function app.ghl_sync_on_profile_ref();
drop trigger if exists account_scope_ghl_sync on public.account_scope;
create trigger account_scope_ghl_sync after insert or update or delete on public.account_scope
  for each row execute function app.ghl_sync_on_profile_ref();
drop trigger if exists account_scope_client_ghl_sync on public.account_scope_client;
create trigger account_scope_client_ghl_sync after insert or update or delete on public.account_scope_client
  for each row execute function app.ghl_sync_on_profile_ref();
drop trigger if exists account_scope_placement_ghl_sync on public.account_scope_placement;
create trigger account_scope_placement_ghl_sync after insert or update or delete on public.account_scope_placement
  for each row execute function app.ghl_sync_on_profile_ref();

create or replace function app.ghl_sync_all_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.ghl_sync_access(null);
  return null;
end;
$$;

drop trigger if exists lockdown_ghl_sync on public.lockdown;
create trigger lockdown_ghl_sync after insert or update on public.lockdown
  for each statement execute function app.ghl_sync_all_trigger();
drop trigger if exists ghl_location_sync on public.ghl_location;
create trigger ghl_location_sync after insert on public.ghl_location
  for each statement execute function app.ghl_sync_all_trigger();

-- ---------------------------------------------------------------------------
-- Worker: claim, context, completion (service role)
-- ---------------------------------------------------------------------------

create or replace function app.ghl_job_context(j public.ghl_job)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  g public.ghl_access_grant;
  p public.profile;
  u public.ghl_user;
  pp public.ghl_permission_profile;
  v_name text;
begin
  if j.kind in ('grant', 'revoke', 'fix_permissions') then
    select * into g from public.ghl_access_grant where id = (j.payload ->> 'grant_id')::uuid;
    select * into p from public.profile where id = g.profile_id;
    select * into u from public.ghl_user where profile_id = g.profile_id;
    if u.ghl_user_id is null and g.ghl_user_id is not null then
      select * into u from public.ghl_user where ghl_user_id = g.ghl_user_id;
    end if;
    select * into pp from public.ghl_permission_profile where key = g.profile_key;
    select coalesce(o.name, p.full_name, p.email) into v_name from public.operator o where o.profile_id = p.id;
    v_name := coalesce(v_name, p.full_name, split_part(p.email, '@', 1));
    return jsonb_build_object(
      'grant_id', g.id, 'grant_state', g.state, 'case_file_id', g.case_file_id, 'location_id', g.location_id,
      'profile_id', p.id, 'email', lower(p.email), 'name', v_name,
      'ghl_user_id', coalesce(u.ghl_user_id, g.ghl_user_id), 'created_by_app', coalesce(u.created_by_app, false),
      'known_kind', u.known_kind,
      'ghl_role', pp.ghl_role, 'ghl_type', pp.ghl_type, 'permissions', pp.permissions, 'verify_manually', to_jsonb(pp.verify_manually),
      -- Other DA locations this person keeps, so a revoke knows whether the
      -- user is left with nothing and should be deactivated.
      'keep_location_ids', coalesce((
        select jsonb_agg(distinct g2.location_id) from public.ghl_access_grant g2
        where g2.profile_id = g.profile_id and g2.id <> g.id and g2.state in ('pending', 'active', 'failed')), '[]'::jsonb),
      'da_location_ids', coalesce((select jsonb_agg(location_id) from public.ghl_location), '[]'::jsonb)
    );
  elsif j.kind = 'remove_extra' then
    select * into u from public.ghl_user where ghl_user_id = j.payload ->> 'ghl_user_id';
    return jsonb_build_object('ghl_user_id', u.ghl_user_id, 'location_id', j.payload ->> 'location_id',
      'created_by_app', u.created_by_app, 'known_kind', u.known_kind, 'case_file_id', j.case_file_id,
      'confirmed_by', j.payload ->> 'confirmed_by',
      'keep_location_ids', coalesce((
        select jsonb_agg(distinct g2.location_id) from public.ghl_access_grant g2
        where g2.ghl_user_id = u.ghl_user_id and g2.state in ('pending', 'active', 'failed')
          and g2.location_id <> j.payload ->> 'location_id'), '[]'::jsonb),
      'da_location_ids', coalesce((select jsonb_agg(location_id) from public.ghl_location), '[]'::jsonb));
  elsif j.kind = 'assign_owner' then
    return (
      select jsonb_build_object('lead_id', l.id, 'contact_id', l.external_id, 'case_file_id', l.case_file_id,
        'location_id', gl.location_id, 'ghl_user_id', u2.ghl_user_id, 'operator_id', r.operator_id)
      from public.lead l
      join public.lead_routing r on r.lead_id = l.id
      join public.ghl_location gl on gl.case_file_id = l.case_file_id
      left join public.operator o on o.id = r.operator_id
      left join public.ghl_user u2 on u2.profile_id = o.profile_id
      where l.id = (j.payload ->> 'lead_id')::uuid);
  end if;
  return '{}'::jsonb;
end;
$$;

create or replace function public.ghl_claim_jobs(p_limit integer default 25)
returns setof jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  j public.ghl_job;
  v_agency_ok boolean;
  v_needs_agency boolean;
  v_conn public.ghl_connection;
begin
  -- A worker that died mid-job left it running; it is safe to pick up again
  -- because every job is idempotent against GHL's current state.
  update public.ghl_job set status = 'queued' where status = 'running' and claimed_at < now() - interval '10 minutes';

  v_agency_ok := coalesce((app.ghl_live_connection(null)).status in ('healthy', 'degraded'), false);

  for j in
    select * from public.ghl_job
    where status in ('queued', 'failed') and next_attempt_at <= now()
    order by priority, next_attempt_at
    limit greatest(coalesce(p_limit, 25), 1)
    for update skip locked
  loop
    v_needs_agency := j.kind in ('grant', 'revoke', 'fix_permissions', 'remove_extra');
    v_conn := app.ghl_live_connection(j.case_file_id);
    if (v_needs_agency and not v_agency_ok and not coalesce(v_conn.status in ('healthy', 'degraded'), false))
       or (j.kind = 'assign_owner' and not coalesce(v_conn.status in ('healthy', 'degraded'), false)) then
      -- Paused, not failed: the connection it needs is not working.
      update public.ghl_job set next_attempt_at = now() + interval '10 minutes',
             last_error = 'waiting: the GHL connection this needs is not healthy'
       where id = j.id;
      continue;
    end if;
    update public.ghl_job set status = 'running', claimed_at = now(), attempts = attempts + 1 where id = j.id;
    return next jsonb_build_object('job_id', j.id, 'kind', j.kind, 'case_file_id', j.case_file_id,
      'attempt', j.attempts + 1, 'context', app.ghl_job_context(j));
  end loop;
end;
$$;

create or replace function app.ghl_log_change(
  p_job public.ghl_job, p_action text, p_outcome text, p_detail text,
  p_ghl_user_id text, p_profile_id uuid, p_case_file_id uuid, p_location_id text
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.ghl_user_change (actor_profile_id, actor_label, job_id, ghl_user_id, profile_id, case_file_id, location_id, action, outcome, detail)
  values (p_job.created_by, case when p_job.created_by is null then 'system' else 'admin' end, p_job.id,
          p_ghl_user_id, p_profile_id, p_case_file_id, p_location_id, p_action, p_outcome, left(p_detail, 500));
$$;

-- p_result for a grant: { ghl_user_id, created, linked_existing, email, name, changes: [{action, outcome, detail}], verify_manually: [] }
-- p_result for a revoke: { ghl_user_id, deactivated, changes: [...] }
create or replace function public.ghl_complete_job(p_job_id bigint, p_ok boolean, p_result jsonb default '{}'::jsonb, p_error text default null, p_retryable boolean default true)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  j public.ghl_job;
  g public.ghl_access_grant;
  c jsonb;
  v_user text := p_result ->> 'ghl_user_id';
  v_op public.operator;
  v_case text;
  v_delay interval;
begin
  select * into j from public.ghl_job where id = p_job_id for update;
  if j.id is null then return; end if;
  if j.kind in ('grant', 'revoke', 'fix_permissions') then
    select * into g from public.ghl_access_grant where id = (j.payload ->> 'grant_id')::uuid for update;
  end if;
  v_case := app.ghl_case_name(j.case_file_id);

  -- Log every user change the worker reports, success or failure.
  for c in select * from jsonb_array_elements(coalesce(p_result -> 'changes', '[]'::jsonb)) loop
    perform app.ghl_log_change(j, c ->> 'action', coalesce(c ->> 'outcome', case when p_ok then 'ok' else 'failed' end), c ->> 'detail',
      coalesce(c ->> 'ghl_user_id', v_user), g.profile_id, j.case_file_id, coalesce(c ->> 'location_id', g.location_id, j.payload ->> 'location_id'));
  end loop;

  if p_ok then
    update public.ghl_job set status = 'done', finished_at = now(), result = p_result, last_error = null where id = j.id;

    if v_user is not null and j.kind in ('grant', 'fix_permissions') then
      insert into public.ghl_user (ghl_user_id, profile_id, email, name, created_by_app, seen_at)
      values (v_user, g.profile_id, p_result ->> 'email', p_result ->> 'name', coalesce((p_result ->> 'created')::boolean, false), now())
      on conflict (ghl_user_id) do update
        set profile_id = coalesce(public.ghl_user.profile_id, excluded.profile_id),
            email = coalesce(excluded.email, public.ghl_user.email),
            created_by_app = public.ghl_user.created_by_app or excluded.created_by_app,
            deactivated_at = null, seen_at = now();
    end if;

    if j.kind in ('grant', 'fix_permissions') and g.id is not null and g.state <> 'revoking' then
      update public.ghl_access_grant
         set state = 'active', granted_at = coalesce(granted_at, now()), ghl_user_id = coalesce(v_user, ghl_user_id),
             last_error = null,
             verify_manually = coalesce(array(select jsonb_array_elements_text(p_result -> 'verify_manually')), '{}')
       where id = g.id;
      if j.kind = 'grant' and g.state <> 'active' then
        select * into v_op from public.operator where profile_id = g.profile_id;
        if v_op.id is not null then
          perform app.notify_operator(v_op.id, 'ghl_access_ready', 'informational',
            format('Your GHL access for %s is ready', v_case),
            format('Your GoHighLevel access for %s is set up. Sign in at GoHighLevel with %s. If this is your first time, use "Forgot password" on the GHL sign-in page to set your own password; DA never sees or sends it. Open it from My Day.',
              v_case, coalesce(p_result ->> 'email', 'your work email')),
            '/vistrial/operator', 'normal', null, g.placement_id, false);
        else
          perform app.notify_staff(array[g.profile_id], 'ghl_access_ready', 'informational',
            format('Your GHL access for %s is ready', v_case),
            'Sign in at GoHighLevel with your DA email. First time: use "Forgot password" to set your own password.', null);
        end if;
      end if;
    elsif j.kind = 'revoke' and g.id is not null then
      update public.ghl_access_grant set state = 'revoked', revoked_at = now(), last_error = null where id = g.id;
      if coalesce((p_result ->> 'deactivated')::boolean, false) and v_user is not null then
        update public.ghl_user set deactivated_at = now(), location_ids = '{}' where ghl_user_id = v_user;
      end if;
      -- Access that comes back (say, a reactivated account) is granted fresh.
      perform app.ghl_sync_access(g.profile_id);
    elsif j.kind = 'remove_extra' then
      update public.ghl_access_mismatch set resolved_at = now(), resolution = 'removed'
       where kind = 'extra' and ghl_user_id = j.payload ->> 'ghl_user_id' and location_id = j.payload ->> 'location_id' and resolved_at is null;
      delete from public.ghl_user_location where ghl_user_id = j.payload ->> 'ghl_user_id' and location_id = j.payload ->> 'location_id';
      if coalesce((p_result ->> 'deactivated')::boolean, false) then
        update public.ghl_user set deactivated_at = now() where ghl_user_id = j.payload ->> 'ghl_user_id';
      end if;
    elsif j.kind = 'assign_owner' then
      update public.lead_routing set owner_state = 'set', owner_set_at = now(), owner_error = null
       where lead_id = (j.payload ->> 'lead_id')::uuid;
      insert into public.ghl_user_change (actor_label, job_id, ghl_user_id, case_file_id, action, outcome, detail)
      values ('system', j.id, v_user, j.case_file_id, 'assign_owner', 'ok', 'Contact owner set for routing');
    end if;
    return;
  end if;

  -- Failure: retry safely with back-off, then give up loudly.
  v_delay := least(interval '60 minutes', interval '1 minute' * power(2, least(j.attempts, 6)));
  if p_retryable and j.attempts < 6 then
    update public.ghl_job set status = 'failed', next_attempt_at = now() + v_delay, last_error = left(p_error, 500), result = p_result where id = j.id;
  else
    update public.ghl_job set status = 'dead', finished_at = now(), last_error = left(p_error, 500), result = p_result where id = j.id;
  end if;

  if j.kind = 'grant' and g.id is not null and g.state <> 'revoking' then
    update public.ghl_access_grant set state = 'failed', last_error = left(p_error, 300) where id = g.id;
    if j.attempts = 1 or not p_retryable or j.attempts >= 6 then
      perform app.ghl_alert_admins('ghl.access_pending', 'GHL access pending',
        format('Setting up GHL access for %s on %s failed: %s. %s',
          coalesce((select full_name from public.profile where id = g.profile_id), 'a person'), v_case, left(coalesce(p_error, ''), 200),
          case when p_retryable and j.attempts < 6 then 'It retries automatically.' else 'It will not retry on its own; fix it from Access overview.' end));
    end if;
  elsif j.kind in ('revoke', 'remove_extra') then
    if g.id is not null then
      update public.ghl_access_grant set last_error = left(p_error, 300) where id = g.id;
    end if;
    -- Access that should be gone and is not is urgent every time.
    perform app.ghl_alert_admins('ghl.revoke_failed', 'GHL access removal failed',
      format('Removing GHL access on %s failed: %s. %s Remove it by hand in GHL if this is urgent.',
        v_case, left(coalesce(p_error, ''), 200),
        case when p_retryable and j.attempts < 6 then 'It retries automatically.' else 'It will not retry on its own.' end), 'urgent');
  elsif j.kind = 'assign_owner' then
    update public.lead_routing set owner_state = 'failed', owner_error = left(p_error, 300) where lead_id = (j.payload ->> 'lead_id')::uuid;
  elsif j.kind = 'fix_permissions' and (j.attempts >= 6 or not p_retryable) then
    perform app.ghl_alert_admins('ghl.fix_failed', 'GHL permission fix failed',
      format('Fixing GHL permissions on %s failed: %s.', v_case, left(coalesce(p_error, ''), 200)));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reconciliation
--
-- p_users is GHL's list of users who can reach this location:
--   [{ id, name, email, role, type, locationIds: [], permissions: {} }]
-- ---------------------------------------------------------------------------

create or replace function public.ghl_record_location_users(p_case_file_id uuid, p_users jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.ghl_location;
  u jsonb;
  r record;
  v_profile uuid;
  v_new_missing integer := 0;
  v_new_extra integer := 0;
  v_new_wrong integer := 0;
  v_auto integer := 0;
  v_diff text;
  v_id uuid;
begin
  select * into v_link from public.ghl_location where case_file_id = p_case_file_id;
  if v_link.case_file_id is null then
    raise exception 'not_linked' using errcode = 'P0002';
  end if;

  -- Has: refresh what GHL says.
  for u in select * from jsonb_array_elements(coalesce(p_users, '[]'::jsonb)) loop
    select p.id into v_profile from public.profile p
    where lower(p.email) = lower(u ->> 'email')
      and not exists (select 1 from public.ghl_user x where x.profile_id = p.id and x.ghl_user_id <> u ->> 'id')
    limit 1;
    insert into public.ghl_user (ghl_user_id, profile_id, email, name, ghl_role, ghl_type, location_ids, permissions, seen_at)
    values (u ->> 'id', v_profile, lower(u ->> 'email'), u ->> 'name', u ->> 'role', u ->> 'type',
            coalesce(array(select jsonb_array_elements_text(u -> 'locationIds')), '{}'), u -> 'permissions', now())
    on conflict (ghl_user_id) do update
      set profile_id = coalesce(public.ghl_user.profile_id, excluded.profile_id),
          email = excluded.email, name = excluded.name, ghl_role = excluded.ghl_role, ghl_type = excluded.ghl_type,
          location_ids = excluded.location_ids, permissions = excluded.permissions, seen_at = now();
  end loop;

  delete from public.ghl_user_location where location_id = v_link.location_id
    and ghl_user_id not in (select x ->> 'id' from jsonb_array_elements(coalesce(p_users, '[]'::jsonb)) x);
  insert into public.ghl_user_location (ghl_user_id, location_id, permissions, seen_at)
  select x ->> 'id', v_link.location_id, x -> 'permissions', now() from jsonb_array_elements(coalesce(p_users, '[]'::jsonb)) x
  on conflict (ghl_user_id, location_id) do update set permissions = excluded.permissions, seen_at = now();

  -- Clear open mismatches; whatever is still wrong is found again below.
  create temporary table if not exists pg_temp.ghl_found (kind text, profile_id uuid, ghl_user_id text, detail text) on commit drop;
  truncate pg_temp.ghl_found;

  -- Missing: should have, not in GHL, and not just queued.
  insert into pg_temp.ghl_found
  select 'missing', s.profile_id, gu.ghl_user_id,
         format('%s should have access (%s) and GHL does not list them', coalesce(p.full_name, p.email), replace(s.reason, '_', ' '))
  from app.ghl_should_have(null) s
  join public.profile p on p.id = s.profile_id
  left join public.ghl_user gu on gu.profile_id = s.profile_id
  left join public.ghl_access_grant g on g.profile_id = s.profile_id and g.case_file_id = s.case_file_id and g.state <> 'revoked'
  where s.case_file_id = p_case_file_id
    and not exists (select 1 from public.ghl_user_location ul where ul.location_id = v_link.location_id and ul.ghl_user_id = gu.ghl_user_id)
    and coalesce(g.state, 'none') not in ('pending');

  -- Extra: in GHL, should not be, and not marked staff.
  insert into pg_temp.ghl_found
  select 'extra', gu.profile_id, gu.ghl_user_id,
         format('%s (%s) can reach this sub-account and DA has no reason for it%s', coalesce(gu.name, 'A user'), coalesce(gu.email, 'no email'),
           case when gu.created_by_app then '. DA created this user, so it is being removed.' else '. DA did not create this user: confirm before removing.' end)
  from public.ghl_user_location ul
  join public.ghl_user gu on gu.ghl_user_id = ul.ghl_user_id
  where ul.location_id = v_link.location_id
    and gu.known_kind is null
    and not exists (select 1 from app.ghl_should_have(null) s where s.case_file_id = p_case_file_id and s.profile_id = gu.profile_id)
    and not exists (select 1 from public.ghl_access_grant g where g.ghl_user_id = gu.ghl_user_id and g.case_file_id = p_case_file_id and g.state = 'revoking');

  -- Wrong permissions: should have, present, and a flag differs from the profile.
  for r in
    select s.profile_id, gu.ghl_user_id, ul.permissions as has, pp.permissions as want
    from app.ghl_should_have(null) s
    join public.ghl_user gu on gu.profile_id = s.profile_id
    join public.ghl_user_location ul on ul.ghl_user_id = gu.ghl_user_id and ul.location_id = v_link.location_id
    join public.ghl_permission_profile pp on pp.key = s.profile_key
    where s.case_file_id = p_case_file_id and ul.permissions is not null
  loop
    select string_agg(format('%s should be %s', w.key, w.value), ', ') into v_diff
    from jsonb_each(r.want) w
    where (r.has -> w.key) is distinct from w.value and not (w.value = 'false'::jsonb and r.has -> w.key is null);
    if v_diff is not null then
      insert into pg_temp.ghl_found values ('wrong_permissions', r.profile_id, r.ghl_user_id, v_diff);
    end if;
  end loop;

  update public.ghl_access_mismatch m set resolved_at = now(), resolution = 'cleared on recheck'
  where m.case_file_id = p_case_file_id and m.resolved_at is null
    and not exists (select 1 from pg_temp.ghl_found f where f.kind = m.kind
      and f.profile_id is not distinct from m.profile_id and f.ghl_user_id is not distinct from m.ghl_user_id);

  for r in select * from pg_temp.ghl_found loop
    insert into public.ghl_access_mismatch (case_file_id, location_id, kind, profile_id, ghl_user_id, detail)
    values (p_case_file_id, v_link.location_id, r.kind, r.profile_id, r.ghl_user_id, r.detail)
    on conflict (case_file_id, kind, coalesce(profile_id::text, ''), coalesce(ghl_user_id, '')) where resolved_at is null
    do update set detail = excluded.detail
    returning id into v_id;
    if (select alerted_at from public.ghl_access_mismatch where id = v_id) is null then
      if r.kind = 'missing' then v_new_missing := v_new_missing + 1;
      elsif r.kind = 'extra' then v_new_extra := v_new_extra + 1;
      else v_new_wrong := v_new_wrong + 1; end if;
      update public.ghl_access_mismatch set alerted_at = now() where id = v_id;
    end if;
    -- An extra user the app created is the app's to remove.
    if r.kind = 'extra' and exists (select 1 from public.ghl_user where ghl_user_id = r.ghl_user_id and created_by_app) then
      perform app.ghl_enqueue('remove_extra', p_case_file_id, 'extra:' || r.ghl_user_id || ':' || v_link.location_id,
        jsonb_build_object('ghl_user_id', r.ghl_user_id, 'location_id', v_link.location_id, 'confirmed_by', null), 2);
      v_auto := v_auto + 1;
    end if;
  end loop;

  update public.ghl_location set users_checked_at = now(), reconcile_requested_at = null where case_file_id = p_case_file_id;

  if v_new_missing + v_new_extra + v_new_wrong > 0 then
    perform app.ghl_alert_admins('ghl.access_mismatch', 'GHL access mismatch',
      format('%s: %s missing, %s extra, %s with wrong permissions. Review in Access overview.',
        app.ghl_case_name(p_case_file_id), v_new_missing, v_new_extra, v_new_wrong),
      case when v_new_extra > 0 then 'urgent'::public.notification_severity else 'important'::public.notification_severity end);
  end if;

  return jsonb_build_object('missing', v_new_missing, 'extra', v_new_extra, 'wrong_permissions', v_new_wrong, 'auto_removing', v_auto);
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin actions
-- ---------------------------------------------------------------------------

create or replace function public.ghl_fix_mismatch(p_mismatch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.ghl_access_mismatch;
  g public.ghl_access_grant;
  v_job bigint;
begin
  perform app.require('ghl.access.manage');
  select * into m from public.ghl_access_mismatch where id = p_mismatch_id and resolved_at is null;
  if m.id is null then
    raise exception 'mismatch_not_found: it may already be resolved' using errcode = 'P0002';
  end if;

  if m.kind = 'extra' then
    -- Removing access always needs step-up, and is never automatic for a user
    -- the app did not create: this confirmation is the admin's.
    perform app.require_step_up('remove GHL access');
    if exists (select 1 from public.ghl_user where ghl_user_id = m.ghl_user_id and known_kind is not null) then
      raise exception 'known_user: that user is marked as staff and is never touched' using errcode = '23514';
    end if;
    v_job := app.ghl_enqueue('remove_extra', m.case_file_id, 'extra:' || m.ghl_user_id || ':' || m.location_id,
      jsonb_build_object('ghl_user_id', m.ghl_user_id, 'location_id', m.location_id, 'confirmed_by', auth.uid()), 1);
  else
    perform app.ghl_sync_access(m.profile_id);
    select * into g from public.ghl_access_grant where profile_id = m.profile_id and case_file_id = m.case_file_id and state <> 'revoked';
    if g.id is null then
      raise exception 'no_basis: DA has no reason for this person to have access any more' using errcode = '23514';
    end if;
    v_job := app.ghl_enqueue(case when m.kind = 'missing' then 'grant' else 'fix_permissions' end, m.case_file_id,
      (case when m.kind = 'missing' then 'grant:' else 'fix:' end) || g.id, jsonb_build_object('grant_id', g.id), 2);
  end if;

  update public.ghl_access_mismatch set resolution = 'fix queued', resolved_by = auth.uid() where id = m.id;
  perform app.audit('ghl.mismatch_fix', 'ghl_access_mismatch', m.id::text,
    format('Queued a fix for %s access on %s', replace(m.kind, '_', ' '), app.ghl_case_name(m.case_file_id)), null, null, m.case_file_id);
  return jsonb_build_object('job_id', v_job);
end;
$$;

create or replace function public.ghl_mark_known_user(p_ghl_user_id text, p_kind text, p_case_file_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.require('ghl.access.manage');
  if p_kind is not null and p_kind not in ('client_staff', 'agency_staff') then
    raise exception 'kind_invalid' using errcode = '22023';
  end if;
  update public.ghl_user
     set known_kind = p_kind, known_case_file_id = case when p_kind is null then null else p_case_file_id end,
         known_marked_by = auth.uid(), known_marked_at = now()
   where ghl_user_id = p_ghl_user_id;
  if not found then
    raise exception 'user_not_found: that GHL user has not been seen yet' using errcode = 'P0002';
  end if;
  if p_kind is not null then
    update public.ghl_access_mismatch set resolved_at = now(), resolved_by = auth.uid(), resolution = 'marked ' || replace(p_kind, '_', ' ')
     where ghl_user_id = p_ghl_user_id and resolved_at is null;
    update public.ghl_job set status = 'cancelled', finished_at = now(), last_error = 'user marked as staff'
     where kind = 'remove_extra' and payload ->> 'ghl_user_id' = p_ghl_user_id and status in ('queued', 'failed');
  end if;
  perform app.audit('ghl.user_marked', 'ghl_user', p_ghl_user_id,
    format('Marked GHL user %s as %s', p_ghl_user_id, coalesce(replace(p_kind, '_', ' '), 'not staff')), null, null, p_case_file_id);
end;
$$;

create or replace function public.ghl_set_admin_access(p_profile_id uuid, p_enabled boolean, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.require('ghl.access.manage');
  if not exists (select 1 from public.profile where id = p_profile_id and role in ('owner', 'admin')) then
    raise exception 'not_admin: explicit GHL access is for admins and owners' using errcode = '23514';
  end if;
  if p_enabled then
    insert into public.ghl_access_optin (profile_id, enabled_by, reason) values (p_profile_id, auth.uid(), p_reason)
    on conflict (profile_id) do nothing;
  else
    perform app.require_step_up('remove GHL access');
    delete from public.ghl_access_optin where profile_id = p_profile_id;
  end if;
  perform app.audit(case when p_enabled then 'ghl.admin_access_enabled' else 'ghl.admin_access_disabled' end,
    'profile', p_profile_id::text,
    format('%s GHL access for %s', case when p_enabled then 'Enabled' else 'Disabled' end,
      (select coalesce(full_name, email) from public.profile where id = p_profile_id)), null, null, null, p_profile_id);
  return app.ghl_sync_access(p_profile_id);
end;
$$;

create or replace function public.ghl_revoke_all_access(p_profile_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform app.require('ghl.access.manage');
  perform app.require_step_up('remove GHL access');
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'reason_required: say why' using errcode = '23514';
  end if;
  insert into public.ghl_access_block (profile_id, blocked_by, reason) values (p_profile_id, auth.uid(), btrim(p_reason))
  on conflict (profile_id) do update set blocked_by = auth.uid(), blocked_at = now(), reason = btrim(p_reason);
  v_result := app.ghl_sync_access(p_profile_id);
  perform app.audit('ghl.access_revoked_all', 'profile', p_profile_id::text,
    format('Revoked all GHL access for %s: %s', (select coalesce(full_name, email) from public.profile where id = p_profile_id), btrim(p_reason)),
    null, v_result, null, p_profile_id);
  perform app.ghl_alert_admins('ghl.access_revoked_all', 'All GHL access revoked',
    format('%s revoked all GHL access for %s. Removal is running now.',
      coalesce((select email from public.profile where id = auth.uid()), 'An admin'),
      (select coalesce(full_name, email) from public.profile where id = p_profile_id)));
  return v_result;
end;
$$;

create or replace function public.ghl_restore_access(p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.require('ghl.access.manage');
  delete from public.ghl_access_block where profile_id = p_profile_id;
  perform app.audit('ghl.access_restored', 'profile', p_profile_id::text,
    format('Lifted the GHL access block for %s', (select coalesce(full_name, email) from public.profile where id = p_profile_id)),
    null, null, null, p_profile_id);
  return app.ghl_sync_access(p_profile_id);
end;
$$;

create or replace function public.ghl_retry_grant(p_grant_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.ghl_access_grant;
begin
  perform app.require('ghl.access.manage');
  select * into g from public.ghl_access_grant where id = p_grant_id;
  if g.id is null or g.state not in ('failed', 'pending', 'revoking') then
    raise exception 'grant_not_retryable' using errcode = '23514';
  end if;
  update public.ghl_job set status = 'cancelled', finished_at = now() where dedupe_key in ('grant:' || g.id, 'revoke:' || g.id) and status = 'dead';
  return app.ghl_enqueue(case when g.state = 'revoking' then 'revoke' else 'grant' end, g.case_file_id,
    (case when g.state = 'revoking' then 'revoke:' else 'grant:' end) || g.id, jsonb_build_object('grant_id', g.id),
    case when g.state = 'revoking' then 1 else 3 end);
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants of execute
-- ---------------------------------------------------------------------------

revoke all on function public.ghl_claim_jobs(integer) from public, anon, authenticated;
revoke all on function public.ghl_complete_job(bigint, boolean, jsonb, text, boolean) from public, anon, authenticated;
revoke all on function public.ghl_record_location_users(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.ghl_claim_jobs(integer) to service_role;
grant execute on function public.ghl_complete_job(bigint, boolean, jsonb, text, boolean) to service_role;
grant execute on function public.ghl_record_location_users(uuid, jsonb) to service_role;

revoke all on function public.ghl_fix_mismatch(uuid) from public, anon;
revoke all on function public.ghl_mark_known_user(text, text, uuid) from public, anon;
revoke all on function public.ghl_set_admin_access(uuid, boolean, text) from public, anon;
revoke all on function public.ghl_revoke_all_access(uuid, text) from public, anon;
revoke all on function public.ghl_restore_access(uuid) from public, anon;
revoke all on function public.ghl_retry_grant(uuid) from public, anon;
grant execute on function public.ghl_fix_mismatch(uuid) to authenticated;
grant execute on function public.ghl_mark_known_user(text, text, uuid) to authenticated;
grant execute on function public.ghl_set_admin_access(uuid, boolean, text) to authenticated;
grant execute on function public.ghl_revoke_all_access(uuid, text) to authenticated;
grant execute on function public.ghl_restore_access(uuid) to authenticated;
grant execute on function public.ghl_retry_grant(uuid) to authenticated;
