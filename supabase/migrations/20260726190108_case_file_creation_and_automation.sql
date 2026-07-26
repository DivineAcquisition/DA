-- ---------------------------------------------------------------------------
-- Case file creation
-- ---------------------------------------------------------------------------

-- Creates the engagement and registers the Drive folder set. The folder ids are
-- supplied by the caller because only the app holds Google credentials; the
-- database records the references.
create or replace function public.create_case_file(
  p_name text,
  p_vertical text default null,
  p_contact_name text default null,
  p_contact_email text default null,
  p_engagement_start date default null,
  p_retainer_amount numeric default null,
  p_revenue_goal_monthly numeric default null
)
returns public.client_case_file
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_slug text;
  v_suffix integer := 0;
  v_case_file public.client_case_file;
begin
  if coalesce(nullif(trim(p_name), ''), '') = '' then
    raise exception 'name_required' using errcode = '23514';
  end if;

  v_slug := regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g');
  v_slug := trim(both '-' from v_slug);

  while exists (select 1 from public.client_case_file where slug = v_slug || case when v_suffix = 0 then '' else '-' || v_suffix end) loop
    v_suffix := v_suffix + 1;
  end loop;

  if v_suffix > 0 then
    v_slug := v_slug || '-' || v_suffix;
  end if;

  insert into public.client_case_file (
    name, slug, vertical, contact_name, contact_email, engagement_start,
    retainer_amount, revenue_goal_monthly, created_by
  )
  values (
    trim(p_name), v_slug, p_vertical, p_contact_name, p_contact_email, p_engagement_start,
    p_retainer_amount, p_revenue_goal_monthly, auth.uid()
  )
  returning * into v_case_file;

  return v_case_file;
end;
$$;

-- Records the Drive folder set once the app has created it.
create or replace function public.register_drive_folders(
  p_case_file_id uuid,
  p_root_folder_id text,
  p_root_folder_url text,
  p_subfolders jsonb
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_entry record;
begin
  update public.client_case_file
     set drive_folder_id = p_root_folder_id, drive_folder_url = p_root_folder_url
   where id = p_case_file_id;

  for v_entry in select * from jsonb_each(coalesce(p_subfolders, '{}'::jsonb)) loop
    insert into public.case_file_drive_folder (case_file_id, category, folder_id, folder_url)
    values (
      p_case_file_id,
      v_entry.key::public.evidence_category,
      v_entry.value ->> 'folder_id',
      v_entry.value ->> 'folder_url'
    )
    on conflict (case_file_id, category) do update
      set folder_id = excluded.folder_id, folder_url = excluded.folder_url;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Weekly automatic snapshots
-- ---------------------------------------------------------------------------

-- Security definer because pg_cron runs it with no authenticated user, so RLS
-- would otherwise see nothing. It reads and writes only its own tables and
-- takes no caller input, so there is no injection surface.
create or replace function app.take_automatic_snapshots()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_case_file record;
  v_taken integer := 0;
  v_start date := (current_date - interval '7 days')::date;
  v_snapshot_id uuid;
begin
  for v_case_file in
    select cf.id
    from public.client_case_file cf
    join public.snapshot b on b.case_file_id = cf.id and b.kind = 'baseline' and b.locked_at is not null
    where cf.status in ('installing', 'active')
  loop
    insert into public.snapshot (case_file_id, kind, period_start, period_end, trigger, notes)
    values (v_case_file.id, 'progress', v_start, current_date, 'automatic', 'Weekly automatic snapshot.')
    returning id into v_snapshot_id;

    insert into public.snapshot_metric (snapshot_id, metric_key, value, source)
    select v_snapshot_id, r.key, r.value::numeric, 'measured'
    from jsonb_each_text(public.rollup_tracking(v_case_file.id, v_start, current_date)) r(key, value)
    where r.value is not null;

    -- An automatic snapshot with nothing behind it is noise, so drop it rather
    -- than leaving a row of nulls in the series.
    if not exists (select 1 from public.snapshot_metric where snapshot_id = v_snapshot_id) then
      delete from public.snapshot where id = v_snapshot_id;
    else
      update public.snapshot set locked_at = now() where id = v_snapshot_id;
      v_taken := v_taken + 1;
      perform public.detect_milestones(v_case_file.id);
    end if;
  end loop;

  return v_taken;
end;
$$;

comment on function app.take_automatic_snapshots is 'Weekly job: rolls the ingested tracking data into an immutable snapshot for every installed engagement.';

-- Admin-callable wrapper so the button in the UI and the cron job share one
-- code path.
create or replace function public.run_weekly_snapshots()
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  perform app.require_admin();
  return app.take_automatic_snapshots();
end;
$$;
