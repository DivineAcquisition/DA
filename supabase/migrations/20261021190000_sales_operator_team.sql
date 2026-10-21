-- A Sales Operator enrolled in the DA Operator Academy uses the team app:
-- training, end of day, sales logging, and a short client card. Not admin.

create or replace function public.portal_is_sales_operator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.academy_enrollment e
    join public.academy_program p on p.id = e.program_id
    where e.profile_id = (app.portal_operator()).profile_id
      and p.slug = 'da-operator-academy'
      and e.status <> 'withdrawn'
  );
$$;

comment on function public.portal_is_sales_operator() is
  'True when this person is in the DA Operator Academy. The team app then shows training, end of day, sales logging, and a short client card.';

revoke all on function public.portal_is_sales_operator() from public, anon;
grant execute on function public.portal_is_sales_operator() to authenticated;
