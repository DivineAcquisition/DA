-- DA Operator Academy foundation.
--
-- Additive. Nothing here replaces the team portal, the admin portal, or the
-- VA training simulation in schema `training` (that schema is invented playbook
-- content for operators already in the training stage). The Academy is live
-- curriculum and enrollment, linked to the people, operators, applications,
-- and DocuSeal agreements that already exist.
--
-- Academy roles are permissions on the existing account, not new user_role
-- values. One profile still has one role, so a trainee can remain an operator
-- and a reviewer can remain a manager.
--
--   trainee        academy.trainee   default for operator
--   reviewer       academy.review    default for manager (assigned trainees only)
--   academy admin  academy.manage    default for owner and admin

insert into public.permission (key, label, description, category, sort_order, is_destructive, requires_step_up, blocked_during_impersonation) values
  ('academy.trainee', 'Academy trainee', 'See your own Academy enrollment, progress, attempts, and certification.', 'Academy', 900, false, false, false),
  ('academy.review', 'Academy reviewer', 'See the trainees assigned to you. Holds and sign-off come later.', 'Academy', 910, false, false, false),
  ('academy.manage', 'Academy admin', 'See and manage the Academy, including settings and content.', 'Academy', 920, false, false, true);

insert into public.role_permission (role, permission_key) values
  ('operator', 'academy.trainee'),
  ('manager', 'academy.review'),
  ('admin', 'academy.manage'),
  ('owner', 'academy.manage');

-- ---------------------------------------------------------------------------
-- Curriculum, enrollment, and the records later prompts will use.
-- ---------------------------------------------------------------------------

create table public.academy_program (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (length(btrim(name)) between 1 and 200),
  program_type text not null check (program_type in ('core', 'vertical_pack', 'internal_track')),
  version integer not null default 1 check (version > 0),
  status text not null default 'draft' check (status in ('draft', 'live')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.academy_program is
  'A named course of training. Draft until its lessons are loaded. Links out to people; it does not copy them.';

create table public.academy_module (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.academy_program (id) on delete cascade,
  order_number integer not null check (order_number >= 0),
  title text not null check (length(btrim(title)) between 1 and 200),
  description text not null default '',
  required boolean not null default true,
  -- `agreement` is module 0's gate (the DocuSeal signature). It is not "none":
  -- a none gate would open the next module with no condition.
  gate_type text not null check (gate_type in (
    'none', 'agreement', 'quiz', 'quiz_practical', 'quiz_simulation', 'sign_off'
  )),
  gate_detail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, order_number)
);

comment on column public.academy_module.gate_type is
  'quiz, quiz plus practical, quiz plus simulation, sign-off, none, or agreement. Practical, simulation, and sign-off stay closed until the prompts that record them.';
comment on column public.academy_module.gate_detail is
  'The specific work the gate names, such as a written reflection or two simulations. Editable configuration, not a hard-coded rule.';

create table public.academy_lesson (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.academy_module (id) on delete cascade,
  lesson_code text not null check (lesson_code ~ '^M[0-9]{2}-L[0-9]{2}$'),
  sort_order integer not null check (sort_order > 0),
  title text not null check (length(btrim(title)) between 1 and 200),
  body text not null default '',
  required_watch_percent integer not null default 100 check (required_watch_percent between 0 and 100),
  content_version integer not null default 1 check (content_version > 0),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (module_id, lesson_code),
  unique (module_id, sort_order)
);

comment on table public.academy_lesson is
  'Lessons start unpublished. A module with none published is not open to trainees.';
comment on column public.academy_lesson.lesson_code is
  'Lesson id in the form M07-L03: module 7, lesson 3.';

create table public.academy_asset (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.academy_lesson (id) on delete cascade,
  asset_type text not null check (asset_type in ('video', 'document', 'slide')),
  storage_path text,
  video_url text,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  version integer not null default 1 check (version > 0),
  status text not null default 'draft' check (status in ('draft', 'ready', 'live')),
  uploaded_by uuid references public.profile (id),
  uploaded_at timestamptz not null default now(),
  check (
    status = 'draft'
    or (asset_type = 'video' and (video_url is not null or storage_path is not null))
    or (asset_type in ('document', 'slide') and storage_path is not null)
  )
);

comment on table public.academy_asset is
  'A video, document, or slide attached to a lesson. Document and slide files live in the private academy-documents bucket.';
comment on column public.academy_asset.storage_path is
  'Object name inside the private academy-documents bucket. Not a public URL.';

alter table public.academy_lesson
  add column video_asset_id uuid references public.academy_asset (id) on delete set null,
  add column document_asset_id uuid references public.academy_asset (id) on delete set null;

create table public.academy_quiz (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null unique references public.academy_module (id) on delete cascade,
  kind text not null check (kind in ('module', 'final')),
  questions_per_attempt integer not null check (questions_per_attempt > 0),
  pass_mark numeric not null check (pass_mark > 0),
  pass_mark_unit text not null check (pass_mark_unit in ('correct', 'percent')),
  max_attempts integer not null check (max_attempts > 0),
  lockout_minutes integer not null check (lockout_minutes >= 0),
  shuffle_answers boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (pass_mark_unit = 'correct' and pass_mark <= questions_per_attempt)
    or (pass_mark_unit = 'percent' and pass_mark <= 100)
  )
);

comment on table public.academy_quiz is
  'Editable quiz settings. One row per module quiz, plus one final quiz. Academy admins change these; the application does not hard-code them.';

create unique index academy_quiz_one_final
  on public.academy_quiz (kind)
  where kind = 'final';

create table public.academy_quiz_draw (
  quiz_id uuid not null references public.academy_quiz (id) on delete cascade,
  source_module_id uuid not null references public.academy_module (id) on delete cascade,
  question_count integer not null check (question_count > 0),
  primary key (quiz_id, source_module_id)
);

comment on table public.academy_quiz_draw is
  'How a quiz pulls from module pools. The final quiz draws 3 questions from each of modules 1 through 10. Editable, not hard-coded.';

create table public.academy_question (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.academy_module (id) on delete cascade,
  prompt text not null check (length(btrim(prompt)) > 0),
  question_type text not null check (question_type in ('multiple_choice', 'scenario')),
  options jsonb not null default '[]'::jsonb,
  correct_answer text not null,
  explanation text not null default '',
  concept_tag text,
  difficulty text not null default 'standard' check (difficulty in ('foundation', 'standard', 'advanced')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.academy_question is
  'Module question pool. Starts empty and is loaded later. Trainees cannot read this table, so the correct answer and the explanation stay hidden until a later prompt reveals the explanation after a pass.';

create index academy_question_pool_idx
  on public.academy_question (module_id)
  where active;

create table public.academy_enrollment (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profile (id) on delete cascade,
  program_id uuid not null references public.academy_program (id) on delete restrict,
  operator_id uuid references public.operator (id) on delete set null,
  role_application_id uuid references public.role_application (id) on delete set null,
  agreement_id uuid references public.da_agreement (id) on delete set null,
  track text not null check (length(btrim(track)) between 1 and 120),
  start_date date,
  target_completion_date date,
  manager_id uuid references public.profile (id),
  status text not null check (status in (
    'invited', 'active', 'stalled', 'on_hold_review', 'completed', 'withdrawn'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, program_id)
);

comment on table public.academy_enrollment is
  'One person, one program. operator_id, role_application_id, and agreement_id are links to existing rows. Access re-reads the live DocuSeal status; it does not trust a copied signature.';
comment on column public.academy_enrollment.manager_id is
  'The reviewer this trainee is assigned to. A reviewer sees only these rows.';

create index academy_enrollment_profile_idx on public.academy_enrollment (profile_id);
create index academy_enrollment_manager_idx on public.academy_enrollment (manager_id);

create table public.academy_progress (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.academy_enrollment (id) on delete cascade,
  lesson_id uuid not null references public.academy_lesson (id) on delete cascade,
  status text not null check (status in ('not_started', 'in_progress', 'completed')),
  completed_at timestamptz,
  time_spent_seconds integer not null default 0 check (time_spent_seconds >= 0),
  unique (enrollment_id, lesson_id)
);

comment on table public.academy_progress is
  'Per enrollment, per lesson. The lesson player that writes it comes in a later prompt.';

create table public.academy_attempt (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.academy_enrollment (id) on delete cascade,
  quiz_id uuid not null references public.academy_quiz (id) on delete cascade,
  attempt_number integer not null check (attempt_number > 0),
  questions_drawn uuid[] not null default '{}',
  answers jsonb not null default '[]'::jsonb,
  score numeric,
  passed boolean,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  time_taken_seconds integer check (time_taken_seconds is null or time_taken_seconds >= 0),
  unique (enrollment_id, quiz_id, attempt_number)
);

comment on table public.academy_attempt is
  'Structure only. The quiz engine that creates attempts comes in a later prompt.';

create table public.academy_hold (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.academy_enrollment (id) on delete cascade,
  quiz_id uuid references public.academy_quiz (id) on delete set null,
  reason text not null,
  attempts_used integer not null check (attempts_used >= 0),
  status text not null check (status in ('open', 'under_review', 'resolved')),
  reviewer_id uuid references public.profile (id),
  outcome text check (outcome is null or outcome in ('reset', 'extend', 'release')),
  remediation_plan text,
  review_notes text,
  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  attempts_granted integer check (attempts_granted is null or attempts_granted >= 0),
  check (
    (status in ('open', 'under_review') and outcome is null and resolved_at is null)
    or (status = 'resolved' and outcome is not null and resolved_at is not null)
  )
);

comment on table public.academy_hold is
  'Structure only. Opening a hold on the fifth failed attempt, and resolving it, come in a later prompt. Trainees cannot read review notes.';

create table public.academy_certification (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.academy_enrollment (id) on delete cascade,
  profile_id uuid not null references public.profile (id) on delete cascade,
  level smallint not null check (level between 0 and 3),
  vertical text,
  granted_at timestamptz not null default now(),
  granted_by uuid references public.profile (id),
  recertify_on date,
  check (level <> 2 or (vertical is not null and length(btrim(vertical)) > 0))
);

comment on table public.academy_certification is
  'Level 0 Onboarded, 1 Certified Operator, 2 Vertical Certified, 3 DA Internal. Granting one is a later prompt.';
comment on column public.academy_certification.level is
  '0 Onboarded, 1 Certified Operator, 2 Vertical Certified, 3 DA Internal.';

create index academy_certification_profile_idx on public.academy_certification (profile_id, level desc);

create trigger academy_program_touch before update on public.academy_program
  for each row execute function app.touch_updated_at();
create trigger academy_module_touch before update on public.academy_module
  for each row execute function app.touch_updated_at();
create trigger academy_lesson_touch before update on public.academy_lesson
  for each row execute function app.touch_updated_at();
create trigger academy_quiz_touch before update on public.academy_quiz
  for each row execute function app.touch_updated_at();
create trigger academy_enrollment_touch before update on public.academy_enrollment
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Access. These live in app so a trainee cannot call them directly. Policies
-- and academy_shell() are the doors.
-- ---------------------------------------------------------------------------

create or replace function app.academy_manages()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.can('academy.manage');
$$;

create or replace function app.academy_reviews()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.can('academy.review');
$$;

create or replace function app.academy_level_label(p_level smallint)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_level
    when 0 then 'Onboarded'
    when 1 then 'Certified Operator'
    when 2 then 'Vertical Certified'
    when 3 then 'DA Internal'
    else null
  end;
$$;

-- Live DocuSeal status. `completed` and not superseded is the signed agreement.
create or replace function app.academy_agreement_signed(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.operator o
    join public.da_recipient r
      on r.recipient_type = 'operator'
     and (
       r.operator_id = o.id
       or (r.operator_id is null and lower(r.email) = lower(o.email))
     )
    join public.da_agreement a on a.recipient_id = r.id
    where o.profile_id = p_profile_id
      and a.status = 'completed'
      and a.superseded_by_id is null
  );
$$;

comment on function app.academy_agreement_signed(uuid) is
  'True when the person''s operator agreement is signed in DocuSeal. Reads da_agreement.status. Does not copy the document.';

create or replace function app.academy_quiz_passed(p_enrollment_id uuid, p_module_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.academy_attempt a
    join public.academy_quiz q on q.id = a.quiz_id
    where a.enrollment_id = p_enrollment_id
      and q.module_id = p_module_id
      and a.passed is true
  );
$$;

create or replace function app.academy_required_lessons_done(p_enrollment_id uuid, p_module_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.academy_lesson l
    where l.module_id = p_module_id and l.published
  )
  and not exists (
    select 1 from public.academy_lesson l
    where l.module_id = p_module_id and l.published
      and not exists (
        select 1 from public.academy_progress pr
        where pr.enrollment_id = p_enrollment_id
          and pr.lesson_id = l.id
          and pr.status = 'completed'
      )
  );
$$;

-- Practical, simulation, drill, and supervisor sign-off are later prompts.
-- Until those records exist, this stays false so those gates cannot pass early.
create or replace function app.academy_supporting_gate_passed(p_enrollment_id uuid, p_module_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select false;
$$;

comment on function app.academy_supporting_gate_passed(uuid, uuid) is
  'Placeholder for the practical, simulation, and supervisor sign-off. Later prompts replace this function. A quiz-only gate does not call it.';

create or replace function app.academy_module_gate_passed(p_enrollment_id uuid, p_module_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case m.gate_type
      when 'agreement' then app.academy_agreement_signed(e.profile_id)
      when 'none' then app.academy_required_lessons_done(p_enrollment_id, p_module_id)
      when 'quiz' then app.academy_quiz_passed(p_enrollment_id, p_module_id)
      when 'quiz_practical' then
        app.academy_quiz_passed(p_enrollment_id, p_module_id)
        and app.academy_supporting_gate_passed(p_enrollment_id, p_module_id)
      when 'quiz_simulation' then
        app.academy_quiz_passed(p_enrollment_id, p_module_id)
        and app.academy_supporting_gate_passed(p_enrollment_id, p_module_id)
      when 'sign_off' then app.academy_supporting_gate_passed(p_enrollment_id, p_module_id)
      else false
    end
    from public.academy_module m
    join public.academy_enrollment e
      on e.id = p_enrollment_id and e.program_id = m.program_id
    where m.id = p_module_id
  ), false);
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
          and app.academy_module_gate_passed(p_enrollment_id, prev.id) is distinct from true
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
      where l.module_id = p_module_id and l.published
    ) then 'unpublished'
    when app.academy_module_gate_passed(p_enrollment_id, p_module_id) then 'complete'
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
  end;
$$;

create or replace function app.academy_content_open(p_enrollment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.academy_enrollment e
    where e.id = p_enrollment_id
      and e.profile_id = app.acting_profile()
      and e.status in ('active', 'stalled', 'completed')
      and app.effective_state(e.profile_id) = 'active'
      and app.academy_agreement_signed(e.profile_id)
  );
$$;

create or replace function app.academy_record_open(p_enrollment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    app.academy_content_open(p_enrollment_id)
    or app.academy_manages()
    or exists (
      select 1
      from public.academy_enrollment e
      where e.id = p_enrollment_id
        and e.status <> 'withdrawn'
        and e.manager_id = app.acting_profile()
        and app.academy_reviews()
    );
$$;

create or replace function app.academy_can_read_asset_path(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.academy_asset asset
    join public.academy_lesson l on l.id = asset.lesson_id
    join public.academy_module m on m.id = l.module_id
    join public.academy_enrollment e on e.program_id = m.program_id
    where asset.storage_path = p_name
      and asset.asset_type in ('document', 'slide')
      and asset.status = 'live'
      and l.published
      and (
        app.academy_manages()
        or (
          app.academy_content_open(e.id)
          and app.academy_module_unlocked(e.id, m.id)
        )
        or (
          e.manager_id = app.acting_profile()
          and app.academy_reviews()
          and e.status <> 'withdrawn'
        )
      )
  );
$$;

comment on function app.academy_can_read_asset_path(text) is
  'Storage read for a private document or slide. Draft files and locked modules stay closed.';

create or replace function app.academy_screen(p_profile_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_profile_id is null then
    return 'signed_out';
  end if;
  if app.effective_state(p_profile_id) is distinct from 'active' then
    return 'no_access';
  end if;
  if not exists (select 1 from public.academy_enrollment e where e.profile_id = p_profile_id) then
    return 'no_enrollment';
  end if;
  if not exists (
    select 1 from public.academy_enrollment e
    where e.profile_id = p_profile_id and e.status <> 'withdrawn'
  ) then
    return 'no_access';
  end if;
  if not app.academy_agreement_signed(p_profile_id) then
    return 'agreement_pending';
  end if;
  -- Any hold closes the shell. The status page is the only screen.
  if exists (
    select 1 from public.academy_enrollment e
    where e.profile_id = p_profile_id and e.status = 'on_hold_review'
  ) then
    return 'on_hold';
  end if;
  if exists (
    select 1 from public.academy_enrollment e
    where e.profile_id = p_profile_id and e.status = 'active'
  ) then
    return 'active';
  end if;
  if exists (
    select 1 from public.academy_enrollment e
    where e.profile_id = p_profile_id and e.status = 'stalled'
  ) then
    return 'stalled';
  end if;
  if exists (
    select 1 from public.academy_enrollment e
    where e.profile_id = p_profile_id and e.status = 'invited'
  ) then
    return 'invited';
  end if;
  if exists (
    select 1 from public.academy_enrollment e
    where e.profile_id = p_profile_id and e.status = 'completed'
  ) then
    return 'completed';
  end if;
  return 'no_access';
end;
$$;

create or replace function app.academy_primary_enrollment(p_profile_id uuid)
returns public.academy_enrollment
language sql
stable
security definer
set search_path = ''
as $$
  select e.*
  from public.academy_enrollment e
  join public.academy_program p on p.id = e.program_id
  where e.profile_id = p_profile_id
    and e.status <> 'withdrawn'
  order by
    case e.status
      when 'on_hold_review' then 0
      when 'active' then 1
      when 'stalled' then 2
      when 'invited' then 3
      when 'completed' then 4
      else 5
    end,
    case p.program_type when 'core' then 0 when 'vertical_pack' then 1 else 2 end,
    e.start_date desc nulls last,
    e.created_at desc
  limit 1;
$$;

create or replace function app.academy_enrollment_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.operator_id is null then
    select o.id into new.operator_id
    from public.operator o
    where o.profile_id = new.profile_id
    order by o.created_at
    limit 1;
  end if;

  if new.role_application_id is null and new.operator_id is not null then
    select o.role_application_id into new.role_application_id
    from public.operator o
    where o.id = new.operator_id;
  end if;

  if new.agreement_id is null and new.operator_id is not null then
    select a.id into new.agreement_id
    from public.da_agreement a
    join public.da_recipient r on r.id = a.recipient_id
    where r.operator_id = new.operator_id
      and a.superseded_by_id is null
    order by (a.status = 'completed') desc, a.sent_at desc
    limit 1;
  end if;

  return new;
end;
$$;

create trigger academy_enrollment_link
  before insert on public.academy_enrollment
  for each row execute function app.academy_enrollment_link();

create or replace function app.academy_enrollment_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform app.audit(
      'academy.enrollment_created', 'academy_enrollment', new.id::text,
      'Enrolled in the Academy',
      null,
      jsonb_build_object('status', new.status, 'program_id', new.program_id, 'manager_id', new.manager_id),
      null, new.profile_id
    );
  elsif old.status is distinct from new.status or old.manager_id is distinct from new.manager_id then
    perform app.audit(
      'academy.access_changed', 'academy_enrollment', new.id::text,
      'Academy access changed',
      jsonb_build_object('status', old.status, 'manager_id', old.manager_id),
      jsonb_build_object('status', new.status, 'manager_id', new.manager_id),
      null, new.profile_id
    );
  end if;
  return new;
end;
$$;

create trigger academy_enrollment_audit
  after insert or update on public.academy_enrollment
  for each row execute function app.academy_enrollment_audit();

create or replace function app.academy_quiz_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (
    old.questions_per_attempt is distinct from new.questions_per_attempt
    or old.pass_mark is distinct from new.pass_mark
    or old.pass_mark_unit is distinct from new.pass_mark_unit
    or old.max_attempts is distinct from new.max_attempts
    or old.lockout_minutes is distinct from new.lockout_minutes
    or old.shuffle_answers is distinct from new.shuffle_answers
    or old.active is distinct from new.active
  ) then
    perform app.audit(
      'academy.settings_changed', 'academy_quiz', new.id::text,
      'Academy quiz settings changed',
      jsonb_build_object(
        'questions_per_attempt', old.questions_per_attempt,
        'pass_mark', old.pass_mark,
        'pass_mark_unit', old.pass_mark_unit,
        'max_attempts', old.max_attempts,
        'lockout_minutes', old.lockout_minutes,
        'shuffle_answers', old.shuffle_answers,
        'active', old.active
      ),
      jsonb_build_object(
        'questions_per_attempt', new.questions_per_attempt,
        'pass_mark', new.pass_mark,
        'pass_mark_unit', new.pass_mark_unit,
        'max_attempts', new.max_attempts,
        'lockout_minutes', new.lockout_minutes,
        'shuffle_answers', new.shuffle_answers,
        'active', new.active
      )
    );
  end if;
  return new;
end;
$$;

create trigger academy_quiz_audit
  after update on public.academy_quiz
  for each row execute function app.academy_quiz_audit();

-- ---------------------------------------------------------------------------
-- What the training domain renders. Returns only the caller's own screen.
-- ---------------------------------------------------------------------------

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
  v_completed integer := 0;
  v_total integer := 0;
  v_display text;
  v_openable boolean;
  v_mod record;
  v_empty jsonb := jsonb_build_object('completed', 0, 'total', 0, 'percent', 0);
begin
  v_state := app.academy_screen(v_profile);

  if v_state in ('signed_out', 'no_access', 'no_enrollment') then
    return jsonb_build_object(
      'state', v_state,
      'program', null,
      'enrollment', null,
      'certification', null,
      'progress', v_empty,
      'current_module', null,
      'next_action', null,
      'banner', null,
      'modules', '[]'::jsonb
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
      select m.*
      from public.academy_module m
      where m.program_id = v_program.id
      order by m.order_number
    loop
      v_display := app.academy_module_display(v_enrollment.id, v_mod.id);
      v_openable := v_display in ('available', 'in_progress', 'complete');
      v_total := v_total + 1;
      if v_display = 'complete' then
        v_completed := v_completed + 1;
      end if;
      if v_current is null and v_display in ('available', 'in_progress', 'unpublished') then
        v_current := jsonb_build_object(
          'id', v_mod.id, 'order', v_mod.order_number, 'title', v_mod.title
        );
        if v_display = 'unpublished' then
          v_next := jsonb_build_object(
            'title', 'Not yet published',
            'detail', v_mod.title || ' has no lessons yet.',
            'href', null
          );
        elsif v_display = 'in_progress' then
          v_next := jsonb_build_object(
            'title', 'Continue ' || v_mod.title,
            'detail', 'Pick up this module.',
            'href', '/academy/modules/' || v_mod.id
          );
        else
          v_next := jsonb_build_object(
            'title', 'Start ' || v_mod.title,
            'detail', 'This is the next module.',
            'href', '/academy/modules/' || v_mod.id
          );
        end if;
      end if;
      v_modules := v_modules || jsonb_build_array(jsonb_build_object(
        'id', v_mod.id,
        'order', v_mod.order_number,
        'title', v_mod.title,
        'description', v_mod.description,
        'required', v_mod.required,
        'gate_type', v_mod.gate_type,
        'gate_detail', v_mod.gate_detail,
        'display', v_display,
        'openable', v_openable
      ));
    end loop;

    if v_next is null and v_total > 0 and v_completed = v_total then
      v_next := jsonb_build_object(
        'title', case when v_cert_level is null then 'Certification is not on your record yet' else 'Review your certification' end,
        'detail', coalesce(app.academy_level_label(v_cert_level), 'No certification yet.'),
        'href', null
      );
    elsif v_next is null then
      v_next := jsonb_build_object(
        'title', 'Nothing to open',
        'detail', 'Your program has no modules yet.',
        'href', null
      );
    end if;

    if v_state = 'stalled' then
      v_banner := 'Your training has stalled. Continue where you left off.';
    end if;
  end if;

  return jsonb_build_object(
    'state', v_state,
    'program', jsonb_build_object(
      'id', v_program.id,
      'name', v_program.name,
      'type', v_program.program_type,
      'version', v_program.version,
      'status', v_program.status
    ),
    'enrollment', jsonb_build_object(
      'id', v_enrollment.id,
      'status', v_enrollment.status,
      'track', v_enrollment.track,
      'start_date', v_enrollment.start_date,
      'target_date', v_enrollment.target_completion_date
    ),
    'certification', case when v_cert_level is null then null else jsonb_build_object(
      'level', v_cert_level,
      'label', app.academy_level_label(v_cert_level),
      'vertical', v_cert_vertical,
      'granted_at', v_cert_granted,
      'recertify_on', v_cert_recert
    ) end,
    'progress', jsonb_build_object(
      'completed', v_completed,
      'total', v_total,
      'percent', case when v_total = 0 then 0 else round(100.0 * v_completed / v_total) end
    ),
    'current_module', v_current,
    'next_action', v_next,
    'banner', v_banner,
    'modules', v_modules
  );
end;
$$;

comment on function public.academy_shell() is
  'The trainee screen for the signed-in person. On hold, unsigned, withdrawn, and inactive accounts get no module list.';

revoke all on function public.academy_shell() from public, anon;
grant execute on function public.academy_shell() to authenticated;

create or replace function public.academy_assign_role(
  p_profile_id uuid,
  p_role text,
  p_effect public.permission_effect default 'grant',
  p_reason text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_key text;
begin
  if not app.academy_manages() then
    raise exception 'permission_denied: only an Academy admin can assign Academy roles' using errcode = '42501';
  end if;
  if app.effective_state(p_profile_id) is null then
    raise exception 'not_found: that account does not exist' using errcode = 'P0002';
  end if;

  v_key := case p_role
    when 'trainee' then 'academy.trainee'
    when 'reviewer' then 'academy.review'
    when 'academy_admin' then 'academy.manage'
    else null
  end;
  if v_key is null then
    raise exception 'invalid_role: Academy roles are trainee, reviewer, and academy_admin' using errcode = '22023';
  end if;

  insert into public.account_permission (profile_id, permission_key, effect, reason, created_by)
  values (p_profile_id, v_key, p_effect, nullif(btrim(coalesce(p_reason, '')), ''), auth.uid())
  on conflict (profile_id, permission_key) do update
    set effect = excluded.effect,
        reason = excluded.reason,
        created_by = excluded.created_by,
        created_at = now();

  perform app.audit(
    'academy.role_assigned', 'profile', p_profile_id::text,
    format('%s the Academy %s role', case when p_effect = 'grant' then 'Granted' else 'Denied' end, p_role),
    null,
    jsonb_build_object('role', p_role, 'permission', v_key, 'effect', p_effect, 'reason', p_reason),
    null, p_profile_id
  );
end;
$$;

comment on function public.academy_assign_role(uuid, text, public.permission_effect, text) is
  'Writes an Academy role as a permission override and records it in the audit log. Denial beats the role default.';

revoke all on function public.academy_assign_role(uuid, text, public.permission_effect, text) from public, anon;
grant execute on function public.academy_assign_role(uuid, text, public.permission_effect, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Row security. A trainee's own rows, a reviewer's assigned rows, an admin's all.
-- ---------------------------------------------------------------------------

alter table public.academy_program enable row level security;
alter table public.academy_module enable row level security;
alter table public.academy_lesson enable row level security;
alter table public.academy_asset enable row level security;
alter table public.academy_quiz enable row level security;
alter table public.academy_quiz_draw enable row level security;
alter table public.academy_question enable row level security;
alter table public.academy_enrollment enable row level security;
alter table public.academy_progress enable row level security;
alter table public.academy_attempt enable row level security;
alter table public.academy_hold enable row level security;
alter table public.academy_certification enable row level security;

create policy academy_program_write on public.academy_program
  for all to authenticated
  using (app.academy_manages()) with check (app.academy_manages());
create policy academy_program_select on public.academy_program
  for select to authenticated
  using (
    app.academy_manages()
    or exists (
      select 1 from public.academy_enrollment e
      where e.program_id = academy_program.id
        and (
          app.academy_content_open(e.id)
          or (e.manager_id = app.acting_profile() and app.academy_reviews() and e.status <> 'withdrawn')
        )
    )
  );

create policy academy_module_write on public.academy_module
  for all to authenticated
  using (app.academy_manages()) with check (app.academy_manages());
create policy academy_module_select on public.academy_module
  for select to authenticated
  using (
    app.academy_manages()
    or exists (
      select 1 from public.academy_enrollment e
      where e.program_id = academy_module.program_id
        and (
          app.academy_content_open(e.id)
          or (e.manager_id = app.acting_profile() and app.academy_reviews() and e.status <> 'withdrawn')
        )
    )
  );

create policy academy_lesson_write on public.academy_lesson
  for all to authenticated
  using (app.academy_manages()) with check (app.academy_manages());
create policy academy_lesson_select on public.academy_lesson
  for select to authenticated
  using (
    app.academy_manages()
    or (
      published
      and exists (
        select 1
        from public.academy_module m
        join public.academy_enrollment e on e.program_id = m.program_id
        where m.id = academy_lesson.module_id
          and (
            (app.academy_content_open(e.id) and app.academy_module_unlocked(e.id, m.id))
            or (e.manager_id = app.acting_profile() and app.academy_reviews() and e.status <> 'withdrawn')
          )
      )
    )
  );

create policy academy_asset_write on public.academy_asset
  for all to authenticated
  using (app.academy_manages()) with check (app.academy_manages());
create policy academy_asset_select on public.academy_asset
  for select to authenticated
  using (
    app.academy_manages()
    or (
      status = 'live'
      and exists (
        select 1
        from public.academy_lesson l
        join public.academy_module m on m.id = l.module_id
        join public.academy_enrollment e on e.program_id = m.program_id
        where l.id = academy_asset.lesson_id
          and l.published
          and (
            (app.academy_content_open(e.id) and app.academy_module_unlocked(e.id, m.id))
            or (e.manager_id = app.acting_profile() and app.academy_reviews() and e.status <> 'withdrawn')
          )
      )
    )
  );

create policy academy_quiz_write on public.academy_quiz
  for all to authenticated
  using (app.academy_manages()) with check (app.academy_manages());
create policy academy_quiz_select on public.academy_quiz
  for select to authenticated
  using (
    app.academy_manages()
    or exists (
      select 1
      from public.academy_module m
      join public.academy_enrollment e on e.program_id = m.program_id
      where m.id = academy_quiz.module_id
        and (
          app.academy_content_open(e.id)
          or (e.manager_id = app.acting_profile() and app.academy_reviews() and e.status <> 'withdrawn')
        )
    )
  );

create policy academy_quiz_draw_write on public.academy_quiz_draw
  for all to authenticated
  using (app.academy_manages()) with check (app.academy_manages());
create policy academy_quiz_draw_select on public.academy_quiz_draw
  for select to authenticated
  using (
    exists (
      select 1 from public.academy_quiz q
      where q.id = academy_quiz_draw.quiz_id
    )
  );

create policy academy_question_write on public.academy_question
  for all to authenticated
  using (app.academy_manages()) with check (app.academy_manages());
-- No trainee or reviewer select. The correct answer stays on this table.

create policy academy_enrollment_write on public.academy_enrollment
  for all to authenticated
  using (app.academy_manages()) with check (app.academy_manages());
create policy academy_enrollment_select on public.academy_enrollment
  for select to authenticated
  using (
    app.academy_manages()
    or (
      app.effective_state(app.acting_profile()) = 'active'
      and status <> 'withdrawn'
      and profile_id = app.acting_profile()
    )
    or (
      app.effective_state(app.acting_profile()) = 'active'
      and status <> 'withdrawn'
      and manager_id = app.acting_profile()
      and app.academy_reviews()
    )
  );

create policy academy_progress_write on public.academy_progress
  for all to authenticated
  using (app.academy_manages()) with check (app.academy_manages());
create policy academy_progress_select on public.academy_progress
  for select to authenticated
  using (app.academy_record_open(enrollment_id));

create policy academy_attempt_write on public.academy_attempt
  for all to authenticated
  using (app.academy_manages()) with check (app.academy_manages());
create policy academy_attempt_select on public.academy_attempt
  for select to authenticated
  using (app.academy_record_open(enrollment_id));

create policy academy_hold_write on public.academy_hold
  for all to authenticated
  using (app.academy_manages()) with check (app.academy_manages());
create policy academy_hold_select on public.academy_hold
  for select to authenticated
  using (
    app.academy_manages()
    or exists (
      select 1 from public.academy_enrollment e
      where e.id = academy_hold.enrollment_id
        and e.status <> 'withdrawn'
        and e.manager_id = app.acting_profile()
        and app.academy_reviews()
    )
  );

create policy academy_certification_write on public.academy_certification
  for all to authenticated
  using (app.academy_manages()) with check (app.academy_manages());
create policy academy_certification_select on public.academy_certification
  for select to authenticated
  using (app.academy_record_open(enrollment_id));

revoke all on public.academy_program from anon, authenticated;
revoke all on public.academy_module from anon, authenticated;
revoke all on public.academy_lesson from anon, authenticated;
revoke all on public.academy_asset from anon, authenticated;
revoke all on public.academy_quiz from anon, authenticated;
revoke all on public.academy_quiz_draw from anon, authenticated;
revoke all on public.academy_question from anon, authenticated;
revoke all on public.academy_enrollment from anon, authenticated;
revoke all on public.academy_progress from anon, authenticated;
revoke all on public.academy_attempt from anon, authenticated;
revoke all on public.academy_hold from anon, authenticated;
revoke all on public.academy_certification from anon, authenticated;

grant select, insert, update, delete on public.academy_program to authenticated;
grant select, insert, update, delete on public.academy_module to authenticated;
grant select, insert, update, delete on public.academy_lesson to authenticated;
grant select, insert, update, delete on public.academy_asset to authenticated;
grant select, insert, update, delete on public.academy_quiz to authenticated;
grant select, insert, update, delete on public.academy_quiz_draw to authenticated;
grant select, insert, update, delete on public.academy_question to authenticated;
grant select, insert, update, delete on public.academy_enrollment to authenticated;
grant select, insert, update, delete on public.academy_progress to authenticated;
grant select, insert, update, delete on public.academy_attempt to authenticated;
grant select, insert, update, delete on public.academy_hold to authenticated;
grant select, insert, update, delete on public.academy_certification to authenticated;

-- Storage policies run as the storage table owner, which cannot see schema app.
-- These wrappers are the only functions the bucket policies call.
create or replace function public.academy_storage_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.academy_manages();
$$;

create or replace function public.academy_storage_read(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.academy_can_read_asset_path(p_name);
$$;

revoke all on function public.academy_storage_admin() from public, anon;
revoke all on function public.academy_storage_read(text) from public, anon;
grant execute on function public.academy_storage_admin() to authenticated;
grant execute on function public.academy_storage_read(text) to authenticated;

-- Private documents. Skipped where this database has no storage schema
-- (the local verify shim). Hosted Supabase has it.
do $bucket$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public)
    values ('academy-documents', 'academy-documents', false)
    on conflict (id) do update set public = false;
  end if;
  if to_regclass('storage.objects') is not null then
    if exists (select 1 from pg_roles where rolname = 'supabase_storage_admin') then
      grant execute on function public.academy_storage_admin() to supabase_storage_admin;
      grant execute on function public.academy_storage_read(text) to supabase_storage_admin;
    end if;
    execute $p$
      create policy academy_documents_admin on storage.objects
      for all to authenticated
      using (bucket_id = 'academy-documents' and public.academy_storage_admin())
      with check (bucket_id = 'academy-documents' and public.academy_storage_admin())
    $p$;
    execute $p$
      create policy academy_documents_read on storage.objects
      for select to authenticated
      using (bucket_id = 'academy-documents' and public.academy_storage_read(name))
    $p$;
  end if;
end
$bucket$;

-- ---------------------------------------------------------------------------
-- Curriculum shape. Configuration, not sample people. Every program stays
-- draft until lessons are loaded. No lessons, questions, enrollments, or scores.
-- ---------------------------------------------------------------------------

insert into public.academy_program (slug, name, program_type, version, status) values
  ('da-operator-academy', 'DA Operator Academy', 'core', 1, 'draft'),
  ('med-spa', 'Med Spa', 'vertical_pack', 1, 'draft'),
  ('home-services', 'Home Services', 'vertical_pack', 1, 'draft'),
  ('coaches-and-consultants', 'Coaches and Consultants', 'vertical_pack', 1, 'draft'),
  ('client-success-and-onboarding', 'Client Success and Onboarding', 'internal_track', 1, 'draft'),
  ('system-builder', 'System Builder', 'internal_track', 1, 'draft'),
  ('placement-and-operator-management', 'Placement and Operator Management', 'internal_track', 1, 'draft');

insert into public.academy_module (program_id, order_number, title, description, required, gate_type, gate_detail)
select p.id, v.order_number, v.title, v.description, true, v.gate_type, v.gate_detail
from public.academy_program p
cross join (values
  (0, 'Access and Agreement', 'Sign the operator agreement and confirm your access.', 'agreement', 'Agreement signed'),
  (1, 'Who DA Is', 'What Divine Acquisition is, and who it is for.', 'quiz', null),
  (2, 'The DA Standard', 'The standard you are held to, and the reflection that closes the module.', 'quiz_practical', 'Written reflection'),
  (3, 'What We Sell and Why It Works', 'The offer, and why the system produces the result.', 'quiz', null),
  (4, 'The Operator Stack', 'The tools you will use, practiced in the sandbox.', 'quiz_practical', 'Sandbox practical'),
  (5, 'Psychology of Human Action', 'How people decide, and what that means on a live lead.', 'quiz', null),
  (6, 'Buyer Behavior', 'How buyers move, and the signal reading drill.', 'quiz_simulation', 'Signal reading drill'),
  (7, 'Sales Training', 'The conversation, from first reply to a booked call.', 'quiz', null),
  (8, 'Applied Acquisition: The DA Speed-to-Lead System', 'The speed-to-lead system, practiced in two simulations.', 'quiz_simulation', 'Two simulations'),
  (9, 'Reporting and Data Integrity', 'What you log, and the audit that checks it.', 'quiz_practical', 'Logging audit'),
  (10, 'Client Communication', 'How you write and speak to a client.', 'quiz', null),
  (11, 'Final Quiz', 'The exam across modules 1 through 10.', 'quiz', null),
  (12, 'Capstone and Certification', 'The simulation and the supervisor sign-off.', 'sign_off', 'Simulation plus supervisor sign-off')
) as v(order_number, title, description, gate_type, gate_detail)
where p.slug = 'da-operator-academy';

insert into public.academy_quiz (
  module_id, kind, questions_per_attempt, pass_mark, pass_mark_unit,
  max_attempts, lockout_minutes, shuffle_answers, active
)
select m.id, 'module', 5, 4, 'correct', 5, 30, true, true
from public.academy_module m
join public.academy_program p on p.id = m.program_id
where p.slug = 'da-operator-academy'
  and m.order_number between 1 and 10;

insert into public.academy_quiz (
  module_id, kind, questions_per_attempt, pass_mark, pass_mark_unit,
  max_attempts, lockout_minutes, shuffle_answers, active
)
select m.id, 'final', 30, 85, 'percent', 5, 120, true, true
from public.academy_module m
join public.academy_program p on p.id = m.program_id
where p.slug = 'da-operator-academy'
  and m.order_number = 11;

insert into public.academy_quiz_draw (quiz_id, source_module_id, question_count)
select q.id, source.id, 3
from public.academy_quiz q
join public.academy_module final_mod on final_mod.id = q.module_id
join public.academy_module source
  on source.program_id = final_mod.program_id
 and source.order_number between 1 and 10
where q.kind = 'final';
