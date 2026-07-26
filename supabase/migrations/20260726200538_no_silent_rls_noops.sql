-- Under RLS an UPDATE with no matching policy affects zero rows and raises
-- nothing, so these functions were returning NULL to a caller who had been
-- refused. Nothing leaked and nothing was written, but silence reads as success.
-- Each of these now checks that the write actually landed.

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
    raise exception 'only_client_facing_can_publish: this is a % report and carries internal material', v_report.mode using errcode = '23514';
  end if;

  update public.growth_report
     set published_to_client_at = coalesce(published_to_client_at, now()),
         published_by = coalesce(published_by, auth.uid())
   where id = p_report_id
  returning * into v_report;

  if v_report.id is null then
    raise exception 'not_permitted: publishing a report is an admin action' using errcode = '42501';
  end if;

  return v_report;
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
  if coalesce(nullif(trim(p_answer), ''), '') = '' then
    raise exception 'answer_empty' using errcode = '23514';
  end if;

  update public.client_message
     set status = 'answered', answer = p_answer, answered_at = now(), answered_by = auth.uid()
   where id = p_message_id
  returning * into v_message;

  if v_message.id is null then
    raise exception 'not_permitted: answering a client message is an admin action' using errcode = '42501';
  end if;

  return v_message;
end;
$$;

create or replace function public.revoke_dashboard_link(p_link_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  update public.client_dashboard_link set revoked_at = now()
   where id = p_link_id and revoked_at is null
  returning id into v_id;

  if v_id is null then
    raise exception 'link_not_revocable: it does not exist, is already revoked, or you may not touch it' using errcode = '42501';
  end if;
end;
$$;

drop function if exists public.write_off_invoice(uuid, text);

create function public.write_off_invoice(p_invoice_id uuid, p_reason text)
returns public.invoice
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_invoice public.invoice;
begin
  if coalesce(nullif(trim(p_reason), ''), '') = '' then
    raise exception 'write_off_reason_required: a write-off has to say why' using errcode = '23514';
  end if;

  update public.invoice
     set status = 'written_off',
         notes = coalesce(notes || E'\n', '') || 'Written off: ' || p_reason
   where id = p_invoice_id and status <> 'draft'
  returning * into v_invoice;

  if v_invoice.id is null then
    raise exception 'invoice_not_writable_off: it does not exist, is still a draft, or you may not touch it' using errcode = '42501';
  end if;

  return v_invoice;
end;
$$;

revoke all on function public.write_off_invoice(uuid, text) from anon;

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
     set status = p_status, decided_on = coalesce(p_decided_on, current_date), decision_note = p_note
   where id = p_quote_id
  returning * into v_quote;

  if v_quote.id is null then
    raise exception 'quote_not_found_or_not_permitted: %', p_quote_id using errcode = '42501';
  end if;

  return v_quote;
end;
$$;

create or replace function public.attach_report_to_drive(
  p_report_id uuid,
  p_drive_file_id text,
  p_drive_url text
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  update public.growth_report
     set drive_file_id = p_drive_file_id, drive_url = p_drive_url
   where id = p_report_id
  returning id into v_id;

  if v_id is null then
    raise exception 'not_permitted: filing a report in Drive is an admin action' using errcode = '42501';
  end if;
end;
$$;
