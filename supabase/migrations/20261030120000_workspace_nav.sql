-- Navigation counts, manager-safe GHL outcome mapping, and EOD queue filters.
-- Domain changes stay DA Admin only. This adds the view-as block.

create or replace function public.so_save_operator_domain(p jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.team_setting;
  v_origin text := app.so_origin(p ->> 'origin');
  v_also text[];
  v_retired text[];
  v_refresh integer;
begin
  if not app.is_admin() or app.is_impersonating() then
    raise exception 'admin_required: only DA Admin changes the operator workspace domain' using errcode = '42501';
  end if;
  if v_origin is null then
    raise exception 'invalid_domain: the operator workspace needs a host' using errcode = '23514';
  end if;
  select coalesce(array_agg(app.so_origin(value)), '{}') into v_also
  from jsonb_array_elements_text(coalesce(p -> 'also_active', '[]'::jsonb)) value
  where app.so_origin(value) is not null;
  select coalesce(array_agg(app.so_origin(value)), '{}') into v_retired
  from jsonb_array_elements_text(coalesce(p -> 'retired', '[]'::jsonb)) value
  where app.so_origin(value) is not null;
  v_also := coalesce(v_also, '{}');
  v_retired := coalesce(v_retired, '{}');
  v_also := array(select distinct h from unnest(v_also) h where h <> v_origin and not h = any (v_retired));
  v_retired := array(select distinct h from unnest(v_retired) h where h <> v_origin);
  v_refresh := coalesce((p ->> 'refresh_minutes')::integer, (select team_workspace_refresh_minutes from public.team_setting where id = 1));
  if v_refresh is null or v_refresh not between 1 and 30 then
    raise exception 'invalid_refresh: choose between 1 and 30 minutes' using errcode = '23514';
  end if;

  select * into v_old from public.team_setting where id = 1 for update;
  update public.team_setting set
    base_url = v_origin,
    operator_workspace_also_active = v_also,
    operator_workspace_retired = v_retired,
    team_workspace_refresh_minutes = v_refresh,
    updated_by = auth.uid(),
    updated_at = now()
  where id = 1;

  perform app.audit(
    'workspace.domain', 'team_setting', '1', 'Changed the operator workspace domain',
    jsonb_build_object(
      'origin', v_old.base_url,
      'also_active', v_old.operator_workspace_also_active,
      'retired', v_old.operator_workspace_retired,
      'refresh_minutes', v_old.team_workspace_refresh_minutes
    ),
    jsonb_build_object(
      'origin', v_origin,
      'also_active', v_also,
      'retired', v_retired,
      'refresh_minutes', v_refresh
    )
  );
end;
$$;

revoke all on function public.so_save_operator_domain(jsonb) from public, anon;
grant execute on function public.so_save_operator_domain(jsonb) to authenticated;

-- Managers map outcomes. They do not receive the token, location id, or GHL user id.
create or replace function public.so_ghl_outcome_panel(p_placement uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pl public.placement;
  v_link public.sales_ghl_link;
begin
  if app.is_impersonating() or (not app.is_admin() and not app.is_manager()) then
    raise exception 'permission_denied: managers and DA Admin only' using errcode = '42501';
  end if;
  select * into v_pl from public.placement where id = p_placement;
  if v_pl.id is null then
    raise exception 'not_found: that placement does not exist' using errcode = 'P0002';
  end if;
  select * into v_link from public.sales_ghl_link where placement_id = p_placement;
  return jsonb_build_object(
    'placement_id', p_placement,
    'mapping', coalesce(v_link.mapping, '{}'::jsonb),
    'catalog', coalesce(v_link.catalog, '{}'::jsonb) - 'users',
    'tracks_results', v_pl.tracks_results,
    'missing', jsonb_build_array(
      case when jsonb_array_length(coalesce(v_link.mapping -> 'outcomes', '[]'::jsonb)) = 0 then 'Positive outcomes' end,
      case when v_pl.tracks_results and jsonb_array_length(coalesce(v_link.mapping -> 'show_calendar_ids', '[]'::jsonb)) = 0 then 'Show-rate calendars' end,
      case when v_pl.tracks_results and jsonb_array_length(coalesce(v_link.mapping -> 'close_pipeline_ids', '[]'::jsonb)) = 0 then 'Close pipelines' end
    )
  );
end;
$$;

revoke all on function public.so_ghl_outcome_panel(uuid) from public, anon;
grant execute on function public.so_ghl_outcome_panel(uuid) to authenticated;

create or replace function public.so_nav_counts()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_admin boolean;
  v_late integer;
  v_missed integer;
  v_review integer;
  v_escalations integer := 0;
begin
  if not app.is_admin() and not app.is_manager() then
    raise exception 'permission_denied: managers and DA Admin only' using errcode = '42501';
  end if;
  v_admin := app.is_admin();
  select
    count(*) filter (where e.status = 'late'),
    count(*) filter (where e.status = 'missed' and e.submitted_at is null),
    count(*) filter (where e.submitted_at is not null and e.reviewed_at is null and e.status <> 'excused')
  into v_late, v_missed, v_review
  from public.sales_eod e
  where e.work_date >= current_date - 14;
  if v_admin then
    select count(*) into v_escalations from public.escalation where status = 'open';
  end if;
  return jsonb_build_object(
    'home', coalesce(v_late, 0) + coalesce(v_missed, 0) + coalesce(v_review, 0) + coalesce(v_escalations, 0),
    'escalations', coalesce(v_escalations, 0)
  );
end;
$$;

revoke all on function public.so_nav_counts() from public, anon;
grant execute on function public.so_nav_counts() to authenticated;

create or replace function public.so_team_eods(
  p_from date default null,
  p_to date default null,
  p_status text default null,
  p_operator_id uuid default null,
  p_manager_id uuid default null,
  p_client_id uuid default null,
  p_has_feedback boolean default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_admin boolean := app.so_require_team_staff();
begin
  perform public.so_eod_sweep();
  return jsonb_build_object('is_admin', v_admin, 'eods', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', e.id,
      'operator_id', e.operator_id,
      'operator_name', o.name,
      'client_id', pl.case_file_id,
      'client_name', cf.name,
      'manager_id', pl.manager_profile_id,
      'manager_name', coalesce(nullif(btrim(m.full_name), ''), m.email),
      'work_date', e.work_date,
      'status', e.status,
      'submitted_at', e.submitted_at,
      'was_late', e.was_late,
      'needs_help', e.needs_help,
      'escalated', e.escalated_at is not null,
      'reviewed', e.reviewed_at is not null,
      'feedback_count', (select count(*) from public.sales_eod_feedback f where f.eod_id = e.id)
    ) order by e.needs_help desc, (e.escalated_at is null), e.work_date desc, o.name)
    from public.sales_eod e
    join public.operator o on o.id = e.operator_id
    join public.placement pl on pl.id = e.placement_id
    join public.client_case_file cf on cf.id = pl.case_file_id
    left join public.profile m on m.id = pl.manager_profile_id
    where (
      (p_from is null and p_to is null and p_status is distinct from 'needs_review'
        and p_status is distinct from 'needs_help' and p_status is distinct from 'escalated'
        and e.work_date >= app.placement_today(pl) - 1 and e.work_date <= app.placement_today(pl))
      or p_status in ('needs_review', 'needs_help', 'escalated')
      or (p_from is not null and e.work_date >= p_from and (p_to is null or e.work_date <= p_to))
      or (p_from is null and p_to is not null and e.work_date <= p_to)
    )
      and (
        p_status is null or p_status = 'all'
        or (p_status = 'needs_review' and e.submitted_at is not null and e.reviewed_at is null and e.status <> 'excused')
        or (p_status = 'needs_help' and e.needs_help)
        or (p_status = 'escalated' and e.escalated_at is not null)
        or (p_status = 'late' and (e.status = 'late' or e.was_late))
        or (p_status = 'missed' and e.status = 'missed')
        or (p_status not in ('needs_review', 'needs_help', 'escalated', 'late', 'missed', 'all') and e.status = p_status)
      )
      and (p_operator_id is null or e.operator_id = p_operator_id)
      and (p_manager_id is null or pl.manager_profile_id = p_manager_id)
      and (p_client_id is null or pl.case_file_id = p_client_id)
      and (p_has_feedback is null or p_has_feedback = exists (
        select 1 from public.sales_eod_feedback f where f.eod_id = e.id
      ))
  ), '[]'::jsonb));
end;
$$;

revoke all on function public.so_team_eods(date, date, text, uuid, uuid, uuid, boolean) from public, anon;
grant execute on function public.so_team_eods(date, date, text, uuid, uuid, uuid, boolean) to authenticated;

-- Managers lose the GHL connection screens. Outcome mapping stays on the placement.
delete from public.role_permission
where role = 'manager' and permission_key = 'ghl.view';

-- The Training item shows this date. It is the operator on screen, including view-as.
create or replace function public.portal_training_due()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.operator := app.portal_operator();
begin
  return app.so_cert_info(v.profile_id, (now() at time zone app.safe_tz(v.time_zone))::date);
end;
$$;

revoke all on function public.portal_training_due() from public, anon;
grant execute on function public.portal_training_due() to authenticated;
