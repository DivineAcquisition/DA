-- Quiz engine. Draws, scores, lockouts, and holds. Reviewer screens stay out.
-- Correct answers live in academy_attempt_key, which trainees cannot read.

alter table public.academy_quiz
  add column time_limit_seconds integer check (time_limit_seconds is null or time_limit_seconds between 60 and 14400),
  add column abandoned_minutes integer not null default 60 check (abandoned_minutes between 5 and 1440),
  add column min_seconds_per_question integer not null default 15 check (min_seconds_per_question between 0 and 600);

comment on column public.academy_quiz.time_limit_seconds is
  'Optional countdown. Null means the attempt has no time limit.';
comment on column public.academy_quiz.abandoned_minutes is
  'An open attempt older than this is scored with blank answers marked wrong.';
comment on column public.academy_quiz.min_seconds_per_question is
  'Finished faster than this, times the question count, is flagged for admins. Trainees do not see the flag.';

alter table public.academy_question
  drop constraint if exists academy_question_difficulty_check;
alter table public.academy_question
  add constraint academy_question_difficulty_check
  check (difficulty in ('foundation', 'standard', 'advanced', 'easy', 'medium', 'hard'));
alter table public.academy_question
  add column scenario text,
  add column concept_id uuid;

create table public.academy_concept (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.academy_module (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  lesson_id uuid references public.academy_lesson (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (module_id, name)
);

alter table public.academy_question
  add constraint academy_question_concept_fk
  foreign key (concept_id) references public.academy_concept (id) on delete set null;

comment on table public.academy_concept is
  'Managed concept tags for one module. The fail screen links the tag to its lesson.';

create table public.academy_gate_part (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.academy_module (id) on delete cascade,
  part_key text not null check (part_key ~ '^[a-z0-9_]+$'),
  label text not null,
  sort_order integer not null default 1,
  unique (module_id, part_key)
);

comment on table public.academy_gate_part is
  'One piece of a module gate. The quiz part is scored here. Other parts stay pending until a later prompt, or an admin marks them with a note.';

create table public.academy_gate_progress (
  enrollment_id uuid not null references public.academy_enrollment (id) on delete cascade,
  gate_part_id uuid not null references public.academy_gate_part (id) on delete cascade,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'satisfied')),
  note text,
  satisfied_by uuid references public.profile (id),
  satisfied_at timestamptz,
  primary key (enrollment_id, gate_part_id)
);

create table public.academy_quiz_allowance (
  enrollment_id uuid not null references public.academy_enrollment (id) on delete cascade,
  quiz_id uuid not null references public.academy_quiz (id) on delete cascade,
  extra_attempts integer not null default 0 check (extra_attempts >= 0),
  primary key (enrollment_id, quiz_id)
);

comment on table public.academy_quiz_allowance is
  'Extra attempts granted after a hold reset. The reset screen is a later prompt. Allowed attempts are the quiz maximum plus this number.';

alter table public.academy_attempt
  add column rules jsonb not null default '{}'::jsonb,
  add column device_type text check (device_type is null or device_type in ('phone', 'tablet', 'desktop')),
  add column abandoned boolean not null default false,
  add column lockout_until timestamptz,
  add column reopen_lesson_ids uuid[] not null default '{}';

alter table public.academy_progress
  add column last_opened_at timestamptz;

alter table public.academy_hold
  add column concept_summary text;

create table public.academy_attempt_key (
  attempt_id uuid primary key references public.academy_attempt (id) on delete cascade,
  questions jsonb not null
);

comment on table public.academy_attempt_key is
  'Question text, option order, correct option, and explanation frozen at draw time. Trainees cannot read this table.';

create table public.academy_attempt_flag (
  attempt_id uuid primary key references public.academy_attempt (id) on delete cascade,
  flagged_fast boolean not null default false,
  time_taken_seconds integer not null,
  created_at timestamptz not null default now()
);

comment on table public.academy_attempt_flag is
  'Speed flag for admins and reviewers. It is not on the attempt row trainees can read.';

create table public.academy_notice (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.academy_enrollment (id) on delete cascade,
  quiz_id uuid not null references public.academy_quiz (id) on delete cascade,
  attempt_id uuid not null references public.academy_attempt (id) on delete cascade,
  kind text not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (attempt_id, kind)
);

comment on table public.academy_notice is
  'A manager should be told. Nothing is sent from this prompt.';

create table public.academy_question_import (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profile (id),
  file_name text not null,
  created_at timestamptz not null default now(),
  created_count integer not null default 0,
  skipped_count integer not null default 0,
  detail jsonb not null default '[]'::jsonb
);

create unique index academy_attempt_one_open
  on public.academy_attempt (enrollment_id)
  where finished_at is null;

insert into public.academy_gate_part (module_id, part_key, label, sort_order)
select id, 'agreement', coalesce(nullif(btrim(gate_detail), ''), 'Agreement'), 1
from public.academy_module where gate_type = 'agreement';

insert into public.academy_gate_part (module_id, part_key, label, sort_order)
select id, 'quiz', 'Quiz', 1
from public.academy_module where gate_type in ('quiz', 'quiz_practical', 'quiz_simulation');

insert into public.academy_gate_part (module_id, part_key, label, sort_order)
select id, 'practical', coalesce(nullif(btrim(gate_detail), ''), 'Additional requirement'), 2
from public.academy_module where gate_type = 'quiz_practical';

insert into public.academy_gate_part (module_id, part_key, label, sort_order)
select id, 'simulation', coalesce(nullif(btrim(gate_detail), ''), 'Simulation'), 2
from public.academy_module
where gate_type = 'quiz_simulation' and coalesce(gate_detail, '') not ilike '%two%';

insert into public.academy_gate_part (module_id, part_key, label, sort_order)
select id, 'simulation', 'Simulation 1', 2
from public.academy_module
where gate_type = 'quiz_simulation' and coalesce(gate_detail, '') ilike '%two%';

insert into public.academy_gate_part (module_id, part_key, label, sort_order)
select id, 'simulation_2', 'Simulation 2', 3
from public.academy_module
where gate_type = 'quiz_simulation' and coalesce(gate_detail, '') ilike '%two%';

insert into public.academy_gate_part (module_id, part_key, label, sort_order)
select id, 'sign_off', coalesce(nullif(btrim(gate_detail), ''), 'Sign-off'), 1
from public.academy_module where gate_type = 'sign_off';

-- ---------------------------------------------------------------------------
-- Gates, pool health, and what the shell shows
-- ---------------------------------------------------------------------------

create or replace function app.academy_gate_part_satisfied(
  p_enrollment_id uuid,
  p_part public.academy_gate_part
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case p_part.part_key
    when 'quiz' then app.academy_quiz_passed(p_enrollment_id, p_part.module_id)
    when 'agreement' then app.academy_agreement_signed((
      select profile_id from public.academy_enrollment where id = p_enrollment_id
    ))
    else exists (
      select 1 from public.academy_gate_progress gp
      where gp.enrollment_id = p_enrollment_id
        and gp.gate_part_id = p_part.id
        and gp.status = 'satisfied'
    )
  end;
$$;

create or replace function app.academy_module_gate_passed(p_enrollment_id uuid, p_module_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when m.gate_type = 'agreement' then app.academy_agreement_signed(e.profile_id)
      when m.gate_type = 'none' then app.academy_required_lessons_done(p_enrollment_id, p_module_id)
      when exists (select 1 from public.academy_gate_part gp where gp.module_id = m.id) then
        not exists (
          select 1 from public.academy_gate_part gp
          where gp.module_id = m.id
            and not app.academy_gate_part_satisfied(p_enrollment_id, gp)
        )
      when m.gate_type = 'quiz' then app.academy_quiz_passed(p_enrollment_id, p_module_id)
      else false
    end
    from public.academy_module m
    join public.academy_enrollment e
      on e.id = p_enrollment_id and e.program_id = m.program_id
    where m.id = p_module_id
  ), false);
$$;

create or replace function app.academy_pool_ready(p_quiz_id uuid, p_count integer default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.academy_quiz q
    where q.id = p_quiz_id
      and case
        when q.kind = 'final' then
          coalesce(p_count, q.questions_per_attempt) = (
            select coalesce(sum(d.question_count), 0) from public.academy_quiz_draw d where d.quiz_id = q.id
          )
          and not exists (
            select 1
            from public.academy_quiz_draw d
            where d.quiz_id = q.id
              and (
                select count(*) from public.academy_question qq
                where qq.module_id = d.source_module_id and qq.active
              ) < d.question_count
          )
        else (
          select count(*) from public.academy_question qq
          where qq.module_id = q.module_id and qq.active
        ) >= coalesce(p_count, q.questions_per_attempt)
      end
  );
$$;

create or replace function app.academy_quiz_servable(p_quiz_id uuid, p_count integer default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.academy_quiz q
    where q.id = p_quiz_id and q.active and app.academy_pool_ready(q.id, p_count)
  );
$$;

create or replace function app.academy_pool_message(p_quiz_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select string_agg(line, ' ' order by line)
    from (
      select format(
        'Module %s has %s active questions. This quiz needs %s.',
        m.order_number, count(qq.id), q.questions_per_attempt
      ) as line
      from public.academy_quiz q
      join public.academy_module m on m.id = q.module_id
      left join public.academy_question qq on qq.module_id = q.module_id and qq.active
      where q.id = p_quiz_id and q.kind = 'module'
      group by m.order_number, q.questions_per_attempt
      having count(qq.id) < q.questions_per_attempt
      union all
      select format(
        'Module %s has %s active questions. The Final Quiz needs %s from that module.',
        sm.order_number,
        (select count(*) from public.academy_question qq where qq.module_id = d.source_module_id and qq.active),
        d.question_count
      )
      from public.academy_quiz q
      join public.academy_quiz_draw d on d.quiz_id = q.id
      join public.academy_module sm on sm.id = d.source_module_id
      where q.id = p_quiz_id and q.kind = 'final'
        and (
          select count(*) from public.academy_question qq
          where qq.module_id = d.source_module_id and qq.active
        ) < d.question_count
    ) gaps
  ), (
    select string_agg(line, ' ' order by line)
    from (
      select format(
        'Module %s has %s active questions. Repeated attempts will repeat questions.',
        m.order_number, count(qq.id)
      ) as line
      from public.academy_quiz q
      join public.academy_module m on m.id = q.module_id
      left join public.academy_question qq on qq.module_id = q.module_id and qq.active
      where q.id = p_quiz_id and q.kind = 'module'
      group by m.order_number, q.questions_per_attempt
      having count(qq.id) >= q.questions_per_attempt and count(qq.id) < 15
      union all
      select format(
        'Module %s has %s active questions. Repeated attempts will repeat questions.',
        sm.order_number,
        (select count(*) from public.academy_question qq where qq.module_id = d.source_module_id and qq.active)
      )
      from public.academy_quiz q
      join public.academy_quiz_draw d on d.quiz_id = q.id
      join public.academy_module sm on sm.id = d.source_module_id
      where q.id = p_quiz_id and q.kind = 'final'
        and (
          select count(*) from public.academy_question qq
          where qq.module_id = d.source_module_id and qq.active
        ) between d.question_count and 14
    ) thin
  ));
$$;

create or replace function app.academy_allowed_attempts(p_enrollment_id uuid, p_quiz_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select q.max_attempts + coalesce((
    select extra_attempts from public.academy_quiz_allowance a
    where a.enrollment_id = p_enrollment_id and a.quiz_id = p_quiz_id
  ), 0)
  from public.academy_quiz q
  where q.id = p_quiz_id;
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
    when exists (
      select 1 from public.academy_lesson l
      where l.module_id = p_module_id and l.published and l.archived_at is null
    ) and not app.academy_lessons_complete(p_enrollment_id, p_module_id) then
      case
        when exists (
          select 1 from public.academy_progress pr
          join public.academy_lesson l on l.id = pr.lesson_id
          where pr.enrollment_id = p_enrollment_id
            and l.module_id = p_module_id
            and pr.status in ('in_progress', 'completed')
        ) or exists (
          select 1 from public.academy_attempt a
          join public.academy_quiz q on q.id = a.quiz_id
          where a.enrollment_id = p_enrollment_id and q.module_id = p_module_id
        ) then 'in_progress'
        else 'available'
      end
    when not exists (
      select 1 from public.academy_lesson l
      where l.module_id = p_module_id and l.published and l.archived_at is null
    ) and not exists (
      select 1 from public.academy_quiz q
      where q.module_id = p_module_id and q.kind = 'final'
    ) then 'unpublished'
    when app.academy_module_gate_passed(p_enrollment_id, p_module_id) then 'complete'
    when app.academy_quiz_passed(p_enrollment_id, p_module_id) then 'quiz_passed_pending'
    when exists (
      select 1 from public.academy_quiz q
      where q.module_id = p_module_id and app.academy_quiz_servable(q.id)
    ) then 'quiz_available'
    else 'lessons_complete'
  end;
$$;

create or replace function app.academy_quiz_card(p_enrollment_id uuid, p_module_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_quiz public.academy_quiz;
  v_used integer;
  v_allowed integer;
  v_open uuid;
  v_passed_at timestamptz;
  v_high numeric;
  v_last public.academy_attempt;
  v_status text;
  v_reopen jsonb := '[]'::jsonb;
begin
  select * into v_quiz from public.academy_quiz where module_id = p_module_id;
  if v_quiz.id is null then
    return null;
  end if;
  select count(*) into v_used from public.academy_attempt
  where enrollment_id = p_enrollment_id and quiz_id = v_quiz.id;
  v_allowed := coalesce(app.academy_allowed_attempts(p_enrollment_id, v_quiz.id), v_quiz.max_attempts);
  select id into v_open from public.academy_attempt
  where enrollment_id = p_enrollment_id and quiz_id = v_quiz.id and finished_at is null;
  select max(score) into v_high from public.academy_attempt
  where enrollment_id = p_enrollment_id and quiz_id = v_quiz.id and finished_at is not null;
  select finished_at into v_passed_at from public.academy_attempt
  where enrollment_id = p_enrollment_id and quiz_id = v_quiz.id and passed is true
  order by finished_at desc limit 1;
  select * into v_last from public.academy_attempt
  where enrollment_id = p_enrollment_id and quiz_id = v_quiz.id and finished_at is not null and passed is not true
  order by finished_at desc limit 1;

  if exists (
    select 1 from public.academy_enrollment e
    where e.id = p_enrollment_id and e.status = 'on_hold_review'
  ) then
    v_status := 'on_hold';
  elsif v_passed_at is not null then
    v_status := 'passed';
  elsif v_open is not null then
    v_status := 'in_progress';
  elsif not app.academy_lessons_complete(p_enrollment_id, p_module_id)
        and exists (
          select 1 from public.academy_lesson l
          where l.module_id = p_module_id and l.published and l.archived_at is null
        ) then
    v_status := 'not_available';
  elsif not app.academy_quiz_servable(v_quiz.id) then
    v_status := 'not_available';
  elsif v_last.id is not null and (
    v_last.lockout_until > now()
    or exists (
      select 1 from unnest(v_last.reopen_lesson_ids) lid
      where not exists (
        select 1 from public.academy_progress pr
        where pr.enrollment_id = p_enrollment_id and pr.lesson_id = lid
          and pr.last_opened_at > v_last.finished_at
      )
    )
  ) then
    v_status := 'locked';
  elsif v_used >= v_allowed then
    v_status := 'locked';
  else
    v_status := 'available';
  end if;

  if v_last.id is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', l.id, 'title', l.title, 'code', l.lesson_code
    ) order by l.sort_order), '[]'::jsonb) into v_reopen
    from unnest(v_last.reopen_lesson_ids) lid
    join public.academy_lesson l on l.id = lid
    where not exists (
      select 1 from public.academy_progress pr
      where pr.enrollment_id = p_enrollment_id and pr.lesson_id = l.id
        and pr.last_opened_at > v_last.finished_at
    );
  end if;

  return jsonb_build_object(
    'quiz_id', v_quiz.id,
    'kind', v_quiz.kind,
    'status', v_status,
    'attempts_used', v_used,
    'attempts_allowed', v_allowed,
    'attempts_remaining', greatest(v_allowed - v_used, 0),
    'lockout_until', v_last.lockout_until,
    'highest_score', v_high,
    'question_count', v_quiz.questions_per_attempt,
    'pass_mark', v_quiz.pass_mark,
    'pass_mark_unit', v_quiz.pass_mark_unit,
    'passed_at', v_passed_at,
    'open_attempt_id', v_open,
    'reopen', v_reopen
  );
end;
$$;

create or replace function app.academy_gate_cards(p_enrollment_id uuid, p_module_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', gp.id,
    'key', gp.part_key,
    'label', gp.label,
    'status', case when app.academy_gate_part_satisfied(p_enrollment_id, gp) then 'satisfied' else 'pending' end
  ) order by gp.sort_order), '[]'::jsonb)
  from public.academy_gate_part gp
  where gp.module_id = p_module_id;
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
  v_card jsonb;
begin
  select program_id into v_program from public.academy_enrollment where id = p_enrollment_id;
  for v_mod in
    select * from public.academy_module where program_id = v_program order by order_number
  loop
    v_display := app.academy_module_display(p_enrollment_id, v_mod.id);
    if v_display = 'locked' then
      exit;
    elsif v_display = 'unpublished' then
      if not app.academy_module_gate_passed(p_enrollment_id, v_mod.id) then
        return jsonb_build_object('title', 'Not yet published', 'detail', v_mod.title || ' has no lessons yet.', 'href', null);
      end if;
    elsif v_display = 'quiz_passed_pending' then
      return jsonb_build_object(
        'title', 'Quiz passed, additional requirement pending',
        'detail', v_mod.title,
        'href', '/academy/modules/' || v_mod.id
      );
    elsif v_display = 'quiz_available' then
      v_card := app.academy_quiz_card(p_enrollment_id, v_mod.id);
      if v_card ->> 'kind' = 'final' then
        return jsonb_build_object(
          'title', case v_card ->> 'status'
            when 'locked' then 'The Final Quiz is locked'
            when 'in_progress' then 'Continue the Final Quiz'
            else 'Take the Final Quiz'
          end,
          'detail', v_mod.title,
          'href', '/academy/modules/' || v_mod.id || '/quiz'
        );
      elsif v_card ->> 'status' = 'locked' then
        return jsonb_build_object(
          'title', format('Module %s quiz is locked', v_mod.order_number),
          'detail', v_mod.title,
          'href', '/academy/modules/' || v_mod.id || '/quiz'
        );
      elsif v_card ->> 'status' = 'in_progress' then
        return jsonb_build_object(
          'title', format('Continue the Module %s quiz', v_mod.order_number),
          'detail', v_mod.title,
          'href', '/academy/modules/' || v_mod.id || '/quiz'
        );
      else
        return jsonb_build_object(
          'title', format('Take the Module %s quiz', v_mod.order_number),
          'detail', v_mod.title,
          'href', '/academy/modules/' || v_mod.id || '/quiz'
        );
      end if;
    elsif v_display = 'lessons_complete' then
      return jsonb_build_object(
        'title', 'Lessons complete, quiz not yet available',
        'detail', v_mod.title,
        'href', '/academy/modules/' || v_mod.id
      );
    elsif v_display in ('available', 'in_progress') then
      select * into v_lesson from public.academy_lesson l
      where l.module_id = v_mod.id and l.published and l.archived_at is null
        and not exists (
          select 1 from public.academy_progress pr
          where pr.enrollment_id = p_enrollment_id and pr.lesson_id = l.id
            and pr.status = 'completed' and pr.completed_version = l.content_version
        )
      order by l.sort_order limit 1;
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
      select 1 + count(*) into v_pos from public.academy_lesson earlier
      where earlier.module_id = v_mod.id and earlier.published and earlier.archived_at is null
        and earlier.sort_order < v_lesson.sort_order;
      return jsonb_build_object(
        'title', format('%s Module %s, Lesson %s', case when v_started then 'Continue' else 'Start' end, v_mod.order_number, v_pos),
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
      v_openable := v_display in (
        'available', 'in_progress', 'complete', 'lessons_complete', 'quiz_available', 'quiz_passed_pending'
      );
      if v_current is null and v_display in (
        'available', 'in_progress', 'unpublished', 'lessons_complete', 'quiz_available', 'quiz_passed_pending'
      ) then
        v_current := jsonb_build_object('id', v_mod.id, 'order', v_mod.order_number, 'title', v_mod.title);
      end if;
      v_modules := v_modules || jsonb_build_array(jsonb_build_object(
        'id', v_mod.id, 'order', v_mod.order_number, 'title', v_mod.title, 'description', v_mod.description,
        'required', v_mod.required, 'gate_type', v_mod.gate_type, 'gate_detail', v_mod.gate_detail,
        'display', v_display, 'openable', v_openable,
        'quiz', app.academy_quiz_card(v_enrollment.id, v_mod.id),
        'gates', app.academy_gate_cards(v_enrollment.id, v_mod.id)
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
-- Draws and scoring. The answer key never sits on a row trainees can select.
-- ---------------------------------------------------------------------------

create or replace function app.academy_permute(p_items jsonb)
returns jsonb
language sql
volatile
set search_path = ''
as $$
  select coalesce(jsonb_agg(value order by random()), '[]'::jsonb)
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb));
$$;

create or replace function app.academy_pick_questions(
  p_module_id uuid,
  p_count integer,
  p_seen uuid[],
  p_shuffle boolean
)
returns uuid[]
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
begin
  with pool as (
    select id, (id = any(coalesce(p_seen, '{}'))) as seen
    from public.academy_question
    where module_id = p_module_id and active
  ),
  unseen as (
    select id from pool where not seen order by random() limit p_count
  ),
  filler as (
    select id from pool where seen order by random()
    limit greatest(p_count - (select count(*) from unseen), 0)
  ),
  chosen as (
    select id, 1 as grp, row_number() over (order by id) as n from unseen
    union all
    select id, 2, row_number() over (order by id) from filler
  )
  select coalesce(array_agg(id order by case when p_shuffle then random() else grp::float end, n), '{}')
  into v_ids
  from chosen;
  return v_ids;
end;
$$;

create or replace function app.academy_pass_label(p_mark numeric, p_unit text, p_count integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_unit = 'percent'
    then trim(to_char(p_mark, 'FM999')) || '%'
    else trim(to_char(p_mark, 'FM999')) || ' of ' || p_count::text
  end;
$$;

create or replace function app.academy_score_attempt(p_attempt_id uuid, p_abandoned boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v public.academy_attempt;
  v_key jsonb;
  v_q jsonb;
  v_selected text;
  v_correct integer := 0;
  v_total integer := 0;
  v_passed boolean;
  v_mark numeric;
  v_unit text;
  v_count integer;
  v_seconds integer;
  v_min integer;
  v_allowed integer;
  v_extra integer;
  v_quiz public.academy_quiz;
  v_lessons uuid[] := '{}';
  v_summary text;
begin
  select * into v from public.academy_attempt where id = p_attempt_id for update;
  if v.id is null or v.finished_at is not null then
    return;
  end if;
  select questions into v_key from public.academy_attempt_key where attempt_id = v.id;
  v_mark := coalesce((v.rules ->> 'pass_mark')::numeric, 0);
  v_unit := coalesce(v.rules ->> 'pass_mark_unit', 'correct');
  v_count := coalesce((v.rules ->> 'questions_per_attempt')::integer, 1);
  v_min := coalesce((v.rules ->> 'min_seconds_per_question')::integer, 0);

  for v_q in select value from jsonb_array_elements(coalesce(v_key, '[]'::jsonb))
  loop
    v_total := v_total + 1;
    select item ->> 'option_id' into v_selected
    from jsonb_array_elements(coalesce(v.answers, '[]'::jsonb)) item
    where item ->> 'question_id' = v_q ->> 'id'
    limit 1;
    if v_selected is not null and v_selected = v_q ->> 'correct_id' then
      v_correct := v_correct + 1;
    end if;
  end loop;

  select * into v_quiz from public.academy_quiz where id = v.quiz_id;
  if v_unit = 'percent' then
    v_passed := v_total > 0 and (v_correct::numeric / v_total * 100) >= v_mark;
  else
    v_passed := v_correct >= v_mark;
  end if;
  v_seconds := greatest(floor(extract(epoch from clock_timestamp() - v.started_at))::integer, 0);

  if v_quiz.kind = 'final' then
    select coalesce(array_agg(distinct l.id), '{}') into v_lessons
    from (
      select (item ->> 'module_id')::uuid as module_id,
        count(*) filter (
          where exists (
            select 1 from jsonb_array_elements(coalesce(v.answers, '[]'::jsonb)) ans
            where ans ->> 'question_id' = item ->> 'id' and ans ->> 'option_id' = item ->> 'correct_id'
          )
        ) as correct,
        count(*) as total
      from jsonb_array_elements(coalesce(v_key, '[]'::jsonb)) item
      group by 1
    ) scored
    join public.academy_lesson l on l.module_id = scored.module_id and l.published and l.archived_at is null
    where scored.total > 0 and (
      (v_unit = 'percent' and (scored.correct::numeric / scored.total * 100) < v_mark)
      or (v_unit <> 'percent' and scored.correct < v_mark)
    );
  else
    select coalesce(array_agg(distinct (item ->> 'lesson_id')::uuid), '{}') into v_lessons
    from jsonb_array_elements(coalesce(v_key, '[]'::jsonb)) item
    where item ->> 'lesson_id' is not null
      and not exists (
        select 1 from jsonb_array_elements(coalesce(v.answers, '[]'::jsonb)) ans
        where ans ->> 'question_id' = item ->> 'id' and ans ->> 'option_id' = item ->> 'correct_id'
      );
  end if;

  update public.academy_attempt
  set finished_at = now(),
      score = v_correct,
      passed = v_passed,
      time_taken_seconds = v_seconds,
      abandoned = p_abandoned,
      lockout_until = case
        when v_passed then null
        else now() + make_interval(mins => coalesce((v.rules ->> 'lockout_minutes')::integer, 0))
      end,
      reopen_lesson_ids = case when v_passed then '{}' else coalesce(v_lessons, '{}') end
  where id = v.id;

  if v_min > 0 and not p_abandoned and v_seconds < v_min * greatest(v_total, v_count) then
    insert into public.academy_attempt_flag (attempt_id, flagged_fast, time_taken_seconds)
    values (v.id, true, v_seconds)
    on conflict (attempt_id) do nothing;
  end if;

  if v_passed then
    perform app.audit('academy.attempt_submitted', 'academy_attempt', v.id::text, 'Quiz passed', null,
      jsonb_build_object('score', v_correct, 'passed', true));
    return;
  end if;

  perform app.audit(
    case when p_abandoned then 'academy.attempt_abandoned' else 'academy.attempt_submitted' end,
    'academy_attempt', v.id::text,
    case when p_abandoned then 'Quiz attempt abandoned' else 'Quiz failed' end,
    null, jsonb_build_object('score', v_correct, 'passed', false, 'attempt_number', v.attempt_number)
  );

  if v.attempt_number = 3 then
    insert into public.academy_notice (enrollment_id, quiz_id, attempt_id, kind)
    values (v.enrollment_id, v.quiz_id, v.id, 'third_fail')
    on conflict (attempt_id, kind) do nothing;
    perform app.audit('academy.manager_notice', 'academy_notice', v.id::text,
      'Manager should be told about the third failed attempt. Nothing was sent.',
      null, jsonb_build_object('attempt_number', 3, 'quiz_id', v.quiz_id));
  end if;

  select coalesce(extra_attempts, 0) into v_extra from public.academy_quiz_allowance
  where enrollment_id = v.enrollment_id and quiz_id = v.quiz_id;
  v_allowed := coalesce((v.rules ->> 'max_attempts')::integer, v_quiz.max_attempts) + coalesce(v_extra, 0);

  if v.attempt_number >= v_allowed then
    select string_agg(format('%s (%s)', concept, n), ', ' order by n desc, concept) into v_summary
    from (
      select item ->> 'concept' as concept, count(*) as n
      from public.academy_attempt a
      join public.academy_attempt_key k on k.attempt_id = a.id
      cross join lateral jsonb_array_elements(k.questions) item
      where a.enrollment_id = v.enrollment_id and a.quiz_id = v.quiz_id and a.finished_at is not null
        and coalesce(item ->> 'concept', '') <> ''
        and not exists (
          select 1 from jsonb_array_elements(coalesce(a.answers, '[]'::jsonb)) ans
          where ans ->> 'question_id' = item ->> 'id' and ans ->> 'option_id' = item ->> 'correct_id'
        )
      group by 1
    ) missed;

    update public.academy_enrollment set status = 'on_hold_review'
    where id = v.enrollment_id and status in ('active', 'stalled', 'completed');

    if not exists (
      select 1 from public.academy_hold h
      where h.enrollment_id = v.enrollment_id and h.status = 'open'
    ) then
      insert into public.academy_hold (enrollment_id, quiz_id, reason, attempts_used, status, concept_summary)
      values (
        v.enrollment_id, v.quiz_id, 'Failed the last attempt', v.attempt_number, 'open', v_summary
      );
    end if;
    perform app.audit('academy.hold_opened', 'academy_hold', v.enrollment_id::text,
      'Enrollment placed on hold after the last quiz attempt',
      null, jsonb_build_object('quiz_id', v.quiz_id, 'attempts_used', v.attempt_number, 'concept_summary', v_summary));
  end if;
end;
$$;

create or replace function app.academy_prepare_enrollment(p_enrollment_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v public.academy_attempt;
  v_limit integer;
  v_window integer;
begin
  for v in
    select * from public.academy_attempt
    where enrollment_id = p_enrollment_id and finished_at is null
    order by started_at
  loop
    v_limit := nullif(v.rules ->> 'time_limit_seconds', '')::integer;
    v_window := coalesce(nullif(v.rules ->> 'abandoned_minutes', '')::integer, 60);
    if v_limit is not null and v.started_at + make_interval(secs => v_limit) <= clock_timestamp() then
      perform app.academy_score_attempt(v.id, false);
    elsif v.started_at + make_interval(mins => v_window) <= clock_timestamp() then
      perform app.academy_score_attempt(v.id, true);
    end if;
  end loop;
end;
$$;

create or replace function public.academy_prepare()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_enrollment public.academy_enrollment := app.academy_primary_for_actor();
begin
  if v_enrollment.id is null then
    return;
  end if;
  perform app.academy_prepare_enrollment(v_enrollment.id);
end;
$$;

create or replace function public.academy_record_lesson_open(p_lesson_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_enrollment public.academy_enrollment := app.academy_primary_for_actor();
begin
  if v_enrollment.id is null or not app.academy_lesson_open(v_enrollment.id, p_lesson_id) then
    return;
  end if;
  insert into public.academy_progress (enrollment_id, lesson_id, status, last_opened_at)
  values (v_enrollment.id, p_lesson_id, 'not_started', clock_timestamp())
  on conflict (enrollment_id, lesson_id) do update
    set last_opened_at = clock_timestamp();
end;
$$;

create or replace function app.academy_public_questions(p_attempt_id uuid, p_reveal boolean)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_answers jsonb;
  v_key jsonb;
begin
  select answers into v_answers from public.academy_attempt where id = p_attempt_id;
  select questions into v_key from public.academy_attempt_key where attempt_id = p_attempt_id;
  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', item ->> 'id',
        'prompt', item ->> 'prompt',
        'type', item ->> 'question_type',
        'scenario', item ->> 'scenario',
        'options', (
          select coalesce(jsonb_agg(jsonb_build_object('id', opt ->> 'id', 'text', opt ->> 'text') order by ord.ordinality), '[]'::jsonb)
          from jsonb_array_elements_text(coalesce(item -> 'option_order', '[]'::jsonb)) with ordinality as ord(option_id, ordinality)
          join lateral jsonb_array_elements(coalesce(item -> 'options', '[]'::jsonb)) opt on opt ->> 'id' = ord.option_id
        ),
        'selected', (
          select ans ->> 'option_id' from jsonb_array_elements(coalesce(v_answers, '[]'::jsonb)) ans
          where ans ->> 'question_id' = item ->> 'id' limit 1
        )
      ) || case when p_reveal then jsonb_build_object(
        'explanation', item ->> 'explanation',
        'correct_option_id', item ->> 'correct_id',
        'correct_text', (
          select opt ->> 'text' from jsonb_array_elements(coalesce(item -> 'options', '[]'::jsonb)) opt
          where opt ->> 'id' = item ->> 'correct_id' limit 1
        ),
        'your_text', (
          select opt ->> 'text'
          from jsonb_array_elements(coalesce(item -> 'options', '[]'::jsonb)) opt
          where opt ->> 'id' = (
            select ans ->> 'option_id' from jsonb_array_elements(coalesce(v_answers, '[]'::jsonb)) ans
            where ans ->> 'question_id' = item ->> 'id' limit 1
          )
          limit 1
        ),
        'concept', item ->> 'concept'
      ) else '{}'::jsonb end
      order by ordq.ordinality
    )
    from jsonb_array_elements(coalesce(v_key, '[]'::jsonb)) with ordinality as ordq(item, ordinality)
  ), '[]'::jsonb);
end;
$$;

create or replace function app.academy_fail_concepts(p_attempt_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(distinct jsonb_build_object(
    'tag', item ->> 'concept',
    'lesson_id', item ->> 'lesson_id',
    'lesson_title', l.title,
    'module_id', l.module_id
  )), '[]'::jsonb)
  from public.academy_attempt a
  join public.academy_attempt_key k on k.attempt_id = a.id
  cross join lateral jsonb_array_elements(k.questions) item
  left join public.academy_lesson l on l.id = nullif(item ->> 'lesson_id', '')::uuid
  where a.id = p_attempt_id
    and coalesce(item ->> 'concept', '') <> ''
    and not exists (
      select 1 from jsonb_array_elements(coalesce(a.answers, '[]'::jsonb)) ans
      where ans ->> 'question_id' = item ->> 'id' and ans ->> 'option_id' = item ->> 'correct_id'
    );
$$;

create or replace function app.academy_final_breakdown(p_attempt_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'module_id', scored.module_id,
    'module_order', m.order_number,
    'module_title', m.title,
    'correct', scored.correct,
    'total', scored.total
  ) order by m.order_number), '[]'::jsonb)
  from (
    select (item ->> 'module_id')::uuid as module_id,
      count(*) filter (
        where exists (
          select 1 from public.academy_attempt a
          cross join lateral jsonb_array_elements(coalesce(a.answers, '[]'::jsonb)) ans
          where a.id = p_attempt_id and ans ->> 'question_id' = item ->> 'id' and ans ->> 'option_id' = item ->> 'correct_id'
        )
      ) as correct,
      count(*) as total
    from public.academy_attempt_key k
    cross join lateral jsonb_array_elements(k.questions) item
    where k.attempt_id = p_attempt_id
    group by 1
  ) scored
  join public.academy_module m on m.id = scored.module_id;
$$;

create or replace function app.academy_build_key(p_ids uuid[], p_shuffle boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_q public.academy_question;
  v_concept text;
  v_lesson uuid;
  v_order jsonb;
  v_out jsonb := '[]'::jsonb;
begin
  foreach v_id in array coalesce(p_ids, '{}')
  loop
    select * into v_q from public.academy_question where id = v_id;
    select c.name, c.lesson_id into v_concept, v_lesson
    from public.academy_concept c where c.id = v_q.concept_id;
    select coalesce(jsonb_agg(opt ->> 'id'), '[]'::jsonb) into v_order
    from jsonb_array_elements(coalesce(v_q.options, '[]'::jsonb)) opt;
    if p_shuffle then
      v_order := app.academy_permute(v_order);
    end if;
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'id', v_q.id,
      'module_id', v_q.module_id,
      'prompt', v_q.prompt,
      'question_type', v_q.question_type,
      'scenario', v_q.scenario,
      'options', v_q.options,
      'option_order', v_order,
      'correct_id', v_q.correct_answer,
      'explanation', v_q.explanation,
      'concept', coalesce(v_concept, v_q.concept_tag),
      'lesson_id', v_lesson
    ));
  end loop;
  return v_out;
end;
$$;

create or replace function app.academy_draw_ids(p_quiz public.academy_quiz, p_seen uuid[])
returns uuid[]
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_ids uuid[] := '{}';
  v_part uuid[];
  v_draw record;
begin
  if p_quiz.kind = 'final' then
    for v_draw in
      select d.question_count, d.source_module_id
      from public.academy_quiz_draw d
      join public.academy_module m on m.id = d.source_module_id
      where d.quiz_id = p_quiz.id
      order by m.order_number
    loop
      v_part := app.academy_pick_questions(v_draw.source_module_id, v_draw.question_count, p_seen, false);
      v_ids := v_ids || coalesce(v_part, '{}');
    end loop;
    if p_quiz.shuffle_answers then
      select coalesce(array_agg(item order by random()), '{}') into v_ids from unnest(v_ids) item;
    end if;
  else
    v_ids := app.academy_pick_questions(p_quiz.module_id, p_quiz.questions_per_attempt, p_seen, p_quiz.shuffle_answers);
  end if;
  return coalesce(v_ids, '{}');
end;
$$;

create or replace function app.academy_quiz_rules(p_quiz public.academy_quiz)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'questions_per_attempt', p_quiz.questions_per_attempt,
    'pass_mark', p_quiz.pass_mark,
    'pass_mark_unit', p_quiz.pass_mark_unit,
    'max_attempts', p_quiz.max_attempts,
    'lockout_minutes', p_quiz.lockout_minutes,
    'shuffle', p_quiz.shuffle_answers,
    'time_limit_seconds', p_quiz.time_limit_seconds,
    'abandoned_minutes', p_quiz.abandoned_minutes,
    'min_seconds_per_question', p_quiz.min_seconds_per_question
  );
$$;

create or replace function public.academy_quiz_state(p_module_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_enrollment public.academy_enrollment := app.academy_primary_for_actor();
  v_module public.academy_module;
  v_quiz public.academy_quiz;
  v_card jsonb;
  v_open public.academy_attempt;
  v_last public.academy_attempt;
  v_other uuid;
  v_phase text;
  v_reveal boolean := false;
  v_warning text;
  v_result jsonb;
  v_rules text;
begin
  if v_enrollment.id is not null then
    perform app.academy_prepare_enrollment(v_enrollment.id);
  end if;
  if v_enrollment.id is null or not app.academy_content_open(v_enrollment.id) then
    return jsonb_build_object(
      'phase', case when v_enrollment.status = 'on_hold_review' then 'held' else 'unavailable' end,
      'can_start', false
    );
  end if;
  select * into v_module from public.academy_module where id = p_module_id and program_id = v_enrollment.program_id;
  if v_module.id is null or not app.academy_module_unlocked(v_enrollment.id, v_module.id) then
    return jsonb_build_object('phase', 'unavailable', 'can_start', false, 'blocked', 'locked');
  end if;
  select * into v_quiz from public.academy_quiz where module_id = v_module.id;
  if v_quiz.id is null then
    return jsonb_build_object('phase', 'unavailable', 'can_start', false, 'blocked', 'pool');
  end if;

  v_card := app.academy_quiz_card(v_enrollment.id, v_module.id);
  select * into v_open from public.academy_attempt
  where enrollment_id = v_enrollment.id and quiz_id = v_quiz.id and finished_at is null;
  select * into v_last from public.academy_attempt
  where enrollment_id = v_enrollment.id and quiz_id = v_quiz.id and finished_at is not null
  order by finished_at desc limit 1;
  select a.quiz_id into v_other from public.academy_attempt a
  where a.enrollment_id = v_enrollment.id and a.finished_at is null and a.quiz_id <> v_quiz.id
  limit 1;

  if v_card ->> 'status' = 'passed' then
    v_phase := 'pass';
    v_reveal := true;
    select * into v_last from public.academy_attempt
    where enrollment_id = v_enrollment.id and quiz_id = v_quiz.id and passed is true
    order by finished_at desc limit 1;
  elsif v_open.id is not null then
    v_phase := 'take';
  elsif v_card ->> 'status' = 'not_available' then
    v_phase := 'unavailable';
  elsif v_last.id is not null and v_last.passed is not true then
    v_phase := 'fail';
  else
    v_phase := 'start';
  end if;

  if coalesce((v_card ->> 'attempts_remaining')::integer, 0) = 1 and v_phase in ('fail', 'start') then
    v_warning := 'Only one attempt remains. Failing it places the program on review.';
  end if;

  if v_last.id is not null and v_phase in ('fail', 'pass') then
    v_result := jsonb_build_object(
      'score', v_last.score,
      'total', coalesce(array_length(v_last.questions_drawn, 1), v_quiz.questions_per_attempt),
      'pass_mark_label', app.academy_pass_label(
        coalesce((v_last.rules ->> 'pass_mark')::numeric, v_quiz.pass_mark),
        coalesce(v_last.rules ->> 'pass_mark_unit', v_quiz.pass_mark_unit),
        coalesce((v_last.rules ->> 'questions_per_attempt')::integer, v_quiz.questions_per_attempt)
      ),
      'abandoned', v_last.abandoned,
      'warning', v_warning,
      'concepts', case when v_reveal then '[]'::jsonb else app.academy_fail_concepts(v_last.id) end,
      'review', case when v_reveal then app.academy_public_questions(v_last.id, true) else '[]'::jsonb end,
      'breakdown', case when v_reveal and v_quiz.kind = 'final' then app.academy_final_breakdown(v_last.id) else '[]'::jsonb end
    );
  end if;

  v_rules := format(
    'This attempt has %s questions. Pass mark: %s. You have %s of %s attempts left. A failed attempt locks the next one for %s minutes. Unanswered questions are wrong. Leaving does not give you another attempt.',
    v_quiz.questions_per_attempt,
    app.academy_pass_label(v_quiz.pass_mark, v_quiz.pass_mark_unit, v_quiz.questions_per_attempt),
    v_card ->> 'attempts_remaining',
    v_card ->> 'attempts_allowed',
    v_quiz.lockout_minutes
  );
  if v_quiz.time_limit_seconds is not null then
    v_rules := v_rules || format(' You have %s minutes.', round(v_quiz.time_limit_seconds / 60.0));
  end if;

  return jsonb_build_object(
    'phase', v_phase,
    'can_start', v_card ->> 'status' = 'available' and v_open.id is null and v_other is null,
    'blocked', case
      when v_card ->> 'status' = 'not_available' and not app.academy_lessons_complete(v_enrollment.id, v_module.id) then 'lessons'
      when v_card ->> 'status' = 'not_available' then 'pool'
      when v_other is not null then 'other'
      when v_card ->> 'status' = 'locked' and v_last.lockout_until > now() then 'lockout'
      when v_card ->> 'status' = 'locked' then 'reopen'
      else null
    end,
    'module_id', v_module.id,
    'module_title', v_module.title,
    'module_order', v_module.order_number,
    'kind', v_quiz.kind,
    'rules', v_rules,
    'pass_mark_label', app.academy_pass_label(v_quiz.pass_mark, v_quiz.pass_mark_unit, v_quiz.questions_per_attempt),
    'questions_per_attempt', v_quiz.questions_per_attempt,
    'lockout_minutes', v_quiz.lockout_minutes,
    'time_limit_seconds', v_quiz.time_limit_seconds,
    'attempts_used', v_card -> 'attempts_used',
    'attempts_allowed', v_card -> 'attempts_allowed',
    'attempts_remaining', v_card -> 'attempts_remaining',
    'lockout_until', v_card -> 'lockout_until',
    'reopen', coalesce(v_card -> 'reopen', '[]'::jsonb),
    'warning', v_warning,
    'attempt', case when v_open.id is null then null else jsonb_build_object(
      'id', v_open.id,
      'started_at', v_open.started_at,
      'time_limit_seconds', nullif(v_open.rules ->> 'time_limit_seconds', '')::integer,
      'questions', app.academy_public_questions(v_open.id, false)
    ) end,
    'result', v_result
  );
end;
$$;

create or replace function public.academy_start_quiz(p_module_id uuid, p_device text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_enrollment public.academy_enrollment := app.academy_primary_for_actor();
  v_quiz public.academy_quiz;
  v_seen uuid[];
  v_ids uuid[];
  v_id uuid;
  v_number integer;
  v_device text;
begin
  if v_enrollment.id is null or not app.academy_content_open(v_enrollment.id) then
    raise exception 'quiz_closed: this quiz is not open' using errcode = '42501';
  end if;
  perform app.academy_prepare_enrollment(v_enrollment.id);
  select * into v_quiz from public.academy_quiz where module_id = p_module_id;
  if v_quiz.id is null or not app.academy_module_unlocked(v_enrollment.id, p_module_id) then
    raise exception 'quiz_closed: this quiz is not open' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.academy_lesson l
    where l.module_id = p_module_id and l.published and l.archived_at is null
  ) and not app.academy_lessons_complete(v_enrollment.id, p_module_id) then
    raise exception 'lessons_open: finish every lesson in this module first' using errcode = '42501';
  end if;
  if v_quiz.kind = 'final' and exists (
    select 1 from public.academy_module m
    where m.program_id = (select program_id from public.academy_module where id = p_module_id)
      and m.order_number between 1 and 10
      and not app.academy_module_gate_passed(v_enrollment.id, m.id)
  ) then
    raise exception 'final_closed: finish modules 1 through 10 first' using errcode = '42501';
  end if;
  if not app.academy_quiz_servable(v_quiz.id) then
    raise exception 'pool_short: %', coalesce(app.academy_pool_message(v_quiz.id), 'This quiz is not live yet')
      using errcode = '23514';
  end if;
  if exists (
    select 1 from public.academy_attempt
    where enrollment_id = v_enrollment.id and quiz_id = v_quiz.id and passed is true
  ) then
    raise exception 'already_passed: this quiz is already passed' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.academy_attempt
    where enrollment_id = v_enrollment.id and finished_at is null and quiz_id <> v_quiz.id
  ) then
    raise exception 'attempt_open: finish the quiz you already started' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.academy_attempt
    where enrollment_id = v_enrollment.id and quiz_id = v_quiz.id and finished_at is null
  ) then
    return public.academy_quiz_state(p_module_id);
  end if;

  if (app.academy_quiz_card(v_enrollment.id, p_module_id) ->> 'status') is distinct from 'available' then
    raise exception 'quiz_locked: the next attempt is not open yet' using errcode = '42501';
  end if;

  select coalesce(array_agg(distinct item), '{}') into v_seen
  from public.academy_attempt a, lateral unnest(a.questions_drawn) item
  where a.enrollment_id = v_enrollment.id and a.quiz_id = v_quiz.id;
  v_ids := app.academy_draw_ids(v_quiz, v_seen);
  if coalesce(array_length(v_ids, 1), 0) <> v_quiz.questions_per_attempt then
    raise exception 'pool_short: %', coalesce(app.academy_pool_message(v_quiz.id), 'The pool is short')
      using errcode = '23514';
  end if;

  select count(*) + 1 into v_number from public.academy_attempt
  where enrollment_id = v_enrollment.id and quiz_id = v_quiz.id;
  v_device := case when p_device in ('phone', 'tablet', 'desktop') then p_device else null end;

  insert into public.academy_attempt (
    enrollment_id, quiz_id, attempt_number, questions_drawn, answers, rules, device_type
  ) values (
    v_enrollment.id, v_quiz.id, v_number, v_ids, '[]'::jsonb, app.academy_quiz_rules(v_quiz), v_device
  ) returning id into v_id;

  insert into public.academy_attempt_key (attempt_id, questions)
  values (v_id, app.academy_build_key(v_ids, v_quiz.shuffle_answers));

  perform app.audit('academy.attempt_started', 'academy_attempt', v_id::text, 'Quiz attempt started', null,
    jsonb_build_object('quiz_id', v_quiz.id, 'attempt_number', v_number, 'device_type', v_device));
  return public.academy_quiz_state(p_module_id);
end;
$$;

create or replace function public.academy_save_quiz_answer(
  p_attempt_id uuid,
  p_question_id uuid,
  p_option_id text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_enrollment public.academy_enrollment := app.academy_primary_for_actor();
  v public.academy_attempt;
  v_module uuid;
begin
  select * into v from public.academy_attempt
  where id = p_attempt_id and enrollment_id = v_enrollment.id and finished_at is null
  for update;
  if v.id is null then
    raise exception 'attempt_closed: this attempt is already finished' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.academy_attempt_key k
    cross join lateral jsonb_array_elements(k.questions) item
    where k.attempt_id = v.id and item ->> 'id' = p_question_id::text
      and exists (
        select 1 from jsonb_array_elements_text(coalesce(item -> 'option_order', '[]'::jsonb)) opt
        where opt = p_option_id
      )
  ) then
    raise exception 'bad_answer: that option is not on this question' using errcode = '22023';
  end if;
  update public.academy_attempt
  set answers = (
    select coalesce(jsonb_agg(item), '[]'::jsonb) from jsonb_array_elements(coalesce(answers, '[]'::jsonb)) item
    where item ->> 'question_id' is distinct from p_question_id::text
  ) || jsonb_build_array(jsonb_build_object('question_id', p_question_id, 'option_id', p_option_id))
  where id = v.id;
  select module_id into v_module from public.academy_quiz where id = v.quiz_id;
  return public.academy_quiz_state(v_module);
end;
$$;

create or replace function public.academy_submit_quiz(p_attempt_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_enrollment public.academy_enrollment := app.academy_primary_for_actor();
  v public.academy_attempt;
  v_module uuid;
begin
  if v_enrollment.id is null then
    raise exception 'quiz_closed: this quiz is not open' using errcode = '42501';
  end if;
  perform app.academy_prepare_enrollment(v_enrollment.id);
  select * into v from public.academy_attempt where id = p_attempt_id and enrollment_id = v_enrollment.id;
  if v.id is null then
    raise exception 'attempt_closed: this attempt is not yours' using errcode = '42501';
  end if;
  if v.finished_at is null then
    perform app.academy_score_attempt(v.id, false);
  end if;
  select module_id into v_module from public.academy_quiz where id = v.quiz_id;
  return public.academy_quiz_state(v_module);
end;
$$;

-- ---------------------------------------------------------------------------
-- Academy admin: settings, questions, import, preview, stats, gate notes
-- ---------------------------------------------------------------------------

create or replace function app.academy_quiz_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and to_jsonb(old) - 'updated_at' - 'created_at' is distinct from to_jsonb(new) - 'updated_at' - 'created_at' then
    perform app.audit(
      'academy.settings_changed', 'academy_quiz', new.id::text, 'Academy quiz settings changed',
      to_jsonb(old) - 'updated_at' - 'created_at',
      to_jsonb(new) - 'updated_at' - 'created_at'
    );
  end if;
  return new;
end;
$$;

create or replace function public.academy_save_quiz_settings(p_payload jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v public.academy_quiz;
  v_active boolean := coalesce((p_payload ->> 'active')::boolean, false);
  v_count integer := (p_payload ->> 'questions_per_attempt')::integer;
  v_mark numeric := (p_payload ->> 'pass_mark')::numeric;
  v_unit text := p_payload ->> 'pass_mark_unit';
begin
  perform app.academy_require_manage();
  select * into v from public.academy_quiz where id = (p_payload ->> 'id')::uuid;
  if v.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_unit not in ('correct', 'percent') or v_count is null or v_count < 1 then
    raise exception 'bad_settings: check the question count and the pass mark' using errcode = '22023';
  end if;
  if (v_unit = 'correct' and v_mark > v_count) or (v_unit = 'percent' and (v_mark <= 0 or v_mark > 100)) then
    raise exception 'bad_settings: the pass mark does not fit the attempt' using errcode = '22023';
  end if;
  if v_active and not app.academy_pool_ready(v.id, v_count) then
    raise exception 'pool_short: %', coalesce(app.academy_pool_message(v.id), 'The pool is too small to go live.')
      using errcode = '23514';
  end if;
  if v.kind = 'final' and v_count <> (select coalesce(sum(question_count), 0) from public.academy_quiz_draw where quiz_id = v.id) then
    raise exception 'bad_settings: the Final Quiz question count has to match its module draws' using errcode = '22023';
  end if;
  update public.academy_quiz set
    questions_per_attempt = v_count,
    pass_mark = v_mark,
    pass_mark_unit = v_unit,
    max_attempts = (p_payload ->> 'max_attempts')::integer,
    lockout_minutes = (p_payload ->> 'lockout_minutes')::integer,
    shuffle_answers = coalesce((p_payload ->> 'shuffle_answers')::boolean, true),
    active = v_active,
    time_limit_seconds = nullif(p_payload ->> 'time_limit_seconds', '')::integer,
    abandoned_minutes = coalesce((p_payload ->> 'abandoned_minutes')::integer, 60),
    min_seconds_per_question = coalesce((p_payload ->> 'min_seconds_per_question')::integer, 15),
    updated_at = now()
  where id = v.id;
  return jsonb_build_object('id', v.id);
end;
$$;

create or replace function public.academy_admin_quizzes()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app.academy_require_manage();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', q.id,
      'module_id', q.module_id,
      'module_order', m.order_number,
      'module_title', m.title,
      'program', p.name,
      'kind', q.kind,
      'questions_per_attempt', q.questions_per_attempt,
      'pass_mark', q.pass_mark,
      'pass_mark_unit', q.pass_mark_unit,
      'max_attempts', q.max_attempts,
      'lockout_minutes', q.lockout_minutes,
      'shuffle_answers', q.shuffle_answers,
      'active', q.active,
      'time_limit_seconds', q.time_limit_seconds,
      'abandoned_minutes', q.abandoned_minutes,
      'min_seconds_per_question', q.min_seconds_per_question,
      'servable', app.academy_quiz_servable(q.id),
      'pool_message', app.academy_pool_message(q.id),
      'gates', app.academy_gate_cards('00000000-0000-0000-0000-000000000000'::uuid, m.id)
    ) order by p.program_type, m.order_number)
    from public.academy_quiz q
    join public.academy_module m on m.id = q.module_id
    join public.academy_program p on p.id = m.program_id
  ), '[]'::jsonb);
end;
$$;

create or replace function public.academy_save_concept(p_payload jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_payload ->> 'id', '')::uuid;
  v_module uuid := (p_payload ->> 'module_id')::uuid;
  v_name text := btrim(p_payload ->> 'name');
  v_lesson uuid := nullif(p_payload ->> 'lesson_id', '')::uuid;
begin
  perform app.academy_require_manage();
  if v_name is null or v_lesson is null then
    raise exception 'bad_concept: a tag needs a name and a lesson' using errcode = '22023';
  end if;
  if not exists (select 1 from public.academy_lesson where id = v_lesson and module_id = v_module) then
    raise exception 'bad_concept: that lesson is not in this module' using errcode = '22023';
  end if;
  if v_id is null then
    insert into public.academy_concept (module_id, name, lesson_id)
    values (v_module, v_name, v_lesson)
    returning id into v_id;
  else
    update public.academy_concept set name = v_name, lesson_id = v_lesson, module_id = v_module where id = v_id;
  end if;
  perform app.audit('academy.concept_saved', 'academy_concept', v_id::text, 'Concept tag saved', null,
    jsonb_build_object('name', v_name, 'lesson_id', v_lesson));
  return jsonb_build_object('id', v_id);
end;
$$;

create or replace function public.academy_save_question(p_payload jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_payload ->> 'id', '')::uuid;
  v_old public.academy_question;
  v_type text := p_payload ->> 'question_type';
  v_diff text := p_payload ->> 'difficulty';
  v_active boolean := coalesce((p_payload ->> 'active')::boolean, true);
  v_concept uuid := nullif(p_payload ->> 'concept_id', '')::uuid;
  v_tag text;
  v_lesson uuid;
begin
  perform app.academy_require_manage();
  if v_type not in ('multiple_choice', 'scenario') then
    raise exception 'bad_question: the type must be multiple choice or scenario' using errcode = '22023';
  end if;
  if v_type = 'scenario' and nullif(btrim(coalesce(p_payload ->> 'scenario', '')), '') is null then
    raise exception 'bad_question: a scenario question needs the situation' using errcode = '22023';
  end if;
  if v_diff not in ('easy', 'medium', 'hard', 'foundation', 'standard', 'advanced') then
    raise exception 'bad_question: difficulty must be easy, medium, or hard' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_payload ->> 'prompt', '')), '') is null then
    raise exception 'bad_question: the question text is missing' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p_payload -> 'options', '[]'::jsonb)) < 2 then
    raise exception 'bad_question: add at least two options' using errcode = '22023';
  end if;
  if not exists (
    select 1 from jsonb_array_elements(p_payload -> 'options') opt
    where opt ->> 'id' = p_payload ->> 'correct_answer' and nullif(btrim(opt ->> 'text'), '') is not null
  ) then
    raise exception 'bad_question: the correct option does not match an option' using errcode = '22023';
  end if;
  if v_concept is not null then
    select name, lesson_id into v_tag, v_lesson from public.academy_concept
    where id = v_concept and module_id = (p_payload ->> 'module_id')::uuid;
    if v_tag is null then
      raise exception 'bad_question: that concept tag is not on this module' using errcode = '22023';
    end if;
    if v_active and v_lesson is null then
      raise exception 'bad_question: link the concept tag to a lesson before it is active' using errcode = '23514';
    end if;
  elsif v_active then
    raise exception 'bad_question: an active question needs a concept tag' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.academy_question
    where module_id = (p_payload ->> 'module_id')::uuid
      and lower(btrim(prompt)) = lower(btrim(p_payload ->> 'prompt'))
      and id is distinct from v_id
  ) then
    raise exception 'duplicate_question: this question is already in the module' using errcode = '23505';
  end if;

  if v_id is null then
    insert into public.academy_question (
      module_id, prompt, question_type, scenario, options, correct_answer, explanation, concept_tag, concept_id, difficulty, active
    ) values (
      (p_payload ->> 'module_id')::uuid, btrim(p_payload ->> 'prompt'), v_type, nullif(btrim(coalesce(p_payload ->> 'scenario', '')), ''),
      p_payload -> 'options', p_payload ->> 'correct_answer', coalesce(p_payload ->> 'explanation', ''),
      v_tag, v_concept, v_diff, v_active
    ) returning id into v_id;
    perform app.audit('academy.question_created', 'academy_question', v_id::text, 'Question created');
  else
    select * into v_old from public.academy_question where id = v_id;
    update public.academy_question set
      module_id = (p_payload ->> 'module_id')::uuid,
      prompt = btrim(p_payload ->> 'prompt'),
      question_type = v_type,
      scenario = nullif(btrim(coalesce(p_payload ->> 'scenario', '')), ''),
      options = p_payload -> 'options',
      correct_answer = p_payload ->> 'correct_answer',
      explanation = coalesce(p_payload ->> 'explanation', ''),
      concept_tag = v_tag,
      concept_id = v_concept,
      difficulty = v_diff,
      active = v_active
    where id = v_id;
    perform app.audit(
      case when v_old.active and not v_active then 'academy.question_deactivated' else 'academy.question_edited' end,
      'academy_question', v_id::text, 'Question updated'
    );
  end if;
  return jsonb_build_object('id', v_id);
end;
$$;

create or replace function public.academy_set_question_active(p_question_id uuid, p_active boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v public.academy_question;
begin
  perform app.academy_require_manage();
  select * into v from public.academy_question where id = p_question_id;
  if v.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if p_active and (
    v.concept_id is null or not exists (
      select 1 from public.academy_concept c where c.id = v.concept_id and c.lesson_id is not null
    )
  ) then
    raise exception 'bad_question: link the concept tag to a lesson before it is active' using errcode = '23514';
  end if;
  update public.academy_question set active = p_active where id = v.id;
  perform app.audit(
    case when p_active then 'academy.question_edited' else 'academy.question_deactivated' end,
    'academy_question', v.id::text,
    case when p_active then 'Question reactivated' else 'Question deactivated' end
  );
end;
$$;

create or replace function app.academy_question_guard_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.academy_attempt a where old.id = any(a.questions_drawn)
  ) then
    raise exception 'question_used: deactivate this question. It is already in an attempt.' using errcode = '23503';
  end if;
  return old;
end;
$$;

create trigger academy_question_guard_delete
  before delete on public.academy_question
  for each row execute function app.academy_question_guard_delete();

create or replace function public.academy_admin_questions(p_module_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app.academy_require_manage();
  return jsonb_build_object(
    'concepts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'module_id', c.module_id, 'name', c.name, 'lesson_id', c.lesson_id,
        'lesson_title', l.title
      ) order by c.name)
      from public.academy_concept c
      left join public.academy_lesson l on l.id = c.lesson_id
      where p_module_id is null or c.module_id = p_module_id
    ), '[]'::jsonb),
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id, 'module_id', q.module_id, 'module_order', m.order_number, 'module_title', m.title,
        'prompt', q.prompt, 'question_type', q.question_type, 'scenario', q.scenario,
        'options', q.options, 'correct_answer', q.correct_answer, 'explanation', q.explanation,
        'concept_id', q.concept_id, 'concept_tag', q.concept_tag, 'difficulty', q.difficulty, 'active', q.active,
        'used', exists (select 1 from public.academy_attempt a where q.id = any(a.questions_drawn))
      ) order by m.order_number, q.created_at)
      from public.academy_question q
      join public.academy_module m on m.id = q.module_id
      where p_module_id is null or q.module_id = p_module_id
    ), '[]'::jsonb),
    'pools', coalesce((
      select jsonb_agg(jsonb_build_object(
        'module_id', m.id, 'order', m.order_number, 'title', m.title,
        'active_count', (select count(*) from public.academy_question q where q.module_id = m.id and q.active),
        'health', case
          when (select count(*) from public.academy_question q where q.module_id = m.id and q.active) < 15 then 'thin'
          else 'ok'
        end
      ) order by m.order_number)
      from public.academy_module m
      where exists (select 1 from public.academy_quiz qz where qz.module_id = m.id and qz.kind = 'module')
         or exists (select 1 from public.academy_quiz_draw d where d.source_module_id = m.id)
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.academy_question_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app.academy_require_manage();
  return jsonb_build_object(
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id,
        'prompt', q.prompt,
        'concept', q.concept_tag,
        'module_order', m.order_number,
        'appearances', coalesce(stats.appearances, 0),
        'misses', coalesce(stats.misses, 0)
      ) order by coalesce(stats.misses, 0) desc, m.order_number)
      from public.academy_question q
      join public.academy_module m on m.id = q.module_id
      left join (
        select (item ->> 'id')::uuid as question_id,
          count(*) as appearances,
          count(*) filter (
            where not exists (
              select 1 from jsonb_array_elements(coalesce(a.answers, '[]'::jsonb)) ans
              where ans ->> 'question_id' = item ->> 'id' and ans ->> 'option_id' = item ->> 'correct_id'
            )
          ) as misses
        from public.academy_attempt a
        join public.academy_attempt_key k on k.attempt_id = a.id
        cross join lateral jsonb_array_elements(k.questions) item
        where a.finished_at is not null
        group by 1
      ) stats on stats.question_id = q.id
    ), '[]'::jsonb),
    'concepts', coalesce((
      select jsonb_agg(jsonb_build_object('tag', concept, 'misses', misses) order by misses desc)
      from (
        select item ->> 'concept' as concept, count(*) as misses
        from public.academy_attempt a
        join public.academy_attempt_key k on k.attempt_id = a.id
        cross join lateral jsonb_array_elements(k.questions) item
        where a.finished_at is not null and coalesce(item ->> 'concept', '') <> ''
          and not exists (
            select 1 from jsonb_array_elements(coalesce(a.answers, '[]'::jsonb)) ans
            where ans ->> 'question_id' = item ->> 'id' and ans ->> 'option_id' = item ->> 'correct_id'
          )
        group by 1
      ) c
    ), '[]'::jsonb),
    'fast', coalesce((
      select jsonb_agg(jsonb_build_object(
        'attempt_id', f.attempt_id,
        'time_taken_seconds', f.time_taken_seconds,
        'email', pr.email,
        'module_order', m.order_number,
        'at', a.finished_at
      ) order by a.finished_at desc)
      from public.academy_attempt_flag f
      join public.academy_attempt a on a.id = f.attempt_id
      join public.academy_enrollment e on e.id = a.enrollment_id
      join public.profile pr on pr.id = e.profile_id
      join public.academy_quiz q on q.id = a.quiz_id
      join public.academy_module m on m.id = q.module_id
      where f.flagged_fast
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.academy_preview_quiz(p_quiz_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v public.academy_quiz;
  v_ids uuid[];
  v_key jsonb;
begin
  perform app.academy_require_manage();
  select * into v from public.academy_quiz where id = p_quiz_id;
  if v.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not app.academy_quiz_servable(v.id) then
    raise exception 'pool_short: %', coalesce(app.academy_pool_message(v.id), 'The pool is too small to preview.')
      using errcode = '23514';
  end if;
  v_ids := app.academy_draw_ids(v, '{}');
  v_key := app.academy_build_key(v_ids, v.shuffle_answers);
  return jsonb_build_object(
    'preview', true,
    'title', (select title from public.academy_module where id = v.module_id),
    'questions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', item ->> 'id',
        'prompt', item ->> 'prompt',
        'type', item ->> 'question_type',
        'scenario', item ->> 'scenario',
        'options', (
          select coalesce(jsonb_agg(jsonb_build_object('id', opt ->> 'id', 'text', opt ->> 'text') order by ord.ordinality), '[]'::jsonb)
          from jsonb_array_elements_text(coalesce(item -> 'option_order', '[]'::jsonb)) with ordinality as ord(option_id, ordinality)
          join lateral jsonb_array_elements(coalesce(item -> 'options', '[]'::jsonb)) opt on opt ->> 'id' = ord.option_id
        )
      )), '[]'::jsonb)
      from jsonb_array_elements(v_key) item
    )
  );
end;
$$;

create or replace function public.academy_apply_question_import(p_file_name text, p_rows jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row jsonb;
  v_created integer := 0;
  v_skipped integer := 0;
  v_detail jsonb := '[]'::jsonb;
  v_id uuid;
  v_message text;
begin
  perform app.academy_require_manage();
  if nullif(btrim(coalesce(p_file_name, '')), '') is null then
    raise exception 'file_name_required' using errcode = '22023';
  end if;
  for v_row in select value from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
  loop
    begin
      perform public.academy_save_question(v_row);
      v_created := v_created + 1;
      v_detail := v_detail || jsonb_build_array(jsonb_build_object('action', 'create', 'prompt', left(v_row ->> 'prompt', 80)));
    exception when others then
      v_skipped := v_skipped + 1;
      v_message := regexp_replace(sqlerrm, '^[a-z_]+: ', '');
      v_detail := v_detail || jsonb_build_array(jsonb_build_object('action', 'skip', 'prompt', left(coalesce(v_row ->> 'prompt', ''), 80), 'message', v_message));
    end;
  end loop;
  insert into public.academy_question_import (actor_id, file_name, created_count, skipped_count, detail)
  values (auth.uid(), p_file_name, v_created, v_skipped, v_detail)
  returning id into v_id;
  perform app.audit('academy.question_import', 'academy_question_import', v_id::text,
    format('Imported questions from %s', p_file_name), null,
    jsonb_build_object('file_name', p_file_name, 'created', v_created, 'skipped', v_skipped));
  return jsonb_build_object('id', v_id, 'created', v_created, 'skipped', v_skipped, 'detail', v_detail);
end;
$$;

create or replace function public.academy_export_questions()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when app.academy_manages() then coalesce(jsonb_agg(jsonb_build_object(
    'module_number', m.order_number,
    'prompt', q.prompt,
    'question_type', case when q.question_type = 'scenario' then 'scenario' else 'multiple choice' end,
    'scenario', coalesce(q.scenario, ''),
    'option_a', coalesce(q.options -> 0 ->> 'text', ''),
    'option_b', coalesce(q.options -> 1 ->> 'text', ''),
    'option_c', coalesce(q.options -> 2 ->> 'text', ''),
    'option_d', coalesce(q.options -> 3 ->> 'text', ''),
    'correct', upper(coalesce(q.correct_answer, '')),
    'explanation', q.explanation,
    'concept', coalesce(q.concept_tag, ''),
    'difficulty', case q.difficulty
      when 'foundation' then 'easy'
      when 'standard' then 'medium'
      when 'advanced' then 'hard'
      else q.difficulty
    end
  ) order by m.order_number, q.created_at), '[]'::jsonb) else '[]'::jsonb end
  from public.academy_question q
  join public.academy_module m on m.id = q.module_id;
$$;

create or replace function public.academy_satisfy_gate(
  p_enrollment_id uuid,
  p_part_id uuid,
  p_note text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_part public.academy_gate_part;
begin
  perform app.academy_require_manage();
  if nullif(btrim(coalesce(p_note, '')), '') is null then
    raise exception 'note_required: write a note before marking this requirement satisfied' using errcode = '22023';
  end if;
  select * into v_part from public.academy_gate_part where id = p_part_id;
  if v_part.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_part.part_key in ('quiz', 'agreement') then
    raise exception 'gate_closed: the quiz and the agreement are not marked by hand' using errcode = '42501';
  end if;
  insert into public.academy_gate_progress (enrollment_id, gate_part_id, status, note, satisfied_by, satisfied_at)
  values (p_enrollment_id, p_part_id, 'satisfied', btrim(p_note), auth.uid(), now())
  on conflict (enrollment_id, gate_part_id) do update
    set status = 'satisfied', note = excluded.note, satisfied_by = excluded.satisfied_by, satisfied_at = excluded.satisfied_at;
  perform app.audit('academy.gate_override', 'academy_gate_part', p_part_id::text,
    'Marked a gate part satisfied', null,
    jsonb_build_object('enrollment_id', p_enrollment_id, 'label', v_part.label, 'note', btrim(p_note)));
end;
$$;

alter table public.academy_concept enable row level security;
alter table public.academy_gate_part enable row level security;
alter table public.academy_gate_progress enable row level security;
alter table public.academy_quiz_allowance enable row level security;
alter table public.academy_attempt_key enable row level security;
alter table public.academy_attempt_flag enable row level security;
alter table public.academy_notice enable row level security;
alter table public.academy_question_import enable row level security;

create policy academy_concept_admin on public.academy_concept
  for all to authenticated using (app.academy_manages()) with check (app.academy_manages());
create policy academy_gate_part_admin on public.academy_gate_part
  for all to authenticated using (app.academy_manages()) with check (app.academy_manages());
create policy academy_gate_progress_admin on public.academy_gate_progress
  for all to authenticated using (app.academy_manages()) with check (app.academy_manages());
create policy academy_gate_progress_read on public.academy_gate_progress
  for select to authenticated using (app.academy_record_open(enrollment_id));
create policy academy_allowance_admin on public.academy_quiz_allowance
  for all to authenticated using (app.academy_manages()) with check (app.academy_manages());
create policy academy_attempt_key_admin on public.academy_attempt_key
  for all to authenticated using (app.academy_manages()) with check (app.academy_manages());
create policy academy_attempt_flag_read on public.academy_attempt_flag
  for select to authenticated using (
    app.academy_manages()
    or exists (
      select 1 from public.academy_attempt a
      join public.academy_enrollment e on e.id = a.enrollment_id
      where a.id = academy_attempt_flag.attempt_id
        and e.manager_id = app.acting_profile()
        and app.academy_reviews()
        and e.status <> 'withdrawn'
    )
  );
create policy academy_notice_admin on public.academy_notice
  for all to authenticated using (app.academy_manages()) with check (app.academy_manages());
create policy academy_question_import_admin on public.academy_question_import
  for all to authenticated using (app.academy_manages()) with check (app.academy_manages());

revoke all on public.academy_concept from anon, authenticated;
revoke all on public.academy_gate_part from anon, authenticated;
revoke all on public.academy_gate_progress from anon, authenticated;
revoke all on public.academy_quiz_allowance from anon, authenticated;
revoke all on public.academy_attempt_key from anon, authenticated;
revoke all on public.academy_attempt_flag from anon, authenticated;
revoke all on public.academy_notice from anon, authenticated;
revoke all on public.academy_question_import from anon, authenticated;
grant select, insert, update, delete on public.academy_concept to authenticated;
grant select, insert, update, delete on public.academy_gate_part to authenticated;
grant select, insert, update, delete on public.academy_gate_progress to authenticated;
grant select, insert, update, delete on public.academy_quiz_allowance to authenticated;
grant select, insert, update, delete on public.academy_attempt_key to authenticated;
grant select on public.academy_attempt_flag to authenticated;
grant select, insert, update, delete on public.academy_notice to authenticated;
grant select, insert, update, delete on public.academy_question_import to authenticated;

revoke all on function public.academy_prepare() from public, anon;
revoke all on function public.academy_record_lesson_open(uuid) from public, anon;
revoke all on function public.academy_quiz_state(uuid) from public, anon;
revoke all on function public.academy_start_quiz(uuid, text) from public, anon;
revoke all on function public.academy_save_quiz_answer(uuid, uuid, text) from public, anon;
revoke all on function public.academy_submit_quiz(uuid) from public, anon;
revoke all on function public.academy_save_quiz_settings(jsonb) from public, anon;
revoke all on function public.academy_admin_quizzes() from public, anon;
revoke all on function public.academy_save_concept(jsonb) from public, anon;
revoke all on function public.academy_save_question(jsonb) from public, anon;
revoke all on function public.academy_set_question_active(uuid, boolean) from public, anon;
revoke all on function public.academy_admin_questions(uuid) from public, anon;
revoke all on function public.academy_question_stats() from public, anon;
revoke all on function public.academy_preview_quiz(uuid) from public, anon;
revoke all on function public.academy_apply_question_import(text, jsonb) from public, anon;
revoke all on function public.academy_export_questions() from public, anon;
revoke all on function public.academy_satisfy_gate(uuid, uuid, text) from public, anon;

grant execute on function public.academy_prepare() to authenticated;
grant execute on function public.academy_record_lesson_open(uuid) to authenticated;
grant execute on function public.academy_quiz_state(uuid) to authenticated;
grant execute on function public.academy_start_quiz(uuid, text) to authenticated;
grant execute on function public.academy_save_quiz_answer(uuid, uuid, text) to authenticated;
grant execute on function public.academy_submit_quiz(uuid) to authenticated;
grant execute on function public.academy_save_quiz_settings(jsonb) to authenticated;
grant execute on function public.academy_admin_quizzes() to authenticated;
grant execute on function public.academy_save_concept(jsonb) to authenticated;
grant execute on function public.academy_save_question(jsonb) to authenticated;
grant execute on function public.academy_set_question_active(uuid, boolean) to authenticated;
grant execute on function public.academy_admin_questions(uuid) to authenticated;
grant execute on function public.academy_question_stats() to authenticated;
grant execute on function public.academy_preview_quiz(uuid) to authenticated;
grant execute on function public.academy_apply_question_import(text, jsonb) to authenticated;
grant execute on function public.academy_export_questions() to authenticated;
grant execute on function public.academy_satisfy_gate(uuid, uuid, text) to authenticated;
