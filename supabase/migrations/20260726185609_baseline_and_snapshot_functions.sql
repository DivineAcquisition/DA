-- ---------------------------------------------------------------------------
-- Baseline capture and locking
-- ---------------------------------------------------------------------------

-- Captures or amends the baseline. Callable repeatedly while the engagement is
-- still in audit; the child-row guard refuses once the baseline is locked.
create or replace function public.capture_baseline(
  p_case_file_id uuid,
  p_metrics jsonb,
  p_lead_sources jsonb default '{}'::jsonb,
  p_tooling text[] default '{}',
  p_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_snapshot_id uuid;
  v_locked timestamptz;
  v_entry record;
begin
  select s.id, s.locked_at into v_snapshot_id, v_locked
  from public.snapshot s
  where s.case_file_id = p_case_file_id and s.kind = 'baseline';

  if v_locked is not null then
    raise exception 'baseline_locked: the baseline locked at % when the install began and can never be edited, only annotated', v_locked using errcode = '23514';
  end if;

  if v_snapshot_id is null then
    insert into public.snapshot (case_file_id, kind, trigger, tooling, notes, created_by)
    values (p_case_file_id, 'baseline', 'manual', p_tooling, p_notes, auth.uid())
    returning id into v_snapshot_id;
  else
    update public.snapshot
       set tooling = p_tooling, notes = coalesce(p_notes, notes)
     where id = v_snapshot_id;
  end if;

  -- Each metric arrives as { key: { value, source, note } }.
  for v_entry in select * from jsonb_each(p_metrics) loop
    insert into public.snapshot_metric (snapshot_id, metric_key, value, source, measurement_note)
    values (
      v_snapshot_id,
      v_entry.key,
      nullif(v_entry.value ->> 'value', '')::numeric,
      coalesce(nullif(v_entry.value ->> 'source', ''), 'measured')::public.measurement_source,
      nullif(v_entry.value ->> 'note', '')
    )
    on conflict (snapshot_id, metric_key) do update
      set value = excluded.value,
          source = excluded.source,
          measurement_note = excluded.measurement_note;
  end loop;

  for v_entry in select * from jsonb_each(p_lead_sources) loop
    insert into public.snapshot_lead_source (snapshot_id, source, leads_per_month)
    values (v_snapshot_id, v_entry.key, nullif(v_entry.value #>> '{}', '')::numeric)
    on conflict (snapshot_id, source) do update set leads_per_month = excluded.leads_per_month;
  end loop;

  return v_snapshot_id;
end;
$$;

comment on function public.capture_baseline is 'Captures the pre-install starting position. Refuses once the baseline is locked.';

-- Rule 1. This is the only path that locks a baseline, and it refuses to start
-- an install without one, because every number this system later reports is a
-- delta from the baseline.
create or replace function public.begin_install(p_case_file_id uuid)
returns public.client_case_file
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_baseline public.snapshot;
  v_metric_count integer;
  v_case_file public.client_case_file;
begin
  select * into v_baseline
  from public.snapshot
  where case_file_id = p_case_file_id and kind = 'baseline';

  if v_baseline.id is null then
    raise exception 'baseline_required: this engagement has no baseline. Capture one during the audit before the install begins, or every later number is meaningless.' using errcode = '23514';
  end if;

  select count(*) into v_metric_count
  from public.snapshot_metric where snapshot_id = v_baseline.id and value is not null;

  if v_metric_count = 0 then
    raise exception 'baseline_empty: the baseline exists but records no measurements' using errcode = '23514';
  end if;

  if v_baseline.locked_at is null then
    update public.snapshot set locked_at = now() where id = v_baseline.id;
  end if;

  update public.client_case_file
     set install_started_at = coalesce(install_started_at, now()),
         status = case when status = 'audit' then 'installing' else status end
   where id = p_case_file_id
  returning * into v_case_file;

  insert into public.milestone (case_file_id, occurred_on, type, title, description, auto_generated, created_by)
  values (p_case_file_id, current_date, 'install_complete', 'Install phase started', 'Baseline locked. Every figure reported from here is a measured delta from it.', false, auth.uid())
  on conflict do nothing;

  return v_case_file;
end;
$$;

comment on function public.begin_install is 'Rule 1: locks the baseline. Refuses when no baseline exists.';

-- ---------------------------------------------------------------------------
-- Progress snapshots
-- ---------------------------------------------------------------------------

-- Takes an immutable progress snapshot. Metrics passed explicitly are used;
-- anything omitted is filled from the ingested tracking data for the period.
create or replace function public.take_snapshot(
  p_case_file_id uuid,
  p_period_start date default null,
  p_period_end date default null,
  p_metrics jsonb default '{}'::jsonb,
  p_trigger public.snapshot_trigger default 'manual',
  p_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_snapshot_id uuid;
  v_baseline public.snapshot;
  v_start date := coalesce(p_period_start, (current_date - interval '7 days')::date);
  v_end date := coalesce(p_period_end, current_date);
  v_entry record;
  v_rolled jsonb;
begin
  select * into v_baseline
  from public.snapshot where case_file_id = p_case_file_id and kind = 'baseline';

  if v_baseline.id is null then
    raise exception 'baseline_required: cannot measure progress against a case file with no baseline' using errcode = '23514';
  end if;

  if v_baseline.locked_at is null then
    raise exception 'baseline_unlocked: the baseline is still open for editing. Begin the install to lock it before taking progress snapshots.' using errcode = '23514';
  end if;

  insert into public.snapshot (case_file_id, kind, period_start, period_end, trigger, notes, created_by, locked_at)
  values (p_case_file_id, 'progress', v_start, v_end, p_trigger, p_notes, auth.uid(), null)
  returning id into v_snapshot_id;

  v_rolled := public.rollup_tracking(p_case_file_id, v_start, v_end);

  for v_entry in
    select d.key as metric_key,
           coalesce(nullif(p_metrics -> d.key ->> 'value', '')::numeric, nullif(v_rolled ->> d.key, '')::numeric) as value,
           coalesce(nullif(p_metrics -> d.key ->> 'source', ''), 'measured')::public.measurement_source as source,
           nullif(p_metrics -> d.key ->> 'note', '') as note
    from public.metric_definition d
  loop
    if v_entry.value is not null then
      insert into public.snapshot_metric (snapshot_id, metric_key, value, source, measurement_note)
      values (v_snapshot_id, v_entry.metric_key, v_entry.value, v_entry.source, v_entry.note);
    end if;
  end loop;

  -- Rule 2: locked at the moment it is taken, so the numbers can never move.
  update public.snapshot set locked_at = now() where id = v_snapshot_id;

  return v_snapshot_id;
end;
$$;

comment on function public.take_snapshot is 'Rule 2: a progress snapshot is locked the instant it is taken.';

create or replace function public.annotate_snapshot(p_snapshot_id uuid, p_body text)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  insert into public.snapshot_annotation (snapshot_id, body, created_by)
  values (p_snapshot_id, p_body, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

comment on function public.annotate_snapshot is 'The only way to qualify a locked snapshot, for instance a fortnight the client paused their ads.';
