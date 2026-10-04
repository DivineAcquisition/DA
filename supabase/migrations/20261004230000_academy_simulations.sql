-- Simulations, the Signal Reading drill, written reflections, practicals, and grading.
-- The AI key stays on the server. This migration does not call it.
-- No scenarios, transcripts, or people are seeded.

alter table public.academy_setting
  add column if not exists sim_max_attempts integer not null default 5 check (sim_max_attempts between 1 and 20),
  add column if not exists sim_lockout_minutes integer not null default 60 check (sim_lockout_minutes between 0 and 1440),
  add column if not exists sim_abandoned_minutes integer not null default 60 check (sim_abandoned_minutes between 5 and 1440),
  add column if not exists sim_daily_limit integer not null default 5 check (sim_daily_limit between 1 and 50),
  add column if not exists sim_pass_score integer not null default 80 check (sim_pass_score between 1 and 100),
  add column if not exists capstone_pass_score integer not null default 85 check (capstone_pass_score between 1 and 100),
  add column if not exists capstone_compliance_min integer not null default 4 check (capstone_compliance_min between 0 and 5),
  add column if not exists speed_thresholds jsonb not null default '{"5":60,"4":180,"3":300,"2":600,"1":900}'::jsonb,
  add column if not exists reflection_max_attempts integer not null default 3 check (reflection_max_attempts between 1 and 10),
  add column if not exists reflection_min_words integer not null default 150 check (reflection_min_words between 1 and 2000),
  add column if not exists reflection_pass_total integer not null default 10 check (reflection_pass_total between 1 and 15),
  add column if not exists reflection_criterion_min integer not null default 2 check (reflection_criterion_min between 0 and 5),
  add column if not exists practical_max_submissions integer not null default 3 check (practical_max_submissions between 1 and 10),
  add column if not exists drill_questions integer not null default 8 check (drill_questions between 1 and 30),
  add column if not exists drill_pass_mark integer not null default 6 check (drill_pass_mark between 1 and 30),
  add column if not exists drill_max_attempts integer not null default 5 check (drill_max_attempts between 1 and 20),
  add column if not exists drill_lockout_minutes integer not null default 30 check (drill_lockout_minutes between 0 and 1440),
  add column if not exists ai_input_usd_per_million numeric not null default 3 check (ai_input_usd_per_million >= 0),
  add column if not exists ai_output_usd_per_million numeric not null default 15 check (ai_output_usd_per_million >= 0);

comment on column public.academy_setting.speed_thresholds is
  'Seconds allowed for each Speed score from 5 down to 1. Speed is timed, not judged by the model.';

alter table public.academy_hold
  add column if not exists simulation_id uuid,
  add column if not exists drill_module_id uuid,
  add column if not exists reflection_id uuid,
  add column if not exists practical_id uuid;

-- ---------------------------------------------------------------------------
-- Offer packs and rubrics. A new edit keeps the previous version.
-- ---------------------------------------------------------------------------

create table public.academy_offer_pack (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version integer not null check (version > 0),
  created_at timestamptz not null default now(),
  created_by uuid references public.profile (id),
  unique (name, version)
);

create table public.academy_offer (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references public.academy_offer_pack (id) on delete cascade,
  slug text not null,
  title text not null,
  body text not null,
  sort_order integer not null default 1,
  unique (pack_id, slug)
);

comment on table public.academy_offer_pack is
  'One version of the offers an operator may describe. Simulations and the grader read this text.';

create table public.academy_rubric (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('conversation', 'reflection')),
  version integer not null check (version > 0),
  created_at timestamptz not null default now(),
  created_by uuid references public.profile (id),
  unique (name, version)
);

create table public.academy_rubric_criterion (
  id uuid primary key default gen_random_uuid(),
  rubric_id uuid not null references public.academy_rubric (id) on delete cascade,
  criterion_key text not null,
  name text not null,
  description text not null default '',
  weight numeric not null default 1 check (weight > 0),
  score_0 text not null default '',
  score_3 text not null default '',
  score_5 text not null default '',
  critical boolean not null default false,
  minimum_score integer not null default 0 check (minimum_score between 0 and 5),
  sort_order integer not null default 1,
  unique (rubric_id, criterion_key)
);

comment on table public.academy_rubric_criterion is
  'What a 0, a 3, and a 5 look like. Trainees do not receive these descriptions.';

insert into public.academy_rubric (name, kind, version)
values ('Conversation', 'conversation', 1), ('Reflection', 'reflection', 1);

insert into public.academy_rubric_criterion (rubric_id, criterion_key, name, description, weight, score_0, score_3, score_5, critical, minimum_score, sort_order)
select r.id, c.key, c.name, c.description, 1, c.s0, c.s3, c.s5, c.critical, c.minimum, c.sort_order
from public.academy_rubric r
join (values
  ('speed', 'Speed', 'How fast the operator answered the first message.', 'No reply, or a reply after the lowest threshold.', 'A reply inside the middle threshold.', 'A reply inside the fastest threshold.', false, 0, 1),
  ('opening', 'Opening', 'The first reply is clear and fits the situation.', 'No greeting or the wrong situation.', 'A plain greeting with the situation named.', 'A short, specific opening that invites a reply.', false, 0, 2),
  ('qualification', 'Qualification', 'The operator learns whether the lead is a fit.', 'No questions.', 'Some useful questions.', 'The fit is clear from the lead''s own answers.', false, 0, 3),
  ('objection', 'Objection Handling', 'The concern is heard and answered within the offer.', 'The concern is ignored or argued.', 'The concern is named.', 'The concern is answered with what the offer allows.', false, 0, 4),
  ('handoff', 'Handoff', 'The next step is specific and agreed.', 'No next step.', 'A next step is mentioned.', 'The lead agrees a specific next step.', false, 0, 5),
  ('compliance', 'Compliance', 'Nothing is promised, priced, or claimed outside the Offer Pack.', 'A promise, a price, or a claim outside the pack.', 'Mostly inside the pack, with one soft stretch.', 'Everything said is inside the Offer Pack.', true, 3, 6),
  ('logging', 'Logging', 'The log matches the transcript.', 'No log, or the log invents facts.', 'The log covers the outcome.', 'The log matches the transcript and names the next step.', false, 0, 7)
) as c(key, name, description, s0, s3, s5, critical, minimum, sort_order) on true
where r.name = 'Conversation' and r.version = 1;

insert into public.academy_rubric_criterion (rubric_id, criterion_key, name, description, weight, score_0, score_3, score_5, critical, minimum_score, sort_order)
select r.id, c.key, c.name, c.description, 1, c.s0, c.s3, c.s5, true, 2, c.sort_order
from public.academy_rubric r
join (values
  ('standard', 'Understanding of the DA Standard', 'The answer shows what the standard requires.', 'The standard is missing or wrong.', 'The standard is named in general terms.', 'The standard is stated in the operator''s own words.', 1),
  ('examples', 'Specific personal examples', 'The answer uses concrete moments, not slogans.', 'No example.', 'An example is general.', 'A specific moment shows the point.', 2),
  ('ownership', 'Ownership', 'The answer owns the operator''s part.', 'The answer blames someone else.', 'The operator names a part they played.', 'The operator owns what they will do differently.', 3)
) as c(key, name, description, s0, s3, s5, sort_order) on true
where r.name = 'Reflection' and r.version = 1;

-- ---------------------------------------------------------------------------
-- Simulations, drills, reflections, practicals.
-- ---------------------------------------------------------------------------

create table public.academy_simulation (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  vertical text not null check (vertical in ('med_spa', 'home_services', 'coaches', 'general')),
  module_id uuid not null references public.academy_module (id) on delete cascade,
  gate_part_id uuid references public.academy_gate_part (id) on delete set null,
  brief text not null default '',
  persona text not null default '',
  difficulty text not null default 'standard' check (difficulty in ('easy', 'standard', 'hard')),
  offer_pack_id uuid references public.academy_offer_pack (id),
  rubric_id uuid references public.academy_rubric (id),
  max_turns integer not null default 12 check (max_turns between 2 and 40),
  time_limit_seconds integer check (time_limit_seconds is null or time_limit_seconds between 60 and 7200),
  pass_score integer check (pass_score is null or pass_score between 1 and 100),
  capstone boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'ready', 'live')),
  sort_order integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.academy_simulation.persona is
  'Hidden from trainees until the simulation is passed. Never sent to the browser before that.';

create table public.academy_sim_lesson (
  simulation_id uuid not null references public.academy_simulation (id) on delete cascade,
  criterion_key text not null,
  lesson_id uuid not null references public.academy_lesson (id) on delete cascade,
  primary key (simulation_id, criterion_key, lesson_id)
);

create table public.academy_sim_session (
  id uuid primary key default gen_random_uuid(),
  simulation_id uuid not null references public.academy_simulation (id) on delete cascade,
  enrollment_id uuid references public.academy_enrollment (id) on delete cascade,
  actor_id uuid references public.profile (id),
  preview boolean not null default false,
  status text not null default 'open' check (status in ('open', 'logging', 'submitted', 'abandoned', 'needs_manual', 'graded')),
  lead_first_at timestamptz,
  operator_first_at timestamptz,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  lockout_until timestamptz,
  rubric_id uuid references public.academy_rubric (id),
  offer_pack_id uuid references public.academy_offer_pack (id),
  total_score numeric,
  passed boolean,
  fail_reason text,
  summary text,
  violations jsonb not null default '[]'::jsonb,
  log_outcome text,
  log_learned text,
  log_next text,
  log_notes text,
  reopen_lesson_ids uuid[] not null default '{}'
);

create unique index academy_sim_one_open
  on public.academy_sim_session (enrollment_id)
  where status = 'open' and enrollment_id is not null and preview = false;

create table public.academy_sim_message (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.academy_sim_session (id) on delete cascade,
  role text not null check (role in ('lead', 'operator')),
  body text not null,
  created_at timestamptz not null default now()
);

create table public.academy_sim_flag (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.academy_sim_session (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

comment on table public.academy_sim_flag is
  'The trainee tried to change the lead''s role. Reviewers can read this. The lead does not comply.';

create table public.academy_grade (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.academy_sim_session (id) on delete cascade,
  reflection_attempt_id uuid,
  criterion_key text not null,
  ai_score integer check (ai_score is null or ai_score between 0 and 5),
  human_score integer check (human_score is null or human_score between 0 and 5),
  evidence jsonb not null default '[]'::jsonb,
  next_step text,
  human_note text,
  unique (session_id, criterion_key)
);

create table public.academy_ai_call (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.academy_sim_session (id) on delete cascade,
  reflection_attempt_id uuid,
  kind text not null,
  tokens_in integer not null default 0,
  tokens_out integer not null default 0,
  cost_usd numeric not null default 0,
  ok boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.academy_calibration (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.academy_sim_session (id) on delete cascade,
  criterion_key text not null,
  human_score integer not null check (human_score between 0 and 5),
  note text,
  created_by uuid references public.profile (id),
  created_at timestamptz not null default now(),
  unique (session_id, criterion_key)
);

create table public.academy_drill_item (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.academy_module (id) on delete cascade,
  situation text not null,
  source text not null default '',
  reply_speed text not null default '',
  earlier_touches text not null default '',
  readiness text not null check (readiness in ('not_ready', 'ready', 'not_a_fit')),
  moves jsonb not null,
  correct_move text not null,
  concept_id uuid references public.academy_concept (id) on delete set null,
  concept_tag text,
  lesson_id uuid references public.academy_lesson (id) on delete set null,
  difficulty text not null default 'standard' check (difficulty in ('easy', 'standard', 'hard')),
  explanation text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.academy_drill_item is
  'Signal Reading items. Correct answers stay off the trainee payload until a pass.';

create table public.academy_drill_attempt (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.academy_enrollment (id) on delete cascade,
  module_id uuid not null references public.academy_module (id) on delete cascade,
  attempt_number integer not null check (attempt_number > 0),
  item_ids uuid[] not null,
  answers jsonb not null default '[]'::jsonb,
  score integer,
  passed boolean,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  lockout_until timestamptz,
  unique (enrollment_id, module_id, attempt_number)
);

create table public.academy_drill_key (
  attempt_id uuid primary key references public.academy_drill_attempt (id) on delete cascade,
  items jsonb not null
);

comment on table public.academy_drill_key is
  'Correct readiness, move, and explanation frozen at draw time. Trainees cannot read this table.';

create unique index academy_drill_one_open
  on public.academy_drill_attempt (enrollment_id)
  where finished_at is null;

create table public.academy_reflection (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.academy_module (id) on delete cascade,
  gate_part_id uuid references public.academy_gate_part (id) on delete set null,
  prompt text not null default '',
  min_words integer not null default 150,
  rubric_id uuid references public.academy_rubric (id),
  pass_total integer not null default 10,
  criterion_min integer not null default 2,
  status text not null default 'draft' check (status in ('draft', 'live'))
);

create table public.academy_reflection_attempt (
  id uuid primary key default gen_random_uuid(),
  reflection_id uuid not null references public.academy_reflection (id) on delete cascade,
  enrollment_id uuid not null references public.academy_enrollment (id) on delete cascade,
  attempt_number integer not null,
  body text not null,
  status text not null default 'submitted' check (status in ('submitted', 'graded', 'needs_manual')),
  total_score numeric,
  passed boolean,
  fail_reason text,
  summary text,
  created_at timestamptz not null default now(),
  unique (enrollment_id, reflection_id, attempt_number)
);

alter table public.academy_grade
  add constraint academy_grade_reflection_fk
  foreign key (reflection_attempt_id) references public.academy_reflection_attempt (id) on delete cascade;

alter table public.academy_ai_call
  add constraint academy_ai_call_reflection_fk
  foreign key (reflection_attempt_id) references public.academy_reflection_attempt (id) on delete cascade;

create unique index academy_grade_reflection_key
  on public.academy_grade (reflection_attempt_id, criterion_key)
  where reflection_attempt_id is not null;

create table public.academy_practical (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.academy_module (id) on delete cascade,
  gate_part_id uuid references public.academy_gate_part (id) on delete set null,
  title text not null,
  instructions text not null default '',
  status text not null default 'draft' check (status in ('draft', 'live'))
);

create table public.academy_practical_item (
  id uuid primary key default gen_random_uuid(),
  practical_id uuid not null references public.academy_practical (id) on delete cascade,
  label text not null,
  required boolean not null default true,
  sort_order integer not null default 1
);

create table public.academy_practical_submission (
  id uuid primary key default gen_random_uuid(),
  practical_id uuid not null references public.academy_practical (id) on delete cascade,
  enrollment_id uuid not null references public.academy_enrollment (id) on delete cascade,
  submission_number integer not null,
  status text not null default 'pending' check (status in ('pending', 'needs_work', 'passed')),
  created_at timestamptz not null default now(),
  unique (enrollment_id, practical_id, submission_number)
);

create table public.academy_practical_evidence (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.academy_practical_submission (id) on delete cascade,
  item_id uuid not null references public.academy_practical_item (id) on delete cascade,
  kind text not null check (kind in ('text', 'link', 'file')),
  body text,
  storage_path text,
  status text not null default 'pending' check (status in ('pending', 'pass', 'needs_work')),
  comment text,
  reviewed_by uuid references public.profile (id),
  reviewed_at timestamptz,
  unique (submission_id, item_id)
);

comment on column public.academy_practical_evidence.storage_path is
  'Object name in the private academy-documents bucket.';

insert into public.academy_gate_part (module_id, part_key, label, sort_order)
select m.id, 'capstone', 'Capstone simulation', 2
from public.academy_module m
join public.academy_program p on p.id = m.program_id
where p.slug = 'da-operator-academy' and m.order_number = 12
  and not exists (
    select 1 from public.academy_gate_part gp where gp.module_id = m.id and gp.part_key = 'capstone'
  );

alter table public.academy_hold
  add constraint academy_hold_simulation_fk foreign key (simulation_id) references public.academy_simulation (id),
  add constraint academy_hold_drill_fk foreign key (drill_module_id) references public.academy_module (id),
  add constraint academy_hold_reflection_fk foreign key (reflection_id) references public.academy_reflection (id),
  add constraint academy_hold_practical_fk foreign key (practical_id) references public.academy_practical (id);

-- ---------------------------------------------------------------------------
-- Shared helpers.
-- ---------------------------------------------------------------------------

create or replace function app.academy_speed_score(p_seconds integer)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v jsonb;
  v_score integer := 0;
  v_key text;
  v_limit integer;
begin
  select speed_thresholds into v from public.academy_setting where id = 1;
  for v_key, v_limit in
    select key, value::integer
    from jsonb_each_text(coalesce(v, '{}'::jsonb))
    order by value::integer
  loop
    if p_seconds is not null and p_seconds <= v_limit then
      return greatest(v_key::integer, v_score);
    end if;
  end loop;
  return 0;
end;
$$;

create or replace function app.academy_practice_hold(
  p_enrollment uuid,
  p_reason text,
  p_attempts integer,
  p_summary text,
  p_simulation uuid,
  p_drill uuid,
  p_reflection uuid,
  p_practical uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.academy_enrollment set status = 'on_hold_review'
  where id = p_enrollment and status in ('active', 'stalled', 'completed');
  if not exists (
    select 1 from public.academy_hold h
    where h.enrollment_id = p_enrollment and h.status in ('open', 'under_review')
  ) then
    insert into public.academy_hold (
      enrollment_id, reason, attempts_used, status, concept_summary,
      simulation_id, drill_module_id, reflection_id, practical_id
    ) values (
      p_enrollment, p_reason, p_attempts, 'open', p_summary,
      p_simulation, p_drill, p_reflection, p_practical
    );
  end if;
  perform app.audit('academy.hold_opened', 'academy_hold', p_enrollment::text, p_reason, null,
    jsonb_build_object('attempts_used', p_attempts, 'summary', p_summary));
end;
$$;

create or replace function app.academy_mark_part(p_enrollment uuid, p_part uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_part is null then
    return;
  end if;
  insert into public.academy_gate_progress (enrollment_id, gate_part_id, status, note, satisfied_at)
  values (p_enrollment, p_part, 'satisfied', 'Passed.', now())
  on conflict (enrollment_id, gate_part_id) do update
    set status = 'satisfied', note = excluded.note, satisfied_at = excluded.satisfied_at;
end;
$$;

create or replace function app.academy_service_only()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if current_user in ('postgres', 'supabase_admin') then
    return;
  end if;
  if coalesce(auth.role(), '') = 'service_role' then
    return;
  end if;
  raise exception 'permission_denied: this write is server-only' using errcode = '42501';
end;
$$;

create or replace function app.academy_sim_owned(p_session uuid)
returns public.academy_sim_session
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.academy_sim_session;
begin
  select * into v from public.academy_sim_session where id = p_session;
  if v.id is null then
    raise exception 'not_found: that session does not exist' using errcode = 'P0002';
  end if;
  if v.preview then
    if not app.academy_manages() or v.actor_id is distinct from app.acting_profile() then
      raise exception 'permission_denied: this preview is not yours' using errcode = '42501';
    end if;
  elsif not exists (
    select 1 from public.academy_enrollment e
    where e.id = v.enrollment_id and e.profile_id = app.acting_profile()
  ) and not app.academy_manages() then
    raise exception 'permission_denied: this session is not yours' using errcode = '42501';
  end if;
  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin writes. Versions stay.
-- ---------------------------------------------------------------------------

create or replace function public.academy_offer_save(p_payload jsonb)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_payload ->> 'name', ''));
  v_version integer;
  v_id uuid;
  v_offer jsonb;
begin
  if not app.academy_manages() then
    raise exception 'permission_denied: an Academy Admin edits the Offer Pack' using errcode = '42501';
  end if;
  if v_name = '' or jsonb_array_length(coalesce(p_payload -> 'offers', '[]'::jsonb)) < 1 then
    raise exception 'offer_empty: name the pack and include at least one offer' using errcode = '22023';
  end if;
  select coalesce(max(version), 0) + 1 into v_version from public.academy_offer_pack where name = v_name;
  insert into public.academy_offer_pack (name, version, created_by)
  values (v_name, v_version, app.acting_profile())
  returning id into v_id;
  for v_offer in select value from jsonb_array_elements(p_payload -> 'offers')
  loop
    if length(btrim(coalesce(v_offer ->> 'title', ''))) = 0 or length(btrim(coalesce(v_offer ->> 'body', ''))) = 0 then
      raise exception 'offer_empty: each offer needs a title and text' using errcode = '22023';
    end if;
    insert into public.academy_offer (pack_id, slug, title, body, sort_order)
    values (
      v_id,
      coalesce(nullif(btrim(v_offer ->> 'slug'), ''), lower(regexp_replace(v_offer ->> 'title', '[^a-zA-Z0-9]+', '-', 'g'))),
      btrim(v_offer ->> 'title'),
      btrim(v_offer ->> 'body'),
      coalesce((v_offer ->> 'sort_order')::integer, 1)
    );
  end loop;
  perform app.audit('academy.offer_version', 'academy_offer_pack', v_id::text, 'Offer Pack version saved.', null,
    jsonb_build_object('name', v_name, 'version', v_version));
  return v_id;
end;
$$;

create or replace function public.academy_rubric_save(p_payload jsonb)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_payload ->> 'name', ''));
  v_kind text := coalesce(p_payload ->> 'kind', 'conversation');
  v_version integer;
  v_id uuid;
  v_row jsonb;
begin
  if not app.academy_manages() then
    raise exception 'permission_denied: an Academy Admin edits rubrics' using errcode = '42501';
  end if;
  if v_name = '' or v_kind not in ('conversation', 'reflection') then
    raise exception 'rubric_empty: name the rubric' using errcode = '22023';
  end if;
  select coalesce(max(version), 0) + 1 into v_version from public.academy_rubric where name = v_name;
  insert into public.academy_rubric (name, kind, version, created_by)
  values (v_name, v_kind, v_version, app.acting_profile())
  returning id into v_id;
  for v_row in select value from jsonb_array_elements(coalesce(p_payload -> 'criteria', '[]'::jsonb))
  loop
    insert into public.academy_rubric_criterion (
      rubric_id, criterion_key, name, description, weight, score_0, score_3, score_5, critical, minimum_score, sort_order
    ) values (
      v_id,
      btrim(v_row ->> 'key'),
      btrim(v_row ->> 'name'),
      coalesce(v_row ->> 'description', ''),
      coalesce((v_row ->> 'weight')::numeric, 1),
      coalesce(v_row ->> 'score_0', ''),
      coalesce(v_row ->> 'score_3', ''),
      coalesce(v_row ->> 'score_5', ''),
      coalesce((v_row ->> 'critical')::boolean, false),
      coalesce((v_row ->> 'minimum_score')::integer, 0),
      coalesce((v_row ->> 'sort_order')::integer, 1)
    );
  end loop;
  perform app.audit('academy.rubric_version', 'academy_rubric', v_id::text, 'Rubric version saved.', null,
    jsonb_build_object('name', v_name, 'version', v_version));
  return v_id;
end;
$$;

create or replace function public.academy_sim_save(p_payload jsonb)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_payload ->> 'id', '')::uuid;
  v_status text := coalesce(p_payload ->> 'status', 'draft');
begin
  if not app.academy_manages() then
    raise exception 'permission_denied: an Academy Admin edits simulations' using errcode = '42501';
  end if;
  if v_status = 'live' and (
    length(btrim(coalesce(p_payload ->> 'brief', ''))) = 0
    or length(btrim(coalesce(p_payload ->> 'persona', ''))) = 0
    or nullif(p_payload ->> 'offer_pack_id', '') is null
    or nullif(p_payload ->> 'rubric_id', '') is null
  ) then
    raise exception 'sim_closed: a live simulation needs a brief, a persona, an Offer Pack version, and a rubric' using errcode = '22023';
  end if;
  if v_id is null then
    insert into public.academy_simulation (
      title, vertical, module_id, gate_part_id, brief, persona, difficulty, offer_pack_id, rubric_id,
      max_turns, time_limit_seconds, pass_score, capstone, status, sort_order
    ) values (
      btrim(p_payload ->> 'title'),
      p_payload ->> 'vertical',
      (p_payload ->> 'module_id')::uuid,
      nullif(p_payload ->> 'gate_part_id', '')::uuid,
      coalesce(p_payload ->> 'brief', ''),
      coalesce(p_payload ->> 'persona', ''),
      coalesce(p_payload ->> 'difficulty', 'standard'),
      nullif(p_payload ->> 'offer_pack_id', '')::uuid,
      nullif(p_payload ->> 'rubric_id', '')::uuid,
      coalesce((p_payload ->> 'max_turns')::integer, 12),
      nullif(p_payload ->> 'time_limit_seconds', '')::integer,
      nullif(p_payload ->> 'pass_score', '')::integer,
      coalesce((p_payload ->> 'capstone')::boolean, false),
      v_status,
      coalesce((p_payload ->> 'sort_order')::integer, 1)
    ) returning id into v_id;
    perform app.audit('academy.simulation_created', 'academy_simulation', v_id::text, 'Simulation created.', null, p_payload - 'persona');
  else
    update public.academy_simulation set
      title = btrim(p_payload ->> 'title'),
      vertical = p_payload ->> 'vertical',
      module_id = (p_payload ->> 'module_id')::uuid,
      gate_part_id = nullif(p_payload ->> 'gate_part_id', '')::uuid,
      brief = coalesce(p_payload ->> 'brief', ''),
      persona = coalesce(p_payload ->> 'persona', ''),
      difficulty = coalesce(p_payload ->> 'difficulty', 'standard'),
      offer_pack_id = nullif(p_payload ->> 'offer_pack_id', '')::uuid,
      rubric_id = nullif(p_payload ->> 'rubric_id', '')::uuid,
      max_turns = coalesce((p_payload ->> 'max_turns')::integer, 12),
      time_limit_seconds = nullif(p_payload ->> 'time_limit_seconds', '')::integer,
      pass_score = nullif(p_payload ->> 'pass_score', '')::integer,
      capstone = coalesce((p_payload ->> 'capstone')::boolean, false),
      status = v_status,
      sort_order = coalesce((p_payload ->> 'sort_order')::integer, sort_order),
      updated_at = now()
    where id = v_id;
    perform app.audit(
      case when v_status = 'live' then 'academy.simulation_published' when v_status = 'draft' then 'academy.simulation_retired' else 'academy.simulation_edited' end,
      'academy_simulation', v_id::text, 'Simulation saved.', null, p_payload - 'persona'
    );
  end if;
  return v_id;
end;
$$;

create or replace function public.academy_sim_admin(p_simulation uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.academy_simulation;
begin
  if not app.academy_manages() then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  select * into v from public.academy_simulation where id = p_simulation;
  return to_jsonb(v);
end;
$$;

create or replace function public.academy_sim_begin(p_simulation uuid, p_preview boolean default false)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_sim public.academy_simulation;
  v_enrollment public.academy_enrollment;
  v_settings public.academy_setting;
  v_used integer;
  v_allowed integer;
  v_id uuid;
  v_last public.academy_sim_session;
begin
  select * into v_sim from public.academy_simulation where id = p_simulation;
  select * into v_settings from public.academy_setting where id = 1;
  if p_preview then
    if not app.academy_manages() then
      raise exception 'permission_denied: only an Academy Admin can preview' using errcode = '42501';
    end if;
    if v_sim.id is null then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
    insert into public.academy_sim_session (simulation_id, actor_id, preview, status, rubric_id, offer_pack_id)
    values (v_sim.id, app.acting_profile(), true, 'open', v_sim.rubric_id, v_sim.offer_pack_id)
    returning id into v_id;
    return v_id;
  end if;
  v_enrollment := app.academy_primary_for_actor();
  if v_enrollment.id is null or not app.academy_content_open(v_enrollment.id) then
    raise exception 'sim_closed: this simulation is not open' using errcode = '42501';
  end if;
  if v_sim.status <> 'live' or v_sim.module_id is null then
    raise exception 'sim_closed: this simulation is not live' using errcode = '42501';
  end if;
  if not app.academy_lessons_complete(v_enrollment.id, v_sim.module_id)
     and exists (select 1 from public.academy_lesson l where l.module_id = v_sim.module_id and l.published and l.archived_at is null) then
    raise exception 'lessons_open: finish the lessons first' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.academy_gate_part gp
    where gp.module_id = v_sim.module_id and gp.part_key = 'quiz'
      and not app.academy_gate_part_satisfied(v_enrollment.id, gp)
  ) then
    raise exception 'quiz_first: pass the module quiz first' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.academy_sim_session s
    where s.enrollment_id = v_enrollment.id and s.status = 'open' and s.preview = false
  ) then
    raise exception 'session_open: finish the simulation you already started' using errcode = '42501';
  end if;
  select count(*) into v_used from public.academy_sim_session
  where enrollment_id = v_enrollment.id and simulation_id = v_sim.id and preview = false and status <> 'open';
  v_allowed := coalesce(v_settings.sim_max_attempts, 5);
  if v_used >= v_allowed then
    raise exception 'attempts_used: this simulation is on hold' using errcode = '42501';
  end if;
  select * into v_last from public.academy_sim_session
  where enrollment_id = v_enrollment.id and simulation_id = v_sim.id and preview = false and finished_at is not null
  order by finished_at desc limit 1;
  if v_last.lockout_until > now() then
    raise exception 'sim_locked: the next attempt is not open yet' using errcode = '42501';
  end if;
  if v_last.id is not null and exists (
    select 1 from unnest(v_last.reopen_lesson_ids) lid
    where not exists (
      select 1 from public.academy_progress pr
      where pr.enrollment_id = v_enrollment.id and pr.lesson_id = lid and pr.last_opened_at > v_last.finished_at
    )
  ) then
    raise exception 'reopen_required: reopen the linked lessons first' using errcode = '42501';
  end if;
  if (
    select count(*) from public.academy_sim_session
    where enrollment_id = v_enrollment.id and preview = false and started_at::date = current_date
  ) >= v_settings.sim_daily_limit then
    raise exception 'daily_limit: the daily simulation limit is reached' using errcode = '42501';
  end if;
  insert into public.academy_sim_session (simulation_id, enrollment_id, actor_id, preview, status, rubric_id, offer_pack_id)
  values (v_sim.id, v_enrollment.id, app.acting_profile(), false, 'open', v_sim.rubric_id, v_sim.offer_pack_id)
  returning id into v_id;
  perform app.audit('academy.simulation_started', 'academy_sim_session', v_id::text, 'Simulation started.', null,
    jsonb_build_object('simulation_id', v_sim.id));
  return v_id;
end;
$$;

create or replace function public.academy_sim_post_lead(p_session uuid, p_body text, p_end boolean default false)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v public.academy_sim_session;
begin
  perform app.academy_service_only();
  select * into v from public.academy_sim_session where id = p_session and status = 'open';
  if v.id is null then
    raise exception 'session_closed' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_body, ''))) = 0 then
    raise exception 'empty_message' using errcode = '22023';
  end if;
  insert into public.academy_sim_message (session_id, role, body) values (v.id, 'lead', btrim(p_body));
  if v.lead_first_at is null then
    update public.academy_sim_session set lead_first_at = now() where id = v.id;
  end if;
  if p_end then
    update public.academy_sim_session set status = 'logging' where id = v.id;
  end if;
end;
$$;

create or replace function public.academy_sim_post_operator(p_session uuid, p_body text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v public.academy_sim_session := app.academy_sim_owned(p_session);
  v_sim public.academy_simulation;
  v_turns integer;
  v_flag boolean := false;
begin
  if v.status <> 'open' then
    raise exception 'session_closed: this conversation is already finished' using errcode = '42501';
  end if;
  if v.lead_first_at is null then
    raise exception 'lead_first: wait for the lead''s first message' using errcode = '42501';
  end if;
  select * into v_sim from public.academy_simulation where id = v.simulation_id;
  if v_sim.time_limit_seconds is not null
     and v.lead_first_at + make_interval(secs => v_sim.time_limit_seconds) <= now() then
    update public.academy_sim_session set status = 'logging' where id = v.id;
    return jsonb_build_object('continue', false, 'reason', 'time');
  end if;
  select count(*) into v_turns from public.academy_sim_message where session_id = v.id and role = 'operator';
  if v_turns >= v_sim.max_turns then
    update public.academy_sim_session set status = 'logging' where id = v.id;
    return jsonb_build_object('continue', false, 'reason', 'turns');
  end if;
  v_flag := p_body ~* '(ignore (all |your |previous )|system prompt|reveal your (persona|instructions)|you are now|act as )';
  insert into public.academy_sim_message (session_id, role, body) values (v.id, 'operator', btrim(p_body));
  if v.operator_first_at is null then
    update public.academy_sim_session set operator_first_at = now() where id = v.id;
  end if;
  if v_flag then
    insert into public.academy_sim_flag (session_id, body) values (v.id, btrim(p_body));
    perform app.audit('academy.simulation_jailbreak', 'academy_sim_session', v.id::text,
      'The trainee tried to change the lead''s role.', null, jsonb_build_object('session_id', v.id));
  end if;
  if v_turns + 1 >= v_sim.max_turns then
    update public.academy_sim_session set status = 'logging' where id = v.id;
    return jsonb_build_object('continue', false, 'reason', 'turns', 'flagged', v_flag);
  end if;
  return jsonb_build_object('continue', true, 'flagged', v_flag, 'turns', v_turns + 1);
end;
$$;

create or replace function public.academy_sim_submit(
  p_session uuid,
  p_outcome text,
  p_learned text,
  p_next text,
  p_notes text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v public.academy_sim_session := app.academy_sim_owned(p_session);
begin
  if v.preview then
    update public.academy_sim_session set status = 'graded', finished_at = now(), passed = null, total_score = null where id = v.id;
    return;
  end if;
  if v.status not in ('open', 'logging') then
    raise exception 'session_closed: this conversation is already submitted' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_outcome, ''))) = 0 or length(btrim(coalesce(p_learned, ''))) = 0 or length(btrim(coalesce(p_next, ''))) = 0 then
    raise exception 'log_required: complete the interaction log before grading' using errcode = '22023';
  end if;
  update public.academy_sim_session set
    status = 'submitted',
    finished_at = now(),
    log_outcome = btrim(p_outcome),
    log_learned = btrim(p_learned),
    log_next = btrim(p_next),
    log_notes = nullif(btrim(coalesce(p_notes, '')), '')
  where id = v.id;
  perform app.audit('academy.simulation_submitted', 'academy_sim_session', v.id::text, 'Simulation submitted for grading.', null, null);
end;
$$;

create or replace function public.academy_sim_abandon_due()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_minutes integer;
  v_count integer;
begin
  select sim_abandoned_minutes into v_minutes from public.academy_setting where id = 1;
  update public.academy_sim_session
  set status = 'abandoned', finished_at = now(),
      log_outcome = coalesce(log_outcome, 'Abandoned'),
      log_learned = coalesce(log_learned, ''),
      log_next = coalesce(log_next, '')
  where status = 'open' and preview = false
    and started_at + make_interval(mins => coalesce(v_minutes, 60)) <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.academy_grade_manual(p_session uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v public.academy_sim_session;
begin
  perform app.academy_service_only();
  select * into v from public.academy_sim_session where id = p_session;
  if v.id is null or v.preview then
    return;
  end if;
  update public.academy_sim_session
  set status = 'needs_manual', passed = null, total_score = null, fail_reason = 'Needs manual grading.'
  where id = v.id;
  perform app.audit('academy.grade_manual', 'academy_sim_session', v.id::text,
    'Grading failed. The run needs a person.', null, null);
end;
$$;

create or replace function app.academy_apply_scores(
  p_session uuid,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.academy_sim_session;
  v_sim public.academy_simulation;
  v_row jsonb;
  v_key text;
  v_ai integer;
  v_final integer;
  v_weight numeric;
  v_sum numeric := 0;
  v_weights numeric := 0;
  v_total numeric;
  v_pass_score integer;
  v_critical_fail text;
  v_passed boolean;
  v_seconds integer;
  v_speed integer;
  v_lessons uuid[] := '{}';
  v_low integer := 5;
  v_settings public.academy_setting;
  v_used integer;
  v_c record;
begin
  select * into v from public.academy_sim_session where id = p_session for update;
  select * into v_sim from public.academy_simulation where id = v.simulation_id;
  select * into v_settings from public.academy_setting where id = 1;
  if v.operator_first_at is not null and v.lead_first_at is not null then
    v_seconds := greatest(floor(extract(epoch from (v.operator_first_at - v.lead_first_at)))::integer, 0);
  end if;
  v_speed := app.academy_speed_score(coalesce(v_seconds, 999999));

  for v_row in
    select to_jsonb(c) || jsonb_build_object('key', c.criterion_key) from public.academy_rubric_criterion c where c.rubric_id = v.rubric_id
  loop
    v_key := v_row ->> 'criterion_key';
    if v_key = 'speed' then
      v_ai := v_speed;
    else
      select (item ->> 'score')::integer into v_ai
      from jsonb_array_elements(coalesce(p_payload -> 'criteria', '[]'::jsonb)) item
      where item ->> 'key' = v_key;
      if v_ai is null then
        select g.ai_score into v_ai from public.academy_grade g where g.session_id = v.id and g.criterion_key = v_key;
      end if;
      if v_ai is null or v_ai < 0 or v_ai > 5 then
        raise exception 'grade_invalid: a criterion score is missing' using errcode = '22023';
      end if;
    end if;
    insert into public.academy_grade (session_id, criterion_key, ai_score, evidence, next_step)
    values (
      v.id,
      v_key,
      v_ai,
      case when v_key = 'speed' then jsonb_build_array(format('First reply was %s seconds after the lead wrote.', coalesce(v_seconds, 0)))
           else coalesce((select item -> 'evidence' from jsonb_array_elements(p_payload -> 'criteria') item where item ->> 'key' = v_key), '[]'::jsonb) end,
      case when v_ai < 4 and v_key <> 'speed' then (
        select item ->> 'next' from jsonb_array_elements(p_payload -> 'criteria') item where item ->> 'key' = v_key
      ) else null end
    )
    on conflict (session_id, criterion_key) do update
      set ai_score = excluded.ai_score, evidence = excluded.evidence, next_step = excluded.next_step;
  end loop;

  for v_c in
    select c.criterion_key, c.weight, c.critical, c.minimum_score, c.name,
           coalesce(g.human_score, g.ai_score) as score
    from public.academy_grade g
    join public.academy_rubric_criterion c on c.rubric_id = v.rubric_id and c.criterion_key = g.criterion_key
    where g.session_id = v.id
  loop
    v_final := v_c.score;
    v_weight := v_c.weight;
    v_sum := v_sum + (v_final::numeric / 5) * v_weight;
    v_weights := v_weights + v_weight;
    if v_final < v_low then
      v_low := v_final;
    end if;
    if v_c.critical and v_final < v_c.minimum_score then
      v_critical_fail := coalesce(v_critical_fail, format('%s is %s. The minimum is %s.', v_c.name, v_final, v_c.minimum_score));
    end if;
    if v_final <= 2 then
      select coalesce(v_lessons, '{}') || coalesce(array_agg(sl.lesson_id), '{}') into v_lessons
      from public.academy_sim_lesson sl
      where sl.simulation_id = v.simulation_id and sl.criterion_key = v_c.criterion_key;
    end if;
  end loop;

  v_total := case when v_weights = 0 then 0 else round(100 * v_sum / v_weights, 1) end;
  v_pass_score := coalesce(v_sim.pass_score, case when v_sim.capstone then v_settings.capstone_pass_score else v_settings.sim_pass_score end);
  if v_sim.capstone then
    if exists (
      select 1 from public.academy_grade g
      where g.session_id = v.id and g.criterion_key = 'compliance'
        and coalesce(g.human_score, g.ai_score) < v_settings.capstone_compliance_min
    ) then
      v_critical_fail := coalesce(v_critical_fail, format('Compliance is below %s.', v_settings.capstone_compliance_min));
    end if;
  end if;
  v_passed := v_total >= v_pass_score and v_critical_fail is null;
  update public.academy_sim_session set
    status = 'graded',
    total_score = v_total,
    passed = v_passed,
    fail_reason = case when v_passed then null else coalesce(v_critical_fail, format('The score is %s. The pass score is %s.', v_total, v_pass_score)) end,
    summary = p_payload ->> 'summary',
    violations = coalesce(p_payload -> 'violations', '[]'::jsonb),
    finished_at = coalesce(finished_at, now()),
    lockout_until = case when v_passed then null else now() + make_interval(mins => v_settings.sim_lockout_minutes) end,
    reopen_lesson_ids = case when v_passed then '{}' else coalesce(v_lessons, '{}') end
  where id = v.id;

  if v_passed and v.enrollment_id is not null then
    perform app.academy_mark_part(v.enrollment_id, v_sim.gate_part_id);
  elsif v.enrollment_id is not null then
    select count(*) into v_used from public.academy_sim_session
    where enrollment_id = v.enrollment_id and simulation_id = v.simulation_id and preview = false and status in ('graded', 'needs_manual', 'abandoned', 'submitted');
    if v_used >= v_settings.sim_max_attempts then
      perform app.academy_practice_hold(
        v.enrollment_id, 'Failed the last simulation attempt', v_used,
        coalesce(v_critical_fail, format('The score is %s. The pass score is %s.', v_total, v_pass_score)),
        v.simulation_id, null, null, null
      );
    end if;
  end if;
  perform app.audit('academy.grade_applied', 'academy_sim_session', v.id::text, 'Simulation graded.', null,
    jsonb_build_object('total', v_total, 'passed', v_passed));
end;
$$;

create or replace function public.academy_grade_apply(p_session uuid, p_payload jsonb, p_tokens_in integer, p_tokens_out integer, p_kind text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_in_rate numeric;
  v_out_rate numeric;
begin
  perform app.academy_service_only();
  if jsonb_typeof(p_payload -> 'criteria') is distinct from 'array' or p_payload ->> 'summary' is null then
    raise exception 'grade_invalid: the grader response is not usable' using errcode = '22023';
  end if;
  select ai_input_usd_per_million, ai_output_usd_per_million into v_in_rate, v_out_rate from public.academy_setting where id = 1;
  insert into public.academy_ai_call (session_id, kind, tokens_in, tokens_out, cost_usd, ok)
  values (
    p_session, coalesce(p_kind, 'grade'), coalesce(p_tokens_in, 0), coalesce(p_tokens_out, 0),
    round((coalesce(p_tokens_in, 0) * v_in_rate + coalesce(p_tokens_out, 0) * v_out_rate) / 1000000.0, 6),
    true
  );
  perform app.academy_apply_scores(p_session, p_payload);
end;
$$;

create or replace function public.academy_grade_override(p_session uuid, p_key text, p_score integer, p_note text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v public.academy_sim_session;
  v_enrollment public.academy_enrollment;
begin
  select * into v from public.academy_sim_session where id = p_session;
  if v.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select * into v_enrollment from public.academy_enrollment where id = v.enrollment_id;
  if not app.academy_manages() and not (
    app.academy_reviews() and v_enrollment.manager_id = app.acting_profile()
  ) then
    raise exception 'permission_denied: this review is not yours' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_note, ''))) = 0 or p_score < 0 or p_score > 5 then
    raise exception 'note_required: write why the score changed' using errcode = '22023';
  end if;
  update public.academy_grade set human_score = p_score, human_note = btrim(p_note) where session_id = v.id and criterion_key = p_key;
  perform app.academy_apply_scores(v.id, jsonb_build_object('summary', coalesce(v.summary, ''), 'criteria', '[]'::jsonb, 'violations', v.violations));
  perform app.audit('academy.grade_override', 'academy_sim_session', v.id::text, 'A criterion score was changed.', null,
    jsonb_build_object('criterion', p_key, 'score', p_score, 'note', btrim(p_note)));
end;
$$;

-- ---------------------------------------------------------------------------
-- Signal Reading drill. Same unseen-first draw as the quiz engine.
-- ---------------------------------------------------------------------------

create or replace function app.academy_drill_draw(p_module uuid, p_count integer, p_seen uuid[])
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
    from public.academy_drill_item
    where module_id = p_module and active
  ),
  unseen as (
    select id from pool where not seen order by random() limit p_count
  ),
  filler as (
    select id from pool where seen order by random()
    limit greatest(p_count - (select count(*) from unseen), 0)
  ),
  chosen as (
    select id from unseen
    union all
    select id from filler
  )
  select coalesce(array_agg(id order by random()), '{}') into v_ids from chosen;
  return v_ids;
end;
$$;

create or replace function public.academy_drill_start(p_module uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_enrollment public.academy_enrollment := app.academy_primary_for_actor();
  v_settings public.academy_setting;
  v_seen uuid[];
  v_ids uuid[];
  v_used integer;
  v_last public.academy_drill_attempt;
  v_id uuid;
  v_number integer;
begin
  if v_enrollment.id is null or not app.academy_content_open(v_enrollment.id) then
    raise exception 'drill_closed: this drill is not open' using errcode = '42501';
  end if;
  select * into v_settings from public.academy_setting where id = 1;
  if exists (
    select 1 from public.academy_gate_part gp
    where gp.module_id = p_module and gp.part_key = 'quiz'
      and not app.academy_gate_part_satisfied(v_enrollment.id, gp)
  ) then
    raise exception 'quiz_first: pass the module quiz first' using errcode = '42501';
  end if;
  if exists (select 1 from public.academy_drill_attempt where enrollment_id = v_enrollment.id and finished_at is null) then
    raise exception 'attempt_open: finish the drill you already started' using errcode = '42501';
  end if;
  select count(*) into v_used from public.academy_drill_attempt where enrollment_id = v_enrollment.id and module_id = p_module;
  if v_used >= v_settings.drill_max_attempts then
    raise exception 'attempts_used: this drill is on hold' using errcode = '42501';
  end if;
  select * into v_last from public.academy_drill_attempt
  where enrollment_id = v_enrollment.id and module_id = p_module and finished_at is not null and passed is not true
  order by finished_at desc limit 1;
  if v_last.lockout_until > now() then
    raise exception 'drill_locked: the next attempt is not open yet' using errcode = '42501';
  end if;
  select coalesce(array_agg(distinct item), '{}') into v_seen
  from public.academy_drill_attempt a, lateral unnest(a.item_ids) item
  where a.enrollment_id = v_enrollment.id and a.module_id = p_module;
  v_ids := app.academy_drill_draw(p_module, v_settings.drill_questions, v_seen);
  if coalesce(array_length(v_ids, 1), 0) <> v_settings.drill_questions then
    raise exception 'pool_short: the drill pool is short' using errcode = '23514';
  end if;
  v_number := v_used + 1;
  insert into public.academy_drill_attempt (enrollment_id, module_id, attempt_number, item_ids)
  values (v_enrollment.id, p_module, v_number, v_ids)
  returning id into v_id;
  insert into public.academy_drill_key (attempt_id, items)
  select v_id, coalesce(jsonb_agg(jsonb_build_object(
    'id', i.id, 'situation', i.situation, 'source', i.source, 'reply_speed', i.reply_speed,
    'earlier_touches', i.earlier_touches, 'readiness', i.readiness, 'moves', app.academy_permute(i.moves),
    'correct_move', i.correct_move, 'explanation', i.explanation, 'concept', coalesce(c.name, i.concept_tag, ''),
    'lesson_id', i.lesson_id
  )), '[]'::jsonb)
  from unnest(v_ids) with ordinality as drawn(id, ord)
  join public.academy_drill_item i on i.id = drawn.id
  left join public.academy_concept c on c.id = i.concept_id;
  perform app.audit('academy.drill_started', 'academy_drill_attempt', v_id::text, 'Signal Reading drill started.', null, null);
  return public.academy_drill_state(p_module);
end;
$$;

create or replace function public.academy_drill_answer(p_attempt uuid, p_item uuid, p_readiness text, p_move text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v public.academy_drill_attempt;
  v_enrollment public.academy_enrollment := app.academy_primary_for_actor();
begin
  select * into v from public.academy_drill_attempt
  where id = p_attempt and enrollment_id = v_enrollment.id and finished_at is null;
  if v.id is null or not (p_item = any(v.item_ids)) then
    raise exception 'attempt_closed' using errcode = '42501';
  end if;
  if p_readiness not in ('not_ready', 'ready', 'not_a_fit') then
    raise exception 'bad_answer' using errcode = '22023';
  end if;
  update public.academy_drill_attempt
  set answers = (
    select coalesce(jsonb_agg(item), '[]'::jsonb) from jsonb_array_elements(coalesce(answers, '[]'::jsonb)) item
    where item ->> 'item_id' is distinct from p_item::text
  ) || jsonb_build_array(jsonb_build_object('item_id', p_item, 'readiness', p_readiness, 'move', p_move))
  where id = v.id;
end;
$$;

create or replace function public.academy_drill_submit(p_attempt uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v public.academy_drill_attempt;
  v_enrollment public.academy_enrollment := app.academy_primary_for_actor();
  v_settings public.academy_setting;
  v_correct integer := 0;
  v_total integer := 0;
  v_item jsonb;
  v_ready text;
  v_move text;
  v_passed boolean;
  v_used integer;
  v_summary text;
  v_part uuid;
begin
  select * into v from public.academy_drill_attempt where id = p_attempt and enrollment_id = v_enrollment.id and finished_at is null for update;
  if v.id is null then
    raise exception 'attempt_closed' using errcode = '42501';
  end if;
  select * into v_settings from public.academy_setting where id = 1;
  for v_item in
    select value from public.academy_drill_key k, lateral jsonb_array_elements(k.items) value where k.attempt_id = v.id
  loop
    v_total := v_total + 1;
    select ans ->> 'readiness', ans ->> 'move' into v_ready, v_move
    from jsonb_array_elements(coalesce(v.answers, '[]'::jsonb)) ans
    where ans ->> 'item_id' = v_item ->> 'id' limit 1;
    if v_ready = v_item ->> 'readiness' and v_move = v_item ->> 'correct_move' then
      v_correct := v_correct + 1;
    end if;
  end loop;
  v_passed := v_correct >= v_settings.drill_pass_mark;
  update public.academy_drill_attempt set
    finished_at = now(), score = v_correct, passed = v_passed,
    lockout_until = case when v_passed then null else now() + make_interval(mins => v_settings.drill_lockout_minutes) end
  where id = v.id;
  if v_passed then
    select id into v_part from public.academy_gate_part where module_id = v.module_id and part_key = 'simulation' limit 1;
    perform app.academy_mark_part(v.enrollment_id, v_part);
  else
    select count(*) into v_used from public.academy_drill_attempt where enrollment_id = v.enrollment_id and module_id = v.module_id and finished_at is not null;
    if v_used >= v_settings.drill_max_attempts then
      select string_agg(distinct item ->> 'concept', ', ') into v_summary
      from public.academy_drill_key k, lateral jsonb_array_elements(k.items) item
      where k.attempt_id = v.id;
      perform app.academy_practice_hold(v.enrollment_id, 'Failed the last Signal Reading attempt', v_used, v_summary, null, v.module_id, null, null);
    end if;
  end if;
  perform app.audit('academy.drill_submitted', 'academy_drill_attempt', v.id::text, 'Signal Reading drill scored.', null,
    jsonb_build_object('score', v_correct, 'passed', v_passed));
  return public.academy_drill_state(v.module_id);
end;
$$;

create or replace function public.academy_drill_state(p_module uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_enrollment public.academy_enrollment := app.academy_primary_for_actor();
  v_open public.academy_drill_attempt;
  v_last public.academy_drill_attempt;
  v_settings public.academy_setting;
  v_used integer;
  v_reveal boolean := false;
begin
  if v_enrollment.id is null then
    return jsonb_build_object('phase', 'unavailable');
  end if;
  select * into v_settings from public.academy_setting where id = 1;
  select count(*) into v_used from public.academy_drill_attempt where enrollment_id = v_enrollment.id and module_id = p_module and finished_at is not null;
  select * into v_open from public.academy_drill_attempt where enrollment_id = v_enrollment.id and module_id = p_module and finished_at is null;
  select * into v_last from public.academy_drill_attempt where enrollment_id = v_enrollment.id and module_id = p_module and finished_at is not null order by finished_at desc limit 1;
  v_reveal := v_last.passed is true;
  return jsonb_build_object(
    'attempts_used', v_used,
    'attempts_allowed', v_settings.drill_max_attempts,
    'pass_mark', v_settings.drill_pass_mark,
    'question_count', v_settings.drill_questions,
    'lockout_until', v_last.lockout_until,
    'locked', v_last.lockout_until > now(),
    'attempt_id', v_open.id,
    'phase', case
      when v_enrollment.status = 'on_hold_review' then 'held'
      when v_open.id is not null then 'take'
      when v_last.passed is true then 'pass'
      when v_last.id is not null then 'fail'
      else 'start'
    end,
    'score', v_last.score,
    'items', case when v_open.id is null then '[]'::jsonb else (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', item ->> 'id',
        'situation', item ->> 'situation',
        'source', item ->> 'source',
        'reply_speed', item ->> 'reply_speed',
        'earlier_touches', item ->> 'earlier_touches',
        'moves', item -> 'moves'
      )), '[]'::jsonb)
      from public.academy_drill_key k, lateral jsonb_array_elements(k.items) item
      where k.attempt_id = v_open.id
    ) end,
    'review', case when v_reveal then (
      select coalesce(jsonb_agg(item), '[]'::jsonb)
      from public.academy_drill_key k, lateral jsonb_array_elements(k.items) item
      where k.attempt_id = v_last.id
    ) else '[]'::jsonb end,
    'missed', case when v_last.id is not null and v_reveal is false then (
      select coalesce(jsonb_agg(jsonb_build_object('concept', item ->> 'concept', 'lesson_id', item ->> 'lesson_id')), '[]'::jsonb)
      from public.academy_drill_key k, lateral jsonb_array_elements(k.items) item
      where k.attempt_id = v_last.id
        and not exists (
          select 1 from jsonb_array_elements(coalesce(v_last.answers, '[]'::jsonb)) ans
          where ans ->> 'item_id' = item ->> 'id'
            and ans ->> 'readiness' = item ->> 'readiness'
            and ans ->> 'move' = item ->> 'correct_move'
        )
    ) else '[]'::jsonb end
  );
end;
$$;

create or replace function public.academy_drill_import(p_items jsonb)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row jsonb;
  v_count integer := 0;
  v_module uuid;
  v_concept uuid;
  v_lesson uuid;
begin
  if not app.academy_manages() then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  for v_row in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    select m.id into v_module from public.academy_module m
    join public.academy_program p on p.id = m.program_id
    where p.slug = 'da-operator-academy' and m.order_number = (v_row ->> 'module')::integer;
    v_concept := null;
    v_lesson := null;
    select c.id, c.lesson_id into v_concept, v_lesson
    from public.academy_concept c
    where c.module_id = v_module and lower(c.name) = lower(btrim(coalesce(v_row ->> 'concept', '')));
    insert into public.academy_drill_item (
      module_id, situation, source, reply_speed, earlier_touches, readiness, moves, correct_move,
      concept_id, concept_tag, lesson_id, difficulty, explanation, active
    ) values (
      v_module, v_row ->> 'situation', coalesce(v_row ->> 'source', ''), coalesce(v_row ->> 'reply_speed', ''),
      coalesce(v_row ->> 'earlier_touches', ''), v_row ->> 'readiness', coalesce(v_row -> 'moves', '[]'::jsonb),
      v_row ->> 'correct_move', v_concept, nullif(v_row ->> 'concept', ''), v_lesson,
      coalesce(v_row ->> 'difficulty', 'standard'), coalesce(v_row ->> 'explanation', ''), true
    );
    v_count := v_count + 1;
  end loop;
  perform app.audit('academy.drill_imported', 'academy_drill_item', v_count::text, 'Signal Reading items imported.', null, jsonb_build_object('count', v_count));
  return v_count;
end;
$$;

create or replace function public.academy_reflection_save(p_payload jsonb)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_payload ->> 'id', '')::uuid;
begin
  if not app.academy_manages() then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if v_id is null then
    insert into public.academy_reflection (module_id, gate_part_id, prompt, min_words, rubric_id, pass_total, criterion_min, status)
    values (
      (p_payload ->> 'module_id')::uuid, nullif(p_payload ->> 'gate_part_id', '')::uuid, coalesce(p_payload ->> 'prompt', ''),
      coalesce((p_payload ->> 'min_words')::integer, 150), nullif(p_payload ->> 'rubric_id', '')::uuid,
      coalesce((p_payload ->> 'pass_total')::integer, 10), coalesce((p_payload ->> 'criterion_min')::integer, 2),
      coalesce(p_payload ->> 'status', 'draft')
    ) returning id into v_id;
  else
    update public.academy_reflection set
      prompt = coalesce(p_payload ->> 'prompt', prompt),
      min_words = coalesce((p_payload ->> 'min_words')::integer, min_words),
      rubric_id = coalesce(nullif(p_payload ->> 'rubric_id', '')::uuid, rubric_id),
      pass_total = coalesce((p_payload ->> 'pass_total')::integer, pass_total),
      criterion_min = coalesce((p_payload ->> 'criterion_min')::integer, criterion_min),
      status = coalesce(p_payload ->> 'status', status)
    where id = v_id;
  end if;
  perform app.audit('academy.reflection_saved', 'academy_reflection', v_id::text, 'Reflection prompt saved.', null, p_payload);
  return v_id;
end;
$$;

create or replace function public.academy_reflection_submit(p_reflection uuid, p_body text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v public.academy_reflection;
  v_enrollment public.academy_enrollment := app.academy_primary_for_actor();
  v_words integer;
  v_used integer;
  v_id uuid;
  v_settings public.academy_setting;
begin
  select * into v from public.academy_reflection where id = p_reflection and status = 'live';
  select * into v_settings from public.academy_setting where id = 1;
  if v.id is null or v_enrollment.id is null then
    raise exception 'reflection_closed' using errcode = '42501';
  end if;
  v_words := coalesce(array_length(regexp_split_to_array(btrim(coalesce(p_body, '')), '\s+'), 1), 0);
  if v_words < v.min_words then
    raise exception 'too_short: the reflection is under the minimum word count' using errcode = '22023';
  end if;
  select count(*) into v_used from public.academy_reflection_attempt where enrollment_id = v_enrollment.id and reflection_id = v.id;
  if v_used >= v_settings.reflection_max_attempts then
    raise exception 'attempts_used: this reflection is on hold' using errcode = '42501';
  end if;
  insert into public.academy_reflection_attempt (reflection_id, enrollment_id, attempt_number, body)
  values (v.id, v_enrollment.id, v_used + 1, btrim(p_body))
  returning id into v_id;
  perform app.audit('academy.reflection_submitted', 'academy_reflection_attempt', v_id::text, 'Reflection submitted.', null, null);
  return v_id;
end;
$$;

create or replace function public.academy_reflection_grade(p_attempt uuid, p_payload jsonb, p_tokens_in integer, p_tokens_out integer)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v public.academy_reflection_attempt;
  v_ref public.academy_reflection;
  v_row record;
  v_ai integer;
  v_sum integer := 0;
  v_fail text;
  v_passed boolean;
  v_used integer;
  v_settings public.academy_setting;
  v_in_rate numeric;
  v_out_rate numeric;
begin
  perform app.academy_service_only();
  select * into v from public.academy_reflection_attempt where id = p_attempt;
  select * into v_ref from public.academy_reflection where id = v.reflection_id;
  select * into v_settings from public.academy_setting where id = 1;
  if jsonb_typeof(p_payload -> 'criteria') is distinct from 'array' then
    raise exception 'grade_invalid: the grader response is not usable' using errcode = '22023';
  end if;
  for v_row in select * from public.academy_rubric_criterion where rubric_id = v_ref.rubric_id
  loop
    select (item ->> 'score')::integer into v_ai from jsonb_array_elements(p_payload -> 'criteria') item where item ->> 'key' = v_row.criterion_key;
    if v_ai is null then
      raise exception 'grade_invalid: a criterion score is missing' using errcode = '22023';
    end if;
    insert into public.academy_grade (reflection_attempt_id, criterion_key, ai_score, evidence, next_step)
    values (v.id, v_row.criterion_key, v_ai, coalesce((select item -> 'evidence' from jsonb_array_elements(p_payload -> 'criteria') item where item ->> 'key' = v_row.criterion_key), '[]'::jsonb),
      case when v_ai < 4 then (select item ->> 'next' from jsonb_array_elements(p_payload -> 'criteria') item where item ->> 'key' = v_row.criterion_key) else null end);
    v_sum := v_sum + v_ai;
    if v_ai < v_ref.criterion_min then
      v_fail := coalesce(v_fail, format('%s is %s. The minimum is %s.', v_row.name, v_ai, v_ref.criterion_min));
    end if;
  end loop;
  v_passed := v_sum >= v_ref.pass_total and v_fail is null;
  update public.academy_reflection_attempt set status = 'graded', total_score = v_sum, passed = v_passed,
    fail_reason = case when v_passed then null else coalesce(v_fail, format('The score is %s. The pass score is %s.', v_sum, v_ref.pass_total)) end,
    summary = p_payload ->> 'summary'
  where id = v.id;
  if v_passed then
    perform app.academy_mark_part(v.enrollment_id, v_ref.gate_part_id);
  else
    select count(*) into v_used from public.academy_reflection_attempt where enrollment_id = v.enrollment_id and reflection_id = v_ref.id and status = 'graded';
    if v_used >= v_settings.reflection_max_attempts then
      perform app.academy_practice_hold(v.enrollment_id, 'Failed the last reflection attempt', v_used, v_fail, null, null, v_ref.id, null);
    end if;
  end if;
  select ai_input_usd_per_million, ai_output_usd_per_million into v_in_rate, v_out_rate from public.academy_setting where id = 1;
  insert into public.academy_ai_call (reflection_attempt_id, kind, tokens_in, tokens_out, cost_usd, ok)
  values (v.id, 'reflection', coalesce(p_tokens_in, 0), coalesce(p_tokens_out, 0),
    round((coalesce(p_tokens_in, 0) * v_in_rate + coalesce(p_tokens_out, 0) * v_out_rate) / 1000000.0, 6), true);
  perform app.audit('academy.reflection_graded', 'academy_reflection_attempt', v.id::text, 'Reflection graded.', null, jsonb_build_object('total', v_sum, 'passed', v_passed));
end;
$$;

create or replace function public.academy_practical_save(p_payload jsonb)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_payload ->> 'id', '')::uuid;
  v_item jsonb;
begin
  if not app.academy_manages() then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if v_id is null then
    insert into public.academy_practical (module_id, gate_part_id, title, instructions, status)
    values ((p_payload ->> 'module_id')::uuid, nullif(p_payload ->> 'gate_part_id', '')::uuid, p_payload ->> 'title', coalesce(p_payload ->> 'instructions', ''), coalesce(p_payload ->> 'status', 'draft'))
    returning id into v_id;
  else
    update public.academy_practical set title = coalesce(p_payload ->> 'title', title), instructions = coalesce(p_payload ->> 'instructions', instructions), status = coalesce(p_payload ->> 'status', status) where id = v_id;
    if not exists (select 1 from public.academy_practical_submission where practical_id = v_id) then
      delete from public.academy_practical_item where practical_id = v_id;
    end if;
  end if;
  if v_id is not null and not exists (select 1 from public.academy_practical_submission where practical_id = v_id) then
    for v_item in select value from jsonb_array_elements(coalesce(p_payload -> 'items', '[]'::jsonb))
    loop
      insert into public.academy_practical_item (practical_id, label, required, sort_order)
      values (v_id, v_item ->> 'label', coalesce((v_item ->> 'required')::boolean, true), coalesce((v_item ->> 'sort_order')::integer, 1));
    end loop;
  end if;
  perform app.audit('academy.practical_saved', 'academy_practical', v_id::text, 'Practical saved.', null, p_payload);
  return v_id;
end;
$$;

create or replace function public.academy_practical_submit(p_practical uuid, p_items jsonb)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v public.academy_practical;
  v_enrollment public.academy_enrollment := app.academy_primary_for_actor();
  v_used integer;
  v_id uuid;
  v_item jsonb;
  v_settings public.academy_setting;
  v_prev public.academy_practical_submission;
  v_required integer;
  v_given integer;
begin
  select * into v from public.academy_practical where id = p_practical and status = 'live';
  select * into v_settings from public.academy_setting where id = 1;
  if v.id is null or v_enrollment.id is null then
    raise exception 'practical_closed' using errcode = '42501';
  end if;
  select * into v_prev from public.academy_practical_submission
  where enrollment_id = v_enrollment.id and practical_id = v.id
  order by submission_number desc limit 1;
  if v_prev.status = 'pending' then
    raise exception 'review_open: the last submission is still in review' using errcode = '42501';
  end if;
  if v_prev.status = 'passed' then
    raise exception 'already_passed: this practical is already complete' using errcode = '42501';
  end if;
  select count(*) into v_used from public.academy_practical_submission where enrollment_id = v_enrollment.id and practical_id = v.id;
  if v_used >= v_settings.practical_max_submissions then
    raise exception 'attempts_used: this practical is on hold' using errcode = '42501';
  end if;
  if v_prev.id is null then
    select count(*) into v_required from public.academy_practical_item where practical_id = v.id and required;
    select count(distinct (item ->> 'item_id')) into v_given
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) item
    where (item ->> 'item_id')::uuid in (
      select id from public.academy_practical_item where practical_id = v.id and required
    );
    if v_given < v_required then
      raise exception 'items_missing: every required item needs evidence' using errcode = '22023';
    end if;
  elsif exists (
    select 1 from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) item
    where not exists (
      select 1 from public.academy_practical_evidence e
      where e.submission_id = v_prev.id and e.item_id = (item ->> 'item_id')::uuid and e.status = 'needs_work'
    )
  ) then
    raise exception 'item_closed: resubmit only the items that need work' using errcode = '22023';
  elsif v_prev.id is not null and exists (
    select 1 from public.academy_practical_evidence e
    join public.academy_practical_item i on i.id = e.item_id
    where e.submission_id = v_prev.id and e.status = 'needs_work' and i.required
      and not exists (
        select 1 from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) item
        where (item ->> 'item_id')::uuid = e.item_id
      )
  ) then
    raise exception 'items_missing: resubmit every item that needs work' using errcode = '22023';
  end if;
  insert into public.academy_practical_submission (practical_id, enrollment_id, submission_number)
  values (v.id, v_enrollment.id, v_used + 1) returning id into v_id;
  if v_prev.id is not null then
    insert into public.academy_practical_evidence (submission_id, item_id, kind, body, storage_path, status, comment, reviewed_by, reviewed_at)
    select v_id, e.item_id, e.kind, e.body, e.storage_path, 'pass', e.comment, e.reviewed_by, e.reviewed_at
    from public.academy_practical_evidence e
    where e.submission_id = v_prev.id and e.status = 'pass';
  end if;
  for v_item in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    if coalesce(v_item ->> 'kind', '') not in ('text', 'link', 'file') then
      raise exception 'bad_evidence: use text, a link, or a screenshot' using errcode = '22023';
    end if;
    if v_item ->> 'kind' = 'file' and nullif(v_item ->> 'storage_path', '') is null then
      raise exception 'file_missing: add the screenshot' using errcode = '22023';
    end if;
    if v_item ->> 'kind' in ('text', 'link') and nullif(btrim(coalesce(v_item ->> 'body', '')), '') is null then
      raise exception 'evidence_missing: add the text or the link' using errcode = '22023';
    end if;
    if coalesce(v_item ->> 'storage_path', '') like 'http%' then
      raise exception 'public_url: screenshots stay in private storage' using errcode = '22023';
    end if;
    insert into public.academy_practical_evidence (submission_id, item_id, kind, body, storage_path)
    values (v_id, (v_item ->> 'item_id')::uuid, v_item ->> 'kind', nullif(v_item ->> 'body', ''), nullif(v_item ->> 'storage_path', ''))
    on conflict (submission_id, item_id) do nothing;
  end loop;
  perform app.audit('academy.practical_submitted', 'academy_practical_submission', v_id::text, 'Practical submitted.', null, null);
  return v_id;
end;
$$;

create or replace function public.academy_practical_review(p_evidence uuid, p_status text, p_comment text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v public.academy_practical_evidence;
  v_sub public.academy_practical_submission;
  v_enrollment public.academy_enrollment;
  v_practical public.academy_practical;
  v_open integer;
begin
  select * into v from public.academy_practical_evidence where id = p_evidence;
  select * into v_sub from public.academy_practical_submission where id = v.submission_id;
  select * into v_enrollment from public.academy_enrollment where id = v_sub.enrollment_id;
  select * into v_practical from public.academy_practical where id = v_sub.practical_id;
  if not app.academy_manages() and not (app.academy_reviews() and v_enrollment.manager_id = app.acting_profile()) then
    raise exception 'permission_denied: this submission is not yours to review' using errcode = '42501';
  end if;
  if p_status not in ('pass', 'needs_work') then
    raise exception 'bad_status' using errcode = '22023';
  end if;
  if p_status = 'needs_work' and length(btrim(coalesce(p_comment, ''))) = 0 then
    raise exception 'comment_required: say what still needs work' using errcode = '22023';
  end if;
  update public.academy_practical_evidence set status = p_status, comment = nullif(btrim(coalesce(p_comment, '')), ''), reviewed_by = app.acting_profile(), reviewed_at = now() where id = v.id;
  select count(*) into v_open from public.academy_practical_item i
  where i.practical_id = v_practical.id and i.required
    and not exists (
      select 1 from public.academy_practical_evidence e
      where e.submission_id = v_sub.id and e.item_id = i.id and e.status = 'pass'
    );
  update public.academy_practical_submission set status = case when v_open = 0 then 'passed' else 'needs_work' end where id = v_sub.id;
  if v_open = 0 then
    perform app.academy_mark_part(v_sub.enrollment_id, v_practical.gate_part_id);
  else
    if (select count(*) from public.academy_practical_submission where enrollment_id = v_sub.enrollment_id and practical_id = v_practical.id) >= (select practical_max_submissions from public.academy_setting where id = 1)
       and not exists (select 1 from public.academy_practical_submission where id = v_sub.id and status = 'passed') then
      perform app.academy_practice_hold(v_sub.enrollment_id, 'Failed the last practical submission', (select count(*) from public.academy_practical_submission where enrollment_id = v_sub.enrollment_id and practical_id = v_practical.id), 'Required items still need work.', null, null, null, v_practical.id);
    end if;
  end if;
  perform app.audit('academy.practical_reviewed', 'academy_practical_evidence', v.id::text, 'Practical item reviewed.', null,
    jsonb_build_object('status', p_status, 'comment', p_comment));
end;
$$;

create or replace function public.academy_sim_state(p_simulation uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_enrollment public.academy_enrollment := app.academy_primary_for_actor();
  v_sim public.academy_simulation;
  v_session public.academy_sim_session;
  v_settings public.academy_setting;
  v_used integer;
begin
  select * into v_sim from public.academy_simulation where id = p_simulation and status = 'live';
  select * into v_settings from public.academy_setting where id = 1;
  if v_sim.id is null or v_enrollment.id is null then
    return jsonb_build_object('phase', 'unavailable');
  end if;
  select count(*) into v_used from public.academy_sim_session where enrollment_id = v_enrollment.id and simulation_id = v_sim.id and preview = false and status <> 'open';
  select * into v_session from public.academy_sim_session
  where enrollment_id = v_enrollment.id and simulation_id = v_sim.id and preview = false
  order by started_at desc limit 1;
  return jsonb_build_object(
    'title', v_sim.title,
    'brief', v_sim.brief,
    'max_turns', v_sim.max_turns,
    'time_limit_seconds', v_sim.time_limit_seconds,
    'pass_score', coalesce(v_sim.pass_score, case when v_sim.capstone then v_settings.capstone_pass_score else v_settings.sim_pass_score end),
    'attempts_used', v_used,
    'attempts_allowed', v_settings.sim_max_attempts,
    'lockout_until', v_session.lockout_until,
    'locked', v_session.lockout_until > now(),
    'daily_limit', v_settings.sim_daily_limit,
    'sessions_today', (
      select count(*) from public.academy_sim_session s
      where s.enrollment_id = v_enrollment.id and s.preview = false and s.started_at::date = current_date
    ),
    'reopen_lessons', coalesce((
      select jsonb_agg(jsonb_build_object('id', l.id, 'title', l.title, 'module_id', l.module_id))
      from unnest(coalesce(v_session.reopen_lesson_ids, '{}')) lid
      join public.academy_lesson l on l.id = lid
    ), '[]'::jsonb),
    'session', case when v_session.id is null then null else jsonb_build_object(
      'id', v_session.id,
      'status', v_session.status,
      'lead_first_at', v_session.lead_first_at,
      'turns', (select count(*) from public.academy_sim_message m where m.session_id = v_session.id and m.role = 'operator'),
      'messages', coalesce((
        select jsonb_agg(jsonb_build_object('role', m.role, 'body', m.body, 'at', m.created_at) order by m.created_at)
        from public.academy_sim_message m where m.session_id = v_session.id
      ), '[]'::jsonb),
      'score', v_session.total_score,
      'passed', v_session.passed,
      'fail_reason', v_session.fail_reason,
      'summary', v_session.summary,
      'violations', v_session.violations,
      'criteria', coalesce((
        select jsonb_agg(jsonb_build_object(
          'key', g.criterion_key, 'name', c.name, 'score', coalesce(g.human_score, g.ai_score),
          'evidence', g.evidence, 'next', g.next_step
        ) order by c.sort_order)
        from public.academy_grade g
        join public.academy_rubric_criterion c on c.rubric_id = v_session.rubric_id and c.criterion_key = g.criterion_key
        where g.session_id = v_session.id
      ), '[]'::jsonb),
      'persona', case when v_session.passed is true then v_sim.persona else null end
    ) end
  );
end;
$$;

create or replace function public.academy_calibration_save(p_session uuid, p_scores jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row jsonb;
begin
  if not app.academy_manages() then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  for v_row in select value from jsonb_array_elements(coalesce(p_scores, '[]'::jsonb))
  loop
    insert into public.academy_calibration (session_id, criterion_key, human_score, note, created_by)
    values (p_session, v_row ->> 'key', (v_row ->> 'score')::integer, v_row ->> 'note', app.acting_profile())
    on conflict (session_id, criterion_key) do update set human_score = excluded.human_score, note = excluded.note;
  end loop;
  perform app.audit('academy.calibration_saved', 'academy_sim_session', p_session::text, 'Calibration scores saved.', null, p_scores);
end;
$$;

create or replace function public.academy_calibration_report()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app.academy_manages() then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'key', criterion_key,
      'average_gap', round(avg(human_score - coalesce(g.human_score, g.ai_score))::numeric, 2),
      'samples', count(*)
    ) order by abs(avg(human_score - coalesce(g.human_score, g.ai_score))) desc)
    from public.academy_calibration c
    join public.academy_grade g on g.session_id = c.session_id and g.criterion_key = c.criterion_key
    group by criterion_key
  ), '[]'::jsonb);
end;
$$;

create or replace function public.academy_hold_practice(p_hold uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.academy_hold := app.academy_hold_load(p_hold);
begin
  return jsonb_build_object(
    'simulation_id', v.simulation_id,
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'score', s.total_score, 'passed', s.passed, 'fail_reason', s.fail_reason,
        'transcript', coalesce((select jsonb_agg(jsonb_build_object('role', m.role, 'body', m.body, 'at', m.created_at) order by m.created_at) from public.academy_sim_message m where m.session_id = s.id), '[]'::jsonb),
        'criteria', coalesce((select jsonb_agg(jsonb_build_object('key', g.criterion_key, 'ai', g.ai_score, 'human', g.human_score)) from public.academy_grade g where g.session_id = s.id), '[]'::jsonb),
        'flags', coalesce((select jsonb_agg(f.body) from public.academy_sim_flag f where f.session_id = s.id), '[]'::jsonb)
      ) order by s.started_at)
      from public.academy_sim_session s where s.simulation_id = v.simulation_id and s.enrollment_id = v.enrollment_id and s.preview = false
    ), '[]'::jsonb)
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
  v_card jsonb;
  v_part public.academy_gate_part;
  v_sim public.academy_simulation;
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
      select * into v_part from public.academy_gate_part gp
      where gp.module_id = v_mod.id and not app.academy_gate_part_satisfied(p_enrollment_id, gp) and gp.part_key <> 'quiz'
      order by gp.sort_order limit 1;
      select * into v_sim from public.academy_simulation
      where gate_part_id = v_part.id and status = 'live' order by sort_order limit 1;
      if v_sim.id is not null then
        return jsonb_build_object('title', format('Module %s: %s available', v_mod.order_number, v_sim.title), 'detail', v_mod.title, 'href', '/academy/modules/' || v_mod.id || '/simulations/' || v_sim.id);
      elsif v_part.part_key = 'simulation' and v_mod.order_number = 6 then
        return jsonb_build_object('title', format('Module %s: Signal Reading available', v_mod.order_number), 'detail', v_mod.title, 'href', '/academy/modules/' || v_mod.id || '/drill');
      elsif v_part.part_key = 'practical' and v_mod.order_number = 2 then
        return jsonb_build_object('title', format('Module %s: Written reflection available', v_mod.order_number), 'detail', v_mod.title, 'href', '/academy/modules/' || v_mod.id || '/reflection');
      elsif v_part.part_key = 'practical' then
        return jsonb_build_object('title', format('Module %s: %s available', v_mod.order_number, v_part.label), 'detail', v_mod.title, 'href', '/academy/modules/' || v_mod.id || '/practical');
      elsif v_part.part_key = 'sign_off' then
        return jsonb_build_object('title', 'Supervisor sign-off is pending', 'detail', v_mod.title, 'href', '/academy/modules/' || v_mod.id);
      elsif v_part.part_key = 'capstone' then
        return jsonb_build_object('title', format('Module %s: Capstone simulation available', v_mod.order_number), 'detail', v_mod.title, 'href', '/academy/modules/' || v_mod.id);
      end if;
      return jsonb_build_object('title', 'Quiz passed, additional requirement pending', 'detail', v_mod.title, 'href', '/academy/modules/' || v_mod.id);
    elsif v_display = 'quiz_available' then
      v_card := app.academy_quiz_card(p_enrollment_id, v_mod.id);
      if v_card ->> 'kind' = 'final' then
        return jsonb_build_object('title', case v_card ->> 'status' when 'locked' then 'The Final Quiz is locked' when 'in_progress' then 'Continue the Final Quiz' else 'Take the Final Quiz' end, 'detail', v_mod.title, 'href', '/academy/modules/' || v_mod.id || '/quiz');
      elsif v_card ->> 'status' = 'locked' then
        return jsonb_build_object('title', format('Module %s quiz is locked', v_mod.order_number), 'detail', v_mod.title, 'href', '/academy/modules/' || v_mod.id || '/quiz');
      elsif v_card ->> 'status' = 'in_progress' then
        return jsonb_build_object('title', format('Continue the Module %s quiz', v_mod.order_number), 'detail', v_mod.title, 'href', '/academy/modules/' || v_mod.id || '/quiz');
      else
        return jsonb_build_object('title', format('Take the Module %s quiz', v_mod.order_number), 'detail', v_mod.title, 'href', '/academy/modules/' || v_mod.id || '/quiz');
      end if;
    elsif v_display = 'lessons_complete' then
      return jsonb_build_object('title', 'Lessons complete, quiz not yet available', 'detail', v_mod.title, 'href', '/academy/modules/' || v_mod.id);
    elsif v_display in ('available', 'in_progress') then
      select * into v_lesson from public.academy_lesson l
      where l.module_id = v_mod.id and l.published and l.archived_at is null
        and not exists (
          select 1 from public.academy_progress pr
          where pr.enrollment_id = p_enrollment_id and pr.lesson_id = l.id and pr.status = 'completed' and pr.completed_version = l.content_version
        )
      order by l.sort_order limit 1;
      if v_lesson.id is null then
        return jsonb_build_object('title', 'Lessons complete, quiz not yet available', 'detail', v_mod.title, 'href', '/academy/modules/' || v_mod.id);
      end if;
      select exists (select 1 from public.academy_progress pr where pr.enrollment_id = p_enrollment_id and pr.lesson_id = v_lesson.id) into v_started;
      select 1 + count(*) into v_pos from public.academy_lesson earlier
      where earlier.module_id = v_mod.id and earlier.published and earlier.archived_at is null and earlier.sort_order < v_lesson.sort_order;
      return jsonb_build_object('title', format('%s Module %s, Lesson %s', case when v_started then 'Continue' else 'Start' end, v_mod.order_number, v_pos), 'detail', v_lesson.title, 'href', '/academy/modules/' || v_mod.id || '/lessons/' || v_lesson.id);
    end if;
  end loop;
  return jsonb_build_object('title', 'Nothing to open', 'detail', 'Your program has no modules yet.', 'href', null);
end;
$$;

create or replace function public.academy_sim_abandon_due()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_minutes integer;
  v_row public.academy_sim_session;
  v_count integer := 0;
  v_used integer;
  v_settings public.academy_setting;
begin
  select * into v_settings from public.academy_setting where id = 1;
  v_minutes := v_settings.sim_abandoned_minutes;
  for v_row in
    select * from public.academy_sim_session
    where status = 'open' and preview = false
      and started_at + make_interval(mins => coalesce(v_minutes, 60)) <= now()
  loop
    update public.academy_sim_session
    set status = 'needs_manual', finished_at = now(), fail_reason = 'Needs manual grading.',
        log_outcome = coalesce(log_outcome, 'Abandoned'), log_learned = coalesce(log_learned, ''), log_next = coalesce(log_next, '')
    where id = v_row.id;
    perform app.audit('academy.simulation_abandoned', 'academy_sim_session', v_row.id::text, 'Abandoned simulation needs grading.', null, null);
    select count(*) into v_used from public.academy_sim_session
    where enrollment_id = v_row.enrollment_id and simulation_id = v_row.simulation_id and preview = false and status <> 'open';
    if v_used >= v_settings.sim_max_attempts then
      perform app.academy_practice_hold(v_row.enrollment_id, 'Failed the last simulation attempt', v_used, 'Abandoned.', v_row.simulation_id, null, null, null);
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
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
  perform public.academy_sim_abandon_due();
end;
$$;

create or replace function public.academy_practice_settings(p_payload jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not app.academy_manages() then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  update public.academy_setting set
    sim_max_attempts = coalesce((p_payload ->> 'sim_max_attempts')::integer, sim_max_attempts),
    sim_lockout_minutes = coalesce((p_payload ->> 'sim_lockout_minutes')::integer, sim_lockout_minutes),
    sim_abandoned_minutes = coalesce((p_payload ->> 'sim_abandoned_minutes')::integer, sim_abandoned_minutes),
    sim_daily_limit = coalesce((p_payload ->> 'sim_daily_limit')::integer, sim_daily_limit),
    sim_pass_score = coalesce((p_payload ->> 'sim_pass_score')::integer, sim_pass_score),
    capstone_pass_score = coalesce((p_payload ->> 'capstone_pass_score')::integer, capstone_pass_score),
    capstone_compliance_min = coalesce((p_payload ->> 'capstone_compliance_min')::integer, capstone_compliance_min),
    speed_thresholds = coalesce(p_payload -> 'speed_thresholds', speed_thresholds),
    reflection_max_attempts = coalesce((p_payload ->> 'reflection_max_attempts')::integer, reflection_max_attempts),
    reflection_min_words = coalesce((p_payload ->> 'reflection_min_words')::integer, reflection_min_words),
    practical_max_submissions = coalesce((p_payload ->> 'practical_max_submissions')::integer, practical_max_submissions),
    drill_questions = coalesce((p_payload ->> 'drill_questions')::integer, drill_questions),
    drill_pass_mark = coalesce((p_payload ->> 'drill_pass_mark')::integer, drill_pass_mark),
    drill_max_attempts = coalesce((p_payload ->> 'drill_max_attempts')::integer, drill_max_attempts),
    drill_lockout_minutes = coalesce((p_payload ->> 'drill_lockout_minutes')::integer, drill_lockout_minutes),
    ai_input_usd_per_million = coalesce((p_payload ->> 'ai_input_usd_per_million')::numeric, ai_input_usd_per_million),
    ai_output_usd_per_million = coalesce((p_payload ->> 'ai_output_usd_per_million')::numeric, ai_output_usd_per_million)
  where id = 1;
  perform app.audit('academy.practice_settings', 'academy_setting', '1', 'Practice settings changed.', null, p_payload);
end;
$$;

-- ---------------------------------------------------------------------------
-- Access. Trainees do not read personas, answer keys, or other people's work.
-- ---------------------------------------------------------------------------

alter table public.academy_offer_pack enable row level security;
alter table public.academy_offer enable row level security;
alter table public.academy_rubric enable row level security;
alter table public.academy_rubric_criterion enable row level security;
alter table public.academy_simulation enable row level security;
alter table public.academy_sim_lesson enable row level security;
alter table public.academy_sim_session enable row level security;
alter table public.academy_sim_message enable row level security;
alter table public.academy_sim_flag enable row level security;
alter table public.academy_grade enable row level security;
alter table public.academy_ai_call enable row level security;
alter table public.academy_calibration enable row level security;
alter table public.academy_drill_item enable row level security;
alter table public.academy_drill_attempt enable row level security;
alter table public.academy_drill_key enable row level security;
alter table public.academy_reflection enable row level security;
alter table public.academy_reflection_attempt enable row level security;
alter table public.academy_practical enable row level security;
alter table public.academy_practical_item enable row level security;
alter table public.academy_practical_submission enable row level security;
alter table public.academy_practical_evidence enable row level security;

create policy academy_offer_pack_admin on public.academy_offer_pack for all to authenticated using (app.academy_manages()) with check (app.academy_manages());
create policy academy_offer_admin on public.academy_offer for all to authenticated using (app.academy_manages()) with check (app.academy_manages());
create policy academy_rubric_admin on public.academy_rubric for all to authenticated using (app.academy_manages()) with check (app.academy_manages());
create policy academy_rubric_criterion_admin on public.academy_rubric_criterion for all to authenticated using (app.academy_manages()) with check (app.academy_manages());
create policy academy_simulation_admin on public.academy_simulation for all to authenticated using (app.academy_manages()) with check (app.academy_manages());
create policy academy_sim_lesson_admin on public.academy_sim_lesson for all to authenticated using (app.academy_manages()) with check (app.academy_manages());
create policy academy_drill_item_admin on public.academy_drill_item for all to authenticated using (app.academy_manages()) with check (app.academy_manages());
create policy academy_drill_key_admin on public.academy_drill_key for all to authenticated using (app.academy_manages()) with check (app.academy_manages());
create policy academy_calibration_admin on public.academy_calibration for all to authenticated using (app.academy_manages()) with check (app.academy_manages());
create policy academy_ai_call_admin on public.academy_ai_call for all to authenticated using (app.academy_manages()) with check (app.academy_manages());
create policy academy_reflection_admin on public.academy_reflection for all to authenticated using (app.academy_manages()) with check (app.academy_manages());
create policy academy_practical_admin on public.academy_practical for all to authenticated using (app.academy_manages()) with check (app.academy_manages());
create policy academy_practical_item_admin on public.academy_practical_item for all to authenticated using (app.academy_manages()) with check (app.academy_manages());

create policy academy_sim_session_read on public.academy_sim_session for select to authenticated using (
  app.academy_manages()
  or exists (select 1 from public.academy_enrollment e where e.id = academy_sim_session.enrollment_id and e.profile_id = app.acting_profile() and preview = false)
  or exists (select 1 from public.academy_enrollment e where e.id = academy_sim_session.enrollment_id and e.manager_id = app.acting_profile() and app.academy_reviews())
);
create policy academy_sim_message_read on public.academy_sim_message for select to authenticated using (
  exists (
    select 1 from public.academy_sim_session s
    where s.id = academy_sim_message.session_id
      and (
        app.academy_manages()
        or exists (select 1 from public.academy_enrollment e where e.id = s.enrollment_id and e.profile_id = app.acting_profile())
        or exists (select 1 from public.academy_enrollment e where e.id = s.enrollment_id and e.manager_id = app.acting_profile() and app.academy_reviews())
      )
  )
);
create policy academy_sim_flag_read on public.academy_sim_flag for select to authenticated using (
  exists (
    select 1 from public.academy_sim_session s
    join public.academy_enrollment e on e.id = s.enrollment_id
    where s.id = academy_sim_flag.session_id
      and (app.academy_manages() or (e.manager_id = app.acting_profile() and app.academy_reviews()))
  )
);
create policy academy_grade_read on public.academy_grade for select to authenticated using (
  app.academy_manages()
  or exists (
    select 1 from public.academy_sim_session s
    join public.academy_enrollment e on e.id = s.enrollment_id
    where s.id = academy_grade.session_id
      and (e.profile_id = app.acting_profile() or (e.manager_id = app.acting_profile() and app.academy_reviews()))
  )
  or exists (
    select 1 from public.academy_reflection_attempt a
    join public.academy_enrollment e on e.id = a.enrollment_id
    where a.id = academy_grade.reflection_attempt_id
      and (e.profile_id = app.acting_profile() or (e.manager_id = app.acting_profile() and app.academy_reviews()))
  )
);
create policy academy_drill_attempt_read on public.academy_drill_attempt for select to authenticated using (
  app.academy_manages()
  or exists (select 1 from public.academy_enrollment e where e.id = academy_drill_attempt.enrollment_id and (e.profile_id = app.acting_profile() or (e.manager_id = app.acting_profile() and app.academy_reviews())))
);
create policy academy_reflection_attempt_read on public.academy_reflection_attempt for select to authenticated using (
  app.academy_manages()
  or exists (select 1 from public.academy_enrollment e where e.id = academy_reflection_attempt.enrollment_id and (e.profile_id = app.acting_profile() or (e.manager_id = app.acting_profile() and app.academy_reviews())))
);
create policy academy_practical_submission_read on public.academy_practical_submission for select to authenticated using (
  app.academy_manages()
  or exists (select 1 from public.academy_enrollment e where e.id = academy_practical_submission.enrollment_id and (e.profile_id = app.acting_profile() or (e.manager_id = app.acting_profile() and app.academy_reviews())))
);
create policy academy_practical_evidence_read on public.academy_practical_evidence for select to authenticated using (
  exists (
    select 1 from public.academy_practical_submission s
    join public.academy_enrollment e on e.id = s.enrollment_id
    where s.id = academy_practical_evidence.submission_id
      and (app.academy_manages() or e.profile_id = app.acting_profile() or (e.manager_id = app.acting_profile() and app.academy_reviews()))
  )
);

revoke all on public.academy_offer_pack from anon, authenticated;
revoke all on public.academy_offer from anon, authenticated;
revoke all on public.academy_rubric from anon, authenticated;
revoke all on public.academy_rubric_criterion from anon, authenticated;
revoke all on public.academy_simulation from anon, authenticated;
revoke all on public.academy_sim_lesson from anon, authenticated;
revoke all on public.academy_sim_session from anon, authenticated;
revoke all on public.academy_sim_message from anon, authenticated;
revoke all on public.academy_sim_flag from anon, authenticated;
revoke all on public.academy_grade from anon, authenticated;
revoke all on public.academy_ai_call from anon, authenticated;
revoke all on public.academy_calibration from anon, authenticated;
revoke all on public.academy_drill_item from anon, authenticated;
revoke all on public.academy_drill_attempt from anon, authenticated;
revoke all on public.academy_drill_key from anon, authenticated;
revoke all on public.academy_reflection from anon, authenticated;
revoke all on public.academy_reflection_attempt from anon, authenticated;
revoke all on public.academy_practical from anon, authenticated;
revoke all on public.academy_practical_item from anon, authenticated;
revoke all on public.academy_practical_submission from anon, authenticated;
revoke all on public.academy_practical_evidence from anon, authenticated;

grant select on public.academy_offer_pack to authenticated;
grant select on public.academy_offer to authenticated;
grant select on public.academy_rubric to authenticated;
grant select on public.academy_rubric_criterion to authenticated;
grant select on public.academy_simulation to authenticated;
grant select on public.academy_sim_lesson to authenticated;
grant select on public.academy_sim_session to authenticated;
grant select on public.academy_sim_message to authenticated;
grant select on public.academy_sim_flag to authenticated;
grant select on public.academy_grade to authenticated;
grant select on public.academy_ai_call to authenticated;
grant select on public.academy_calibration to authenticated;
grant select on public.academy_drill_item to authenticated;
grant select on public.academy_drill_attempt to authenticated;
grant select on public.academy_drill_key to authenticated;
grant select on public.academy_reflection to authenticated;
grant select on public.academy_reflection_attempt to authenticated;
grant select on public.academy_practical to authenticated;
grant select on public.academy_practical_item to authenticated;
grant select on public.academy_practical_submission to authenticated;
grant select on public.academy_practical_evidence to authenticated;

revoke all on function public.academy_sim_post_lead(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.academy_sim_post_lead(uuid, text, boolean) to service_role;
grant execute on function public.academy_grade_apply(uuid, jsonb, integer, integer, text) to service_role;
grant execute on function public.academy_grade_manual(uuid) to service_role;
grant execute on function public.academy_reflection_grade(uuid, jsonb, integer, integer) to service_role;
revoke all on function public.academy_grade_apply(uuid, jsonb, integer, integer, text) from public, anon, authenticated;
revoke all on function public.academy_grade_manual(uuid) from public, anon, authenticated;
revoke all on function public.academy_reflection_grade(uuid, jsonb, integer, integer) from public, anon, authenticated;
revoke all on function app.academy_speed_score(integer) from public, anon, authenticated;
revoke all on function app.academy_drill_draw(uuid, integer, uuid[]) from public, anon, authenticated;
revoke all on function app.academy_apply_scores(uuid, jsonb) from public, anon, authenticated;

grant execute on function public.academy_offer_save(jsonb) to authenticated;
grant execute on function public.academy_rubric_save(jsonb) to authenticated;
grant execute on function public.academy_sim_save(jsonb) to authenticated;
grant execute on function public.academy_sim_admin(uuid) to authenticated;
grant execute on function public.academy_sim_begin(uuid, boolean) to authenticated;
grant execute on function public.academy_sim_post_operator(uuid, text) to authenticated;
grant execute on function public.academy_sim_submit(uuid, text, text, text, text) to authenticated;
grant execute on function public.academy_sim_abandon_due() to authenticated;
grant execute on function public.academy_sim_state(uuid) to authenticated;
grant execute on function public.academy_grade_override(uuid, text, integer, text) to authenticated;
grant execute on function public.academy_drill_start(uuid) to authenticated;
grant execute on function public.academy_drill_answer(uuid, uuid, text, text) to authenticated;
grant execute on function public.academy_drill_submit(uuid) to authenticated;
grant execute on function public.academy_drill_state(uuid) to authenticated;
grant execute on function public.academy_drill_import(jsonb) to authenticated;
grant execute on function public.academy_reflection_save(jsonb) to authenticated;
grant execute on function public.academy_reflection_submit(uuid, text) to authenticated;
grant execute on function public.academy_practical_save(jsonb) to authenticated;
grant execute on function public.academy_practical_submit(uuid, jsonb) to authenticated;
grant execute on function public.academy_practical_review(uuid, text, text) to authenticated;
grant execute on function public.academy_calibration_save(uuid, jsonb) to authenticated;
grant execute on function public.academy_calibration_report() to authenticated;
grant execute on function public.academy_hold_practice(uuid) to authenticated;
grant execute on function public.academy_practice_settings(jsonb) to authenticated;

create or replace function public.academy_module_practice(p_module uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'simulations', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'title', s.title, 'capstone', s.capstone) order by s.sort_order)
      from public.academy_simulation s
      where s.module_id = p_module and s.status = 'live'
        and (app.academy_manages() or exists (
          select 1 from public.academy_enrollment e
          where e.profile_id = app.acting_profile() and e.program_id = (select program_id from public.academy_module where id = p_module)
        ))
    ), '[]'::jsonb),
    'drill', exists (select 1 from public.academy_drill_item i where i.module_id = p_module and i.active),
    'reflection', (select r.id from public.academy_reflection r where r.module_id = p_module and r.status = 'live' limit 1),
    'practical', (select p.id from public.academy_practical p where p.module_id = p_module and p.status = 'live' limit 1)
  );
$$;

revoke all on function public.academy_module_practice(uuid) from public, anon;
grant execute on function public.academy_module_practice(uuid) to authenticated;

alter table public.academy_ai_call drop constraint if exists academy_ai_call_session_id_fkey;
alter table public.academy_ai_call
  add constraint academy_ai_call_session_id_fkey
  foreign key (session_id) references public.academy_sim_session (id) on delete set null;

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
    'status', case when app.academy_gate_part_satisfied(p_enrollment_id, gp) then 'satisfied' else 'pending' end,
    'best_score', case
      when gp.part_key = 'quiz' then (
        select max(a.score)::numeric from public.academy_attempt a
        join public.academy_quiz q on q.id = a.quiz_id
        where q.module_id = gp.module_id and a.enrollment_id = p_enrollment_id and a.finished_at is not null
      )
      when gp.part_key in ('simulation', 'capstone') then coalesce(
        (
          select max(s.total_score) from public.academy_sim_session s
          join public.academy_simulation sim on sim.id = s.simulation_id
          where sim.gate_part_id = gp.id and s.enrollment_id = p_enrollment_id and s.preview = false
        ),
        (
          select max(d.score)::numeric from public.academy_drill_attempt d
          where d.module_id = gp.module_id and d.enrollment_id = p_enrollment_id and d.finished_at is not null
            and gp.part_key = 'simulation'
            and not exists (select 1 from public.academy_simulation sim where sim.gate_part_id = gp.id)
        )
      )
      when gp.part_key = 'practical' then (
        select max(r.total_score) from public.academy_reflection_attempt r
        join public.academy_reflection ref on ref.id = r.reflection_id
        where ref.gate_part_id = gp.id and r.enrollment_id = p_enrollment_id
      )
      else null
    end
  ) order by gp.sort_order), '[]'::jsonb)
  from public.academy_gate_part gp
  where gp.module_id = p_module_id;
$$;

create or replace function public.academy_ai_record(
  p_session uuid,
  p_reflection uuid,
  p_kind text,
  p_tokens_in integer,
  p_tokens_out integer,
  p_ok boolean
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_in_rate numeric;
  v_out_rate numeric;
begin
  perform app.academy_service_only();
  select ai_input_usd_per_million, ai_output_usd_per_million into v_in_rate, v_out_rate from public.academy_setting where id = 1;
  insert into public.academy_ai_call (session_id, reflection_attempt_id, kind, tokens_in, tokens_out, cost_usd, ok)
  values (
    p_session, p_reflection, coalesce(nullif(btrim(p_kind), ''), 'lead'),
    coalesce(p_tokens_in, 0), coalesce(p_tokens_out, 0),
    round((coalesce(p_tokens_in, 0) * v_in_rate + coalesce(p_tokens_out, 0) * v_out_rate) / 1000000.0, 6),
    coalesce(p_ok, false)
  );
end;
$$;

create or replace function public.academy_reflection_manual(p_attempt uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v public.academy_reflection_attempt;
begin
  perform app.academy_service_only();
  select * into v from public.academy_reflection_attempt where id = p_attempt;
  if v.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  update public.academy_reflection_attempt
  set status = 'needs_manual', passed = null, fail_reason = 'Needs manual grading.'
  where id = v.id;
  perform app.audit('academy.grade_manual', 'academy_reflection_attempt', v.id::text, 'Reflection needs manual grading.', null, null);
end;
$$;

create or replace function public.academy_reflection_state(p_reflection uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.academy_reflection;
  v_enrollment public.academy_enrollment := app.academy_primary_for_actor();
  v_last public.academy_reflection_attempt;
  v_settings public.academy_setting;
  v_used integer;
begin
  select * into v from public.academy_reflection where id = p_reflection and status = 'live';
  select * into v_settings from public.academy_setting where id = 1;
  if v.id is null or v_enrollment.id is null then
    return jsonb_build_object('phase', 'unavailable');
  end if;
  select count(*) into v_used from public.academy_reflection_attempt where enrollment_id = v_enrollment.id and reflection_id = v.id;
  select * into v_last from public.academy_reflection_attempt
  where enrollment_id = v_enrollment.id and reflection_id = v.id
  order by attempt_number desc limit 1;
  return jsonb_build_object(
    'id', v.id,
    'prompt', v.prompt,
    'min_words', v.min_words,
    'pass_total', v.pass_total,
    'criterion_min', v.criterion_min,
    'attempts_used', v_used,
    'attempts_allowed', v_settings.reflection_max_attempts,
    'latest', case when v_last.id is null then null else jsonb_build_object(
      'id', v_last.id,
      'status', v_last.status,
      'score', v_last.total_score,
      'passed', v_last.passed,
      'fail_reason', v_last.fail_reason,
      'summary', v_last.summary,
      'criteria', coalesce((
        select jsonb_agg(jsonb_build_object(
          'key', g.criterion_key, 'name', c.name, 'score', coalesce(g.human_score, g.ai_score),
          'evidence', g.evidence, 'next', g.next_step
        ) order by c.sort_order)
        from public.academy_grade g
        join public.academy_rubric_criterion c on c.rubric_id = v.rubric_id and c.criterion_key = g.criterion_key
        where g.reflection_attempt_id = v_last.id
      ), '[]'::jsonb)
    ) end
  );
end;
$$;

create or replace function public.academy_reflection_override(p_attempt uuid, p_key text, p_score integer, p_note text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v public.academy_reflection_attempt;
  v_ref public.academy_reflection;
  v_enrollment public.academy_enrollment;
  v_sum integer := 0;
  v_fail text;
  v_passed boolean;
  v_row record;
  v_used integer;
  v_missing boolean := false;
  v_settings public.academy_setting;
begin
  select * into v from public.academy_reflection_attempt where id = p_attempt;
  select * into v_ref from public.academy_reflection where id = v.reflection_id;
  select * into v_enrollment from public.academy_enrollment where id = v.enrollment_id;
  select * into v_settings from public.academy_setting where id = 1;
  if v.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not app.academy_manages() and not (app.academy_reviews() and v_enrollment.manager_id = app.acting_profile()) then
    raise exception 'permission_denied: this review is not yours' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_note, ''))) = 0 or p_score < 0 or p_score > 5 then
    raise exception 'note_required: write why the score changed' using errcode = '22023';
  end if;
  insert into public.academy_grade (reflection_attempt_id, criterion_key, human_score, human_note)
  values (v.id, p_key, p_score, btrim(p_note))
  on conflict (reflection_attempt_id, criterion_key) where reflection_attempt_id is not null
  do update set human_score = excluded.human_score, human_note = excluded.human_note;
  for v_row in
    select c.name, c.criterion_key, coalesce(g.human_score, g.ai_score) as score
    from public.academy_rubric_criterion c
    left join public.academy_grade g on g.reflection_attempt_id = v.id and g.criterion_key = c.criterion_key
    where c.rubric_id = v_ref.rubric_id
  loop
    if v_row.score is null then
      v_missing := true;
      continue;
    end if;
    v_sum := v_sum + v_row.score;
    if v_row.score < v_ref.criterion_min then
      v_fail := coalesce(v_fail, format('%s is %s. The minimum is %s.', v_row.name, v_row.score, v_ref.criterion_min));
    end if;
  end loop;
  v_passed := not v_missing and v_sum >= v_ref.pass_total and v_fail is null;
  update public.academy_reflection_attempt set
    status = case when v_missing then 'needs_manual' else 'graded' end,
    total_score = case when v_missing then null else v_sum end,
    passed = case when v_missing then null else v_passed end,
    fail_reason = case
      when v_missing then 'Needs manual grading.'
      when v_passed then null
      else coalesce(v_fail, format('The score is %s. The pass score is %s.', v_sum, v_ref.pass_total))
    end
  where id = v.id;
  if v_passed then
    perform app.academy_mark_part(v.enrollment_id, v_ref.gate_part_id);
  elsif not v_missing then
    select count(*) into v_used from public.academy_reflection_attempt
    where enrollment_id = v.enrollment_id and reflection_id = v_ref.id and status = 'graded';
    if v_used >= v_settings.reflection_max_attempts then
      perform app.academy_practice_hold(v.enrollment_id, 'Failed the last reflection attempt', v_used, v_fail, null, null, v_ref.id, null);
    end if;
  end if;
  perform app.audit('academy.grade_override', 'academy_reflection_attempt', v.id::text, 'A reflection score was changed.', null,
    jsonb_build_object('criterion', p_key, 'score', p_score, 'note', btrim(p_note)));
end;
$$;

create or replace function public.academy_practical_state(p_practical uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.academy_practical;
  v_enrollment public.academy_enrollment := app.academy_primary_for_actor();
  v_last public.academy_practical_submission;
  v_settings public.academy_setting;
  v_used integer;
begin
  select * into v from public.academy_practical where id = p_practical and status = 'live';
  select * into v_settings from public.academy_setting where id = 1;
  if v.id is null or v_enrollment.id is null then
    return jsonb_build_object('phase', 'unavailable');
  end if;
  select count(*) into v_used from public.academy_practical_submission where enrollment_id = v_enrollment.id and practical_id = v.id;
  select * into v_last from public.academy_practical_submission
  where enrollment_id = v_enrollment.id and practical_id = v.id
  order by submission_number desc limit 1;
  return jsonb_build_object(
    'id', v.id,
    'title', v.title,
    'instructions', v.instructions,
    'submissions_used', v_used,
    'submissions_allowed', v_settings.practical_max_submissions,
    'status', coalesce(v_last.status, 'open'),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id,
        'label', i.label,
        'required', i.required,
        'status', coalesce(e.status, 'open'),
        'comment', e.comment,
        'kind', e.kind,
        'body', case when e.kind = 'file' then null else e.body end,
        'has_file', e.kind = 'file',
        'evidence_id', e.id,
        'open', v_last.id is null or e.status = 'needs_work'
      ) order by i.sort_order)
      from public.academy_practical_item i
      left join public.academy_practical_evidence e on e.item_id = i.id and e.submission_id = v_last.id
      where i.practical_id = v.id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.academy_practical_queue()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app.academy_manages() and not app.academy_reviews() then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'waiting', (
      select count(*) from public.academy_practical_submission s
      join public.academy_enrollment e on e.id = s.enrollment_id
      where s.status = 'pending'
        and (app.academy_manages() or (app.academy_reviews() and e.manager_id = app.acting_profile()))
    ),
    'submissions', coalesce((
      select jsonb_agg(row_to_json(q) order by q.created_at)
      from (
        select s.id, s.created_at, s.submission_number, p.title,
          pr.full_name as trainee_name,
          coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', ev.id, 'label', i.label, 'kind', ev.kind,
              'body', case when ev.kind = 'file' then null else ev.body end,
              'has_file', ev.kind = 'file', 'status', ev.status, 'comment', ev.comment
            ) order by i.sort_order)
            from public.academy_practical_evidence ev
            join public.academy_practical_item i on i.id = ev.item_id
            where ev.submission_id = s.id and ev.status = 'pending'
          ), '[]'::jsonb) as evidence
        from public.academy_practical_submission s
        join public.academy_practical p on p.id = s.practical_id
        join public.academy_enrollment e on e.id = s.enrollment_id
        join public.profile pr on pr.id = e.profile_id
        where s.status = 'pending'
          and (app.academy_manages() or (app.academy_reviews() and e.manager_id = app.acting_profile()))
        order by s.created_at
        limit 100
      ) q
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.academy_practical_file(p_evidence uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.academy_practical_evidence;
  v_sub public.academy_practical_submission;
  v_enrollment public.academy_enrollment;
begin
  select * into v from public.academy_practical_evidence where id = p_evidence and kind = 'file';
  select * into v_sub from public.academy_practical_submission where id = v.submission_id;
  select * into v_enrollment from public.academy_enrollment where id = v_sub.enrollment_id;
  if v.storage_path is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not app.academy_manages()
     and not (v_enrollment.profile_id = app.acting_profile())
     and not (app.academy_reviews() and v_enrollment.manager_id = app.acting_profile()) then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  return v.storage_path;
end;
$$;

create or replace function public.academy_sim_preview_state(p_session uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.academy_sim_session;
  v_sim public.academy_simulation;
begin
  select * into v from public.academy_sim_session where id = p_session and preview;
  if v.id is null or not app.academy_manages() or v.actor_id is distinct from app.acting_profile() then
    return jsonb_build_object('phase', 'unavailable');
  end if;
  select * into v_sim from public.academy_simulation where id = v.simulation_id;
  return jsonb_build_object(
    'session_id', v.id,
    'simulation_id', v_sim.id,
    'title', v_sim.title,
    'brief', v_sim.brief,
    'status', v.status,
    'max_turns', v_sim.max_turns,
    'time_limit_seconds', v_sim.time_limit_seconds,
    'lead_first_at', v.lead_first_at,
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object('role', m.role, 'body', m.body, 'at', m.created_at) order by m.created_at)
      from public.academy_sim_message m where m.session_id = v.id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.academy_sim_review(p_session uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.academy_sim_session;
  v_enrollment public.academy_enrollment;
  v_sim public.academy_simulation;
begin
  select * into v from public.academy_sim_session where id = p_session and preview = false;
  select * into v_enrollment from public.academy_enrollment where id = v.enrollment_id;
  if v.id is null then
    return jsonb_build_object('phase', 'unavailable');
  end if;
  if not app.academy_manages() and not (app.academy_reviews() and v_enrollment.manager_id = app.acting_profile()) then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  select * into v_sim from public.academy_simulation where id = v.simulation_id;
  return jsonb_build_object(
    'id', v.id,
    'title', v_sim.title,
    'status', v.status,
    'score', v.total_score,
    'passed', v.passed,
    'fail_reason', v.fail_reason,
    'summary', v.summary,
    'log', jsonb_build_object('outcome', v.log_outcome, 'learned', v.log_learned, 'next', v.log_next, 'notes', v.log_notes),
    'transcript', coalesce((
      select jsonb_agg(jsonb_build_object('role', m.role, 'body', m.body, 'at', m.created_at) order by m.created_at)
      from public.academy_sim_message m where m.session_id = v.id
    ), '[]'::jsonb),
    'criteria', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', g.criterion_key, 'name', c.name, 'ai', g.ai_score, 'human', g.human_score
      ) order by c.sort_order)
      from public.academy_grade g
      join public.academy_rubric_criterion c on c.rubric_id = v.rubric_id and c.criterion_key = g.criterion_key
      where g.session_id = v.id
    ), '[]'::jsonb),
    'flags', coalesce((select jsonb_agg(f.body) from public.academy_sim_flag f where f.session_id = v.id), '[]'::jsonb)
  );
end;
$$;

create or replace function public.academy_manual_queue()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app.academy_manages() and not app.academy_reviews() then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'waiting', (
      select count(*) from public.academy_sim_session s
      join public.academy_enrollment e on e.id = s.enrollment_id
      where s.status = 'needs_manual' and s.preview = false
        and (app.academy_manages() or e.manager_id = app.acting_profile())
    ) + (
      select count(*) from public.academy_reflection_attempt a
      join public.academy_enrollment e on e.id = a.enrollment_id
      where a.status = 'needs_manual'
        and (app.academy_manages() or e.manager_id = app.acting_profile())
    ),
    'simulations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'title', sim.title, 'finished_at', s.finished_at, 'trainee_name', pr.full_name
      ) order by s.finished_at)
      from public.academy_sim_session s
      join public.academy_simulation sim on sim.id = s.simulation_id
      join public.academy_enrollment e on e.id = s.enrollment_id
      join public.profile pr on pr.id = e.profile_id
      where s.status = 'needs_manual' and s.preview = false
        and (app.academy_manages() or (app.academy_reviews() and e.manager_id = app.acting_profile()))
    ), '[]'::jsonb),
    'reflections', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'created_at', a.created_at, 'trainee_name', pr.full_name, 'body', a.body
      ) order by a.created_at)
      from public.academy_reflection_attempt a
      join public.academy_enrollment e on e.id = a.enrollment_id
      join public.profile pr on pr.id = e.profile_id
      where a.status = 'needs_manual'
        and (app.academy_manages() or (app.academy_reviews() and e.manager_id = app.acting_profile()))
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.academy_practice_catalog()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_settings public.academy_setting;
begin
  if not app.academy_manages() then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  select * into v_settings from public.academy_setting where id = 1;
  return jsonb_build_object(
    'settings', to_jsonb(v_settings),
    'modules', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'order', m.order_number, 'title', m.title,
        'parts', coalesce((
          select jsonb_agg(jsonb_build_object('id', gp.id, 'key', gp.part_key, 'label', gp.label) order by gp.sort_order)
          from public.academy_gate_part gp where gp.module_id = m.id
        ), '[]'::jsonb)
      ) order by m.order_number)
      from public.academy_module m
      join public.academy_program p on p.id = m.program_id
      where p.slug = 'da-operator-academy'
    ), '[]'::jsonb),
    'packs', coalesce((
      select jsonb_agg(jsonb_build_object('id', pack.id, 'name', pack.name, 'version', pack.version, 'created_at', pack.created_at) order by pack.name, pack.version desc)
      from public.academy_offer_pack pack
    ), '[]'::jsonb),
    'rubrics', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'name', r.name, 'kind', r.kind, 'version', r.version,
        'criteria', coalesce((
          select jsonb_agg(jsonb_build_object(
            'key', c.criterion_key, 'name', c.name, 'description', c.description, 'weight', c.weight,
            'score_0', c.score_0, 'score_3', c.score_3, 'score_5', c.score_5,
            'critical', c.critical, 'minimum_score', c.minimum_score, 'sort_order', c.sort_order
          ) order by c.sort_order)
          from public.academy_rubric_criterion c where c.rubric_id = r.id
        ), '[]'::jsonb)
      ) order by r.name, r.version desc)
      from public.academy_rubric r
    ), '[]'::jsonb),
    'simulations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'title', s.title, 'status', s.status, 'vertical', s.vertical, 'module_id', s.module_id,
        'gate_part_id', s.gate_part_id, 'difficulty', s.difficulty, 'capstone', s.capstone,
        'offer_pack_id', s.offer_pack_id, 'rubric_id', s.rubric_id, 'max_turns', s.max_turns,
        'time_limit_seconds', s.time_limit_seconds, 'pass_score', s.pass_score
      ) order by s.updated_at desc)
      from public.academy_simulation s
    ), '[]'::jsonb),
    'reflections', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'module_id', r.module_id, 'gate_part_id', r.gate_part_id, 'prompt', r.prompt,
        'min_words', r.min_words, 'rubric_id', r.rubric_id, 'pass_total', r.pass_total,
        'criterion_min', r.criterion_min, 'status', r.status
      ))
      from public.academy_reflection r
    ), '[]'::jsonb),
    'practicals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'module_id', p.module_id, 'gate_part_id', p.gate_part_id, 'title', p.title,
        'instructions', p.instructions, 'status', p.status,
        'items', coalesce((
          select jsonb_agg(jsonb_build_object('label', i.label, 'required', i.required, 'sort_order', i.sort_order) order by i.sort_order)
          from public.academy_practical_item i where i.practical_id = p.id
        ), '[]'::jsonb)
      ))
      from public.academy_practical p
    ), '[]'::jsonb),
    'graded_sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'title', sim.title, 'score', s.total_score, 'status', s.status, 'finished_at', s.finished_at
      ) order by s.finished_at desc)
      from (
        select * from public.academy_sim_session
        where preview = false and status in ('graded', 'needs_manual')
        order by finished_at desc nulls last
        limit 40
      ) s
      join public.academy_simulation sim on sim.id = s.simulation_id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.academy_ai_record(uuid, uuid, text, integer, integer, boolean) from public, anon, authenticated;
revoke all on function public.academy_reflection_manual(uuid) from public, anon, authenticated;
grant execute on function public.academy_ai_record(uuid, uuid, text, integer, integer, boolean) to service_role;
grant execute on function public.academy_reflection_manual(uuid) to service_role;
grant execute on function public.academy_reflection_state(uuid) to authenticated;
grant execute on function public.academy_reflection_override(uuid, text, integer, text) to authenticated;
grant execute on function public.academy_practical_state(uuid) to authenticated;
grant execute on function public.academy_practical_queue() to authenticated;
grant execute on function public.academy_practical_file(uuid) to authenticated;
grant execute on function public.academy_sim_preview_state(uuid) to authenticated;
grant execute on function public.academy_sim_review(uuid) to authenticated;
grant execute on function public.academy_manual_queue() to authenticated;
grant execute on function public.academy_practice_catalog() to authenticated;

create or replace function public.academy_reflection_review(p_attempt uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.academy_reflection_attempt;
  v_ref public.academy_reflection;
  v_enrollment public.academy_enrollment;
begin
  select * into v from public.academy_reflection_attempt where id = p_attempt;
  select * into v_ref from public.academy_reflection where id = v.reflection_id;
  select * into v_enrollment from public.academy_enrollment where id = v.enrollment_id;
  if v.id is null then
    return jsonb_build_object('phase', 'unavailable');
  end if;
  if not app.academy_manages() and not (app.academy_reviews() and v_enrollment.manager_id = app.acting_profile()) then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'id', v.id,
    'status', v.status,
    'body', v.body,
    'fail_reason', v.fail_reason,
    'summary', v.summary,
    'criteria', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', c.criterion_key, 'name', c.name, 'ai', g.ai_score, 'human', g.human_score
      ) order by c.sort_order)
      from public.academy_rubric_criterion c
      left join public.academy_grade g on g.reflection_attempt_id = v.id and g.criterion_key = c.criterion_key
      where c.rubric_id = v_ref.rubric_id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.academy_reflection_review(uuid) from public, anon;
grant execute on function public.academy_reflection_review(uuid) to authenticated;
