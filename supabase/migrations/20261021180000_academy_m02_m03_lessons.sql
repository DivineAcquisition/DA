-- Lesson 02, The DA Standard, for module 2.
-- Lesson 03, What We Sell and Why It Works, for module 3.
-- Source: Divine Acquisition company-wide training, Lessons 02 and 03.
-- Videos are not attached. Both lessons stay Ready until a video is added
-- and the status is set to Live.
-- Each lesson quiz is 5 questions. The academy pass mark is 85 percent,
-- which on 5 questions means all 5 correct, with 3 attempts.
--
-- Lesson 02 answer key: 1 B, 2 B, 3 C, 4 B, 5 C.
-- Lesson 03 answer key: 1 B, 2 B, 3 B, 4 C, 5 B.

do $m02$
declare
  v_module uuid;
  v_lesson uuid;
  v_order integer;
  v_body text := $body$Devotion. Value. Exclusivity.

This lesson is for every employee. The lesson video will appear on this page when it is ready. Read this first, then pass the quiz.

## Introduction

At Divine Acquisition, excellence is not an aspiration. It is the minimum standard.

Every employee, regardless of position, seniority, or department, is expected to operate with discipline, professionalism, integrity, and ownership.

We do not measure people solely by how busy they are. We measure them by their ability to execute, communicate, solve problems, and deliver meaningful outcomes.

The DA Standard is what we expect from everyone who represents this company.

## Ownership is non-negotiable

When you accept a responsibility, you own its execution.

Follow through. Identify obstacles. Communicate when you need assistance.

We do not accept blame-shifting, repeated excuses, or avoidable negligence. If you own the task, you own the follow-through.

## Communication is a responsibility

Silence creates uncertainty. Poor communication creates operational failure.

Communicate clearly, promptly, and professionally with colleagues, leadership, and clients.

- Acknowledge assigned responsibilities.
- Provide updates before being chased.
- Raise problems as soon as they become apparent.
- Never leave a client or teammate uncertain about the next step.

No one should have to repeatedly ask you for an update on work you own.

## Execution over excuses

Ideas, plans, and intentions have little value without execution.

Meet commitments. Respect deadlines. Produce work that is accurate and complete.

If a deadline is at risk, communicate early, explain the obstacle, and propose a solution.

Being busy is not an accomplishment. Delivering results is.

## Attention to detail is mandatory

Small mistakes can create major operational problems.

Incorrect client information, neglected follow-ups, inaccurate reports, and incomplete system configurations damage trust.

Review your work before marking it complete. If it is not verified, it is not finished.

## Problems must be addressed, not hidden

Mistakes can happen. Concealing them, ignoring them, or allowing them to continue is unacceptable.

When something goes wrong:

1. Identify the issue.
2. Communicate it to the appropriate person.
3. Take corrective action within your authority.
4. Document the resolution and prevent recurrence.

Never fabricate results, misrepresent progress, or promise something that cannot be delivered. Integrity is required, especially when the truth is inconvenient.

## Think beyond your job description

You were hired for a role, and you are also expected to use sound judgment.

Recognize inefficiencies. Identify opportunities to improve. Understand how your work affects other departments and the client's business.

Do not make unauthorized commitments or changes. Take initiative within your responsibilities and escalate when necessary.

We value people who solve problems, not people who only identify them.

## Respect the client, the team, and the company

Every interaction reflects Divine Acquisition.

Professionalism includes punctuality, preparedness, respectful communication, confidentiality, and responsible handling of client information.

Internal disagreements stay constructive. Client concerns are treated seriously.

No employee is exempt from professional conduct because of performance, position, or tenure. Talent does not excuse poor character or unprofessional behavior.

## Accountability has consequences

The DA Standard applies equally across the organization.

Repeated failure to meet expectations, disregard for procedures, dishonesty, or unprofessional conduct is addressed through management intervention and, where appropriate, corrective or disciplinary action. Serious misconduct may warrant immediate escalation.

Accountability is not about punishment. It is about the reliability, trust, and quality our clients and colleagues deserve.

## The final standard

Own your responsibilities. Communicate without being chased. Execute with precision. Protect the client's trust. Solve problems proactively. Operate with integrity. Continuously improve.

The DA Standard is not optional. It is the expectation that comes with representing Divine Acquisition.

By completing this lesson, you acknowledge that you understand these standards and that you are responsible for upholding them.

The standard is not what you say you can do. It is what you consistently deliver.

Pass the lesson quiz before this lesson can be marked complete. The quiz has 5 questions. You need 85 percent, which is all 5 correct. You have 3 attempts.
$body$;
begin
  select l.id, l.module_id into v_lesson, v_module
  from public.academy_lesson l
  where l.lesson_code = 'M02-L01' and l.archived_at is null;

  if v_lesson is null then
    select m.id into v_module
    from public.academy_module m
    join public.academy_program p on p.id = m.program_id
    where p.slug = 'da-operator-academy' and m.order_number = 2;
    if v_module is null then
      raise exception 'module 2 (The DA Standard) is missing';
    end if;
    if exists (
      select 1 from public.academy_lesson where module_id = v_module and sort_order = 1
    ) then
      select coalesce(max(sort_order), 0) + 1 into v_order
      from public.academy_lesson where module_id = v_module;
    else
      v_order := 1;
    end if;
    insert into public.academy_lesson (
      module_id, lesson_code, sort_order, title, body, required_watch_percent, status, content_version
    ) values (
      v_module, 'M02-L01', v_order, 'The DA Standard', v_body, 90, 'ready', 1
    ) returning id into v_lesson;
    insert into public.academy_lesson_version (
      lesson_id, version, title, body, required_watch_percent, status
    ) values (
      v_lesson, 1, 'The DA Standard', v_body, 90, 'ready'
    );
  end if;

  insert into public.academy_concept (module_id, name, lesson_id)
  select v_module, tag.name, v_lesson
  from (values
    ('How we measure'),
    ('Ownership'),
    ('Deadlines'),
    ('When something goes wrong'),
    ('The final standard')
  ) as tag(name)
  where not exists (
    select 1 from public.academy_concept c
    where c.module_id = v_module and c.name = tag.name
  );

  update public.academy_concept
  set lesson_id = v_lesson
  where module_id = v_module
    and lesson_id is null
    and name in (
      'How we measure', 'Ownership', 'Deadlines', 'When something goes wrong', 'The final standard'
    );

  insert into public.academy_question (
    module_id, prompt, question_type, options, correct_answer, explanation,
    concept_tag, concept_id, difficulty, active, created_at
  )
  select
    v_module, q.prompt, 'multiple_choice',
    jsonb_build_array(
      jsonb_build_object('id', 'a', 'text', q.opt_a),
      jsonb_build_object('id', 'b', 'text', q.opt_b),
      jsonb_build_object('id', 'c', 'text', q.opt_c),
      jsonb_build_object('id', 'd', 'text', q.opt_d)
    ),
    q.correct, q.explanation, q.tag, c.id, q.difficulty, true,
    timestamptz '2026-10-21 18:00:00+00' + (q.n * interval '1 second')
  from (values
    (
      1, 'How we measure', 'easy', 'b',
      $m02q$How does the DA Standard say we measure people?$m02q$,
      $m02q$We do not measure people solely by how busy they are. We measure their ability to execute, communicate, solve problems, and deliver meaningful outcomes.$m02q$,
      $m02q$By how busy they are$m02q$,
      $m02q$By their ability to execute, communicate, solve problems, and deliver meaningful outcomes$m02q$,
      $m02q$By seniority and department$m02q$,
      $m02q$By how many ideas they propose$m02q$
    ),
    (
      2, 'Ownership', 'medium', 'b',
      $m02q$What does ownership require when you accept a responsibility?$m02q$,
      $m02q$If you own the task, you own the follow-through. Identify obstacles and communicate when you need assistance. Blame-shifting and repeated excuses are not accepted.$m02q$,
      $m02q$Shift the blame if an obstacle appears$m02q$,
      $m02q$Follow through, identify obstacles, and communicate when you need assistance$m02q$,
      $m02q$Wait until someone asks for an update$m02q$,
      $m02q$Hand the follow-through to another department$m02q$
    ),
    (
      3, 'Deadlines', 'medium', 'c',
      $m02q$A deadline you own is at risk. What does the DA Standard require?$m02q$,
      $m02q$Communicate early, explain the obstacle, and propose a solution. Being busy is not an accomplishment. Delivering results is.$m02q$,
      $m02q$Stay quiet and hope the deadline moves$m02q$,
      $m02q$Treat being busy as the accomplishment$m02q$,
      $m02q$Communicate early, explain the obstacle, and propose a solution$m02q$,
      $m02q$Mark the work complete before it is verified$m02q$
    ),
    (
      4, 'When something goes wrong', 'medium', 'b',
      $m02q$Something goes wrong. What should you do?$m02q$,
      $m02q$Identify the issue, communicate it, take corrective action within your authority, and document the resolution so it does not recur. Never fabricate results or promise what cannot be delivered.$m02q$,
      $m02q$Conceal it until the client notices$m02q$,
      $m02q$Identify the issue, communicate it, correct what you can, and document how it will not recur$m02q$,
      $m02q$Fabricate a result that looks better$m02q$,
      $m02q$Promise an outcome you cannot deliver$m02q$
    ),
    (
      5, 'The final standard', 'easy', 'c',
      $m02q$Which statement is the DA Standard?$m02q$,
      $m02q$The standard is not what you say you can do. It is what you consistently deliver. Talent does not excuse unprofessional behavior, and accountability is about reliability, not punishment.$m02q$,
      $m02q$The standard is what you say you can do$m02q$,
      $m02q$Talent excuses unprofessional behavior$m02q$,
      $m02q$The standard is what you consistently deliver$m02q$,
      $m02q$Accountability is mainly about punishment$m02q$
    )
  ) as q(n, tag, difficulty, correct, prompt, explanation, opt_a, opt_b, opt_c, opt_d)
  join public.academy_concept c on c.module_id = v_module and c.name = q.tag
  where not exists (
    select 1 from public.academy_question existing
    where existing.module_id = v_module
      and lower(btrim(existing.prompt)) = lower(btrim(q.prompt))
  );

  if exists (
    select 1
    from (values
      ($m02q$How does the DA Standard say we measure people?$m02q$, 'b'),
      ($m02q$What does ownership require when you accept a responsibility?$m02q$, 'b'),
      ($m02q$A deadline you own is at risk. What does the DA Standard require?$m02q$, 'c'),
      ($m02q$Something goes wrong. What should you do?$m02q$, 'b'),
      ($m02q$Which statement is the DA Standard?$m02q$, 'c')
    ) as expected(prompt, answer)
    left join public.academy_question question
      on question.module_id = v_module and question.prompt = expected.prompt
    where question.id is null
       or question.correct_answer is distinct from expected.answer
       or question.active is distinct from true
       or not exists (
         select 1 from public.academy_concept concept
         where concept.id = question.concept_id and concept.lesson_id = v_lesson
       )
  ) then
    raise exception 'the DA Standard quiz did not match the Lesson 02 answer key';
  end if;
end
$m02$;

do $m03$
declare
  v_module uuid;
  v_lesson uuid;
  v_order integer;
  v_body text := $body$Devotion. Value. Exclusivity.

This lesson is for every department. It takes about 5 minutes to read. The lesson video will appear on this page when it is ready. Read this first, then pass the quiz.

We don't sell activity. We sell operational improvement.

## Introduction

Divine Acquisition does not sell leads, automation, or software as isolated solutions.

We sell the design, implementation, and optimization of systems that improve how businesses operate and generate revenue.

Every employee must understand what clients are paying for and why the approach creates value.

## What we sell

The work focuses on five areas. They can be delivered separately or combined into one operational solution.

- **Customer acquisition.** Build and improve the processes that attract and capture qualified opportunities.
- **Sales operations.** Structured pipelines, lead qualification, speed-to-lead, follow-up, appointment management, and conversion workflows.
- **Customer retention.** Systems for relationships, reactivation, repeat business, and long-term customer value.
- **AI and automation.** Intelligent agents, automated workflows, and integrated technology that reduce manual work and make execution more consistent.
- **Performance intelligence.** Visibility into what is working, what is failing, and where improvement is needed.

## What clients are actually buying

Clients are not paying us simply to install a CRM, launch advertisements, or configure automations.

They are investing in a better-functioning business. That means:

- Faster and more consistent execution
- Fewer opportunities lost through poor processes
- Better visibility into sales and operational performance
- Stronger customer relationships and retention
- Infrastructure that can support future growth

The system is the deliverable. Improved business performance is the objective.

## Why the approach works

Most businesses do not have one isolated problem. Growth is affected by connected processes.

Consider a business generating 100 leads a month. If those leads are contacted too late, appointments are missed, and follow-ups are neglected, increasing advertising spend will not fix those weaknesses.

Divine Acquisition finds where performance breaks down and implements systems to address it.

The approach follows five stages: Diagnose, Design, Implement, Monitor, and Optimize. We identify the constraint, build the solution, measure it, and improve it.

This works because it addresses the operational causes of lost opportunities rather than assuming more activity will produce better results.

Results depend on proper implementation, client participation, and market conditions. We never guarantee outcomes that cannot be substantiated.

## Where Vistrial fits

Vistrial is our developing AI-powered sales and operations platform. It is designed to support lead intelligence, workflow monitoring, operational tracking, and AI-assisted execution.

Vistrial strengthens our ability to deliver connected, measurable solutions.

We do not sell AI for the sake of AI. We use technology to solve real business problems.

## Our responsibility to clients

Every service must have a clearly defined business purpose.

Sales Operations must improve execution. Client Success must reinforce adoption and measurable value. Support must maintain reliability and resolve operational issues. Technology must make processes more effective, not unnecessarily complex.

Every department contributes to the same outcome. A system that looks impressive but fails to solve the client's problem is not a successful delivery.

## The final standard

Diagnose before prescribing. Build systems, not dependencies. Prioritize measurable business outcomes. Use AI and technology with purpose. Never confuse deliverables with results.

Divine Acquisition exists to help businesses operate better, convert more effectively, retain customers, and build sustainable growth.

We don't sell the promise of growth. We build the infrastructure that makes growth more achievable, measurable, and repeatable.

That is what we sell. That is why clients hire us. That is the value every employee is responsible for delivering.

Pass the lesson quiz before this lesson can be marked complete. The quiz has 5 questions. You need 85 percent, which is all 5 correct. You have 3 attempts.
$body$;
begin
  select l.id, l.module_id into v_lesson, v_module
  from public.academy_lesson l
  where l.lesson_code = 'M03-L01' and l.archived_at is null;

  if v_lesson is null then
    select m.id into v_module
    from public.academy_module m
    join public.academy_program p on p.id = m.program_id
    where p.slug = 'da-operator-academy' and m.order_number = 3;
    if v_module is null then
      raise exception 'module 3 (What We Sell and Why It Works) is missing';
    end if;
    if exists (
      select 1 from public.academy_lesson where module_id = v_module and sort_order = 1
    ) then
      select coalesce(max(sort_order), 0) + 1 into v_order
      from public.academy_lesson where module_id = v_module;
    else
      v_order := 1;
    end if;
    insert into public.academy_lesson (
      module_id, lesson_code, sort_order, title, body, required_watch_percent, status, content_version
    ) values (
      v_module, 'M03-L01', v_order, 'What We Sell and Why It Works', v_body, 90, 'ready', 1
    ) returning id into v_lesson;
    insert into public.academy_lesson_version (
      lesson_id, version, title, body, required_watch_percent, status
    ) values (
      v_lesson, 1, 'What We Sell and Why It Works', v_body, 90, 'ready'
    );
  end if;

  insert into public.academy_concept (module_id, name, lesson_id)
  select v_module, tag.name, v_lesson
  from (values
    ('What we sell'),
    ('What clients buy'),
    ('Why it works'),
    ('Vistrial'),
    ('Deliverables and results')
  ) as tag(name)
  where not exists (
    select 1 from public.academy_concept c
    where c.module_id = v_module and c.name = tag.name
  );

  update public.academy_concept
  set lesson_id = v_lesson
  where module_id = v_module
    and lesson_id is null
    and name in (
      'What we sell', 'What clients buy', 'Why it works', 'Vistrial', 'Deliverables and results'
    );

  insert into public.academy_question (
    module_id, prompt, question_type, options, correct_answer, explanation,
    concept_tag, concept_id, difficulty, active, created_at
  )
  select
    v_module, q.prompt, 'multiple_choice',
    jsonb_build_array(
      jsonb_build_object('id', 'a', 'text', q.opt_a),
      jsonb_build_object('id', 'b', 'text', q.opt_b),
      jsonb_build_object('id', 'c', 'text', q.opt_c),
      jsonb_build_object('id', 'd', 'text', q.opt_d)
    ),
    q.correct, q.explanation, q.tag, c.id, q.difficulty, true,
    timestamptz '2026-10-21 18:10:00+00' + (q.n * interval '1 second')
  from (values
    (
      1, 'What we sell', 'easy', 'b',
      $m03q$What does Divine Acquisition sell?$m03q$,
      $m03q$We sell the design, implementation, and optimization of systems that improve how a business operates and generates revenue. Leads, automation, and software are not sold as isolated solutions.$m03q$,
      $m03q$Leads, automation, and software as isolated solutions$m03q$,
      $m03q$The design, implementation, and optimization of systems that improve how a business operates and generates revenue$m03q$,
      $m03q$A guaranteed revenue number$m03q$,
      $m03q$Advertising management only$m03q$
    ),
    (
      2, 'What clients buy', 'easy', 'b',
      $m03q$What are clients actually buying?$m03q$,
      $m03q$Clients are investing in a better-functioning business. The system is the deliverable. Improved business performance is the objective.$m03q$,
      $m03q$A CRM installation by itself$m03q$,
      $m03q$A better-functioning business$m03q$,
      $m03q$More advertising spend$m03q$,
      $m03q$AI for its own sake$m03q$
    ),
    (
      3, 'Why it works', 'medium', 'b',
      $m03q$A business generates 100 leads a month, but leads are contacted late and follow-ups are neglected. What does the lesson say about increasing advertising spend?$m03q$,
      $m03q$Increasing advertising spend will not fix late contact, missed appointments, or neglected follow-up. We diagnose the operational cause instead of assuming more activity produces better results.$m03q$,
      $m03q$It will fix those weaknesses$m03q$,
      $m03q$It will not fix those weaknesses$m03q$,
      $m03q$It should be the first recommendation$m03q$,
      $m03q$It guarantees better results$m03q$
    ),
    (
      4, 'Vistrial', 'medium', 'c',
      $m03q$What is Vistrial's place in what we sell?$m03q$,
      $m03q$Vistrial supports lead intelligence, workflow monitoring, tracking, and AI-assisted execution. We do not sell AI for its own sake. We use technology to solve real business problems.$m03q$,
      $m03q$We sell AI because it is impressive$m03q$,
      $m03q$Vistrial replaces the need to diagnose the business$m03q$,
      $m03q$We use technology to solve real business problems, not AI for its own sake$m03q$,
      $m03q$Clients are paying only for the software$m03q$
    ),
    (
      5, 'Deliverables and results', 'medium', 'b',
      $m03q$Which principle is part of the final standard?$m03q$,
      $m03q$We diagnose before prescribing, build systems rather than dependencies, and never confuse deliverables with results. An impressive system that leaves the client's problem unsolved is not a successful delivery. We do not guarantee outcomes that cannot be substantiated.$m03q$,
      $m03q$An impressive system is a success even if the client's problem remains$m03q$,
      $m03q$We never confuse deliverables with results$m03q$,
      $m03q$We guarantee outcomes regardless of implementation$m03q$,
      $m03q$We prescribe before we diagnose$m03q$
    )
  ) as q(n, tag, difficulty, correct, prompt, explanation, opt_a, opt_b, opt_c, opt_d)
  join public.academy_concept c on c.module_id = v_module and c.name = q.tag
  where not exists (
    select 1 from public.academy_question existing
    where existing.module_id = v_module
      and lower(btrim(existing.prompt)) = lower(btrim(q.prompt))
  );

  if exists (
    select 1
    from (values
      ($m03q$What does Divine Acquisition sell?$m03q$, 'b'),
      ($m03q$What are clients actually buying?$m03q$, 'b'),
      ($m03q$A business generates 100 leads a month, but leads are contacted late and follow-ups are neglected. What does the lesson say about increasing advertising spend?$m03q$, 'b'),
      ($m03q$What is Vistrial's place in what we sell?$m03q$, 'c'),
      ($m03q$Which principle is part of the final standard?$m03q$, 'b')
    ) as expected(prompt, answer)
    left join public.academy_question question
      on question.module_id = v_module and question.prompt = expected.prompt
    where question.id is null
       or question.correct_answer is distinct from expected.answer
       or question.active is distinct from true
       or not exists (
         select 1 from public.academy_concept concept
         where concept.id = question.concept_id and concept.lesson_id = v_lesson
       )
  ) then
    raise exception 'the What We Sell quiz did not match the Lesson 03 answer key';
  end if;
end
$m03$;
