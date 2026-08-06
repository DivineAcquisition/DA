-- ---------------------------------------------------------------------------
-- Divine Acquisition admin workspace
-- Agreements (DocuSeal), tokenized custom pages, tokenized calendar links.
-- Admin-only. Public access is via security-definer RPCs that never distinguish
-- expired / revoked / unknown tokens.
-- ---------------------------------------------------------------------------

create table public.da_recipient (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(btrim(full_name)) between 1 and 200),
  email text not null check (position('@' in email) > 1 and length(email) <= 320),
  phone text check (phone is null or length(btrim(phone)) between 1 and 40),
  recipient_type text not null check (recipient_type in ('client', 'operator')),
  business_name text check (business_name is null or length(btrim(business_name)) between 1 and 200),
  status text not null default 'active' check (status in ('active', 'inactive')),
  notes text check (notes is null or length(notes) <= 5000),
  created_at timestamptz not null default now(),
  constraint da_recipient_client_business_chk check (
    recipient_type <> 'client' or (business_name is not null and length(btrim(business_name)) >= 1)
  )
);

create index da_recipient_type_status_idx on public.da_recipient (recipient_type, status);
create index da_recipient_search_idx on public.da_recipient (lower(full_name), lower(email), lower(coalesce(business_name, '')));

create table public.da_page_template (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 200),
  title text not null check (length(btrim(title)) between 1 and 300),
  body_markdown text not null default '',
  variables text[] not null default array['recipient_name', 'business_name', 'email', 'date']::text[],
  created_at timestamptz not null default now()
);

create table public.da_agreement_template (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 200),
  description text not null default '',
  recipient_type text not null check (recipient_type in ('client', 'operator')),
  docuseal_template_id text not null check (length(btrim(docuseal_template_id)) between 1 and 120),
  created_at timestamptz not null default now()
);

create table public.da_agreement_template_page (
  id uuid primary key default gen_random_uuid(),
  agreement_template_id uuid not null references public.da_agreement_template (id) on delete cascade,
  page_template_id uuid not null references public.da_page_template (id) on delete restrict,
  -- DocuSeal field name that receives the public page URL on send.
  -- Gap: brief does not name the field convention; administrators set this explicitly.
  docuseal_field_name text not null check (length(btrim(docuseal_field_name)) between 1 and 200),
  sort_order integer not null default 0,
  unique (agreement_template_id, page_template_id),
  unique (agreement_template_id, docuseal_field_name)
);

create table public.da_agreement (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.da_recipient (id) on delete restrict,
  template_id uuid not null references public.da_agreement_template (id) on delete restrict,
  docuseal_submission_id text,
  signing_url text,
  status text not null default 'sent'
    check (status in ('sent', 'viewed', 'completed', 'declined', 'expired')),
  sent_at timestamptz not null default now(),
  viewed_at timestamptz,
  completed_at timestamptz,
  signed_document_url text,
  superseded_by_id uuid references public.da_agreement (id),
  created_at timestamptz not null default now()
);

create index da_agreement_recipient_idx on public.da_agreement (recipient_id, sent_at desc);
create index da_agreement_status_idx on public.da_agreement (status, sent_at desc);
create index da_agreement_submission_idx on public.da_agreement (docuseal_submission_id);

create table public.da_page_token (
  id uuid primary key default gen_random_uuid(),
  page_template_id uuid not null references public.da_page_template (id) on delete restrict,
  recipient_id uuid not null references public.da_recipient (id) on delete restrict,
  agreement_id uuid references public.da_agreement (id) on delete set null,
  token text not null unique check (length(token) >= 32),
  resolved_values jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  revoked boolean not null default false,
  view_count integer not null default 0 check (view_count >= 0),
  first_viewed_at timestamptz,
  last_viewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index da_page_token_recipient_idx on public.da_page_token (recipient_id, created_at desc);
create index da_page_token_page_idx on public.da_page_token (page_template_id, created_at desc);

create table public.da_calendar_link (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 200),
  destination_url text not null check (length(btrim(destination_url)) between 1 and 2000),
  recipient_id uuid not null references public.da_recipient (id) on delete restrict,
  token text not null unique check (length(token) >= 32),
  expires_at timestamptz,
  revoked boolean not null default false,
  click_count integer not null default 0 check (click_count >= 0),
  first_clicked_at timestamptz,
  last_clicked_at timestamptz,
  created_at timestamptz not null default now()
);

create index da_calendar_link_recipient_idx on public.da_calendar_link (recipient_id, created_at desc);

create table public.da_settings (
  id integer primary key default 1 check (id = 1),
  docuseal_api_key text not null default '',
  docuseal_account_id text not null default '',
  docuseal_webhook_secret text not null default '',
  default_booking_url text not null default '',
  public_base_url text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.da_settings (id) values (1);

create table public.da_webhook_log (
  id uuid primary key default gen_random_uuid(),
  payload jsonb not null,
  headers jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed boolean not null default false,
  error text
);

-- RLS -----------------------------------------------------------------------

alter table public.da_recipient enable row level security;
alter table public.da_page_template enable row level security;
alter table public.da_agreement_template enable row level security;
alter table public.da_agreement_template_page enable row level security;
alter table public.da_agreement enable row level security;
alter table public.da_page_token enable row level security;
alter table public.da_calendar_link enable row level security;
alter table public.da_settings enable row level security;
alter table public.da_webhook_log enable row level security;

create policy da_recipient_admin_all on public.da_recipient
  for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy da_page_template_admin_all on public.da_page_template
  for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy da_agreement_template_admin_all on public.da_agreement_template
  for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy da_agreement_template_page_admin_all on public.da_agreement_template_page
  for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy da_agreement_admin_all on public.da_agreement
  for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy da_page_token_admin_all on public.da_page_token
  for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy da_calendar_link_admin_all on public.da_calendar_link
  for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy da_settings_admin_all on public.da_settings
  for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy da_webhook_log_admin_select on public.da_webhook_log
  for select to authenticated using (app.is_admin());

revoke all on public.da_recipient from anon, authenticated;
revoke all on public.da_page_template from anon, authenticated;
revoke all on public.da_agreement_template from anon, authenticated;
revoke all on public.da_agreement_template_page from anon, authenticated;
revoke all on public.da_agreement from anon, authenticated;
revoke all on public.da_page_token from anon, authenticated;
revoke all on public.da_calendar_link from anon, authenticated;
revoke all on public.da_settings from anon, authenticated;
revoke all on public.da_webhook_log from anon, authenticated;

grant select, insert, update, delete on public.da_recipient to authenticated;
grant select, insert, update, delete on public.da_page_template to authenticated;
grant select, insert, update, delete on public.da_agreement_template to authenticated;
grant select, insert, update, delete on public.da_agreement_template_page to authenticated;
grant select, insert, update, delete on public.da_agreement to authenticated;
grant select, insert, update, delete on public.da_page_token to authenticated;
grant select, insert, update, delete on public.da_calendar_link to authenticated;
grant select, insert, update, delete on public.da_settings to authenticated;
grant select on public.da_webhook_log to authenticated;

-- Public page resolve: identical failure for missing / expired / revoked.
create or replace function public.da_resolve_page_token(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_token text := btrim(coalesce(p_token, ''));
  v_row public.da_page_token%rowtype;
  v_page public.da_page_template%rowtype;
begin
  if length(v_token) < 32 then
    return null;
  end if;

  select * into v_row from public.da_page_token where token = v_token;
  if not found then
    return null;
  end if;

  if v_row.revoked or (v_row.expires_at is not null and v_row.expires_at <= now()) then
    return null;
  end if;

  select * into v_page from public.da_page_template where id = v_row.page_template_id;
  if not found then
    return null;
  end if;

  update public.da_page_token
     set view_count = view_count + 1,
         first_viewed_at = coalesce(first_viewed_at, now()),
         last_viewed_at = now()
   where id = v_row.id;

  return jsonb_build_object(
    'title', v_page.title,
    'body_markdown', v_page.body_markdown,
    'resolved_values', v_row.resolved_values,
    'variables', to_jsonb(v_page.variables)
  );
end;
$$;

revoke all on function public.da_resolve_page_token(text) from public;
grant execute on function public.da_resolve_page_token(text) to anon, authenticated;

-- Public calendar resolve: identical failure for missing / expired / revoked.
create or replace function public.da_resolve_calendar_token(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_token text := btrim(coalesce(p_token, ''));
  v_row public.da_calendar_link%rowtype;
begin
  if length(v_token) < 32 then
    return null;
  end if;

  select * into v_row from public.da_calendar_link where token = v_token;
  if not found then
    return null;
  end if;

  if v_row.revoked or (v_row.expires_at is not null and v_row.expires_at <= now()) then
    return null;
  end if;

  update public.da_calendar_link
     set click_count = click_count + 1,
         first_clicked_at = coalesce(first_clicked_at, now()),
         last_clicked_at = now()
   where id = v_row.id;

  return jsonb_build_object(
    'destination_url', v_row.destination_url
  );
end;
$$;

revoke all on function public.da_resolve_calendar_token(text) from public;
grant execute on function public.da_resolve_calendar_token(text) to anon, authenticated;

-- Webhook helpers (service role / security definer — no session on the door).
create or replace function public.da_log_webhook_payload(p_payload jsonb, p_headers jsonb default '{}'::jsonb)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.da_webhook_log (payload, headers)
  values (coalesce(p_payload, '{}'::jsonb), coalesce(p_headers, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.da_log_webhook_payload(jsonb, jsonb) from public;
grant execute on function public.da_log_webhook_payload(jsonb, jsonb) to anon, authenticated, service_role;

create or replace function public.da_get_webhook_secret()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select docuseal_webhook_secret from public.da_settings where id = 1;
$$;

revoke all on function public.da_get_webhook_secret() from public;
grant execute on function public.da_get_webhook_secret() to anon, authenticated, service_role;

create or replace function public.da_apply_agreement_webhook(
  p_submission_id text,
  p_status text,
  p_signed_document_url text default null,
  p_log_id uuid default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_status text := lower(btrim(coalesce(p_status, '')));
  v_updated integer;
begin
  if v_status not in ('sent', 'viewed', 'completed', 'declined', 'expired') then
    if p_log_id is not null then
      update public.da_webhook_log
         set processed = false, error = 'unrecognised status: ' || v_status
       where id = p_log_id;
    end if;
    return false;
  end if;

  update public.da_agreement
     set status = v_status,
         viewed_at = case
           when v_status = 'viewed' then coalesce(viewed_at, now())
           when v_status = 'completed' then coalesce(viewed_at, now())
           else viewed_at
         end,
         completed_at = case
           when v_status = 'completed' then coalesce(completed_at, now())
           else completed_at
         end,
         signed_document_url = case
           when v_status = 'completed' and p_signed_document_url is not null
             then p_signed_document_url
           else signed_document_url
         end
   where docuseal_submission_id = btrim(p_submission_id)
     and superseded_by_id is null;

  get diagnostics v_updated = row_count;

  if p_log_id is not null then
    update public.da_webhook_log
       set processed = v_updated > 0,
           error = case when v_updated > 0 then null else 'no matching agreement' end
     where id = p_log_id;
  end if;

  return v_updated > 0;
end;
$$;

revoke all on function public.da_apply_agreement_webhook(text, text, text, uuid) from public;
grant execute on function public.da_apply_agreement_webhook(text, text, text, uuid) to anon, authenticated, service_role;
