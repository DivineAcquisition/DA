-- Tokenized VA / Sales Operator onboarding submissions (post-agreement).

create table if not exists public.da_onboarding_submission (
  id uuid primary key default gen_random_uuid(),
  protocol_key text not null,
  recipient_id uuid not null references public.da_recipient (id) on delete cascade,
  agreement_id uuid references public.da_agreement (id) on delete set null,
  access_token text not null,
  status text not null default 'pending'
    check (status in ('pending', 'completed')),
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  opened_at timestamptz,
  completed_at timestamptz,
  constraint da_onboarding_submission_token_len check (length(access_token) >= 32)
);

create unique index if not exists da_onboarding_submission_token_uq
  on public.da_onboarding_submission (access_token);

create unique index if not exists da_onboarding_submission_agreement_uq
  on public.da_onboarding_submission (agreement_id)
  where agreement_id is not null;

create index if not exists da_onboarding_submission_recipient_idx
  on public.da_onboarding_submission (recipient_id, created_at desc);

alter table public.da_agreement
  add column if not exists onboarding_token text,
  add column if not exists onboarding_url text;

alter table public.da_onboarding_submission enable row level security;

revoke all on public.da_onboarding_submission from public, anon, authenticated;
grant select, insert, update, delete on public.da_onboarding_submission to authenticated;
grant select, insert, update on public.da_onboarding_submission to service_role;

create or replace function public.da_load_onboarding(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_token text := btrim(coalesce(p_token, ''));
  v_row public.da_onboarding_submission%rowtype;
  v_recipient public.da_recipient%rowtype;
  v_agreement public.da_agreement%rowtype;
  v_template_name text;
begin
  if length(v_token) < 32 then
    return null;
  end if;

  select * into v_row
    from public.da_onboarding_submission
   where access_token = v_token;

  if not found then
    return null;
  end if;

  select * into v_recipient from public.da_recipient where id = v_row.recipient_id;
  if not found then
    return null;
  end if;

  if v_row.agreement_id is not null then
    select * into v_agreement from public.da_agreement where id = v_row.agreement_id;
    if found then
      select name into v_template_name
        from public.da_agreement_template
       where id = v_agreement.template_id;
    end if;
  end if;

  if v_row.opened_at is null then
    update public.da_onboarding_submission
       set opened_at = now()
     where id = v_row.id
    returning * into v_row;
  end if;

  return jsonb_build_object(
    'submission', jsonb_build_object(
      'id', v_row.id,
      'protocol_key', v_row.protocol_key,
      'status', v_row.status,
      'answers', v_row.answers,
      'completed_at', v_row.completed_at,
      'agreement_id', v_row.agreement_id
    ),
    'recipient', jsonb_build_object(
      'full_name', v_recipient.full_name,
      'email', v_recipient.email,
      'phone', v_recipient.phone
    ),
    'agreement', case
      when v_agreement.id is null then null
      else jsonb_build_object(
        'id', v_agreement.id,
        'status', v_agreement.status,
        'template_name', coalesce(v_template_name, 'Agreement'),
        'signed', v_agreement.status = 'completed'
      )
    end
  );
end;
$$;

revoke all on function public.da_load_onboarding(text) from public;
grant execute on function public.da_load_onboarding(text) to anon, authenticated, service_role;

create or replace function public.da_submit_onboarding(
  p_token text,
  p_answers jsonb
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_token text := btrim(coalesce(p_token, ''));
  v_row public.da_onboarding_submission%rowtype;
  v_agreement public.da_agreement%rowtype;
begin
  if length(v_token) < 32 then
    return false;
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    return false;
  end if;

  select * into v_row
    from public.da_onboarding_submission
   where access_token = v_token;

  if not found then
    return false;
  end if;

  if v_row.status = 'completed' then
    return true;
  end if;

  if v_row.agreement_id is not null then
    select * into v_agreement from public.da_agreement where id = v_row.agreement_id;
    if not found or v_agreement.status <> 'completed' then
      raise exception 'agreement_unsigned: Sign the agreement before submitting onboarding.';
    end if;
  end if;

  update public.da_onboarding_submission
     set answers = p_answers,
         status = 'completed',
         completed_at = now(),
         opened_at = coalesce(opened_at, now())
   where id = v_row.id;

  return true;
end;
$$;

revoke all on function public.da_submit_onboarding(text, jsonb) from public;
grant execute on function public.da_submit_onboarding(text, jsonb) to anon, authenticated, service_role;

-- Include onboarding link on the signing page payload.
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
      'template_id', v_row.template_id,
      'onboarding_token', v_row.onboarding_token,
      'onboarding_url', v_row.onboarding_url
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
