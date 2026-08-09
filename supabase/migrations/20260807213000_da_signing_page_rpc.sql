-- Public signing page loader + local completion helpers.

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
      'template_id', v_row.template_id
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

  select * into v_row from public.da_agreement where access_token = v_token;
  if not found then
    return false;
  end if;
  if v_row.status in ('declined', 'expired') or v_row.superseded_by_id is not null then
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

revoke all on function public.da_mark_agreement_signed(text, jsonb, text) from public;
grant execute on function public.da_mark_agreement_signed(text, jsonb, text) to anon, authenticated, service_role;

create or replace function public.da_get_docuseal_api_key()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select docuseal_api_key from public.da_settings where id = 1;
$$;

revoke all on function public.da_get_docuseal_api_key() from public;
grant execute on function public.da_get_docuseal_api_key() to anon, authenticated, service_role;
