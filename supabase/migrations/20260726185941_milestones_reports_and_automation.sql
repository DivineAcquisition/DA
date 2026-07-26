-- ---------------------------------------------------------------------------
-- Automatic milestone detection
-- ---------------------------------------------------------------------------

-- Reads the ingested tracking data and marks the firsts that give the growth
-- numbers a narrative. Idempotent: a partial unique index keeps one
-- auto-generated milestone per type per case file.
create or replace function public.detect_milestones(p_case_file_id uuid)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_created integer := 0;
  v_day date;
  v_goal numeric;
begin
  -- First lead captured through the system.
  select min(day) into v_day
  from public.tracking_metric_daily
  where case_file_id = p_case_file_id and metric_key = 'leads_per_month' and value > 0;

  if v_day is not null then
    insert into public.milestone (case_file_id, occurred_on, type, title, description, auto_generated)
    values (p_case_file_id, v_day, 'first_lead', 'First lead captured through the system', 'Detected from ingested tracking data.', true)
    on conflict do nothing;
    v_created := v_created + case when found then 1 else 0 end;
  end if;

  -- First booking.
  select min(day) into v_day
  from public.tracking_metric_daily
  where case_file_id = p_case_file_id and metric_key = 'booking_rate' and value > 0;

  if v_day is not null then
    insert into public.milestone (case_file_id, occurred_on, type, title, description, auto_generated)
    values (p_case_file_id, v_day, 'first_booking', 'First booking through the system', 'Detected from ingested tracking data.', true)
    on conflict do nothing;
    v_created := v_created + case when found then 1 else 0 end;
  end if;

  -- First reactivation revenue: returning-customer revenue appearing at all.
  select min(day) into v_day
  from public.tracking_metric_daily
  where case_file_id = p_case_file_id and metric_key = 'revenue_returning_customers' and value > 0;

  if v_day is not null then
    insert into public.milestone (case_file_id, occurred_on, type, title, description, auto_generated)
    values (p_case_file_id, v_day, 'first_reactivation_revenue', 'First reactivation revenue', 'Revenue from a returning customer worked out of the dormant database.', true)
    on conflict do nothing;
    v_created := v_created + case when found then 1 else 0 end;
  end if;

  -- First month over the revenue goal.
  select revenue_goal_monthly into v_goal from public.client_case_file where id = p_case_file_id;

  if v_goal is not null and v_goal > 0 then
    select min(month_end) into v_day
    from (
      select (date_trunc('month', day) + interval '1 month - 1 day')::date as month_end,
             sum(value) as revenue
      from public.tracking_metric_daily
      where case_file_id = p_case_file_id and metric_key = 'monthly_revenue'
      group by 1
      having sum(value) >= v_goal
    ) m;

    if v_day is not null then
      insert into public.milestone (case_file_id, occurred_on, type, title, description, auto_generated)
      values (p_case_file_id, v_day, 'first_month_over_goal', 'First month over the revenue goal', format('Monthly revenue cleared the %s goal.', v_goal), true)
      on conflict do nothing;
      v_created := v_created + case when found then 1 else 0 end;
    end if;
  end if;

  return v_created;
end;
$$;

comment on function public.detect_milestones is 'Creates the automatic milestones from ingested tracking data. Idempotent.';

-- ---------------------------------------------------------------------------
-- The growth report
-- ---------------------------------------------------------------------------

-- Assembles the report and archives the payload exactly as generated. Rule 7:
-- the stored payload never changes, so there is a permanent record of precisely
-- what a client was shown and when.
create or replace function public.generate_growth_report(
  p_case_file_id uuid,
  p_mode public.report_mode,
  p_period_start date,
  p_period_end date,
  p_evidence_ids uuid[] default '{}'
)
returns public.growth_report
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_case_file public.client_case_file;
  v_baseline public.snapshot;
  v_payload jsonb;
  v_report public.growth_report;
  v_client_facing boolean := p_mode = 'client_facing';
  v_anonymise boolean := p_mode = 'case_study_draft';
begin
  select * into v_case_file from public.client_case_file where id = p_case_file_id;

  if v_case_file.id is null then
    raise exception 'case_file_not_found: %', p_case_file_id using errcode = 'P0002';
  end if;

  select * into v_baseline from public.snapshot where case_file_id = p_case_file_id and kind = 'baseline';

  if v_baseline.id is null then
    raise exception 'baseline_required: growth reporting is disabled without a baseline, because there is nothing to measure the change against' using errcode = '23514';
  end if;

  v_payload := jsonb_build_object(
    'mode', p_mode,
    'generated_at', now(),
    'period', jsonb_build_object('start', p_period_start, 'end', p_period_end),
    'client', case
        when v_anonymise then jsonb_build_object('name', 'A ' || coalesce(v_case_file.vertical, 'service business'), 'anonymised', true, 'vertical', v_case_file.vertical)
        else jsonb_build_object('name', v_case_file.name, 'anonymised', false, 'vertical', v_case_file.vertical, 'contact_name', v_case_file.contact_name)
      end,
    'baseline', jsonb_build_object(
        'taken_at', v_baseline.taken_at,
        'locked_at', v_baseline.locked_at,
        'tooling', v_baseline.tooling
      ),
    -- Rule 3: the full metric set travels into the report, improvements and
    -- regressions alike. There is no client-facing filter on this.
    'metrics', (
      select coalesce(jsonb_agg(to_jsonb(g) order by g.sort_order), '[]'::jsonb)
      from public.growth_for_case_file(p_case_file_id) g
    ),
    'milestones', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'occurred_on', m.occurred_on, 'type', m.type, 'title', m.title,
        'description', m.description, 'auto_generated', m.auto_generated
      ) order by m.occurred_on), '[]'::jsonb)
      from public.milestone m
      where m.case_file_id = p_case_file_id
        and m.occurred_on between p_period_start and p_period_end
    ),
    'snapshots', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id, 'taken_at', s.taken_at, 'trigger', s.trigger,
        'period_start', s.period_start, 'period_end', s.period_end,
        'annotations', (
          select coalesce(jsonb_agg(a.body order by a.created_at), '[]'::jsonb)
          from public.snapshot_annotation a where a.snapshot_id = s.id
        )
      ) order by s.taken_at), '[]'::jsonb)
      from public.snapshot s
      where s.case_file_id = p_case_file_id and s.kind = 'progress'
        and s.taken_at::date between p_period_start and p_period_end
    ),
    'evidence', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', e.id, 'filename', e.filename, 'category', e.category,
        'what_it_proves', e.what_it_proves, 'happened_on', e.happened_on,
        'drive_url', case when v_anonymise then null else e.drive_url end,
        'thumbnail_url', e.thumbnail_url
      ) order by e.happened_on), '[]'::jsonb)
      from public.evidence_item e
      where e.case_file_id = p_case_file_id and e.id = any(p_evidence_ids)
    ),
    -- The effort log and the scope disputes are internal. A client-facing
    -- report is the growth story; the rest is for preparing the conversation.
    'effort', case when v_client_facing then null else (
      select coalesce(jsonb_agg(jsonb_build_object(
        'performed_on', ee.performed_on, 'phase', ee.phase, 'description', ee.description,
        'hours', ee.hours, 'version', ee.version
      ) order by ee.performed_on), '[]'::jsonb)
      from public.effort_entry ee
      where ee.case_file_id = p_case_file_id
        and ee.superseded_by_id is null
        and ee.performed_on between p_period_start and p_period_end
    ) end,
    'scope', case when v_client_facing then null else (
      select coalesce(jsonb_agg(jsonb_build_object(
        'requested_on', sr.requested_on, 'summary', sr.summary,
        'verdict', sr.verdict, 'reason', sr.reason
      ) order by sr.requested_on), '[]'::jsonb)
      from public.scope_request sr
      where sr.case_file_id = p_case_file_id
        and sr.requested_on between p_period_start and p_period_end
    ) end,
    'decisions', case when v_client_facing then null else (
      select coalesce(jsonb_agg(jsonb_build_object(
        'decided_on', dd.decided_on, 'decided_by', dd.decided_by,
        'what_was_decided', dd.what_was_decided, 'reasoning', dd.reasoning,
        'against_recommendation', dd.against_recommendation
      ) order by dd.decided_on), '[]'::jsonb)
      from public.decision dd
      where dd.case_file_id = p_case_file_id
        and dd.superseded_by_id is null
        and dd.decided_on between p_period_start and p_period_end
    ) end,
    'internal_notes', case when v_client_facing then null else v_case_file.notes end
  );

  insert into public.growth_report (case_file_id, mode, period_start, period_end, generated_by, payload, included_evidence_ids)
  values (p_case_file_id, p_mode, p_period_start, p_period_end, auth.uid(), v_payload, p_evidence_ids)
  returning * into v_report;

  return v_report;
end;
$$;

comment on function public.generate_growth_report is 'Rule 7: archives the report payload exactly as generated. Client-facing mode omits effort, scope and internal notes; case study mode anonymises the client.';

-- Records where the generated report was filed in Drive.
create or replace function public.attach_report_to_drive(
  p_report_id uuid,
  p_drive_file_id text,
  p_drive_url text
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  -- growth_report is otherwise immutable, so the Drive reference is written by
  -- a definer-free targeted update that the guard trigger permits by column.
  update public.growth_report
     set drive_file_id = p_drive_file_id, drive_url = p_drive_url
   where id = p_report_id;
end;
$$;
