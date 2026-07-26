-- ---------------------------------------------------------------------------
-- Effort log
-- ---------------------------------------------------------------------------

create or replace function public.log_effort(
  p_case_file_id uuid,
  p_performed_on date,
  p_phase text,
  p_description text,
  p_hours numeric default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  insert into public.effort_entry (case_file_id, performed_on, phase, description, hours, created_by)
  values (p_case_file_id, p_performed_on, p_phase, p_description, p_hours, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

-- Rule 2: the original is never edited. A correction is a new version and both
-- remain visible, which is the whole point when a client disputes delivery.
create or replace function public.correct_effort(
  p_effort_id uuid,
  p_performed_on date,
  p_phase text,
  p_description text,
  p_hours numeric,
  p_reason text
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_original public.effort_entry;
  v_new_id uuid;
begin
  select * into v_original from public.effort_entry where id = p_effort_id;

  if v_original.id is null then
    raise exception 'effort_not_found: %', p_effort_id using errcode = 'P0002';
  end if;

  if v_original.superseded_by_id is not null then
    raise exception 'effort_already_corrected: version % was superseded by %; correct the current version', v_original.version, v_original.superseded_by_id using errcode = '23514';
  end if;

  if coalesce(nullif(trim(p_reason), ''), '') = '' then
    raise exception 'correction_reason_required: a correction has to say why, or the version history proves nothing' using errcode = '23514';
  end if;

  insert into public.effort_entry (case_file_id, performed_on, phase, description, hours, version, supersedes_id, correction_reason, created_by)
  values (v_original.case_file_id, p_performed_on, p_phase, p_description, p_hours, v_original.version + 1, v_original.id, p_reason, auth.uid())
  returning id into v_new_id;

  update public.effort_entry set superseded_by_id = v_new_id where id = v_original.id;

  return v_new_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Decisions
-- ---------------------------------------------------------------------------

create or replace function public.log_decision(
  p_case_file_id uuid,
  p_decided_on date,
  p_decided_by text,
  p_what_was_decided text,
  p_reasoning text,
  p_against_recommendation boolean default false
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  insert into public.decision (case_file_id, decided_on, decided_by, what_was_decided, reasoning, against_recommendation, created_by)
  values (p_case_file_id, p_decided_on, p_decided_by, p_what_was_decided, p_reasoning, p_against_recommendation, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.correct_decision(
  p_decision_id uuid,
  p_decided_on date,
  p_decided_by text,
  p_what_was_decided text,
  p_reasoning text,
  p_against_recommendation boolean,
  p_reason text
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_original public.decision;
  v_new_id uuid;
begin
  select * into v_original from public.decision where id = p_decision_id;

  if v_original.id is null then
    raise exception 'decision_not_found: %', p_decision_id using errcode = 'P0002';
  end if;

  if v_original.superseded_by_id is not null then
    raise exception 'decision_already_corrected: version % was superseded by %', v_original.version, v_original.superseded_by_id using errcode = '23514';
  end if;

  if coalesce(nullif(trim(p_reason), ''), '') = '' then
    raise exception 'correction_reason_required: a correction has to say why' using errcode = '23514';
  end if;

  insert into public.decision (case_file_id, decided_on, decided_by, what_was_decided, reasoning, against_recommendation, version, supersedes_id, correction_reason, created_by)
  values (v_original.case_file_id, p_decided_on, p_decided_by, p_what_was_decided, p_reasoning, p_against_recommendation, v_original.version + 1, v_original.id, p_reason, auth.uid())
  returning id into v_new_id;

  update public.decision set superseded_by_id = v_new_id where id = v_original.id;

  return v_new_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Scope
-- ---------------------------------------------------------------------------

create or replace function public.log_scope_request(
  p_case_file_id uuid,
  p_requested_on date,
  p_requested_by_name text,
  p_summary text,
  p_detail text,
  p_verdict public.scope_verdict,
  p_reason text
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if coalesce(nullif(trim(p_reason), ''), '') = '' then
    raise exception 'scope_reason_required: every verdict needs a short reason, because that is what answers the dispute' using errcode = '23514';
  end if;

  insert into public.scope_request (case_file_id, requested_on, requested_by_name, summary, detail, verdict, reason, created_by)
  values (p_case_file_id, p_requested_on, p_requested_by_name, p_summary, p_detail, p_verdict, p_reason, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

-- Only an out-of-scope request can become a quote; an in-scope request is
-- already covered by the retainer.
create or replace function public.quote_scope_request(
  p_scope_request_id uuid,
  p_proposed_on date,
  p_summary text,
  p_amount numeric
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_request public.scope_request;
  v_id uuid;
begin
  select * into v_request from public.scope_request where id = p_scope_request_id;

  if v_request.id is null then
    raise exception 'scope_request_not_found: %', p_scope_request_id using errcode = 'P0002';
  end if;

  if v_request.verdict <> 'out_of_scope' then
    raise exception 'in_scope_needs_no_quote: this request was marked in scope, so it is already covered by the retainer' using errcode = '23514';
  end if;

  insert into public.scope_quote (scope_request_id, proposed_on, summary, amount, status, created_by)
  values (p_scope_request_id, p_proposed_on, p_summary, p_amount, 'sent', auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.decide_quote(
  p_quote_id uuid,
  p_status public.quote_status,
  p_decided_on date default null,
  p_note text default null
)
returns public.scope_quote
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_quote public.scope_quote;
begin
  if p_status not in ('accepted', 'declined') then
    raise exception 'quote_decision_invalid: a decision is either accepted or declined' using errcode = '23514';
  end if;

  update public.scope_quote
     set status = p_status,
         decided_on = coalesce(p_decided_on, current_date),
         decision_note = p_note
   where id = p_quote_id
  returning * into v_quote;

  return v_quote;
end;
$$;

-- ---------------------------------------------------------------------------
-- Evidence
-- ---------------------------------------------------------------------------

-- Rule 4: what it proves and when it happened are both required for anything
-- recorded through the app. The date may precede the upload.
create or replace function public.record_evidence(
  p_case_file_id uuid,
  p_category public.evidence_category,
  p_drive_file_id text,
  p_filename text,
  p_what_it_proves text,
  p_happened_on date,
  p_drive_url text default null,
  p_mime_type text default null,
  p_byte_size bigint default null,
  p_thumbnail_url text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if coalesce(nullif(trim(p_what_it_proves), ''), '') = '' then
    raise exception 'what_it_proves_required: an evidence item without a stated claim is not evidence' using errcode = '23514';
  end if;

  if p_happened_on is null then
    raise exception 'happened_on_required: record the date the thing happened, which may be earlier than the upload' using errcode = '23514';
  end if;

  insert into public.evidence_item (
    case_file_id, category, drive_file_id, drive_url, filename, mime_type, byte_size,
    thumbnail_url, what_it_proves, happened_on, created_by
  )
  values (
    p_case_file_id, p_category, p_drive_file_id, p_drive_url, p_filename, p_mime_type, p_byte_size,
    p_thumbnail_url, trim(p_what_it_proves), p_happened_on, auth.uid()
  )
  on conflict (case_file_id, drive_file_id) do update
    set what_it_proves = excluded.what_it_proves,
        happened_on = excluded.happened_on,
        category = excluded.category,
        filename = excluded.filename,
        drive_url = coalesce(excluded.drive_url, public.evidence_item.drive_url),
        thumbnail_url = coalesce(excluded.thumbnail_url, public.evidence_item.thumbnail_url),
        discovered_by_sync = false
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.link_evidence(
  p_evidence_id uuid,
  p_milestone_id uuid default null,
  p_snapshot_id uuid default null,
  p_effort_entry_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  insert into public.evidence_link (evidence_id, milestone_id, snapshot_id, effort_entry_id)
  values (p_evidence_id, p_milestone_id, p_snapshot_id, p_effort_entry_id)
  returning id into v_id;
  return v_id;
end;
$$;

-- Rule 6: a time-limited view link, not a permanent permission change.
create or replace function public.create_share_link(
  p_evidence_id uuid,
  p_ttl_minutes integer default 1440,
  p_shared_with text default null
)
returns public.evidence_share_link
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_link public.evidence_share_link;
begin
  if p_ttl_minutes is null or p_ttl_minutes < 1 or p_ttl_minutes > 20160 then
    raise exception 'share_ttl_invalid: a share link lasts between one minute and fourteen days' using errcode = '23514';
  end if;

  insert into public.evidence_share_link (evidence_id, token, expires_at, shared_with, created_by)
  values (
    p_evidence_id,
    encode(extensions.gen_random_bytes(24), 'base64'),
    now() + make_interval(mins => p_ttl_minutes),
    p_shared_with,
    auth.uid()
  )
  returning * into v_link;

  return v_link;
end;
$$;

create or replace function public.revoke_share_link(p_link_id uuid)
returns void
language sql
security invoker
set search_path = public, pg_temp
as $$
  update public.evidence_share_link set revoked_at = now() where id = p_link_id and revoked_at is null;
$$;

-- Files added straight to Drive would otherwise be invisible to the vault, so
-- the sync brings them in untagged and awaiting metadata rather than skipping
-- them.
create or replace function public.record_drive_sync(p_case_file_id uuid, p_files jsonb)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_file jsonb;
  v_discovered integer := 0;
begin
  for v_file in select * from jsonb_array_elements(coalesce(p_files, '[]'::jsonb)) loop
    insert into public.evidence_item (
      case_file_id, category, drive_file_id, drive_url, filename, mime_type, byte_size,
      thumbnail_url, discovered_by_sync, created_by
    )
    values (
      p_case_file_id,
      coalesce(nullif(v_file ->> 'category', ''), 'evidence')::public.evidence_category,
      v_file ->> 'drive_file_id',
      v_file ->> 'drive_url',
      coalesce(nullif(v_file ->> 'filename', ''), 'Untitled'),
      v_file ->> 'mime_type',
      nullif(v_file ->> 'byte_size', '')::bigint,
      v_file ->> 'thumbnail_url',
      true,
      auth.uid()
    )
    on conflict (case_file_id, drive_file_id) do nothing;

    if found then
      v_discovered := v_discovered + 1;
    end if;
  end loop;

  insert into public.drive_sync_run (case_file_id, discovered_count, status)
  values (p_case_file_id, v_discovered, 'ok');

  return v_discovered;
end;
$$;
