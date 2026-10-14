-- When an operator finishes onboarding, open their profile and send them to
-- the Academy.
--
-- The profile is a case file (record_kind = 'operator'), one per operator. It
-- is not a client engagement: it does not take a placement, it is left out of
-- the client health roll-up, and it is not a seat leads can be routed to.
-- End-of-day reports stay on the placement they were filed against. The
-- profile collects every report for this operator, including reports filed
-- later on a client placement, because the case file points at the operator.
-- The numbers on those reports are the metrics they log.
--
-- Bank account numbers stay on the onboarding submission. They are not copied
-- onto the operator or the case file.

alter table public.client_case_file
  add column if not exists record_kind text not null default 'client',
  add column if not exists operator_id uuid references public.operator (id) on delete cascade;

alter table public.client_case_file
  drop constraint if exists client_case_file_record_kind_chk;
alter table public.client_case_file
  add constraint client_case_file_record_kind_chk
  check (record_kind in ('client', 'operator'));

alter table public.client_case_file
  drop constraint if exists client_case_file_operator_profile_chk;
alter table public.client_case_file
  add constraint client_case_file_operator_profile_chk
  check (
    (record_kind = 'operator' and operator_id is not null)
    or (record_kind = 'client' and operator_id is null)
  );

create unique index if not exists client_case_file_one_operator_profile
  on public.client_case_file (operator_id)
  where record_kind = 'operator';

comment on column public.client_case_file.record_kind is
  'client is an engagement. operator is the sales operator''s own profile, opened when they finish onboarding.';
comment on column public.client_case_file.operator_id is
  'Set only on an operator profile. Every end-of-day report for this operator belongs to the profile, including reports filed on a client placement.';

alter table public.da_onboarding_submission
  add column if not exists case_file_id uuid references public.client_case_file (id) on delete set null;

comment on column public.da_onboarding_submission.case_file_id is
  'The operator profile opened when this onboarding was finished. Null for a client, and until an operator finishes.';

create index if not exists da_onboarding_submission_case_file_idx
  on public.da_onboarding_submission (case_file_id)
  where case_file_id is not null;

-- Client health stays a client list. An operator profile is not an engagement
-- missing a baseline.
create or replace view public.v_case_file_health
with (security_invoker = true)
as
with baseline as (
  select case_file_id, id, locked_at from public.snapshot where kind = 'baseline'
),
latest as (
  select distinct on (case_file_id) case_file_id, id, taken_at, period_end
  from public.snapshot where kind = 'progress'
  order by case_file_id, coalesce(period_end, taken_at::date) desc, taken_at desc
),
headline as (
  select b.case_file_id, bm.value as baseline_revenue, lm.value as current_revenue
  from baseline b
  left join latest l on l.case_file_id = b.case_file_id
  left join public.snapshot_metric bm on bm.snapshot_id = b.id and bm.metric_key = 'monthly_revenue'
  left join public.snapshot_metric lm on lm.snapshot_id = l.id and lm.metric_key = 'monthly_revenue'
)
select cf.id,
       cf.name,
       cf.slug,
       cf.vertical,
       cf.status,
       cf.engagement_start,
       cf.install_started_at,
       (b.id is not null) as has_baseline,
       (b.locked_at is not null) as baseline_locked,
       l.taken_at as last_snapshot_at,
       l.period_end as last_period_end,
       case when l.period_end is null then null else (current_date - l.period_end) end as days_since_snapshot,
       (b.locked_at is not null and (l.period_end is null or l.period_end < current_date - 8)) as snapshot_overdue,
       h.baseline_revenue,
       h.current_revenue,
       case
         when h.baseline_revenue is null or h.current_revenue is null then null
         when h.baseline_revenue = 0 then null
         else round(((h.current_revenue - h.baseline_revenue) / abs(h.baseline_revenue)) * 100, 1)
       end as headline_revenue_change_pct,
       (select count(*) from public.evidence_item e where e.case_file_id = cf.id) as evidence_count,
       (select count(*) from public.evidence_item e where e.case_file_id = cf.id and e.needs_metadata) as evidence_needing_metadata,
       (select count(*) from public.effort_entry ee where ee.case_file_id = cf.id and ee.superseded_by_id is null) as effort_entry_count,
       (select count(*) from public.milestone m where m.case_file_id = cf.id) as milestone_count,
       (select count(*) from public.scope_request sr where sr.case_file_id = cf.id and sr.verdict = 'out_of_scope') as out_of_scope_count,
       (select count(*) from public.client_message cm where cm.case_file_id = cf.id and cm.status = 'open') as open_client_messages,
       (select count(*) from public.invoice i where i.case_file_id = cf.id and i.status in ('failed', 'overdue')) as failing_invoices
from public.client_case_file cf
left join baseline b on b.case_file_id = cf.id
left join latest l on l.case_file_id = cf.id
left join headline h on h.case_file_id = cf.id
where app.is_admin()
  and cf.record_kind = 'client';

-- The screen they see after the form. Both operator protocols use it.
update public.da_onboarding_protocol
   set next_steps = 'You are enrolled in the DA Operator Academy. Open it next and start there. Your profile is open: every end-of-day report you file, and the metrics you log, are kept on that case file.'
 where recipient_type = 'operator';

create or replace function app.onboarding_answer(p_answers jsonb, p_key text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(btrim(coalesce(p_answers -> p_key ->> 'value', '')), '');
$$;

revoke all on function app.onboarding_answer(jsonb, text) from public, anon, authenticated;

-- Opens the operator account (when they do not have one yet), the profile
-- case file, and the Academy enrollment. Safe to call again: a second finish
-- does not open a second profile or a second enrollment.
create or replace function app.provision_onboarded_operator(p_submission_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_submission public.da_onboarding_submission%rowtype;
  v_recipient public.da_recipient%rowtype;
  v_operator public.operator%rowtype;
  v_email text;
  v_name text;
  v_legal text;
  v_phone text;
  v_handle text;
  v_country text;
  v_zone text;
  v_shift text;
  v_shift_label text;
  v_contact_email text;
  v_profile uuid;
  v_user_id uuid;
  v_created_user boolean := false;
  v_case uuid;
  v_slug text;
  v_base text;
  v_suffix integer := 0;
  v_notes text;
  v_program uuid;
  v_channel text;
  v_definition text;
begin
  select * into v_submission from public.da_onboarding_submission where id = p_submission_id;
  if v_submission.id is null then
    return null;
  end if;

  select * into v_recipient from public.da_recipient where id = v_submission.recipient_id;
  if v_recipient.id is null or v_recipient.recipient_type <> 'operator' then
    return null;
  end if;

  v_email := lower(btrim(v_recipient.email));
  v_legal := app.onboarding_answer(v_submission.answers, 'legal_name');
  v_name := coalesce(
    app.onboarding_answer(v_submission.answers, 'preferred_name'),
    v_legal,
    nullif(btrim(v_recipient.full_name), '')
  );
  v_name := left(coalesce(v_name, 'Sales operator'), 200);
  v_phone := left(app.onboarding_answer(v_submission.answers, 'whatsapp'), 40);
  v_handle := nullif(ltrim(coalesce(app.onboarding_answer(v_submission.answers, 'discord'), ''), '@'), '');
  v_handle := left(v_handle, 80);
  v_country := left(app.onboarding_answer(v_submission.answers, 'city_country'), 120);
  v_zone := app.onboarding_answer(v_submission.answers, 'timezone');
  if v_zone is null or v_zone !~ '^[A-Za-z]+(?:/[A-Za-z0-9_+-]+)+$' then
    v_zone := null;
  end if;
  v_shift := app.onboarding_answer(v_submission.answers, 'shift');
  v_contact_email := app.onboarding_answer(v_submission.answers, 'email');
  if v_contact_email is null or position('@' in v_contact_email) < 2 then
    v_contact_email := v_recipient.email;
  end if;

  if v_recipient.operator_id is not null then
    select * into v_operator from public.operator where id = v_recipient.operator_id;
  end if;

  if v_operator.id is null then
    select * into v_operator
      from public.operator
     where lower(btrim(email)) = v_email
     order by created_at
     limit 1;
  end if;

  if v_operator.profile_id is not null then
    v_profile := v_operator.profile_id;
  else
    select p.id into v_profile
      from public.profile p
     where lower(btrim(p.email)) = v_email
     order by p.created_at
     limit 1;
  end if;

  if v_operator.id is null and v_profile is not null then
    select * into v_operator from public.operator where profile_id = v_profile;
  end if;

  if v_profile is null then
    if not exists (
      select 1 from public.account_invite i
       where lower(i.email) = v_email
         and i.accepted_at is null
         and i.cancelled_at is null
         and i.expires_at > now()
    ) then
      -- A live invite keeps handle_new_user from raising an uninvited-signup
      -- alert. The person was brought in by onboarding, not a public signup.
      insert into public.account_invite (email, full_name, role, scope_kind, token_hash, expires_at)
      values (
        v_email,
        v_name,
        'operator',
        'placements',
        encode(extensions.digest(extensions.gen_random_uuid()::text, 'sha256'), 'hex'),
        now() + interval '7 days'
      );
    end if;

    select u.id into v_user_id
      from auth.users u
     where lower(u.email::text) = v_email
     limit 1;

    if v_user_id is null then
      v_user_id := extensions.gen_random_uuid();
      -- profile.id references auth.users. Hosted auth has columns the local
      -- verify shim does not, so the insert follows whichever shape is present.
      if exists (
        select 1
        from information_schema.columns
        where table_schema = 'auth'
          and table_name = 'users'
          and column_name = 'aud'
      ) then
        insert into auth.users (
          id, instance_id, aud, role, email,
          raw_app_meta_data, raw_user_meta_data, created_at, updated_at
        ) values (
          v_user_id,
          (select u.instance_id from auth.users u limit 1),
          'authenticated',
          'authenticated',
          v_email,
          '{"provider":"email","providers":["email"]}'::jsonb,
          jsonb_build_object('full_name', v_name),
          now(),
          now()
        );
      else
        insert into auth.users (
          id, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at
        ) values (
          v_user_id,
          v_email,
          jsonb_build_object('full_name', v_name),
          '{"provider":"email","providers":["email"]}'::jsonb,
          now(),
          now()
        );
      end if;
      v_created_user := true;
    end if;

    select p.id into v_profile from public.profile p where p.id = v_user_id;
    if v_profile is null then
      insert into public.profile (id, email, full_name, role, state)
      values (v_user_id, v_email, v_name, 'operator', 'active')
      returning id into v_profile;
    end if;
  end if;

  if v_profile is null then
    raise exception 'operator_profile_missing: onboarding could not open an account for %', v_email
      using errcode = 'P0002';
  end if;

  if v_created_user then
    update public.account_invite
       set accepted_at = now(),
           accepted_profile_id = v_profile
     where lower(email) = v_email
       and accepted_at is null
       and cancelled_at is null;
  end if;

  -- A pending operator can sign in and reach the Academy. A suspended account
  -- stays suspended.
  update public.profile
     set state = 'active',
         full_name = coalesce(full_name, v_name)
   where id = v_profile
     and role = 'operator'
     and state = 'pending';

  if v_zone is not null then
    update public.profile
       set time_zone = v_zone
     where id = v_profile
       and time_zone is null;
  end if;

  if v_operator.id is null then
    insert into public.operator (
      profile_id, name, email, phone, handle, country, time_zone, status, joined_on
    ) values (
      v_profile,
      v_name,
      v_email,
      v_phone,
      v_handle,
      v_country,
      coalesce(v_zone, 'UTC'),
      'in_training',
      current_date
    )
    returning * into v_operator;
  else
    update public.operator
       set name = v_name,
           phone = coalesce(v_phone, phone),
           handle = coalesce(v_handle, handle),
           country = coalesce(v_country, country),
           time_zone = coalesce(v_zone, time_zone),
           status = case when status = 'applicant' then 'in_training'::public.operator_status else status end,
           joined_on = coalesce(joined_on, current_date),
           profile_id = case
             when profile_id is not null then profile_id
             when not exists (
               select 1 from public.operator other
                where other.profile_id = v_profile
                  and other.id <> v_operator.id
             ) then v_profile
             else profile_id
           end
     where id = v_operator.id
    returning * into v_operator;
  end if;

  if v_recipient.operator_id is null
     and not exists (
       select 1 from public.da_recipient d
        where d.operator_id = v_operator.id
          and d.id <> v_recipient.id
     )
  then
    update public.da_recipient
       set operator_id = v_operator.id
     where id = v_recipient.id;
  end if;

  if v_phone is not null then
    update public.da_recipient
       set phone = v_phone
     where id = v_recipient.id
       and (phone is null or btrim(phone) = '');
  end if;

  select id into v_case
    from public.client_case_file
   where operator_id = v_operator.id
     and record_kind = 'operator';

  if v_case is null then
    v_slug := 'operator-' || trim(both '-' from regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'));
    if v_slug is null or v_slug = 'operator-' then
      v_slug := 'operator-' || substr(replace(v_operator.id::text, '-', ''), 1, 12);
    end if;
    v_base := v_slug;
    while exists (select 1 from public.client_case_file where slug = v_slug) loop
      v_suffix := v_suffix + 1;
      v_slug := v_base || '-' || v_suffix;
    end loop;

    if v_shift is not null then
      select c.label into v_shift_label
        from public.da_onboarding_protocol_step s
        cross join lateral jsonb_to_recordset(coalesce(s.choices, '[]'::jsonb)) as c(value text, label text)
       where s.protocol_key = v_submission.protocol_key
         and s.key = 'shift'
         and c.value = v_shift
       limit 1;
    end if;

    v_notes := 'Sales operator profile. Every end-of-day report this operator files, and the metrics they log, are kept on this case file.';
    if v_legal is not null and v_legal is distinct from v_name then
      v_notes := v_notes || E'\nLegal name: ' || v_legal;
    end if;
    if v_country is not null then
      v_notes := v_notes || E'\nCity and country: ' || v_country;
    end if;
    if coalesce(v_shift_label, v_shift) is not null then
      v_notes := v_notes || E'\nShift: ' || coalesce(v_shift_label, v_shift);
    end if;

    v_channel := case
      when v_handle is not null then 'Discord'
      when v_phone is not null then 'WhatsApp'
      else null
    end;

    select t.suggested_qualified_booking into v_definition
      from public.industry_template t
     where t.key = 'generic';

    insert into public.client_case_file (
      name, slug, vertical, contact_name, contact_email, status, engagement_start,
      notes, industry_key, qualified_booking_definition, contact_role, contact_channel,
      record_kind, operator_id
    ) values (
      v_name,
      v_slug,
      'Sales operator',
      v_name,
      v_contact_email,
      'active',
      current_date,
      v_notes,
      'generic',
      v_definition,
      'Sales operator',
      v_channel,
      'operator',
      v_operator.id
    )
    returning id into v_case;
  end if;

  update public.da_onboarding_submission
     set case_file_id = v_case
   where id = v_submission.id
     and case_file_id is distinct from v_case;

  select id into v_program from public.academy_program where slug = 'da-operator-academy';
  if v_program is null then
    raise exception 'academy_missing: DA Operator Academy is not configured' using errcode = 'P0002';
  end if;

  insert into public.academy_enrollment (
    profile_id, program_id, operator_id, agreement_id, track, start_date, status
  ) values (
    v_profile,
    v_program,
    v_operator.id,
    v_submission.agreement_id,
    'Core',
    current_date,
    'active'
  )
  on conflict (profile_id, program_id) do update
    set status = 'active',
        operator_id = coalesce(public.academy_enrollment.operator_id, excluded.operator_id),
        agreement_id = coalesce(public.academy_enrollment.agreement_id, excluded.agreement_id),
        start_date = coalesce(public.academy_enrollment.start_date, excluded.start_date)
  where public.academy_enrollment.status = 'invited';

  return v_case;
end;
$$;

comment on function app.provision_onboarded_operator(uuid) is
  'After operator onboarding is finished: one profile case file, Academy enrollment, and in-training status when they were still an applicant. Does nothing for a client. Safe to repeat.';

revoke all on function app.provision_onboarded_operator(uuid) from public, anon, authenticated;

create or replace function public.da_onboarding_finish(p_token text, p_client text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.da_onboarding_submission%rowtype;
  v_agreement_status text;
  v_missing record;
  v_a text;
  v_b text;
begin
  v_row := public.da_onboarding_resolve(p_token, p_client);
  if v_row.id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  select * into v_row from public.da_onboarding_submission where id = v_row.id for update;

  if v_row.status = 'completed' then
    perform app.provision_onboarded_operator(v_row.id);
    return jsonb_build_object('ok', true, 'completed_at', v_row.completed_at);
  end if;

  if v_row.agreement_id is not null then
    select status into v_agreement_status from public.da_agreement where id = v_row.agreement_id;
    if coalesce(v_agreement_status, '') <> 'completed' then
      return jsonb_build_object('ok', false, 'error', 'sign_first',
        'message', 'Sign your agreement first, then come back here.');
    end if;
  end if;

  select s.key, s.label into v_missing
    from public.da_onboarding_protocol_step s
   where s.protocol_key = v_row.protocol_key
     and s.required
     and public.da_onboarding_step_visible(s.show_when, v_row.answers)
     and not coalesce(public.da_onboarding_step_done(s.kind, v_row.answers -> s.key), false)
   order by s.sort_order, s.key
   limit 1;

  if found then
    return jsonb_build_object('ok', false, 'error', 'missing', 'step', v_missing.key,
      'message', 'This one still needs an answer.');
  end if;

  for v_missing in
    select s.key, s.must_match
      from public.da_onboarding_protocol_step s
     where s.protocol_key = v_row.protocol_key and s.must_match is not null
  loop
    v_a := regexp_replace(coalesce(v_row.answers -> v_missing.key ->> 'value', ''), '[[:space:]-]', '', 'g');
    v_b := regexp_replace(coalesce(v_row.answers -> v_missing.must_match ->> 'value', ''), '[[:space:]-]', '', 'g');
    if v_a <> v_b then
      return jsonb_build_object('ok', false, 'error', 'mismatch', 'step', v_missing.key,
        'message', 'These don''t match. Type it again carefully.');
    end if;
  end loop;

  update public.da_onboarding_submission
     set status = 'completed',
         completed_at = coalesce(completed_at, now())
   where id = v_row.id
  returning * into v_row;

  perform app.provision_onboarded_operator(v_row.id);

  return jsonb_build_object('ok', true, 'completed_at', v_row.completed_at);
end;
$$;

comment on function public.da_onboarding_finish(text, text) is
  'Finishes onboarding once every required step is answered. An operator is enrolled in the Academy and given one profile case file. A second call keeps that result.';

revoke all on function public.da_onboarding_finish(text, text) from public;
grant execute on function public.da_onboarding_finish(text, text) to anon, authenticated, service_role;

-- Operators who already finished, before this existed.
do $$
declare
  r record;
begin
  for r in
    select s.id
      from public.da_onboarding_submission s
      join public.da_recipient d on d.id = s.recipient_id
     where s.status = 'completed'
       and d.recipient_type = 'operator'
  loop
    perform app.provision_onboarded_operator(r.id);
  end loop;
end
$$;
