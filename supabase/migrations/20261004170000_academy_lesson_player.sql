-- Lesson player, content loader, versions, and import log.
-- Additive. Trainees still cannot write progress except through these functions.

alter table public.academy_lesson
  alter column required_watch_percent set default 90;

alter table public.academy_lesson
  add column status text not null default 'draft' check (status in ('draft', 'ready', 'live')),
  add column archived_at timestamptz;

comment on column public.academy_lesson.status is
  'Draft is hidden. Ready is admin preview only. Live is what trainees can open. published stays in step with Live and not archived.';

create unique index academy_lesson_code_active
  on public.academy_lesson (lesson_code)
  where archived_at is null;

create or replace function app.academy_lesson_sync_published()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Older inserts set published directly and leave status at its draft default.
  if tg_op = 'INSERT' and new.published and new.status = 'draft' and new.archived_at is null then
    new.status := 'live';
  end if;
  new.published := new.status = 'live' and new.archived_at is null;
  return new;
end;
$$;

create trigger academy_lesson_sync_published
  before insert or update on public.academy_lesson
  for each row execute function app.academy_lesson_sync_published();

alter table public.academy_asset
  add column provider text check (provider is null or provider in ('vimeo', 'mux', 'file')),
  add column provider_id text,
  add column file_name text,
  add column superseded_by uuid references public.academy_asset (id);

comment on column public.academy_asset.superseded_by is
  'Set when a newer video or document replaces this one. The old row stays.';

create table public.academy_setting (
  id integer primary key check (id = 1),
  default_watch_percent integer not null default 90 check (default_watch_percent between 1 and 100),
  reading_words_per_minute integer not null default 180 check (reading_words_per_minute between 40 and 400),
  min_reading_seconds integer not null default 30 check (min_reading_seconds between 0 and 600),
  document_link_seconds integer not null default 120 check (document_link_seconds between 30 and 900),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profile (id)
);

insert into public.academy_setting (id) values (1);

comment on table public.academy_setting is
  'Editable Academy learner settings. New lessons copy the watch percentage from here. Reading time uses the words-per-minute and the minimum.';

create table public.academy_lesson_version (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.academy_lesson (id) on delete cascade,
  version integer not null check (version > 0),
  title text not null,
  body text not null,
  required_watch_percent integer not null,
  video_asset_id uuid references public.academy_asset (id),
  document_asset_id uuid references public.academy_asset (id),
  status text not null,
  completion_policy text check (completion_policy is null or completion_policy in ('keep', 'review')),
  created_at timestamptz not null default now(),
  created_by uuid references public.profile (id),
  unique (lesson_id, version)
);

comment on table public.academy_lesson_version is
  'Prior and current snapshots. A change to the video, written lesson, or document keeps the previous row.';

comment on column public.academy_lesson_version.completion_policy is
  'When a live lesson changes and trainees have already finished it: keep their completion, or require review.';

alter table public.academy_progress
  add column completed_version integer,
  add column watched_seconds integer not null default 0 check (watched_seconds >= 0),
  add column watched_ranges jsonb not null default '[]'::jsonb,
  add column playback_position_seconds numeric not null default 0 check (playback_position_seconds >= 0),
  add column last_playback_at timestamptz,
  add column document_opened_at timestamptz,
  add column document_asset_id uuid references public.academy_asset (id),
  add column scrolled_to_end boolean not null default false,
  add column reading_seconds integer not null default 0 check (reading_seconds >= 0),
  add column last_reading_at timestamptz;

comment on column public.academy_progress.completed_version is
  'Content version the trainee finished. A newer version does not count until they finish it or an admin keeps the completion.';

create table public.academy_document_grant (
  token text primary key,
  profile_id uuid not null references public.profile (id) on delete cascade,
  enrollment_id uuid not null references public.academy_enrollment (id) on delete cascade,
  lesson_id uuid not null references public.academy_lesson (id) on delete cascade,
  asset_id uuid not null references public.academy_asset (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

comment on table public.academy_document_grant is
  'Short-lived document ticket. The download route also requires the signed-in profile on the ticket.';

create index academy_document_grant_profile_idx on public.academy_document_grant (profile_id, expires_at desc);

create table public.academy_import (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profile (id),
  file_name text not null,
  created_at timestamptz not null default now(),
  created_count integer not null default 0,
  updated_count integer not null default 0,
  skipped_count integer not null default 0,
  detail jsonb not null default '[]'::jsonb
);

comment on table public.academy_import is
  'One bulk import. detail lists each created, updated, and skipped lesson. Imports do not delete lessons.';

-- ---------------------------------------------------------------------------
-- Lesson order, completion, and module display
-- ---------------------------------------------------------------------------

create or replace function app.academy_word_count(p_body text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select coalesce(cardinality(array_remove(
    regexp_split_to_array(
      btrim(regexp_replace(coalesce(p_body, ''), '[^[:alnum:]]+', ' ', 'g')),
      ' '
    ),
    ''
  )), 0);
$$;

create or replace function app.academy_reading_seconds(p_body text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when app.academy_word_count(p_body) = 0 then 0
    else greatest(
      s.min_reading_seconds,
      ceil(app.academy_word_count(p_body)::numeric / s.reading_words_per_minute * 60)
    )::integer
  end
  from public.academy_setting s
  where s.id = 1;
$$;

create or replace function app.academy_lessons_complete(p_enrollment_id uuid, p_module_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.academy_lesson l
    where l.module_id = p_module_id and l.published and l.archived_at is null
  )
  and not exists (
    select 1 from public.academy_lesson l
    where l.module_id = p_module_id and l.published and l.archived_at is null
      and not exists (
        select 1 from public.academy_progress pr
        where pr.enrollment_id = p_enrollment_id
          and pr.lesson_id = l.id
          and pr.status = 'completed'
          and pr.completed_version = l.content_version
      )
  );
$$;

create or replace function app.academy_module_unlocked(p_enrollment_id uuid, p_module_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.academy_module m
    join public.academy_enrollment e
      on e.id = p_enrollment_id and e.program_id = m.program_id
    where m.id = p_module_id
      and not exists (
        select 1
        from public.academy_module prev
        where prev.program_id = m.program_id
          and prev.order_number < m.order_number
          and (
            app.academy_module_gate_passed(p_enrollment_id, prev.id) is distinct from true
            or (
              exists (
                select 1 from public.academy_lesson l
                where l.module_id = prev.id and l.published and l.archived_at is null
              )
              and not app.academy_lessons_complete(p_enrollment_id, prev.id)
            )
          )
      )
  );
$$;

create or replace function app.academy_module_display(p_enrollment_id uuid, p_module_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not app.academy_module_unlocked(p_enrollment_id, p_module_id) then 'locked'
    when not exists (
      select 1 from public.academy_lesson l
      where l.module_id = p_module_id and l.published and l.archived_at is null
    ) then 'unpublished'
    when not app.academy_lessons_complete(p_enrollment_id, p_module_id) then
      case
        when exists (
          select 1
          from public.academy_progress pr
          join public.academy_lesson l on l.id = pr.lesson_id
          where pr.enrollment_id = p_enrollment_id
            and l.module_id = p_module_id
            and pr.status in ('in_progress', 'completed')
        ) or exists (
          select 1
          from public.academy_attempt a
          join public.academy_quiz q on q.id = a.quiz_id
          where a.enrollment_id = p_enrollment_id
            and q.module_id = p_module_id
        ) then 'in_progress'
        else 'available'
      end
    when app.academy_module_gate_passed(p_enrollment_id, p_module_id) then 'complete'
    else 'lessons_complete'
  end;
$$;

create or replace function app.academy_lesson_open(p_enrollment_id uuid, p_lesson_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.academy_lesson l
    join public.academy_module m on m.id = l.module_id
    where l.id = p_lesson_id
      and l.published
      and l.archived_at is null
      and app.academy_content_open(p_enrollment_id)
      and app.academy_module_unlocked(p_enrollment_id, m.id)
      and not exists (
        select 1
        from public.academy_lesson prev
        where prev.module_id = l.module_id
          and prev.published
          and prev.archived_at is null
          and prev.sort_order < l.sort_order
          and not exists (
            select 1 from public.academy_progress pr
            where pr.enrollment_id = p_enrollment_id
              and pr.lesson_id = prev.id
              and pr.status = 'completed'
              and pr.completed_version = prev.content_version
          )
      )
  );
$$;

create or replace function app.academy_add_watch(p_ranges jsonb, p_start numeric, p_end numeric)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v jsonb := '[]'::jsonb;
  r jsonb;
  s numeric := least(p_start, p_end);
  e numeric := greatest(p_start, p_end);
  cs numeric;
  ce numeric;
  placed boolean := false;
begin
  if e <= s then
    return coalesce(p_ranges, '[]'::jsonb);
  end if;
  for r in select value from jsonb_array_elements(coalesce(p_ranges, '[]'::jsonb))
  loop
    cs := (r ->> 'start')::numeric;
    ce := (r ->> 'end')::numeric;
    if ce < s then
      v := v || jsonb_build_array(jsonb_build_object('start', cs, 'end', ce));
    elsif cs > e then
      if not placed then
        v := v || jsonb_build_array(jsonb_build_object('start', s, 'end', e));
        placed := true;
      end if;
      v := v || jsonb_build_array(jsonb_build_object('start', cs, 'end', ce));
    else
      s := least(s, cs);
      e := greatest(e, ce);
    end if;
  end loop;
  if not placed then
    v := v || jsonb_build_array(jsonb_build_object('start', s, 'end', e));
  end if;
  return v;
end;
$$;

create or replace function app.academy_watched_seconds(p_ranges jsonb)
returns integer
language sql
immutable
set search_path = ''
as $$
  select coalesce(floor(sum((value ->> 'end')::numeric - (value ->> 'start')::numeric))::integer, 0)
  from jsonb_array_elements(coalesce(p_ranges, '[]'::jsonb));
$$;

create or replace function app.academy_primary_for_actor()
returns public.academy_enrollment
language sql
stable
security definer
set search_path = ''
as $$
  select app.academy_primary_enrollment(app.acting_profile());
$$;

create or replace function app.academy_completion_gaps(p_enrollment_id uuid, p_lesson_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_lesson public.academy_lesson;
  v_progress public.academy_progress;
  v_duration integer;
  v_watched integer;
  v_pct numeric;
  v_gaps text[] := '{}';
begin
  select * into v_lesson from public.academy_lesson where id = p_lesson_id;
  select * into v_progress
  from public.academy_progress
  where enrollment_id = p_enrollment_id and lesson_id = p_lesson_id;

  if v_lesson.video_asset_id is not null then
    select duration_seconds into v_duration from public.academy_asset where id = v_lesson.video_asset_id;
    v_watched := coalesce(v_progress.watched_seconds, 0);
    if v_duration is null or v_duration <= 0 then
      v_gaps := array_append(v_gaps, 'This video has no duration yet.');
    else
      v_pct := v_watched::numeric / v_duration * 100;
      if v_pct < v_lesson.required_watch_percent then
        v_gaps := array_append(v_gaps, format('Watch %s%% of the video.', v_lesson.required_watch_percent));
      end if;
    end if;
  elsif app.academy_word_count(v_lesson.body) > 0 then
    if coalesce(v_progress.reading_seconds, 0) < app.academy_reading_seconds(v_lesson.body) then
      v_gaps := array_append(v_gaps, 'Stay on the page long enough to read the lesson.');
    end if;
    if not coalesce(v_progress.scrolled_to_end, false) then
      v_gaps := array_append(v_gaps, 'Scroll to the end of the lesson.');
    end if;
  else
    v_gaps := array_append(v_gaps, 'This lesson has no video or written lesson.');
  end if;

  if v_lesson.document_asset_id is not null
     and (v_progress.document_opened_at is null or v_progress.document_asset_id is distinct from v_lesson.document_asset_id) then
    v_gaps := array_append(v_gaps, 'Open the companion document.');
  end if;

  return v_gaps;
end;
$$;

create or replace function app.academy_enrollment_progress(p_enrollment_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_program uuid;
  v_lessons integer;
  v_done integer;
  v_modules integer := 0;
  v_mod_done integer := 0;
  v_mod record;
begin
  select program_id into v_program from public.academy_enrollment where id = p_enrollment_id;
  select count(*) into v_lessons
  from public.academy_lesson l
  join public.academy_module m on m.id = l.module_id
  where m.program_id = v_program and l.published and l.archived_at is null;

  if v_lessons > 0 then
    select count(*) into v_done
    from public.academy_lesson l
    join public.academy_module m on m.id = l.module_id
    join public.academy_progress pr
      on pr.lesson_id = l.id
     and pr.enrollment_id = p_enrollment_id
     and pr.status = 'completed'
     and pr.completed_version = l.content_version
    where m.program_id = v_program and l.published and l.archived_at is null;
    return jsonb_build_object(
      'completed', v_done,
      'total', v_lessons,
      'percent', round(100.0 * v_done / v_lessons),
      'unit', 'lessons'
    );
  end if;

  for v_mod in
    select id from public.academy_module where program_id = v_program
  loop
    v_modules := v_modules + 1;
    if app.academy_module_display(p_enrollment_id, v_mod.id) = 'complete' then
      v_mod_done := v_mod_done + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'completed', v_mod_done,
    'total', v_modules,
    'percent', case when v_modules = 0 then 0 else round(100.0 * v_mod_done / v_modules) end,
    'unit', 'modules'
  );
end;
$$;

create or replace function app.academy_next_step(p_enrollment_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_program uuid;
  v_mod public.academy_module;
  v_display text;
  v_lesson public.academy_lesson;
  v_started boolean;
  v_pos integer;
begin
  select program_id into v_program from public.academy_enrollment where id = p_enrollment_id;
  for v_mod in
    select * from public.academy_module
    where program_id = v_program
    order by order_number
  loop
    v_display := app.academy_module_display(p_enrollment_id, v_mod.id);
    if v_display = 'locked' then
      exit;
    elsif v_display = 'unpublished' then
      return jsonb_build_object(
        'title', 'Not yet published',
        'detail', v_mod.title || ' has no lessons yet.',
        'href', null
      );
    elsif v_display = 'lessons_complete' then
      return jsonb_build_object(
        'title', 'Lessons complete, quiz not yet available',
        'detail', v_mod.title,
        'href', '/academy/modules/' || v_mod.id
      );
    elsif v_display in ('available', 'in_progress') then
      select * into v_lesson
      from public.academy_lesson l
      where l.module_id = v_mod.id and l.published and l.archived_at is null
        and not exists (
          select 1 from public.academy_progress pr
          where pr.enrollment_id = p_enrollment_id
            and pr.lesson_id = l.id
            and pr.status = 'completed'
            and pr.completed_version = l.content_version
        )
      order by l.sort_order
      limit 1;
      if v_lesson.id is null then
        return jsonb_build_object(
          'title', 'Lessons complete, quiz not yet available',
          'detail', v_mod.title,
          'href', '/academy/modules/' || v_mod.id
        );
      end if;
      select exists (
        select 1 from public.academy_progress pr
        where pr.enrollment_id = p_enrollment_id and pr.lesson_id = v_lesson.id
      ) into v_started;
      select 1 + count(*) into v_pos
      from public.academy_lesson earlier
      where earlier.module_id = v_mod.id
        and earlier.published
        and earlier.archived_at is null
        and earlier.sort_order < v_lesson.sort_order;
      return jsonb_build_object(
        'title', format(
          '%s Module %s, Lesson %s',
          case when v_started then 'Continue' else 'Start' end,
          v_mod.order_number,
          v_pos
        ),
        'detail', v_lesson.title,
        'href', '/academy/modules/' || v_mod.id || '/lessons/' || v_lesson.id
      );
    end if;
  end loop;
  return jsonb_build_object('title', 'Nothing to open', 'detail', 'Your program has no modules yet.', 'href', null);
end;
$$;

create or replace function public.academy_shell()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile uuid := app.acting_profile();
  v_state text;
  v_enrollment public.academy_enrollment;
  v_program public.academy_program;
  v_cert_level smallint;
  v_cert_vertical text;
  v_cert_granted timestamptz;
  v_cert_recert date;
  v_modules jsonb := '[]'::jsonb;
  v_current jsonb;
  v_next jsonb;
  v_banner text;
  v_progress jsonb := jsonb_build_object('completed', 0, 'total', 0, 'percent', 0, 'unit', 'modules');
  v_display text;
  v_openable boolean;
  v_mod record;
begin
  v_state := app.academy_screen(v_profile);
  if v_state in ('signed_out', 'no_access', 'no_enrollment') then
    return jsonb_build_object(
      'state', v_state, 'program', null, 'enrollment', null, 'certification', null,
      'progress', v_progress, 'current_module', null, 'next_action', null, 'banner', null, 'modules', '[]'::jsonb
    );
  end if;

  v_enrollment := app.academy_primary_enrollment(v_profile);
  select * into v_program from public.academy_program where id = v_enrollment.program_id;

  if v_state in ('active', 'stalled', 'completed') then
    select c.level, c.vertical, c.granted_at, c.recertify_on
      into v_cert_level, v_cert_vertical, v_cert_granted, v_cert_recert
    from public.academy_certification c
    where c.enrollment_id = v_enrollment.id
    order by c.level desc, c.granted_at desc
    limit 1;

    for v_mod in
      select * from public.academy_module where program_id = v_program.id order by order_number
    loop
      v_display := app.academy_module_display(v_enrollment.id, v_mod.id);
      v_openable := v_display in ('available', 'in_progress', 'complete', 'lessons_complete');
      if v_current is null and v_display in ('available', 'in_progress', 'unpublished', 'lessons_complete') then
        v_current := jsonb_build_object('id', v_mod.id, 'order', v_mod.order_number, 'title', v_mod.title);
      end if;
      v_modules := v_modules || jsonb_build_array(jsonb_build_object(
        'id', v_mod.id, 'order', v_mod.order_number, 'title', v_mod.title, 'description', v_mod.description,
        'required', v_mod.required, 'gate_type', v_mod.gate_type, 'gate_detail', v_mod.gate_detail,
        'display', v_display, 'openable', v_openable
      ));
    end loop;

    v_progress := app.academy_enrollment_progress(v_enrollment.id);
    v_next := app.academy_next_step(v_enrollment.id);
    if v_state = 'stalled' then
      v_banner := 'Your training has stalled. Continue where you left off.';
    end if;
  end if;

  return jsonb_build_object(
    'state', v_state,
    'program', jsonb_build_object('id', v_program.id, 'name', v_program.name, 'type', v_program.program_type, 'version', v_program.version, 'status', v_program.status),
    'enrollment', jsonb_build_object('id', v_enrollment.id, 'status', v_enrollment.status, 'track', v_enrollment.track, 'start_date', v_enrollment.start_date, 'target_date', v_enrollment.target_completion_date),
    'certification', case when v_cert_level is null then null else jsonb_build_object('level', v_cert_level, 'label', app.academy_level_label(v_cert_level), 'vertical', v_cert_vertical, 'granted_at', v_cert_granted, 'recertify_on', v_cert_recert) end,
    'progress', v_progress,
    'current_module', v_current,
    'next_action', v_next,
    'banner', v_banner,
    'modules', v_modules
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Trainee lesson access. Writes go through these functions only.
-- ---------------------------------------------------------------------------

create or replace function app.academy_touch_progress(p_enrollment_id uuid, p_lesson_id uuid)
returns public.academy_progress
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.academy_progress;
begin
  insert into public.academy_progress (enrollment_id, lesson_id, status)
  values (p_enrollment_id, p_lesson_id, 'in_progress')
  on conflict (enrollment_id, lesson_id) do nothing;
  select * into v_row from public.academy_progress
  where enrollment_id = p_enrollment_id and lesson_id = p_lesson_id;
  if v_row.status = 'not_started' then
    update public.academy_progress set status = 'in_progress'
    where id = v_row.id
    returning * into v_row;
  end if;
  return v_row;
end;
$$;

create or replace function public.academy_record_playback(p_lesson_id uuid, p_position numeric)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_enrollment public.academy_enrollment := app.academy_primary_for_actor();
  v_row public.academy_progress;
  v_moved numeric;
  v_elapsed numeric;
  v_ranges jsonb;
  v_duration integer;
begin
  if v_enrollment.id is null or not app.academy_lesson_open(v_enrollment.id, p_lesson_id) then
    raise exception 'lesson_closed' using errcode = '42501';
  end if;
  if p_position is null or p_position < 0 then
    raise exception 'bad_position' using errcode = '22023';
  end if;

  select duration_seconds into v_duration
  from public.academy_asset a
  join public.academy_lesson l on l.video_asset_id = a.id
  where l.id = p_lesson_id;
  if v_duration is not null and p_position > v_duration then
    p_position := v_duration;
  end if;

  v_row := app.academy_touch_progress(v_enrollment.id, p_lesson_id);
  v_ranges := v_row.watched_ranges;
  if v_row.last_playback_at is null then
    if p_position > 0 and p_position <= 2 then
      v_ranges := app.academy_add_watch(v_ranges, 0, p_position);
    end if;
  else
    v_elapsed := extract(epoch from clock_timestamp() - v_row.last_playback_at);
    v_moved := p_position - v_row.playback_position_seconds;
    if v_moved > 0 and v_moved <= least(greatest(v_elapsed, 0), 15) + 1 then
      v_ranges := app.academy_add_watch(v_ranges, v_row.playback_position_seconds, v_row.playback_position_seconds + v_moved);
    end if;
  end if;

  update public.academy_progress
  set watched_ranges = v_ranges,
      watched_seconds = app.academy_watched_seconds(v_ranges),
      playback_position_seconds = p_position,
      last_playback_at = clock_timestamp(),
      time_spent_seconds = app.academy_watched_seconds(v_ranges) + reading_seconds
  where id = v_row.id;

  return jsonb_build_object(
    'watched_seconds', app.academy_watched_seconds(v_ranges),
    'position', p_position,
    'missing', to_jsonb(app.academy_completion_gaps(v_enrollment.id, p_lesson_id)),
    'complete', exists (
      select 1 from public.academy_progress pr
      join public.academy_lesson l on l.id = pr.lesson_id
      where pr.id = v_row.id and pr.status = 'completed' and pr.completed_version = l.content_version
    )
  );
end;
$$;

create or replace function public.academy_record_reading(
  p_lesson_id uuid,
  p_seconds integer,
  p_scrolled boolean
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_enrollment public.academy_enrollment := app.academy_primary_for_actor();
  v_row public.academy_progress;
  v_elapsed numeric;
  v_credit integer := 0;
begin
  if v_enrollment.id is null or not app.academy_lesson_open(v_enrollment.id, p_lesson_id) then
    raise exception 'lesson_closed' using errcode = '42501';
  end if;
  v_row := app.academy_touch_progress(v_enrollment.id, p_lesson_id);
  if v_row.last_reading_at is null then
    v_credit := least(greatest(coalesce(p_seconds, 0), 0), 5);
  else
    v_elapsed := extract(epoch from clock_timestamp() - v_row.last_reading_at);
    v_credit := least(greatest(coalesce(p_seconds, 0), 0), floor(greatest(v_elapsed, 0))::integer, 15);
  end if;

  update public.academy_progress
  set reading_seconds = reading_seconds + v_credit,
      last_reading_at = clock_timestamp(),
      scrolled_to_end = scrolled_to_end or coalesce(p_scrolled, false),
      time_spent_seconds = watched_seconds + reading_seconds + v_credit
  where id = v_row.id;

  return jsonb_build_object(
    'reading_seconds', v_row.reading_seconds + v_credit,
    'missing', to_jsonb(app.academy_completion_gaps(v_enrollment.id, p_lesson_id)),
    'complete', exists (
      select 1 from public.academy_progress pr
      join public.academy_lesson l on l.id = pr.lesson_id
      where pr.id = v_row.id and pr.status = 'completed' and pr.completed_version = l.content_version
    )
  );
end;
$$;

create or replace function public.academy_mark_lesson_complete(p_lesson_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_enrollment public.academy_enrollment := app.academy_primary_for_actor();
  v_gaps text[];
  v_lesson public.academy_lesson;
begin
  if v_enrollment.id is null or not app.academy_lesson_open(v_enrollment.id, p_lesson_id) then
    raise exception 'lesson_closed' using errcode = '42501';
  end if;
  perform app.academy_touch_progress(v_enrollment.id, p_lesson_id);
  v_gaps := app.academy_completion_gaps(v_enrollment.id, p_lesson_id);
  if coalesce(array_length(v_gaps, 1), 0) > 0 then
    return jsonb_build_object('ok', false, 'missing', to_jsonb(v_gaps));
  end if;
  select * into v_lesson from public.academy_lesson where id = p_lesson_id;
  update public.academy_progress
  set status = 'completed',
      completed_at = coalesce(completed_at, now()),
      completed_version = v_lesson.content_version
  where enrollment_id = v_enrollment.id and lesson_id = p_lesson_id;
  return jsonb_build_object('ok', true, 'missing', '[]'::jsonb);
end;
$$;

create or replace function public.academy_open_document(p_lesson_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_enrollment public.academy_enrollment := app.academy_primary_for_actor();
  v_lesson public.academy_lesson;
  v_seconds integer;
  v_token text;
begin
  if v_enrollment.id is null or not app.academy_lesson_open(v_enrollment.id, p_lesson_id) then
    raise exception 'lesson_closed' using errcode = '42501';
  end if;
  select * into v_lesson from public.academy_lesson where id = p_lesson_id;
  if v_lesson.document_asset_id is null then
    raise exception 'no_document' using errcode = 'P0002';
  end if;
  select document_link_seconds into v_seconds from public.academy_setting where id = 1;
  perform app.academy_touch_progress(v_enrollment.id, p_lesson_id);
  update public.academy_progress
  set document_opened_at = coalesce(document_opened_at, now()),
      document_asset_id = v_lesson.document_asset_id
  where enrollment_id = v_enrollment.id and lesson_id = p_lesson_id;

  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.academy_document_grant (token, profile_id, enrollment_id, lesson_id, asset_id, expires_at)
  values (
    v_token, app.acting_profile(), v_enrollment.id, p_lesson_id, v_lesson.document_asset_id,
    now() + make_interval(secs => v_seconds)
  );
  return jsonb_build_object('token', v_token, 'expires_in', v_seconds);
end;
$$;

create or replace function public.academy_claim_document(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_grant public.academy_document_grant;
  v_asset public.academy_asset;
begin
  select * into v_grant from public.academy_document_grant where token = p_token;
  if v_grant.token is null
     or v_grant.profile_id is distinct from app.acting_profile()
     or v_grant.expires_at <= now()
     or not app.academy_lesson_open(v_grant.enrollment_id, v_grant.lesson_id) then
    return jsonb_build_object('ok', false);
  end if;
  select * into v_asset from public.academy_asset where id = v_grant.asset_id;
  return jsonb_build_object(
    'ok', true,
    'storage_path', v_asset.storage_path,
    'file_name', v_asset.file_name
  );
end;
$$;

create or replace function app.academy_lesson_payload(p_enrollment_id uuid, p_lesson_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_lesson public.academy_lesson;
  v_module public.academy_module;
  v_video public.academy_asset;
  v_doc public.academy_asset;
  v_progress public.academy_progress;
  v_total integer;
  v_prev uuid;
  v_next uuid;
begin
  select * into v_lesson from public.academy_lesson where id = p_lesson_id;
  select * into v_module from public.academy_module where id = v_lesson.module_id;
  select * into v_video from public.academy_asset where id = v_lesson.video_asset_id;
  select * into v_doc from public.academy_asset where id = v_lesson.document_asset_id;
  select * into v_progress from public.academy_progress
  where enrollment_id = p_enrollment_id and lesson_id = p_lesson_id;
  select count(*) into v_total from public.academy_lesson
  where module_id = v_module.id and published and archived_at is null;
  select id into v_prev from public.academy_lesson
  where module_id = v_module.id and published and archived_at is null and sort_order < v_lesson.sort_order
  order by sort_order desc limit 1;
  select id into v_next from public.academy_lesson
  where module_id = v_module.id and published and archived_at is null and sort_order > v_lesson.sort_order
  order by sort_order limit 1;

  return jsonb_build_object(
    'id', v_lesson.id,
    'code', v_lesson.lesson_code,
    'title', v_lesson.title,
    'body', v_lesson.body,
    'position', 1 + (
      select count(*) from public.academy_lesson earlier
      where earlier.module_id = v_module.id
        and earlier.published
        and earlier.archived_at is null
        and earlier.sort_order < v_lesson.sort_order
    ),
    'total', v_total,
    'module_id', v_module.id,
    'module_title', v_module.title,
    'module_order', v_module.order_number,
    'watch_percent', v_lesson.required_watch_percent,
    'reading_seconds', app.academy_reading_seconds(v_lesson.body),
    'video', case when v_video.id is null then null else jsonb_build_object(
      'provider', v_video.provider, 'provider_id', v_video.provider_id, 'duration', v_video.duration_seconds
    ) end,
    'document', v_doc.id is not null,
    'document_name', v_doc.file_name,
    'position_seconds', coalesce(v_progress.playback_position_seconds, 0),
    'watched_seconds', coalesce(v_progress.watched_seconds, 0),
    'reading_done', coalesce(v_progress.reading_seconds, 0),
    'scrolled', coalesce(v_progress.scrolled_to_end, false),
    'document_opened', v_progress.document_opened_at is not null
      and v_progress.document_asset_id is not distinct from v_lesson.document_asset_id,
    'missing', to_jsonb(app.academy_completion_gaps(p_enrollment_id, p_lesson_id)),
    'complete', v_progress.status = 'completed' and v_progress.completed_version = v_lesson.content_version,
    'prev_id', v_prev,
    'next_id', v_next,
    'next_open', v_next is not null and app.academy_lesson_open(p_enrollment_id, v_next)
  );
end;
$$;

create or replace function public.academy_lesson_page(p_lesson_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_enrollment public.academy_enrollment := app.academy_primary_for_actor();
begin
  if v_enrollment.id is null or not app.academy_content_open(v_enrollment.id) then
    return jsonb_build_object('state', coalesce(app.academy_screen(app.acting_profile()), 'no_access'));
  end if;
  if not app.academy_lesson_open(v_enrollment.id, p_lesson_id) then
    return jsonb_build_object('state', 'locked');
  end if;
  return jsonb_build_object('state', 'ok') || app.academy_lesson_payload(v_enrollment.id, p_lesson_id);
end;
$$;

create or replace function public.academy_module_lessons(p_module_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_enrollment public.academy_enrollment := app.academy_primary_for_actor();
  v_display text;
begin
  if v_enrollment.id is null or not app.academy_content_open(v_enrollment.id) then
    return '[]'::jsonb;
  end if;
  v_display := app.academy_module_display(v_enrollment.id, p_module_id);
  if v_display in ('locked', 'unpublished') then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', l.id,
      'code', l.lesson_code,
      'title', l.title,
      'position', 1 + (
        select count(*) from public.academy_lesson earlier
        where earlier.module_id = l.module_id
          and earlier.published
          and earlier.archived_at is null
          and earlier.sort_order < l.sort_order
      ),
      'open', app.academy_lesson_open(v_enrollment.id, l.id),
      'complete', exists (
        select 1 from public.academy_progress pr
        where pr.enrollment_id = v_enrollment.id
          and pr.lesson_id = l.id
          and pr.status = 'completed'
          and pr.completed_version = l.content_version
      )
    ) order by l.sort_order)
    from public.academy_lesson l
    where l.module_id = p_module_id and l.published and l.archived_at is null
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.academy_record_playback(uuid, numeric) from public, anon;
revoke all on function public.academy_record_reading(uuid, integer, boolean) from public, anon;
revoke all on function public.academy_mark_lesson_complete(uuid) from public, anon;
revoke all on function public.academy_open_document(uuid) from public, anon;
revoke all on function public.academy_claim_document(text) from public, anon;
revoke all on function public.academy_lesson_page(uuid) from public, anon;
revoke all on function public.academy_module_lessons(uuid) from public, anon;
grant execute on function public.academy_record_playback(uuid, numeric) to authenticated;
grant execute on function public.academy_record_reading(uuid, integer, boolean) to authenticated;
grant execute on function public.academy_mark_lesson_complete(uuid) to authenticated;
grant execute on function public.academy_open_document(uuid) to authenticated;
grant execute on function public.academy_claim_document(text) to authenticated;
grant execute on function public.academy_lesson_page(uuid) to authenticated;
grant execute on function public.academy_module_lessons(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Academy admin content loader
-- ---------------------------------------------------------------------------

create or replace function public.academy_can_manage()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.academy_manages();
$$;

create or replace function app.academy_require_manage()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app.academy_manages() then
    raise exception 'permission_denied: Academy admin only' using errcode = '42501';
  end if;
end;
$$;

create or replace function app.academy_code_matches(p_module_id uuid, p_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.academy_module m
    where m.id = p_module_id
      and p_code ~ '^M[0-9]{2}-L[0-9]{2}$'
      and substring(p_code from 2 for 2)::integer = m.order_number
  );
$$;

create or replace function app.academy_snapshot_lesson(p_lesson_id uuid, p_policy text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v public.academy_lesson;
begin
  select * into v from public.academy_lesson where id = p_lesson_id;
  insert into public.academy_lesson_version (
    lesson_id, version, title, body, required_watch_percent, video_asset_id, document_asset_id, status, completion_policy, created_by
  ) values (
    v.id, v.content_version, v.title, v.body, v.required_watch_percent, v.video_asset_id, v.document_asset_id, v.status, p_policy, auth.uid()
  )
  on conflict (lesson_id, version) do update
    set title = excluded.title,
        body = excluded.body,
        required_watch_percent = excluded.required_watch_percent,
        video_asset_id = excluded.video_asset_id,
        document_asset_id = excluded.document_asset_id,
        status = excluded.status,
        completion_policy = coalesce(excluded.completion_policy, public.academy_lesson_version.completion_policy),
        created_by = excluded.created_by;
end;
$$;

create or replace function public.academy_save_lesson(p_payload jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_payload ->> 'id', '')::uuid;
  v_module uuid := (p_payload ->> 'module_id')::uuid;
  v_code text := upper(btrim(p_payload ->> 'lesson_code'));
  v_title text := btrim(p_payload ->> 'title');
  v_body text := coalesce(p_payload ->> 'body', '');
  v_order integer := coalesce((p_payload ->> 'sort_order')::integer, 1);
  v_watch_given boolean := nullif(p_payload ->> 'required_watch_percent', '') is not null;
  v_watch integer := coalesce(nullif(p_payload ->> 'required_watch_percent', '')::integer, (select default_watch_percent from public.academy_setting where id = 1));
  v_status text := lower(coalesce(p_payload ->> 'status', 'draft'));
  v_policy text := nullif(p_payload ->> 'completion_policy', '');
  v_old public.academy_lesson;
  v_video jsonb := p_payload -> 'video';
  v_doc jsonb := p_payload -> 'document';
  v_content_changed boolean := false;
  v_completed integer := 0;
  v_video_id uuid;
  v_doc_id uuid;
  v_asset uuid;
  v_version integer;
  v_is_new boolean := false;
  v_effective_title text;
begin
  perform app.academy_require_manage();
  if v_status not in ('draft', 'ready', 'live') then
    raise exception 'bad_status' using errcode = '22023';
  end if;
  if v_watch is null or v_watch < 1 or v_watch > 100 then
    raise exception 'bad_watch_percent' using errcode = '22023';
  end if;
  if not app.academy_code_matches(v_module, v_code) then
    raise exception 'bad_lesson_id: % does not match its module', v_code using errcode = '22023';
  end if;
  if exists (
    select 1 from public.academy_lesson
    where lesson_code = v_code and archived_at is null and id is distinct from v_id
  ) then
    raise exception 'duplicate_lesson_id: % is already used', v_code using errcode = '23505';
  end if;

  if v_id is null then
    insert into public.academy_lesson (module_id, lesson_code, sort_order, title, body, required_watch_percent, status, content_version)
    values (v_module, v_code, v_order, coalesce(nullif(v_title, ''), 'Untitled'), v_body, v_watch, 'draft', 1)
    returning id into v_id;
    v_is_new := true;
    perform app.audit('academy.lesson_created', 'academy_lesson', v_id::text, 'Created ' || v_code, null,
      jsonb_build_object('lesson_code', v_code, 'title', v_title));
  end if;

  select * into v_old from public.academy_lesson where id = v_id;
  if not v_watch_given then
    v_watch := v_old.required_watch_percent;
  end if;
  v_video_id := v_old.video_asset_id;
  v_doc_id := v_old.document_asset_id;

  if coalesce(p_payload ->> 'clear_video', '') = 'true' and v_old.video_asset_id is not null then
    v_content_changed := true;
    v_video_id := null;
  elsif v_video is not null and jsonb_typeof(v_video) = 'object' then
    if coalesce(v_video ->> 'provider', '') not in ('vimeo', 'mux')
       or coalesce(v_video ->> 'provider_id', '') !~ '^[A-Za-z0-9_-]{6,128}$' then
      raise exception 'bad_video' using errcode = '22023';
    end if;
    if v_old.video_asset_id is null
       or (select provider_id from public.academy_asset where id = v_old.video_asset_id) is distinct from (v_video ->> 'provider_id')
       or (select duration_seconds from public.academy_asset where id = v_old.video_asset_id) is distinct from nullif(v_video ->> 'duration_seconds', '')::integer then
      v_content_changed := true;
      insert into public.academy_asset (lesson_id, asset_type, provider, provider_id, video_url, duration_seconds, status, version, uploaded_by)
      values (
        v_id, 'video', v_video ->> 'provider', v_video ->> 'provider_id', nullif(v_video ->> 'url', ''),
        nullif(v_video ->> 'duration_seconds', '')::integer, 'live',
        coalesce((select version + 1 from public.academy_asset where id = v_old.video_asset_id), 1),
        auth.uid()
      )
      returning id into v_asset;
      if v_old.video_asset_id is not null then
        update public.academy_asset set superseded_by = v_asset where id = v_old.video_asset_id;
        perform app.audit('academy.video_replaced', 'academy_asset', v_asset::text, 'Replaced the video on ' || v_code);
      end if;
      v_video_id := v_asset;
    end if;
  end if;

  if v_doc is not null and jsonb_typeof(v_doc) = 'object' and nullif(v_doc ->> 'storage_path', '') is not null then
    if v_old.document_asset_id is null
       or (select storage_path from public.academy_asset where id = v_old.document_asset_id) is distinct from (v_doc ->> 'storage_path') then
      v_content_changed := true;
      insert into public.academy_asset (lesson_id, asset_type, provider, storage_path, file_name, status, version, uploaded_by)
      values (
        v_id, 'document', 'file', v_doc ->> 'storage_path', nullif(v_doc ->> 'file_name', ''), 'live',
        coalesce((select version + 1 from public.academy_asset where id = v_old.document_asset_id), 1),
        auth.uid()
      )
      returning id into v_asset;
      if v_old.document_asset_id is not null then
        update public.academy_asset set superseded_by = v_asset where id = v_old.document_asset_id;
        perform app.audit('academy.document_replaced', 'academy_asset', v_asset::text, 'Replaced the document on ' || v_code, null,
          jsonb_build_object('file_name', v_doc ->> 'file_name'));
      else
        perform app.audit('academy.document_uploaded', 'academy_asset', v_asset::text, 'Uploaded the document on ' || v_code, null,
          jsonb_build_object('file_name', v_doc ->> 'file_name'));
      end if;
      v_doc_id := v_asset;
    end if;
  end if;

  if v_body is distinct from v_old.body then
    v_content_changed := true;
  end if;

  v_effective_title := coalesce(nullif(v_title, ''), v_old.title, '');
  if v_status = 'live' then
    if nullif(btrim(v_title), '') is null or (btrim(v_body) = '' and v_video_id is null) then
      raise exception 'live_incomplete: a live lesson needs a title and a video or a written lesson' using errcode = '23514';
    end if;
    if v_video_id is not null and (select duration_seconds from public.academy_asset where id = v_video_id) is null then
      raise exception 'live_incomplete: enter the video duration before it goes live' using errcode = '23514';
    end if;
  end if;

  select count(*) into v_completed
  from public.academy_progress
  where lesson_id = v_id and status = 'completed';

  if v_content_changed and v_completed > 0 and (v_old.status = 'live' or v_status = 'live') and v_policy is null then
    raise exception 'review_choice_required: choose whether completed trainees keep this lesson or review it again' using errcode = 'P0001';
  end if;
  if v_policy is not null and v_policy not in ('keep', 'review') then
    raise exception 'bad_completion_policy' using errcode = '22023';
  end if;

  if v_content_changed and not v_is_new then
    perform app.academy_snapshot_lesson(v_id, null);
    v_version := v_old.content_version + 1;
  else
    v_version := v_old.content_version;
  end if;

  update public.academy_lesson
  set module_id = v_module,
      lesson_code = v_code,
      sort_order = v_order,
      title = v_effective_title,
      body = v_body,
      required_watch_percent = v_watch,
      status = v_status,
      video_asset_id = v_video_id,
      document_asset_id = v_doc_id,
      content_version = v_version
  where id = v_id;

  perform app.academy_snapshot_lesson(v_id, case when v_content_changed then v_policy else null end);

  if v_content_changed and v_policy = 'review' then
    update public.academy_progress
    set status = 'in_progress', completed_at = null, completed_version = null
    where lesson_id = v_id and status = 'completed';
  elsif v_content_changed and v_policy = 'keep' then
    update public.academy_progress
    set completed_version = v_version
    where lesson_id = v_id and status = 'completed';
  end if;

  if not v_is_new then
    perform app.audit(
      case
        when v_old.status is distinct from v_status and v_status = 'live' then 'academy.lesson_published'
        when v_old.status = 'live' and v_status is distinct from 'live' then 'academy.lesson_unpublished'
        else 'academy.lesson_edited'
      end,
      'academy_lesson', v_id::text,
      'Updated ' || v_code,
      jsonb_build_object('status', v_old.status, 'version', v_old.content_version),
      jsonb_build_object('status', v_status, 'version', v_version, 'completion_policy', v_policy)
    );
  end if;

  return jsonb_build_object('id', v_id, 'version', v_version);
end;
$$;

create or replace function public.academy_archive_lesson(p_lesson_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  perform app.academy_require_manage();
  update public.academy_lesson
  set archived_at = coalesce(archived_at, now())
  where id = p_lesson_id
  returning lesson_code into v_code;
  if v_code is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  perform app.audit('academy.lesson_archived', 'academy_lesson', p_lesson_id::text, 'Archived ' || v_code);
end;
$$;

create or replace function public.academy_reorder_lesson(p_lesson_id uuid, p_direction text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v public.academy_lesson;
  v_other public.academy_lesson;
begin
  perform app.academy_require_manage();
  select * into v from public.academy_lesson where id = p_lesson_id and archived_at is null;
  if v.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select * into v_other from public.academy_lesson
  where module_id = v.module_id
    and archived_at is null
    and (
      (p_direction = 'up' and sort_order < v.sort_order)
      or (p_direction = 'down' and sort_order > v.sort_order)
    )
  order by case when p_direction = 'up' then sort_order end desc,
           case when p_direction = 'down' then sort_order end asc
  limit 1;
  if v_other.id is null then
    return;
  end if;
  update public.academy_lesson set sort_order = v_other.sort_order where id = v.id;
  update public.academy_lesson set sort_order = v.sort_order where id = v_other.id;
  perform app.audit('academy.lesson_edited', 'academy_lesson', v.id::text, 'Reordered ' || v.lesson_code);
end;
$$;

create or replace function public.academy_save_settings(
  p_watch integer,
  p_words_per_minute integer,
  p_min_seconds integer,
  p_link_seconds integer
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_old public.academy_setting;
begin
  perform app.academy_require_manage();
  select * into v_old from public.academy_setting where id = 1;
  update public.academy_setting
  set default_watch_percent = p_watch,
      reading_words_per_minute = p_words_per_minute,
      min_reading_seconds = p_min_seconds,
      document_link_seconds = p_link_seconds,
      updated_at = now(),
      updated_by = auth.uid()
  where id = 1;
  perform app.audit('academy.learner_settings', 'academy_setting', '1', 'Changed learner settings',
    to_jsonb(v_old) - 'updated_at' - 'updated_by',
    jsonb_build_object('default_watch_percent', p_watch, 'reading_words_per_minute', p_words_per_minute, 'min_reading_seconds', p_min_seconds, 'document_link_seconds', p_link_seconds));
end;
$$;

create or replace function public.academy_override_progress(
  p_enrollment_id uuid,
  p_lesson_id uuid,
  p_status text,
  p_reason text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_version integer;
begin
  perform app.academy_require_manage();
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  if p_status not in ('not_started', 'in_progress', 'completed') then
    raise exception 'bad_status' using errcode = '22023';
  end if;
  select content_version into v_version from public.academy_lesson where id = p_lesson_id;
  insert into public.academy_progress (enrollment_id, lesson_id, status)
  values (p_enrollment_id, p_lesson_id, 'not_started')
  on conflict (enrollment_id, lesson_id) do nothing;
  update public.academy_progress
  set status = p_status,
      completed_at = case when p_status = 'completed' then coalesce(completed_at, now()) else null end,
      completed_version = case when p_status = 'completed' then v_version else null end
  where enrollment_id = p_enrollment_id and lesson_id = p_lesson_id;
  perform app.audit('academy.progress_override', 'academy_progress', p_lesson_id::text,
    'Overrode lesson progress', null,
    jsonb_build_object('enrollment_id', p_enrollment_id, 'status', p_status, 'reason', btrim(p_reason)),
    null, (select profile_id from public.academy_enrollment where id = p_enrollment_id));
end;
$$;

create or replace function public.academy_apply_import(p_file_name text, p_rows jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row jsonb;
  v_existing uuid;
  v_result jsonb;
  v_created integer := 0;
  v_updated integer := 0;
  v_skipped integer := 0;
  v_detail jsonb := '[]'::jsonb;
  v_id uuid;
  v_payload jsonb;
  v_message text;
begin
  perform app.academy_require_manage();
  if nullif(btrim(coalesce(p_file_name, '')), '') is null then
    raise exception 'file_name_required' using errcode = '22023';
  end if;
  for v_row in select value from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
  loop
    begin
      select id into v_existing from public.academy_lesson
      where lesson_code = upper(v_row ->> 'lesson_code') and archived_at is null;
      v_payload := v_row || jsonb_build_object('id', v_existing);
      v_result := public.academy_save_lesson(v_payload);
      if v_existing is null then
        v_created := v_created + 1;
        v_detail := v_detail || jsonb_build_array(jsonb_build_object('lesson_id', v_row ->> 'lesson_code', 'action', 'create'));
      else
        v_updated := v_updated + 1;
        v_detail := v_detail || jsonb_build_array(jsonb_build_object('lesson_id', v_row ->> 'lesson_code', 'action', 'update'));
      end if;
    exception when others then
      v_skipped := v_skipped + 1;
      v_message := regexp_replace(sqlerrm, '^[a-z_]+: ', '');
      v_detail := v_detail || jsonb_build_array(jsonb_build_object(
        'lesson_id', coalesce(v_row ->> 'lesson_code', ''),
        'action', 'skip',
        'message', v_message
      ));
    end;
  end loop;

  insert into public.academy_import (actor_id, file_name, created_count, updated_count, skipped_count, detail)
  values (auth.uid(), p_file_name, v_created, v_updated, v_skipped, v_detail)
  returning id into v_id;
  perform app.audit('academy.import', 'academy_import', v_id::text,
    format('Imported %s', p_file_name), null,
    jsonb_build_object('file_name', p_file_name, 'created', v_created, 'updated', v_updated, 'skipped', v_skipped));
  return jsonb_build_object('id', v_id, 'created', v_created, 'updated', v_updated, 'skipped', v_skipped, 'detail', v_detail);
end;
$$;

create or replace function public.academy_admin_catalog()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app.academy_require_manage();
  return jsonb_build_object(
    'settings', (select to_jsonb(s) - 'updated_by' from public.academy_setting s where s.id = 1),
    'modules', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id,
        'program', p.name,
        'program_id', p.id,
        'order', m.order_number,
        'title', m.title,
        'lessons', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', l.id,
            'code', l.lesson_code,
            'title', l.title,
            'order', l.sort_order,
            'status', l.status,
            'version', l.content_version,
            'archived', l.archived_at is not null,
            'video', l.video_asset_id is not null,
            'document', l.document_asset_id is not null,
            'watch_percent', l.required_watch_percent
          ) order by l.archived_at nulls first, l.sort_order)
          from public.academy_lesson l
          where l.module_id = m.id
        ), '[]'::jsonb)
      ) order by p.program_type, m.order_number)
      from public.academy_module m
      join public.academy_program p on p.id = m.program_id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.academy_admin_lesson(p_lesson_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.academy_lesson;
  v_video public.academy_asset;
  v_doc public.academy_asset;
  v_module public.academy_module;
  v_done integer;
begin
  perform app.academy_require_manage();
  select * into v from public.academy_lesson where id = p_lesson_id;
  if v.id is null then
    return jsonb_build_object('state', 'missing');
  end if;
  select * into v_module from public.academy_module where id = v.module_id;
  select * into v_video from public.academy_asset where id = v.video_asset_id;
  select * into v_doc from public.academy_asset where id = v.document_asset_id;
  select count(*) into v_done from public.academy_progress where lesson_id = v.id and status = 'completed';
  return jsonb_build_object(
    'state', 'ok',
    'id', v.id,
    'module_id', v.module_id,
    'module_title', v_module.title,
    'module_order', v_module.order_number,
    'code', v.lesson_code,
    'title', v.title,
    'body', v.body,
    'order', v.sort_order,
    'position', 1 + (
      select count(*) from public.academy_lesson earlier
      where earlier.module_id = v.module_id
        and earlier.archived_at is null
        and (earlier.published or earlier.id = v.id)
        and earlier.sort_order < v.sort_order
    ),
    'total', (
      select count(*) from public.academy_lesson earlier
      where earlier.module_id = v.module_id
        and earlier.archived_at is null
        and (earlier.published or earlier.id = v.id)
    ),
    'status', v.status,
    'version', v.content_version,
    'watch_percent', v.required_watch_percent,
    'archived', v.archived_at is not null,
    'completions', v_done,
    'reading_seconds', app.academy_reading_seconds(v.body),
    'video', case when v_video.id is null then null else jsonb_build_object(
      'provider', v_video.provider, 'provider_id', v_video.provider_id, 'url', v_video.video_url,
      'duration', v_video.duration_seconds, 'version', v_video.version
    ) end,
    'document', case when v_doc.id is null then null else jsonb_build_object(
      'file_name', v_doc.file_name, 'version', v_doc.version, 'storage_path', v_doc.storage_path
    ) end,
    'versions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'version', ver.version, 'title', ver.title, 'status', ver.status,
        'policy', ver.completion_policy, 'at', ver.created_at
      ) order by ver.version desc)
      from public.academy_lesson_version ver
      where ver.lesson_id = v.id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.academy_admin_document(p_lesson_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_path text;
  v_name text;
begin
  perform app.academy_require_manage();
  select a.storage_path, a.file_name into v_path, v_name
  from public.academy_lesson l
  join public.academy_asset a on a.id = l.document_asset_id
  where l.id = p_lesson_id;
  if v_path is null then
    return jsonb_build_object('ok', false);
  end if;
  return jsonb_build_object('ok', true, 'storage_path', v_path, 'file_name', v_name);
end;
$$;

create or replace function public.academy_export_lessons()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when app.academy_manages() then coalesce(jsonb_agg(jsonb_build_object(
    'lesson_id', l.lesson_code,
    'title', l.title,
    'order', l.sort_order,
    'video_link', case
      when a.provider = 'vimeo' then 'https://vimeo.com/' || a.provider_id
      when a.provider = 'mux' then 'https://stream.mux.com/' || a.provider_id || '.m3u8'
      else coalesce(a.video_url, '')
    end,
    'document_file', coalesce(d.file_name, ''),
    'duration', coalesce(a.duration_seconds::text, ''),
    'watch_percent', l.required_watch_percent,
    'written', l.body,
    'status', initcap(l.status)
  ) order by m.order_number, l.sort_order), '[]'::jsonb) else '[]'::jsonb end
  from public.academy_lesson l
  join public.academy_module m on m.id = l.module_id
  left join public.academy_asset a on a.id = l.video_asset_id
  left join public.academy_asset d on d.id = l.document_asset_id
  where l.archived_at is null;
$$;

alter table public.academy_setting enable row level security;
alter table public.academy_lesson_version enable row level security;
alter table public.academy_document_grant enable row level security;
alter table public.academy_import enable row level security;

create policy academy_setting_admin on public.academy_setting
  for all to authenticated using (app.academy_manages()) with check (app.academy_manages());
create policy academy_lesson_version_admin on public.academy_lesson_version
  for all to authenticated using (app.academy_manages()) with check (app.academy_manages());
create policy academy_document_grant_admin on public.academy_document_grant
  for all to authenticated using (app.academy_manages()) with check (app.academy_manages());
create policy academy_import_admin on public.academy_import
  for all to authenticated using (app.academy_manages()) with check (app.academy_manages());

revoke all on public.academy_setting from anon, authenticated;
revoke all on public.academy_lesson_version from anon, authenticated;
revoke all on public.academy_document_grant from anon, authenticated;
revoke all on public.academy_import from anon, authenticated;
grant select, insert, update, delete on public.academy_setting to authenticated;
grant select, insert, update, delete on public.academy_lesson_version to authenticated;
grant select, insert, update, delete on public.academy_document_grant to authenticated;
grant select, insert, update, delete on public.academy_import to authenticated;

revoke all on function public.academy_can_manage() from public, anon;
revoke all on function public.academy_save_lesson(jsonb) from public, anon;
revoke all on function public.academy_archive_lesson(uuid) from public, anon;
revoke all on function public.academy_reorder_lesson(uuid, text) from public, anon;
revoke all on function public.academy_save_settings(integer, integer, integer, integer) from public, anon;
revoke all on function public.academy_override_progress(uuid, uuid, text, text) from public, anon;
revoke all on function public.academy_apply_import(text, jsonb) from public, anon;
revoke all on function public.academy_admin_catalog() from public, anon;
revoke all on function public.academy_admin_lesson(uuid) from public, anon;
revoke all on function public.academy_admin_document(uuid) from public, anon;
revoke all on function public.academy_export_lessons() from public, anon;
grant execute on function public.academy_can_manage() to authenticated;
grant execute on function public.academy_save_lesson(jsonb) to authenticated;
grant execute on function public.academy_archive_lesson(uuid) to authenticated;
grant execute on function public.academy_reorder_lesson(uuid, text) to authenticated;
grant execute on function public.academy_save_settings(integer, integer, integer, integer) to authenticated;
grant execute on function public.academy_override_progress(uuid, uuid, text, text) to authenticated;
grant execute on function public.academy_apply_import(text, jsonb) to authenticated;
grant execute on function public.academy_admin_catalog() to authenticated;
grant execute on function public.academy_admin_lesson(uuid) to authenticated;
grant execute on function public.academy_admin_document(uuid) to authenticated;
grant execute on function public.academy_export_lessons() to authenticated;

-- Trainees download documents through the app, not a storage URL they can pass around.
do $drop_storage$
begin
  if to_regclass('storage.objects') is not null
     and exists (
       select 1 from pg_policies
       where schemaname = 'storage' and policyname = 'academy_documents_read'
     ) then
    execute 'drop policy academy_documents_read on storage.objects';
  end if;
end
$drop_storage$;
