create or replace function public.fail_payout(p_payout_id uuid, p_reason text, p_returned boolean default false)
returns public.payout
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_payout public.payout;
begin
  if coalesce(nullif(trim(p_reason), ''), '') = '' then
    raise exception 'failure_reason_required: record why, so the next batch knows what to fix' using errcode = '23514';
  end if;

  update public.payout
     set status = case when p_returned then 'returned'::public.payout_status else 'failed'::public.payout_status end,
         failure_reason = p_reason
   where id = p_payout_id
  returning * into v_payout;

  if v_payout.id is null then
    raise exception 'payout_not_found: %', p_payout_id using errcode = 'P0002';
  end if;

  update public.payout_batch set status = 'executing' where id = v_payout.batch_id and status = 'approved';

  return v_payout;
end;
$$;

comment on function public.fail_payout is 'A failed or returned payout is flagged and rolls into the next batch rather than disappearing.';
