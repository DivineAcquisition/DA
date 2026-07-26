-- A view is not subject to RLS itself, only to grants, so security_invoker alone
-- was not enough: a client reached v_case_file_health and v_margin_by_client and
-- got their own row back with the internal counts coalesced to zero. No amounts
-- leaked, but rule 2 says the never-see list is enforced by the query, and these
-- views are DA's operation. Gating on app.is_admin() inside the view makes them
-- return nothing for anyone else.

create or replace view public.v_case_file_health
with (security_invoker = true)
as
with baseline as (
  select case_file_id, id, locked_at from public.snapshot where kind = 'baseline'
),
latest as (
  select distinct on (case_file_id) case_file_id, id, taken_at, period_end
  from public.snapshot where kind = 'progress'
  order by case_file_id, coalesce(period_end, taken_at::date) desc, taken_at desc
),
headline as (
  select b.case_file_id, bm.value as baseline_revenue, lm.value as current_revenue
  from baseline b
  left join latest l on l.case_file_id = b.case_file_id
  left join public.snapshot_metric bm on bm.snapshot_id = b.id and bm.metric_key = 'monthly_revenue'
  left join public.snapshot_metric lm on lm.snapshot_id = l.id and lm.metric_key = 'monthly_revenue'
)
select cf.id,
       cf.name,
       cf.slug,
       cf.vertical,
       cf.status,
       cf.engagement_start,
       cf.install_started_at,
       (b.id is not null) as has_baseline,
       (b.locked_at is not null) as baseline_locked,
       l.taken_at as last_snapshot_at,
       l.period_end as last_period_end,
       case when l.period_end is null then null else (current_date - l.period_end) end as days_since_snapshot,
       (b.locked_at is not null and (l.period_end is null or l.period_end < current_date - 8)) as snapshot_overdue,
       h.baseline_revenue,
       h.current_revenue,
       case
         when h.baseline_revenue is null or h.current_revenue is null then null
         when h.baseline_revenue = 0 then null
         else round(((h.current_revenue - h.baseline_revenue) / abs(h.baseline_revenue)) * 100, 1)
       end as headline_revenue_change_pct,
       (select count(*) from public.evidence_item e where e.case_file_id = cf.id) as evidence_count,
       (select count(*) from public.evidence_item e where e.case_file_id = cf.id and e.needs_metadata) as evidence_needing_metadata,
       (select count(*) from public.effort_entry ee where ee.case_file_id = cf.id and ee.superseded_by_id is null) as effort_entry_count,
       (select count(*) from public.milestone m where m.case_file_id = cf.id) as milestone_count,
       (select count(*) from public.scope_request sr where sr.case_file_id = cf.id and sr.verdict = 'out_of_scope') as out_of_scope_count,
       (select count(*) from public.client_message cm where cm.case_file_id = cf.id and cm.status = 'open') as open_client_messages,
       (select count(*) from public.invoice i where i.case_file_id = cf.id and i.status in ('failed', 'overdue')) as failing_invoices
from public.client_case_file cf
left join baseline b on b.case_file_id = cf.id
left join latest l on l.case_file_id = cf.id
left join headline h on h.case_file_id = cf.id
where app.is_admin();

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
  from public.payout p join public.placement pl on pl.id = p.placement_id
  where p.status <> 'returned' group by pl.case_file_id
) c on c.case_file_id = cf.id
left join (
  select case_file_id, sum(amount) as pass_through
  from public.pass_through_cost group by case_file_id
) pt on pt.case_file_id = cf.id
where app.is_admin();

create or replace view public.v_margin_by_operator
with (security_invoker = true)
as
select o.id as operator_id, o.name, o.tier,
       coalesce(sum(p.amount), 0) as paid_to_date,
       count(distinct pl.case_file_id) as clients_served,
       coalesce(sum(rr.revenue_share), 0) as revenue_on_served_clients
from public.operator o
left join public.payout p on p.operator_id = o.id and p.status <> 'returned'
left join public.placement pl on pl.id = p.placement_id
left join (
  select case_file_id, sum(amount) as revenue_share from public.revenue_record group by case_file_id
) rr on rr.case_file_id = pl.case_file_id
where app.is_admin()
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
  from public.payout p join public.pay_period pp on pp.id = p.period_id
  where p.status <> 'returned' group by 1
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
where app.is_admin()
order by 1 desc;

revoke all on public.v_case_file_health from anon;
revoke all on public.v_margin_by_client from anon;
revoke all on public.v_margin_by_operator from anon;
revoke all on public.v_monthly_margin from anon;
