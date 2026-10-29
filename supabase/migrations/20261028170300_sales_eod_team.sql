-- Team Workspace reads the EOD clock: needs-review queue, help and escalation flags.

create or replace function app.so_team_placement_row(p public.placement, p_admin boolean)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_op public.operator;
  v_client text;
  v_manager text;
  v_day date := app.placement_today(p);
  v_cert jsonb;
  v_last timestamptz;
  v_kind text;
  v_open integer;
  v_overdue integer;
  v_unread integer;
  v jsonb;
begin
  select * into v_op from public.operator where id = p.operator_id;
  select cf.name into v_client from public.client_case_file cf where cf.id = p.case_file_id;
  select coalesce(nullif(btrim(m.full_name), ''), m.email) into v_manager
  from public.profile m where m.id = p.manager_profile_id;
  v_cert := app.so_cert_info(v_op.profile_id, v_day);

  select x.at, x.kind into v_last, v_kind
  from (
    select d.operator_updated_at as at, 'quick_log' as kind
    from public.activity_day d
    where d.operator_id = p.operator_id and d.placement_id = p.id and d.operator_updated_at is not null
    union all
    select ev.at, 'task'
    from public.audit_event ev
    join public.operator_task t on t.id::text = ev.entity_id
    where ev.action = 'task.completed' and t.operator_id = p.operator_id
    union all
    select l.at, 'sign_in'
    from public.login_event l
    where l.profile_id = v_op.profile_id and l.outcome = 'success'
    union all
    select ev.at, 'workspace'
    from public.audit_event ev
    where ev.action in ('workspace.opened', 'portal.opened') and ev.actor_profile_id = v_op.profile_id
  ) x
  where x.at is not null
  order by x.at desc
  limit 1;

  select count(*) filter (where t.completed_on is null),
         count(*) filter (where t.completed_on is null and t.due_on is not null and t.due_on < v_day)
    into v_open, v_overdue
  from public.operator_task t where t.operator_id = p.operator_id;
  select count(*) into v_unread from public.operator_notification n
  where n.operator_id = p.operator_id and n.read_at is null;

  v := jsonb_build_object(
    'operator_id', p.operator_id,
    'name', v_op.name,
    'email', v_op.email,
    'phone', v_op.phone,
    'placement_id', p.id,
    'client_id', p.case_file_id,
    'client_name', v_client,
    'placement_type', p.placement_type,
    'placement_status', p.status,
    'manager_id', p.manager_profile_id,
    'manager_name', v_manager,
    'shift_status', app.so_shift_status(p),
    'time_zone', p.time_zone,
    'shift_start', p.shift_start,
    'shift_end', p.shift_end,
    'local_minutes', app.so_local_minutes(p.time_zone),
    'working_day', extract(isodow from v_day)::smallint = any (p.working_days) or app.on_shift_now(p),
    'eod_status', case
      when exists (select 1 from public.sales_excused_day x where x.placement_id = p.id and x.work_date = v_day) then 'excused'
      else coalesce((select e.status from public.sales_eod e where e.placement_id = p.id and e.work_date = v_day), 'not_started')
    end,
    'was_late', coalesce((select e.was_late from public.sales_eod e where e.placement_id = p.id and e.work_date = v_day), false),
    'needs_help', coalesce((select e.needs_help from public.sales_eod e where e.placement_id = p.id and e.work_date = v_day), false),
    'escalated', coalesce((select e.escalated_at is not null from public.sales_eod e where e.placement_id = p.id and e.work_date = v_day), false),
    'last_activity_at', v_last,
    'last_activity_kind', v_kind,
    'tasks_open', v_open,
    'tasks_overdue', v_overdue,
    'alerts_unread', v_unread,
    'certification', v_cert ->> 'state',
    'recertify_on', v_cert -> 'recertify_on',
    'metrics', (
      select coalesce(jsonb_agg(app.so_team_metric(p.id, v_day, k.metric_key, p_admin) order by k.ord), '[]'::jsonb)
      from (values
        ('conversations_held', 1),
        ('positive_outcomes', 2),
        ('texts_sent', 3),
        ('emails_sent', 4),
        ('reactivated_bookings', 5)
      ) as k(metric_key, ord)
    )
  );
  if p_admin then
    v := v || jsonb_build_object(
      'open_mismatch', exists (
        select 1 from public.activity_mismatch mm
        where mm.operator_id = p.operator_id and mm.status = 'open'
      )
    );
  end if;
  return v;
end;
$$;


revoke all on function app.so_team_placement_row(public.placement, boolean) from public, anon, authenticated;

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
        and e.work_date >= app.placement_today(pl) - 1 and e.work_date <= app.placement_today(pl))
      or (p_status = 'needs_review')
      or (p_from is not null and e.work_date >= p_from and (p_to is null or e.work_date <= p_to))
      or (p_from is null and p_to is not null and e.work_date <= p_to)
    )
      and (
        p_status is null
        or (p_status = 'needs_review' and e.submitted_at is not null and e.reviewed_at is null and e.status <> 'excused')
        or (p_status <> 'needs_review' and e.status = p_status)
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
