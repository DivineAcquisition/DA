-- Sales Operator workspace, part 3 of 3: the functions.
--
-- so_workspace()            the operator's access state, and the placeholder
--                           home for an active placement. Own record only.
-- so_manager_operators()    a manager's assigned placements; every workspace
--                           placement for DA Admin.
-- so_save_placement()       DA Admin. Create (always Pending) or edit.
-- so_set_placement_status() DA Admin. Pending, Active, Paused, Ended.
-- so_save_outcome_type()    DA Admin, or the assigned manager.
-- so_save_metric()          DA Admin.
-- so_set_default_target()   DA Admin.
-- so_set_override_target()  DA Admin, or the assigned manager within limits.
-- so_save_settings()        DA Admin.
--
-- Every write is audited through app.audit().

-- What an audit row records about a placement: the workspace fields, never the
-- commercial terms.
create or replace function app.so_placement_audit(p public.placement)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'operator_id', p.operator_id, 'case_file_id', p.case_file_id, 'status', p.status,
    'placement_type', p.placement_type, 'manager_profile_id', p.manager_profile_id,
    'start_date', p.start_date, 'end_date', p.end_date, 'closed_on', p.closed_on,
    'time_zone', p.time_zone, 'working_days', p.working_days,
    'shift_start', p.shift_start, 'shift_end', p.shift_end, 'eod_deadline', p.eod_deadline,
    'campaign_summary', p.campaign_summary, 'activity_categories', p.activity_categories,
    'tracks_results', p.tracks_results);
$$;

revoke all on function app.so_placement_audit(public.placement) from public, anon, authenticated;

create or replace function app.so_status_label(p public.placement_status)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p::text
    when 'draft' then 'pending'
    when 'renewed' then 'ended'
    else p::text
  end;
$$;

revoke all on function app.so_status_label(public.placement_status) from public, anon, authenticated;

-- 1. The operator's workspace --------------------------------------------------------

create or replace function public.so_workspace()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile uuid := app.acting_profile();
  v_op public.operator;
  v_level smallint;
  v_pl public.placement;
  v_latest public.placement;
  v_name text;
begin
  if v_profile is null then
    raise exception 'not_signed_in: sign in first' using errcode = '42501';
  end if;

  select * into v_op from public.operator where profile_id = v_profile;
  if v_op.id is null then
    return jsonb_build_object('state', 'no_access', 'reason', 'not_an_operator');
  end if;
  v_name := coalesce(nullif(btrim(v_op.name), ''), v_op.email);

  if exists (select 1 from public.lockdown l where l.released_at is null) then
    return jsonb_build_object('state', 'no_access', 'reason', 'lockdown', 'operator_name', v_name);
  end if;

  if app.effective_state(v_profile) is distinct from 'active' or app.operator_stage(v_op) = 'inactive' then
    return jsonb_build_object('state', 'no_access', 'reason', 'deactivated', 'operator_name', v_name);
  end if;

  v_level := app.so_certification_level(v_profile);
  if coalesce(v_level, -1) < 1 then
    return jsonb_build_object('state', 'not_certified', 'operator_name', v_name, 'certification_level', v_level);
  end if;

  select * into v_pl from public.placement
  where operator_id = v_op.id and placement_type is not null and status = 'active'
  limit 1;

  if v_pl.id is null then
    select * into v_pl from public.placement
    where operator_id = v_op.id and placement_type is not null and status = 'paused'
    order by paused_at desc nulls last, created_at desc
    limit 1;
  end if;

  if v_pl.id is null then
    select * into v_latest from public.placement
    where operator_id = v_op.id and placement_type is not null
    order by (status = 'draft') desc, coalesce(closed_on, start_date) desc, created_at desc
    limit 1;
    if v_latest.id is not null and v_latest.status in ('ended', 'renewed') then
      return jsonb_build_object('state', 'no_access', 'reason', 'placement_ended', 'operator_name', v_name);
    end if;
    return jsonb_build_object('state', 'awaiting_placement', 'operator_name', v_name,
      'certification_level', v_level, 'pending', v_latest.id is not null);
  end if;

  return jsonb_build_object(
    'state', case when v_pl.status = 'active' then 'active' else 'paused' end,
    'operator_name', v_name,
    'certification_level', v_level,
    'placement', jsonb_build_object(
      'id', v_pl.id,
      'client_name', (select cf.name from public.client_case_file cf where cf.id = v_pl.case_file_id),
      'manager_name', (select coalesce(nullif(btrim(p.full_name), ''), p.email) from public.profile p where p.id = v_pl.manager_profile_id),
      'placement_type', v_pl.placement_type,
      'time_zone', v_pl.time_zone,
      'working_days', to_jsonb(v_pl.working_days),
      'shift_start', v_pl.shift_start,
      'shift_end', v_pl.shift_end,
      'eod_deadline', coalesce(v_pl.eod_deadline, v_pl.shift_end),
      'paused_at', v_pl.paused_at
    )
  );
end;
$$;

revoke all on function public.so_workspace() from public, anon;
grant execute on function public.so_workspace() to authenticated;

-- 2. A manager's operators -----------------------------------------------------------

create or replace function public.so_manager_operators()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_admin boolean := app.is_admin();
begin
  if not v_admin and not app.is_manager() then
    raise exception 'permission_denied: managers and DA Admin only' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'placement_id', pl.id,
      'operator_name', o.name,
      'client_name', cf.name,
      'status', app.so_status_label(pl.status),
      'shift', pl.shift_start || '–' || pl.shift_end,
      'time_zone', pl.time_zone,
      'eod_deadline', coalesce(pl.eod_deadline, pl.shift_end),
      'manager_name', coalesce(nullif(btrim(m.full_name), ''), m.email)
    ) order by o.name)
    from public.placement pl
    join public.operator o on o.id = pl.operator_id
    join public.client_case_file cf on cf.id = pl.case_file_id
    left join public.profile m on m.id = pl.manager_profile_id
    where pl.placement_type is not null
      and pl.status in ('draft', 'active', 'paused')
      and (v_admin or pl.manager_profile_id = app.acting_profile())
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.so_manager_operators() from public, anon;
grant execute on function public.so_manager_operators() to authenticated;

-- 3. Placements (DA Admin) -----------------------------------------------------------

create or replace function public.so_save_placement(p_placement jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_placement ->> 'id', '')::uuid;
  v_operator uuid := nullif(p_placement ->> 'operator_id', '')::uuid;
  v_case uuid := nullif(p_placement ->> 'case_file_id', '')::uuid;
  v_type text := nullif(btrim(coalesce(p_placement ->> 'placement_type', '')), '');
  v_manager uuid := nullif(p_placement ->> 'manager_profile_id', '')::uuid;
  v_start date := nullif(p_placement ->> 'start_date', '')::date;
  v_end date := nullif(p_placement ->> 'end_date', '')::date;
  v_tz text := coalesce(nullif(btrim(coalesce(p_placement ->> 'time_zone', '')), ''), 'America/New_York');
  v_shift_start text := coalesce(nullif(btrim(coalesce(p_placement ->> 'shift_start', '')), ''), '09:00');
  v_shift_end text := coalesce(nullif(btrim(coalesce(p_placement ->> 'shift_end', '')), ''), '18:00');
  v_deadline text := nullif(btrim(coalesce(p_placement ->> 'eod_deadline', '')), '');
  v_summary text := nullif(btrim(coalesce(p_placement ->> 'campaign_summary', '')), '');
  v_results boolean := coalesce((p_placement ->> 'tracks_results')::boolean, false);
  v_days smallint[];
  v_categories text[];
  v_old public.placement;
  v_new public.placement;
  v_operator_name text;
begin
  if not app.is_admin() then
    raise exception 'admin_required: only DA Admin manages placements' using errcode = '42501';
  end if;

  select coalesce(array_agg(distinct x::smallint order by x::smallint), '{}')
    into v_days
  from jsonb_array_elements_text(coalesce(p_placement -> 'working_days', '[1,2,3,4,5]'::jsonb)) x;
  select coalesce(array_agg(distinct x), '{}')
    into v_categories
  from jsonb_array_elements_text(coalesce(p_placement -> 'activity_categories', '[]'::jsonb)) x;

  if v_operator is null or v_case is null or v_start is null then
    raise exception 'required: choose an operator, a client, and a start date' using errcode = '23514';
  end if;
  if v_type is null or v_type not in ('client_placed', 'da_internal') then
    raise exception 'required: choose client-placed or DA internal' using errcode = '23514';
  end if;
  if cardinality(v_categories) = 0 then
    raise exception 'required: choose at least one activity category' using errcode = '23514';
  end if;
  if not (v_categories <@ array['outbound_calling', 'follow_up', 'reactivation']::text[]) then
    raise exception 'invalid: unknown activity category' using errcode = '23514';
  end if;
  if cardinality(v_days) = 0 then
    raise exception 'required: choose at least one working day' using errcode = '23514';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = v_tz) then
    raise exception 'invalid: % is not a time zone', v_tz using errcode = '23514';
  end if;
  if v_shift_start !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or v_shift_end !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
     or (v_deadline is not null and v_deadline !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') then
    raise exception 'invalid: times are HH:MM, 24-hour' using errcode = '23514';
  end if;
  if v_end is not null and v_end < v_start then
    raise exception 'invalid: the term cannot end before it starts' using errcode = '23514';
  end if;

  select name into v_operator_name from public.operator where id = v_operator;
  if v_operator_name is null then
    raise exception 'not_found: that operator does not exist' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.client_case_file where id = v_case and record_kind = 'client') then
    raise exception 'not_found: that client does not exist' using errcode = 'P0002';
  end if;
  if v_manager is not null and not exists (
    select 1 from public.profile where id = v_manager and role in ('manager', 'admin', 'owner')
  ) then
    raise exception 'invalid: the assigned manager must hold the Manager or DA Admin role' using errcode = '23514';
  end if;

  if v_id is null then
    insert into public.placement (
      operator_id, case_file_id, start_date, end_date, status,
      placement_type, manager_profile_id, time_zone, working_days, shift_start, shift_end,
      eod_deadline, campaign_summary, activity_categories, tracks_results
    ) values (
      v_operator, v_case, v_start, coalesce(v_end, (v_start + interval '3 months')::date), 'draft',
      v_type, v_manager, v_tz, v_days, v_shift_start, v_shift_end,
      v_deadline, v_summary, v_categories, v_results
    )
    returning * into v_new;
    perform app.audit('workspace.placement.created', 'placement', v_new.id::text,
      format('Created a Pending placement for %s', v_operator_name),
      null, app.so_placement_audit(v_new), v_case);
    if v_manager is not null then
      perform app.audit('workspace.placement.manager_assigned', 'placement', v_new.id::text,
        format('Assigned a manager to %s', v_operator_name),
        null, jsonb_build_object('manager_profile_id', v_manager), v_case, v_manager);
    end if;
    return v_new.id;
  end if;

  select * into v_old from public.placement where id = v_id for update;
  if v_old.id is null then
    raise exception 'not_found: that placement does not exist' using errcode = 'P0002';
  end if;
  if v_old.status in ('ended', 'renewed') then
    raise exception 'ended: an ended placement is a record. Start a new one.' using errcode = '23514';
  end if;
  if v_old.status <> 'draft' and (v_old.operator_id <> v_operator or v_old.case_file_id <> v_case) then
    raise exception 'locked: the operator and client are fixed once a placement has started' using errcode = '23514';
  end if;

  update public.placement set
    operator_id = v_operator, case_file_id = v_case, start_date = v_start,
    end_date = coalesce(v_end, end_date), placement_type = v_type, manager_profile_id = v_manager,
    time_zone = v_tz, working_days = v_days, shift_start = v_shift_start, shift_end = v_shift_end,
    eod_deadline = v_deadline, campaign_summary = v_summary, activity_categories = v_categories,
    tracks_results = v_results
  where id = v_id
  returning * into v_new;

  perform app.audit('workspace.placement.updated', 'placement', v_id::text,
    format('Edited the placement for %s', v_operator_name),
    app.so_placement_audit(v_old), app.so_placement_audit(v_new), v_case);
  if v_old.manager_profile_id is distinct from v_manager then
    perform app.audit('workspace.placement.manager_assigned', 'placement', v_id::text,
      format('Changed the manager for %s', v_operator_name),
      jsonb_build_object('manager_profile_id', v_old.manager_profile_id),
      jsonb_build_object('manager_profile_id', v_manager), v_case, v_manager);
  end if;
  return v_id;
end;
$$;

revoke all on function public.so_save_placement(jsonb) from public, anon;
grant execute on function public.so_save_placement(jsonb) to authenticated;

create or replace function public.so_set_placement_status(p_placement_id uuid, p_status text, p_reason text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.placement;
  v_new public.placement;
  v_from text;
  v_to text := lower(btrim(coalesce(p_status, '')));
  v_name text;
begin
  if not app.is_admin() then
    raise exception 'admin_required: only DA Admin changes placement status' using errcode = '42501';
  end if;

  select * into v_old from public.placement where id = p_placement_id for update;
  if v_old.id is null then
    raise exception 'not_found: that placement does not exist' using errcode = 'P0002';
  end if;
  if v_old.placement_type is null then
    raise exception 'not_workspace: set the placement type first' using errcode = '23514';
  end if;
  v_from := app.so_status_label(v_old.status);
  select name into v_name from public.operator where id = v_old.operator_id;

  if v_from = v_to then
    return v_to;
  end if;
  if not (
    (v_from = 'pending' and v_to in ('active', 'ended'))
    or (v_from = 'active' and v_to in ('paused', 'ended'))
    or (v_from = 'paused' and v_to in ('active', 'ended'))
  ) then
    raise exception 'invalid_transition: a % placement cannot move to %', v_from, v_to using errcode = '23514';
  end if;

  if v_to = 'active' then
    if not exists (select 1 from public.placement_outcome_type o where o.placement_id = v_old.id and o.active) then
      raise exception 'outcomes_required: define at least one positive outcome for this placement before it goes Active'
        using errcode = '23514';
    end if;
    if exists (select 1 from public.placement pl
               where pl.operator_id = v_old.operator_id and pl.status = 'active' and pl.id <> v_old.id) then
      raise exception 'already_active: % already has an active placement. Pause or end it first.', v_name
        using errcode = '23505';
    end if;
  end if;

  update public.placement set
    status = case v_to
      when 'active' then 'active'::public.placement_status
      when 'paused' then 'paused'::public.placement_status
      else 'ended'::public.placement_status
    end,
    paused_at = case when v_to = 'paused' then now() else null end,
    closed_on = case when v_to = 'ended' then current_date else closed_on end
  where id = v_old.id
  returning * into v_new;

  if v_to = 'ended' and not exists (
    select 1 from public.placement where operator_id = v_old.operator_id and status = 'active'
  ) then
    update public.operator set status = 'on_bench' where id = v_old.operator_id and status = 'placed';
  end if;

  perform app.audit('workspace.placement.status', 'placement', v_old.id::text,
    format('Placement for %s: %s to %s%s', v_name, v_from, v_to,
      case when nullif(btrim(coalesce(p_reason, '')), '') is null then '' else '. ' || btrim(p_reason) end),
    jsonb_build_object('status', v_from), jsonb_build_object('status', v_to, 'reason', nullif(btrim(coalesce(p_reason, '')), '')),
    v_old.case_file_id);
  return v_to;
end;
$$;

revoke all on function public.so_set_placement_status(uuid, text, text) from public, anon;
grant execute on function public.so_set_placement_status(uuid, text, text) to authenticated;

-- 4. Positive outcomes (DA Admin, or the assigned manager) --------------------------

create or replace function public.so_save_outcome_type(
  p_placement_id uuid,
  p_id uuid,
  p_name text,
  p_definition text,
  p_active boolean default true,
  p_sort_order integer default 100
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.placement_outcome_type;
  v_new public.placement_outcome_type;
  v_case uuid;
begin
  if not app.is_admin() then
    if not app.so_manages_placement(p_placement_id) then
      raise exception 'out_of_scope: that placement is not assigned to you' using errcode = '42501';
    end if;
    perform app.require('workspace.outcomes.edit');
  end if;

  select case_file_id into v_case from public.placement where id = p_placement_id;
  if v_case is null then
    raise exception 'not_found: that placement does not exist' using errcode = 'P0002';
  end if;
  if nullif(btrim(coalesce(p_name, '')), '') is null or nullif(btrim(coalesce(p_definition, '')), '') is null then
    raise exception 'required: an outcome needs a name and a short definition' using errcode = '23514';
  end if;

  if p_id is null then
    insert into public.placement_outcome_type (placement_id, name, definition, active, sort_order, created_by, updated_by)
    values (p_placement_id, btrim(p_name), btrim(p_definition), coalesce(p_active, true), coalesce(p_sort_order, 100),
            auth.uid(), auth.uid())
    returning * into v_new;
  else
    select * into v_old from public.placement_outcome_type where id = p_id and placement_id = p_placement_id for update;
    if v_old.id is null then
      raise exception 'not_found: that outcome is not on this placement' using errcode = 'P0002';
    end if;
    update public.placement_outcome_type set
      name = btrim(p_name), definition = btrim(p_definition), active = coalesce(p_active, true),
      sort_order = coalesce(p_sort_order, sort_order), updated_by = auth.uid()
    where id = p_id
    returning * into v_new;
  end if;

  perform app.audit(case when v_old.id is null then 'workspace.outcome.created' else 'workspace.outcome.updated' end,
    'placement_outcome_type', v_new.id::text,
    format('Positive outcome "%s" %s', v_new.name, case when v_old.id is null then 'added' else 'edited' end),
    case when v_old.id is null then null else jsonb_build_object('name', v_old.name, 'definition', v_old.definition, 'active', v_old.active, 'sort_order', v_old.sort_order) end,
    jsonb_build_object('placement_id', p_placement_id, 'name', v_new.name, 'definition', v_new.definition, 'active', v_new.active, 'sort_order', v_new.sort_order),
    v_case);
  return v_new.id;
end;
$$;

revoke all on function public.so_save_outcome_type(uuid, uuid, text, text, boolean, integer) from public, anon;
grant execute on function public.so_save_outcome_type(uuid, uuid, text, text, boolean, integer) to authenticated;

-- 5. Metric definitions (DA Admin) ---------------------------------------------------

create or replace function public.so_save_metric(p_metric jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text := lower(btrim(coalesce(p_metric ->> 'key', '')));
  v_old public.activity_metric;
  v_new public.activity_metric;
begin
  if not app.is_admin() then
    raise exception 'admin_required: only DA Admin manages metric definitions' using errcode = '42501';
  end if;
  if v_key = '' then
    raise exception 'required: a metric needs a key' using errcode = '23514';
  end if;

  select * into v_old from public.activity_metric where key = v_key for update;
  if v_old.key is null then
    insert into public.activity_metric (key, label, description, category, source, unit, operator_editable, by_outcome, active, sort_order, updated_by)
    values (
      v_key, btrim(p_metric ->> 'label'), btrim(p_metric ->> 'description'), p_metric ->> 'category', p_metric ->> 'source',
      p_metric ->> 'unit', coalesce((p_metric ->> 'operator_editable')::boolean, false),
      coalesce((p_metric ->> 'by_outcome')::boolean, false), coalesce((p_metric ->> 'active')::boolean, true),
      coalesce((p_metric ->> 'sort_order')::integer, 1000), auth.uid()
    )
    returning * into v_new;
  else
    update public.activity_metric set
      label = coalesce(nullif(btrim(p_metric ->> 'label'), ''), label),
      description = coalesce(nullif(btrim(p_metric ->> 'description'), ''), description),
      category = coalesce(p_metric ->> 'category', category),
      source = coalesce(p_metric ->> 'source', source),
      unit = coalesce(p_metric ->> 'unit', unit),
      operator_editable = coalesce((p_metric ->> 'operator_editable')::boolean, operator_editable),
      active = coalesce((p_metric ->> 'active')::boolean, active),
      sort_order = coalesce((p_metric ->> 'sort_order')::integer, sort_order),
      updated_by = auth.uid()
    where key = v_key
    returning * into v_new;
  end if;

  perform app.audit(case when v_old.key is null then 'workspace.metric.created' else 'workspace.metric.updated' end,
    'activity_metric', v_key, format('Metric "%s" %s', v_new.label, case when v_old.key is null then 'added' else 'edited' end),
    case when v_old.key is null then null else to_jsonb(v_old) - 'updated_at' - 'created_at' - 'updated_by' end,
    to_jsonb(v_new) - 'updated_at' - 'created_at' - 'updated_by');
  return v_key;
end;
$$;

revoke all on function public.so_save_metric(jsonb) from public, anon;
grant execute on function public.so_save_metric(jsonb) to authenticated;

-- 6. Targets -------------------------------------------------------------------------

create or replace function public.so_set_default_target(
  p_metric_key text,
  p_placement_type text,
  p_daily numeric,
  p_weekly numeric,
  p_effective_from date default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text := nullif(btrim(coalesce(p_placement_type, '')), '');
  v_from date := coalesce(p_effective_from, current_date);
  v_before public.activity_target;
  v_id uuid;
begin
  if not app.is_admin() then
    raise exception 'admin_required: only DA Admin sets default targets' using errcode = '42501';
  end if;
  if not exists (select 1 from public.activity_metric where key = p_metric_key) then
    raise exception 'not_found: there is no metric called %', p_metric_key using errcode = 'P0002';
  end if;
  if v_from < current_date then
    raise exception 'no_backdating: past days keep the target that applied to them' using errcode = '23514';
  end if;

  select t.* into v_before from public.activity_target t
  where t.layer = 'default' and t.metric_key = p_metric_key and t.placement_type is not distinct from v_type
  order by t.effective_from desc, t.set_at desc limit 1;

  insert into public.activity_target (layer, metric_key, placement_type, daily, weekly, effective_from, note, set_by)
  values ('default', p_metric_key, v_type, p_daily, p_weekly, v_from, nullif(btrim(coalesce(p_note, '')), ''), auth.uid())
  returning id into v_id;

  perform app.audit('workspace.target.default', 'activity_target', v_id::text,
    format('Default target for %s%s set from %s', p_metric_key,
      case when v_type is null then '' else ' (' || v_type || ')' end, v_from),
    case when v_before.id is null then null else jsonb_build_object('daily', v_before.daily, 'weekly', v_before.weekly, 'effective_from', v_before.effective_from) end,
    jsonb_build_object('metric_key', p_metric_key, 'placement_type', v_type, 'daily', p_daily, 'weekly', p_weekly, 'effective_from', v_from));
  return v_id;
end;
$$;

revoke all on function public.so_set_default_target(text, text, numeric, numeric, date, text) from public, anon;
grant execute on function public.so_set_default_target(text, text, numeric, numeric, date, text) to authenticated;

create or replace function public.so_set_override_target(
  p_placement_id uuid,
  p_metric_key text,
  p_daily numeric,
  p_weekly numeric,
  p_effective_from date default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin boolean := app.is_admin();
  v_pl public.placement;
  v_from date;
  v_default public.activity_target;
  v_before public.activity_target;
  v_min integer;
  v_max integer;
  v_id uuid;
begin
  if not v_admin then
    if not app.so_manages_placement(p_placement_id) then
      raise exception 'out_of_scope: that placement is not assigned to you' using errcode = '42501';
    end if;
    perform app.require('workspace.targets.override');
  end if;

  select * into v_pl from public.placement where id = p_placement_id;
  if v_pl.id is null or v_pl.placement_type is null then
    raise exception 'not_found: that is not a workspace placement' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.activity_metric where key = p_metric_key) then
    raise exception 'not_found: there is no metric called %', p_metric_key using errcode = 'P0002';
  end if;
  v_from := coalesce(p_effective_from, (now() at time zone v_pl.time_zone)::date);
  if v_from < (now() at time zone v_pl.time_zone)::date then
    raise exception 'no_backdating: past days keep the target that applied to them' using errcode = '23514';
  end if;

  if not v_admin then
    select target_override_min_pct, target_override_max_pct into v_min, v_max from public.team_setting where id = 1;
    v_default := app.so_default_target(v_pl.placement_type, p_metric_key, v_from);
    if v_min is not null and (
         (p_daily is not null and v_default.daily is not null and p_daily < v_default.daily * v_min / 100.0)
      or (p_weekly is not null and v_default.weekly is not null and p_weekly < v_default.weekly * v_min / 100.0)) then
      raise exception 'below_limit: managers may not set a target below % percent of the default', v_min using errcode = '23514';
    end if;
    if v_max is not null and (
         (p_daily is not null and v_default.daily is not null and p_daily > v_default.daily * v_max / 100.0)
      or (p_weekly is not null and v_default.weekly is not null and p_weekly > v_default.weekly * v_max / 100.0)) then
      raise exception 'above_limit: managers may not set a target above % percent of the default', v_max using errcode = '23514';
    end if;
  end if;

  select t.* into v_before from public.activity_target t
  where t.layer = 'override' and t.placement_id = p_placement_id and t.metric_key = p_metric_key
  order by t.effective_from desc, t.set_at desc limit 1;

  insert into public.activity_target (layer, metric_key, placement_id, daily, weekly, effective_from, note, set_by)
  values ('override', p_metric_key, p_placement_id, p_daily, p_weekly, v_from, nullif(btrim(coalesce(p_note, '')), ''), auth.uid())
  returning id into v_id;

  perform app.audit('workspace.target.override', 'activity_target', v_id::text,
    format('Operator target for %s set from %s', p_metric_key, v_from),
    case when v_before.id is null then null else jsonb_build_object('daily', v_before.daily, 'weekly', v_before.weekly, 'effective_from', v_before.effective_from) end,
    jsonb_build_object('placement_id', p_placement_id, 'metric_key', p_metric_key, 'daily', p_daily, 'weekly', p_weekly, 'effective_from', v_from),
    v_pl.case_file_id);
  return v_id;
end;
$$;

revoke all on function public.so_set_override_target(uuid, text, numeric, numeric, date, text) from public, anon;
grant execute on function public.so_set_override_target(uuid, text, numeric, numeric, date, text) to authenticated;

-- 7. Settings (DA Admin) -------------------------------------------------------------

create or replace function public.so_save_settings(p_settings jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.team_setting;
  v_new public.team_setting;
  v_fields constant text[] := array[
    'mismatch_tolerance_pct', 'mismatch_small_count_under', 'mismatch_small_count_gap',
    'eod_reminder_minutes_before', 'eod_late_minutes_after', 'eod_manager_alert_minutes_after',
    'eod_missed_rule', 'eod_missed_hours_after', 'eod_edit_rule', 'eod_edit_hours_after',
    'eod_hours_worked_enabled', 'eod_note_to_manager_enabled', 'client_feedback_token_days',
    'speed_to_lead_target_seconds', 'target_override_min_pct', 'target_override_max_pct'];
  s jsonb := p_settings;
begin
  if not app.is_admin() then
    raise exception 'admin_required: only DA Admin changes workspace settings' using errcode = '42501';
  end if;

  select * into v_old from public.team_setting where id = 1 for update;

  update public.team_setting set
    mismatch_tolerance_pct = coalesce((s ->> 'mismatch_tolerance_pct')::numeric, mismatch_tolerance_pct),
    mismatch_small_count_under = coalesce((s ->> 'mismatch_small_count_under')::integer, mismatch_small_count_under),
    mismatch_small_count_gap = coalesce((s ->> 'mismatch_small_count_gap')::numeric, mismatch_small_count_gap),
    eod_reminder_minutes_before = coalesce((s ->> 'eod_reminder_minutes_before')::integer, eod_reminder_minutes_before),
    eod_late_minutes_after = coalesce((s ->> 'eod_late_minutes_after')::integer, eod_late_minutes_after),
    eod_manager_alert_minutes_after = coalesce((s ->> 'eod_manager_alert_minutes_after')::integer, eod_manager_alert_minutes_after),
    eod_missed_rule = coalesce(s ->> 'eod_missed_rule', eod_missed_rule),
    eod_missed_hours_after = case when s ? 'eod_missed_hours_after' then (s ->> 'eod_missed_hours_after')::integer else eod_missed_hours_after end,
    eod_edit_rule = coalesce(s ->> 'eod_edit_rule', eod_edit_rule),
    eod_edit_hours_after = case when s ? 'eod_edit_hours_after' then (s ->> 'eod_edit_hours_after')::integer else eod_edit_hours_after end,
    eod_hours_worked_enabled = coalesce((s ->> 'eod_hours_worked_enabled')::boolean, eod_hours_worked_enabled),
    eod_note_to_manager_enabled = coalesce((s ->> 'eod_note_to_manager_enabled')::boolean, eod_note_to_manager_enabled),
    client_feedback_token_days = coalesce((s ->> 'client_feedback_token_days')::integer, client_feedback_token_days),
    speed_to_lead_target_seconds = case when s ? 'speed_to_lead_target_seconds' then (s ->> 'speed_to_lead_target_seconds')::integer else speed_to_lead_target_seconds end,
    target_override_min_pct = case when s ? 'target_override_min_pct' then (s ->> 'target_override_min_pct')::integer else target_override_min_pct end,
    target_override_max_pct = case when s ? 'target_override_max_pct' then (s ->> 'target_override_max_pct')::integer else target_override_max_pct end,
    updated_by = auth.uid(),
    updated_at = now()
  where id = 1
  returning * into v_new;

  if v_new.eod_missed_rule = 'hours_after_deadline' and v_new.eod_missed_hours_after is null then
    raise exception 'required: set how many hours after the deadline an EOD becomes Missed' using errcode = '23514';
  end if;
  if v_new.eod_edit_rule = 'hours_after_submit' and v_new.eod_edit_hours_after is null then
    raise exception 'required: set how many hours after submitting an EOD stays editable' using errcode = '23514';
  end if;
  if v_new.target_override_min_pct is not null and v_new.target_override_max_pct is not null
     and v_new.target_override_min_pct > v_new.target_override_max_pct then
    raise exception 'invalid: the override floor is above the ceiling' using errcode = '23514';
  end if;

  perform app.audit('workspace.settings', 'team_setting', '1', 'Changed Sales Operator workspace settings',
    (select jsonb_object_agg(k, to_jsonb(v_old) -> k) from unnest(v_fields) k),
    (select jsonb_object_agg(k, to_jsonb(v_new) -> k) from unnest(v_fields) k));
end;
$$;

revoke all on function public.so_save_settings(jsonb) from public, anon;
grant execute on function public.so_save_settings(jsonb) to authenticated;
