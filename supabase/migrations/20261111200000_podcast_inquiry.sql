-- Podcast listeners request a 1-on-1 at divineacquisition.io/biv/pod. The
-- request lands in the Pipeline like the diagnostic, with its own source.

alter table public.site_inquiry drop constraint if exists site_inquiry_kind_check;
alter table public.site_inquiry
  add constraint site_inquiry_kind_check check (kind in ('diagnostic', 'discovery', 'podcast', 'sales_review', 'cleaning_audit'));

create or replace function app.inquiry_source(p_kind text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_kind
    when 'diagnostic' then 'Sales Operations Diagnostic'
    when 'discovery' then 'Sales Operations Diagnostic'
    when 'podcast' then 'Podcast'
    when 'sales_review' then 'Sales Operations Review'
    when 'cleaning_audit' then 'Cleaning Audit'
    else 'Website'
  end;
$$;


create or replace function public.site_capture_inquiry(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text := coalesce(p ->> 'kind', '');
  v_email text := lower(btrim(coalesce(p ->> 'email', '')));
  v_name text := nullif(left(btrim(coalesce(p ->> 'full_name', '')), 200), '');
  v_company text := nullif(left(btrim(coalesce(p ->> 'company', '')), 200), '');
  v_phone text := nullif(left(btrim(coalesce(p ->> 'phone', '')), 40), '');
  v_ghl text := nullif(left(btrim(coalesce(p ->> 'ghl_contact_id', '')), 80), '');
  v_id uuid := coalesce(nullif(p ->> 'inquiry_id', '')::uuid, gen_random_uuid());
  v_answers jsonb := case when jsonb_typeof(p -> 'answers') = 'array' then p -> 'answers' else '[]'::jsonb end;
  v_stage text := case when v_kind in ('sales_review', 'cleaning_audit') then 'Manual Review' else 'Qualified - Not Booked' end;
  v_lead public.da_leads;
begin
  if v_kind not in ('diagnostic', 'discovery', 'podcast', 'sales_review', 'cleaning_audit') then
    raise exception 'invalid: unknown inquiry kind' using errcode = '23514';
  end if;
  if position('@' in v_email) <= 1 or length(v_email) > 320 then
    raise exception 'invalid: an email is required' using errcode = '23514';
  end if;

  select * into v_lead from public.da_leads where lower(email) = v_email and email <> '' for update;

  if v_lead.id is null then
    insert into public.da_leads (full_name, email, phone, company_name, stage, ghl_contact_id, next_action, payload)
    values (
      coalesce(v_name, ''), v_email, coalesce(v_phone, ''), coalesce(v_company, ''), v_stage, coalesce(v_ghl, ''),
      case
        when v_stage = 'Manual Review' then 'Review the request and reach out'
        when v_kind = 'podcast' then 'Book the 1-on-1 call'
        else 'Book the diagnostic call'
      end,
      jsonb_build_object('source', app.inquiry_source(v_kind), 'origin', 'site', 'first_inquiry', v_kind)
    )
    returning * into v_lead;
  else
    update public.da_leads l
       set full_name = case when coalesce(btrim(l.full_name), '') = '' then coalesce(v_name, '') else l.full_name end,
           phone = case when coalesce(btrim(l.phone), '') = '' then coalesce(v_phone, '') else l.phone end,
           company_name = case when coalesce(btrim(l.company_name), '') = '' then coalesce(v_company, '') else l.company_name end,
           ghl_contact_id = case when coalesce(btrim(l.ghl_contact_id), '') = '' then coalesce(v_ghl, '') else l.ghl_contact_id end,
           -- A new request reopens a lead that was closed out, except a won one.
           stage = case
             when v_kind <> 'discovery' and l.stage in ('Disqualified', 'Closed Lost', 'Recycled', 'Application Abandoned', 'Step 1 Captured') then v_stage
             else l.stage
           end,
           payload = coalesce(l.payload, '{}'::jsonb) || jsonb_build_object('last_inquiry', v_kind, 'last_inquiry_at', now())
     where l.id = v_lead.id
    returning * into v_lead;
  end if;

  insert into public.site_inquiry (id, kind, lead_id, email, full_name, company, phone, answers)
  values (v_id, v_kind, v_lead.id, v_email, v_name, v_company, v_phone, v_answers)
  on conflict (id) do nothing;

  return v_lead.id;
end;
$$;

revoke all on function app.inquiry_source(text) from public, anon, authenticated;
revoke all on function public.site_capture_inquiry(jsonb) from public, anon, authenticated;
grant execute on function public.site_capture_inquiry(jsonb) to service_role;
