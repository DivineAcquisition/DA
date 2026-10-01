-- ===========================================================================
-- GHL connection layer, part 2: connections, health, mapping, readiness
--
-- Two kinds of caller:
--   * a signed-in admin, through the screens. Permission and step-up are
--     checked here, in the database, whatever the screen did.
--   * the server-side worker, with the service role. Those functions are
--     granted to service_role only and are the only path to a decrypted token.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Small helpers
-- ---------------------------------------------------------------------------

create or replace function app.ghl_alert_admins(p_kind text, p_title text, p_body text, p_severity public.notification_severity default 'important')
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.notify_staff(app.admin_recipient_ids(), p_kind, p_severity, p_title, p_body, null);
  perform app.raise_owner_alert(p_kind, p_title || ': ' || p_body, null, null, p_severity);
end;
$$;

create or replace function app.ghl_case_name(p_case_file_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select name from public.client_case_file where id = p_case_file_id), 'a client');
$$;

-- The live connection for a client, or the agency one.
create or replace function app.ghl_live_connection(p_case_file_id uuid)
returns public.ghl_connection
language sql
stable
security definer
set search_path = ''
as $$
  select c.* from public.ghl_connection c
  where c.retired_at is null and c.replaces_id is null
    and ((p_case_file_id is null and c.level = 'agency')
      or (p_case_file_id is not null and c.level = 'location' and c.case_file_id = p_case_file_id))
  limit 1;
$$;

-- The scopes each connection needs for this prompt. Prompt 10 extends the list.
create or replace function app.ghl_required_scopes(p_level public.ghl_connection_level)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case p_level
    when 'agency' then array['users.readonly', 'users.write', 'locations.readonly']
    else array[
      'locations.readonly', 'users.readonly', 'contacts.readonly', 'contacts.write',
      'conversations.readonly', 'conversations/message.readonly', 'opportunities.readonly',
      'calendars.readonly', 'locations/customFields.readonly', 'locations/tags.readonly'
    ]
  end;
$$;

-- ---------------------------------------------------------------------------
-- Storing, rotating and removing a token (signed-in admin, step-up)
--
-- The server action tests the token against GHL before calling these, and
-- refuses an invalid one without storing it. What lands here is stored as
-- untested and the worker's check, run straight after, decides its health:
-- nothing uses a connection until a check has passed.
-- ---------------------------------------------------------------------------

create or replace function public.ghl_store_connection(
  p_level public.ghl_connection_level,
  p_token text,
  p_label text,
  p_case_file_id uuid default null,
  p_location_id text default null,
  p_company_id text default null,
  p_is_test boolean default false,
  p_rotation_interval_days integer default 90
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := btrim(coalesce(p_token, ''));
  v_location text := nullif(btrim(coalesce(p_location_id, '')), '');
  v_secret uuid;
  v_row public.ghl_connection;
  v_link public.ghl_location;
  v_other uuid;
begin
  perform app.require('ghl.connections.manage');
  perform app.require_step_up('add a GHL connection');

  if char_length(v_token) < 20 then
    raise exception 'token_invalid: that does not look like a Private Integration Token' using errcode = '23514';
  end if;
  if nullif(btrim(coalesce(p_label, '')), '') is null then
    raise exception 'label_required: name the connection' using errcode = '23514';
  end if;

  if p_level = 'agency' then
    if app.ghl_live_connection(null) is not null then
      raise exception 'agency_exists: there is already an agency connection. Rotate it instead.' using errcode = '23505';
    end if;
  else
    if p_case_file_id is null or v_location is null then
      raise exception 'location_required: a sub-account connection needs its client and Location ID' using errcode = '23514';
    end if;
    if app.ghl_live_connection(p_case_file_id) is not null then
      raise exception 'connection_exists: % already has a connection. Rotate it instead.', app.ghl_case_name(p_case_file_id) using errcode = '23505';
    end if;

    -- One location per client and one client per location, for life.
    select * into v_link from public.ghl_location where case_file_id = p_case_file_id;
    if v_link.case_file_id is not null and v_link.location_id <> v_location then
      raise exception 'location_mismatch: % is linked to a different Location ID (%). Unlink it first.', app.ghl_case_name(p_case_file_id), v_link.location_id using errcode = '23514';
    end if;
    select case_file_id into v_other from public.ghl_location where location_id = v_location and case_file_id <> p_case_file_id;
    if v_other is not null then
      raise exception 'location_taken: that Location ID belongs to %', app.ghl_case_name(v_other) using errcode = '23505';
    end if;
    select case_file_id into v_other from public.ingest_source
    where provider = 'gohighlevel' and account_ref = v_location and case_file_id <> p_case_file_id;
    if v_other is not null then
      raise exception 'location_taken: live activity from that Location ID is already mapped to %', app.ghl_case_name(v_other) using errcode = '23505';
    end if;
  end if;

  v_secret := vault.create_secret(
    v_token,
    format('ghl:%s:%s', coalesce(p_case_file_id::text, 'agency'), gen_random_uuid()),
    format('GHL %s token: %s', p_level, btrim(p_label))
  );

  insert into public.ghl_connection (
    level, case_file_id, location_id, company_id, label, secret_id, token_last4,
    rotation_interval_days, check_requested_at, created_by
  ) values (
    p_level, case when p_level = 'location' then p_case_file_id end, v_location,
    nullif(btrim(coalesce(p_company_id, '')), ''), btrim(p_label), v_secret, right(v_token, 4),
    coalesce(p_rotation_interval_days, 90), now(), auth.uid()
  ) returning * into v_row;

  if p_level = 'location' then
    insert into public.ghl_location (case_file_id, location_id, is_test, linked_by, mapping_requested_at, reconcile_requested_at)
    values (p_case_file_id, v_location, coalesce(p_is_test, false), auth.uid(), now(), now())
    on conflict (case_file_id) do update set is_test = excluded.is_test, mapping_requested_at = now(), reconcile_requested_at = now();

    insert into public.ingest_source (provider, account_ref, case_file_id, label, created_by)
    values ('gohighlevel', v_location, p_case_file_id, format('GHL sub-account for %s', app.ghl_case_name(p_case_file_id)), auth.uid())
    on conflict (provider, account_ref) do nothing;

    insert into public.ghl_routing_setting (case_file_id, updated_by) values (p_case_file_id, auth.uid())
    on conflict (case_file_id) do nothing;
  end if;

  perform app.audit('ghl.connection_added', 'ghl_connection', v_row.id::text,
    format('Added the GHL %s connection "%s" (token ending %s)', p_level, btrim(p_label), v_row.token_last4),
    null, jsonb_build_object('level', p_level, 'location_id', v_location, 'last4', v_row.token_last4), p_case_file_id);

  return jsonb_build_object('id', v_row.id, 'last4', v_row.token_last4, 'status', v_row.status);
end;
$$;

create or replace function public.ghl_rotate_connection(p_connection_id uuid, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := btrim(coalesce(p_token, ''));
  v_old public.ghl_connection;
  v_row public.ghl_connection;
  v_secret uuid;
begin
  perform app.require('ghl.connections.manage');
  perform app.require_step_up('rotate a GHL connection');

  select * into v_old from public.ghl_connection where id = p_connection_id and retired_at is null and replaces_id is null;
  if v_old.id is null then
    raise exception 'connection_not_found: that connection is not live' using errcode = 'P0002';
  end if;
  if char_length(v_token) < 20 then
    raise exception 'token_invalid: that does not look like a Private Integration Token' using errcode = '23514';
  end if;
  if right(v_token, 4) = v_old.token_last4 and exists (
    select 1 from vault.decrypted_secrets where id = v_old.secret_id and decrypted_secret = v_token
  ) then
    raise exception 'token_unchanged: that is the token already in use' using errcode = '23514';
  end if;

  -- A candidate from an earlier rotation that never passed is replaced.
  update public.ghl_connection set retired_at = now(), retired_by = auth.uid(), retired_reason = 'superseded candidate', status = 'retired'
  where replaces_id = v_old.id and retired_at is null;

  v_secret := vault.create_secret(
    v_token,
    format('ghl:%s:%s', coalesce(v_old.case_file_id::text, 'agency'), gen_random_uuid()),
    format('GHL %s token (rotation of %s)', v_old.level, v_old.label)
  );

  insert into public.ghl_connection (
    level, case_file_id, location_id, company_id, label, secret_id, token_last4,
    rotation_interval_days, replaces_id, check_requested_at, created_by
  ) values (
    v_old.level, v_old.case_file_id, v_old.location_id, v_old.company_id, v_old.label, v_secret, right(v_token, 4),
    v_old.rotation_interval_days, v_old.id, now(), auth.uid()
  ) returning * into v_row;

  perform app.audit('ghl.connection_rotation_started', 'ghl_connection', v_old.id::text,
    format('Started rotating "%s": new token ending %s is being tested; the old one (ending %s) stays live until it passes',
      v_old.label, v_row.token_last4, v_old.token_last4), null, null, v_old.case_file_id);

  return jsonb_build_object('id', v_row.id, 'last4', v_row.token_last4, 'replaces', v_old.id);
end;
$$;

-- Wipe a token from the Vault without deleting the row that recorded it.
create or replace function app.ghl_wipe_secret(p_secret_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform vault.update_secret(p_secret_id, 'retired:' || encode(extensions.gen_random_bytes(8), 'hex'));
end;
$$;

create or replace function public.ghl_remove_connection(p_connection_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.ghl_connection;
begin
  perform app.require('ghl.connections.manage');
  perform app.require_step_up('remove a GHL connection');
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'reason_required: say why the connection is being removed' using errcode = '23514';
  end if;

  select * into v_row from public.ghl_connection where id = p_connection_id and retired_at is null;
  if v_row.id is null then
    raise exception 'connection_not_found: that connection is not live' using errcode = 'P0002';
  end if;

  update public.ghl_connection
     set retired_at = now(), retired_by = auth.uid(), retired_reason = btrim(p_reason), status = 'retired'
   where id = v_row.id or replaces_id = v_row.id;
  perform app.ghl_wipe_secret(c.secret_id) from public.ghl_connection c where c.id = v_row.id or c.replaces_id = v_row.id;

  perform app.audit('ghl.connection_removed', 'ghl_connection', v_row.id::text,
    format('Removed the GHL %s connection "%s" (token ending %s): %s', v_row.level, v_row.label, v_row.token_last4, btrim(p_reason)),
    null, null, v_row.case_file_id);
  perform app.ghl_alert_admins('ghl.connection_removed', 'GHL connection removed',
    format('%s removed the %s connection "%s". Work that needs it is paused until a new token is added.',
      coalesce((select email from public.profile where id = auth.uid()), 'An admin'), v_row.level, v_row.label));
end;
$$;

create or replace function public.ghl_unlink_location(p_case_file_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.ghl_location;
begin
  perform app.require('ghl.connections.manage');
  perform app.require_step_up('remove a GHL connection');
  select * into v_link from public.ghl_location where case_file_id = p_case_file_id;
  if v_link.case_file_id is null then
    raise exception 'not_linked: that client has no GHL sub-account linked' using errcode = 'P0002';
  end if;
  if app.ghl_live_connection(p_case_file_id) is not null then
    raise exception 'connection_live: remove the connection first' using errcode = '23514';
  end if;
  if exists (select 1 from public.ghl_access_grant where case_file_id = p_case_file_id and state in ('pending', 'active', 'revoking', 'failed')) then
    raise exception 'access_live: GHL access for this client is still in place. It is removed when the connection is gone and placements end.' using errcode = '23514';
  end if;
  delete from public.ghl_location_map where case_file_id = p_case_file_id;
  delete from public.ingest_source where provider = 'gohighlevel' and account_ref = v_link.location_id and case_file_id = p_case_file_id;
  delete from public.ghl_location where case_file_id = p_case_file_id;
  perform app.audit('ghl.location_unlinked', 'ghl_location', v_link.location_id,
    format('Unlinked %s from GHL Location ID %s: %s', app.ghl_case_name(p_case_file_id), v_link.location_id, btrim(coalesce(p_reason, ''))),
    null, null, p_case_file_id);
end;
$$;

-- On demand: the next worker run checks it.
create or replace function public.ghl_request_check(p_case_file_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.require('ghl.connections.manage');
  update public.ghl_connection set check_requested_at = now()
  where retired_at is null
    and ((p_case_file_id is null and level = 'agency') or case_file_id = p_case_file_id);
  update public.ghl_location set mapping_requested_at = now(), reconcile_requested_at = now()
  where case_file_id = p_case_file_id;
end;
$$;

create or replace function public.ghl_set_location_details(p_case_file_id uuid, p_is_test boolean, p_a2p_reference text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.require('ghl.connections.manage');
  update public.ghl_location
     set is_test = coalesce(p_is_test, is_test),
         a2p_reference = coalesce(nullif(btrim(coalesce(p_a2p_reference, '')), ''), a2p_reference),
         a2p_recorded_at = case when nullif(btrim(coalesce(p_a2p_reference, '')), '') is not null then coalesce(a2p_recorded_at, now()) else a2p_recorded_at end
   where case_file_id = p_case_file_id;
  if not found then
    raise exception 'not_linked: that client has no GHL sub-account linked' using errcode = 'P0002';
  end if;
  perform app.audit('ghl.location_details', 'ghl_location', p_case_file_id::text,
    format('Updated GHL details for %s (test: %s%s)', app.ghl_case_name(p_case_file_id), coalesce(p_is_test, false),
      case when p_a2p_reference is not null then ', A2P recorded' else '' end), null, null, p_case_file_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Worker side (service role only)
-- ---------------------------------------------------------------------------

-- The only path to a decrypted token. Service role only; never returned to a
-- browser and never written anywhere by the caller.
create or replace function public.ghl_connection_secret(p_connection_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s.decrypted_secret
  from public.ghl_connection c
  join vault.decrypted_secrets s on s.id = c.secret_id
  where c.id = p_connection_id and c.retired_at is null;
$$;

-- "Give me a working connection for this sub-account." Returns the connection
-- to use and whether work may run on it, so the caller never picks a token
-- kind itself. purpose: 'location' (the client's own), 'agency', or 'check'
-- (any live or candidate connection by id, for testing).
create or replace function public.ghl_pick_connection(p_case_file_id uuid, p_purpose text default 'location', p_connection_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_row public.ghl_connection;
  v_location text;
begin
  if p_purpose = 'check' then
    select * into v_row from public.ghl_connection where id = p_connection_id and retired_at is null;
  elsif p_purpose = 'agency' then
    v_row := app.ghl_live_connection(null);
  else
    v_row := app.ghl_live_connection(p_case_file_id);
  end if;

  select location_id into v_location from public.ghl_location where case_file_id = coalesce(p_case_file_id, v_row.case_file_id);

  if v_row.id is null then
    return jsonb_build_object('ok', false, 'reason', case when p_purpose = 'agency' then 'no_agency_connection' else 'no_connection' end,
      'location_id', v_location);
  end if;
  if p_purpose <> 'check' and v_row.status not in ('healthy', 'degraded') then
    return jsonb_build_object('ok', false, 'reason', 'connection_' || v_row.status::text, 'connection_id', v_row.id, 'location_id', v_location);
  end if;
  return jsonb_build_object(
    'ok', true, 'connection_id', v_row.id, 'level', v_row.level, 'auth_kind', v_row.auth_kind,
    'location_id', coalesce(v_row.location_id, v_location), 'company_id', v_row.company_id,
    'case_file_id', v_row.case_file_id, 'status', v_row.status, 'is_candidate', v_row.replaces_id is not null
  );
end;
$$;

create or replace function public.ghl_due_checks(p_limit integer default 20)
returns setof jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('connection_id', c.id, 'level', c.level, 'case_file_id', c.case_file_id,
    'location_id', c.location_id, 'company_id', c.company_id, 'is_candidate', c.replaces_id is not null,
    'mapping_due', c.level = 'location' and c.replaces_id is null and (
      l.mapping_requested_at is not null or l.mapping_checked_at is null or l.mapping_checked_at < now() - interval '6 hours'),
    'users_due', c.level = 'location' and c.replaces_id is null and (
      l.reconcile_requested_at is not null or l.users_checked_at is null or l.users_checked_at < now() - interval '24 hours'))
  from public.ghl_connection c
  left join public.ghl_location l on l.case_file_id = c.case_file_id
  where c.retired_at is null
    and (c.check_requested_at is not null or c.next_check_at <= now()
      or (l.mapping_requested_at is not null) or (l.reconcile_requested_at is not null))
  order by c.check_requested_at nulls last, c.next_check_at
  limit greatest(coalesce(p_limit, 20), 1);
$$;

-- The outcome of a check. Failure marks the connection failing, pauses work
-- that needs it, alerts admins once, and backs off: no tight retry loop.
create or replace function public.ghl_record_health(
  p_connection_id uuid,
  p_ok boolean,
  p_scopes_present text[] default '{}',
  p_scopes_missing text[] default '{}',
  p_error text default null,
  p_company_id text default null,
  p_location_name text default null,
  p_location_time_zone text default null,
  p_auth_failed boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.ghl_connection;
  v_old public.ghl_connection;
  v_status public.ghl_health;
  v_name text;
  v_failures integer;
begin
  select * into v_row from public.ghl_connection where id = p_connection_id for update;
  if v_row.id is null or v_row.retired_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'not_live');
  end if;
  v_name := case when v_row.level = 'agency' then 'the agency connection' else app.ghl_case_name(v_row.case_file_id) end;

  if p_ok then
    v_status := case when coalesce(array_length(p_scopes_missing, 1), 0) > 0 then 'degraded' else 'healthy' end;
    update public.ghl_connection
       set status = v_status, scopes_present = coalesce(p_scopes_present, '{}'), scopes_missing = coalesce(p_scopes_missing, '{}'),
           last_checked_at = now(), last_success_at = now(), last_error = null, consecutive_failures = 0,
           next_check_at = now() + interval '6 hours', check_requested_at = null,
           company_id = coalesce(nullif(p_company_id, ''), company_id),
           paused_at = case when v_status = 'healthy' then null else paused_at end,
           paused_reason = case when v_status = 'healthy' then null else paused_reason end
     where id = v_row.id;

    if v_row.level = 'location' then
      update public.ghl_location set location_name = coalesce(p_location_name, location_name),
             location_time_zone = coalesce(p_location_time_zone, location_time_zone)
       where case_file_id = v_row.case_file_id;
    end if;

    if v_row.status = 'failing' and v_row.replaces_id is null then
      perform app.ghl_alert_admins('ghl.connection_recovered', 'GHL connection recovered',
        format('%s is healthy again. Paused work resumes.', initcap(v_name)), 'informational');
      update public.ghl_job set next_attempt_at = now()
       where status in ('queued', 'failed') and (case_file_id = v_row.case_file_id or v_row.level = 'agency');
    end if;
    if v_status = 'degraded' and v_row.status is distinct from 'degraded' then
      perform app.ghl_alert_admins('ghl.scopes_missing', 'GHL token is missing scopes',
        format('The token for %s works but lacks: %s. Add them to the Private Integration in GHL and rotate.', v_name, array_to_string(p_scopes_missing, ', ')));
    end if;

    -- A rotation candidate that passes takes over; the old token is retired
    -- and wiped. GHL keeps the old token valid for its own grace window.
    if v_row.replaces_id is not null then
      select * into v_old from public.ghl_connection where id = v_row.replaces_id;
      update public.ghl_connection set retired_at = now(), retired_reason = 'rotated', status = 'retired' where id = v_old.id;
      perform app.ghl_wipe_secret(v_old.secret_id);
      update public.ghl_connection set replaces_id = null, token_created_on = current_date, rotation_reminded_at = null,
             paused_at = null, paused_reason = null
       where id = v_row.id;
      perform app.audit('ghl.connection_rotated', 'ghl_connection', v_row.id::text,
        format('Rotated %s: the token ending %s passed its test and replaced the one ending %s', v_name, v_row.token_last4, v_old.token_last4),
        null, null, v_row.case_file_id);
      perform app.ghl_alert_admins('ghl.connection_rotated', 'GHL token rotated',
        format('The new token for %s (ending %s) passed and is live. The old one is retired here; revoke it in GHL if it is still listed.', v_name, v_row.token_last4), 'informational');
    end if;
    return jsonb_build_object('ok', true, 'status', v_status);
  end if;

  -- Failure.
  if v_row.replaces_id is not null then
    -- A candidate that fails never takes over. The old token stays live.
    update public.ghl_connection set status = 'retired', retired_at = now(), retired_reason = 'failed its test',
           last_checked_at = now(), last_failure_at = now(), last_error = left(p_error, 300)
     where id = v_row.id;
    perform app.ghl_wipe_secret(v_row.secret_id);
    perform app.ghl_alert_admins('ghl.rotation_failed', 'GHL token rotation failed',
      format('The new token for %s (ending %s) failed its test: %s. The current token is still in use.', v_name, v_row.token_last4, left(coalesce(p_error, 'no detail'), 200)));
    return jsonb_build_object('ok', false, 'status', 'retired');
  end if;

  v_failures := v_row.consecutive_failures + 1;
  -- Auth failures and a second failure in a row both mean failing. One network
  -- blip only degrades.
  v_status := case when p_auth_failed or v_failures >= 2 then 'failing' else
                case when v_row.status = 'untested' then 'failing' else 'degraded' end end;
  update public.ghl_connection
     set status = v_status, last_checked_at = now(), last_failure_at = now(), last_error = left(p_error, 300),
         consecutive_failures = v_failures, check_requested_at = null,
         next_check_at = now() + least(interval '6 hours', interval '15 minutes' * power(2, least(v_failures - 1, 5))),
         paused_at = case when v_status = 'failing' then coalesce(paused_at, now()) else paused_at end,
         paused_reason = case when v_status = 'failing' then 'Connection failing: ' || left(coalesce(p_error, 'no detail'), 200) else paused_reason end
   where id = v_row.id;

  if v_status = 'failing' and v_row.status is distinct from 'failing' then
    perform app.ghl_alert_admins('ghl.connection_failing', 'GHL connection failing',
      format('%s failed its check: %s. Provisioning and lead assignment that need it are paused. It is re-checked with back-off.',
        initcap(v_name), left(coalesce(p_error, 'no detail'), 200)), 'urgent');
  end if;
  return jsonb_build_object('ok', false, 'status', v_status);
end;
$$;

-- ---------------------------------------------------------------------------
-- Mapping and drift
--
-- p_found is what GHL holds, read by the worker:
--   { "pipelines": [{ "id", "name", "stages": [{ "id", "name" }] }],
--     "customFields": [{ "id", "name", "dataType" }],
--     "tags": [{ "id", "name" }], "calendars": [{ "id", "name" }] }
-- Matched by name, case- and space-insensitive. Stage order is the array order.
-- ---------------------------------------------------------------------------

create or replace function app.ghl_norm(p text)
returns text
language sql
immutable
set search_path = ''
as $$ select lower(regexp_replace(btrim(coalesce(p, '')), '\s+', ' ', 'g')); $$;

create or replace function public.ghl_record_mapping(p_case_file_id uuid, p_found jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  i public.ghl_standard_item;
  v_pipe jsonb;
  v_hit jsonb;
  v_pos integer;
  v_status text;
  v_detail text;
  v_missing integer := 0;
  v_different integer := 0;
  v_before integer;
  v_calendars integer := coalesce(jsonb_array_length(p_found -> 'calendars'), 0);
begin
  select mapping_drift + mapping_missing into v_before from public.ghl_location where case_file_id = p_case_file_id;
  if v_before is null then
    raise exception 'not_linked' using errcode = 'P0002';
  end if;

  delete from public.ghl_location_map m
  where m.case_file_id = p_case_file_id
    and not exists (select 1 from public.ghl_standard_item s where s.id = m.standard_item_id and s.active);

  for i in select * from public.ghl_standard_item where active order by kind, parent_name nulls first, position nulls last, name loop
    v_hit := null; v_pos := null; v_status := 'missing'; v_detail := null;

    if i.kind = 'pipeline' then
      select x into v_hit from jsonb_array_elements(coalesce(p_found -> 'pipelines', '[]')) x
      where app.ghl_norm(x ->> 'name') = app.ghl_norm(i.name) limit 1;
      if v_hit is not null then v_status := 'mapped'; else v_detail := 'Pipeline not found'; end if;

    elsif i.kind = 'stage' then
      select x into v_pipe from jsonb_array_elements(coalesce(p_found -> 'pipelines', '[]')) x
      where app.ghl_norm(x ->> 'name') = app.ghl_norm(i.parent_name) limit 1;
      if v_pipe is null then
        v_detail := format('Pipeline "%s" not found', i.parent_name);
      else
        select s.v, s.n::integer into v_hit, v_pos
        from jsonb_array_elements(coalesce(v_pipe -> 'stages', '[]')) with ordinality s(v, n)
        where app.ghl_norm(s.v ->> 'name') = app.ghl_norm(i.name) limit 1;
        if v_hit is null then
          v_detail := 'Stage not found';
        elsif i.position is not null and v_pos <> i.position then
          v_status := 'different'; v_detail := format('Out of order: expected position %s, found %s', i.position, v_pos);
        else
          v_status := 'mapped';
        end if;
      end if;

    elsif i.kind = 'custom_field' then
      select x into v_hit from jsonb_array_elements(coalesce(p_found -> 'customFields', '[]')) x
      where app.ghl_norm(x ->> 'name') = app.ghl_norm(i.name) limit 1;
      if v_hit is null then
        v_detail := 'Custom field not found';
      elsif i.field_type is not null and upper(coalesce(v_hit ->> 'dataType', '')) <> upper(i.field_type) then
        v_status := 'different'; v_detail := format('Type is %s, the standard says %s', coalesce(v_hit ->> 'dataType', 'unknown'), i.field_type);
      else
        v_status := 'mapped';
      end if;

    elsif i.kind = 'tag' then
      select x into v_hit from jsonb_array_elements(coalesce(p_found -> 'tags', '[]')) x
      where app.ghl_norm(x ->> 'name') = app.ghl_norm(i.name) limit 1;
      if v_hit is not null then v_status := 'mapped'; else v_detail := 'Tag not found'; end if;

    elsif i.kind = 'calendar' then
      select x into v_hit from jsonb_array_elements(coalesce(p_found -> 'calendars', '[]')) x
      where app.ghl_norm(x ->> 'name') = app.ghl_norm(i.name) limit 1;
      if v_hit is not null then v_status := 'mapped'; else v_detail := 'Calendar not found'; end if;
    end if;

    if v_status = 'missing' then v_missing := v_missing + 1; elsif v_status = 'different' then v_different := v_different + 1; end if;

    insert into public.ghl_location_map (case_file_id, standard_item_id, ghl_id, found_name, found_type, found_position, status, detail, checked_at)
    values (p_case_file_id, i.id, v_hit ->> 'id', v_hit ->> 'name', v_hit ->> 'dataType', v_pos, v_status, v_detail, now())
    on conflict (case_file_id, standard_item_id) do update
      set ghl_id = excluded.ghl_id, found_name = excluded.found_name, found_type = excluded.found_type,
          found_position = excluded.found_position, status = excluded.status, detail = excluded.detail, checked_at = now();
  end loop;

  update public.ghl_location
     set mapping_checked_at = now(), mapping_requested_at = null, mapping_drift = v_different,
         mapping_missing = v_missing, calendars_found = v_calendars
   where case_file_id = p_case_file_id;

  if v_missing + v_different > 0 and v_before = 0 then
    perform app.ghl_alert_admins('ghl.drift', 'GHL drift found',
      format('%s no longer matches the standard: %s missing, %s different. Placements cannot start there until it is fixed.',
        app.ghl_case_name(p_case_file_id), v_missing, v_different));
  elsif v_missing + v_different = 0 and v_before > 0 then
    perform app.ghl_alert_admins('ghl.drift_cleared', 'GHL drift cleared',
      format('%s matches the standard again.', app.ghl_case_name(p_case_file_id)), 'informational');
  end if;

  return jsonb_build_object('missing', v_missing, 'different', v_different, 'calendars', v_calendars);
end;
$$;

-- ---------------------------------------------------------------------------
-- Readiness
-- ---------------------------------------------------------------------------

create or replace function app.ghl_readiness(p_case_file_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_link public.ghl_location;
  v_conn public.ghl_connection;
  v_agency public.ghl_connection;
  v_checks jsonb := '[]'::jsonb;
  v_ready boolean := true;
begin
  select * into v_link from public.ghl_location where case_file_id = p_case_file_id;
  v_conn := app.ghl_live_connection(p_case_file_id);
  v_agency := app.ghl_live_connection(null);

  v_checks := v_checks || jsonb_build_object('key', 'linked', 'label', 'Sub-account linked', 'blocking', true,
    'ok', v_link.case_file_id is not null,
    'detail', coalesce('Location ' || v_link.location_id, 'No Location ID linked'));
  v_checks := v_checks || jsonb_build_object('key', 'connection', 'label', 'Connection healthy', 'blocking', true,
    'ok', v_conn.status in ('healthy', 'degraded'),
    'detail', case when v_conn.id is null then 'No token added' else 'Status: ' || v_conn.status::text ||
      coalesce(', last success ' || to_char(v_conn.last_success_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI "UTC"'), '') end);
  v_checks := v_checks || jsonb_build_object('key', 'scopes', 'label', 'Required scopes present', 'blocking', true,
    'ok', v_conn.id is not null and v_conn.last_success_at is not null and coalesce(array_length(v_conn.scopes_missing, 1), 0) = 0,
    'detail', case when v_conn.id is null or v_conn.last_success_at is null then 'Not checked yet'
                   when coalesce(array_length(v_conn.scopes_missing, 1), 0) = 0 then 'All present'
                   else 'Missing: ' || array_to_string(v_conn.scopes_missing, ', ') end);
  v_checks := v_checks || jsonb_build_object('key', 'agency', 'label', 'Agency connection healthy (for user provisioning)', 'blocking', true,
    'ok', v_agency.status in ('healthy', 'degraded') and coalesce(array_length(v_agency.scopes_missing, 1), 0) = 0,
    'detail', case when v_agency.id is null then 'No agency token added' else 'Status: ' || v_agency.status::text end);
  v_checks := v_checks || jsonb_build_object('key', 'mapping', 'label', 'Mapping complete, no drift', 'blocking', true,
    'ok', v_link.mapping_checked_at is not null and v_link.mapping_drift = 0 and v_link.mapping_missing = 0,
    'detail', case when v_link.mapping_checked_at is null then 'Not mapped yet'
                   when v_link.mapping_drift + v_link.mapping_missing = 0 then 'Matches the standard'
                   else format('%s missing, %s different', v_link.mapping_missing, v_link.mapping_drift) end);
  v_checks := v_checks || jsonb_build_object('key', 'calendar', 'label', 'At least one calendar', 'blocking', true,
    'ok', coalesce(v_link.calendars_found, 0) >= 1,
    'detail', coalesce(v_link.calendars_found, 0) || ' found');
  -- Recorded now, enforced from Prompt 10.
  v_checks := v_checks || jsonb_build_object('key', 'a2p', 'label', 'A2P registration recorded', 'blocking', false,
    'ok', v_link.a2p_recorded_at is not null,
    'detail', case when v_link.a2p_recorded_at is null then 'Not recorded (enforced from Prompt 10)' else 'Recorded: ' || coalesce(v_link.a2p_reference, '') end);

  select bool_and((c ->> 'ok')::boolean) into v_ready from jsonb_array_elements(v_checks) c where (c ->> 'blocking')::boolean;
  return jsonb_build_object('ready', coalesce(v_ready, false), 'checks', v_checks);
end;
$$;

-- A placement cannot start on a sub-account that is not ready.
create or replace function app.guard_placement_ghl_ready()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ready jsonb;
  v_failed text;
begin
  if new.status = 'active' and (tg_op = 'INSERT' or old.status is distinct from 'active') then
    v_ready := app.ghl_readiness(new.case_file_id);
    if not (v_ready ->> 'ready')::boolean then
      select string_agg(c ->> 'label', '; ') into v_failed
      from jsonb_array_elements(v_ready -> 'checks') c
      where (c ->> 'blocking')::boolean and not (c ->> 'ok')::boolean;
      raise exception 'ghl_not_ready: % is not ready in GHL (%). The placement cannot start until it is.',
        app.ghl_case_name(new.case_file_id), v_failed using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists placement_ghl_ready on public.placement;
create trigger placement_ghl_ready before insert or update of status on public.placement
  for each row execute function app.guard_placement_ghl_ready();

-- ---------------------------------------------------------------------------
-- Standard and profile editing (admins)
-- ---------------------------------------------------------------------------

create or replace function public.ghl_save_standard_item(
  p_id uuid, p_kind text, p_name text, p_parent_name text default null, p_position integer default null,
  p_field_type text default null, p_active boolean default true, p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform app.require('ghl.standard.manage');
  if p_id is null then
    insert into public.ghl_standard_item (kind, name, parent_name, position, field_type, active, note, updated_by)
    values (p_kind, btrim(p_name), nullif(btrim(coalesce(p_parent_name, '')), ''), p_position,
            nullif(upper(btrim(coalesce(p_field_type, ''))), ''), coalesce(p_active, true), p_note, auth.uid())
    returning id into v_id;
  else
    update public.ghl_standard_item
       set name = btrim(p_name), parent_name = nullif(btrim(coalesce(p_parent_name, '')), ''), position = p_position,
           field_type = nullif(upper(btrim(coalesce(p_field_type, ''))), ''), active = coalesce(p_active, true),
           note = p_note, updated_by = auth.uid(), updated_at = now()
     where id = p_id returning id into v_id;
  end if;
  -- Every client is re-checked against the new standard.
  update public.ghl_location set mapping_requested_at = now();
  perform app.audit('ghl.standard_changed', 'ghl_standard_item', v_id::text,
    format('Saved standard %s "%s"', p_kind, btrim(p_name)));
  return v_id;
end;
$$;

create or replace function public.ghl_save_permission_profile(p_key text, p_permissions jsonb, p_verify_manually text[] default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.require('ghl.standard.manage');
  if jsonb_typeof(p_permissions) <> 'object' then
    raise exception 'permissions_invalid: expected an object of GHL permission flags' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_each(p_permissions) e where jsonb_typeof(e.value) <> 'boolean') then
    raise exception 'permissions_invalid: every flag must be true or false' using errcode = '22023';
  end if;
  update public.ghl_permission_profile
     set permissions = p_permissions, verify_manually = coalesce(p_verify_manually, verify_manually),
         updated_by = auth.uid(), updated_at = now()
   where key = p_key;
  if not found then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;
  -- Live grants on this profile are re-checked by reconciliation.
  update public.ghl_location set reconcile_requested_at = now();
  perform app.audit('ghl.permission_profile_changed', 'ghl_permission_profile', p_key,
    format('Changed the GHL %s permission profile', p_key), null, p_permissions);
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants of execute
-- ---------------------------------------------------------------------------

revoke all on function public.ghl_connection_secret(uuid) from public, anon, authenticated;
revoke all on function public.ghl_pick_connection(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.ghl_due_checks(integer) from public, anon, authenticated;
revoke all on function public.ghl_record_health(uuid, boolean, text[], text[], text, text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.ghl_record_mapping(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.ghl_connection_secret(uuid) to service_role;
grant execute on function public.ghl_pick_connection(uuid, text, uuid) to service_role;
grant execute on function public.ghl_due_checks(integer) to service_role;
grant execute on function public.ghl_record_health(uuid, boolean, text[], text[], text, text, text, text, boolean) to service_role;
grant execute on function public.ghl_record_mapping(uuid, jsonb) to service_role;

revoke all on function public.ghl_store_connection(public.ghl_connection_level, text, text, uuid, text, text, boolean, integer) from public, anon;
revoke all on function public.ghl_rotate_connection(uuid, text) from public, anon;
revoke all on function public.ghl_remove_connection(uuid, text) from public, anon;
revoke all on function public.ghl_unlink_location(uuid, text) from public, anon;
revoke all on function public.ghl_request_check(uuid) from public, anon;
revoke all on function public.ghl_set_location_details(uuid, boolean, text) from public, anon;
revoke all on function public.ghl_save_standard_item(uuid, text, text, text, integer, text, boolean, text) from public, anon;
revoke all on function public.ghl_save_permission_profile(text, jsonb, text[]) from public, anon;
grant execute on function public.ghl_store_connection(public.ghl_connection_level, text, text, uuid, text, text, boolean, integer) to authenticated;
grant execute on function public.ghl_rotate_connection(uuid, text) to authenticated;
grant execute on function public.ghl_remove_connection(uuid, text) to authenticated;
grant execute on function public.ghl_unlink_location(uuid, text) to authenticated;
grant execute on function public.ghl_request_check(uuid) to authenticated;
grant execute on function public.ghl_set_location_details(uuid, boolean, text) to authenticated;
grant execute on function public.ghl_save_standard_item(uuid, text, text, text, integer, text, boolean, text) to authenticated;
grant execute on function public.ghl_save_permission_profile(text, jsonb, text[]) to authenticated;

-- app.* helpers are internal.
revoke all on function app.ghl_wipe_secret(uuid) from public, anon, authenticated;
