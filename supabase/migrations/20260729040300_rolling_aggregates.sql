-- ---------------------------------------------------------------------------
-- The third computation layer.
--
-- Live derived figures are recomputed on every read. Frozen artifacts are
-- computed once and never move. Between them sit the cross-client rollups, which
-- are too expensive to recompute per request and too coarse to freeze.
--
-- Caching them is a performance decision and must never become a correctness
-- one, so there is no way to read one of these values without also reading when
-- it was computed and whether that is still current. The read returns an
-- envelope, not a payload: a caller cannot accidentally render a stale number
-- confidently, because it never receives the number on its own.
-- ---------------------------------------------------------------------------

create table public.rollup_cache (
  key text primary key,
  payload jsonb not null,
  computed_at timestamptz not null default now(),
  -- How long this value is treated as current. Past it, every surface reading it
  -- is told so.
  fresh_for interval not null default interval '15 minutes',
  compute_ms integer,
  -- Set when the last refresh failed. The previous payload is kept and served as
  -- stale, because an old number labelled old is more use than no number.
  last_error text,
  last_error_at timestamptz
);

comment on table public.rollup_cache is
  'Cached cross-client rollups. Never read directly by a surface: rollup() returns the value together with its freshness, so a stale figure cannot be shown as a current one.';

alter table public.rollup_cache enable row level security;

create policy rollup_cache_admin_only on public.rollup_cache
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

revoke all on public.rollup_cache from anon;

-- ---------------------------------------------------------------------------
-- The read
-- ---------------------------------------------------------------------------

create or replace function public.rollup(p_key text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'key', p_key,
    'payload', c.payload,
    'computed_at', c.computed_at,
    'fresh_for_seconds', extract(epoch from c.fresh_for)::integer,
    'age_seconds', case when c.computed_at is null then null
                        else extract(epoch from (now() - c.computed_at))::integer end,
    -- Never computed counts as stale. A missing cache is not a fresh zero.
    'stale', c.computed_at is null or c.computed_at < now() - c.fresh_for,
    'never_computed', c.key is null,
    'last_error', c.last_error,
    'last_error_at', c.last_error_at
  )
  from (select p_key as k) q
  left join public.rollup_cache c on c.key = q.k;
$$;

comment on function public.rollup is
  'Returns a cached rollup inside its freshness envelope. There is deliberately no accessor that returns the payload alone.';

-- ---------------------------------------------------------------------------
-- The cross-client rollup
--
-- One row per client, over a trailing window, plus the totals the admin home
-- leads with. Every figure here is a read of the table that owns it: leads and
-- response time from `lead`, credited bookings through booking_is_creditable(),
-- collected revenue from `revenue_record`. Nothing is recorded here that is not
-- recomputable from those, which is what makes clearing this cache safe.
-- ---------------------------------------------------------------------------

create or replace function app.compute_cross_client_rollup(p_days integer default 30)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with window_bounds as (
    select (current_date - greatest(p_days, 1))::date as since
  ),
  per_client as (
    select
      cf.id,
      cf.name,
      cf.slug,
      cf.status,
      (select count(*) from public.lead l, window_bounds w
        where l.case_file_id = cf.id and l.lead_in_at >= w.since) as leads,
      (select count(*) from public.lead l, window_bounds w
        where l.case_file_id = cf.id and l.lead_in_at >= w.since
          and l.first_touch_at is not null) as leads_answered,
      (select round(avg(l.response_minutes), 2) from public.lead l, window_bounds w
        where l.case_file_id = cf.id and l.lead_in_at >= w.since
          and l.response_minutes is not null) as avg_response_minutes,
      -- Compliance counts every lead that arrived, answered or not. Excluding the
      -- ignored ones would let ignoring a lead improve the figure.
      (select count(*) filter (
          where l.response_minutes is not null
            and l.response_minutes <= coalesce(pl.response_standard_minutes, 5))
        from public.lead l
        left join public.placement pl on pl.id = l.placement_id, window_bounds w
        where l.case_file_id = cf.id and l.lead_in_at >= w.since) as within_standard,
      (select count(*) from public.booking b, window_bounds w
        where b.case_file_id = cf.id and b.scheduled_for >= w.since
          and public.booking_is_creditable(b.state, b.source, b.matched_booking_id)) as bookings_credited,
      -- Visible, and counted toward nothing.
      (select count(*) from public.booking b
        where b.case_file_id = cf.id and b.state = 'pending_review') as claims_pending,
      (select coalesce(sum(r.amount), 0) from public.revenue_record r, window_bounds w
        where r.case_file_id = cf.id and r.occurred_on >= w.since) as revenue_collected,
      (select coalesce(sum(i.total), 0) from public.invoice i
        where i.case_file_id = cf.id and i.status in ('issued', 'overdue', 'failed')) as invoiced_outstanding,
      (select max(e.received_at) from public.ingest_event e
        where e.case_file_id = cf.id) as last_ingest_at,
      (select count(*) from public.ingest_event e
        where e.case_file_id = cf.id and e.status in ('unattributed', 'unknown_type', 'failed')) as ingest_needs_attention
    from public.client_case_file cf
    where cf.status <> 'ended'
  )
  select jsonb_build_object(
    'window_days', greatest(p_days, 1),
    'clients', coalesce(jsonb_agg(
      jsonb_build_object(
        'case_file_id', p.id,
        'name', p.name,
        'slug', p.slug,
        'status', p.status,
        'leads', p.leads,
        'leads_answered', p.leads_answered,
        'avg_response_minutes', p.avg_response_minutes,
        'response_compliance', case when p.leads = 0 then null
                                    else round(p.within_standard::numeric / p.leads, 4) end,
        'bookings_credited', p.bookings_credited,
        'claims_pending', p.claims_pending,
        'revenue_collected', p.revenue_collected,
        'invoiced_outstanding', p.invoiced_outstanding,
        'last_ingest_at', p.last_ingest_at,
        'ingest_needs_attention', p.ingest_needs_attention
      )
      order by p.name
    ), '[]'::jsonb),
    'totals', jsonb_build_object(
      'clients', count(*),
      'leads', coalesce(sum(p.leads), 0),
      'bookings_credited', coalesce(sum(p.bookings_credited), 0),
      'claims_pending', coalesce(sum(p.claims_pending), 0),
      'revenue_collected', coalesce(sum(p.revenue_collected), 0),
      'invoiced_outstanding', coalesce(sum(p.invoiced_outstanding), 0),
      'ingest_needs_attention', coalesce(sum(p.ingest_needs_attention), 0),
      'response_compliance', case when coalesce(sum(p.leads), 0) = 0 then null
                                  else round(sum(p.within_standard)::numeric / sum(p.leads), 4) end
    )
  )
  from per_client p;
$$;

-- ---------------------------------------------------------------------------
-- The refresh
--
-- A failed refresh keeps the previous payload and records why. Serving an old
-- number that is labelled old beats serving nothing, and beats serving a fresh
-- looking zero.
-- ---------------------------------------------------------------------------

create or replace function app.refresh_rollup(p_key text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_started timestamptz := clock_timestamp();
  v_payload jsonb;
  v_fresh interval;
begin
  -- Resolving the key sits outside the handler below on purpose. Asking for a
  -- rollup that does not exist is a caller bug and must surface as one, not be
  -- absorbed into "the cache is stale".
  case p_key
    when 'cross_client' then v_fresh := interval '15 minutes';
    else
      raise exception 'unknown_rollup: % is not a rollup this database computes', p_key
        using errcode = '22023';
  end case;

  begin
    case p_key
      when 'cross_client' then v_payload := app.compute_cross_client_rollup(30);
    end case;

    insert into public.rollup_cache (key, payload, computed_at, fresh_for, compute_ms, last_error, last_error_at)
    values (
      p_key, v_payload, now(), v_fresh,
      (extract(epoch from (clock_timestamp() - v_started)) * 1000)::integer,
      null, null
    )
    on conflict (key) do update
      set payload = excluded.payload,
          computed_at = excluded.computed_at,
          fresh_for = excluded.fresh_for,
          compute_ms = excluded.compute_ms,
          last_error = null,
          last_error_at = null;
  exception when others then
    -- Degrade visibly. The previous payload stays, and every read of it from now
    -- on reports the failure and the age.
    update public.rollup_cache
       set last_error = left(sqlerrm, 500), last_error_at = now()
     where key = p_key;

    perform app.raise_owner_alert(
      'rollup.refresh_failed',
      format('The %s rollup could not be recomputed: %s. The interface is showing the previous value as stale.',
             p_key, left(sqlerrm, 200)),
      null, null, 'important');
  end;

  return public.rollup(p_key);
end;
$$;

create or replace function public.refresh_rollup(p_key text)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  perform app.require_admin();
  return app.refresh_rollup(p_key);
end;
$$;

revoke all on function public.refresh_rollup(text) from anon;
revoke all on function public.rollup(text) from anon;

select cron.schedule(
  'vistrial-cross-client-rollup',
  '*/10 * * * *',
  $$select app.refresh_rollup('cross_client')$$
);

-- ---------------------------------------------------------------------------
-- Ingestion health is live, not cached
--
-- The one view that must never be stale is the one that says whether ingestion
-- is working. It is small enough to recompute on every read, and a cached answer
-- to "is data still arriving" would be the wrong kind of wrong.
-- ---------------------------------------------------------------------------

create or replace view public.v_ingest_health
with (security_invoker = true)
as
select
  e.provider,
  e.endpoint_id,
  ep.label as endpoint_label,
  e.case_file_id,
  cf.name as client_name,
  count(*) as events,
  count(*) filter (where e.status = 'processed') as processed,
  count(*) filter (where e.status = 'received') as awaiting,
  count(*) filter (where e.status = 'unattributed') as unattributed,
  count(*) filter (where e.status = 'unknown_type') as unknown_type,
  count(*) filter (where e.status = 'failed') as failed,
  max(e.received_at) as last_received_at,
  max(e.processed_at) as last_processed_at
from public.ingest_event e
left join public.ingest_endpoint ep on ep.id = e.endpoint_id
left join public.client_case_file cf on cf.id = e.case_file_id
group by e.provider, e.endpoint_id, ep.label, e.case_file_id, cf.name;

comment on view public.v_ingest_health is
  'Live, deliberately not cached. A stale answer to "is data still arriving" is worse than a slow one.';

revoke all on public.v_ingest_health from anon;
