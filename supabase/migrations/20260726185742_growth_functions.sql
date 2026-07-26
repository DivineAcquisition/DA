-- Rolls the ingested daily tracking values up into one figure per metric for a
-- period. Rates and durations average; counts and money sum. This is what lets
-- the weekly snapshot run without a human present.
create or replace function public.rollup_tracking(
  p_case_file_id uuid,
  p_period_start date,
  p_period_end date
)
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_object_agg(t.metric_key, t.value), '{}'::jsonb)
  from (
    select d.metric_key,
           round(
             case when md.unit in ('percent', 'minutes') then avg(d.value) else sum(d.value) end,
             2
           ) as value
    from public.tracking_metric_daily d
    join public.metric_definition md on md.key = d.metric_key
    where d.case_file_id = p_case_file_id
      and d.day between p_period_start and p_period_end
    group by d.metric_key, md.unit
  ) t;
$$;

comment on function public.rollup_tracking is 'Aggregates ingested GoHighLevel tracking into one value per metric for a period. Rates and durations average, counts and money sum.';

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
    select s.id
    from public.snapshot s
    where s.case_file_id = p_case_file_id and s.kind = 'baseline'
  ),
  latest as (
    select s.id, s.taken_at
    from public.snapshot s
    where s.case_file_id = p_case_file_id and s.kind = 'progress'
    order by s.taken_at desc
    limit 1
  )
  select d.key,
         d.label,
         d.unit,
         d.category,
         d.direction,
         d.sort_order,
         b.value,
         b.source,
         c.value,
         c.source,
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

comment on function public.growth_for_case_file is 'Rule 3: returns every metric with its direction of travel, so what got worse is returned alongside what improved. Callers do not get to filter it server-side.';

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
  select s.id,
         s.kind,
         s.taken_at,
         s.period_start,
         s.period_end,
         m.value,
         m.source,
         (select count(*) from public.snapshot_annotation a where a.snapshot_id = s.id)
  from public.snapshot s
  join public.snapshot_metric m on m.snapshot_id = s.id and m.metric_key = p_metric_key
  where s.case_file_id = p_case_file_id
  order by s.taken_at;
$$;

create or replace view public.v_case_file_health
with (security_invoker = true)
as
with baseline as (
  select case_file_id, id, locked_at from public.snapshot where kind = 'baseline'
),
latest as (
  select distinct on (case_file_id) case_file_id, id, taken_at
  from public.snapshot where kind = 'progress'
  order by case_file_id, taken_at desc
),
headline as (
  select b.case_file_id,
         bm.value as baseline_revenue,
         lm.value as current_revenue
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
       case when l.taken_at is null then null else extract(day from now() - l.taken_at)::int end as days_since_snapshot,
       (b.locked_at is not null and (l.taken_at is null or l.taken_at < now() - interval '8 days')) as snapshot_overdue,
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

create or replace function public.snapshots_due()
returns table (case_file_id uuid, name text, last_snapshot_at timestamptz, days_since integer)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select h.id, h.name, h.last_snapshot_at, h.days_since_snapshot
  from public.v_case_file_health h
  where h.snapshot_overdue
  order by h.last_snapshot_at nulls first;
$$;
