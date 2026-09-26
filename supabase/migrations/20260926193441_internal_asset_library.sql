-- Internal asset library: SOPs, scripts, playbooks and templates that belong to
-- Divine Acquisition rather than to one client.
--
-- case_file_drive_folder and evidence_item are both scoped to a client case
-- file (evidence_item is proof-of-work with review tracking). Neither is
-- touched here. This is a separate, general-purpose table.
--
-- Access is modelled on da_agreement_template, the closest internal,
-- admin-managed table with no client scope: admins (owner / admin, via
-- app.is_admin()) write. Unlike that table, internal staff also read, and
-- clients read client-facing assets through app.client_case_file_id(), the
-- same active-client-account gate that app.client_can_read() uses for the
-- client_provided evidence they already see.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'internal_asset_audience') then
    -- The three audiences settled for the Document Hub.
    create type public.internal_asset_audience as enum ('internal', 'sales', 'client_facing');
  end if;
end
$$;

create table if not exists public.internal_asset (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 200),
  description text,
  drive_file_id text check (drive_file_id is null or length(btrim(drive_file_id)) between 1 and 200),
  drive_url text check (drive_url is null or drive_url ~ '^https://'),
  tags text[] not null default '{}',
  audience public.internal_asset_audience not null default 'internal',
  created_by uuid references public.profile (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Retired, not deleted. Onboarding steps may still point at it.
  archived_at timestamptz,
  constraint internal_asset_has_drive_ref check (drive_file_id is not null or drive_url is not null)
);

comment on table public.internal_asset is
  'General internal material (SOPs, scripts, playbooks, templates) not tied to a client. Client-scoped Drive material stays in case_file_drive_folder / evidence_item.';

-- Tag search uses array containment / overlap (tags @> array['sop']), which a
-- GIN index serves directly.
create index if not exists internal_asset_tags_gin
  on public.internal_asset using gin (tags);

create index if not exists internal_asset_audience_idx
  on public.internal_asset (audience)
  where archived_at is null;

-- Same last-updated trigger client_case_file, operator and the rest use.
drop trigger if exists internal_asset_touch on public.internal_asset;
create trigger internal_asset_touch
  before update on public.internal_asset
  for each row execute function app.touch_updated_at();

alter table public.internal_asset enable row level security;

drop policy if exists internal_asset_admin_all on public.internal_asset;
create policy internal_asset_admin_all on public.internal_asset
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

-- Any active signed-in account that is not a client.
drop policy if exists internal_asset_staff_read on public.internal_asset;
create policy internal_asset_staff_read on public.internal_asset
  for select to authenticated using (
    exists (
      select 1 from public.profile p
       where p.id = app.acting_profile()
         and p.role <> 'client'
         and app.effective_state(p.id) = 'active'
    )
  );

drop policy if exists internal_asset_client_read on public.internal_asset;
create policy internal_asset_client_read on public.internal_asset
  for select to authenticated using (
    audience = 'client_facing'
    and archived_at is null
    and app.client_case_file_id() is not null
  );

revoke all on public.internal_asset from anon;
grant select, insert, update, delete on public.internal_asset to authenticated;

-- Onboarding steps can point at an asset. Every step kind may attach one as
-- supporting material; a material_review step must, since the asset is what
-- is being reviewed. Restrict, not cascade: deleting an asset a step still
-- uses should fail loudly. Archive it instead.
alter table public.da_onboarding_protocol_step
  add column if not exists asset_id uuid
    references public.internal_asset (id) on delete restrict;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'da_onboarding_step_review_has_asset') then
    alter table public.da_onboarding_protocol_step
      add constraint da_onboarding_step_review_has_asset
      check (kind <> 'material_review' or asset_id is not null);
  end if;
end
$$;

create index if not exists da_onboarding_protocol_step_asset_idx
  on public.da_onboarding_protocol_step (asset_id)
  where asset_id is not null;

-- The public onboarding page gets each step's asset (title and link) so a
-- review step can be rendered. Archived assets are left out.
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
  v_protocol public.da_onboarding_protocol%rowtype;
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

  select * into v_protocol from public.da_onboarding_protocol where key = v_row.protocol_key;

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
    'protocol', jsonb_build_object(
      'key', v_protocol.key,
      'name', v_protocol.name,
      'description', v_protocol.description,
      'steps', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'key', s.key,
                 'label', s.label,
                 'kind', s.kind,
                 'help', s.help,
                 'options', to_jsonb(s.options),
                 'required', s.required,
                 'asset', case
                   when a.id is null then null
                   else jsonb_build_object('title', a.title, 'url', a.drive_url)
                 end
               ) order by s.sort_order, s.key)
          from public.da_onboarding_protocol_step s
          left join public.internal_asset a
            on a.id = s.asset_id and a.archived_at is null
         where s.protocol_key = v_row.protocol_key
      ), '[]'::jsonb)
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
