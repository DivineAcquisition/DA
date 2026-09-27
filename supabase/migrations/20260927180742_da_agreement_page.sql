-- The recipient-facing agreement page (/s/<token>).
--
-- One lookup, da_agreement_page(), returns exactly what the page for one
-- agreement needs and nothing else, shaped by the state the recipient should
-- see. Every way a token can fail (no match, malformed, link expired, status
-- expired, too many bad tries from one client) returns the same
-- {"state":"invalid"}, so the response cannot be used to tell a real token
-- from a guess.
--
-- The recipient-facing link is da_agreement.signing_url, the DA-hosted
-- /s/<token> URL that lib/workspace/actions.ts emails. provider_signing_url
-- (DocuSeal's /s/<slug>) is internal: it is what the page hands the DocuSeal
-- embed, and it never goes into an email.

-- Bad-token attempts, for rate limiting. Only a hash of the caller is kept.
create table if not exists public.da_token_probe (
  id bigint generated always as identity primary key,
  client_hash text not null,
  at timestamptz not null default now()
);

create index if not exists da_token_probe_client_idx on public.da_token_probe (client_hash, at desc);
create index if not exists da_token_probe_at_idx on public.da_token_probe (at desc);

alter table public.da_token_probe enable row level security;
revoke all on public.da_token_probe from public, anon, authenticated;

create or replace function public.da_agreement_page(
  p_token text,
  p_client text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_token text := btrim(coalesce(p_token, ''));
  v_client text := app.hash_token(coalesce(nullif(btrim(p_client), ''), 'unknown'));
  v_invalid constant jsonb := jsonb_build_object('state', 'invalid');
  v_row public.da_agreement%rowtype;
  v_next public.da_agreement%rowtype;
  v_recipient public.da_recipient%rowtype;
  v_template public.da_agreement_template%rowtype;
  v_embed text;
  v_hops integer := 0;
begin
  -- Too many misses from this client in ten minutes, or a flood across all
  -- clients (p_client can be spoofed by a direct caller), and nothing is
  -- looked up at all.
  if (select count(*) from public.da_token_probe
       where client_hash = v_client and at > now() - interval '10 minutes') >= 20
     or (select count(*) from public.da_token_probe
          where at > now() - interval '1 minute') >= 300 then
    return v_invalid;
  end if;

  if v_token !~ '^[A-Za-z0-9_-]{32,128}$' then
    insert into public.da_token_probe (client_hash) values (v_client);
    return v_invalid;
  end if;

  select * into v_row from public.da_agreement where access_token = v_token;

  if not found then
    insert into public.da_token_probe (client_hash) values (v_client);
    delete from public.da_token_probe where at < now() - interval '1 day';
    return v_invalid;
  end if;

  select * into v_recipient from public.da_recipient where id = v_row.recipient_id;
  select * into v_template from public.da_agreement_template where id = v_row.template_id;

  if v_row.status = 'completed' then
    return jsonb_build_object(
      'state', 'completed',
      'recipient_name', v_recipient.full_name,
      'template_name', coalesce(v_template.name, 'Agreement'),
      'completed_at', v_row.completed_at,
      'has_signed_document', v_row.signed_document_url is not null
        or v_row.docuseal_submission_id is not null,
      'onboarding_url', nullif(btrim(coalesce(v_row.onboarding_url, '')), '')
    );
  end if;

  if v_row.superseded_by_id is not null then
    -- Follow the chain to the newest version.
    v_next := v_row;
    while v_next.superseded_by_id is not null and v_hops < 10 loop
      select * into v_next from public.da_agreement where id = v_next.superseded_by_id;
      exit when not found;
      v_hops := v_hops + 1;
    end loop;

    return jsonb_build_object(
      'state', 'superseded',
      'redirect_token', case
        when v_next.id is not null
         and v_next.id <> v_row.id
         and v_next.superseded_by_id is null
         and v_next.recipient_id = v_row.recipient_id
         and v_next.status in ('sent', 'viewed')
         and v_next.access_token is not null
         and not public.da_signing_link_expired(v_next)
        then v_next.access_token
        else null
      end
    );
  end if;

  if v_row.status = 'declined' then
    return jsonb_build_object('state', 'declined');
  end if;

  -- Status expired or the link's own window passed: same answer as a guess.
  if v_row.status = 'expired' or public.da_signing_link_expired(v_row) then
    return v_invalid;
  end if;

  -- Opened for the first time: sent -> viewed, and only ever forward. A
  -- reload keeps the first viewed_at.
  if v_row.status = 'sent' then
    update public.da_agreement
       set status = 'viewed',
           viewed_at = coalesce(viewed_at, now())
     where id = v_row.id
       and status = 'sent'
    returning * into v_row;
  end if;

  v_embed := nullif(btrim(coalesce(v_row.provider_signing_url, '')), '');
  if v_embed is null and nullif(btrim(coalesce(v_row.docuseal_slug, '')), '') is not null then
    v_embed := 'https://docuseal.com/s/' || btrim(v_row.docuseal_slug);
  end if;

  return jsonb_build_object(
    'state', 'open',
    'status', v_row.status,
    'recipient_name', v_recipient.full_name,
    'recipient_type', v_recipient.recipient_type,
    'business_name', case when v_recipient.recipient_type = 'client' then v_recipient.business_name end,
    'email', v_recipient.email,
    'template_name', coalesce(v_template.name, 'Agreement'),
    'template_description', nullif(btrim(coalesce(v_template.description, '')), ''),
    'embed_src', v_embed,
    'pages', coalesce((
      select jsonb_agg(jsonb_build_object(
               'title', p.title,
               'body_markdown', p.body_markdown
             ) order by tp.sort_order, tp.id)
        from public.da_agreement_template_page tp
        join public.da_page_template p on p.id = tp.page_template_id
       where tp.agreement_template_id = v_row.template_id
    ), '[]'::jsonb)
  );
end;
$$;

comment on function public.da_agreement_page(text, text) is
  'Everything the public /s/<token> page shows for one agreement, by state: open, completed, declined, superseded, or invalid (every failure, identical).';

-- The page is a Next.js server component reached with the anon key during the
-- DivineACQ cutover (lib/workspace/resolve-signing.ts), like /o/<token>.
revoke all on function public.da_agreement_page(text, text) from public;
grant execute on function public.da_agreement_page(text, text) to anon, authenticated, service_role;

-- Where the signed copy lives, for the same-origin download route only.
-- Returns nothing unless the agreement is completed.
create or replace function public.da_agreement_signed_copy(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
           'signed_document_url', a.signed_document_url,
           'docuseal_submission_id', a.docuseal_submission_id,
           'template_name', t.name
         )
    from public.da_agreement a
    left join public.da_agreement_template t on t.id = a.template_id
   where a.access_token = btrim(coalesce(p_token, ''))
     and length(btrim(coalesce(p_token, ''))) >= 32
     and a.status = 'completed';
$$;

revoke all on function public.da_agreement_signed_copy(text) from public;
grant execute on function public.da_agreement_signed_copy(text) to anon, authenticated, service_role;
