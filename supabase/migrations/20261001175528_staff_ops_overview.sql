-- The admin app's home: clients and their readiness, and what needs attention.
-- Live counts only, scoped like every other staff read (managers see the
-- clients in their scope; pay is admins only).
create or replace function public.staff_ops_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_admin boolean;
begin
  perform app.require_staff();
  v_admin := app.is_admin();
  return jsonb_build_object(
    'is_admin', v_admin,
    'clients', coalesce((
      select jsonb_agg(jsonb_build_object(
        'case_file_id', cf.id, 'name', cf.name, 'status', cf.status,
        'linked', gl.case_file_id is not null,
        'ready', (app.ghl_readiness(cf.id) ->> 'ready')::boolean,
        'connection', (app.ghl_live_connection(cf.id)).status,
        'placements', (select count(*) from public.placement p where p.case_file_id = cf.id and p.status = 'active'),
        'last_event_at', (select max(e.received_at) from public.ingest_event e where e.case_file_id = cf.id)
      ) order by cf.name)
      from public.client_case_file cf
      left join public.ghl_location gl on gl.case_file_id = cf.id
      where cf.status <> 'ended' and app.ghl_can_see(cf.id)), '[]'::jsonb),
    'attention', jsonb_build_object(
      'bookings_to_review', (select count(*) from public.booking b where b.state = 'pending_review' and app.ghl_can_see(b.case_file_id)),
      'escalations_open', (select count(*) from public.escalation e where e.status = 'open' and app.ghl_can_see(e.case_file_id)),
      'shift_reviews_unconfirmed', (select count(*) from public.shift_draft d join public.placement p on p.id = d.placement_id
                                     where d.status = 'unconfirmed' and app.ghl_can_see(p.case_file_id)),
      'disputes_open', (select count(*) from public.standard_dispute d join public.placement p on p.id = d.placement_id
                         where d.status = 'open' and app.ghl_can_see(p.case_file_id)),
      'blockers_open', (select count(*) from public.shift_blocker b join public.placement p on p.id = b.placement_id
                         where b.resolved_at is null and app.ghl_can_see(p.case_file_id)),
      'formal_notices_awaiting', case when v_admin then (select count(*) from public.formal_notice where status = 'draft') end,
      'pay_questions_open', case when v_admin then (select count(*) from public.pay_question where answered_at is null) end,
      'ghl_actions_failed', (select count(*) from public.ghl_job j where j.status in ('failed', 'dead') and (j.case_file_id is null or app.ghl_can_see(j.case_file_id))),
      'ghl_access_mismatches', (select count(*) from public.ghl_access_mismatch m where m.resolved_at is null and app.ghl_can_see(m.case_file_id)),
      'ghl_connections_failing', (select count(*) from public.ghl_connection c where c.retired_at is null and c.status in ('failing', 'degraded')
                                   and (c.case_file_id is null or app.ghl_can_see(c.case_file_id))),
      'unattributed_events', case when v_admin then (select count(*) from public.ingest_event where status = 'unattributed') end,
      'leads_waiting', (select count(*) from public.lead_routing r where r.state in ('after_hours', 'no_one_eligible', 'manual') and app.ghl_can_see(r.case_file_id))
    )
  );
end;
$$;

revoke all on function public.staff_ops_overview() from public, anon;
grant execute on function public.staff_ops_overview() to authenticated;
