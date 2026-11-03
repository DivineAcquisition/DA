-- A client who books in another tool maps wins to tags. That placement can start
-- without a GHL calendar and without the older field-mapping check. An agency
-- token is for provisioning users. A healthy location connection already has
-- the operator's user, so the missing agency token does not block the start.

create or replace function app.ghl_readiness(p_case_file_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_link public.ghl_location;
  v_conn public.ghl_connection;
  v_agency public.ghl_connection;
  v_checks jsonb := '[]'::jsonb;
  v_ready boolean := true;
  v_sales_mapped boolean := false;
  v_books_with_tags boolean := false;
begin
  select * into v_link from public.ghl_location where case_file_id = p_case_file_id;
  v_conn := app.ghl_live_connection(p_case_file_id);
  v_agency := app.ghl_live_connection(null);

  select exists (
    select 1
    from public.placement pl
    join public.sales_ghl_link l on l.placement_id = pl.id
    where pl.case_file_id = p_case_file_id
      and jsonb_typeof(l.mapping -> 'outcomes') = 'array'
      and jsonb_array_length(l.mapping -> 'outcomes') > 0
  ) into v_sales_mapped;

  select v_sales_mapped
    and not exists (
      select 1
      from public.placement pl
      join public.sales_ghl_link l on l.placement_id = pl.id
      cross join lateral jsonb_array_elements(l.mapping -> 'outcomes') item
      where pl.case_file_id = p_case_file_id
        and nullif(item ->> 'calendar_id', '') is not null
    )
    and exists (
      select 1
      from public.placement pl
      join public.sales_ghl_link l on l.placement_id = pl.id
      cross join lateral jsonb_array_elements(l.mapping -> 'outcomes') item
      where pl.case_file_id = p_case_file_id
        and jsonb_array_length(coalesce(item #> '{tags,all}', '[]'::jsonb))
          + jsonb_array_length(coalesce(item #> '{tags,any}', '[]'::jsonb)) > 0
    )
  into v_books_with_tags;

  v_checks := v_checks || jsonb_build_object('key', 'linked', 'label', 'Sub-account linked', 'blocking', true,
    'ok', v_link.case_file_id is not null,
    'detail', coalesce('Location ' || v_link.location_id, 'No Location ID linked'));
  v_checks := v_checks || jsonb_build_object('key', 'connection', 'label', 'Connection healthy', 'blocking', true,
    'ok', v_conn.status in ('healthy', 'degraded'),
    'detail', case when v_conn.id is null then 'No token added' else 'Status: ' || v_conn.status::text ||
      coalesce(', last success ' || to_char(v_conn.last_success_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI "UTC"'), '') end);
  v_checks := v_checks || jsonb_build_object('key', 'scopes', 'label', 'Required scopes present', 'blocking', true,
    'ok', v_conn.id is not null and v_conn.last_success_at is not null and coalesce(array_length(v_conn.scopes_missing, 1), 0) = 0,
    'detail', case when v_conn.id is null or v_conn.last_success_at is null then 'Not checked yet'
                   when coalesce(array_length(v_conn.scopes_missing, 1), 0) = 0 then 'All present'
                   else 'Missing: ' || array_to_string(v_conn.scopes_missing, ', ') end);
  v_checks := v_checks || jsonb_build_object('key', 'agency', 'label', 'Agency connection healthy (for user provisioning)',
    'blocking', v_conn.status is distinct from 'healthy' and v_conn.status is distinct from 'degraded',
    'ok', v_agency.id is not null and v_agency.status in ('healthy', 'degraded') and coalesce(array_length(v_agency.scopes_missing, 1), 0) = 0,
    'detail', case when v_agency.id is null then 'No agency token. The location connection is used instead.'
                   else 'Status: ' || v_agency.status::text end);
  v_checks := v_checks || jsonb_build_object('key', 'mapping', 'label', 'Mapping complete, no drift', 'blocking', true,
    'ok', (v_link.mapping_checked_at is not null and v_link.mapping_drift = 0 and v_link.mapping_missing = 0) or v_sales_mapped,
    'detail', case when v_sales_mapped then 'Sales outcomes are mapped.'
                   when v_link.mapping_checked_at is null then 'Not mapped yet'
                   when v_link.mapping_drift + v_link.mapping_missing = 0 then 'Matches the standard'
                   else format('%s missing, %s different', v_link.mapping_missing, v_link.mapping_drift) end);
  v_checks := v_checks || jsonb_build_object('key', 'calendar', 'label', 'At least one calendar',
    'blocking', not v_books_with_tags,
    'ok', coalesce(v_link.calendars_found, 0) >= 1 or v_books_with_tags,
    'detail', case when v_books_with_tags then 'Bookings are mapped to tags, not a GHL calendar.'
                   else coalesce(v_link.calendars_found, 0)::text || ' found' end);
  v_checks := v_checks || jsonb_build_object('key', 'a2p', 'label', 'A2P registration recorded', 'blocking', false,
    'ok', v_link.a2p_recorded_at is not null,
    'detail', case when v_link.a2p_recorded_at is null then 'Not recorded (enforced from Prompt 10)' else 'Recorded: ' || coalesce(v_link.a2p_reference, '') end);

  select bool_and(coalesce((c ->> 'ok')::boolean, false)) into v_ready
  from jsonb_array_elements(v_checks) c
  where (c ->> 'blocking')::boolean;
  return jsonb_build_object('ready', coalesce(v_ready, false), 'checks', v_checks);
end;
$$;
