-- Hold reviews. The quiz engine opens a hold. This prompt lets a reviewer
-- resolve it, and lets the trainee see only the status and the plan.
-- Nothing here sends a message.

alter table public.academy_setting
  add column review_deadline_days integer not null default 5 check (review_deadline_days between 1 and 60),
  add column default_attempts_granted integer not null default 3 check (default_attempts_granted between 1 and 20);

comment on column public.academy_setting.review_deadline_days is
  'Days from the date a hold opens until it is overdue. An Academy Admin can change it.';
comment on column public.academy_setting.default_attempts_granted is
  'Extra quiz attempts a Reset or Extend grants when the reviewer does not type a number.';

alter table public.academy_hold
  add column deadline_at timestamptz,
  add column review_started_at timestamptz,
  add column review_started_by uuid references public.profile (id),
  add column resolved_by uuid references public.profile (id),
  add column retest_on date,
  add column acknowledged_at timestamptz,
  add column release_requested_at timestamptz,
  add column release_requested_by uuid references public.profile (id),
  add column release_reason text,
  add column release_note text,
  add column confirmed_by uuid references public.profile (id),
  add column confirmed_at timestamptz,
  add column call_held_on date,
  add column call_note text,
  add column concept_check_note text,
  add column struggle_reason text,
  add column struggle_note text,
  add column operator_status_before text,
  add column reopened_at timestamptz,
  add column reopened_by uuid references public.profile (id),
  add column reopen_note text;

comment on table public.academy_hold is
  'A review opened when a trainee uses the last quiz attempt. Trainees cannot read this table.';
comment on column public.academy_hold.deadline_at is
  'Copied from the deadline setting when the hold opens. Later setting changes do not move it.';
comment on column public.academy_hold.operator_status_before is
  'The operator status before a confirmed Release, so a reopen can put it back.';

create unique index academy_hold_one_open
  on public.academy_hold (enrollment_id)
  where status in ('open', 'under_review');

create index academy_hold_reviewer_idx on public.academy_hold (reviewer_id);
create index academy_hold_deadline_idx on public.academy_hold (deadline_at);

create table public.academy_hold_note (
  id uuid primary key default gen_random_uuid(),
  hold_id uuid not null references public.academy_hold (id) on delete cascade,
  author_id uuid not null references public.profile (id),
  body text not null check (length(btrim(body)) > 0),
  created_at timestamptz not null default now()
);

comment on table public.academy_hold_note is
  'Internal review notes. Trainees cannot read them.';

create index academy_hold_note_hold_idx on public.academy_hold_note (hold_id, created_at);

create table public.academy_hold_lesson (
  hold_id uuid not null references public.academy_hold (id) on delete cascade,
  lesson_id uuid not null references public.academy_lesson (id) on delete cascade,
  primary key (hold_id, lesson_id)
);

create table public.academy_hold_module (
  hold_id uuid not null references public.academy_hold (id) on delete cascade,
  module_id uuid not null references public.academy_module (id) on delete cascade,
  primary key (hold_id, module_id)
);

comment on table public.academy_hold_module is
  'Modules named in a Final Quiz plan. The trainee reopens their lessons before the retry.';

create table public.academy_hold_event (
  id uuid primary key default gen_random_uuid(),
  hold_id uuid not null references public.academy_hold (id) on delete cascade,
  kind text not null check (kind in ('reminder', 'escalation', 'unassigned')),
  reviewer_id uuid references public.profile (id),
  created_at timestamptz not null default now(),
  unique (hold_id, kind)
);

comment on table public.academy_hold_event is
  'A reminder, an overdue mark, or an unassigned hold. Nothing is sent from here.';

create table public.academy_hold_list_item (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('struggle', 'release')),
  label text not null check (length(btrim(label)) between 1 and 120),
  active boolean not null default true,
  sort_order integer not null default 1,
  unique (kind, label)
);

comment on table public.academy_hold_list_item is
  'The reasons a reviewer can choose. An Academy Admin edits the list.';

insert into public.academy_hold_list_item (kind, label, sort_order) values
  ('struggle', 'Did not engage with the material', 1),
  ('struggle', 'Rushed', 2),
  ('struggle', 'Concept not clear', 3),
  ('struggle', 'Outside circumstances', 4),
  ('struggle', 'Language or reading difficulty', 5),
  ('struggle', 'Other', 6),
  ('release', 'Did not complete remediation', 1),
  ('release', 'Not a fit for the role', 2),
  ('release', 'Withdrew from the process', 3),
  ('release', 'Other', 4);

-- ---------------------------------------------------------------------------
-- Stamp the reviewer and the deadline when a hold opens. One open hold.
-- ---------------------------------------------------------------------------

create or replace function app.academy_hold_before_one()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('open', 'under_review') and exists (
    select 1 from public.academy_hold h
    where h.enrollment_id = new.enrollment_id
      and h.status in ('open', 'under_review')
  ) then
    return null;
  end if;
  return new;
end;
$$;

create or replace function app.academy_hold_before_stamp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_days integer;
begin
  if new.reviewer_id is null then
    select e.manager_id into new.reviewer_id
    from public.academy_enrollment e
    where e.id = new.enrollment_id;
  end if;
  if new.deadline_at is null then
    select s.review_deadline_days into v_days from public.academy_setting s where s.id = 1;
    new.deadline_at := coalesce(new.opened_at, now()) + make_interval(days => coalesce(v_days, 5));
  end if;
  return new;
end;
$$;

create or replace function app.academy_hold_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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
  return null;
end;
$$;

create trigger academy_hold_before_one
  before insert on public.academy_hold
  for each row execute function app.academy_hold_before_one();

create trigger academy_hold_before_stamp
  before insert on public.academy_hold
  for each row execute function app.academy_hold_before_stamp();

create trigger academy_hold_after_insert
  after insert on public.academy_hold
  for each row execute function app.academy_hold_after_insert();

update public.academy_hold h
set reviewer_id = e.manager_id
from public.academy_enrollment e
where e.id = h.enrollment_id and h.reviewer_id is null and e.manager_id is not null;

update public.academy_hold h
set deadline_at = h.opened_at + make_interval(days => s.review_deadline_days)
from public.academy_setting s
where s.id = 1 and h.deadline_at is null;

-- ---------------------------------------------------------------------------
-- Access and deadline events.
-- ---------------------------------------------------------------------------

create or replace function app.academy_person_name(p_profile_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    nullif(btrim(p.full_name), ''),
    nullif(btrim(o.name), ''),
    p.email,
    'Unknown'
  )
  from public.profile p
  left join public.operator o on o.profile_id = p.id
  where p.id = p_profile_id;
$$;

create or replace function app.academy_hold_visible(p_reviewer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.academy_manages()
    or (app.academy_reviews() and p_reviewer_id is not null and p_reviewer_id = app.acting_profile());
$$;

create or replace function app.academy_hold_load(p_hold_id uuid)
returns public.academy_hold
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.academy_hold;
begin
  select * into v from public.academy_hold where id = p_hold_id;
  if v.id is null then
    raise exception 'not_found: that hold does not exist' using errcode = 'P0002';
  end if;
  if not app.academy_hold_visible(v.reviewer_id) then
    raise exception 'permission_denied: this hold is not yours' using errcode = '42501';
  end if;
  return v;
end;
$$;

create or replace function app.academy_hold_refuse_self(p_enrollment_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.academy_enrollment e
    where e.id = p_enrollment_id and e.profile_id = app.acting_profile()
  ) then
    raise exception 'self_review: you cannot resolve a hold for yourself' using errcode = '42501';
  end if;
end;
$$;

create or replace function app.academy_hold_checklist_ready(p_hold public.academy_hold)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_hold.call_held_on is not null
    and length(btrim(coalesce(p_hold.call_note, ''))) > 0
    and length(btrim(coalesce(p_hold.concept_check_note, ''))) > 0
    and length(btrim(coalesce(p_hold.struggle_reason, ''))) > 0
    and length(btrim(coalesce(p_hold.struggle_note, ''))) > 0
    and exists (select 1 from public.academy_hold_note n where n.hold_id = p_hold.id);
$$;

create or replace function app.academy_hold_record_deadlines(p_ids uuid[])
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v public.academy_hold;
begin
  for v in
    select * from public.academy_hold
    where id = any(coalesce(p_ids, '{}'))
      and status in ('open', 'under_review')
  loop
    if v.reviewer_id is null and not exists (
      select 1 from public.academy_hold_event e where e.hold_id = v.id and e.kind = 'unassigned'
    ) then
      insert into public.academy_hold_event (hold_id, kind, reviewer_id)
      values (v.id, 'unassigned', null);
      perform app.audit(
        'academy.hold_unassigned', 'academy_hold', v.id::text,
        'A hold has no reviewer.',
        null, jsonb_build_object('enrollment_id', v.enrollment_id)
      );
    end if;
    if v.deadline_at is not null
       and now() >= v.deadline_at - interval '24 hours'
       and now() < v.deadline_at
       and not exists (
         select 1 from public.academy_hold_event e where e.hold_id = v.id and e.kind = 'reminder'
       ) then
      insert into public.academy_hold_event (hold_id, kind, reviewer_id)
      values (v.id, 'reminder', v.reviewer_id);
      perform app.audit(
        'academy.hold_reminder', 'academy_hold', v.id::text,
        'Review deadline is inside 24 hours. Nothing was sent.',
        null, jsonb_build_object('reviewer_id', v.reviewer_id, 'deadline_at', v.deadline_at)
      );
    end if;
    if v.deadline_at is not null
       and now() >= v.deadline_at
       and not exists (
         select 1 from public.academy_hold_event e where e.hold_id = v.id and e.kind = 'escalation'
       ) then
      insert into public.academy_hold_event (hold_id, kind, reviewer_id)
      values (v.id, 'escalation', v.reviewer_id);
      perform app.audit(
        'academy.hold_escalated', 'academy_hold', v.id::text,
        'The hold is past its review deadline. Nothing was sent.',
        null, jsonb_build_object('reviewer_id', v.reviewer_id, 'deadline_at', v.deadline_at)
      );
    end if;
  end loop;
end;
$$;

create or replace function public.academy_hold_prepare()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if app.academy_manages() then
    perform app.academy_hold_record_deadlines(array(
      select h.id from public.academy_hold h where h.status in ('open', 'under_review')
    ));
  elsif app.academy_reviews() then
    perform app.academy_hold_record_deadlines(array(
      select h.id from public.academy_hold h
      where h.status in ('open', 'under_review') and h.reviewer_id = app.acting_profile()
    ));
  end if;
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
  perform app.academy_hold_record_deadlines(array(
    select h.id from public.academy_hold h
    where h.enrollment_id = v_enrollment.id and h.status in ('open', 'under_review')
  ));
end;
$$;

-- ---------------------------------------------------------------------------
-- What a trainee is allowed to see. No notes, no flags, no other people.
-- ---------------------------------------------------------------------------

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
    'status', h.status
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

create or replace function app.academy_retry_gate(p_enrollment_id uuid, p_quiz public.academy_quiz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.academy_hold;
  v_block text;
begin
  select * into v from public.academy_hold
  where enrollment_id = p_enrollment_id and quiz_id = p_quiz.id
    and status = 'resolved' and outcome in ('reset', 'extend')
  order by resolved_at desc
  limit 1;
  if v.id is null then
    return jsonb_build_object('block', null, 'retest_on', null);
  end if;
  if exists (
    select 1 from public.academy_attempt a
    where a.enrollment_id = p_enrollment_id and a.quiz_id = p_quiz.id
      and a.started_at > v.resolved_at
  ) then
    return jsonb_build_object('block', null, 'retest_on', v.retest_on);
  end if;
  if v.acknowledged_at is null then
    v_block := 'acknowledge';
  elsif v.outcome = 'extend' and v.retest_on > current_date then
    v_block := 'retest';
  elsif exists (
    select 1 from public.academy_hold_module hm
    join public.academy_lesson l on l.module_id = hm.module_id
    where hm.hold_id = v.id and l.published and l.archived_at is null
      and not exists (
        select 1 from public.academy_progress pr
        where pr.enrollment_id = p_enrollment_id and pr.lesson_id = l.id
          and pr.last_opened_at > v.resolved_at
      )
  ) or exists (
    select 1 from public.academy_hold_lesson hl
    where hl.hold_id = v.id
      and not exists (
        select 1 from public.academy_progress pr
        where pr.enrollment_id = p_enrollment_id and pr.lesson_id = hl.lesson_id
          and pr.last_opened_at > v.resolved_at
      )
  ) then
    v_block := 'lessons';
  end if;
  return jsonb_build_object('block', v_block, 'retest_on', v.retest_on);
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
  v_gate jsonb := '{}'::jsonb;
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

  v_gate := app.academy_retry_gate(p_enrollment_id, v_quiz);
  if v_gate ->> 'block' is not null and v_status = 'available' then
    v_status := 'locked';
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
    'reopen', v_reopen,
    'retry_block', v_gate -> 'block',
    'retest_on', v_gate -> 'retest_on'
  );
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
      'progress', v_progress, 'current_module', null, 'next_action', null, 'banner', null,
      'modules', '[]'::jsonb, 'hold', null, 'remediation', null
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
    'modules', v_modules,
    'hold', case when v_state = 'on_hold' then app.academy_hold_public(v_enrollment.id) else null end,
    'remediation', case when v_state in ('active', 'stalled', 'completed') then app.academy_remediation_public(v_enrollment.id) else null end
  );
end;
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
      when v_card ->> 'retry_block' = 'acknowledge' then 'acknowledge'
      when v_card ->> 'retry_block' = 'retest' then 'retest'
      when v_card ->> 'retry_block' = 'lessons' then 'plan_lessons'
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
    'retest_on', v_card -> 'retest_on',
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

-- ---------------------------------------------------------------------------
-- Reviewer and admin actions.
-- ---------------------------------------------------------------------------

create or replace function app.academy_hold_require_open(p_hold public.academy_hold)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_hold.status = 'resolved' then
    raise exception 'already_resolved: this hold is already resolved' using errcode = '42501';
  end if;
end;
$$;

create or replace function app.academy_hold_require_list(p_kind text, p_label text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.academy_hold_list_item
    where kind = p_kind and active and label = btrim(p_label)
  ) then
    raise exception 'reason_closed: choose a reason from the list' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.academy_hold_begin(p_hold_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v public.academy_hold := app.academy_hold_load(p_hold_id);
  v_profile uuid;
begin
  select e.profile_id into v_profile from public.academy_enrollment e where e.id = v.enrollment_id;
  if v_profile = app.acting_profile() or v.status <> 'open' then
    return;
  end if;
  update public.academy_hold
  set status = 'under_review',
      review_started_at = now(),
      review_started_by = app.acting_profile()
  where id = v.id and status = 'open';
  perform app.audit(
    'academy.hold_started', 'academy_hold', v.id::text,
    'Review started.',
    null, jsonb_build_object('reviewer_id', app.acting_profile())
  );
end;
$$;

create or replace function public.academy_hold_add_note(p_hold_id uuid, p_body text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v public.academy_hold := app.academy_hold_load(p_hold_id);
  v_id uuid;
begin
  perform app.academy_hold_require_open(v);
  if length(btrim(coalesce(p_body, ''))) = 0 then
    raise exception 'note_empty: write the note' using errcode = '22023';
  end if;
  insert into public.academy_hold_note (hold_id, author_id, body)
  values (v.id, app.acting_profile(), btrim(p_body))
  returning id into v_id;
  perform app.audit(
    'academy.hold_note', 'academy_hold_note', v_id::text,
    'Review note added.',
    null, jsonb_build_object('hold_id', v.id)
  );
end;
$$;

create or replace function public.academy_hold_save_checklist(
  p_hold_id uuid,
  p_call_on date,
  p_call_note text,
  p_concept_note text,
  p_reason text,
  p_struggle_note text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v public.academy_hold := app.academy_hold_load(p_hold_id);
begin
  perform app.academy_hold_require_open(v);
  if length(btrim(coalesce(p_reason, ''))) > 0 then
    perform app.academy_hold_require_list('struggle', p_reason);
  end if;
  update public.academy_hold
  set call_held_on = p_call_on,
      call_note = nullif(btrim(coalesce(p_call_note, '')), ''),
      concept_check_note = nullif(btrim(coalesce(p_concept_note, '')), ''),
      struggle_reason = nullif(btrim(coalesce(p_reason, '')), ''),
      struggle_note = nullif(btrim(coalesce(p_struggle_note, '')), '')
  where id = v.id;
  perform app.audit(
    'academy.hold_checklist', 'academy_hold', v.id::text,
    'Review checklist saved.',
    null, jsonb_build_object('struggle_reason', nullif(btrim(coalesce(p_reason, '')), ''))
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

  insert into public.academy_quiz_allowance (enrollment_id, quiz_id, extra_attempts)
  values (v.enrollment_id, v.quiz_id, v_attempts)
  on conflict (enrollment_id, quiz_id) do update
    set extra_attempts = public.academy_quiz_allowance.extra_attempts + excluded.extra_attempts;

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

create or replace function public.academy_hold_resolve(
  p_hold_id uuid,
  p_outcome text,
  p_plan text,
  p_attempts integer,
  p_retest date,
  p_lesson_ids uuid[],
  p_module_ids uuid[]
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v public.academy_hold := app.academy_hold_load(p_hold_id);
begin
  perform app.academy_hold_apply_plan(v, p_outcome, p_plan, p_attempts, p_retest, p_lesson_ids, p_module_ids);
end;
$$;

create or replace function public.academy_hold_request_release(
  p_hold_id uuid,
  p_reason text,
  p_note text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v public.academy_hold := app.academy_hold_load(p_hold_id);
begin
  perform app.academy_hold_refuse_self(v.enrollment_id);
  perform app.academy_hold_require_open(v);
  if v.status <> 'under_review' then
    raise exception 'not_started: open the hold before resolving it' using errcode = '42501';
  end if;
  if not app.academy_hold_checklist_ready(v) then
    raise exception 'checklist_open: finish the checklist and add a note' using errcode = '42501';
  end if;
  perform app.academy_hold_require_list('release', p_reason);
  if length(btrim(coalesce(p_note, ''))) = 0 then
    raise exception 'note_empty: write the release note' using errcode = '22023';
  end if;
  update public.academy_hold
  set release_requested_at = now(),
      release_requested_by = app.acting_profile(),
      release_reason = btrim(p_reason),
      release_note = btrim(p_note)
  where id = v.id;
  perform app.audit(
    'academy.hold_release_requested', 'academy_hold', v.id::text,
    'Release requested. An Academy Admin still has to confirm it.',
    null, jsonb_build_object(
      'reviewer_id', app.acting_profile(),
      'release_reason', btrim(p_reason),
      'release_note', btrim(p_note)
    )
  );
end;
$$;

create or replace function public.academy_hold_confirm_release(p_hold_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v public.academy_hold := app.academy_hold_load(p_hold_id);
  v_enrollment public.academy_enrollment;
  v_before text;
begin
  if not app.academy_manages() then
    raise exception 'permission_denied: an Academy Admin confirms a release' using errcode = '42501';
  end if;
  perform app.academy_hold_refuse_self(v.enrollment_id);
  if v.status = 'resolved' then
    raise exception 'already_resolved: this hold is already resolved' using errcode = '42501';
  end if;
  if v.release_requested_at is null or v.release_requested_by is null then
    raise exception 'release_open: a reviewer has to request the release first' using errcode = '42501';
  end if;
  if v.release_requested_by = app.acting_profile() then
    raise exception 'second_person: a different Academy Admin confirms the release' using errcode = '42501';
  end if;
  select * into v_enrollment from public.academy_enrollment where id = v.enrollment_id;
  select o.status::text into v_before from public.operator o where o.profile_id = v_enrollment.profile_id;

  update public.academy_hold
  set status = 'resolved',
      outcome = 'release',
      resolved_at = now(),
      resolved_by = v.release_requested_by,
      confirmed_by = app.acting_profile(),
      confirmed_at = now(),
      operator_status_before = v_before
  where id = v.id;

  update public.academy_enrollment set status = 'withdrawn' where id = v.enrollment_id;
  update public.operator set status = 'inactive' where profile_id = v_enrollment.profile_id;

  perform app.audit(
    'academy.hold_release_confirmed', 'academy_hold', v.id::text,
    'Release confirmed. The enrollment is withdrawn and the operator is inactive.',
    jsonb_build_object('operator_status', v_before),
    jsonb_build_object(
      'confirmed_by', app.acting_profile(),
      'requested_by', v.release_requested_by,
      'release_reason', v.release_reason,
      'release_note', v.release_note,
      'operator_status', 'inactive',
      'enrollment_status', 'withdrawn'
    )
  );
end;
$$;

create or replace function public.academy_hold_reopen(p_hold_id uuid, p_note text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v public.academy_hold := app.academy_hold_load(p_hold_id);
  v_enrollment public.academy_enrollment;
begin
  if not app.academy_manages() then
    raise exception 'permission_denied: an Academy Admin reopens a hold' using errcode = '42501';
  end if;
  if v.status <> 'resolved' or v.outcome is null then
    raise exception 'not_resolved: only a resolved hold can be reopened' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_note, ''))) = 0 then
    raise exception 'note_empty: write why this hold is being reopened' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.academy_hold h
    where h.enrollment_id = v.enrollment_id and h.status in ('open', 'under_review') and h.id <> v.id
  ) then
    raise exception 'hold_open: this enrollment already has an open hold' using errcode = '42501';
  end if;
  if v.quiz_id is not null and exists (
    select 1 from public.academy_attempt a
    where a.enrollment_id = v.enrollment_id and a.quiz_id = v.quiz_id and a.started_at > v.resolved_at
  ) then
    raise exception 'already_retried: this decision was already used' using errcode = '42501';
  end if;

  select * into v_enrollment from public.academy_enrollment where id = v.enrollment_id;
  if v.outcome in ('reset', 'extend') and v.quiz_id is not null then
    update public.academy_quiz_allowance
    set extra_attempts = greatest(extra_attempts - coalesce(v.attempts_granted, 0), 0)
    where enrollment_id = v.enrollment_id and quiz_id = v.quiz_id;
  end if;
  if v.outcome = 'release' and v.operator_status_before is not null then
    update public.operator
    set status = v.operator_status_before::public.operator_status
    where profile_id = v_enrollment.profile_id;
  end if;
  update public.academy_enrollment set status = 'on_hold_review' where id = v.enrollment_id;

  update public.academy_hold
  set status = 'under_review',
      outcome = null,
      resolved_at = null,
      resolved_by = null,
      acknowledged_at = null,
      release_requested_at = null,
      release_requested_by = null,
      confirmed_by = null,
      confirmed_at = null,
      reopened_at = now(),
      reopened_by = app.acting_profile(),
      reopen_note = btrim(p_note)
  where id = v.id;

  perform app.audit(
    'academy.hold_reopened', 'academy_hold', v.id::text,
    'Resolved hold reopened.',
    jsonb_build_object('outcome', v.outcome, 'resolved_at', v.resolved_at),
    jsonb_build_object('note', btrim(p_note), 'reopened_by', app.acting_profile())
  );
end;
$$;

create or replace function public.academy_hold_assign(p_hold_id uuid, p_reviewer_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v public.academy_hold := app.academy_hold_load(p_hold_id);
  v_profile uuid;
  v_can boolean;
begin
  if not app.academy_manages() then
    raise exception 'permission_denied: an Academy Admin assigns a hold' using errcode = '42501';
  end if;
  if v.status = 'resolved' then
    raise exception 'already_resolved: this hold is already resolved' using errcode = '42501';
  end if;
  select e.profile_id into v_profile from public.academy_enrollment e where e.id = v.enrollment_id;
  if p_reviewer_id = v_profile then
    raise exception 'self_review: the trainee cannot be the reviewer' using errcode = '42501';
  end if;
  select coalesce((select allowed from app.decide('academy.review', p_reviewer_id)), false)
    or coalesce((select allowed from app.decide('academy.manage', p_reviewer_id)), false)
  into v_can;
  if not v_can then
    raise exception 'not_a_reviewer: that person cannot review holds' using errcode = '42501';
  end if;
  if v.reviewer_id is not distinct from p_reviewer_id then
    return;
  end if;
  update public.academy_hold set reviewer_id = p_reviewer_id where id = v.id;
  perform app.audit(
    case when v.reviewer_id is null then 'academy.hold_assigned' else 'academy.hold_reassigned' end,
    'academy_hold', v.id::text,
    case when v.reviewer_id is null then 'Hold assigned.' else 'Hold reassigned.' end,
    jsonb_build_object('reviewer_id', v.reviewer_id),
    jsonb_build_object('reviewer_id', p_reviewer_id)
  );
end;
$$;

create or replace function public.academy_hold_acknowledge(p_hold_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v public.academy_hold;
  v_profile uuid := app.acting_profile();
begin
  select h.* into v
  from public.academy_hold h
  join public.academy_enrollment e on e.id = h.enrollment_id
  where h.id = p_hold_id and e.profile_id = v_profile;
  if v.id is null then
    raise exception 'not_found: that plan is not yours' using errcode = 'P0002';
  end if;
  if v.status <> 'resolved' or v.outcome not in ('reset', 'extend') then
    raise exception 'plan_closed: there is no plan to confirm' using errcode = '42501';
  end if;
  if v.acknowledged_at is not null then
    return;
  end if;
  update public.academy_hold set acknowledged_at = now() where id = v.id;
  perform app.audit(
    'academy.hold_acknowledged', 'academy_hold', v.id::text,
    'The trainee confirmed the remediation plan.',
    null, jsonb_build_object('outcome', v.outcome)
  );
end;
$$;

create or replace function public.academy_can_review()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.academy_reviews();
$$;

-- ---------------------------------------------------------------------------
-- Queue, review screen, and summary. Live rows only.
-- ---------------------------------------------------------------------------

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
        'quiz_label', case when q.kind = 'final' then 'Final Quiz' else format('Module %s quiz', m.order_number) end,
        'module_title', m.title,
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
  ) listed;

  if app.academy_manages() then
    select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', app.academy_person_name(p.id)) order by app.academy_person_name(p.id)), '[]'::jsonb)
    into v_reviewers
    from public.profile p
    where app.effective_state(p.id) = 'active'
      and (
        coalesce((select allowed from app.decide('academy.review', p.id)), false)
        or coalesce((select allowed from app.decide('academy.manage', p.id)), false)
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

create or replace function public.academy_hold_detail(p_hold_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.academy_hold := app.academy_hold_load(p_hold_id);
  v_enrollment public.academy_enrollment;
  v_program public.academy_program;
  v_quiz public.academy_quiz;
  v_module public.academy_module;
  v_concepts jsonb := '[]'::jsonb;
  v_top integer := 0;
  v_distinct integer := 0;
  v_pattern text;
  v_attempts jsonb := '[]'::jsonb;
  v_lessons jsonb := '[]'::jsonb;
  v_modules jsonb := '[]'::jsonb;
  v_notes jsonb := '[]'::jsonb;
  v_history jsonb := '[]'::jsonb;
  v_scores jsonb := '[]'::jsonb;
  v_lesson_choices jsonb := '[]'::jsonb;
  v_module_choices jsonb := '[]'::jsonb;
  v_default integer;
begin
  select * into v_enrollment from public.academy_enrollment where id = v.enrollment_id;
  select * into v_program from public.academy_program where id = v_enrollment.program_id;
  select * into v_quiz from public.academy_quiz where id = v.quiz_id;
  select * into v_module from public.academy_module where id = v_quiz.module_id;
  select default_attempts_granted into v_default from public.academy_setting where id = 1;

  select coalesce(jsonb_agg(jsonb_build_object('concept', concept, 'count', n) order by n desc, concept), '[]'::jsonb)
  into v_concepts
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
  select coalesce(max((item ->> 'count')::int), 0), coalesce(count(*), 0)
  into v_top, v_distinct
  from jsonb_array_elements(v_concepts) item;
  v_top := coalesce(v_top, 0);
  v_distinct := coalesce(v_distinct, 0);
  if v_distinct = 0 then
    v_pattern := null;
  elsif v_top >= 2 or v_distinct = 1 then
    v_pattern := 'Same concepts missed repeatedly';
  else
    v_pattern := 'Misses spread across many concepts';
  end if;

  select coalesce(jsonb_agg(to_jsonb(t) order by t.attempt_number), '[]'::jsonb) into v_attempts
  from (
    select
      a.attempt_number,
      a.started_at,
      a.finished_at,
      a.score,
      a.passed,
      a.time_taken_seconds,
      a.abandoned,
      extract(epoch from (a.started_at - lag(a.finished_at) over (order by a.attempt_number)))::int as gap_seconds,
      (
        coalesce(f.flagged_fast, false)
        or (
          not a.abandoned
          and a.time_taken_seconds is not null
          and v_quiz.min_seconds_per_question > 0
          and a.time_taken_seconds < v_quiz.min_seconds_per_question * greatest(coalesce(array_length(a.questions_drawn, 1), 0), 1)
        )
      ) as flagged_fast,
      coalesce(
        extract(epoch from (a.started_at - lag(a.finished_at) over (order by a.attempt_number))) < 120,
        false
      ) as rushed,
      coalesce((
        select jsonb_agg(distinct item ->> 'concept')
        from public.academy_attempt_key k
        cross join lateral jsonb_array_elements(k.questions) item
        where k.attempt_id = a.id and coalesce(item ->> 'concept', '') <> ''
          and not exists (
            select 1 from jsonb_array_elements(coalesce(a.answers, '[]'::jsonb)) ans
            where ans ->> 'question_id' = item ->> 'id' and ans ->> 'option_id' = item ->> 'correct_id'
          )
      ), '[]'::jsonb) as concepts
    from public.academy_attempt a
    left join public.academy_attempt_flag f on f.attempt_id = a.id
    where a.enrollment_id = v.enrollment_id and a.quiz_id = v.quiz_id
  ) t;

  if v_quiz.kind = 'final' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', l.id,
      'code', l.lesson_code,
      'title', l.title,
      'module_order', m.order_number,
      'module_title', m.title,
      'time_spent_seconds', coalesce(pr.time_spent_seconds, 0),
      'length_seconds', coalesce(
        (select asset.duration_seconds from public.academy_asset asset where asset.id = l.video_asset_id),
        app.academy_reading_seconds(l.body)
      ),
      'completed', coalesce(pr.status, '') = 'completed',
      'reopen_required', exists (
        select 1 from public.academy_attempt earlier
        where earlier.enrollment_id = v.enrollment_id and earlier.quiz_id = v.quiz_id
          and l.id = any(earlier.reopen_lesson_ids)
      ),
      'reopened', exists (
        select 1
        from public.academy_attempt earlier
        join public.academy_attempt nxt
          on nxt.enrollment_id = earlier.enrollment_id and nxt.quiz_id = earlier.quiz_id
         and nxt.attempt_number = earlier.attempt_number + 1
        join public.academy_progress opened on opened.enrollment_id = earlier.enrollment_id and opened.lesson_id = l.id
        where earlier.enrollment_id = v.enrollment_id and earlier.quiz_id = v.quiz_id
          and l.id = any(earlier.reopen_lesson_ids)
          and opened.last_opened_at > earlier.finished_at
          and opened.last_opened_at < nxt.started_at
      )
    ) order by m.order_number, l.sort_order), '[]'::jsonb) into v_lessons
    from public.academy_lesson l
    join public.academy_module m on m.id = l.module_id
    left join public.academy_progress pr on pr.enrollment_id = v.enrollment_id and pr.lesson_id = l.id
    where l.published and l.archived_at is null
      and l.module_id in (
        select distinct (item ->> 'module_id')::uuid
        from public.academy_attempt a
        join public.academy_attempt_key k on k.attempt_id = a.id
        cross join lateral jsonb_array_elements(k.questions) item
        where a.enrollment_id = v.enrollment_id and a.quiz_id = v.quiz_id
          and item ->> 'module_id' is not null
      );

    select coalesce(jsonb_agg(jsonb_build_object(
      'module_id', scored.module_id,
      'order', scored.order_number,
      'title', scored.title,
      'correct', scored.correct,
      'total', scored.total
    ) order by scored.order_number), '[]'::jsonb) into v_scores
    from (
      select m.id as module_id, m.order_number, m.title,
        count(*) filter (
          where exists (
            select 1 from jsonb_array_elements(coalesce(a.answers, '[]'::jsonb)) ans
            where ans ->> 'question_id' = item ->> 'id' and ans ->> 'option_id' = item ->> 'correct_id'
          )
        ) as correct,
        count(*) as total
      from public.academy_attempt a
      join public.academy_attempt_key k on k.attempt_id = a.id
      cross join lateral jsonb_array_elements(k.questions) item
      join public.academy_module m on m.id = (item ->> 'module_id')::uuid
      where a.enrollment_id = v.enrollment_id and a.quiz_id = v.quiz_id and a.finished_at is not null
      group by m.id, m.order_number, m.title
    ) scored;
  else
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', l.id,
      'code', l.lesson_code,
      'title', l.title,
      'module_order', v_module.order_number,
      'module_title', v_module.title,
      'time_spent_seconds', coalesce(pr.time_spent_seconds, 0),
      'length_seconds', coalesce(
        (select asset.duration_seconds from public.academy_asset asset where asset.id = l.video_asset_id),
        app.academy_reading_seconds(l.body)
      ),
      'completed', coalesce(pr.status, '') = 'completed',
      'reopen_required', exists (
        select 1 from public.academy_attempt earlier
        where earlier.enrollment_id = v.enrollment_id and earlier.quiz_id = v.quiz_id
          and l.id = any(earlier.reopen_lesson_ids)
      ),
      'reopened', exists (
        select 1
        from public.academy_attempt earlier
        join public.academy_attempt nxt
          on nxt.enrollment_id = earlier.enrollment_id and nxt.quiz_id = earlier.quiz_id
         and nxt.attempt_number = earlier.attempt_number + 1
        join public.academy_progress opened on opened.enrollment_id = earlier.enrollment_id and opened.lesson_id = l.id
        where earlier.enrollment_id = v.enrollment_id and earlier.quiz_id = v.quiz_id
          and l.id = any(earlier.reopen_lesson_ids)
          and opened.last_opened_at > earlier.finished_at
          and opened.last_opened_at < nxt.started_at
      )
    ) order by l.sort_order), '[]'::jsonb) into v_lessons
    from public.academy_lesson l
    left join public.academy_progress pr on pr.enrollment_id = v.enrollment_id and pr.lesson_id = l.id
    where l.module_id = v_quiz.module_id and l.published and l.archived_at is null;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', n.id, 'body', n.body, 'created_at', n.created_at, 'author', app.academy_person_name(n.author_id)
  ) order by n.created_at), '[]'::jsonb) into v_notes
  from public.academy_hold_note n where n.hold_id = v.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', h.id, 'status', h.status, 'outcome', h.outcome, 'opened_at', h.opened_at,
    'resolved_at', h.resolved_at, 'attempts_granted', h.attempts_granted, 'retest_on', h.retest_on,
    'plan', h.remediation_plan
  ) order by h.opened_at), '[]'::jsonb) into v_history
  from public.academy_hold h where h.enrollment_id = v.enrollment_id;

  select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'code', l.lesson_code, 'title', l.title, 'module_order', m.order_number) order by m.order_number, l.sort_order), '[]'::jsonb)
  into v_lesson_choices
  from public.academy_lesson l
  join public.academy_module m on m.id = l.module_id
  where m.program_id = v_program.id and l.published and l.archived_at is null
    and (v_quiz.kind = 'final' or l.module_id = v_quiz.module_id);

  select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'order', m.order_number, 'title', m.title) order by m.order_number), '[]'::jsonb)
  into v_module_choices
  from public.academy_module m
  where m.program_id = v_program.id and m.order_number between 1 and 10;

  select coalesce(jsonb_agg(hm.module_id), '[]'::jsonb) into v_modules
  from public.academy_hold_module hm where hm.hold_id = v.id;

  return jsonb_build_object(
    'id', v.id,
    'status', v.status,
    'outcome', v.outcome,
    'reason', v.reason,
    'opened_at', v.opened_at,
    'deadline_at', v.deadline_at,
    'overdue', v.status in ('open', 'under_review') and v.deadline_at <= now(),
    'days_open', greatest(floor(extract(epoch from (coalesce(v.resolved_at, now()) - v.opened_at)) / 86400), 0)::int,
    'review_started_at', v.review_started_at,
    'review_started_by', case when v.review_started_by is null then null else app.academy_person_name(v.review_started_by) end,
    'resolved_at', v.resolved_at,
    'resolved_by', case when v.resolved_by is null then null else app.academy_person_name(v.resolved_by) end,
    'trainee_name', app.academy_person_name(v_enrollment.profile_id),
    'trainee_id', v_enrollment.profile_id,
    'self', v_enrollment.profile_id = app.acting_profile(),
    'program', v_program.name,
    'track', v_enrollment.track,
    'start_date', v_enrollment.start_date,
    'manager_name', coalesce(app.academy_person_name(v_enrollment.manager_id), 'Unassigned'),
    'reviewer_id', v.reviewer_id,
    'reviewer_name', case when v.reviewer_id is null then null else app.academy_person_name(v.reviewer_id) end
  ) || jsonb_build_object(
    'quiz_id', v.quiz_id,
    'quiz_kind', v_quiz.kind,
    'quiz_label', case when v_quiz.kind = 'final' then 'Final Quiz' else format('Module %s quiz', v_module.order_number) end,
    'module_title', v_module.title,
    'attempts_used', v.attempts_used,
    'concepts', v_concepts,
    'pattern', v_pattern,
    'module_scores', v_scores,
    'lessons', v_lessons,
    'attempts', v_attempts,
    'notes', v_notes,
    'history', v_history,
    'checklist', jsonb_build_object(
      'call_held_on', v.call_held_on,
      'call_note', v.call_note,
      'concept_check_note', v.concept_check_note,
      'struggle_reason', v.struggle_reason,
      'struggle_note', v.struggle_note,
      'ready', app.academy_hold_checklist_ready(v)
    )
  ) || jsonb_build_object(
    'plan', v.remediation_plan,
    'attempts_granted', v.attempts_granted,
    'retest_on', v.retest_on,
    'acknowledged_at', v.acknowledged_at,
    'selected_lessons', coalesce((select jsonb_agg(hl.lesson_id) from public.academy_hold_lesson hl where hl.hold_id = v.id), '[]'::jsonb),
    'selected_modules', v_modules,
    'lesson_choices', v_lesson_choices,
    'module_choices', case when v_quiz.kind = 'final' then v_module_choices else '[]'::jsonb end,
    'release_requested_at', v.release_requested_at,
    'release_requested_by', v.release_requested_by,
    'release_reason', v.release_reason,
    'release_note', v.release_note,
    'confirmed_at', v.confirmed_at,
    'reopen_note', v.reopen_note,
    'default_attempts', v_default,
    'struggle_reasons', coalesce((
      select jsonb_agg(label order by sort_order) from public.academy_hold_list_item where kind = 'struggle' and active
    ), '[]'::jsonb),
    'release_reasons', coalesce((
      select jsonb_agg(label order by sort_order) from public.academy_hold_list_item where kind = 'release' and active
    ), '[]'::jsonb),
    'reviewers', case when app.academy_manages() then coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'name', app.academy_person_name(p.id)) order by app.academy_person_name(p.id))
      from public.profile p
      where app.effective_state(p.id) = 'active'
        and p.id <> v_enrollment.profile_id
        and (
          coalesce((select allowed from app.decide('academy.review', p.id)), false)
          or coalesce((select allowed from app.decide('academy.manage', p.id)), false)
        )
    ), '[]'::jsonb) else '[]'::jsonb end
  );
end;
$$;

create or replace function public.academy_hold_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_opened integer;
  v_reset integer;
  v_extend integer;
  v_release integer;
  v_hours numeric;
  v_quizzes jsonb;
  v_concepts jsonb;
  v_days integer;
  v_attempts integer;
begin
  if not app.academy_manages() then
    raise exception 'permission_denied: the summary is for Academy Admins' using errcode = '42501';
  end if;
  select
    count(*),
    count(*) filter (where outcome = 'reset'),
    count(*) filter (where outcome = 'extend'),
    count(*) filter (where outcome = 'release'),
    round(avg(extract(epoch from (resolved_at - opened_at)) / 3600) filter (where resolved_at is not null)::numeric, 1)
  into v_opened, v_reset, v_extend, v_release, v_hours
  from public.academy_hold
  where opened_at >= now() - interval '30 days';

  select coalesce(jsonb_agg(jsonb_build_object('quiz_id', quiz_id, 'label', label, 'count', n) order by n desc, label), '[]'::jsonb)
  into v_quizzes
  from (
    select h.quiz_id,
      case when q.kind = 'final' then 'Final Quiz' else format('Module %s quiz', m.order_number) end as label,
      count(*) as n
    from public.academy_hold h
    left join public.academy_quiz q on q.id = h.quiz_id
    left join public.academy_module m on m.id = q.module_id
    where h.opened_at >= now() - interval '30 days'
    group by 1, 2
    order by n desc
    limit 8
  ) q;

  select coalesce(jsonb_agg(jsonb_build_object('concept', concept, 'count', n) order by n desc, concept), '[]'::jsonb)
  into v_concepts
  from (
    select concept, count(distinct hold_id) as n
    from (
      select h.id as hold_id, item ->> 'concept' as concept
      from public.academy_hold h
      join public.academy_attempt a on a.enrollment_id = h.enrollment_id and a.quiz_id = h.quiz_id
      join public.academy_attempt_key k on k.attempt_id = a.id
      cross join lateral jsonb_array_elements(k.questions) item
      where h.opened_at >= now() - interval '30 days'
        and coalesce(item ->> 'concept', '') <> ''
        and not exists (
          select 1 from jsonb_array_elements(coalesce(a.answers, '[]'::jsonb)) ans
          where ans ->> 'question_id' = item ->> 'id' and ans ->> 'option_id' = item ->> 'correct_id'
        )
    ) missed
    group by concept
    order by n desc
    limit 8
  ) c;

  select review_deadline_days, default_attempts_granted into v_days, v_attempts
  from public.academy_setting where id = 1;

  return jsonb_build_object(
    'opened_30', v_opened,
    'reset', v_reset,
    'extend', v_extend,
    'release', v_release,
    'avg_resolve_hours', v_hours,
    'quizzes', v_quizzes,
    'concepts', v_concepts,
    'review_deadline_days', v_days,
    'default_attempts_granted', v_attempts,
    'struggle_reasons', coalesce((
      select jsonb_agg(label order by sort_order) from public.academy_hold_list_item where kind = 'struggle' and active
    ), '[]'::jsonb),
    'release_reasons', coalesce((
      select jsonb_agg(label order by sort_order) from public.academy_hold_list_item where kind = 'release' and active
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.academy_hold_save_settings(p_days integer, p_attempts integer)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_old integer;
  v_old_attempts integer;
begin
  if not app.academy_manages() then
    raise exception 'permission_denied: an Academy Admin changes hold settings' using errcode = '42501';
  end if;
  if p_days is null or p_days < 1 or p_days > 60 or p_attempts is null or p_attempts < 1 or p_attempts > 20 then
    raise exception 'bad_setting: deadline is 1 to 60 days, and attempts granted are 1 to 20' using errcode = '22023';
  end if;
  select review_deadline_days, default_attempts_granted into v_old, v_old_attempts
  from public.academy_setting where id = 1;
  update public.academy_setting
  set review_deadline_days = p_days, default_attempts_granted = p_attempts, updated_at = now(), updated_by = app.acting_profile()
  where id = 1;
  perform app.audit(
    'academy.hold_settings', 'academy_setting', '1',
    'Hold settings changed.',
    jsonb_build_object('review_deadline_days', v_old, 'default_attempts_granted', v_old_attempts),
    jsonb_build_object('review_deadline_days', p_days, 'default_attempts_granted', p_attempts)
  );
end;
$$;

create or replace function public.academy_hold_save_list(p_kind text, p_labels jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_label text;
  v_order integer := 0;
begin
  if not app.academy_manages() then
    raise exception 'permission_denied: an Academy Admin changes the lists' using errcode = '42501';
  end if;
  if p_kind not in ('struggle', 'release') then
    raise exception 'bad_list: the list is struggle or release' using errcode = '22023';
  end if;
  if jsonb_typeof(p_labels) is distinct from 'array' or jsonb_array_length(p_labels) < 1 then
    raise exception 'list_empty: keep at least one reason' using errcode = '22023';
  end if;
  update public.academy_hold_list_item set active = false where kind = p_kind;
  for v_label in
    select btrim(value) from jsonb_array_elements_text(p_labels) as t(value)
  loop
    if length(v_label) = 0 then
      continue;
    end if;
    v_order := v_order + 1;
    insert into public.academy_hold_list_item (kind, label, active, sort_order)
    values (p_kind, v_label, true, v_order)
    on conflict (kind, label) do update set active = true, sort_order = excluded.sort_order;
  end loop;
  if v_order < 1 then
    raise exception 'list_empty: keep at least one reason' using errcode = '22023';
  end if;
  perform app.audit(
    'academy.hold_list', 'academy_hold_list_item', p_kind,
    'Hold reason list changed.',
    null, jsonb_build_object('kind', p_kind, 'labels', p_labels)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Row security. Reviewers read their own holds. Trainees read none.
-- ---------------------------------------------------------------------------

drop policy academy_hold_select on public.academy_hold;
create policy academy_hold_select on public.academy_hold
  for select to authenticated
  using (
    app.academy_manages()
    or (
      reviewer_id = app.acting_profile()
      and app.academy_reviews()
      and app.effective_state(app.acting_profile()) = 'active'
    )
  );

drop policy academy_attempt_flag_read on public.academy_attempt_flag;
create policy academy_attempt_flag_read on public.academy_attempt_flag
  for select to authenticated
  using (
    app.academy_manages()
    or exists (
      select 1 from public.academy_attempt a
      where a.id = academy_attempt_flag.attempt_id
        and app.academy_reviews()
        and (
          exists (
            select 1 from public.academy_hold h
            where h.enrollment_id = a.enrollment_id and h.reviewer_id = app.acting_profile()
          )
          or (
            not exists (
              select 1 from public.academy_hold h where h.enrollment_id = a.enrollment_id
            )
            and exists (
              select 1 from public.academy_enrollment e
              where e.id = a.enrollment_id and e.manager_id = app.acting_profile()
            )
          )
        )
    )
  );

alter table public.academy_hold_note enable row level security;
alter table public.academy_hold_lesson enable row level security;
alter table public.academy_hold_module enable row level security;
alter table public.academy_hold_event enable row level security;
alter table public.academy_hold_list_item enable row level security;

create policy academy_hold_note_read on public.academy_hold_note
  for select to authenticated
  using (
    exists (
      select 1 from public.academy_hold h
      where h.id = academy_hold_note.hold_id
        and (
          app.academy_manages()
          or (h.reviewer_id = app.acting_profile() and app.academy_reviews())
        )
    )
  );

create policy academy_hold_lesson_read on public.academy_hold_lesson
  for select to authenticated
  using (
    exists (
      select 1 from public.academy_hold h
      where h.id = academy_hold_lesson.hold_id
        and (
          app.academy_manages()
          or (h.reviewer_id = app.acting_profile() and app.academy_reviews())
        )
    )
  );

create policy academy_hold_module_read on public.academy_hold_module
  for select to authenticated
  using (
    exists (
      select 1 from public.academy_hold h
      where h.id = academy_hold_module.hold_id
        and (
          app.academy_manages()
          or (h.reviewer_id = app.acting_profile() and app.academy_reviews())
        )
    )
  );

create policy academy_hold_event_read on public.academy_hold_event
  for select to authenticated
  using (
    exists (
      select 1 from public.academy_hold h
      where h.id = academy_hold_event.hold_id
        and (
          app.academy_manages()
          or (h.reviewer_id = app.acting_profile() and app.academy_reviews())
        )
    )
  );

create policy academy_hold_list_read on public.academy_hold_list_item
  for select to authenticated
  using (app.academy_manages() or app.academy_reviews());

revoke all on public.academy_hold_note from anon, authenticated;
revoke all on public.academy_hold_lesson from anon, authenticated;
revoke all on public.academy_hold_module from anon, authenticated;
revoke all on public.academy_hold_event from anon, authenticated;
revoke all on public.academy_hold_list_item from anon, authenticated;

grant select on public.academy_hold_note to authenticated;
grant select on public.academy_hold_lesson to authenticated;
grant select on public.academy_hold_module to authenticated;
grant select on public.academy_hold_event to authenticated;
grant select on public.academy_hold_list_item to authenticated;

revoke all on function app.academy_hold_before_one() from public, anon, authenticated;
revoke all on function app.academy_hold_before_stamp() from public, anon, authenticated;
revoke all on function app.academy_hold_after_insert() from public, anon, authenticated;
revoke all on function app.academy_person_name(uuid) from public, anon, authenticated;
revoke all on function app.academy_hold_visible(uuid) from public, anon, authenticated;
revoke all on function app.academy_hold_load(uuid) from public, anon, authenticated;
revoke all on function app.academy_hold_refuse_self(uuid) from public, anon, authenticated;
revoke all on function app.academy_hold_checklist_ready(public.academy_hold) from public, anon, authenticated;
revoke all on function app.academy_hold_record_deadlines(uuid[]) from public, anon, authenticated;
revoke all on function app.academy_hold_public(uuid) from public, anon, authenticated;
revoke all on function app.academy_remediation_public(uuid) from public, anon, authenticated;
revoke all on function app.academy_retry_gate(uuid, public.academy_quiz) from public, anon, authenticated;
revoke all on function app.academy_hold_require_open(public.academy_hold) from public, anon, authenticated;
revoke all on function app.academy_hold_require_list(text, text) from public, anon, authenticated;
revoke all on function app.academy_hold_apply_plan(public.academy_hold, text, text, integer, date, uuid[], uuid[]) from public, anon, authenticated;

revoke all on function public.academy_hold_prepare() from public, anon;
revoke all on function public.academy_hold_begin(uuid) from public, anon;
revoke all on function public.academy_hold_add_note(uuid, text) from public, anon;
revoke all on function public.academy_hold_save_checklist(uuid, date, text, text, text, text) from public, anon;
revoke all on function public.academy_hold_resolve(uuid, text, text, integer, date, uuid[], uuid[]) from public, anon;
revoke all on function public.academy_hold_request_release(uuid, text, text) from public, anon;
revoke all on function public.academy_hold_confirm_release(uuid) from public, anon;
revoke all on function public.academy_hold_reopen(uuid, text) from public, anon;
revoke all on function public.academy_hold_assign(uuid, uuid) from public, anon;
revoke all on function public.academy_hold_acknowledge(uuid) from public, anon;
revoke all on function public.academy_can_review() from public, anon;
revoke all on function public.academy_hold_queue(text, uuid, uuid, boolean) from public, anon;
revoke all on function public.academy_hold_detail(uuid) from public, anon;
revoke all on function public.academy_hold_summary() from public, anon;
revoke all on function public.academy_hold_save_settings(integer, integer) from public, anon;
revoke all on function public.academy_hold_save_list(text, jsonb) from public, anon;

grant execute on function public.academy_hold_prepare() to authenticated;
grant execute on function public.academy_hold_begin(uuid) to authenticated;
grant execute on function public.academy_hold_add_note(uuid, text) to authenticated;
grant execute on function public.academy_hold_save_checklist(uuid, date, text, text, text, text) to authenticated;
grant execute on function public.academy_hold_resolve(uuid, text, text, integer, date, uuid[], uuid[]) to authenticated;
grant execute on function public.academy_hold_request_release(uuid, text, text) to authenticated;
grant execute on function public.academy_hold_confirm_release(uuid) to authenticated;
grant execute on function public.academy_hold_reopen(uuid, text) to authenticated;
grant execute on function public.academy_hold_assign(uuid, uuid) to authenticated;
grant execute on function public.academy_hold_acknowledge(uuid) to authenticated;
grant execute on function public.academy_can_review() to authenticated;
grant execute on function public.academy_hold_queue(text, uuid, uuid, boolean) to authenticated;
grant execute on function public.academy_hold_detail(uuid) to authenticated;
grant execute on function public.academy_hold_summary() to authenticated;
grant execute on function public.academy_hold_save_settings(integer, integer) to authenticated;
grant execute on function public.academy_hold_save_list(text, jsonb) to authenticated;

grant execute on function app.academy_hold_before_one() to authenticated;
grant execute on function app.academy_hold_before_stamp() to authenticated;
grant execute on function app.academy_hold_after_insert() to authenticated;
