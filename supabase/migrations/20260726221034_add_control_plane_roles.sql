-- Five roles, plus `client`, which already exists and is reserved for the client
-- account surface. A new enum value cannot be used in the transaction that adds
-- it, so this migration only adds them.
--
-- Order matters for the seniority comparisons that follow: `owner` outranks
-- `admin`, which outranks `manager`. Postgres orders enum values by the position
-- they were added, so these go in ahead of the existing ones.
alter type public.user_role add value if not exists 'owner' before 'admin';
alter type public.user_role add value if not exists 'manager' after 'admin';
alter type public.user_role add value if not exists 'contractor' after 'operator';

-- Where an account sits in its own lifecycle. Distinct from the role: a suspended
-- Owner is still an Owner, and is still refused.
create type public.account_state as enum (
  'pending',
  'active',
  'suspended',
  'expired',
  'locked',
  'archived'
);

-- Which records an account can reach. A separate dimension from role, because two
-- Managers can hold identical permissions over completely different client sets.
create type public.scope_kind as enum ('all_clients', 'clients', 'placements');

-- An override is a grant or a denial. Denial always wins.
create type public.permission_effect as enum ('grant', 'deny');
