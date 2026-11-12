-- Stripe is connected directly through the deploy (STRIPE_SECRET_KEY on the
-- server), not stored from the app. The in-app key storage added earlier today
-- was never used; it is removed. Linking a client to its Stripe customer stays.

drop function if exists public.stripe_connection_save(text, text, text, boolean);
drop function if exists public.stripe_connection_remove();
drop function if exists public.stripe_connection_secret();
drop function if exists public.stripe_connection_status();
delete from vault.secrets where name like 'stripe_connection%';
drop table if exists public.stripe_connection;
