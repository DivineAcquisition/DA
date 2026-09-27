-- Tokenized signing links expire, the way NovaraCleaning's contractor
-- agreement links do (cleaners.agreement_token_expires_at).
--
-- A link that never expires is a standing credential to sign somebody's
-- agreement from a forwarded email. New sends get 30 days; an expired link
-- says so instead of the neutral "no longer available", because "ask for a
-- fresh link" ends the conversation where "invalid" starts a support thread.
--
-- Rows sent before this keep a null expiry and behave exactly as before.
-- A completed agreement's link keeps working so the signer can reopen it and
-- download the signed PDF.

alter table public.da_agreement
  add column if not exists access_token_expires_at timestamptz;

comment on column public.da_agreement.access_token_expires_at is
  'When the /s/<token> signing link stops accepting a signature. Null = no expiry (links sent before expiry existed). A completed agreement stays viewable.';

create or replace function public.da_signing_link_expired(p_row public.da_agreement)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_row.status <> 'completed'
     and p_row.access_token_expires_at is not null
     and p_row.access_token_expires_at < now();
$$;

create or replace function public.da_load_signing_page(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_token text := btrim(coalesce(p_token, ''));
  v_row public.da_agreement%rowtype;
  v_recipient public.da_recipient%rowtype;
  v_template public.da_agreement_template%rowtype;
begin
  if length(v_token) < 32 then
    return null;
  end if;

  select * into v_row
    from public.da_agreement
   where access_token = v_token;

  if not found then
    return null;
  end if;

  if v_row.status in ('declined', 'expired') or v_row.superseded_by_id is not null then
    return null;
  end if;

  if public.da_signing_link_expired(v_row) then
    return jsonb_build_object('unavailable', 'link_expired');
  end if;

  select * into v_recipient from public.da_recipient where id = v_row.recipient_id;
  select * into v_template from public.da_agreement_template where id = v_row.template_id;

  if not found then
    return null;
  end if;

  if v_row.viewed_at is null then
    update public.da_agreement
       set viewed_at = now(),
           status = case when status = 'sent' then 'viewed' else status end
     where id = v_row.id
    returning * into v_row;
  end if;

  return jsonb_build_object(
    'agreement', jsonb_build_object(
      'id', v_row.id,
      'status', v_row.status,
      'docuseal_submission_id', v_row.docuseal_submission_id,
      'docuseal_submitter_id', v_row.docuseal_submitter_id,
      'prefilled_values', v_row.prefilled_values,
      'submitted_values', v_row.submitted_values,
      'signed_document_url', v_row.signed_document_url,
      'recipient_id', v_row.recipient_id,
      'template_id', v_row.template_id,
      'onboarding_url', v_row.onboarding_url,
      'access_token_expires_at', v_row.access_token_expires_at
    ),
    'recipient', jsonb_build_object(
      'full_name', v_recipient.full_name,
      'email', v_recipient.email,
      'recipient_type', v_recipient.recipient_type,
      'phone', v_recipient.phone,
      'business_name', v_recipient.business_name
    ),
    'template', jsonb_build_object(
      'name', v_template.name,
      'recipient_type', v_template.recipient_type,
      'docuseal_template_id', v_template.docuseal_template_id,
      'docuseal_fields', v_template.docuseal_fields,
      'docuseal_submitters', v_template.docuseal_submitters
    )
  );
end;
$$;

revoke all on function public.da_load_signing_page(text) from public;
grant execute on function public.da_load_signing_page(text) to anon, authenticated, service_role;

create or replace function public.da_resolve_signing_token(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_token text := btrim(coalesce(p_token, ''));
  v_row public.da_agreement%rowtype;
  v_recipient public.da_recipient%rowtype;
  v_template public.da_agreement_template%rowtype;
  v_destination text;
begin
  if length(v_token) < 32 then
    return null;
  end if;

  select * into v_row
    from public.da_agreement
   where access_token = v_token;

  if not found then
    return null;
  end if;

  if v_row.status in ('declined', 'expired') or v_row.superseded_by_id is not null then
    return null;
  end if;

  if public.da_signing_link_expired(v_row) then
    return null;
  end if;

  v_destination := nullif(btrim(coalesce(v_row.provider_signing_url, '')), '');
  if v_destination is null and nullif(btrim(coalesce(v_row.docuseal_slug, '')), '') is not null then
    v_destination := 'https://docuseal.com/s/' || btrim(v_row.docuseal_slug);
  end if;
  if v_destination is null then
    return null;
  end if;

  select * into v_recipient from public.da_recipient where id = v_row.recipient_id;
  select * into v_template from public.da_agreement_template where id = v_row.template_id;

  if v_row.viewed_at is null then
    update public.da_agreement
       set viewed_at = now(),
           status = case when status = 'sent' then 'viewed' else status end
     where id = v_row.id;
  end if;

  return jsonb_build_object(
    'destination_url', v_destination,
    'recipient_name', coalesce(v_recipient.full_name, ''),
    'template_name', coalesce(v_template.name, 'Agreement'),
    'status', v_row.status
  );
end;
$$;

revoke all on function public.da_resolve_signing_token(text) from public;
grant execute on function public.da_resolve_signing_token(text) to anon, authenticated;

create or replace function public.da_mark_agreement_signed(
  p_token text,
  p_submitted jsonb,
  p_signed_document_url text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_token text := btrim(coalesce(p_token, ''));
  v_row public.da_agreement%rowtype;
  v_key text;
  v_value text;
begin
  if length(v_token) < 32 then
    return false;
  end if;

  select * into v_row from public.da_agreement where access_token = v_token for update;
  if not found then
    return false;
  end if;
  if v_row.status in ('declined', 'expired') or v_row.superseded_by_id is not null then
    return false;
  end if;
  if public.da_signing_link_expired(v_row) then
    return false;
  end if;

  update public.da_agreement
     set status = 'completed',
         completed_at = coalesce(completed_at, now()),
         viewed_at = coalesce(viewed_at, now()),
         submitted_values = coalesce(p_submitted, '{}'::jsonb),
         signed_document_url = coalesce(nullif(btrim(p_signed_document_url), ''), signed_document_url),
         synced_at = now()
   where id = v_row.id;

  if p_submitted is not null and jsonb_typeof(p_submitted) = 'object' then
    for v_key, v_value in select key, value from jsonb_each_text(p_submitted) loop
      if v_value is null or btrim(v_value) = '' or v_value = '[signature]' then
        continue;
      end if;
      insert into public.da_recipient_field (recipient_id, field_name, value, source, agreement_id)
      values (v_row.recipient_id, v_key, v_value, 'docuseal', v_row.id)
      on conflict (recipient_id, field_key) do update
        set value = excluded.value,
            source = excluded.source,
            agreement_id = excluded.agreement_id,
            observed_at = now();
    end loop;
  end if;

  return true;
end;
$$;

-- Grants unchanged here. 20260927181858_da_docuseal_key_lockdown.sql takes
-- this and da_get_docuseal_api_key away from anon once the app calls them with
-- the service role.
revoke all on function public.da_mark_agreement_signed(text, jsonb, text) from public;
grant execute on function public.da_mark_agreement_signed(text, jsonb, text) to anon, authenticated, service_role;
