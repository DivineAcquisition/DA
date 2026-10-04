-- Public application capture. da_leads is admin-only under RLS, so the
-- landing form cannot insert with the anon key. This definer writes the
-- lead and returns the schedule token the booking page resolves.

create or replace function public.acq_capture_application(p_lead jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_lead->>'email', '')));
  v_name text := btrim(coalesce(p_lead->>'fullName', '')));
  v_phone text := btrim(coalesce(p_lead->>'phone', ''));
  v_company text := btrim(coalesce(p_lead->>'companyName', ''));
  v_niche text := btrim(coalesce(p_lead->>'coachingNiche', ''));
  v_spend text := btrim(coalesce(p_lead->>'monthlyAdSpend', ''));
  v_follow text := btrim(coalesce(p_lead->>'followUpOwner', ''));
  v_price text := btrim(coalesce(p_lead->>'programPrice', ''));
  v_stage text := btrim(coalesce(p_lead->>'stage', 'Step 1 Captured'));
  v_result text := nullif(btrim(coalesce(p_lead->>'qualificationResult', '')), '');
  v_score int := nullif(p_lead->>'readinessScore', '')::int;
  v_ghl text := btrim(coalesce(p_lead->>'ghlContactId', ''));
  v_notes text := '';
  v_token text := nullif(btrim(coalesce(p_lead->>'scheduleToken', '')), '');
  v public.da_leads%rowtype;
begin
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(v_email) > 320 then
    raise exception 'email: enter a valid email' using errcode = '22023';
  end if;
  if length(v_name) < 2 or length(v_name) > 200 then
    raise exception 'full_name: enter your full name' using errcode = '22023';
  end if;
  if length(v_phone) > 40 or length(v_company) > 200 or length(v_niche) > 200
     or length(v_spend) > 40 or length(v_follow) > 80 or length(v_price) > 40
     or length(v_stage) < 1 or length(v_stage) > 80 or length(v_ghl) > 80 then
    raise exception 'lead: check the form and try again' using errcode = '22023';
  end if;
  if v_result is not null and v_result not in ('Qualified', 'Manual Review', 'Disqualified') then
    v_result := null;
  end if;
  if v_score is not null and (v_score < 0 or v_score > 100) then
    v_score := null;
  end if;

  select * into v
  from public.da_leads
  where lower(email) = v_email
  limit 1;

  if v.id is not null and coalesce(length(v.schedule_token), 0) >= 32 then
    v_token := v.schedule_token;
  end if;
  if v_token is null or length(v_token) < 32 or length(v_token) > 200 then
    raise exception 'schedule_token: missing token' using errcode = '22023';
  end if;

  if coalesce(v.notes, '') <> '' then
    v_notes := v.notes;
  elsif coalesce(p_lead->>'inquiriesPerMonth', '') ~ '^\d+$' then
    v_notes := 'Inquiries per month: ' || (p_lead->>'inquiriesPerMonth');
  end if;

  if v.id is null then
    insert into public.da_leads (
      full_name, email, phone, company_name, coaching_niche, stage,
      qualification_result, readiness_score, monthly_ad_spend, follow_up_owner,
      program_price, notes, ghl_contact_id, schedule_token, payload
    )
    values (
      v_name, v_email, v_phone, v_company, v_niche, v_stage,
      v_result, v_score, v_spend, v_follow,
      v_price, v_notes, v_ghl, v_token,
      jsonb_strip_nulls(jsonb_build_object(
        'scheduleToken', v_token,
        'offer', nullif(v_niche, ''),
        'inquiriesPerMonth', case
          when coalesce(p_lead->>'inquiriesPerMonth', '') ~ '^\d+$'
            then (p_lead->>'inquiriesPerMonth')::int
          else null
        end,
        'source', nullif(p_lead->>'source', ''),
        'tracking', coalesce(p_lead->'tracking', '{}'::jsonb),
        'tags', coalesce(p_lead->'tags', '[]'::jsonb)
      ))
    )
    returning * into v;
  else
    update public.da_leads
       set full_name = v_name,
           phone = case when v_phone <> '' then v_phone else phone end,
           company_name = case when v_company <> '' then v_company else company_name end,
           coaching_niche = case when v_niche <> '' then v_niche else coaching_niche end,
           qualification_result = coalesce(v_result, qualification_result),
           readiness_score = coalesce(v_score, readiness_score),
           monthly_ad_spend = case when v_spend <> '' then v_spend else monthly_ad_spend end,
           follow_up_owner = case when v_follow <> '' then v_follow else follow_up_owner end,
           program_price = case when v_price <> '' then v_price else program_price end,
           notes = v_notes,
           ghl_contact_id = case when v_ghl <> '' then v_ghl else ghl_contact_id end,
           schedule_token = v_token,
           payload = coalesce(payload, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
             'scheduleToken', v_token,
             'offer', nullif(v_niche, ''),
             'inquiriesPerMonth', case
          when coalesce(p_lead->>'inquiriesPerMonth', '') ~ '^\d+$'
            then (p_lead->>'inquiriesPerMonth')::int
          else null
        end,
             'source', nullif(p_lead->>'source', ''),
             'tracking', coalesce(p_lead->'tracking', '{}'::jsonb),
             'tags', coalesce(p_lead->'tags', '[]'::jsonb)
           ))
     where id = v.id
     returning * into v;
  end if;

  return jsonb_build_object(
    'id', v.id,
    'schedule_token', v.schedule_token
  );
end;
$$;

revoke all on function public.acq_capture_application(jsonb) from public;
grant execute on function public.acq_capture_application(jsonb) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
