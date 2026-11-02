-- One email log, four sender identities, and a suppression list.
-- App mail is recorded here before Resend accepts it. Bodies live in
-- email_outbox only until the send is accepted, then they are deleted.
-- DA Admin reads the log through the functions below. Nobody else can.

create table public.email_identity (
  purpose text primary key check (purpose in ('security', 'team', 'alerts', 'client')),
  display_name text not null,
  address text not null,
  reply_to text,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

comment on table public.email_identity is
  'Who each kind of app mail is from. Editable by DA Admin. The root domain is not used.';

insert into public.email_identity (purpose, display_name, address, reply_to) values
  ('security', 'Divine Acquisition', 'noreply@noreply.divineacquisition.io', null),
  ('team', 'DA Operations', 'ops@updates.divineacquisition.io', 'malik@divineacquisition.io'),
  ('alerts', 'DA Operations', 'alerts@updates.divineacquisition.io', 'malik@divineacquisition.io'),
  ('client', 'Divine Acquisition', 'reports@updates.divineacquisition.io', 'malik@divineacquisition.io');

create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  purpose text not null check (purpose in ('security', 'team', 'alerts', 'client')),
  status text not null check (status in (
    'queued', 'sent', 'delivered', 'bounced', 'complained', 'failed', 'suppressed', 'blocked', 'delayed'
  )),
  sender text not null,
  reply_to text,
  recipient text not null,
  recipients text[] not null default '{}',
  cc text[] not null default '{}',
  subject text not null,
  template text not null,
  event text not null,
  idempotency_key text not null unique,
  operator_id uuid,
  eod_id uuid,
  report_id uuid,
  client_id uuid,
  placement_id uuid,
  related_type text,
  related_id text,
  resend_id text,
  error text,
  attempt_count integer not null default 0,
  next_attempt_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  queued_at timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  bounced_at timestamptz,
  complained_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.email_log is
  'Every app email. Subject, template, and event only. The body is not stored here.';

create index email_log_status_due_idx on public.email_log (status, next_attempt_at, created_at);
create index email_log_resend_idx on public.email_log (resend_id);
create index email_log_created_idx on public.email_log (created_at desc);

create table public.email_outbox (
  log_id uuid primary key references public.email_log (id) on delete cascade,
  html text not null,
  text_body text not null,
  attachments jsonb not null default '[]'::jsonb
);

comment on table public.email_outbox is
  'Rendered content kept only so a failed send can be retried. Removed once Resend accepts the email.';

create table public.email_suppression (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  reason text not null check (reason in ('hard_bounce', 'complaint', 'manual')),
  detail text,
  source_log_id uuid,
  created_at timestamptz not null default now(),
  created_by uuid,
  lifted_at timestamptz,
  lifted_by uuid,
  lift_reason text
);

comment on table public.email_suppression is
  'Addresses we will not email. A hard bounce or a complaint lands here. DA Admin can lift one with a reason.';

create unique index email_suppression_active_idx on public.email_suppression (email) where lifted_at is null;

create table public.email_webhook_event (
  id text primary key,
  type text not null,
  resend_id text,
  log_id uuid,
  received_at timestamptz not null default now()
);

comment on table public.email_webhook_event is
  'Resend webhook ids we have already applied, so a retry does not suppress or alert twice.';

alter table public.email_identity enable row level security;
alter table public.email_log enable row level security;
alter table public.email_outbox enable row level security;
alter table public.email_suppression enable row level security;
alter table public.email_webhook_event enable row level security;

revoke all on public.email_identity from anon, authenticated;
revoke all on public.email_log from anon, authenticated;
revoke all on public.email_outbox from anon, authenticated;
revoke all on public.email_suppression from anon, authenticated;
revoke all on public.email_webhook_event from anon, authenticated;

grant select, insert, update, delete on public.email_identity to service_role;
grant select, insert, update, delete on public.email_log to service_role;
grant select, insert, update, delete on public.email_outbox to service_role;
grant select, insert, update, delete on public.email_suppression to service_role;
grant select, insert, update, delete on public.email_webhook_event to service_role;
grant insert on public.staff_notification to service_role;

-- DA Admin -------------------------------------------------------------------

create or replace function public.email_log_list(
  p_purpose text,
  p_status text,
  p_recipient text,
  p_from date,
  p_to date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_rows jsonb;
  v_recipient text := nullif(lower(btrim(coalesce(p_recipient, ''))), '');
begin
  if not app.is_admin() or app.is_impersonating() then
    raise exception 'admin_required: the email log is for DA Admin' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', l.id, 'purpose', l.purpose, 'status', l.status, 'sender', l.sender,
    'reply_to', l.reply_to, 'recipient', l.recipient, 'subject', l.subject,
    'template', l.template, 'event', l.event, 'resend_id', l.resend_id,
    'error', l.error, 'attempt_count', l.attempt_count,
    'operator_id', l.operator_id, 'eod_id', l.eod_id, 'report_id', l.report_id,
    'client_id', l.client_id, 'placement_id', l.placement_id,
    'related_type', l.related_type, 'related_id', l.related_id,
    'queued_at', l.queued_at, 'sent_at', l.sent_at, 'delivered_at', l.delivered_at,
    'failed_at', l.failed_at, 'created_at', l.created_at
  ) order by l.created_at desc), '[]'::jsonb)
  into v_rows
  from (
    select *
    from public.email_log l
    where (p_purpose is null or p_purpose = '' or l.purpose = p_purpose)
      and (p_status is null or p_status = '' or l.status = p_status)
      and (p_from is null or l.created_at::date >= p_from)
      and (p_to is null or l.created_at::date <= p_to)
      and (
        v_recipient is null
        or l.recipient ilike '%' || v_recipient || '%'
        or exists (select 1 from unnest(l.recipients) r where r ilike '%' || v_recipient || '%')
      )
    order by l.created_at desc
    limit 200
  ) l;
  return v_rows;
end;
$$;

create or replace function public.email_identity_list()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app.is_admin() or app.is_impersonating() then
    raise exception 'admin_required: email senders are for DA Admin' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'purpose', purpose, 'display_name', display_name, 'address', address, 'reply_to', reply_to
    ) order by case purpose when 'security' then 1 when 'team' then 2 when 'alerts' then 3 else 4 end)
    from public.email_identity
  ), '[]'::jsonb);
end;
$$;

create or replace function public.email_identity_save(
  p_purpose text,
  p_display_name text,
  p_address text,
  p_reply_to text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_address text := lower(btrim(coalesce(p_address, '')));
  v_name text := btrim(coalesce(p_display_name, ''));
  v_reply text := nullif(lower(btrim(coalesce(p_reply_to, ''))), '');
  v_domain text;
begin
  if not app.is_admin() or app.is_impersonating() then
    raise exception 'admin_required: only DA Admin edits email senders' using errcode = '42501';
  end if;
  if p_purpose not in ('security', 'team', 'alerts', 'client') then
    raise exception 'invalid_purpose: choose security, team, alerts, or client' using errcode = '23514';
  end if;
  if v_name = '' or v_name ~ '[<>]' or position(E'\n' in v_name) > 0 then
    raise exception 'invalid_name: the sender name cannot include a line break or angle brackets' using errcode = '23514';
  end if;
  if v_address !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_address: enter a real from address' using errcode = '23514';
  end if;
  v_domain := split_part(v_address, '@', 2);
  if p_purpose = 'security' then
    if v_domain <> 'noreply.divineacquisition.io' then
      raise exception 'invalid_domain: security mail uses noreply.divineacquisition.io' using errcode = '23514';
    end if;
    v_reply := null;
  elsif v_domain <> 'updates.divineacquisition.io' then
    raise exception 'invalid_domain: this mail uses updates.divineacquisition.io' using errcode = '23514';
  elsif v_reply is null or v_reply !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_reply: operational mail needs a reply-to inbox' using errcode = '23514';
  end if;
  update public.email_identity
     set display_name = v_name, address = v_address, reply_to = v_reply, updated_at = now(), updated_by = auth.uid()
   where purpose = p_purpose;
  perform app.audit('email.identity', 'email_identity', p_purpose, 'Updated an email sender',
    null, jsonb_build_object('address', v_address, 'reply_to', v_reply), null);
end;
$$;

create or replace function public.email_suppression_list()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app.is_admin() or app.is_impersonating() then
    raise exception 'admin_required: the suppression list is for DA Admin' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'email', email, 'reason', reason, 'detail', detail, 'created_at', created_at
    ) order by created_at desc)
    from public.email_suppression
    where lifted_at is null
  ), '[]'::jsonb);
end;
$$;

create or replace function public.email_suppression_lift(p_email text, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if not app.is_admin() or app.is_impersonating() then
    raise exception 'admin_required: only DA Admin lifts a suppression' using errcode = '42501';
  end if;
  if length(v_reason) < 3 then
    raise exception 'reason_required: write why this address can receive mail again' using errcode = '23514';
  end if;
  update public.email_suppression
     set lifted_at = now(), lifted_by = auth.uid(), lift_reason = v_reason
   where email = v_email and lifted_at is null;
  if not found then
    raise exception 'not_found: that address is not suppressed' using errcode = 'P0002';
  end if;
  perform app.audit('email.suppression_lift', 'email_suppression', v_email, 'Removed an address from the suppression list',
    null, jsonb_build_object('reason', v_reason), null);
end;
$$;

-- Queue ----------------------------------------------------------------------

create or replace function public.email_claim_due(p_limit integer default 20)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows jsonb;
begin
  with due as (
    select l.id
    from public.email_log l
    where l.status in ('queued', 'failed')
      and l.attempt_count < 8
      and (l.next_attempt_at is null or l.next_attempt_at <= now())
      and (l.updated_at < now() - interval '2 minutes' or l.status = 'failed')
    order by l.created_at
    limit greatest(coalesce(p_limit, 20), 1)
    for update skip locked
  ),
  claimed as (
    update public.email_log l
       set updated_at = now()
      from due
     where l.id = due.id
    returning l.id
  )
  select coalesce(jsonb_agg(id), '[]'::jsonb) into v_rows from claimed;
  return v_rows;
end;
$$;

-- A preview send must not consume a real operator notification.
create or replace function public.notify_release_email_claims(p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.operator_notification n
     set email_claimed_at = null
   where n.id = any (coalesce(p_ids, '{}'::uuid[]))
     and not exists (
       select 1 from public.notification_attempt a
       where a.notification_id = n.id and a.channel = 'email' and a.status = 'delivered'
     );
end;
$$;

revoke all on function public.email_log_list(text, text, text, date, date) from public, anon;
revoke all on function public.email_identity_list() from public, anon;
revoke all on function public.email_identity_save(text, text, text, text) from public, anon;
revoke all on function public.email_suppression_list() from public, anon;
revoke all on function public.email_suppression_lift(text, text) from public, anon;
revoke all on function public.email_claim_due(integer) from public, anon, authenticated;
revoke all on function public.notify_release_email_claims(uuid[]) from public, anon, authenticated;

grant execute on function public.email_log_list(text, text, text, date, date) to authenticated;
grant execute on function public.email_identity_list() to authenticated;
grant execute on function public.email_identity_save(text, text, text, text) to authenticated;
grant execute on function public.email_suppression_list() to authenticated;
grant execute on function public.email_suppression_lift(text, text) to authenticated;
grant execute on function public.email_claim_due(integer) to service_role;
grant execute on function public.notify_release_email_claims(uuid[]) to service_role;
