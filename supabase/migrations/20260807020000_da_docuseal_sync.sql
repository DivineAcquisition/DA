-- ---------------------------------------------------------------------------
-- Divine Acquisition admin workspace: DocuSeal pull + automatic field mapping
--
-- Everything that already lives in DocuSeal is pulled into the workspace:
-- templates (with their field catalogue), submissions, and the values each
-- submitter has already entered. Those captured values become the recipient's
-- known profile, which is what auto-mapping fills the next agreement from
-- before the signer ever opens it.
-- ---------------------------------------------------------------------------

-- Templates carry their DocuSeal field catalogue so mapping can run without a
-- round trip, and so the workspace can list templates authored in DocuSeal.
alter table public.da_agreement_template
  add column if not exists docuseal_slug text,
  add column if not exists docuseal_folder text,
  add column if not exists docuseal_fields jsonb not null default '[]'::jsonb,
  add column if not exists docuseal_submitters jsonb not null default '[]'::jsonb,
  add column if not exists archived boolean not null default false,
  add column if not exists synced_at timestamptz;

-- One local template per DocuSeal template keeps the pull idempotent. Skipped
-- rather than enforced if the table already holds duplicates.
do $$
begin
  if not exists (
    select 1
      from public.da_agreement_template
     group by docuseal_template_id
    having count(*) > 1
  ) then
    create unique index if not exists da_agreement_template_docuseal_uq
      on public.da_agreement_template (docuseal_template_id);
  end if;
end
$$;

-- Agreements record where they came from, what was pre-filled, and what the
-- signer actually submitted.
alter table public.da_agreement
  add column if not exists source text not null default 'workspace',
  add column if not exists docuseal_submitter_id text,
  add column if not exists docuseal_slug text,
  add column if not exists submitter_email text,
  add column if not exists prefilled_values jsonb not null default '{}'::jsonb,
  add column if not exists submitted_values jsonb not null default '{}'::jsonb,
  add column if not exists unmapped_fields jsonb not null default '[]'::jsonb,
  add column if not exists audit_log_url text,
  add column if not exists synced_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'da_agreement_source_chk'
  ) then
    alter table public.da_agreement
      add constraint da_agreement_source_chk check (source in ('workspace', 'docuseal'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
      from public.da_agreement
     where docuseal_submission_id is not null
     group by docuseal_submission_id
    having count(*) > 1
  ) then
    create unique index if not exists da_agreement_submission_uq
      on public.da_agreement (docuseal_submission_id)
      where docuseal_submission_id is not null;
  end if;
end
$$;

create index if not exists da_recipient_email_idx on public.da_recipient (lower(email));

-- Everything a recipient has ever entered on a DocuSeal form, keyed by the
-- field label it was entered against. This is the source auto-mapping reads.
create table if not exists public.da_recipient_field (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.da_recipient (id) on delete cascade,
  field_name text not null check (length(btrim(field_name)) between 1 and 200),
  field_key text generated always as (lower(btrim(field_name))) stored,
  value text not null default '',
  source text not null default 'docuseal' check (source in ('docuseal', 'manual')),
  agreement_id uuid references public.da_agreement (id) on delete set null,
  observed_at timestamptz not null default now()
);

create unique index if not exists da_recipient_field_uq
  on public.da_recipient_field (recipient_id, field_key);
create index if not exists da_recipient_field_recipient_idx
  on public.da_recipient_field (recipient_id, observed_at desc);

-- Explicit overrides for the automatic mapping. A row with a null template
-- applies everywhere; a row with a template wins for that template only.
create table if not exists public.da_field_mapping (
  id uuid primary key default gen_random_uuid(),
  agreement_template_id uuid references public.da_agreement_template (id) on delete cascade,
  field_name text not null check (length(btrim(field_name)) between 1 and 200),
  field_key text generated always as (lower(btrim(field_name))) stored,
  -- A canonical profile key ('full_name'), 'literal' to use literal_value, or
  -- 'ignore' to leave the field for the signer.
  source_key text not null check (length(btrim(source_key)) between 1 and 80),
  literal_value text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists da_field_mapping_template_uq
  on public.da_field_mapping (agreement_template_id, field_key)
  where agreement_template_id is not null;
create unique index if not exists da_field_mapping_global_uq
  on public.da_field_mapping (field_key)
  where agreement_template_id is null;

create table if not exists public.da_sync_run (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  templates_synced integer not null default 0,
  submissions_synced integer not null default 0,
  recipients_created integer not null default 0,
  values_captured integer not null default 0,
  ok boolean not null default false,
  error text
);

create index if not exists da_sync_run_started_idx on public.da_sync_run (started_at desc);

-- Auto-prefill switches live beside the credentials they depend on.
alter table public.da_settings
  add column if not exists auto_prefill boolean not null default true,
  add column if not exists prefill_readonly boolean not null default false,
  add column if not exists last_synced_at timestamptz;

-- RLS -----------------------------------------------------------------------

alter table public.da_recipient_field enable row level security;
alter table public.da_field_mapping enable row level security;
alter table public.da_sync_run enable row level security;

drop policy if exists da_recipient_field_admin_all on public.da_recipient_field;
create policy da_recipient_field_admin_all on public.da_recipient_field
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

drop policy if exists da_field_mapping_admin_all on public.da_field_mapping;
create policy da_field_mapping_admin_all on public.da_field_mapping
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

drop policy if exists da_sync_run_admin_all on public.da_sync_run;
create policy da_sync_run_admin_all on public.da_sync_run
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

revoke all on public.da_recipient_field from anon, authenticated;
revoke all on public.da_field_mapping from anon, authenticated;
revoke all on public.da_sync_run from anon, authenticated;

grant select, insert, update, delete on public.da_recipient_field to authenticated;
grant select, insert, update, delete on public.da_field_mapping to authenticated;
grant select, insert, update, delete on public.da_sync_run to authenticated;

-- The webhook door already writes agreement status without a session. It now
-- also records what the signer submitted, so a completed agreement carries its
-- own answers and feeds the recipient profile.
create or replace function public.da_apply_agreement_values(
  p_submission_id text,
  p_values jsonb
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_agreement public.da_agreement%rowtype;
  v_key text;
  v_value text;
begin
  if p_values is null or jsonb_typeof(p_values) <> 'object' then
    return false;
  end if;

  select * into v_agreement
    from public.da_agreement
   where docuseal_submission_id = btrim(p_submission_id)
     and superseded_by_id is null
   limit 1;

  if not found then
    return false;
  end if;

  update public.da_agreement
     set submitted_values = p_values,
         synced_at = now()
   where id = v_agreement.id;

  for v_key, v_value in select key, value from jsonb_each_text(p_values) loop
    if v_value is null or btrim(v_value) = '' then
      continue;
    end if;
    insert into public.da_recipient_field (recipient_id, field_name, value, source, agreement_id)
    values (v_agreement.recipient_id, v_key, v_value, 'docuseal', v_agreement.id)
    on conflict (recipient_id, field_key) do update
      set value = excluded.value,
          source = excluded.source,
          agreement_id = excluded.agreement_id,
          observed_at = now();
  end loop;

  return true;
end;
$$;

revoke all on function public.da_apply_agreement_values(text, jsonb) from public;
grant execute on function public.da_apply_agreement_values(text, jsonb)
  to anon, authenticated, service_role;
