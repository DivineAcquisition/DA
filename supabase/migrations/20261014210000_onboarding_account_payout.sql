-- Sales-operator onboarding collects a Divine Acquisition login, payout
-- details, equipment, Apploye, availability, and experience.
--
-- The password is stored only as a bcrypt hash, on the login and on
-- app.onboarding_credential. Payout details are stored on that same private
-- row while the form is open, then copied onto operator.payout_method and
-- operator.payout_reference when onboarding finishes. That is the payout
-- record the portal already uses. The full reference is never written to
-- onboarding answers, the case file, or any Academy table. Answers keep the
-- method and the last four characters only.

-- 1. Step kinds the page can render ------------------------------------------------

alter table public.da_onboarding_protocol_step
  drop constraint if exists da_onboarding_step_input_type_chk;
alter table public.da_onboarding_protocol_step
  drop constraint if exists da_onboarding_step_choices_chk;

alter table public.da_onboarding_protocol_step
  add constraint da_onboarding_step_input_type_chk check (
    input_type is null
    or (kind = 'form_question'
        and input_type in (
          'text', 'email', 'phone', 'textarea', 'select', 'single_select',
          'da_login', 'password', 'payout', 'multi_select', 'schedule'
        ))
  );

alter table public.da_onboarding_protocol_step
  add constraint da_onboarding_step_choices_chk check (
    (choices is null or input_type in ('select', 'single_select', 'multi_select', 'payout'))
    and (input_type is null or input_type not in ('select', 'single_select', 'multi_select')
         or jsonb_typeof(choices) = 'array')
  );

-- 2. Private credential row ---------------------------------------------------------
-- Not an Academy table. Anon cannot read it. The public save function, which
-- runs as the owner, is the only writer.

create table app.onboarding_credential (
  submission_id uuid primary key references public.da_onboarding_submission (id) on delete cascade,
  login_email text,
  password_hash text,
  payout_method text,
  payout_reference text,
  updated_at timestamptz not null default now(),
  constraint onboarding_credential_login_chk check (
    login_email is null or login_email ~ '^[^@[:space:]]+@divineacquisition\.io$'
  ),
  constraint onboarding_credential_hash_chk check (
    password_hash is null or password_hash ~ '^[$]2[aby][$]'
  ),
  constraint onboarding_credential_payout_chk check (
    payout_method is null or payout_method in ('wise', 'remitly')
  ),
  constraint onboarding_credential_payout_pair_chk check (
    (payout_method is null and payout_reference is null)
    or (payout_method is not null and payout_reference is not null)
  )
);

create unique index onboarding_credential_login_idx
  on app.onboarding_credential (lower(login_email))
  where login_email is not null;

comment on table app.onboarding_credential is
  'Divine Acquisition login hash and payout destination for an open onboarding. Not an Academy table. The password is a hash. The payout reference is copied onto the operator at finish and is not written to onboarding answers.';

revoke all on table app.onboarding_credential from public, anon, authenticated, service_role;
alter table app.onboarding_credential enable row level security;

-- 3. Helpers ------------------------------------------------------------------------

create or replace function app.normalize_da_login(p_value text)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text := lower(btrim(coalesce(p_value, '')));
  v_local text;
begin
  if v = '' then
    return jsonb_build_object('ok', false, 'message', 'Choose a username.');
  end if;
  if position('@' in v) > 0 then
    if split_part(v, '@', 2) <> 'divineacquisition.io' or split_part(v, '@', 3) <> '' then
      return jsonb_build_object(
        'ok', false,
        'message', 'Use a username on divineacquisition.io. That is the part before the @.'
      );
    end if;
    v := split_part(v, '@', 1);
  end if;
  v_local := v;
  if v_local !~ '^[a-z0-9][a-z0-9._-]{1,30}[a-z0-9]$' or v_local ~ '[._-]{2}' then
    return jsonb_build_object(
      'ok', false,
      'message', 'Use 3 to 32 characters: letters, numbers, and single dots, underscores, or hyphens.'
    );
  end if;
  if v_local = any (array[
    'admin', 'administrator', 'support', 'help', 'info', 'root', 'owner', 'payroll',
    'billing', 'security', 'postmaster', 'abuse', 'noreply', 'no-reply', 'team',
    'ops', 'academy', 'staff', 'divine', 'divineacquisition'
  ]) then
    return jsonb_build_object('ok', false, 'message', 'Choose a different username.');
  end if;
  return jsonb_build_object('ok', true, 'email', v_local || '@divineacquisition.io', 'local', v_local);
end;
$$;

revoke all on function app.normalize_da_login(text) from public, anon, authenticated;

create or replace function app.da_login_taken(p_email text, p_submission uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
           select 1
             from public.operator o
            where lower(btrim(o.email)) = p_email
              and o.id is distinct from (
                select d.operator_id
                  from public.da_onboarding_submission s
                  join public.da_recipient d on d.id = s.recipient_id
                 where s.id = p_submission
              )
         )
      or exists (
           select 1
             from public.profile p
            where lower(btrim(p.email)) = p_email
              and p.id is distinct from (
                select o.profile_id
                  from public.da_onboarding_submission s
                  join public.da_recipient d on d.id = s.recipient_id
                  join public.operator o on o.id = d.operator_id
                 where s.id = p_submission
              )
         )
      or exists (
           select 1
             from auth.users u
            where lower(u.email::text) = p_email
              and u.id is distinct from (
                select o.profile_id
                  from public.da_onboarding_submission s
                  join public.da_recipient d on d.id = s.recipient_id
                  join public.operator o on o.id = d.operator_id
                 where s.id = p_submission
              )
         )
      or exists (
           select 1
             from app.onboarding_credential c
            where lower(c.login_email) = p_email
              and c.submission_id <> p_submission
         );
$$;

revoke all on function app.da_login_taken(text, uuid) from public, anon, authenticated;

create or replace function app.payout_last4(p_reference text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when length(right(regexp_replace(coalesce(p_reference, ''), '\D', '', 'g'), 4)) = 4
      then right(regexp_replace(p_reference, '\D', '', 'g'), 4)
    else right(coalesce(p_reference, ''), 4)
  end;
$$;

revoke all on function app.payout_last4(text) from public, anon, authenticated;

create or replace function app.compose_onboarding_payout(p_input jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v jsonb := coalesce(p_input, '{}'::jsonb);
  v_method text := lower(btrim(coalesce(v ->> 'method', '')));
  v_name text;
  v_email text;
  v_currency text;
  v_country text;
  v_phone text;
  v_delivery text;
  v_bank text;
  v_account text;
  v_city text;
  v_provider text;
  v_wallet text;
  v_ref text;
begin
  if v_method not in ('wise', 'remitly') then
    return jsonb_build_object('ok', false, 'message', 'Choose Wise or Remitly.');
  end if;

  if v_method = 'wise' then
    v_email := lower(btrim(coalesce(v ->> 'wise_email', '')));
    v_name := btrim(coalesce(v ->> 'wise_name', ''));
    v_currency := upper(btrim(coalesce(v ->> 'currency', '')));
    if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(v_email) > 120 then
      return jsonb_build_object('ok', false, 'message', 'Enter the email on the Wise account.');
    end if;
    if length(v_name) not between 2 and 80 or v_name ~ '[[:cntrl:]|]' then
      return jsonb_build_object('ok', false, 'message', 'Enter the legal name on the Wise account.');
    end if;
    if v_currency not in ('USD', 'EUR', 'GBP', 'CAD', 'AUD', 'PHP', 'INR', 'MXN') then
      return jsonb_build_object('ok', false, 'message', 'Choose the currency you receive in Wise.');
    end if;
    v_ref := 'wise|' || v_currency || '|' || v_name || '|' || v_email;
  else
    v_name := btrim(coalesce(v ->> 'legal_name', ''));
    v_country := btrim(coalesce(v ->> 'country', ''));
    v_phone := btrim(coalesce(v ->> 'phone', ''));
    v_delivery := lower(btrim(coalesce(v ->> 'delivery', '')));
    if length(v_name) not between 2 and 80 or v_name ~ '[[:cntrl:]|]' then
      return jsonb_build_object('ok', false, 'message', 'Enter the legal name on the recipient ID.');
    end if;
    if length(v_country) not between 2 and 60 or v_country ~ '[[:cntrl:]|]' then
      return jsonb_build_object('ok', false, 'message', 'Enter the country Remitly should send to.');
    end if;
    if v_phone !~ '^\+?[0-9 ()./-]{6,40}$' then
      return jsonb_build_object('ok', false, 'message', 'Enter the mobile number Remitly should use, with the country code.');
    end if;
    if v_delivery = 'bank' then
      v_bank := btrim(coalesce(v ->> 'bank_name', ''));
      v_account := regexp_replace(coalesce(v ->> 'account_number', ''), '[^0-9]', '', 'g');
      if length(v_bank) not between 2 and 80 or v_bank ~ '[[:cntrl:]|]' then
        return jsonb_build_object('ok', false, 'message', 'Enter the bank name for the Remitly deposit.');
      end if;
      if v_account !~ '^[0-9]{4,34}$' then
        return jsonb_build_object('ok', false, 'message', 'Enter the bank account number, digits only.');
      end if;
      v_ref := 'remitly|bank|' || v_country || '|' || v_name || '|' || v_phone || '|' || v_bank || '|' || v_account;
    elsif v_delivery = 'cash' then
      v_city := btrim(coalesce(v ->> 'city', ''));
      if length(v_city) not between 2 and 80 or v_city ~ '[[:cntrl:]|]' then
        return jsonb_build_object('ok', false, 'message', 'Enter the city where the cash can be picked up.');
      end if;
      v_ref := 'remitly|cash|' || v_country || '|' || v_name || '|' || v_phone || '|' || v_city;
    elsif v_delivery = 'wallet' then
      v_provider := btrim(coalesce(v ->> 'wallet_provider', ''));
      v_wallet := btrim(coalesce(v ->> 'wallet_phone', ''));
      if length(v_provider) not between 2 and 40 or v_provider ~ '[[:cntrl:]|]' then
        return jsonb_build_object('ok', false, 'message', 'Enter the mobile wallet provider, such as GCash.');
      end if;
      if v_wallet !~ '^\+?[0-9 ()./-]{6,40}$' then
        return jsonb_build_object('ok', false, 'message', 'Enter the mobile number on that wallet.');
      end if;
      v_ref := 'remitly|wallet|' || v_country || '|' || v_name || '|' || v_phone || '|' || v_provider || '|' || v_wallet;
    else
      return jsonb_build_object('ok', false, 'message', 'Choose how Remitly should deliver the money.');
    end if;
  end if;

  if length(v_ref) > 200 then
    return jsonb_build_object('ok', false, 'message', 'Those payout details are too long. Shorten the name or bank.');
  end if;
  return jsonb_build_object('ok', true, 'method', v_method, 'reference', v_ref);
end;
$$;

revoke all on function app.compose_onboarding_payout(jsonb) from public, anon, authenticated;

create or replace function app.check_onboarding_schedule(p_weekly text, p_value text)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v jsonb;
  v_day jsonb;
  v_seen text[] := '{}';
  v_day_name text;
  v_start integer;
  v_end integer;
  v_dur integer;
  v_allowed integer[];
  v_count integer := 0;
begin
  if p_weekly = 'part_time_4_5' then
    v_allowed := array[4, 5];
  elsif p_weekly = 'full_time_6_8' then
    v_allowed := array[6, 7, 8];
  else
    return jsonb_build_object('ok', false, 'message', 'Choose part time or full time first.');
  end if;

  begin
    v := p_value::jsonb;
  exception when others then
    return jsonb_build_object('ok', false, 'message', 'Pick the days and hours you can work.');
  end;

  if jsonb_typeof(v) is distinct from 'object' or jsonb_typeof(v -> 'days') is distinct from 'array' then
    return jsonb_build_object('ok', false, 'message', 'Pick the days and hours you can work.');
  end if;

  for v_day in select value from jsonb_array_elements(v -> 'days')
  loop
    v_count := v_count + 1;
    v_day_name := coalesce(v_day ->> 'day', '');
    if v_day_name not in ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun') then
      return jsonb_build_object('ok', false, 'message', 'Pick a real day of the week.');
    end if;
    if v_day_name = any (v_seen) then
      return jsonb_build_object('ok', false, 'message', 'Each day only needs one block of hours.');
    end if;
    v_seen := array_append(v_seen, v_day_name);
    if coalesce(v_day ->> 'start', '') !~ '^([01][0-9]|2[0-3]):00$'
       or coalesce(v_day ->> 'end', '') !~ '^([01][0-9]|2[0-3]):00$' then
      return jsonb_build_object('ok', false, 'message', 'Choose a start and end on the hour.');
    end if;
    v_start := split_part(v_day ->> 'start', ':', 1)::integer;
    v_end := split_part(v_day ->> 'end', ':', 1)::integer;
    v_dur := v_end - v_start;
    if not v_dur = any (v_allowed) then
      if p_weekly = 'part_time_4_5' then
        return jsonb_build_object('ok', false, 'message', 'Part time is a 4 or 5 hour block on each day you work.');
      end if;
      return jsonb_build_object('ok', false, 'message', 'Full time is a 6, 7, or 8 hour block on each day you work.');
    end if;
  end loop;

  if v_count < 1 then
    return jsonb_build_object('ok', false, 'message', 'Pick at least one day and the hours you can work that day.');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function app.check_onboarding_schedule(text, text) from public, anon, authenticated;

create or replace function app.onboarding_choice_label(p_protocol text, p_step text, p_value text)
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (
      select c.label
        from public.da_onboarding_protocol_step s
        cross join lateral jsonb_to_recordset(coalesce(s.choices, '[]'::jsonb)) as c(value text, label text)
       where s.protocol_key = p_protocol
         and s.key = p_step
         and c.value = p_value
       limit 1
    ),
    nullif(btrim(coalesce(p_value, '')), '')
  );
$$;

revoke all on function app.onboarding_choice_label(text, text, text) from public, anon, authenticated;

create or replace function app.onboarding_multi_label(p_protocol text, p_step text, p_value text)
returns text
language sql
stable
set search_path = ''
as $$
  select string_agg(app.onboarding_choice_label(p_protocol, p_step, btrim(token)), ', ' order by ord)
    from unnest(string_to_array(coalesce(p_value, ''), ',')) with ordinality as t(token, ord)
   where btrim(token) <> '';
$$;

revoke all on function app.onboarding_multi_label(text, text, text) from public, anon, authenticated;

create or replace function app.onboarding_schedule_text(p_value text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v jsonb;
  v_day jsonb;
  v_name text;
  v_out text := '';
begin
  if p_value is null or btrim(p_value) = '' then
    return null;
  end if;
  v := p_value::jsonb;
  if jsonb_typeof(v) is distinct from 'object' then
    return null;
  end if;
  for v_day in select value from jsonb_array_elements(coalesce(v -> 'days', '[]'::jsonb))
  loop
    v_name := case v_day ->> 'day'
      when 'mon' then 'Mon'
      when 'tue' then 'Tue'
      when 'wed' then 'Wed'
      when 'thu' then 'Thu'
      when 'fri' then 'Fri'
      when 'sat' then 'Sat'
      when 'sun' then 'Sun'
      else null
    end;
    if v_name is null then
      continue;
    end if;
    v_out := v_out || case when v_out = '' then '' else '; ' end
      || v_name || ' ' || coalesce(v_day ->> 'start', '') || '-' || coalesce(v_day ->> 'end', '');
  end loop;
  return nullif(v_out, '');
exception when others then
  return null;
end;
$$;

revoke all on function app.onboarding_schedule_text(text) from public, anon, authenticated;

-- Drop secret keys if a save ever tries to put them on an answer. The value
-- that remains for a password is the word "saved", and for a payout it is the
-- method plus last4.
create or replace function app.strip_onboarding_answer_secrets()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_key text;
  v_val jsonb;
  v_clean jsonb := '{}'::jsonb;
begin
  for v_key, v_val in select key, value from jsonb_each(coalesce(new.answers, '{}'::jsonb))
  loop
    if jsonb_typeof(v_val) = 'object' then
      v_val := v_val - 'password' - 'confirm' - 'reference' - 'payout_reference'
                    - 'password_hash' - 'account_number' - 'wise_email' - 'account';
    end if;
    v_clean := v_clean || jsonb_build_object(v_key, v_val);
  end loop;
  new.answers := v_clean;
  return new;
end;
$$;

revoke all on function app.strip_onboarding_answer_secrets() from public, anon, authenticated;

drop trigger if exists da_onboarding_submission_strip_secrets on public.da_onboarding_submission;
create trigger da_onboarding_submission_strip_secrets
  before insert or update of answers on public.da_onboarding_submission
  for each row execute function app.strip_onboarding_answer_secrets();

-- 4. Protocol steps -----------------------------------------------------------------

update public.da_onboarding_protocol
   set intro = 'This sets up your Divine Acquisition account, where your pay goes, and when you can work. The work is done on a laptop or desktop. A phone is not allowed. Answer accurately so the first day is spent training you, not fixing the setup.'
 where key = 'va_sales_operator';

delete from public.da_onboarding_protocol_step
 where protocol_key = 'va_sales_operator'
   and key in ('shift', 'bank_name', 'account_number', 'account_number_confirm');

update public.da_onboarding_protocol_step
   set section_key = 'availability',
       section_title = 'Section 5 — Availability',
       section_intro = null,
       sort_order = case key
         when 'training_availability' then 190
         when 'training_conflict' then 200
         else sort_order
       end
 where protocol_key = 'va_sales_operator'
   and key in ('training_availability', 'training_conflict');

update public.da_onboarding_protocol_step
   set section_title = 'Section 7 — Confirmations',
       sort_order = case key
         when 'confirm_training_unpaid' then 300
         when 'confirm_shift_commitment' then 310
         when 'confirm_agreement_read' then 320
         when 'confirm_accuracy' then 330
         else sort_order
       end
 where protocol_key = 'va_sales_operator'
   and key in (
     'confirm_training_unpaid', 'confirm_shift_commitment',
     'confirm_agreement_read', 'confirm_accuracy'
   );

insert into public.da_onboarding_protocol_step (
  protocol_key, key, label, kind, help, required, sort_order,
  section_key, section_title, section_intro, input_type, placeholder,
  choices, show_when, link_url, link_label, prefill, must_match, no_paste
) values
  (
    'va_sales_operator', 'da_login', 'Divine Acquisition username', 'form_question',
    'This becomes your sign-in email. The part you type is the username, on the divineacquisition.io domain.',
    true, 80, 'account', 'Section 2 — Your Divine Acquisition account',
    'Create the login you will use for Divine Acquisition. Choose a password you have not used anywhere else.',
    'da_login', 'jane.cruz', null, null, null, null, null, null, false
  ),
  (
    'va_sales_operator', 'da_password', 'Password', 'form_question',
    'At least 12 characters. You will use this with your divineacquisition.io email.',
    true, 90, 'account', 'Section 2 — Your Divine Acquisition account', null,
    'password', null, null, null, null, null, null, null, false
  ),
  (
    'va_sales_operator', 'payout', 'Preferred payout method', 'form_question',
    'Wise pays the email on your Wise account. Remitly pays the person you name, by bank deposit, cash pickup, or mobile wallet. These details go on your payout record. They are not stored on your Academy profile.',
    true, 100, 'payout', 'Section 3 — Payout details',
    'Tell us where to send your pay. The fields follow the method you pick, and they are saved through the payout record, not the Academy.',
    'payout', null,
    '[{"value":"wise","label":"Wise"},{"value":"remitly","label":"Remitly"}]'::jsonb,
    null, null, null, null, null, false
  ),
  (
    'va_sales_operator', 'has_computer', 'Do you have a laptop or desktop you will use for this work?', 'form_question',
    'A phone is not allowed for this work, under any circumstances.',
    true, 110, 'equipment', 'Section 4 — Equipment and setup',
    'You will work from a laptop or desktop. A phone is not allowed. Apploye then tracks productivity on that computer, including inactivity, not just the time you are online.',
    'single_select', null,
    '[{"value":"yes","label":"Yes - I have a laptop or desktop"},{"value":"no","label":"No - I only have a phone"}]'::jsonb,
    null, null, null, null, null, false
  ),
  (
    'va_sales_operator', 'has_internet', 'Do you have reliable internet for a full shift?', 'form_question',
    null, true, 120, 'equipment', 'Section 4 — Equipment and setup', null,
    'single_select', null,
    '[{"value":"yes","label":"Yes - it stays up through a shift"},{"value":"no","label":"No - it drops"}]'::jsonb,
    null, null, null, null, null, false
  ),
  (
    'va_sales_operator', 'has_headset', 'Do you have a headset?', 'form_question',
    null, true, 130, 'equipment', 'Section 4 — Equipment and setup', null,
    'single_select', null,
    '[{"value":"yes","label":"Yes"},{"value":"no","label":"No"}]'::jsonb,
    null, null, null, null, null, false
  ),
  (
    'va_sales_operator', 'has_quiet_workspace', 'Do you have a quiet workspace for calls?', 'form_question',
    null, true, 140, 'equipment', 'Section 4 — Equipment and setup', null,
    'single_select', null,
    '[{"value":"yes","label":"Yes - I can take calls without background noise"},{"value":"no","label":"No"}]'::jsonb,
    null, null, null, null, null, false
  ),
  (
    'va_sales_operator', 'apploye_download',
    'I have downloaded Apploye on the laptop or desktop I will work from. I understand I am tracked on productivity, not just time. Inactivity is visible.',
    'acknowledgment',
    'Install the desktop app. Do not use the phone app. Apploye records activity while you work, so idle time is visible to Divine Acquisition. This is how the team sees the work, not only the hours you were online.',
    true, 150, 'equipment', 'Section 4 — Equipment and setup', null,
    null, null, null, null, 'https://apploye.com/download', 'Download Apploye', null, null, false
  ),
  (
    'va_sales_operator', 'weekly_hours', 'Weekly hours you can commit', 'form_question',
    'Part time is 4 to 5 hours on the days you work. Full time is 6 to 8 hours on the days you work.',
    true, 160, 'availability', 'Section 5 — Availability',
    'Part time is a 4 or 5 hour block. Full time is a 6, 7, or 8 hour block. The days and hours below follow the one you pick.',
    'single_select', null,
    '[{"value":"part_time_4_5","label":"Part time - 4 to 5 hours"},{"value":"full_time_6_8","label":"Full time - 6 to 8 hours"}]'::jsonb,
    null, null, null, null, null, false
  ),
  (
    'va_sales_operator', 'work_schedule', 'Days and hours you can work', 'form_question',
    'Each day you select has to fit the hours you committed. Times are in your own timezone.',
    true, 170, 'availability', 'Section 5 — Availability', null,
    'schedule', null, null,
    '{"step":"weekly_hours","values":["part_time_4_5","full_time_6_8"]}'::jsonb,
    null, null, null, null, false
  ),
  (
    'va_sales_operator', 'time_off_30', 'Any known time off in the first 30 days', 'form_question',
    'List the dates, or leave this blank if you have none.',
    false, 180, 'availability', 'Section 5 — Availability', null,
    'textarea', 'None, or list the dates', null, null, null, null, null, null, false
  ),
  (
    'va_sales_operator', 'years_sales', 'Years in sales or outbound', 'form_question',
    null, true, 210, 'experience', 'Section 6 — Experience',
    'This is how we match you to a client.',
    'select', null,
    '[{"value":"none","label":"None yet"},{"value":"under_1","label":"Less than 1 year"},{"value":"y1_2","label":"1-2 years"},{"value":"y3_5","label":"3-5 years"},{"value":"y6_10","label":"6-10 years"},{"value":"y10_plus","label":"More than 10 years"}]'::jsonb,
    null, null, null, null, null, false
  ),
  (
    'va_sales_operator', 'roles_held', 'Roles you have held', 'form_question',
    'Select every one that applies.',
    true, 220, 'experience', 'Section 6 — Experience', null,
    'multi_select', null,
    '[{"value":"sdr","label":"SDR"},{"value":"appointment_setter","label":"Appointment setter"},{"value":"closer","label":"Closer"},{"value":"va","label":"VA"},{"value":"other","label":"Other"}]'::jsonb,
    null, null, null, null, null, false
  ),
  (
    'va_sales_operator', 'industries_sold', 'Industries you have sold into', 'form_question',
    'Search and select every industry you have actually sold into.',
    true, 230, 'experience', 'Section 6 — Experience', null,
    'multi_select', 'Search industries', '[]'::jsonb, null, null, null, null, null, false
  ),
  (
    'va_sales_operator', 'verticals_interest', 'Verticals you are interested in', 'form_question',
    'No preference stands on its own.',
    true, 240, 'experience', 'Section 6 — Experience', null,
    'multi_select', null,
    '[{"value":"med_spa","label":"Med Spa"},{"value":"home_services","label":"Home Services"},{"value":"coaches_consultants","label":"Coaches and Consultants"},{"value":"no_preference","label":"No preference"}]'::jsonb,
    null, null, null, null, null, false
  )
on conflict (protocol_key, key) do update set
  label = excluded.label,
  kind = excluded.kind,
  help = excluded.help,
  required = excluded.required,
  sort_order = excluded.sort_order,
  section_key = excluded.section_key,
  section_title = excluded.section_title,
  section_intro = excluded.section_intro,
  input_type = excluded.input_type,
  placeholder = excluded.placeholder,
  choices = excluded.choices,
  show_when = excluded.show_when,
  link_url = excluded.link_url,
  link_label = excluded.link_label,
  prefill = excluded.prefill,
  must_match = excluded.must_match,
  no_paste = excluded.no_paste;

-- Industries appointment setters and outbound reps commonly sell into in the
-- US: home-service trades, health and aesthetics, professional services,
-- financial services, and software. "Other" stays available.
update public.da_onboarding_protocol_step
   set choices = (
     select jsonb_agg(jsonb_build_object('value', v, 'label', l) order by sort)
       from (values
         (10, 'automotive', 'Automotive'),
         (20, 'chiropractic', 'Chiropractic'),
         (30, 'cleaning', 'Cleaning services'),
         (40, 'coaching', 'Coaching and consulting'),
         (50, 'dental', 'Dental'),
         (60, 'ecommerce', 'E-commerce'),
         (70, 'education', 'Education'),
         (80, 'electrical', 'Electrical'),
         (90, 'financial_services', 'Financial services'),
         (100, 'fitness', 'Fitness'),
         (110, 'garage_doors', 'Garage doors'),
         (120, 'healthcare', 'Healthcare'),
         (130, 'home_services', 'Home services'),
         (140, 'hvac', 'HVAC'),
         (150, 'insurance', 'Insurance'),
         (160, 'landscaping', 'Landscaping'),
         (170, 'legal', 'Legal'),
         (180, 'marketing_agencies', 'Marketing agencies'),
         (190, 'med_spa', 'Med spa and aesthetics'),
         (200, 'mortgage', 'Mortgage and lending'),
         (210, 'pest_control', 'Pest control'),
         (220, 'plumbing', 'Plumbing'),
         (230, 'real_estate', 'Real estate'),
         (240, 'restoration', 'Restoration'),
         (250, 'roofing', 'Roofing'),
         (260, 'saas', 'SaaS and software'),
         (270, 'solar', 'Solar'),
         (280, 'staffing', 'Staffing and recruiting'),
         (290, 'veterinary', 'Veterinary'),
         (300, 'windows_doors', 'Windows and doors'),
         (310, 'other', 'Other')
       ) as industry(sort, v, l)
   )
 where protocol_key = 'va_sales_operator'
   and key = 'industries_sold';
