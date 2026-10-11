-- Using every quiz attempt flags the trainee, opens a review, and notifies staff.

alter table public.academy_hold
  add column if not exists lesson_id uuid references public.academy_lesson (id) on delete set null;

create index if not exists academy_hold_lesson_idx on public.academy_hold (lesson_id);

comment on column public.academy_hold.lesson_id is
  'Set when a lesson quiz, not a module quiz, used the last attempt.';

create table if not exists public.academy_lesson_quiz_allowance (
  enrollment_id uuid not null references public.academy_enrollment (id) on delete cascade,
  lesson_id uuid not null references public.academy_lesson (id) on delete cascade,
  extra_attempts integer not null default 0 check (extra_attempts >= 0),
  primary key (enrollment_id, lesson_id)
);

comment on table public.academy_lesson_quiz_allowance is
  'Extra lesson-quiz attempts granted when a reviewer resets a flagged trainee.';

alter table public.academy_lesson_quiz_allowance enable row level security;
revoke all on public.academy_lesson_quiz_allowance from anon, authenticated;

create or replace function app.academy_lesson_attempts_allowed(p_enrollment uuid, p_lesson uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select 3 + coalesce((
    select a.extra_attempts
    from public.academy_lesson_quiz_allowance a
    where a.enrollment_id = p_enrollment and a.lesson_id = p_lesson
  ), 0);
$$;

revoke all on function app.academy_lesson_attempts_allowed(uuid, uuid) from public, anon, authenticated;

create or replace function app.academy_hold_label(p_hold public.academy_hold)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_quiz public.academy_quiz;
  v_module public.academy_module;
  v_lesson public.academy_lesson;
begin
  if p_hold.quiz_id is not null then
    select * into v_quiz from public.academy_quiz where id = p_hold.quiz_id;
    if v_quiz.kind = 'final' then
      return 'Final Quiz';
    end if;
    select * into v_module from public.academy_module where id = v_quiz.module_id;
    if v_module.order_number is not null then
      return format('Module %s quiz', v_module.order_number);
    end if;
  end if;
  if p_hold.lesson_id is not null then
    select * into v_lesson from public.academy_lesson where id = p_hold.lesson_id;
    if v_lesson.lesson_code is not null then
      return format('%s %s', v_lesson.lesson_code, v_lesson.title);
    end if;
  end if;
  if length(btrim(coalesce(p_hold.reason, ''))) > 0 then
    return btrim(p_hold.reason);
  end if;
  return 'Quiz';
end;
$$;

revoke all on function app.academy_hold_label(public.academy_hold) from public, anon, authenticated;

create or replace function app.academy_flag_recipients(p_reviewer uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct person), '{}'::uuid[])
  from (
    select p_reviewer as person
    union all
    select p.id
    from public.profile p
    where app.effective_state(p.id) = 'active'
      and coalesce((select d.allowed from app.decide('academy.manage', p.id) d), false)
  ) people
  where person is not null;
$$;

revoke all on function app.academy_flag_recipients(uuid) from public, anon, authenticated;

create or replace function app.academy_hold_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_label text;
begin
  if new.reviewer_id is null then
    insert into public.academy_hold_event (hold_id, kind, reviewer_id)
    values (new.id, 'unassigned', null)
    on conflict (hold_id, kind) do nothing;
    perform app.audit(
      'academy.hold_unassigned', 'academy_hold', new.id::text,
      'A hold has no reviewer.',
      null, jsonb_build_object('enrollment_id', new.enrollment_id)
    );
  else
    perform app.audit(
      'academy.hold_assigned', 'academy_hold', new.id::text,
      'Hold assigned to the trainee''s reviewer.',
      null, jsonb_build_object('reviewer_id', new.reviewer_id, 'enrollment_id', new.enrollment_id)
    );
  end if;

  begin
    select coalesce(app.academy_person_name(e.profile_id), 'A trainee') into v_name
    from public.academy_enrollment e
    where e.id = new.enrollment_id;
    v_label := app.academy_hold_label(new);
    perform app.notify_staff(
      app.academy_flag_recipients(new.reviewer_id),
      'academy_quiz_flag',
      'important',
      'Quiz flagged',
      coalesce(v_name, 'A trainee') || ' used every attempt on ' || coalesce(v_label, 'a quiz') || ' and is on review.',
      null
    );
  exception when others then
    perform app.audit(
      'academy.quiz_flag_notice_failed', 'academy_hold', new.id::text,
      'The review was opened, and the staff notice was not saved.',
      null, jsonb_build_object('enrollment_id', new.enrollment_id)
    );
  end;
  return null;
end;
$$;

create or replace function app.academy_flag_lesson_quiz(
  p_enrollment uuid,
  p_lesson uuid,
  p_used integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hold uuid;
  v_summary text;
  v_label text;
begin
  update public.academy_enrollment
  set status = 'on_hold_review'
  where id = p_enrollment and status in ('active', 'stalled', 'completed');

  select h.id into v_hold
  from public.academy_hold h
  where h.enrollment_id = p_enrollment and h.status in ('open', 'under_review')
  limit 1;

  if v_hold is null then
    select string_agg(format('%s (%s)', concept, n), ', ' order by n desc, concept) into v_summary
    from (
      select coalesce(c.name, 'Question') as concept, count(*) as n
      from public.academy_lesson_quiz_attempt a
      cross join lateral unnest(a.questions_drawn) qid
      join public.academy_question q on q.id = qid
      left join public.academy_concept c on c.id = q.concept_id
      where a.enrollment_id = p_enrollment and a.lesson_id = p_lesson and a.finished_at is not null
        and coalesce(a.answers ->> qid::text, '') is distinct from q.correct_answer
      group by 1
    ) missed;

    insert into public.academy_hold (enrollment_id, lesson_id, reason, attempts_used, status, concept_summary)
    values (
      p_enrollment,
      p_lesson,
      'Failed every lesson quiz attempt',
      p_used,
      'open',
      v_summary
    )
    returning id into v_hold;

    insert into public.academy_hold_lesson (hold_id, lesson_id)
    values (v_hold, p_lesson)
    on conflict do nothing;

    perform app.audit(
      'academy.hold_opened', 'academy_hold', p_enrollment::text,
      'Enrollment placed on review after the last lesson quiz attempt',
      null, jsonb_build_object('lesson_id', p_lesson, 'attempts_used', p_used, 'concept_summary', v_summary)
    );
  end if;

  select format('%s %s', l.lesson_code, l.title) into v_label
  from public.academy_lesson l
  where l.id = p_lesson;

  perform app.audit(
    'academy.quiz_flagged', 'academy_enrollment', p_enrollment::text,
    'Trainee flagged after using every lesson quiz attempt',
    null, jsonb_build_object('lesson_id', p_lesson, 'lesson', v_label, 'attempts_used', p_used, 'hold_id', v_hold)
  );
end;
$$;

revoke all on function app.academy_flag_lesson_quiz(uuid, uuid, integer) from public, anon, authenticated;

create or replace function app.academy_hold_public(p_enrollment_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'manager_name', coalesce(app.academy_person_name(e.manager_id), 'your manager'),
    'opened_at', h.opened_at,
    'review_started_at', h.review_started_at,
    'status', h.status,
    'quiz_name', app.academy_hold_label(h),
    'attempts_used', h.attempts_used
  )
  from public.academy_hold h
  join public.academy_enrollment e on e.id = h.enrollment_id
  where h.enrollment_id = p_enrollment_id
    and h.status in ('open', 'under_review')
  order by h.opened_at desc
  limit 1;
$$;

create or replace function app.academy_remediation_public(p_enrollment_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.academy_hold;
  v_lessons jsonb;
  v_modules jsonb;
begin
  select * into v from public.academy_hold
  where enrollment_id = p_enrollment_id
    and status = 'resolved'
    and outcome in ('reset', 'extend')
  order by resolved_at desc
  limit 1;
  if v.id is null then
    return null;
  end if;
  if exists (
    select 1 from public.academy_attempt a
    where a.enrollment_id = v.enrollment_id and a.quiz_id = v.quiz_id
      and a.passed is true and a.finished_at > v.resolved_at
  ) or exists (
    select 1 from public.academy_lesson_quiz_attempt a
    where a.enrollment_id = v.enrollment_id and a.lesson_id = v.lesson_id
      and a.passed is true and a.finished_at > v.resolved_at
  ) then
    return null;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', l.id,
    'title', l.title,
    'code', l.lesson_code,
    'module_id', l.module_id,
    'reopened', exists (
      select 1 from public.academy_progress pr
      where pr.enrollment_id = p_enrollment_id and pr.lesson_id = l.id
        and pr.last_opened_at > v.resolved_at
    )
  ) order by l.sort_order), '[]'::jsonb) into v_lessons
  from public.academy_hold_lesson hl
  join public.academy_lesson l on l.id = hl.lesson_id
  where hl.hold_id = v.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id,
    'order', m.order_number,
    'title', m.title,
    'reopened', not exists (
      select 1 from public.academy_lesson l
      where l.module_id = m.id and l.published and l.archived_at is null
        and not exists (
          select 1 from public.academy_progress pr
          where pr.enrollment_id = p_enrollment_id and pr.lesson_id = l.id
            and pr.last_opened_at > v.resolved_at
        )
    )
  ) order by m.order_number), '[]'::jsonb) into v_modules
  from public.academy_hold_module hm
  join public.academy_module m on m.id = hm.module_id
  where hm.hold_id = v.id;

  return jsonb_build_object(
    'hold_id', v.id,
    'outcome', v.outcome,
    'plan', v.remediation_plan,
    'attempts_granted', v.attempts_granted,
    'retest_on', v.retest_on,
    'acknowledged_at', v.acknowledged_at,
    'lessons', v_lessons,
    'modules', v_modules
  );
end;
$$;

create or replace function app.academy_hold_apply_plan(
  p_hold public.academy_hold,
  p_outcome text,
  p_plan text,
  p_attempts integer,
  p_retest date,
  p_lesson_ids uuid[],
  p_module_ids uuid[]
)
returns public.academy_hold
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v public.academy_hold := p_hold;
  v_quiz public.academy_quiz;
  v_attempts integer;
  v_enrollment public.academy_enrollment;
begin
  perform app.academy_hold_refuse_self(v.enrollment_id);
  perform app.academy_hold_require_open(v);
  if v.status <> 'under_review' then
    raise exception 'not_started: open the hold before resolving it' using errcode = '42501';
  end if;
  if not app.academy_hold_checklist_ready(v) then
    raise exception 'checklist_open: finish the checklist and add a note' using errcode = '42501';
  end if;
  perform app.academy_hold_require_list('struggle', v.struggle_reason);
  if p_outcome not in ('reset', 'extend') then
    raise exception 'bad_outcome: choose reset or extend' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_plan, ''))) = 0 then
    raise exception 'plan_empty: write the remediation plan' using errcode = '22023';
  end if;
  select coalesce(p_attempts, s.default_attempts_granted, 3) into v_attempts
  from public.academy_setting s where s.id = 1;
  if v_attempts is null or v_attempts < 1 then
    raise exception 'attempts_required: grant at least one attempt' using errcode = '22023';
  end if;
  if p_outcome = 'extend' and p_retest is null then
    raise exception 'retest_required: set the re-test date' using errcode = '22023';
  end if;
  select * into v_quiz from public.academy_quiz where id = v.quiz_id;
  select * into v_enrollment from public.academy_enrollment where id = v.enrollment_id;

  if p_lesson_ids is not null and exists (
    select 1 from unnest(p_lesson_ids) lid
    where not exists (
      select 1 from public.academy_lesson l
      join public.academy_module m on m.id = l.module_id
      where l.id = lid and m.program_id = v_enrollment.program_id
    )
  ) then
    raise exception 'lesson_closed: that lesson is not in this program' using errcode = '22023';
  end if;
  if p_module_ids is not null and exists (
    select 1 from unnest(p_module_ids) mid
    where not exists (
      select 1 from public.academy_module m
      where m.id = mid and m.program_id = v_enrollment.program_id
    )
  ) then
    raise exception 'module_closed: that module is not in this program' using errcode = '22023';
  end if;
  if v_quiz.kind = 'final' and coalesce(array_length(p_module_ids, 1), 0) < 1 then
    raise exception 'modules_required: name the modules to review' using errcode = '22023';
  end if;

  delete from public.academy_hold_lesson where hold_id = v.id;
  delete from public.academy_hold_module where hold_id = v.id;
  if p_lesson_ids is not null then
    insert into public.academy_hold_lesson (hold_id, lesson_id)
    select v.id, lid from unnest(p_lesson_ids) lid;
  end if;
  if p_module_ids is not null then
    insert into public.academy_hold_module (hold_id, module_id)
    select v.id, mid from unnest(p_module_ids) mid;
  end if;

  update public.academy_hold
  set status = 'resolved',
      outcome = p_outcome,
      resolved_at = now(),
      resolved_by = app.acting_profile(),
      remediation_plan = btrim(p_plan),
      attempts_granted = v_attempts,
      retest_on = case when p_outcome = 'extend' then p_retest else null end,
      acknowledged_at = null
  where id = v.id
  returning * into v;

  update public.academy_enrollment set status = 'active' where id = v.enrollment_id;

  if v.quiz_id is not null then
    insert into public.academy_quiz_allowance (enrollment_id, quiz_id, extra_attempts)
    values (v.enrollment_id, v.quiz_id, v_attempts)
    on conflict (enrollment_id, quiz_id) do update
      set extra_attempts = public.academy_quiz_allowance.extra_attempts + excluded.extra_attempts;
  end if;

  if v.lesson_id is not null then
    insert into public.academy_lesson_quiz_allowance (enrollment_id, lesson_id, extra_attempts)
    values (v.enrollment_id, v.lesson_id, v_attempts)
    on conflict (enrollment_id, lesson_id) do update
      set extra_attempts = public.academy_lesson_quiz_allowance.extra_attempts + excluded.extra_attempts;
  end if;

  update public.academy_attempt
  set lockout_until = null
  where id = (
    select a.id from public.academy_attempt a
    where a.enrollment_id = v.enrollment_id and a.quiz_id = v.quiz_id
      and a.finished_at is not null and a.passed is not true
    order by a.finished_at desc
    limit 1
  );

  perform app.audit(
    'academy.hold_resolved', 'academy_hold', v.id::text,
    case when p_outcome = 'extend' then 'Hold extended.' else 'Hold reset.' end,
    null, jsonb_build_object(
      'outcome', p_outcome,
      'reviewer_id', app.acting_profile(),
      'remediation_plan', v.remediation_plan,
      'attempts_granted', v.attempts_granted,
      'retest_on', v.retest_on
    )
  );
  return v;
end;
$$;

create or replace function public.academy_hold_queue(
  p_status text,
  p_reviewer uuid,
  p_quiz uuid,
  p_unassigned boolean
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_counts jsonb;
  v_rows jsonb;
  v_reviewers jsonb;
  v_quizzes jsonb;
begin
  if not app.academy_manages() and not app.academy_reviews() then
    raise exception 'permission_denied: this queue is for reviewers' using errcode = '42501';
  end if;
  perform public.academy_hold_prepare();

  with visible as (
    select h.*
    from public.academy_hold h
    where app.academy_manages() or h.reviewer_id = app.acting_profile()
  )
  select jsonb_build_object(
    'open', count(*) filter (where status = 'open'),
    'under_review', count(*) filter (where status = 'under_review'),
    'overdue', count(*) filter (where status in ('open', 'under_review') and deadline_at <= now()),
    'resolved_30', count(*) filter (where status = 'resolved' and resolved_at >= now() - interval '30 days')
  ) into v_counts
  from visible;

  with visible as (
    select h.*
    from public.academy_hold h
    where (app.academy_manages() or h.reviewer_id = app.acting_profile())
      and (p_reviewer is null or h.reviewer_id = p_reviewer)
      and (p_quiz is null or h.quiz_id = p_quiz)
      and (not coalesce(p_unassigned, false) or h.reviewer_id is null)
      and (
        (p_status is null and h.status in ('open', 'under_review'))
        or (p_status = 'open' and h.status = 'open')
        or (p_status = 'under_review' and h.status = 'under_review')
        or (p_status = 'resolved' and h.status = 'resolved')
        or (p_status = 'overdue' and h.status in ('open', 'under_review') and h.deadline_at <= now())
        or p_status = 'all'
      )
  )
  select coalesce(jsonb_agg(row_data order by sort_overdue, sort_resolved desc nulls last, sort_opened), '[]'::jsonb)
  into v_rows
  from (
    select
      jsonb_build_object(
        'id', h.id,
        'trainee_name', coalesce(app.academy_person_name(e.profile_id), 'Unknown'),
        'program', p.name,
        'quiz_id', h.quiz_id,
        'quiz_label', app.academy_hold_label(h),
        'module_title', coalesce(m.title, lm.title),
        'attempts_used', h.attempts_used,
        'opened_at', h.opened_at,
        'reviewer_id', h.reviewer_id,
        'reviewer_name', case when h.reviewer_id is null then null else app.academy_person_name(h.reviewer_id) end,
        'status', h.status,
        'outcome', h.outcome,
        'days_open', greatest(floor(extract(epoch from (coalesce(h.resolved_at, now()) - h.opened_at)) / 86400), 0)::int,
        'overdue', h.status in ('open', 'under_review') and h.deadline_at <= now(),
        'unassigned', h.reviewer_id is null,
        'deadline_at', h.deadline_at
      ) as row_data,
      case when h.status in ('open', 'under_review') and h.deadline_at <= now() then 0 else 1 end as sort_overdue,
      case when p_status = 'resolved' then h.resolved_at else null end as sort_resolved,
      h.opened_at as sort_opened
    from visible h
    join public.academy_enrollment e on e.id = h.enrollment_id
    join public.academy_program p on p.id = e.program_id
    left join public.academy_quiz q on q.id = h.quiz_id
    left join public.academy_module m on m.id = q.module_id
    left join public.academy_lesson les on les.id = h.lesson_id
    left join public.academy_module lm on lm.id = les.module_id
  ) listed;

  if app.academy_manages() then
    select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', app.academy_person_name(p.id)) order by app.academy_person_name(p.id)), '[]'::jsonb)
    into v_reviewers
    from public.profile p
    where app.effective_state(p.id) = 'active'
      and (
        coalesce((select d.allowed from app.decide('academy.review', p.id) d), false)
        or coalesce((select d.allowed from app.decide('academy.manage', p.id) d), false)
      );
    select coalesce(jsonb_agg(distinct jsonb_build_object(
      'id', q.id,
      'label', case when q.kind = 'final' then 'Final Quiz' else format('Module %s quiz', m.order_number) end
    )), '[]'::jsonb) into v_quizzes
    from public.academy_hold h
    join public.academy_quiz q on q.id = h.quiz_id
    left join public.academy_module m on m.id = q.module_id;
  else
    v_reviewers := '[]'::jsonb;
    v_quizzes := '[]'::jsonb;
  end if;

  return jsonb_build_object('counts', v_counts, 'holds', v_rows, 'reviewers', v_reviewers, 'quizzes', v_quizzes);
end;
$$;

create or replace function public.academy_lesson_quiz_state(p_lesson_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_enrollment public.academy_enrollment;
  v_used integer;
  v_allowed integer;
  v_open public.academy_lesson_quiz_attempt;
  v_passed boolean;
begin
  if not app.academy_lesson_has_quiz(p_lesson_id) then
    return jsonb_build_object('has_quiz', false);
  end if;
  if app.academy_manages() then
    return jsonb_build_object(
      'has_quiz', true,
      'passed', false,
      'attempts_used', 0,
      'attempts_allowed', 3,
      'attempts_remaining', 3,
      'pass_percent', 85,
      'preview', true,
      'flagged', false,
      'questions', app.academy_lesson_quiz_questions(array(
        select q.id
        from public.academy_question q
        join public.academy_concept c on c.id = q.concept_id
        where c.lesson_id = p_lesson_id and q.active
        order by q.created_at
      ))
    );
  end if;
  v_enrollment := app.academy_primary_for_actor();
  if v_enrollment.id is null
     or not app.academy_content_open(v_enrollment.id)
     or not app.academy_lesson_open(v_enrollment.id, p_lesson_id) then
    return jsonb_build_object('has_quiz', false);
  end if;
  v_allowed := app.academy_lesson_attempts_allowed(v_enrollment.id, p_lesson_id);
  select count(*) into v_used
  from public.academy_lesson_quiz_attempt
  where enrollment_id = v_enrollment.id and lesson_id = p_lesson_id and finished_at is not null;
  v_passed := app.academy_lesson_quiz_passed(v_enrollment.id, p_lesson_id);
  select * into v_open
  from public.academy_lesson_quiz_attempt
  where enrollment_id = v_enrollment.id and lesson_id = p_lesson_id and finished_at is null
  order by started_at desc
  limit 1;
  return jsonb_build_object(
    'has_quiz', true,
    'passed', v_passed,
    'attempts_used', v_used,
    'attempts_allowed', v_allowed,
    'attempts_remaining', greatest(v_allowed - v_used, 0),
    'pass_percent', 85,
    'preview', false,
    'flagged', (not v_passed) and v_used >= v_allowed,
    'attempt', case when v_open.id is null then null else jsonb_build_object(
      'id', v_open.id,
      'answers', v_open.answers,
      'questions', app.academy_lesson_quiz_questions(v_open.questions_drawn)
    ) end
  );
end;
$$;

create or replace function public.academy_lesson_quiz_start(p_lesson_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_enrollment public.academy_enrollment := app.academy_primary_for_actor();
  v_used integer;
  v_allowed integer;
  v_open public.academy_lesson_quiz_attempt;
  v_ids uuid[];
begin
  if v_enrollment.id is null or not app.academy_lesson_open(v_enrollment.id, p_lesson_id) then
    raise exception 'lesson_closed' using errcode = '42501';
  end if;
  if not app.academy_lesson_has_quiz(p_lesson_id) then
    raise exception 'no_quiz: this lesson has no quiz' using errcode = 'P0002';
  end if;
  if app.academy_lesson_quiz_passed(v_enrollment.id, p_lesson_id) then
    raise exception 'already_passed: this lesson quiz is already passed' using errcode = '42501';
  end if;
  select * into v_open
  from public.academy_lesson_quiz_attempt
  where enrollment_id = v_enrollment.id and lesson_id = p_lesson_id and finished_at is null
  limit 1;
  if v_open.id is not null then
    return public.academy_lesson_quiz_state(p_lesson_id);
  end if;
  v_allowed := app.academy_lesson_attempts_allowed(v_enrollment.id, p_lesson_id);
  select count(*) into v_used
  from public.academy_lesson_quiz_attempt
  where enrollment_id = v_enrollment.id and lesson_id = p_lesson_id and finished_at is not null;
  if v_used >= v_allowed then
    raise exception 'attempts_used: this lesson quiz has no attempts left' using errcode = '42501';
  end if;
  select coalesce(array_agg(q.id order by random()), '{}') into v_ids
  from public.academy_question q
  join public.academy_concept c on c.id = q.concept_id
  where c.lesson_id = p_lesson_id and q.active;
  insert into public.academy_lesson_quiz_attempt (enrollment_id, lesson_id, questions_drawn)
  values (v_enrollment.id, p_lesson_id, v_ids);
  return public.academy_lesson_quiz_state(p_lesson_id);
end;
$$;

create or replace function public.academy_lesson_quiz_submit(p_attempt_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_enrollment public.academy_enrollment := app.academy_primary_for_actor();
  v public.academy_lesson_quiz_attempt;
  v_q uuid;
  v_selected text;
  v_correct_id text;
  v_score integer := 0;
  v_total integer := 0;
  v_percent numeric;
  v_passed boolean;
  v_used integer;
  v_allowed integer;
  v_flagged boolean := false;
begin
  select * into v from public.academy_lesson_quiz_attempt where id = p_attempt_id for update;
  if v.id is null or v.enrollment_id is distinct from v_enrollment.id or v.finished_at is not null then
    raise exception 'attempt_closed' using errcode = '42501';
  end if;
  foreach v_q in array v.questions_drawn
  loop
    v_total := v_total + 1;
    v_selected := v.answers ->> v_q::text;
    select correct_answer into v_correct_id from public.academy_question where id = v_q;
    if v_selected is not null and v_selected = v_correct_id then
      v_score := v_score + 1;
    end if;
  end loop;
  v_percent := case when v_total = 0 then 0 else round(100.0 * v_score / v_total, 1) end;
  v_passed := v_total > 0 and (v_score::numeric / v_total * 100) >= 85;
  update public.academy_lesson_quiz_attempt
  set score = v_score,
      total = v_total,
      passed = v_passed,
      finished_at = now()
  where id = v.id;
  v_allowed := app.academy_lesson_attempts_allowed(v.enrollment_id, v.lesson_id);
  select count(*) into v_used
  from public.academy_lesson_quiz_attempt
  where enrollment_id = v.enrollment_id and lesson_id = v.lesson_id and finished_at is not null;
  if not v_passed and v_used >= v_allowed then
    perform app.academy_flag_lesson_quiz(v.enrollment_id, v.lesson_id, v_used);
    v_flagged := true;
  end if;
  return jsonb_build_object(
    'has_quiz', true,
    'passed', v_passed,
    'attempts_used', v_used,
    'attempts_allowed', v_allowed,
    'attempts_remaining', greatest(v_allowed - v_used, 0),
    'pass_percent', 85,
    'preview', false,
    'flagged', v_flagged,
    'result', jsonb_build_object('score', v_score, 'total', v_total, 'percent', v_percent, 'passed', v_passed)
  );
end;
$$;
