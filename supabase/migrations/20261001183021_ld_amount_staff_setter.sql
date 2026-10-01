create or replace function public.staff_set_ld_amount(p_amount numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.require('team.settings');
  if p_amount is null or p_amount < 0 then
    raise exception 'amount_invalid' using errcode = '23514';
  end if;
  update public.team_setting set abandonment_ld_amount = p_amount, updated_at = now() where id = 1;
  perform app.audit('team.ld_amount_changed', 'team_setting', '1',
    format('Set the abandonment liquidated damages amount to $%s', p_amount));
end;
$$;

revoke all on function public.staff_set_ld_amount(numeric) from public, anon;
grant execute on function public.staff_set_ld_amount(numeric) to authenticated;

