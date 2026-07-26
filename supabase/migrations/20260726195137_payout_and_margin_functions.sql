-- Builds the payout list for a closed period from the locked statements, plus
-- anything that failed or was returned in an earlier batch and has to roll
-- forward rather than disappear.
create or replace function public.build_payout_batch(p_period_id text)
returns public.payout_batch
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_batch public.payout_batch;
  v_statement record;
  v_rolled record;
  v_new_payout uuid;
begin
  select * into v_batch from public.payout_batch where period_id = p_period_id;

  if v_batch.id is not null then
    if v_batch.status <> 'draft' then
      raise exception 'batch_already_approved: the batch for % was approved on %', p_period_id, v_batch.approved_at::date using errcode = '23514';
    end if;
    delete from public.payout where batch_id = v_batch.id and status = 'pending' and rolled_from_payout_id is null;
  else
    insert into public.payout_batch (period_id, created_by)
    values (p_period_id, auth.uid())
    returning * into v_batch;
  end if;

  for v_statement in
    select s.*, o.payout_method, o.payout_reference
    from public.pay_statement s
    join public.operator o on o.id = s.operator_id
    where s.period_id = p_period_id
      and s.total <> 0
      and not exists (select 1 from public.payout p where p.statement_id = s.id)
  loop
    insert into public.payout (
      batch_id, operator_id, statement_id, placement_id, period_id,
      base_amount, commission_amount, bonus_amount, adjustment_total, amount,
      method, payout_reference
    )
    values (
      v_batch.id, v_statement.operator_id, v_statement.id, v_statement.placement_id, p_period_id,
      v_statement.base_amount, v_statement.commission_amount, v_statement.speed_bonus_amount,
      v_statement.adjustment_total, v_statement.total,
      v_statement.payout_method, v_statement.payout_reference
    );
  end loop;

  -- Roll forward failures and returns from previous batches.
  for v_rolled in
    select p.* from public.payout p
    where p.status in ('failed', 'returned')
      and p.rolled_into_payout_id is null
      and p.period_id <> p_period_id
  loop
    insert into public.payout (
      batch_id, operator_id, statement_id, placement_id, period_id,
      base_amount, commission_amount, bonus_amount, adjustment_total, amount,
      method, payout_reference, rolled_from_payout_id
    )
    values (
      v_batch.id, v_rolled.operator_id, null, v_rolled.placement_id, p_period_id,
      0, 0, 0, 0, v_rolled.amount,
      v_rolled.method, v_rolled.payout_reference, v_rolled.id
    )
    returning id into v_new_payout;

    update public.payout set rolled_into_payout_id = v_new_payout where id = v_rolled.id;
  end loop;

  update public.payout_batch b
     set total_amount = coalesce((select sum(amount) from public.payout p where p.batch_id = b.id), 0),
         payout_count = coalesce((select count(*) from public.payout p where p.batch_id = b.id), 0)
   where b.id = v_batch.id
  returning * into v_batch;

  return v_batch;
end;
$$;

comment on function public.build_payout_batch is 'Produces the list. Vistrial does not move money: the admin executes the transfers and records confirmation.';

create or replace function public.approve_payout_batch(p_batch_id uuid)
returns public.payout_batch
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_batch public.payout_batch;
  v_missing integer;
begin
  select * into v_batch from public.payout_batch where id = p_batch_id;

  if v_batch.id is null then
    raise exception 'batch_not_found: %', p_batch_id using errcode = 'P0002';
  end if;

  if v_batch.status <> 'draft' then
    raise exception 'batch_already_approved: this batch is %', v_batch.status using errcode = '23514';
  end if;

  if v_batch.payout_count = 0 then
    raise exception 'batch_empty: nothing to pay in this period' using errcode = '23514';
  end if;

  -- Missing contractor documentation is worth blocking on rather than
  -- discovering at tax time.
  select count(*) into v_missing
  from public.payout p
  join public.operator o on o.id = p.operator_id
  where p.batch_id = p_batch_id and o.tax_doc_status <> 'on_file';

  if v_missing > 0 then
    raise exception 'tax_documentation_missing: % operator(s) in this batch have no contractor documentation on file', v_missing using errcode = '23514';
  end if;

  update public.payout_batch
     set status = 'approved', approved_by = auth.uid(), approved_at = now()
   where id = p_batch_id
  returning * into v_batch;

  return v_batch;
end;
$$;

-- The admin records what they actually sent. Rule 7: confirming locks the record.
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

  update public.payout_batch b
     set status = case when not exists (
           select 1 from public.payout p where p.batch_id = b.id and p.status not in ('confirmed')
         ) then 'completed' else 'executing' end,
         completed_at = case when not exists (
           select 1 from public.payout p where p.batch_id = b.id and p.status not in ('confirmed')
         ) then now() else null end
   where b.id = v_payout.batch_id;

  return v_payout;
end;
$$;

create or replace function public.fail_payout(p_payout_id uuid, p_reason text, p_returned boolean default false)
returns public.payout
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_payout public.payout;
begin
  update public.payout
     set status = case when p_returned then 'returned' else 'failed' end,
         failure_reason = p_reason
   where id = p_payout_id
  returning * into v_payout;

  return v_payout;
end;
$$;

-- Rule 8. An operator can always open a statement and see the bookings behind
-- their commission, which is the single best defence against a pay dispute.
create or replace function public.commission_bookings(p_statement_id uuid)
returns table (
  booking_id uuid,
  customer_name text,
  scheduled_for timestamptz,
  state public.booking_state,
  source public.booking_source
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select b.id, b.customer_name, b.scheduled_for, b.state, b.source
  from public.pay_statement s
  cross join lateral unnest(s.commission_booking_ids) as ids(booking_id)
  join public.booking b on b.id = ids.booking_id
  where s.id = p_statement_id
  order by b.scheduled_for;
$$;

-- ---------------------------------------------------------------------------
-- B3: margin
-- ---------------------------------------------------------------------------

-- The reporting that only becomes possible once both directions exist. A client
-- can look healthy on revenue and be unprofitable once the placed operator is
-- paid for, and without this that stays invisible until cash runs short.
create or replace function public.margin_for_case_file(
  p_case_file_id uuid,
  p_period_start date,
  p_period_end date
)
returns table (
  revenue numeric,
  operator_cost numeric,
  pass_through numeric,
  margin numeric,
  margin_pct numeric
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with rev as (
    select coalesce(sum(amount), 0) as total
    from public.revenue_record
    where case_file_id = p_case_file_id
      and occurred_on between p_period_start and p_period_end
  ),
  cost as (
    -- Operator cost attributable to this client, meaning payouts against
    -- placements on it. Confirmed and in-flight both count: the money is owed.
    select coalesce(sum(p.amount), 0) as total
    from public.payout p
    join public.pay_period pp on pp.id = p.period_id
    join public.placement pl on pl.id = p.placement_id
    where pl.case_file_id = p_case_file_id
      and pp.start_date >= p_period_start
      and pp.end_date <= p_period_end
      and p.status <> 'returned'
  ),
  pass as (
    select coalesce(sum(amount), 0) as total
    from public.pass_through_cost
    where case_file_id = p_case_file_id
      and occurred_on between p_period_start and p_period_end
  )
  select rev.total,
         cost.total,
         pass.total,
         rev.total - cost.total - pass.total,
         case when rev.total = 0 then null
              else round(((rev.total - cost.total - pass.total) / rev.total) * 100, 1) end
  from rev, cost, pass;
$$;

comment on function public.margin_for_case_file is 'Revenue collected minus attributable operator cost minus pass-through, giving the true margin on an engagement.';

create or replace view public.v_margin_by_client
with (security_invoker = true)
as
select cf.id as case_file_id,
       cf.name,
       cf.slug,
       cf.status,
       coalesce(r.revenue, 0) as revenue_to_date,
       coalesce(c.operator_cost, 0) as operator_cost_to_date,
       coalesce(pt.pass_through, 0) as pass_through_to_date,
       coalesce(r.revenue, 0) - coalesce(c.operator_cost, 0) - coalesce(pt.pass_through, 0) as margin_to_date,
       case when coalesce(r.revenue, 0) = 0 then null
            else round(((coalesce(r.revenue, 0) - coalesce(c.operator_cost, 0) - coalesce(pt.pass_through, 0)) / r.revenue) * 100, 1)
       end as margin_pct,
       r.last_payment_on
from public.client_case_file cf
left join (
  select case_file_id, sum(amount) as revenue, max(occurred_on) as last_payment_on
  from public.revenue_record group by case_file_id
) r on r.case_file_id = cf.id
left join (
  select pl.case_file_id, sum(p.amount) as operator_cost
  from public.payout p
  join public.placement pl on pl.id = p.placement_id
  where p.status <> 'returned'
  group by pl.case_file_id
) c on c.case_file_id = cf.id
left join (
  select case_file_id, sum(amount) as pass_through
  from public.pass_through_cost group by case_file_id
) pt on pt.case_file_id = cf.id;

comment on view public.v_margin_by_client is 'Margin per client, ranked. Answers the question that decides whether the business model works.';

create or replace view public.v_margin_by_operator
with (security_invoker = true)
as
select o.id as operator_id,
       o.name,
       o.tier,
       coalesce(sum(p.amount), 0) as paid_to_date,
       count(distinct pl.case_file_id) as clients_served,
       coalesce(sum(rr.revenue_share), 0) as revenue_on_served_clients
from public.operator o
left join public.payout p on p.operator_id = o.id and p.status <> 'returned'
left join public.placement pl on pl.id = p.placement_id
left join (
  select case_file_id, sum(amount) as revenue_share
  from public.revenue_record group by case_file_id
) rr on rr.case_file_id = pl.case_file_id
group by o.id, o.name, o.tier;

create or replace view public.v_monthly_margin
with (security_invoker = true)
as
with months as (
  select date_trunc('month', occurred_on)::date as month, sum(amount) as revenue
  from public.revenue_record group by 1
),
costs as (
  select date_trunc('month', pp.end_date)::date as month, sum(p.amount) as operator_cost
  from public.payout p
  join public.pay_period pp on pp.id = p.period_id
  where p.status <> 'returned'
  group by 1
),
pass as (
  select date_trunc('month', occurred_on)::date as month, sum(amount) as pass_through
  from public.pass_through_cost group by 1
)
select coalesce(m.month, c.month, pa.month) as month,
       coalesce(m.revenue, 0) as revenue,
       coalesce(c.operator_cost, 0) as operator_cost,
       coalesce(pa.pass_through, 0) as pass_through,
       coalesce(m.revenue, 0) - coalesce(c.operator_cost, 0) - coalesce(pa.pass_through, 0) as margin
from months m
full outer join costs c on c.month = m.month
full outer join pass pa on pa.month = coalesce(m.month, c.month)
order by 1 desc;
