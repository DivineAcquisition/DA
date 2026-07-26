-- A3 wants the funnel broken down by source, which tracking_metric_daily cannot
-- express because it has no source dimension. This is the ingestion landing zone
-- for the funnel itself.
create table public.tracking_funnel_daily (
  id uuid primary key default gen_random_uuid(),
  case_file_id uuid not null references public.client_case_file (id) on delete cascade,
  day date not null,
  source text not null,
  leads integer not null default 0,
  booked integer not null default 0,
  shows integer not null default 0,
  closed integer not null default 0,
  revenue numeric(12, 2) not null default 0,
  -- Revenue recovered from the dormant database, which costs no ad spend and is
  -- the number clients react to most.
  reactivation_revenue numeric(12, 2) not null default 0,
  ad_spend numeric(12, 2) not null default 0,
  -- Mean minutes to first human contact for leads arriving this day.
  avg_response_minutes numeric(10, 2),
  responded_within_standard integer not null default 0,
  ingested_at timestamptz not null default now(),
  unique (case_file_id, day, source)
);

create index tracking_funnel_daily_lookup_idx on public.tracking_funnel_daily (case_file_id, day desc);

alter table public.tracking_funnel_daily enable row level security;

create policy tracking_funnel_admin_all on public.tracking_funnel_daily
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

create policy tracking_funnel_client_read on public.tracking_funnel_daily
  for select to authenticated using (app.client_can_read(case_file_id));

-- Everything the client dashboard needs for a period, in one call.
create or replace function public.client_funnel(
  p_case_file_id uuid,
  p_period_start date,
  p_period_end date
)
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with rows_in_period as (
    select * from public.tracking_funnel_daily
    where case_file_id = p_case_file_id and day between p_period_start and p_period_end
  ),
  totals as (
    select coalesce(sum(leads), 0) as leads,
           coalesce(sum(booked), 0) as booked,
           coalesce(sum(shows), 0) as shows,
           coalesce(sum(closed), 0) as closed,
           coalesce(sum(revenue), 0) as revenue,
           coalesce(sum(reactivation_revenue), 0) as reactivation_revenue,
           coalesce(sum(ad_spend), 0) as ad_spend,
           coalesce(sum(responded_within_standard), 0) as within_standard,
           round(avg(avg_response_minutes), 1) as avg_response_minutes
    from rows_in_period
  ),
  by_source as (
    select source,
           sum(leads) as leads, sum(booked) as booked, sum(shows) as shows,
           sum(closed) as closed, sum(revenue) as revenue, sum(ad_spend) as ad_spend
    from rows_in_period group by source order by sum(leads) desc
  ),
  weekly as (
    select date_trunc('week', day)::date as week,
           sum(leads) as leads, sum(booked) as booked, sum(revenue) as revenue,
           round(avg(avg_response_minutes), 1) as avg_response_minutes
    from rows_in_period group by 1 order by 1
  )
  select jsonb_build_object(
    'period', jsonb_build_object('start', p_period_start, 'end', p_period_end),
    'totals', (select to_jsonb(t) from totals t),
    'rates', (
      select jsonb_build_object(
        'booking_rate', case when t.leads = 0 then null else round((t.booked::numeric / t.leads) * 100, 1) end,
        'show_rate', case when t.booked = 0 then null else round((t.shows::numeric / t.booked) * 100, 1) end,
        'close_rate', case when t.shows = 0 then null else round((t.closed::numeric / t.shows) * 100, 1) end,
        'response_compliance', case when t.leads = 0 then null else round((t.within_standard::numeric / t.leads) * 100, 1) end,
        'cost_per_lead', case when t.leads = 0 then null else round(t.ad_spend / t.leads, 2) end,
        'cost_per_booking', case when t.booked = 0 then null else round(t.ad_spend / t.booked, 2) end,
        'return_on_spend', case when t.ad_spend = 0 then null else round(t.revenue / t.ad_spend, 2) end
      ) from totals t
    ),
    'by_source', (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from by_source s),
    'weekly', (select coalesce(jsonb_agg(to_jsonb(w)), '[]'::jsonb) from weekly w)
  );
$$;

comment on function public.client_funnel is 'A3: the client''s own operational reality. Security invoker, so RLS decides whose data comes back.';

-- ---------------------------------------------------------------------------
-- Client account provisioning
-- ---------------------------------------------------------------------------

create or replace function public.invite_client(
  p_case_file_id uuid,
  p_email text,
  p_full_name text default null,
  p_job_title text default null,
  p_valid_days integer default 14
)
returns public.client_invite
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_invite public.client_invite;
begin
  if p_valid_days < 1 or p_valid_days > 30 then
    raise exception 'invite_window_invalid: an invite lasts between one and thirty days' using errcode = '23514';
  end if;

  -- Supersede any outstanding invite for the same address rather than leaving two
  -- live tokens for one person.
  update public.client_invite
     set revoked_at = now()
   where case_file_id = p_case_file_id
     and lower(email) = lower(p_email)
     and used_at is null and revoked_at is null;

  insert into public.client_invite (case_file_id, email, full_name, job_title, token, expires_at, invited_by)
  values (
    p_case_file_id, lower(trim(p_email)), p_full_name, p_job_title,
    encode(extensions.gen_random_bytes(24), 'hex'),
    now() + make_interval(days => p_valid_days),
    auth.uid()
  )
  returning * into v_invite;

  return v_invite;
end;
$$;

-- Called after the invited person has created their auth account. Definer
-- because the new user is not yet an admin and cannot see client_invite, but it
-- only ever acts on the caller''s own uuid and a token they had to possess.
create or replace function public.accept_client_invite(p_token text)
returns public.client_account
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.client_invite;
  v_account public.client_account;
  v_uid uuid := auth.uid();
  v_email text;
begin
  if v_uid is null then
    raise exception 'not_authenticated: create the account first, then accept the invite' using errcode = '42501';
  end if;

  select * into v_invite from public.client_invite
  where token = p_token and used_at is null and revoked_at is null;

  if v_invite.id is null then
    raise exception 'invite_invalid: this invitation has already been used, was revoked, or does not exist' using errcode = '23514';
  end if;

  if v_invite.expires_at < now() then
    raise exception 'invite_expired: this invitation expired on %. Ask DA for a new one.', v_invite.expires_at::date using errcode = '23514';
  end if;

  select email into v_email from auth.users where id = v_uid;

  if lower(coalesce(v_email, '')) <> lower(v_invite.email) then
    raise exception 'invite_email_mismatch: this invitation was issued to a different address' using errcode = '42501';
  end if;

  update public.profile set role = 'client', full_name = coalesce(full_name, v_invite.full_name) where id = v_uid;

  insert into public.client_account (profile_id, case_file_id, full_name, job_title, state, invited_by, accepted_at)
  values (v_uid, v_invite.case_file_id, v_invite.full_name, v_invite.job_title, 'active', v_invite.invited_by, now())
  on conflict (profile_id) do update
    set case_file_id = excluded.case_file_id, state = 'active', accepted_at = now()
  returning * into v_account;

  insert into public.client_notification_pref (profile_id) values (v_uid) on conflict do nothing;

  update public.client_invite set used_at = now() where id = v_invite.id;

  return v_account;
end;
$$;

-- Rule 9: ending an engagement moves accounts to read-only archived for a window
-- rather than cutting them off. Cutting a client off the day they cancel is how a
-- neutral ending becomes a bad review.
create or replace function public.archive_client_accounts(
  p_case_file_id uuid,
  p_window_days integer default 90
)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  update public.client_account
     set state = 'archived',
         access_until = current_date + p_window_days
   where case_file_id = p_case_file_id and state in ('active', 'suspended');
  get diagnostics v_count = row_count;

  update public.client_case_file set status = 'ended', engagement_end = current_date where id = p_case_file_id;

  return v_count;
end;
$$;

-- Accounts suspend automatically once billing has been failing past the
-- threshold, with the reason recorded so the messaging can explain itself.
create or replace function public.suspend_for_billing(p_threshold_days integer default 21)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_count integer := 0;
  v_case record;
begin
  for v_case in
    select distinct i.case_file_id, min(i.due_at) as oldest_due
    from public.invoice i
    where i.status in ('failed', 'overdue')
      and i.due_at is not null
      and i.due_at < current_date - p_threshold_days
    group by i.case_file_id
  loop
    update public.client_account
       set state = 'suspended',
           suspended_reason = format('An invoice has been unpaid since %s. Access resumes as soon as payment clears.', v_case.oldest_due)
     where case_file_id = v_case.case_file_id and state = 'active';

    v_count := v_count + 1;
  end loop;

  -- And restore anyone whose billing has since cleared.
  update public.client_account ca
     set state = 'active', suspended_reason = null
   where ca.state = 'suspended'
     and not exists (
       select 1 from public.invoice i
       where i.case_file_id = ca.case_file_id
         and i.status in ('failed', 'overdue')
         and i.due_at is not null
         and i.due_at < current_date - p_threshold_days
     );

  return v_count;
end;
$$;

-- Publishing is an explicit act. Until it happens, a client cannot see a report
-- however it was generated.
create or replace function public.publish_report(p_report_id uuid)
returns public.growth_report
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_report public.growth_report;
begin
  select * into v_report from public.growth_report where id = p_report_id;

  if v_report.id is null then
    raise exception 'report_not_found: %', p_report_id using errcode = 'P0002';
  end if;

  if v_report.mode <> 'client_facing' then
    raise exception 'only_client_facing_can_publish: this is a % report and contains internal material', v_report.mode using errcode = '23514';
  end if;

  update public.growth_report
     set published_to_client_at = coalesce(published_to_client_at, now()),
         published_by = coalesce(published_by, auth.uid())
   where id = p_report_id
  returning * into v_report;

  return v_report;
end;
$$;

comment on function public.publish_report is 'Refuses to publish an internal or case-study report, which by construction contain the effort log, scope disputes and internal notes.';

-- ---------------------------------------------------------------------------
-- A6: share links
-- ---------------------------------------------------------------------------

create or replace function public.create_dashboard_link(
  p_case_file_id uuid,
  p_label text default null,
  p_valid_days integer default 30,
  p_passphrase text default null
)
returns public.client_dashboard_link
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_link public.client_dashboard_link;
begin
  if p_valid_days < 1 or p_valid_days > 180 then
    raise exception 'link_window_invalid: a dashboard link lasts between one and one hundred and eighty days' using errcode = '23514';
  end if;

  insert into public.client_dashboard_link (case_file_id, token, label, expires_at, password_hash, created_by)
  values (
    p_case_file_id,
    encode(extensions.gen_random_bytes(24), 'hex'),
    p_label,
    now() + make_interval(days => p_valid_days),
    case when coalesce(nullif(trim(p_passphrase), ''), '') = '' then null
         else extensions.crypt(p_passphrase, extensions.gen_salt('bf')) end,
    auth.uid()
  )
  returning * into v_link;

  return v_link;
end;
$$;

-- Resolves a token to a case file and logs the view. Definer because the viewer
-- is not authenticated at all; it returns only the case file id, and only for a
-- token that is live and passes its passphrase.
create or replace function public.resolve_dashboard_link(
  p_token text,
  p_passphrase text default null,
  p_user_agent text default null
)
returns table (case_file_id uuid, label text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.client_dashboard_link;
begin
  select * into v_link from public.client_dashboard_link where token = p_token;

  if v_link.id is null then
    raise exception 'link_invalid: this link does not exist' using errcode = '42501';
  end if;

  if v_link.revoked_at is not null then
    raise exception 'link_revoked: this link was revoked on %', v_link.revoked_at::date using errcode = '42501';
  end if;

  if v_link.expires_at < now() then
    raise exception 'link_expired: this link expired on %', v_link.expires_at::date using errcode = '42501';
  end if;

  if v_link.password_hash is not null then
    if p_passphrase is null or extensions.crypt(p_passphrase, v_link.password_hash) <> v_link.password_hash then
      raise exception 'link_passphrase_required: this link is passphrase protected' using errcode = '42501';
    end if;
  end if;

  insert into public.client_dashboard_link_view (link_id, user_agent) values (v_link.id, p_user_agent);

  update public.client_dashboard_link
     set view_count = view_count + 1, last_viewed_at = now()
   where id = v_link.id;

  return query select v_link.case_file_id, v_link.label, v_link.expires_at;
end;
$$;

comment on function public.resolve_dashboard_link is 'A6: every view is logged with a timestamp. Returns a case file id only, never client data.';

create or replace function public.revoke_dashboard_link(p_link_id uuid)
returns void
language sql
security invoker
set search_path = public, pg_temp
as $$
  update public.client_dashboard_link set revoked_at = now() where id = p_link_id and revoked_at is null;
$$;

-- ---------------------------------------------------------------------------
-- A7: messages
-- ---------------------------------------------------------------------------

create or replace function public.send_client_message(
  p_case_file_id uuid,
  p_body text,
  p_response_hours integer default 24
)
returns public.client_message
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_message public.client_message;
  v_name text;
begin
  if coalesce(nullif(trim(p_body), ''), '') = '' then
    raise exception 'message_empty' using errcode = '23514';
  end if;

  select coalesce(full_name, email) into v_name from public.profile where id = auth.uid();

  insert into public.client_message (case_file_id, author_profile_id, author_name, body, response_due_at)
  values (p_case_file_id, auth.uid(), coalesce(v_name, 'Client'), trim(p_body), now() + make_interval(hours => p_response_hours))
  returning * into v_message;

  return v_message;
end;
$$;

create or replace function public.answer_client_message(p_message_id uuid, p_answer text)
returns public.client_message
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_message public.client_message;
begin
  update public.client_message
     set status = 'answered', answer = p_answer, answered_at = now(), answered_by = auth.uid()
   where id = p_message_id
  returning * into v_message;

  return v_message;
end;
$$;

revoke all on all functions in schema public from anon;
