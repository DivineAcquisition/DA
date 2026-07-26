-- Who asked and the long-form detail are genuinely optional, so they get SQL
-- defaults. Without them the generated TypeScript marks the parameters as
-- required and callers have to invent empty strings.
create or replace function public.log_scope_request(
  p_case_file_id uuid,
  p_requested_on date,
  p_summary text,
  p_verdict public.scope_verdict,
  p_reason text,
  p_requested_by_name text default null,
  p_detail text default null
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

-- Drop the old positional signature so there is only one.
drop function if exists public.log_scope_request(uuid, date, text, text, text, public.scope_verdict, text);

revoke all on function public.log_scope_request(uuid, date, text, public.scope_verdict, text, text, text) from anon;

-- Same for the quote amount, which may be a placeholder at first.
create or replace function public.quote_scope_request(
  p_scope_request_id uuid,
  p_proposed_on date,
  p_summary text,
  p_amount numeric default null
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

-- And the effort correction hours, which may legitimately be cleared.
create or replace function public.correct_effort(
  p_effort_id uuid,
  p_performed_on date,
  p_phase text,
  p_description text,
  p_reason text,
  p_hours numeric default null
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

drop function if exists public.correct_effort(uuid, date, text, text, numeric, text);
revoke all on function public.correct_effort(uuid, date, text, text, text, numeric) from anon;
revoke all on function public.quote_scope_request(uuid, date, text, numeric) from anon;
