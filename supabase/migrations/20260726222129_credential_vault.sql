-- ---------------------------------------------------------------------------
-- The credential vault
--
-- The most sensitive data in the system, so it gets its own controls rather than
-- living in a notes field. The secret itself goes to Supabase Vault, which holds it
-- encrypted with a key this database never exposes; the row below holds only the
-- reference and the metadata.
-- ---------------------------------------------------------------------------

create table public.client_credential (
  id uuid primary key default gen_random_uuid(),
  case_file_id uuid not null references public.client_case_file (id) on delete cascade,
  label text not null,
  kind text not null,
  username text,
  url text,
  notes text,
  -- The Vault secret. Never selected by any policy: only reveal_credential() reads
  -- it, and only after step-up.
  secret_id uuid not null,
  last_rotated_at timestamptz not null default now(),
  rotation_interval_days integer not null default 90,
  created_by uuid references public.profile (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  archived_by uuid references public.profile (id)
);

comment on table public.client_credential is
  'Rule 6: revealing one of these requires step-up authentication and is logged every single time. Credential access is a distinct permission, not implied by any role.';

create index client_credential_case_file_idx on public.client_credential (case_file_id) where archived_at is null;

create trigger client_credential_touch before update on public.client_credential
  for each row execute function app.touch_updated_at();

-- Time limited access to one credential, for a Contractor who needs a specific
-- system on a specific client and nothing else.
create table public.credential_grant (
  id uuid primary key default gen_random_uuid(),
  credential_id uuid not null references public.client_credential (id) on delete cascade,
  profile_id uuid not null references public.profile (id) on delete cascade,
  reason text,
  granted_by uuid references public.profile (id),
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_by uuid references public.profile (id)
);

create index credential_grant_live_idx on public.credential_grant (profile_id, credential_id)
  where revoked_at is null;

-- Every reveal, without exception. Append only for the same reason the audit log is.
create table public.credential_view (
  id bigint generated always as identity primary key,
  credential_id uuid not null references public.client_credential (id) on delete cascade,
  viewed_by uuid references public.profile (id) on delete set null,
  viewed_by_email text,
  viewed_at timestamptz not null default now(),
  via_grant_id uuid references public.credential_grant (id) on delete set null,
  impersonation_id uuid,
  audit_event_id bigint references public.audit_event (id)
);

create index credential_view_credential_idx on public.credential_view (credential_id, viewed_at desc);

create trigger credential_view_no_update before update on public.credential_view
  for each row execute function app.forbid_audit_change();
create trigger credential_view_no_delete before delete on public.credential_view
  for each row execute function app.forbid_audit_change();

-- Who can reach a given credential at all: the permission, then the scope, then
-- any explicit time limited grant.
create or replace function app.can_reach_credential(p_credential_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.client_credential c
    where c.id = p_credential_id
      and c.archived_at is null
      and (
        (app.can('credentials.view') and app.in_scope_case_file(c.case_file_id))
        or exists (
          select 1 from public.credential_grant g
          where g.credential_id = c.id
            and g.profile_id = app.acting_profile()
            and g.revoked_at is null
            and g.expires_at > now()
        )
      )
  );
$$;

-- Metadata only. Never the secret, and never even a masked copy of it: the reveal
-- is a separate, logged call.
create or replace view public.v_credential
with (security_invoker = true)
as
select
  c.id,
  c.case_file_id,
  cf.name as client_name,
  cf.slug as client_slug,
  c.label,
  c.kind,
  c.username,
  c.url,
  c.notes,
  c.last_rotated_at,
  c.rotation_interval_days,
  c.last_rotated_at + make_interval(days => c.rotation_interval_days) < now() as is_stale,
  c.archived_at,
  (select count(*) from public.credential_view v where v.credential_id = c.id) as view_count,
  (select max(v.viewed_at) from public.credential_view v where v.credential_id = c.id) as last_viewed_at,
  (select count(*) from public.credential_grant g
    where g.credential_id = c.id and g.revoked_at is null and g.expires_at > now()) as live_grants
from public.client_credential c
join public.client_case_file cf on cf.id = c.case_file_id;

create or replace function public.store_credential(
  p_case_file_id uuid,
  p_label text,
  p_kind text,
  p_secret text,
  p_username text default null,
  p_url text default null,
  p_notes text default null,
  p_rotation_interval_days integer default 90
)
returns public.client_credential
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_secret_id uuid;
  v_row public.client_credential;
begin
  perform app.require('credentials.manage');
  perform app.require_step_up('store a credential');

  if not app.in_scope_case_file(p_case_file_id) then
    raise exception 'out_of_scope: that client is not in your scope' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_secret, '')), '') is null then
    raise exception 'secret_required: there is nothing to store' using errcode = '23514';
  end if;

  v_secret_id := vault.create_secret(
    p_secret,
    format('cred:%s:%s', p_case_file_id, gen_random_uuid()),
    format('%s credential for case file %s', p_label, p_case_file_id)
  );

  insert into public.client_credential (
    case_file_id, label, kind, username, url, notes, secret_id, rotation_interval_days, created_by
  ) values (
    p_case_file_id, btrim(p_label), btrim(p_kind),
    nullif(btrim(coalesce(p_username, '')), ''), nullif(btrim(coalesce(p_url, '')), ''),
    nullif(btrim(coalesce(p_notes, '')), ''), v_secret_id,
    greatest(coalesce(p_rotation_interval_days, 90), 1), auth.uid()
  ) returning * into v_row;

  perform app.audit('credential.stored', 'client_credential', v_row.id::text,
    format('Stored the %s credential "%s"', p_kind, p_label), null, null, p_case_file_id);

  return v_row;
end;
$$;

-- Rule 6. Step-up every time, logged every time, including who and when.
create or replace function public.reveal_credential(p_credential_id uuid)
returns table (label text, username text, secret text, url text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_cred public.client_credential;
  v_grant uuid;
  v_actor_role public.user_role;
  v_audit bigint;
  v_secret text;
begin
  select * into v_cred from public.client_credential where id = p_credential_id and archived_at is null;
  if v_cred.id is null then
    raise exception 'credential_not_found' using errcode = 'P0002';
  end if;

  if not app.can_reach_credential(p_credential_id) then
    raise exception 'permission_denied: credential access is a separate permission and is not implied by any role. Ask an Owner to grant it.'
      using errcode = '42501';
  end if;

  -- Never done while impersonating, whatever the target holds.
  if app.is_impersonating() then
    raise exception 'blocked_during_impersonation: credentials are never revealed inside an impersonation session'
      using errcode = '42501';
  end if;

  perform app.require_step_up('view a credential');

  select id into v_grant from public.credential_grant
  where credential_id = p_credential_id and profile_id = auth.uid()
    and revoked_at is null and expires_at > now()
  limit 1;

  v_audit := app.audit('credential.viewed', 'client_credential', p_credential_id::text,
    format('Revealed the %s credential "%s"', v_cred.kind, v_cred.label),
    null, null, v_cred.case_file_id);

  insert into public.credential_view (
    credential_id, viewed_by, viewed_by_email, via_grant_id, impersonation_id, audit_event_id
  )
  select p_credential_id, auth.uid(), p.email, v_grant, null, v_audit
  from public.profile p where p.id = auth.uid();

  select role into v_actor_role from public.profile where id = auth.uid();
  if v_actor_role <> 'owner' then
    perform app.raise_owner_alert('credential_viewed',
      format('%s revealed the %s credential "%s" on %s',
        (select email from public.profile where id = auth.uid()),
        v_cred.kind, v_cred.label,
        (select name from public.client_case_file where id = v_cred.case_file_id)),
      v_audit, auth.uid(), 'urgent');
  end if;

  select decrypted_secret into v_secret from vault.decrypted_secrets where id = v_cred.secret_id;

  return query select v_cred.label, v_cred.username, v_secret, v_cred.url;
end;
$$;

create or replace function public.rotate_credential(p_credential_id uuid, p_new_secret text)
returns public.client_credential
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.client_credential;
begin
  perform app.require('credentials.manage');
  perform app.require_step_up('rotate a credential');

  select * into v_row from public.client_credential where id = p_credential_id;
  if v_row.id is null then
    raise exception 'credential_not_found' using errcode = 'P0002';
  end if;
  if not app.in_scope_case_file(v_row.case_file_id) then
    raise exception 'out_of_scope: that client is not in your scope' using errcode = '42501';
  end if;

  perform vault.update_secret(v_row.secret_id, p_new_secret);

  update public.client_credential set last_rotated_at = now() where id = p_credential_id
  returning * into v_row;

  perform app.audit('credential.rotated', 'client_credential', p_credential_id::text,
    format('Rotated the %s credential "%s"', v_row.kind, v_row.label),
    null, null, v_row.case_file_id);

  return v_row;
end;
$$;

create or replace function public.grant_credential_access(
  p_credential_id uuid,
  p_profile_id uuid,
  p_expires_at timestamptz,
  p_reason text default null
)
returns public.credential_grant
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.credential_grant;
  v_cred public.client_credential;
begin
  perform app.require('credentials.grant');
  perform app.require_step_up('grant credential access');

  select * into v_cred from public.client_credential where id = p_credential_id and archived_at is null;
  if v_cred.id is null then
    raise exception 'credential_not_found' using errcode = 'P0002';
  end if;
  if p_expires_at is null or p_expires_at <= now() then
    raise exception 'expiry_required: credential access is always time limited' using errcode = '23514';
  end if;
  if p_expires_at > now() + interval '90 days' then
    raise exception 'expiry_too_far: credential access is granted for at most 90 days at a time'
      using errcode = '23514';
  end if;

  insert into public.credential_grant (credential_id, profile_id, expires_at, reason, granted_by)
  values (p_credential_id, p_profile_id, p_expires_at, nullif(btrim(coalesce(p_reason, '')), ''), auth.uid())
  returning * into v_row;

  perform app.audit('credential.access_granted', 'client_credential', p_credential_id::text,
    format('Gave %s access to "%s" until %s',
      (select email from public.profile where id = p_profile_id), v_cred.label, p_expires_at::date),
    null, jsonb_build_object('profile_id', p_profile_id, 'expires_at', p_expires_at),
    v_cred.case_file_id, p_profile_id);

  return v_row;
end;
$$;

create or replace function public.revoke_credential_access(p_grant_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.credential_grant;
begin
  perform app.require('credentials.grant');

  update public.credential_grant
     set revoked_at = now(), revoked_by = auth.uid()
   where id = p_grant_id and revoked_at is null
  returning * into v_row;

  if v_row.id is null then
    raise exception 'grant_not_found: that grant is already revoked or does not exist' using errcode = 'P0002';
  end if;

  perform app.audit('credential.access_revoked', 'client_credential', v_row.credential_id::text,
    'Revoked credential access', null, null, null, v_row.profile_id);
end;
$$;

create or replace function public.archive_credential(p_credential_id uuid)
returns public.client_credential
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.client_credential;
begin
  perform app.require('credentials.manage');

  update public.client_credential
     set archived_at = now(), archived_by = auth.uid()
   where id = p_credential_id and archived_at is null
  returning * into v_row;

  if v_row.id is null then
    raise exception 'credential_not_found' using errcode = 'P0002';
  end if;

  update public.credential_grant set revoked_at = now(), revoked_by = auth.uid()
  where credential_id = p_credential_id and revoked_at is null;

  perform app.audit('credential.archived', 'client_credential', p_credential_id::text,
    format('Archived the credential "%s"', v_row.label), null, null, v_row.case_file_id);

  return v_row;
end;
$$;

-- When an account is deactivated, everything they could have reached, so it can be
-- rotated. This is the list offboarding walks through.
create or replace function public.credentials_reachable_by(p_profile_id uuid)
returns table (
  credential_id uuid,
  client_name text,
  label text,
  kind text,
  reached_via text,
  last_rotated_at timestamptz,
  ever_viewed boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (c.id)
    c.id, cf.name, c.label, c.kind,
    case when g.id is not null then 'a time limited grant' else 'their scope and permission' end,
    c.last_rotated_at,
    exists (select 1 from public.credential_view v where v.credential_id = c.id and v.viewed_by = p_profile_id)
  from public.client_credential c
  join public.client_case_file cf on cf.id = c.case_file_id
  left join public.credential_grant g
    on g.credential_id = c.id and g.profile_id = p_profile_id and g.revoked_at is null
  left join public.account_scope s on s.profile_id = p_profile_id
  left join public.account_scope_client sc on sc.profile_id = p_profile_id and sc.case_file_id = c.case_file_id
  where c.archived_at is null
    and app.actor_can('credentials.manage')
    and (
      g.id is not null
      or (
        coalesce((select allowed from app.decide('credentials.view', p_profile_id) limit 1), false)
        and (s.kind = 'all_clients' or sc.case_file_id is not null)
      )
    )
  order by c.id, g.id nulls last;
$$;
