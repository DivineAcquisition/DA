-- DocuSeal webhook: forward-only status sync, and the webhook door closed to
-- the public.
--
-- No table changes. da_agreement, da_webhook_log and da_settings already
-- hold everything the docuseal-webhook edge function needs.
--
-- DocuSeal (checked against its source, lib/send_webhook_request.rb and
-- app/models/webhook_url.rb) sends:
--
--   form.viewed  form.started  form.completed  form.declined
--   submission.created  submission.completed  submission.expired  submission.archived
--   template.created  template.updated  template.archived
--
-- as { event_type, timestamp, data }. form.* carries a submitter
-- (data.id = submitter, data.submission_id = submission); submission.*
-- carries the submission itself (data.id = submission). Agreements are
-- tracked per submission, so both resolve to the submission id.
--
-- Each request is signed: X-Docuseal-Signature: <unix ts>.<hex HMAC-SHA256
-- of "<ts>.<raw body>" keyed with the webhook's whsec_ secret>, with a five
-- minute tolerance. The edge function verifies that; this file only decides
-- what a verified event does.
--
-- Mapping onto the five agreement stages (no new stage):
--   form.viewed, form.started         -> viewed
--   form.completed                    -> completed once data.submission.status
--                                        is completed, otherwise viewed (a
--                                        countersigner is still outstanding)
--   submission.completed              -> completed
--   form.declined                     -> declined
--   submission.expired                -> expired
--   submission.created                -> sent (never moves anything, since
--                                        agreements start at sent)
--   submission.archived, template.*   -> ignored. Logged and marked processed
--                                        with a note, never dropped silently.

create or replace function public.da_docuseal_event_stage(
  p_event_type text,
  p_submission_completed boolean default false
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case lower(btrim(coalesce(p_event_type, '')))
    when 'form.viewed' then 'viewed'
    when 'form.started' then 'viewed'
    when 'form.completed' then case when p_submission_completed then 'completed' else 'viewed' end
    when 'submission.completed' then 'completed'
    when 'form.declined' then 'declined'
    when 'submission.expired' then 'expired'
    when 'submission.created' then 'sent'
    else null
  end;
$$;

-- Stages only move forward. completed, declined and expired are final.
create or replace function public.da_agreement_stage_rank(p_status text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_status
    when 'sent' then 0
    when 'viewed' then 1
    when 'completed' then 2
    when 'declined' then 2
    when 'expired' then 2
    else -1
  end;
$$;

create or replace function public.da_mark_webhook_log(
  p_log_id uuid,
  p_processed boolean,
  p_error text
)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.da_webhook_log
     set processed = coalesce(p_processed, false),
         error = nullif(btrim(coalesce(p_error, '')), '')
   where id = p_log_id;
$$;

-- Apply one verified DocuSeal event. Returns what happened:
--   updated   the agreement moved forward
--   no_op     duplicate, late or out-of-order event; nothing moved backward
--   no_match  no agreement has this submission id (log left unprocessed)
--   ignored   an event with no agreement stage
create or replace function public.da_process_docuseal_event(
  p_log_id uuid,
  p_event_type text,
  p_submission_id text,
  p_event_at timestamptz default null,
  p_submission_completed boolean default false,
  p_signed_document_url text default null,
  p_audit_log_url text default null
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_stage text := public.da_docuseal_event_stage(p_event_type, p_submission_completed);
  v_submission text := nullif(btrim(coalesce(p_submission_id, '')), '');
  v_at timestamptz := coalesce(p_event_at, now());
  v_row public.da_agreement%rowtype;
begin
  if v_stage is null then
    perform public.da_mark_webhook_log(
      p_log_id, true,
      format('ignored: %s has no agreement stage', coalesce(nullif(btrim(p_event_type), ''), 'unknown event')));
    return 'ignored';
  end if;

  if v_submission is null then
    perform public.da_mark_webhook_log(p_log_id, false,
      format('%s carried no submission id', p_event_type));
    return 'no_match';
  end if;

  -- Lock the row so two deliveries for one submission apply one at a time.
  select * into v_row
    from public.da_agreement
   where docuseal_submission_id = v_submission
     and superseded_by_id is null
   order by created_at desc
   limit 1
   for update;

  if not found then
    perform public.da_mark_webhook_log(p_log_id, false,
      format('no matching agreement for DocuSeal submission %s (%s)', v_submission, p_event_type));
    return 'no_match';
  end if;

  if public.da_agreement_stage_rank(v_stage) <= public.da_agreement_stage_rank(v_row.status)
     or public.da_agreement_stage_rank(v_row.status) = 2 then
    -- Same or earlier stage, or the agreement is already final. The status
    -- stays put. A late completed event may still carry the document link
    -- the first one lacked, so blanks are filled and nothing is overwritten.
    update public.da_agreement
       set signed_document_url = case
             when status = 'completed' and v_stage = 'completed'
               then coalesce(signed_document_url, nullif(btrim(p_signed_document_url), ''))
             else signed_document_url
           end,
           audit_log_url = case
             when status = 'completed' and v_stage = 'completed'
               then coalesce(audit_log_url, nullif(btrim(p_audit_log_url), ''))
             else audit_log_url
           end,
           synced_at = now()
     where id = v_row.id;

    perform public.da_mark_webhook_log(p_log_id, true, null);
    return 'no_op';
  end if;

  update public.da_agreement
     set status = v_stage,
         viewed_at = case
           when v_stage in ('viewed', 'completed') then coalesce(viewed_at, v_at)
           else viewed_at
         end,
         completed_at = case
           when v_stage = 'completed' then coalesce(completed_at, v_at)
           else completed_at
         end,
         signed_document_url = case
           when v_stage = 'completed'
             then coalesce(nullif(btrim(p_signed_document_url), ''), signed_document_url)
           else signed_document_url
         end,
         audit_log_url = case
           when v_stage = 'completed'
             then coalesce(nullif(btrim(p_audit_log_url), ''), audit_log_url)
           else audit_log_url
         end,
         synced_at = now()
   where id = v_row.id;

  perform public.da_mark_webhook_log(p_log_id, true, null);
  return 'updated';
end;
$$;

comment on function public.da_process_docuseal_event is
  'Applies one verified DocuSeal webhook event to its agreement. Status only moves forward (sent -> viewed -> completed/declined/expired); duplicates and late events are no-ops.';

-- The older door (app/api/webhooks/docuseal) called this. It now goes through
-- the same forward-only rule, so it can never pull a status backward either.
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
  v_event text := case lower(btrim(coalesce(p_status, '')))
    when 'viewed' then 'form.viewed'
    when 'completed' then 'submission.completed'
    when 'declined' then 'form.declined'
    when 'expired' then 'submission.expired'
    when 'sent' then 'submission.created'
    else coalesce(p_status, '')
  end;
begin
  return public.da_process_docuseal_event(
    p_log_id, v_event, p_submission_id, now(), true, p_signed_document_url, null
  ) in ('updated', 'no_op');
end;
$$;

-- The secret and every status write are no longer callable with the public
-- anon key. Before this, anyone holding it could read the webhook secret and
-- set any agreement's status. The edge function runs as service_role.
--
-- da_log_webhook_payload keeps its grants: app/api/webhooks/pipeline-call
-- logs through it and may be running on the anon key. It can only append a
-- log row.
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.da_get_webhook_secret()',
    'public.da_apply_agreement_webhook(text, text, text, uuid)',
    'public.da_apply_agreement_values(text, jsonb)',
    'public.da_mark_webhook_log(uuid, boolean, text)',
    'public.da_process_docuseal_event(uuid, text, text, timestamptz, boolean, text, text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end
$$;
