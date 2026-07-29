-- ---------------------------------------------------------------------------
-- Applications, which had nowhere to go.
--
-- Three of the six roles are configured to use the in-page form. That form did
-- this with what a candidate typed:
--
--   console.log('Form submitted:', formData);
--   setSubmitted(true);
--
-- and then told them "Application submitted. We'll get back to you within 5–7
-- business days." Every application to those roles was discarded, and the person
-- who wrote it was told the opposite. The other three roles post to Airtable and
-- were fine.
--
-- This is the door. It is the sixth in the specification's list of ways data
-- enters, and the only public one, so it is the only one that has to survive
-- being pointed at by anybody.
-- ---------------------------------------------------------------------------

create type public.application_status as enum ('new', 'reviewing', 'rejected', 'advanced', 'withdrawn');

create table public.role_application (
  id uuid primary key default gen_random_uuid(),
  -- The role slug as advertised. Deliberately not a foreign key: the postings
  -- live in the careers site, and closing a role must not delete the people who
  -- applied to it.
  role_slug text not null check (length(btrim(role_slug)) between 1 and 120),
  role_title text not null,

  full_name text not null check (length(btrim(full_name)) between 1 and 200),
  email text not null check (position('@' in email) > 1 and length(email) <= 320),
  phone text check (length(phone) <= 60),
  linkedin_url text check (length(linkedin_url) <= 500),
  portfolio_url text check (length(portfolio_url) <= 500),
  loom_url text check (length(loom_url) <= 500),
  experience text check (length(experience) <= 5000),
  why_you text check (length(why_you) <= 5000),
  availability text check (length(availability) <= 500),

  status public.application_status not null default 'new',
  reviewed_by uuid references public.profile (id),
  reviewed_at timestamptz,
  review_note text,

  received_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ip inet,
  user_agent text,

  -- One application per person per role. A candidate who submits twice has
  -- corrected themselves, not applied twice.
  unique (role_slug, email)
);

comment on table public.role_application is
  'Applications from the careers site. Previously logged to the browser console and thrown away while the candidate was told they had been received.';

create index role_application_role_idx on public.role_application (role_slug, received_at desc);
create index role_application_open_idx on public.role_application (received_at desc) where status = 'new';

create trigger role_application_touch before update on public.role_application
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Access
--
-- Admin only. An applicant is not an account and has nothing to sign in to, so
-- there is no self-read policy to write.
-- ---------------------------------------------------------------------------

alter table public.role_application enable row level security;

create policy role_application_admin_all on public.role_application
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

revoke all on public.role_application from anon;

-- ---------------------------------------------------------------------------
-- The door
--
-- Granted to anon, like the machine doors and attempt_sign_in(), because the
-- careers site is public and an applicant has no session. It is therefore the
-- most exposed function in the schema, so it validates rather than trusts, caps
-- every field, and cannot be used to read anything back.
-- ---------------------------------------------------------------------------

create or replace function public.submit_role_application(
  p_role_slug text,
  p_role_title text,
  p_full_name text,
  p_email text,
  p_phone text default null,
  p_linkedin_url text default null,
  p_portfolio_url text default null,
  p_loom_url text default null,
  p_experience text default null,
  p_why_you text default null,
  p_availability text default null,
  p_ip text default null,
  p_user_agent text default null
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
  v_slug text := btrim(coalesce(p_role_slug, ''));
  v_recent integer;
  v_id uuid;
  v_updated boolean;
begin
  if v_slug = '' then
    raise exception 'role_required: an application has to name the role it is for' using errcode = '23514';
  end if;

  if v_name = '' then
    raise exception 'name_required: tell us who you are' using errcode = '23514';
  end if;

  if position('@' in v_email) < 2 or position('.' in split_part(v_email, '@', 2)) < 2 then
    raise exception 'email_invalid: we need an address we can reply to' using errcode = '23514';
  end if;

  -- The one door anybody on the internet can knock on. A burst from one address
  -- is refused rather than allowed to fill the table.
  select count(*) into v_recent
  from public.role_application
  where email = v_email and received_at > now() - interval '1 hour';

  if v_recent >= 5 then
    raise exception 'too_many_applications: you have applied to several roles just now. Give it an hour, or reply to the confirmation instead.'
      using errcode = '53400';
  end if;

  insert into public.role_application (
    role_slug, role_title, full_name, email, phone,
    linkedin_url, portfolio_url, loom_url, experience, why_you, availability,
    ip, user_agent
  )
  values (
    v_slug,
    nullif(btrim(coalesce(p_role_title, '')), ''),
    v_name, v_email,
    nullif(btrim(coalesce(p_phone, '')), ''),
    nullif(btrim(coalesce(p_linkedin_url, '')), ''),
    nullif(btrim(coalesce(p_portfolio_url, '')), ''),
    nullif(btrim(coalesce(p_loom_url, '')), ''),
    nullif(btrim(coalesce(p_experience, '')), ''),
    nullif(btrim(coalesce(p_why_you, '')), ''),
    nullif(btrim(coalesce(p_availability, '')), ''),
    app.ingest_inet(p_ip),
    left(nullif(btrim(coalesce(p_user_agent, '')), ''), 500)
  )
  on conflict (role_slug, email) do update
    -- A second submission is a correction. It does not reset a review already
    -- under way, so status and reviewer are left alone.
    set full_name = excluded.full_name,
        phone = coalesce(excluded.phone, public.role_application.phone),
        linkedin_url = coalesce(excluded.linkedin_url, public.role_application.linkedin_url),
        portfolio_url = coalesce(excluded.portfolio_url, public.role_application.portfolio_url),
        loom_url = coalesce(excluded.loom_url, public.role_application.loom_url),
        experience = coalesce(excluded.experience, public.role_application.experience),
        why_you = coalesce(excluded.why_you, public.role_application.why_you),
        availability = coalesce(excluded.availability, public.role_application.availability)
  -- xmax is non-zero only on the row the conflict updated, so this distinguishes a
  -- correction from a first application exactly rather than by comparing clocks.
  returning id, (xmax <> 0) into v_id, v_updated;

  -- Visible immediately in the owner's alert inbox, because an application nobody
  -- can see is only marginally better than one that was thrown away.
  perform app.raise_owner_alert(
    'careers.application',
    format('%s applied for %s (%s)', v_name, coalesce(nullif(btrim(coalesce(p_role_title, '')), ''), v_slug), v_email),
    null, null, 'informational');

  return jsonb_build_object('id', v_id, 'updated', coalesce(v_updated, false));
end;
$$;

comment on function public.submit_role_application is
  'The public careers door. Granted to anon because an applicant has no session, so it validates and caps everything and returns no data it was not given.';

grant execute on function public.submit_role_application(
  text, text, text, text, text, text, text, text, text, text, text, text, text
) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Working through them
-- ---------------------------------------------------------------------------

create or replace function public.review_role_application(
  p_application_id uuid,
  p_status public.application_status,
  p_note text default null
)
returns public.role_application
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_before public.role_application;
  v_after public.role_application;
begin
  perform app.require_admin();

  select * into v_before from public.role_application where id = p_application_id;

  if v_before.id is null then
    raise exception 'application_not_found: %', p_application_id using errcode = 'P0002';
  end if;

  update public.role_application
     set status = p_status,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         review_note = nullif(btrim(coalesce(p_note, '')), '')
   where id = p_application_id
  returning * into v_after;

  perform app.audit('careers.application_reviewed', 'role_application', p_application_id::text,
    format('%s for %s moved to %s', v_after.full_name, v_after.role_slug, p_status),
    jsonb_build_object('status', v_before.status),
    jsonb_build_object('status', v_after.status, 'note', v_after.review_note));

  return v_after;
end;
$$;

revoke all on function public.review_role_application(uuid, public.application_status, text) from anon;
