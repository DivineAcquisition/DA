create or replace function public.acknowledge_owner_alert(p_alert_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not app.is_admin() then
    raise exception 'admin_required: only an admin can acknowledge owner alerts' using errcode = '42501';
  end if;
  update public.owner_alert
     set acknowledged_at = coalesce(acknowledged_at, now()),
         acknowledged_by = coalesce(acknowledged_by, auth.uid())
   where id = p_alert_id;
  if not found then
    raise exception 'not_found: owner alert does not exist' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.acknowledge_owner_alert(uuid) from public;
grant execute on function public.acknowledge_owner_alert(uuid) to authenticated;

create or replace function public.dismiss_owner_alert(p_alert_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform public.acknowledge_owner_alert(p_alert_id);
end;
$$;

revoke all on function public.dismiss_owner_alert(uuid) from public;
grant execute on function public.dismiss_owner_alert(uuid) to authenticated;
