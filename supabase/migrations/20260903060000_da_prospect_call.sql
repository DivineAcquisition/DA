-- ---------------------------------------------------------------------------
-- DA prospect call door.
--
-- Divine Acquisition's own sales calls (phone, audit, booked Meet) land here
-- first, then the app sends them to the DA Pipeline Airtable base. This is not
-- Vistrial's public.lead / public.booking: those are per-client operator work.
-- Airtable stays the CRM; this table is the ingress log so a failed Airtable
-- write cannot lose the call, and so GHL/calendar payloads have one place to
-- arrive before they are forwarded.
-- ---------------------------------------------------------------------------

alter table public.da_settings
  add column if not exists pipeline_call_webhook_secret text not null default '';

comment on column public.da_settings.pipeline_call_webhook_secret is
  'Shared secret for the DA pipeline-call machine door. Empty means the door refuses anonymous deliveries; service-role cron/webhooks that already authenticated at the route may still write.';

create table public.da_prospect_call (
  id uuid primary key default gen_random_uuid(),
  airtable_lead_id text
    check (airtable_lead_id is null or airtable_lead_id ~ '^rec[A-Za-z0-9]{14}$'),
  email text check (email is null or (position('@' in email) > 1 and length(email) <= 320)),
  full_name text check (full_name is null or length(btrim(full_name)) between 1 and 200),
  kind text not null check (kind in ('booking', 'phone', 'audit', 'artifact')),
  source text not null check (source in ('operator', 'ghl', 'calendar')),
  -- Appointment / calendar event id. Null on operator-entered rows so each log
  -- is a new event; unique with source so a GHL create+update is one row.
  external_ref text check (external_ref is null or length(btrim(external_ref)) between 1 and 200),
  occurred_at timestamptz not null default now(),
  meet_url text check (meet_url is null or meet_url ~* '^https?://'),
  recording_url text check (recording_url is null or recording_url ~* '^https?://'),
  transcript text check (transcript is null or length(transcript) <= 200000),
  google_event_id text check (google_event_id is null or length(btrim(google_event_id)) <= 200),
  payload jsonb not null default '{}'::jsonb,
  airtable_touch_id text
    check (airtable_touch_id is null or airtable_touch_id ~ '^rec[A-Za-z0-9]{14}$'),
  airtable_debrief_id text
    check (airtable_debrief_id is null or airtable_debrief_id ~ '^rec[A-Za-z0-9]{14}$'),
  airtable_synced_at timestamptz,
  airtable_sync_error text check (airtable_sync_error is null or length(airtable_sync_error) <= 2000),
  created_by uuid references public.profile (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, external_ref)
);

comment on table public.da_prospect_call is
  'Rule: call data for DA Client Acquisition comes in through Supabase and is sent to Airtable. Not a cache of the CRM — an ingress log of call events.';

create index da_prospect_call_lead_idx
  on public.da_prospect_call (airtable_lead_id, occurred_at desc)
  where airtable_lead_id is not null;

create index da_prospect_call_email_idx
  on public.da_prospect_call (lower(email), occurred_at desc)
  where email is not null;

create index da_prospect_call_unsynced_idx
  on public.da_prospect_call (created_at)
  where airtable_synced_at is null;

create index da_prospect_call_debrief_idx
  on public.da_prospect_call (airtable_debrief_id)
  where airtable_debrief_id is not null;

create index da_prospect_call_touch_idx
  on public.da_prospect_call (airtable_touch_id)
  where airtable_touch_id is not null;

create trigger da_prospect_call_touch before update on public.da_prospect_call
  for each row execute function app.touch_updated_at();

alter table public.da_prospect_call enable row level security;

create policy da_prospect_call_admin_all on public.da_prospect_call
  for all to authenticated
  using (app.is_admin())
  with check (app.is_admin());

revoke all on public.da_prospect_call from anon;
revoke all on public.da_prospect_call from authenticated;
grant select, insert, update on public.da_prospect_call to authenticated;

-- ---------------------------------------------------------------------------
-- Upsert. Shared by the admin form path and the machine door.
-- ---------------------------------------------------------------------------

create or replace function app.da_upsert_prospect_call(p_row jsonb)
returns public.da_prospect_call
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v jsonb := coalesce(p_row, '{}'::jsonb);
  v_id uuid;
  v_lead text := nullif(btrim(coalesce(v->>'airtable_lead_id', '')), '');
  v_email text := nullif(lower(btrim(coalesce(v->>'email', ''))), '');
  v_name text := nullif(btrim(coalesce(v->>'full_name', '')), '');
  v_kind text := coalesce(nullif(btrim(coalesce(v->>'kind', '')), ''), 'booking');
  v_source text := coalesce(nullif(btrim(coalesce(v->>'source', '')), ''), 'operator');
  v_ref text := nullif(btrim(coalesce(v->>'external_ref', '')), '');
  v_occurred timestamptz;
  v_meet text := nullif(btrim(coalesce(v->>'meet_url', '')), '');
  v_recording text := nullif(btrim(coalesce(v->>'recording_url', '')), '');
  v_transcript text := nullif(v->>'transcript', '');
  v_event text := nullif(btrim(coalesce(v->>'google_event_id', '')), '');
  v_payload jsonb := coalesce(v->'payload', '{}'::jsonb);
  v_touch text := nullif(btrim(coalesce(v->>'airtable_touch_id', '')), '');
  v_debrief text := nullif(btrim(coalesce(v->>'airtable_debrief_id', '')), '');
  v_row public.da_prospect_call;
begin
  if jsonb_typeof(v->'payload') is distinct from 'object' then
    v_payload := '{}'::jsonb;
  end if;

  begin
    v_id := nullif(btrim(coalesce(v->>'id', '')), '')::uuid;
  exception when invalid_text_representation then
    raise exception 'id_invalid: call id must be a uuid'
      using errcode = '22P02';
  end;

  begin
    v_occurred := coalesce(nullif(btrim(coalesce(v->>'occurred_at', '')), '')::timestamptz, now());
  exception when others then
    raise exception 'occurred_at_invalid: call time must be a timestamp'
      using errcode = '22007';
  end;

  if v_kind not in ('booking', 'phone', 'audit', 'artifact') then
    raise exception 'kind_invalid: call kind must be booking, phone, audit, or artifact'
      using errcode = '23514';
  end if;

  if v_source not in ('operator', 'ghl', 'calendar') then
    raise exception 'source_invalid: call source must be operator, ghl, or calendar'
      using errcode = '23514';
  end if;

  if v_id is not null then
    update public.da_prospect_call c
       set airtable_lead_id = coalesce(v_lead, c.airtable_lead_id),
           email = coalesce(v_email, c.email),
           full_name = coalesce(v_name, c.full_name),
           kind = v_kind,
           source = v_source,
           external_ref = coalesce(v_ref, c.external_ref),
           occurred_at = v_occurred,
           meet_url = coalesce(v_meet, c.meet_url),
           recording_url = coalesce(v_recording, c.recording_url),
           transcript = coalesce(v_transcript, c.transcript),
           google_event_id = coalesce(v_event, c.google_event_id),
           payload = case when v_payload = '{}'::jsonb then c.payload else c.payload || v_payload end,
           airtable_touch_id = coalesce(v_touch, c.airtable_touch_id),
           airtable_debrief_id = coalesce(v_debrief, c.airtable_debrief_id),
           airtable_synced_at = null,
           airtable_sync_error = null
     where c.id = v_id
    returning * into v_row;

    if v_row.id is null then
      raise exception 'not_found: that call event does not exist'
        using errcode = 'P0002';
    end if;

    return v_row;
  end if;

  insert into public.da_prospect_call (
    airtable_lead_id, email, full_name, kind, source, external_ref, occurred_at,
    meet_url, recording_url, transcript, google_event_id, payload,
    airtable_touch_id, airtable_debrief_id, created_by
  ) values (
    v_lead, v_email, v_name, v_kind, v_source, v_ref, v_occurred,
    v_meet, v_recording, v_transcript, v_event, v_payload,
    v_touch, v_debrief, auth.uid()
  )
  on conflict (source, external_ref) do update set
    airtable_lead_id = coalesce(public.da_prospect_call.airtable_lead_id, excluded.airtable_lead_id),
    email = coalesce(excluded.email, public.da_prospect_call.email),
    full_name = coalesce(excluded.full_name, public.da_prospect_call.full_name),
    kind = excluded.kind,
    occurred_at = excluded.occurred_at,
    meet_url = coalesce(excluded.meet_url, public.da_prospect_call.meet_url),
    recording_url = coalesce(excluded.recording_url, public.da_prospect_call.recording_url),
    transcript = coalesce(excluded.transcript, public.da_prospect_call.transcript),
    google_event_id = coalesce(excluded.google_event_id, public.da_prospect_call.google_event_id),
    payload = public.da_prospect_call.payload || excluded.payload,
    airtable_touch_id = coalesce(public.da_prospect_call.airtable_touch_id, excluded.airtable_touch_id),
    airtable_debrief_id = coalesce(public.da_prospect_call.airtable_debrief_id, excluded.airtable_debrief_id),
    airtable_synced_at = null,
    airtable_sync_error = null
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.da_record_prospect_call(p_row jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not app.is_admin() then
    raise exception 'admin_required: only an admin can log a DA prospect call'
      using errcode = '42501';
  end if;
  return to_jsonb(app.da_upsert_prospect_call(p_row));
end;
$$;

revoke all on function public.da_record_prospect_call(jsonb) from public;
grant execute on function public.da_record_prospect_call(jsonb) to authenticated;

create or replace function public.da_receive_prospect_call(p_secret text, p_row jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_expected text;
begin
  if app.is_admin() or coalesce(auth.role(), '') = 'service_role' then
    return to_jsonb(app.da_upsert_prospect_call(p_row));
  end if;

  select nullif(btrim(pipeline_call_webhook_secret), '')
    into v_expected
    from public.da_settings
   where id = 1;

  if v_expected is null or v_expected is distinct from coalesce(p_secret, '') then
    raise exception 'unauthorised: pipeline call door refused the secret'
      using errcode = '42501';
  end if;

  return to_jsonb(app.da_upsert_prospect_call(p_row));
end;
$$;

revoke all on function public.da_receive_prospect_call(text, jsonb) from public;
grant execute on function public.da_receive_prospect_call(text, jsonb) to anon, authenticated, service_role;

create or replace function public.da_mark_prospect_call_airtable(
  p_id uuid,
  p_airtable_lead_id text default null,
  p_airtable_touch_id text default null,
  p_airtable_debrief_id text default null,
  p_error text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.da_prospect_call;
  v_error text := nullif(btrim(coalesce(p_error, '')), '');
begin
  if not app.is_admin() and coalesce(auth.role(), '') is distinct from 'service_role' then
    raise exception 'admin_required: only an admin can mark a call as sent to Airtable'
      using errcode = '42501';
  end if;

  update public.da_prospect_call c
     set airtable_lead_id = coalesce(nullif(btrim(coalesce(p_airtable_lead_id, '')), ''), c.airtable_lead_id),
         airtable_touch_id = coalesce(nullif(btrim(coalesce(p_airtable_touch_id, '')), ''), c.airtable_touch_id),
         airtable_debrief_id = coalesce(nullif(btrim(coalesce(p_airtable_debrief_id, '')), ''), c.airtable_debrief_id),
         airtable_sync_error = v_error,
         airtable_synced_at = case when v_error is null then now() else c.airtable_synced_at end
   where c.id = p_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'not_found: that call event does not exist'
      using errcode = 'P0002';
  end if;

  return to_jsonb(v_row);
end;
$$;

revoke all on function public.da_mark_prospect_call_airtable(uuid, text, text, text, text) from public;
grant execute on function public.da_mark_prospect_call_airtable(uuid, text, text, text, text) to authenticated, service_role;

create or replace function public.da_list_prospect_calls(p_airtable_lead_id text)
returns setof public.da_prospect_call
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app.is_admin() then
    raise exception 'admin_required: only an admin can list DA prospect calls'
      using errcode = '42501';
  end if;

  if p_airtable_lead_id is null or p_airtable_lead_id !~ '^rec[A-Za-z0-9]{14}$' then
    return;
  end if;

  return query
    select *
      from public.da_prospect_call
     where airtable_lead_id = p_airtable_lead_id
     order by occurred_at desc, created_at desc;
end;
$$;

revoke all on function public.da_list_prospect_calls(text) from public;
grant execute on function public.da_list_prospect_calls(text) to authenticated;

create or replace function public.da_list_unsynced_prospect_calls(p_limit integer default 40)
returns setof public.da_prospect_call
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 40), 100));
begin
  if not app.is_admin() and coalesce(auth.role(), '') is distinct from 'service_role' then
    raise exception 'admin_required: only an admin can list unsynced DA prospect calls'
      using errcode = '42501';
  end if;

  return query
    select *
      from public.da_prospect_call
     where airtable_synced_at is null
        or airtable_sync_error is not null
     order by created_at
     limit v_limit;
end;
$$;

revoke all on function public.da_list_unsynced_prospect_calls(integer) from public;
grant execute on function public.da_list_unsynced_prospect_calls(integer) to authenticated, service_role;

create or replace function public.da_get_pipeline_call_secret()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app.is_admin() and coalesce(auth.role(), '') is distinct from 'service_role' then
    raise exception 'admin_required: only an admin can read the pipeline call door secret'
      using errcode = '42501';
  end if;
  return (select pipeline_call_webhook_secret from public.da_settings where id = 1);
end;
$$;

revoke all on function public.da_get_pipeline_call_secret() from public;
grant execute on function public.da_get_pipeline_call_secret() to authenticated, service_role;
