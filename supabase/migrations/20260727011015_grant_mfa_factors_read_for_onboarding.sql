-- v_account_onboarding joins auth.mfa_factors; without a SELECT grant the view
-- fails for authenticated callers even when they can read profiles.
grant select on auth.mfa_factors to authenticated;
