-- da_onboarding_submission had row level security on and grants to
-- authenticated, but no policy, so the admin workspace could not create the
-- onboarding row when sending an agreement. Admins get the same full access
-- they have on da_agreement and da_recipient; recipients still reach their row
-- only through the token functions.

drop policy if exists da_onboarding_submission_admin_all on public.da_onboarding_submission;
create policy da_onboarding_submission_admin_all on public.da_onboarding_submission
  for all to authenticated
  using (app.is_admin())
  with check (app.is_admin());
