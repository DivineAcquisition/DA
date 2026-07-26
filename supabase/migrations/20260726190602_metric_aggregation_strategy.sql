-- A weekly snapshot has to be comparable with a monthly baseline, so each
-- metric needs to say how it aggregates. Without this, summing seven days of
-- revenue against a monthly baseline makes every client look like they
-- collapsed.
create type public.metric_aggregation as enum (
  'average',        -- rates and durations: mean over the period
  'monthly_rate',   -- flows: summed, then normalised to a 30-day equivalent
  'latest'          -- stocks: the most recent reading in the period
);

alter table public.metric_definition
  add column aggregation public.metric_aggregation not null default 'average';

update public.metric_definition set aggregation = 'monthly_rate'
  where key in ('leads_per_month', 'leads_no_response_count', 'monthly_revenue',
                'revenue_new_customers', 'revenue_returning_customers', 'monthly_ad_spend');

update public.metric_definition set aggregation = 'latest'
  where key in ('dormant_lead_count');

comment on column public.metric_definition.aggregation is
  'How ingested daily values roll up. monthly_rate normalises a short period to a 30-day equivalent so it is comparable with the baseline.';

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
  with days as (
    select greatest((p_period_end - p_period_start) + 1, 1) as span
  ),
  rolled as (
    select d.metric_key,
           md.aggregation,
           avg(d.value) as mean_value,
           sum(d.value) as total_value,
           (array_agg(d.value order by d.day desc))[1] as latest_value
    from public.tracking_metric_daily d
    join public.metric_definition md on md.key = d.metric_key
    where d.case_file_id = p_case_file_id
      and d.day between p_period_start and p_period_end
    group by d.metric_key, md.aggregation
  )
  select coalesce(jsonb_object_agg(r.metric_key, round(v.value, 2)), '{}'::jsonb)
  from rolled r
  cross join days
  cross join lateral (
    select case r.aggregation
             when 'average' then r.mean_value
             when 'latest' then r.latest_value
             when 'monthly_rate' then r.total_value / days.span * 30.0
           end as value
  ) v
  where v.value is not null;
$$;

comment on function public.rollup_tracking is
  'Aggregates ingested GoHighLevel tracking into one value per metric, respecting each metric aggregation strategy so a weekly snapshot stays comparable with a monthly baseline.';
