-- "Current" means the snapshot covering the most recent period, not the one
-- most recently created. A snapshot filed late about an earlier week must not
-- displace a newer one, and several snapshots written in the same transaction
-- share a taken_at, which made the old ordering non-deterministic.

create or replace function public.growth_for_case_file(p_case_file_id uuid)
returns table (
  metric_key text,
  label text,
  unit text,
  category text,
  direction public.metric_direction,
  sort_order integer,
  baseline_value numeric,
  baseline_source public.measurement_source,
  current_value numeric,
  current_source public.measurement_source,
  absolute_change numeric,
  percent_change numeric,
  improved boolean,
  current_snapshot_at timestamptz
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with baseline as (
    select s.id from public.snapshot s
    where s.case_file_id = p_case_file_id and s.kind = 'baseline'
  ),
  latest as (
    select s.id, s.taken_at
    from public.snapshot s
    where s.case_file_id = p_case_file_id and s.kind = 'progress'
    order by coalesce(s.period_end, s.taken_at::date) desc, s.taken_at desc
    limit 1
  )
  select d.key, d.label, d.unit, d.category, d.direction, d.sort_order,
         b.value, b.source, c.value, c.source,
         case when b.value is null or c.value is null then null else round(c.value - b.value, 2) end,
         case
           when b.value is null or c.value is null then null
           when b.value = 0 then null
           else round(((c.value - b.value) / abs(b.value)) * 100, 1)
         end,
         case
           when b.value is null or c.value is null then null
           when d.direction = 'up_is_good' then c.value > b.value
           else c.value < b.value
         end,
         l.taken_at
  from public.metric_definition d
  left join baseline bs on true
  left join latest l on true
  left join public.snapshot_metric b on b.snapshot_id = bs.id and b.metric_key = d.key
  left join public.snapshot_metric c on c.snapshot_id = l.id and c.metric_key = d.key
  order by d.sort_order;
$$;

comment on function public.growth_for_case_file is 'Rule 3: returns every metric with its direction of travel, so what got worse is returned alongside what improved. Current means the most recent period measured, not the most recently written row.';

create or replace function public.growth_series(p_case_file_id uuid, p_metric_key text)
returns table (
  snapshot_id uuid,
  kind public.snapshot_kind,
  taken_at timestamptz,
  period_start date,
  period_end date,
  value numeric,
  source public.measurement_source,
  annotation_count bigint
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select s.id, s.kind, s.taken_at, s.period_start, s.period_end, m.value, m.source,
         (select count(*) from public.snapshot_annotation a where a.snapshot_id = s.id)
  from public.snapshot s
  join public.snapshot_metric m on m.snapshot_id = s.id and m.metric_key = p_metric_key
  where s.case_file_id = p_case_file_id
  order by s.kind desc, coalesce(s.period_end, s.taken_at::date), s.taken_at;
$$;

drop function if exists public.snapshots_due();
drop view if exists public.v_case_file_health;

create view public.v_case_file_health
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
       (select count(*) from public.scope_request sr where sr.case_file_id = cf.id and sr.verdict = 'out_of_scope') as out_of_scope_count
from public.client_case_file cf
left join baseline b on b.case_file_id = cf.id
left join latest l on l.case_file_id = cf.id
left join headline h on h.case_file_id = cf.id;

comment on view public.v_case_file_health is 'Cross-client roll-up: who is performing, who is flat, who is missing a baseline, and who is overdue a snapshot.';

create function public.snapshots_due()
returns table (case_file_id uuid, name text, last_period_end date, days_since integer)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select h.id, h.name, h.last_period_end, h.days_since_snapshot
  from public.v_case_file_health h
  where h.snapshot_overdue
  order by h.last_period_end nulls first;
$$;

revoke all on function public.snapshots_due() from anon;
revoke all on public.v_case_file_health from anon;
