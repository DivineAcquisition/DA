-- Remitly joins the payout methods an operator can be paid through.
-- A new enum value cannot be used until this statement commits, so this file
-- does not cast to it. The onboarding migration that follows is a later commit.

alter type public.payout_method add value if not exists 'remitly';
