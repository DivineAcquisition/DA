-- Phase 3: every inquiry lands in the workspace Pipeline.
--
-- Site forms (the Sales Operations Diagnostic and the pre-discovery
-- questionnaire) and the GHL-only acq forms (sales operations review,
-- cleaning audit) now also write the lead here, keyed by email, the moment
-- they are submitted. The booking webhook already moves a da_leads row by
-- email, so a booking made after the form shows on the lead without more work.
--
-- site_inquiry keeps each submission's answers. Discovery calls are logged in
-- da_prospect_call against the lead.

create table if not exists public.site_inquiry (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('diagnostic', 'discovery', 'sales_review', 'cleaning_audit')),
  lead_id uuid references public.da_leads (id) on delete set null,
  email text not null check (position('@' in email) > 1 and length(email) <= 320),
  full_name text check (full_name is null or length(full_name) <= 200),
  company text check (company is null or length(company) <= 200),
  phone text check (phone is null or length(phone) <= 40),
  answers jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists site_inquiry_lead_idx on public.site_inquiry (lead_id, created_at desc);
create index if not exists site_inquiry_email_idx on public.site_inquiry (lower(email), created_at desc);

alter table public.site_inquiry enable row level security;
drop policy if exists site_inquiry_admin_read on public.site_inquiry;
create policy site_inquiry_admin_read on public.site_inquiry for select to authenticated using (app.is_admin());
revoke all on public.site_inquiry from public, anon;
grant select on public.site_inquiry to authenticated;
grant select, insert, update on public.site_inquiry to service_role;

create or replace function app.inquiry_source(p_kind text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_kind
    when 'diagnostic' then 'Sales Operations Diagnostic'
    when 'discovery' then 'Sales Operations Diagnostic'
    when 'sales_review' then 'Sales Operations Review'
    when 'cleaning_audit' then 'Cleaning Audit'
    else 'Website'
  end;
$$;

-- Called by the app with the service role when a form is submitted.
-- Creates or updates the lead for this email and keeps the answers.
create or replace function public.site_capture_inquiry(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text := coalesce(p ->> 'kind', '');
  v_email text := lower(btrim(coalesce(p ->> 'email', '')));
  v_name text := nullif(left(btrim(coalesce(p ->> 'full_name', '')), 200), '');
  v_company text := nullif(left(btrim(coalesce(p ->> 'company', '')), 200), '');
  v_phone text := nullif(left(btrim(coalesce(p ->> 'phone', '')), 40), '');
  v_ghl text := nullif(left(btrim(coalesce(p ->> 'ghl_contact_id', '')), 80), '');
  v_id uuid := coalesce(nullif(p ->> 'inquiry_id', '')::uuid, gen_random_uuid());
  v_answers jsonb := case when jsonb_typeof(p -> 'answers') = 'array' then p -> 'answers' else '[]'::jsonb end;
  v_stage text := case when v_kind in ('sales_review', 'cleaning_audit') then 'Manual Review' else 'Qualified - Not Booked' end;
  v_lead public.da_leads;
begin
  if v_kind not in ('diagnostic', 'discovery', 'sales_review', 'cleaning_audit') then
    raise exception 'invalid: unknown inquiry kind' using errcode = '23514';
  end if;
  if position('@' in v_email) <= 1 or length(v_email) > 320 then
    raise exception 'invalid: an email is required' using errcode = '23514';
  end if;

  select * into v_lead from public.da_leads where lower(email) = v_email and email <> '' for update;

  if v_lead.id is null then
    insert into public.da_leads (full_name, email, phone, company_name, stage, ghl_contact_id, next_action, payload)
    values (
      coalesce(v_name, ''), v_email, coalesce(v_phone, ''), coalesce(v_company, ''), v_stage, coalesce(v_ghl, ''),
      case when v_stage = 'Manual Review' then 'Review the request and reach out' else 'Book the diagnostic call' end,
      jsonb_build_object('source', app.inquiry_source(v_kind), 'origin', 'site', 'first_inquiry', v_kind)
    )
    returning * into v_lead;
  else
    update public.da_leads l
       set full_name = case when coalesce(btrim(l.full_name), '') = '' then coalesce(v_name, '') else l.full_name end,
           phone = case when coalesce(btrim(l.phone), '') = '' then coalesce(v_phone, '') else l.phone end,
           company_name = case when coalesce(btrim(l.company_name), '') = '' then coalesce(v_company, '') else l.company_name end,
           ghl_contact_id = case when coalesce(btrim(l.ghl_contact_id), '') = '' then coalesce(v_ghl, '') else l.ghl_contact_id end,
           -- A new request reopens a lead that was closed out, except a won one.
           stage = case
             when v_kind <> 'discovery' and l.stage in ('Disqualified', 'Closed Lost', 'Recycled', 'Application Abandoned', 'Step 1 Captured') then v_stage
             else l.stage
           end,
           payload = coalesce(l.payload, '{}'::jsonb) || jsonb_build_object('last_inquiry', v_kind, 'last_inquiry_at', now())
     where l.id = v_lead.id
    returning * into v_lead;
  end if;

  insert into public.site_inquiry (id, kind, lead_id, email, full_name, company, phone, answers)
  values (v_id, v_kind, v_lead.id, v_email, v_name, v_company, v_phone, v_answers)
  on conflict (id) do nothing;

  return v_lead.id;
end;
$$;

-- Pipeline desk ---------------------------------------------------------------

create or replace function app.lead_booking(p_lead public.da_leads)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'status', b.status,
    'starts_at', b.starts_at,
    'time_zone', b.time_zone,
    'meeting_link', nullif(b.meeting_link, '')
  )
  from public.booking_message_bookings b
  join public.booking_message_people pe on pe.id = b.person_id
  where pe.da_lead_id = p_lead.id
     or (coalesce(p_lead.email, '') <> '' and lower(pe.email) = lower(p_lead.email))
  order by b.updated_at desc nulls last, b.starts_at desc nulls last
  limit 1;
$$;

create or replace function public.so_pipeline(p_view text default 'open')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.is_admin() then
    raise exception 'forbidden: only DA Admin can open the pipeline' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(row_data order by (row_data ->> 'last_activity') desc)
    from (
      select jsonb_build_object(
        'id', l.id,
        'full_name', nullif(l.full_name, ''),
        'email', nullif(l.email, ''),
        'phone', nullif(l.phone, ''),
        'company', nullif(l.company_name, ''),
        'stage', l.stage,
        'source', coalesce(nullif(l.payload ->> 'source', ''), 'Acquisition'),
        'next_action', nullif(l.next_action, ''),
        'created_at', l.created_at,
        'booking', app.lead_booking(l),
        'inquiries', (select count(*) from public.site_inquiry i where i.lead_id = l.id),
        'last_inquiry', (select jsonb_build_object('kind', i.kind, 'at', i.created_at) from public.site_inquiry i where i.lead_id = l.id order by i.created_at desc limit 1),
        'calls', (select count(*) from public.da_prospect_call c where c.lead_id = l.id),
        'last_activity', greatest(
          l.updated_at,
          (select max(i.created_at) from public.site_inquiry i where i.lead_id = l.id),
          (select max(c.occurred_at) from public.da_prospect_call c where c.lead_id = l.id)
        )
      ) as row_data
      from public.da_leads l
      where coalesce(p_view, 'open') = 'all'
         or (p_view = 'closed' and l.stage in ('Closed Won', 'Closed Lost', 'Disqualified', 'Recycled'))
         or (coalesce(p_view, 'open') = 'open' and l.stage not in ('Closed Won', 'Closed Lost', 'Disqualified', 'Recycled'))
      order by l.updated_at desc
      limit 300
    ) rows
  ), '[]'::jsonb);
end;
$$;

create or replace function public.so_pipeline_lead(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.da_leads;
begin
  if not app.is_admin() then
    raise exception 'forbidden: only DA Admin can open the pipeline' using errcode = '42501';
  end if;
  select * into v_lead from public.da_leads where id = p_id;
  if v_lead.id is null then
    raise exception 'not_found: that lead is not in the pipeline' using errcode = 'P0002';
  end if;
  return jsonb_build_object(
    'lead', jsonb_build_object(
      'id', v_lead.id,
      'full_name', nullif(v_lead.full_name, ''),
      'email', nullif(v_lead.email, ''),
      'phone', nullif(v_lead.phone, ''),
      'company', nullif(v_lead.company_name, ''),
      'stage', v_lead.stage,
      'source', coalesce(nullif(v_lead.payload ->> 'source', ''), 'Acquisition'),
      'next_action', nullif(v_lead.next_action, ''),
      'notes', nullif(v_lead.notes, ''),
      'ghl_contact_id', nullif(v_lead.ghl_contact_id, ''),
      'created_at', v_lead.created_at,
      'updated_at', v_lead.updated_at
    ),
    'booking', app.lead_booking(v_lead),
    'bookings', coalesce((
      select jsonb_agg(jsonb_build_object('status', b.status, 'starts_at', b.starts_at, 'time_zone', b.time_zone, 'updated_at', b.updated_at) order by b.starts_at desc nulls last)
      from public.booking_message_bookings b
      join public.booking_message_people pe on pe.id = b.person_id
      where pe.da_lead_id = v_lead.id or (coalesce(v_lead.email, '') <> '' and lower(pe.email) = lower(v_lead.email))
    ), '[]'::jsonb),
    'inquiries', coalesce((
      select jsonb_agg(jsonb_build_object('id', i.id, 'kind', i.kind, 'created_at', i.created_at, 'answers', i.answers) order by i.created_at desc)
      from public.site_inquiry i where i.lead_id = v_lead.id
    ), '[]'::jsonb),
    'calls', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'occurred_at', c.occurred_at,
        'outcome', c.payload ->> 'outcome',
        'notes', c.payload ->> 'notes',
        'by', coalesce(nullif(btrim(pr.full_name), ''), pr.email)
      ) order by c.occurred_at desc)
      from public.da_prospect_call c
      left join public.profile pr on pr.id = c.created_by
      where c.lead_id = v_lead.id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.so_pipeline_update(p_id uuid, p_stage text, p_next_action text, p_notes text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.is_admin() then
    raise exception 'forbidden: only DA Admin can change the pipeline' using errcode = '42501';
  end if;
  if p_stage is not null and p_stage not in (
    'Step 1 Captured', 'Application Abandoned', 'Manual Review', 'Qualified - Not Booked', 'Audit Booked',
    'No Show', 'Audit Held', 'Closed Won', 'Closed Lost', 'Disqualified', 'Recycled'
  ) then
    raise exception 'invalid: choose a stage from the list' using errcode = '23514';
  end if;
  update public.da_leads
     set stage = coalesce(p_stage, stage),
         next_action = left(coalesce(p_next_action, next_action, ''), 500),
         notes = left(coalesce(p_notes, notes, ''), 20000)
   where id = p_id;
  if not found then
    raise exception 'not_found: that lead is not in the pipeline' using errcode = 'P0002';
  end if;
end;
$$;

-- Log a discovery call. The outcome moves the stage unless a stage is given.
create or replace function public.so_pipeline_log_call(p_id uuid, p_occurred_at timestamptz, p_outcome text, p_notes text, p_stage text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.da_leads;
  v_call uuid;
  v_stage text;
begin
  if not app.is_admin() then
    raise exception 'forbidden: only DA Admin can log calls' using errcode = '42501';
  end if;
  select * into v_lead from public.da_leads where id = p_id for update;
  if v_lead.id is null then
    raise exception 'not_found: that lead is not in the pipeline' using errcode = 'P0002';
  end if;
  if p_outcome not in ('held', 'no_show', 'follow_up', 'won', 'lost') then
    raise exception 'invalid: choose what happened on the call' using errcode = '23514';
  end if;
  if length(coalesce(p_notes, '')) > 20000 then
    raise exception 'invalid: the notes are too long' using errcode = '23514';
  end if;

  insert into public.da_prospect_call (lead_id, email, full_name, kind, source, occurred_at, payload, created_by)
  values (
    v_lead.id,
    nullif(v_lead.email, ''),
    nullif(btrim(v_lead.full_name), ''),
    'audit',
    'operator',
    coalesce(p_occurred_at, now()),
    jsonb_build_object('outcome', p_outcome, 'notes', nullif(btrim(coalesce(p_notes, '')), '')),
    app.acting_profile()
  )
  returning id into v_call;

  v_stage := coalesce(p_stage, case p_outcome
    when 'held' then 'Audit Held'
    when 'no_show' then 'No Show'
    when 'won' then 'Closed Won'
    when 'lost' then 'Closed Lost'
    else null
  end);
  if v_stage is not null then
    perform public.so_pipeline_update(v_lead.id, v_stage, null, null);
  end if;
  return v_call;
end;
$$;

revoke all on function app.inquiry_source(text) from public, anon, authenticated;
revoke all on function app.lead_booking(public.da_leads) from public, anon, authenticated;
revoke all on function public.site_capture_inquiry(jsonb) from public, anon, authenticated;
grant execute on function public.site_capture_inquiry(jsonb) to service_role;
revoke all on function public.so_pipeline(text) from public, anon;
revoke all on function public.so_pipeline_lead(uuid) from public, anon;
revoke all on function public.so_pipeline_update(uuid, text, text, text) from public, anon;
revoke all on function public.so_pipeline_log_call(uuid, timestamptz, text, text, text) from public, anon;
grant execute on function public.so_pipeline(text) to authenticated;
grant execute on function public.so_pipeline_lead(uuid) to authenticated;
grant execute on function public.so_pipeline_update(uuid, text, text, text) to authenticated;
grant execute on function public.so_pipeline_log_call(uuid, timestamptz, text, text, text) to authenticated;
