-- The client's live placements, for the routing form's single-owner choice.
create or replace function public.ghl_case_file_placements(p_case_file_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app.require('ghl.view');
  if not app.ghl_can_see(p_case_file_id) then
    raise exception 'out_of_scope: that client is not in your scope' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('placement_id', pl.id, 'operator', o.name, 'status', pl.status,
      'shift', pl.shift_start || '–' || pl.shift_end || ' ' || pl.time_zone, 'on_shift_now', app.on_shift_now(pl)) order by o.name)
    from public.placement pl join public.operator o on o.id = pl.operator_id
    where pl.case_file_id = p_case_file_id and pl.status in ('active', 'draft') and pl.end_date >= current_date), '[]'::jsonb);
end;
$$;

revoke all on function public.ghl_case_file_placements(uuid) from public, anon;
grant execute on function public.ghl_case_file_placements(uuid) to authenticated;
