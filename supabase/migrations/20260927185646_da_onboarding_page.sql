-- The recipient-facing onboarding page (/o/<token>), rebuilt on the protocol
-- tables.
--
-- va_sales_operator was defined in application code
-- (lib/workspace/onboarding-protocol.ts). Its 17 steps move into
-- da_onboarding_protocol_step here with their wording, order, sections and
-- rules unchanged, and the page reads protocols from the tables only.
--
-- It stays a separate protocol from standard_operator. standard_operator is
-- the three-step start every advanced applicant gets (SOP, tool access,
-- shift window); va_sales_operator is the role-specific intake minted with a
-- Sales Operator placement agreement (identity, shift, bank details,
-- confirmations). They overlap on the shift, but one is not the other.
--
-- Answers are stored per step key, each carrying the step's label as it read
-- when answered, so they stay readable if the wording changes later:
--
--   { "legal_name":  { "kind": "form_question",  "label": "...", "value": "Ana Cruz", "answered_at": "..." },
--     "confirm_accuracy": { "kind": "acknowledgment", "label": "...", "confirmed_at": "..." },
--     "tool_access_granted": { "kind": "credential_handoff", "label": "...", "tools": ["GHL"], "access": "not_received", "at": "..." },
--     "review_sop": { "kind": "material_review", "label": "...", "asset_id": "...", "opened_at": "...", "confirmed_at": "..." } }
--
-- The existing va_sales_operator submission is not touched: its answers,
-- status and times stay as they are.

-- 1. What a step needs to render the existing protocol exactly ----------------

alter table public.da_onboarding_protocol
  add column if not exists intro text,
  add column if not exists next_steps text;

alter table public.da_onboarding_protocol_step
  add column if not exists section_key text,
  add column if not exists section_title text,
  add column if not exists section_intro text,
  add column if not exists input_type text,
  add column if not exists placeholder text,
  add column if not exists choices jsonb,
  add column if not exists show_when jsonb,
  add column if not exists link_url text,
  add column if not exists link_label text,
  add column if not exists prefill text,
  add column if not exists must_match text,
  add column if not exists no_paste boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'da_onboarding_step_input_type_chk') then
    alter table public.da_onboarding_protocol_step
      add constraint da_onboarding_step_input_type_chk check (
        input_type is null
        or (kind = 'form_question'
            and input_type in ('text', 'email', 'phone', 'textarea', 'select', 'single_select'))
      );
    alter table public.da_onboarding_protocol_step
      add constraint da_onboarding_step_choices_chk check (
        (choices is null or input_type in ('select', 'single_select'))
        and (input_type is null or input_type not in ('select', 'single_select')
             or jsonb_typeof(choices) = 'array')
      );
    alter table public.da_onboarding_protocol_step
      add constraint da_onboarding_step_prefill_chk check (
        prefill is null or prefill in ('recipient_name', 'recipient_first_name', 'recipient_email', 'recipient_phone')
      );
    alter table public.da_onboarding_protocol_step
      add constraint da_onboarding_step_link_chk check (link_url is null or link_url ~ '^https://');
  end if;
end
$$;

comment on column public.da_onboarding_protocol_step.show_when is
  'Only shown, and only required, when another step''s answer is one of these values: {"step": "<key>", "values": [...]}.';
comment on column public.da_onboarding_protocol_step.must_match is
  'Key of another form_question this answer must equal, ignoring spaces and dashes (e.g. a re-typed account number).';

-- Which open access issues exist is read straight off the answers.
alter table public.da_onboarding_submission
  add column if not exists has_open_access_issue boolean
    generated always as (jsonb_path_exists(answers, '$.* ? (@.access == "not_received")')) stored;

create index if not exists da_onboarding_submission_open_issue_idx
  on public.da_onboarding_submission (created_at desc)
  where has_open_access_issue;

comment on column public.da_onboarding_submission.has_open_access_issue is
  'True while any credential_handoff step is answered "I didn''t receive access". The worklist of people waiting on tool access.';

-- 2. va_sales_operator, moved from code -----------------------------------------
update public.da_onboarding_protocol
   set name = 'VA Sales Operator Onboarding Protocol',
       intro = 'This form takes about five minutes. Everything here is used to set up your training and your placement, so answer accurately. If something is wrong we will be chasing it on your first day instead of training you.'
 where key = 'va_sales_operator';

insert into public.da_onboarding_protocol_step (
  protocol_key, key, label, kind, help, required, sort_order,
  section_key, section_title, section_intro, input_type, placeholder,
  choices, show_when, link_url, link_label, prefill, must_match, no_paste
) values
  ('va_sales_operator', 'legal_name', 'Legal name, exactly as it appears on your ID', 'form_question', null, true, 10, 'who', 'Section 1 — Who you are', null, 'text', 'Full legal name', null, null, null, null, 'recipient_name', null, false),
  ('va_sales_operator', 'preferred_name', 'Preferred name', 'form_question', 'What we will call you day to day.', true, 20, 'who', 'Section 1 — Who you are', null, 'text', 'Preferred name', null, null, null, null, 'recipient_first_name', null, false),
  ('va_sales_operator', 'email', 'Email address', 'form_question', 'This is where your Drive folder and calendar invites go. Use the one you check.', true, 30, 'who', 'Section 1 — Who you are', null, 'email', null, null, null, null, null, 'recipient_email', null, false),
  ('va_sales_operator', 'whatsapp', 'WhatsApp number, with country code', 'form_question', 'Used for urgent contact only.', true, 40, 'who', 'Section 1 — Who you are', null, 'phone', '+63…', null, null, null, null, 'recipient_phone', null, false),
  ('va_sales_operator', 'discord', 'Discord handle', 'form_question', 'Our team communication runs on Discord. Create an account if you do not have one.', true, 50, 'who', 'Section 1 — Who you are', null, 'text', 'username', null, null, 'https://discord.com/register', 'Create a Discord account', null, null, false),
  ('va_sales_operator', 'city_country', 'City and country', 'form_question', null, true, 60, 'who', 'Section 1 — Who you are', null, 'text', 'Manila, Philippines', null, null, null, null, null, null, false),
  ('va_sales_operator', 'timezone', 'Your timezone', 'form_question', null, true, 70, 'who', 'Section 1 — Who you are', null, 'select', null, '[{"value":"America/New_York","label":"Eastern Time (ET)"},{"value":"America/Chicago","label":"Central Time (CT)"},{"value":"America/Denver","label":"Mountain Time (MT)"},{"value":"America/Los_Angeles","label":"Pacific Time (PT)"},{"value":"America/Toronto","label":"Toronto"},{"value":"America/Sao_Paulo","label":"São Paulo"},{"value":"Europe/London","label":"London (GMT/BST)"},{"value":"Europe/Berlin","label":"Central Europe"},{"value":"Africa/Lagos","label":"Lagos (WAT)"},{"value":"Africa/Johannesburg","label":"Johannesburg (SAST)"},{"value":"Asia/Dubai","label":"Dubai (GST)"},{"value":"Asia/Kolkata","label":"India (IST)"},{"value":"Asia/Manila","label":"Manila (PHT)"},{"value":"Asia/Singapore","label":"Singapore"},{"value":"Asia/Tokyo","label":"Tokyo"},{"value":"Australia/Sydney","label":"Sydney"},{"value":"Pacific/Auckland","label":"Auckland"}]'::jsonb, null, null, null, null, null, false),
  ('va_sales_operator', 'shift', 'Select a shift that aligns with you (shift may change slightly based on the client’s timezone)', 'form_question', null, true, 80, 'shift', 'Section 2 — Your shift', null, 'single_select', null, '[{"value":"9am_530pm_est","label":"9AM – 5:30PM EST"},{"value":"10am_630pm_est","label":"10AM – 6:30PM EST"},{"value":"8am_430pm_est","label":"8AM – 4:30PM EST"}]'::jsonb, null, null, null, null, null, false),
  ('va_sales_operator', 'training_availability', 'Are you available for all five training days?', 'form_question', null, true, 90, 'shift', 'Section 2 — Your shift', null, 'single_select', null, '[{"value":"yes_all_five","label":"Yes, all five days"},{"value":"conflict","label":"No, I have a conflict (explain below)"}]'::jsonb, null, null, null, null, null, false),
  ('va_sales_operator', 'training_conflict', 'If you have a conflict, tell us which day and why', 'form_question', null, false, 100, 'shift', 'Section 2 — Your shift', null, 'textarea', 'Day + reason', null, '{"step":"training_availability","values":["conflict"]}'::jsonb, null, null, null, null, false),
  ('va_sales_operator', 'bank_name', 'Bank name, in full', 'form_question', 'Write the full official name, not an abbreviation.', true, 110, 'bank', 'Section 3 — Bank details', null, 'text', null, null, null, null, null, null, null, false),
  ('va_sales_operator', 'account_number', 'Account number', 'form_question', 'Enter it once, carefully, with no spaces or dashes.', true, 120, 'bank', 'Section 3 — Bank details', null, 'text', null, null, null, null, null, null, null, false),
  ('va_sales_operator', 'account_number_confirm', 'Confirm account number', 'form_question', 'Type it again rather than copying and pasting.', true, 130, 'bank', 'Section 3 — Bank details', null, 'text', null, null, null, null, null, null, 'account_number', true),
  ('va_sales_operator', 'confirm_training_unpaid', 'Training is unpaid. It runs approximately five days. During training I am learning, not working. I will not handle any real customer, and I understand no payment is owed for this time. I am paid from the start date of my first placement.', 'acknowledgment', null, true, 140, 'confirmations', 'Section 4 — Confirmations', 'Tick each to confirm you have read and understood it.', null, null, null, null, null, null, null, null, false),
  ('va_sales_operator', 'confirm_shift_commitment', 'My shift is a commitment. I will be reachable and working the queue for my full scheduled hours. If I cannot make a shift, I will notify Divine Acquisition before it begins, not during or after.', 'acknowledgment', null, true, 150, 'confirmations', 'Section 4 — Confirmations', 'Tick each to confirm you have read and understood it.', null, null, null, null, null, null, null, null, false),
  ('va_sales_operator', 'confirm_agreement_read', 'I have read and signed the Operator Placement Agreement. I understand the response standard, the escalation rules, how commission is earned, and the confidentiality and non-circumvention terms.', 'acknowledgment', null, true, 160, 'confirmations', 'Section 4 — Confirmations', 'Tick each to confirm you have read and understood it.', null, null, null, null, null, null, null, null, false),
  ('va_sales_operator', 'confirm_accuracy', 'Everything I have entered on this form is accurate.', 'acknowledgment', null, true, 170, 'confirmations', 'Section 4 — Confirmations', 'Tick each to confirm you have read and understood it.', null, null, null, null, null, null, null, null, false)
on conflict (protocol_key, key) do nothing;

update public.da_onboarding_protocol
   set next_steps = coalesce(next_steps,
         'Next up is your training. Divine Acquisition will send your training schedule and confirm your shift details by email and on Discord.')
 where recipient_type = 'operator';

update public.da_onboarding_protocol
   set next_steps = coalesce(next_steps,
         'Next up is your kickoff. Divine Acquisition will reach out to schedule it.')
 where recipient_type = 'client';

-- 3. The page -----------------------------------------------------------------

-- Is this step shown, given the answers so far?
create or replace function public.da_onboarding_step_visible(p_show_when jsonb, p_answers jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_show_when is null
      or coalesce(p_answers -> (p_show_when ->> 'step') ->> 'value', '')
         in (select jsonb_array_elements_text(p_show_when -> 'values'));
$$;

-- Is this step's answer complete enough to finish?
create or replace function public.da_onboarding_step_done(p_kind public.da_onboarding_step_kind, p_answer jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_kind
    when 'form_question' then nullif(btrim(coalesce(p_answer ->> 'value', '')), '') is not null
    when 'acknowledgment' then p_answer ? 'confirmed_at'
    -- Answered either way. "Not received" is recorded as an open issue and
    -- does not block finishing.
    when 'credential_handoff' then coalesce(p_answer ->> 'access', '') in ('received', 'not_received')
    when 'material_review' then p_answer ? 'confirmed_at'
  end;
$$;

-- Resolve a token to its submission, or say it is invalid, counting misses
-- against the caller exactly as da_agreement_page() does.
create or replace function public.da_onboarding_resolve(p_token text, p_client text)
returns public.da_onboarding_submission
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_token text := btrim(coalesce(p_token, ''));
  v_client text := app.hash_token(coalesce(nullif(btrim(p_client), ''), 'unknown'));
  v_row public.da_onboarding_submission%rowtype;
begin
  if (select count(*) from public.da_token_probe
       where client_hash = v_client and at > now() - interval '10 minutes') >= 20
     or (select count(*) from public.da_token_probe
          where at > now() - interval '1 minute') >= 300 then
    return null;
  end if;

  if v_token ~ '^[A-Za-z0-9_-]{32,128}$' then
    select * into v_row from public.da_onboarding_submission where access_token = v_token;
    if found then
      return v_row;
    end if;
  end if;

  insert into public.da_token_probe (client_hash) values (v_client);
  return null;
end;
$$;

revoke all on function public.da_onboarding_resolve(text, text) from public, anon, authenticated;

create or replace function public.da_onboarding_page(p_token text, p_client text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.da_onboarding_submission%rowtype;
  v_recipient public.da_recipient%rowtype;
  v_protocol public.da_onboarding_protocol%rowtype;
  v_agreement public.da_agreement%rowtype;
  v_settings public.da_settings%rowtype;
begin
  v_row := public.da_onboarding_resolve(p_token, p_client);
  if v_row.id is null then
    return jsonb_build_object('state', 'invalid');
  end if;

  select * into v_recipient from public.da_recipient where id = v_row.recipient_id;
  select * into v_protocol from public.da_onboarding_protocol where key = v_row.protocol_key;
  select * into v_settings from public.da_settings where id = 1;

  -- First visit only.
  if v_row.opened_at is null then
    update public.da_onboarding_submission
       set opened_at = now()
     where id = v_row.id and opened_at is null
    returning * into v_row;
  end if;

  if v_row.status = 'completed' then
    return jsonb_build_object(
      'state', 'completed',
      'recipient_name', v_recipient.full_name,
      'recipient_type', v_recipient.recipient_type,
      'protocol_name', v_protocol.name,
      'completed_at', v_row.completed_at,
      'next_steps', v_protocol.next_steps,
      'has_open_access_issue', v_row.has_open_access_issue,
      'contact_email', nullif(btrim(coalesce(v_settings.company_email, '')), '')
    );
  end if;

  -- Tied to an agreement that is not signed yet: sign first.
  if v_row.agreement_id is not null then
    select * into v_agreement from public.da_agreement where id = v_row.agreement_id;
    if not found or v_agreement.status <> 'completed' then
      return jsonb_build_object(
        'state', 'sign_first',
        'recipient_name', v_recipient.full_name,
        'protocol_name', v_protocol.name,
        'agreement_token', case
          when v_agreement.status in ('sent', 'viewed')
           and v_agreement.superseded_by_id is null
           and not public.da_signing_link_expired(v_agreement)
          then v_agreement.access_token
        end,
        'contact_email', nullif(btrim(coalesce(v_settings.company_email, '')), '')
      );
    end if;
  end if;

  return jsonb_build_object(
    'state', 'open',
    'recipient_name', v_recipient.full_name,
    'recipient_type', v_recipient.recipient_type,
    'protocol_name', v_protocol.name,
    'protocol_intro', v_protocol.intro,
    'prefill', jsonb_build_object(
      'recipient_name', v_recipient.full_name,
      'recipient_first_name', split_part(btrim(v_recipient.full_name), ' ', 1),
      'recipient_email', v_recipient.email,
      'recipient_phone', v_recipient.phone
    ),
    'answers', v_row.answers,
    'steps', coalesce((
      select jsonb_agg(jsonb_build_object(
               'key', s.key,
               'label', s.label,
               'kind', s.kind,
               'help', s.help,
               'required', s.required,
               'section_key', s.section_key,
               'section_title', s.section_title,
               'section_intro', s.section_intro,
               'input_type', s.input_type,
               'placeholder', s.placeholder,
               'choices', s.choices,
               'show_when', s.show_when,
               'link_url', s.link_url,
               'link_label', s.link_label,
               'prefill', s.prefill,
               'no_paste', s.no_paste,
               'tools', to_jsonb(s.options),
               'asset', case when a.id is null then null else jsonb_build_object(
                 'title', a.title, 'description', a.description, 'url', a.drive_url) end
             ) order by s.sort_order, s.key)
        from public.da_onboarding_protocol_step s
        left join public.internal_asset a on a.id = s.asset_id and a.archived_at is null
       where s.protocol_key = v_row.protocol_key
    ), '[]'::jsonb)
  );
end;
$$;

comment on function public.da_onboarding_page(text, text) is
  'Everything the public /o/<token> page shows for one submission: open, sign_first, completed, or invalid (every failure, identical).';

revoke all on function public.da_onboarding_page(text, text) from public;
grant execute on function public.da_onboarding_page(text, text) to anon, authenticated, service_role;

-- 4. Saving one step ------------------------------------------------------------
--
-- p_input by kind:
--   form_question       {"value": "..."}           ("" clears it)
--   acknowledgment      {"confirmed": true|false}
--   credential_handoff  {"access": "received"|"not_received"}
--   material_review     {"action": "opened"|"confirm"}
-- Credentials are never accepted: a credential_handoff step stores only
-- whether access arrived.

create or replace function public.da_onboarding_save_step(
  p_token text,
  p_step text,
  p_input jsonb,
  p_client text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.da_onboarding_submission%rowtype;
  v_step public.da_onboarding_protocol_step%rowtype;
  v_agreement_status text;
  v_prev jsonb;
  v_answer jsonb;
  v_value text;
  v_other text;
  v_input jsonb := coalesce(p_input, '{}'::jsonb);
begin
  v_row := public.da_onboarding_resolve(p_token, p_client);
  if v_row.id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  select * into v_row from public.da_onboarding_submission where id = v_row.id for update;

  if v_row.status = 'completed' then
    return jsonb_build_object('ok', false, 'error', 'locked',
      'message', 'This onboarding is already finished, so answers are locked.');
  end if;

  if v_row.agreement_id is not null then
    select status into v_agreement_status from public.da_agreement where id = v_row.agreement_id;
    if coalesce(v_agreement_status, '') <> 'completed' then
      return jsonb_build_object('ok', false, 'error', 'sign_first',
        'message', 'Sign your agreement first, then come back here.');
    end if;
  end if;

  select * into v_step
    from public.da_onboarding_protocol_step
   where protocol_key = v_row.protocol_key and key = btrim(coalesce(p_step, ''));
  if not found then
    return jsonb_build_object('ok', false, 'error', 'unknown_step');
  end if;

  v_prev := v_row.answers -> v_step.key;
  if jsonb_typeof(v_prev) <> 'object' then
    v_prev := null;
  end if;

  if v_step.kind = 'form_question' then
    v_value := btrim(coalesce(v_input ->> 'value', ''));

    if v_value = '' then
      update public.da_onboarding_submission set answers = answers - v_step.key where id = v_row.id;
      return jsonb_build_object('ok', true, 'step', v_step.key, 'answer', null);
    end if;

    if length(v_value) > (case when v_step.input_type = 'textarea' then 5000 else 500 end) then
      return jsonb_build_object('ok', false, 'error', 'too_long', 'step', v_step.key,
        'message', 'That answer is too long.');
    end if;
    if v_step.input_type = 'email' and v_value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      return jsonb_build_object('ok', false, 'error', 'invalid_value', 'step', v_step.key,
        'message', 'Enter a valid email address.');
    end if;
    if v_step.input_type = 'phone' and v_value !~ '^\+?[0-9 ()./-]{6,40}$' then
      return jsonb_build_object('ok', false, 'error', 'invalid_value', 'step', v_step.key,
        'message', 'Enter a phone number with digits only, including the country code.');
    end if;
    if v_step.input_type in ('select', 'single_select')
       and not exists (select 1 from jsonb_array_elements(v_step.choices) c where c ->> 'value' = v_value) then
      return jsonb_build_object('ok', false, 'error', 'invalid_value', 'step', v_step.key,
        'message', 'Pick one of the options.');
    end if;
    if v_step.must_match is not null then
      v_other := v_row.answers -> v_step.must_match ->> 'value';
      if v_other is not null
         and regexp_replace(v_other, '[[:space:]-]', '', 'g') <> regexp_replace(v_value, '[[:space:]-]', '', 'g') then
        return jsonb_build_object('ok', false, 'error', 'mismatch', 'step', v_step.key,
          'message', 'These don''t match. Type it again carefully.');
      end if;
    end if;

    v_answer := jsonb_build_object('kind', v_step.kind, 'label', v_step.label,
      'value', v_value, 'answered_at', now());

  elsif v_step.kind = 'acknowledgment' then
    if coalesce((v_input ->> 'confirmed')::boolean, false) is not true then
      update public.da_onboarding_submission set answers = answers - v_step.key where id = v_row.id;
      return jsonb_build_object('ok', true, 'step', v_step.key, 'answer', null);
    end if;
    v_answer := jsonb_build_object('kind', v_step.kind, 'label', v_step.label,
      'confirmed_at', coalesce(v_prev -> 'confirmed_at', to_jsonb(now())));

  elsif v_step.kind = 'credential_handoff' then
    if coalesce(v_input ->> 'access', '') not in ('received', 'not_received') then
      return jsonb_build_object('ok', false, 'error', 'invalid_value', 'step', v_step.key);
    end if;
    v_answer := jsonb_build_object('kind', v_step.kind, 'label', v_step.label,
      'tools', to_jsonb(v_step.options), 'access', v_input ->> 'access', 'at', now());

  elsif v_step.kind = 'material_review' then
    if v_input ->> 'action' = 'opened' then
      v_answer := coalesce(v_prev, '{}'::jsonb)
        || jsonb_build_object('kind', v_step.kind, 'label', v_step.label, 'asset_id', v_step.asset_id,
             'opened_at', coalesce(v_prev -> 'opened_at', to_jsonb(now())));
    elsif v_input ->> 'action' = 'confirm' then
      if v_prev is null or not (v_prev ? 'opened_at') then
        return jsonb_build_object('ok', false, 'error', 'not_opened', 'step', v_step.key,
          'message', 'Open the material first, then confirm you reviewed it.');
      end if;
      v_answer := v_prev || jsonb_build_object('label', v_step.label,
        'confirmed_at', coalesce(v_prev -> 'confirmed_at', to_jsonb(now())));
    else
      return jsonb_build_object('ok', false, 'error', 'invalid_value', 'step', v_step.key);
    end if;
  end if;

  update public.da_onboarding_submission
     set answers = jsonb_set(answers, array[v_step.key], v_answer, true)
   where id = v_row.id;

  return jsonb_build_object('ok', true, 'step', v_step.key, 'answer', v_answer);
end;
$$;

revoke all on function public.da_onboarding_save_step(text, text, jsonb, text) from public;
grant execute on function public.da_onboarding_save_step(text, text, jsonb, text) to anon, authenticated, service_role;

-- 5. Finishing ------------------------------------------------------------------
--
-- The required-step check lives here, so it cannot be skipped by calling this
-- directly. A second call on a finished submission returns the same result
-- and changes nothing.

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

  return jsonb_build_object('ok', true, 'completed_at', v_row.completed_at);
end;
$$;

revoke all on function public.da_onboarding_finish(text, text) from public;
grant execute on function public.da_onboarding_finish(text, text) to anon, authenticated, service_role;

-- The old door completed a submission with whatever answers it was handed,
-- checking nothing. The page no longer uses it; nobody else may.
revoke all on function public.da_submit_onboarding(text, jsonb) from public, anon, authenticated;
grant execute on function public.da_submit_onboarding(text, jsonb) to service_role;
