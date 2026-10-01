create or replace function app.ld_amount_from_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.amount := coalesce((select abandonment_ld_amount from public.team_setting where id = 1), new.amount);
  return new;
end;
$$;

