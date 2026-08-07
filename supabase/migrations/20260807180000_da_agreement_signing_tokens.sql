-- Tokenized public signing links on admin.divineacquisition.io (/s/<token>).
-- DocuSeal still hosts the form; the emailed URL and branding stay on DA.

alter table public.da_agreement
  add column if not exists access_token text,
  add column if not exists provider_signing_url text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'da_agreement_access_token_len'
  ) then
    alter table public.da_agreement
      add constraint da_agreement_access_token_len
      check (access_token is null or length(access_token) >= 32);
  end if;
end $$;

create unique index if not exists da_agreement_access_token_uq
  on public.da_agreement (access_token)
  where access_token is not null;

-- Backfill provider URL from legacy signing_url when it points at DocuSeal.
update public.da_agreement
   set provider_signing_url = signing_url
 where provider_signing_url is null
   and signing_url is not null
   and (
     signing_url like 'https://docuseal.com/%'
     or signing_url like 'https://%.docuseal.com/%'
   );

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

  if v_row.status in ('declined', 'expired') then
    return null;
  end if;

  if v_row.superseded_by_id is not null then
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

comment on function public.da_resolve_signing_token is
  'Public tokenized signing entry: returns DocuSeal destination. Same null for missing/voided/superseded.';
