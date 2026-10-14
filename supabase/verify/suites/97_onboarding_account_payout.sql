-- The sales-operator form creates a divineacquisition.io login and a payout
-- destination without putting the password or the full payout reference in
-- the answers the page can read.
\set ON_ERROR_STOP on
set search_path = public;

\echo '== login, password, payout, equipment, and schedule rules =='
do $$
declare
  v_recipient uuid := 'f97f97f9-0000-4000-8000-000000000001';
  v_token text := 'f97onboardingaccountpayouttoken0001';
  v_result jsonb;
  v_page jsonb;
  v_submission uuid;
begin
  assert length(v_token) >= 32;

  insert into public.da_recipient (id, full_name, email, recipient_type)
  values (v_recipient, 'Dana Cruz', 'dana.cruz@operators.test', 'operator');
  insert into public.da_onboarding_submission (protocol_key, recipient_id, access_token, status)
  values ('va_sales_operator', v_recipient, v_token, 'pending')
  returning id into v_submission;

  v_result := public.da_onboarding_save_step(v_token, 'da_login', jsonb_build_object('value', 'ab'), 'suite');
  assert v_result ->> 'ok' = 'false', v_result::text;

  v_result := public.da_onboarding_save_step(v_token, 'da_login', jsonb_build_object('value', 'dana.cruz@gmail.com'), 'suite');
  assert v_result ->> 'ok' = 'false', v_result::text;
  assert v_result ->> 'message' ilike '%divineacquisition.io%';

  v_result := public.da_onboarding_save_step(v_token, 'da_login', jsonb_build_object('value', 'Dana.Cruz'), 'suite');
  assert v_result ->> 'ok' = 'true', v_result::text;
  assert v_result -> 'answer' ->> 'value' = 'dana.cruz@divineacquisition.io';

  v_result := public.da_onboarding_save_step(v_token, 'da_password', jsonb_build_object('password', 'short-pass', 'confirm', 'short-pass'), 'suite');
  assert v_result ->> 'ok' = 'false', v_result::text;
  assert position('short-pass' in (select answers::text from public.da_onboarding_submission where id = v_submission)) = 0;

  v_result := public.da_onboarding_save_step(
    v_token, 'da_password',
    jsonb_build_object('password', 'Correct-horse-1', 'confirm', 'Correct-horse-2'),
    'suite'
  );
  assert v_result ->> 'ok' = 'false' and v_result ->> 'error' = 'mismatch', v_result::text;

  v_result := public.da_onboarding_save_step(
    v_token, 'da_password',
    jsonb_build_object('password', 'Correct-horse-1', 'confirm', 'Correct-horse-1'),
    'suite'
  );
  assert v_result ->> 'ok' = 'true', v_result::text;
  assert v_result -> 'answer' ->> 'value' = 'saved';
  assert position('Correct-horse-1' in v_result::text) = 0, 'the save response does not echo the password';
  assert position('Correct-horse-1' in (select answers::text from public.da_onboarding_submission where id = v_submission)) = 0;
  assert (select extensions.crypt('Correct-horse-1', password_hash) = password_hash
            from app.onboarding_credential where submission_id = v_submission);

  v_result := public.da_onboarding_save_step(v_token, 'has_computer', jsonb_build_object('value', 'no'), 'suite');
  assert v_result ->> 'ok' = 'false', v_result::text;
  assert v_result ->> 'message' ilike '%phone%';

  v_result := public.da_onboarding_save_step(v_token, 'has_computer', jsonb_build_object('value', 'yes'), 'suite');
  assert v_result ->> 'ok' = 'true', v_result::text;

  v_result := public.da_onboarding_save_step(v_token, 'payout', jsonb_build_object('method', 'wise', 'wise_name', 'Dana Cruz'), 'suite');
  assert v_result ->> 'ok' = 'false', v_result::text;

  v_result := public.da_onboarding_save_step(
    v_token, 'payout',
    jsonb_build_object('method', 'wise', 'wise_email', 'dana@wise.com', 'wise_name', 'Dana Cruz', 'currency', 'USD'),
    'suite'
  );
  assert v_result ->> 'ok' = 'true', v_result::text;
  assert v_result -> 'answer' ->> 'value' = 'wise';
  assert position('dana@wise.com' in v_result::text) = 0, 'the save response does not echo the Wise email';
  assert position('dana@wise.com' in (select answers::text from public.da_onboarding_submission where id = v_submission)) = 0;
  assert (select payout_reference from app.onboarding_credential where submission_id = v_submission) = 'wise|USD|Dana Cruz|dana@wise.com';

  v_result := public.da_onboarding_save_step(
    v_token, 'payout',
    jsonb_build_object(
      'method', 'remitly', 'legal_name', 'Dana Cruz', 'country', 'Philippines',
      'phone', '+639171112233', 'delivery', 'bank', 'bank_name', 'BPI', 'account_number', '9988-7766-55'
    ),
    'suite'
  );
  assert v_result ->> 'ok' = 'true', v_result::text;
  assert v_result -> 'answer' ->> 'value' = 'remitly';
  assert v_result -> 'answer' ->> 'last4' = '6655';
  assert position('9988776655' in v_result::text) = 0;
  assert position('9988776655' in (select answers::text from public.da_onboarding_submission where id = v_submission)) = 0;
  assert (select payout_reference from app.onboarding_credential where submission_id = v_submission)
    = 'remitly|bank|Philippines|Dana Cruz|+639171112233|BPI|9988776655';
  assert (select payout_method from app.onboarding_credential where submission_id = v_submission) = 'remitly';

  v_result := public.da_onboarding_save_step(v_token, 'weekly_hours', jsonb_build_object('value', 'part_time_4_5'), 'suite');
  assert v_result ->> 'ok' = 'true', v_result::text;
  v_result := public.da_onboarding_save_step(
    v_token, 'work_schedule',
    jsonb_build_object('value', '{"days":[{"day":"mon","start":"09:00","end":"17:00"}]}'),
    'suite'
  );
  assert v_result ->> 'ok' = 'false', v_result::text;
  assert v_result ->> 'message' ilike '%4 or 5 hour%';

  v_result := public.da_onboarding_save_step(
    v_token, 'work_schedule',
    jsonb_build_object('value', '{"days":[{"day":"mon","start":"09:00","end":"13:00"}]}'),
    'suite'
  );
  assert v_result ->> 'ok' = 'true', v_result::text;

  v_result := public.da_onboarding_save_step(v_token, 'weekly_hours', jsonb_build_object('value', 'full_time_6_8'), 'suite');
  assert v_result ->> 'ok' = 'true', v_result::text;
  assert (select answers ? 'work_schedule' from public.da_onboarding_submission where id = v_submission) is false,
    'changing the weekly commitment clears a schedule that no longer fits';

  v_result := public.da_onboarding_save_step(
    v_token, 'work_schedule',
    jsonb_build_object('value', '{"days":[{"day":"mon","start":"09:00","end":"17:00"},{"day":"tue","start":"10:00","end":"16:00"}]}'),
    'suite'
  );
  assert v_result ->> 'ok' = 'true', v_result::text;

  v_result := public.da_onboarding_save_step(
    v_token, 'verticals_interest',
    jsonb_build_object('value', 'med_spa,no_preference'),
    'suite'
  );
  assert v_result ->> 'ok' = 'false', v_result::text;

  v_result := public.da_onboarding_save_step(
    v_token, 'industries_sold',
    jsonb_build_object('value', 'hvac,med_spa,not_a_real_industry'),
    'suite'
  );
  assert v_result ->> 'ok' = 'false', v_result::text;

  v_result := public.da_onboarding_save_step(
    v_token, 'industries_sold',
    jsonb_build_object('value', 'hvac,med_spa,home_services'),
    'suite'
  );
  assert v_result ->> 'ok' = 'true', v_result::text;

  v_page := public.da_onboarding_page(v_token, 'suite');
  assert position('Correct-horse-1' in v_page::text) = 0;
  assert position('9988776655' in v_page::text) = 0;
  assert position('dana@wise.com' in v_page::text) = 0;
  assert v_page -> 'answers' -> 'da_login' ->> 'value' = 'dana.cruz@divineacquisition.io';
  assert v_page -> 'answers' -> 'payout' ->> 'last4' = '6655';
end $$;
