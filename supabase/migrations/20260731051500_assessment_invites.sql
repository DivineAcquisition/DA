-- ---------------------------------------------------------------------------
-- Assessment interview invites
--
-- Operators send a candidate a personal booking link that expires in 24 hours.
-- The raw token is returned once at create time; only the hash is stored.
-- ---------------------------------------------------------------------------

create table public.assessment_invite (
  id uuid primary key default gen_random_uuid(),
  email text not null check (position('@' in email) > 1 and length(email) <= 320),
  full_name text not null check (length(btrim(full_name)) between 1 and 200),
  company_name text check (company_name is null or length(btrim(company_name)) between 1 and 200),
  note text check (note is null or length(note) <= 2000),
  token_hash text not null unique,
  created_by uuid references public.profile (id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  opened_at timestamptz,
  used_at timestamptz,
  revoked_at timestamptz,
  resend_email_id text,
  ghl_contact_id text,
  last_sent_at timestamptz not null default now()
);

comment on table public.assessment_invite is
  'Tokenized SDR/operator assessment booking links. Valid for 24 hours from send.';

create index assessment_invite_email_idx
  on public.assessment_invite (lower(email), created_at desc);

create index assessment_invite_live_idx
  on public.assessment_invite (expires_at desc)
  where revoked_at is null;

alter table public.assessment_invite enable row level security;

create policy assessment_invite_admin_all on public.assessment_invite
  for all to authenticated
  using (app.is_admin())
  with check (app.is_admin());

revoke all on public.assessment_invite from anon;
revoke all on public.assessment_invite from authenticated;
grant select, insert, update on public.assessment_invite to authenticated;

-- ---------------------------------------------------------------------------
-- Create + send prep. Returns the raw token exactly once.
-- ---------------------------------------------------------------------------

create or replace function public.create_assessment_invite(
  p_email text,
  p_full_name text,
  p_company_name text default null,
  p_note text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_name text := btrim(coalesce(p_full_name, ''));
  v_company text := nullif(btrim(coalesce(p_company_name, '')), '');
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_id uuid;
  v_expires timestamptz := now() + interval '24 hours';
begin
  if not app.is_admin() then
    raise exception 'admin_required: only an admin can create assessment invites'
      using errcode = '42501';
  end if;

  if v_email = '' or position('@' in v_email) < 2 then
    raise exception 'email_required: an assessment invite needs a valid email'
      using errcode = '23514';
  end if;

  if v_name = '' then
    raise exception 'name_required: an assessment invite needs a name'
      using errcode = '23514';
  end if;

  insert into public.assessment_invite (
    email, full_name, company_name, note, token_hash, created_by, expires_at
  ) values (
    v_email, v_name, v_company, v_note, app.hash_token(v_token), auth.uid(), v_expires
  )
  returning id into v_id;

  return jsonb_build_object(
    'id', v_id,
    'token', v_token,
    'email', v_email,
    'full_name', v_name,
    'company_name', v_company,
    'expires_at', v_expires
  );
end;
$$;

revoke all on function public.create_assessment_invite(text, text, text, text) from public;
grant execute on function public.create_assessment_invite(text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Public validation for the talent booking page (no session).
-- ---------------------------------------------------------------------------

create or replace function public.validate_assessment_invite(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_token text := btrim(coalesce(p_token, ''));
  v public.assessment_invite%rowtype;
begin
  if length(v_token) < 32 then
    raise exception 'invalid_link: this booking link is not valid'
      using errcode = '22023';
  end if;

  select * into v
  from public.assessment_invite
  where token_hash = app.hash_token(v_token);

  if not found then
    raise exception 'invalid_link: this booking link is not valid'
      using errcode = '22023';
  end if;

  if v.revoked_at is not null then
    raise exception 'link_revoked: this booking link has been revoked'
      using errcode = '22023';
  end if;

  if v.expires_at <= now() then
    raise exception 'link_expired: this booking link expired after 24 hours'
      using errcode = '22023';
  end if;

  if v.opened_at is null then
    update public.assessment_invite
       set opened_at = now()
     where id = v.id;
  end if;

  return jsonb_build_object(
    'id', v.id,
    'full_name', v.full_name,
    'email', v.email,
    'company_name', v.company_name,
    'expires_at', v.expires_at,
    'used_at', v.used_at
  );
end;
$$;

revoke all on function public.validate_assessment_invite(text) from public;
grant execute on function public.validate_assessment_invite(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Mark booked (called from thank-you page when token is present).
-- ---------------------------------------------------------------------------

create or replace function public.mark_assessment_invite_used(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_token text := btrim(coalesce(p_token, ''));
  v_id uuid;
begin
  update public.assessment_invite
     set used_at = coalesce(used_at, now())
   where token_hash = app.hash_token(v_token)
     and revoked_at is null
     and expires_at > now()
  returning id into v_id;

  if v_id is null then
    raise exception 'invalid_link: this booking link is not valid'
      using errcode = '22023';
  end if;

  return jsonb_build_object('id', v_id, 'used', true);
end;
$$;

revoke all on function public.mark_assessment_invite_used(text) from public;
grant execute on function public.mark_assessment_invite_used(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Persist Resend / GHL ids after a successful send.
-- ---------------------------------------------------------------------------

create or replace function public.record_assessment_invite_delivery(
  p_invite_id uuid,
  p_resend_email_id text default null,
  p_ghl_contact_id text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not app.is_admin() then
    raise exception 'admin_required: only an admin can record invite delivery'
      using errcode = '42501';
  end if;

  update public.assessment_invite
     set resend_email_id = coalesce(p_resend_email_id, resend_email_id),
         ghl_contact_id = coalesce(p_ghl_contact_id, ghl_contact_id),
         last_sent_at = now()
   where id = p_invite_id;
end;
$$;

revoke all on function public.record_assessment_invite_delivery(uuid, text, text) from public;
grant execute on function public.record_assessment_invite_delivery(uuid, text, text) to authenticated;

create or replace function public.list_assessment_invites(p_limit integer default 25)
returns setof public.assessment_invite
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app.is_admin() then
    raise exception 'admin_required: only an admin can list assessment invites'
      using errcode = '42501';
  end if;

  return query
    select *
    from public.assessment_invite
    order by created_at desc
    limit greatest(1, least(coalesce(p_limit, 25), 100));
end;
$$;

revoke all on function public.list_assessment_invites(integer) from public;
grant execute on function public.list_assessment_invites(integer) to authenticated;
