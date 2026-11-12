-- Stripe, connected from the admin workspace (Account, Stripe).
--
-- DA Admin pastes a Stripe secret or restricted key once. The app checks it
-- against Stripe, then it is stored encrypted in Supabase Vault; the database
-- keeps only the account name, mode and the last four characters. Only the
-- service role can read the key back, to charge a client's card from Billing.
-- STRIPE_SECRET_KEY on the deploy still works as a fallback.

create table if not exists public.stripe_connection (
  id smallint primary key default 1 check (id = 1),
  secret_id uuid not null,
  account_id text,
  account_name text,
  livemode boolean not null,
  key_kind text not null check (key_kind in ('secret', 'restricted')),
  key_last4 text not null check (length(key_last4) = 4),
  connected_by uuid references public.profile (id) on delete set null,
  connected_at timestamptz not null default now(),
  checked_at timestamptz not null default now()
);

alter table public.stripe_connection enable row level security;
revoke all on public.stripe_connection from public, anon, authenticated;
grant select on public.stripe_connection to service_role;

-- Save (or replace) the key. The caller has already checked it with Stripe.
create or replace function public.stripe_connection_save(
  p_key text,
  p_account_id text,
  p_account_name text,
  p_livemode boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text := btrim(coalesce(p_key, ''));
  v_kind text;
  v_secret uuid;
  v_existing public.stripe_connection;
begin
  if not app.is_admin() then
    raise exception 'admin_required: only DA Admin connects Stripe' using errcode = '42501';
  end if;
  if app.is_impersonating() then
    raise exception 'view_as_read_only: exit View As to change a connection' using errcode = '42501';
  end if;
  if v_key ~ '^sk_(live|test)_[A-Za-z0-9]{20,}$' then
    v_kind := 'secret';
  elsif v_key ~ '^rk_(live|test)_[A-Za-z0-9]{20,}$' then
    v_kind := 'restricted';
  else
    raise exception 'invalid: paste a Stripe secret key (sk_...) or restricted key (rk_...)' using errcode = '23514';
  end if;

  select * into v_existing from public.stripe_connection where id = 1 for update;
  if v_existing.secret_id is not null then
    perform vault.update_secret(v_existing.secret_id, v_key, 'stripe_connection', 'Stripe key for billing');
    v_secret := v_existing.secret_id;
  else
    v_secret := vault.create_secret(v_key, 'stripe_connection_' || gen_random_uuid()::text, 'Stripe key for billing');
  end if;

  insert into public.stripe_connection as s (id, secret_id, account_id, account_name, livemode, key_kind, key_last4, connected_by, connected_at, checked_at)
  values (1, v_secret, nullif(btrim(coalesce(p_account_id, '')), ''), nullif(btrim(coalesce(p_account_name, '')), ''),
    coalesce(p_livemode, v_key like '%\_live\_%'), v_kind, right(v_key, 4), app.acting_profile(), now(), now())
  on conflict (id) do update
     set secret_id = excluded.secret_id,
         account_id = excluded.account_id,
         account_name = excluded.account_name,
         livemode = excluded.livemode,
         key_kind = excluded.key_kind,
         key_last4 = excluded.key_last4,
         connected_by = excluded.connected_by,
         connected_at = now(),
         checked_at = now();

  perform app.audit('stripe.connect', 'stripe_connection', '1', 'Connected Stripe for billing', null,
    jsonb_build_object('account_id', p_account_id, 'livemode', p_livemode, 'key_kind', v_kind), null);
  return public.stripe_connection_status();
end;
$$;

-- What the admin page shows. Never the key.
create or replace function public.stripe_connection_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.stripe_connection;
begin
  if not app.is_admin() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'admin_required: only DA Admin sees the Stripe connection' using errcode = '42501';
  end if;
  select * into v from public.stripe_connection where id = 1;
  if v.secret_id is null then
    return jsonb_build_object('connected', false);
  end if;
  return jsonb_build_object(
    'connected', true,
    'account_id', v.account_id,
    'account_name', v.account_name,
    'livemode', v.livemode,
    'key_kind', v.key_kind,
    'key_last4', v.key_last4,
    'connected_at', v.connected_at,
    'checked_at', v.checked_at,
    'connected_by', (select coalesce(nullif(btrim(p.full_name), ''), p.email) from public.profile p where p.id = v.connected_by)
  );
end;
$$;

create or replace function public.stripe_connection_remove()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.stripe_connection;
begin
  if not app.is_admin() then
    raise exception 'admin_required: only DA Admin disconnects Stripe' using errcode = '42501';
  end if;
  if app.is_impersonating() then
    raise exception 'view_as_read_only: exit View As to change a connection' using errcode = '42501';
  end if;
  select * into v from public.stripe_connection where id = 1 for update;
  if v.secret_id is null then return; end if;
  delete from public.stripe_connection where id = 1;
  delete from vault.secrets where id = v.secret_id;
  perform app.audit('stripe.disconnect', 'stripe_connection', '1', 'Disconnected Stripe', null, '{}'::jsonb, null);
end;
$$;

-- The key, for the server only (service role), to charge a card.
create or replace function public.stripe_connection_secret()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s.decrypted_secret
  from public.stripe_connection c
  join vault.decrypted_secrets s on s.id = c.secret_id
  where c.id = 1;
$$;

-- Link a client file to its Stripe customer, so Billing knows whose card to charge.
create or replace function public.stripe_link_client(p_case_file_id uuid, p_customer_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer text := nullif(btrim(coalesce(p_customer_id, '')), '');
begin
  if not app.is_admin() then
    raise exception 'admin_required: only DA Admin links a client to Stripe' using errcode = '42501';
  end if;
  if v_customer is not null and v_customer !~ '^cus_[A-Za-z0-9]{6,}$' then
    raise exception 'invalid: a Stripe customer id starts with cus_' using errcode = '23514';
  end if;
  update public.client_case_file set stripe_customer_id = v_customer where id = p_case_file_id;
  if not found then
    raise exception 'not_found: that client is not in the workspace' using errcode = 'P0002';
  end if;
  perform app.audit('stripe.link_client', 'client_case_file', p_case_file_id::text, 'Linked a client to a Stripe customer', null,
    jsonb_build_object('customer_id', v_customer), null);
end;
$$;

-- Clients with a seat, and the Stripe customer each is linked to.
create or replace function public.stripe_clients()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app.is_admin() then
    raise exception 'admin_required: only DA Admin sees billing links' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'case_file_id', cf.id,
      'name', cf.name,
      'contact_email', nullif(btrim(coalesce(cf.contact_email, '')), ''),
      'stripe_customer_id', nullif(btrim(coalesce(cf.stripe_customer_id, '')), ''),
      'seats', (select count(*) from public.placement p where p.case_file_id = cf.id and p.status in ('active', 'paused', 'scheduled'))
    ) order by cf.name)
    from public.client_case_file cf
    where exists (select 1 from public.placement p where p.case_file_id = cf.id)
       or nullif(btrim(coalesce(cf.stripe_customer_id, '')), '') is not null
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.stripe_connection_save(text, text, text, boolean) from public, anon;
revoke all on function public.stripe_connection_status() from public, anon;
revoke all on function public.stripe_connection_remove() from public, anon;
revoke all on function public.stripe_connection_secret() from public, anon, authenticated;
revoke all on function public.stripe_link_client(uuid, text) from public, anon;
revoke all on function public.stripe_clients() from public, anon;
grant execute on function public.stripe_connection_save(text, text, text, boolean) to authenticated;
grant execute on function public.stripe_connection_status() to authenticated, service_role;
grant execute on function public.stripe_connection_remove() to authenticated;
grant execute on function public.stripe_connection_secret() to service_role;
grant execute on function public.stripe_link_client(uuid, text) to authenticated;
grant execute on function public.stripe_clients() to authenticated;
