-- The CASE arms were untyped literals, which Postgres reads as text rather than
-- payout_batch_status.
create or replace function public.confirm_payout(
  p_payout_id uuid,
  p_sent_reference text,
  p_method public.payout_method default null,
  p_sent_at timestamptz default null
)
returns public.payout
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_payout public.payout;
  v_all_confirmed boolean;
begin
  if coalesce(nullif(trim(p_sent_reference), ''), '') = '' then
    raise exception 'reference_required: record the provider reference, which is what makes this a receipt' using errcode = '23514';
  end if;

  update public.payout
     set status = 'confirmed',
         method = coalesce(p_method, method),
         sent_reference = p_sent_reference,
         sent_at = coalesce(p_sent_at, sent_at, now()),
         confirmed_at = now()
   where id = p_payout_id
  returning * into v_payout;

  if v_payout.id is null then
    raise exception 'payout_not_found: %', p_payout_id using errcode = 'P0002';
  end if;

  select not exists (
    select 1 from public.payout p where p.batch_id = v_payout.batch_id and p.status <> 'confirmed'
  ) into v_all_confirmed;

  update public.payout_batch
     set status = case when v_all_confirmed then 'completed'::public.payout_batch_status
                       else 'executing'::public.payout_batch_status end,
         completed_at = case when v_all_confirmed then now() else null end
   where id = v_payout.batch_id;

  return v_payout;
end;
$$;
