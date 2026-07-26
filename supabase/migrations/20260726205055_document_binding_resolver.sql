-- ---------------------------------------------------------------------------
-- Bound field primitives
--
-- Rule 1: every number in a document arrives through one of these, read from the
-- tracked record. There is no code path that lets an admin type a bound number.
-- Rule 2: a null value becomes status 'gap', which the renderer prints as "not
-- captured". A missing number and a zero mean completely different things.
-- ---------------------------------------------------------------------------

create or replace function app.bind(
  p_label text,
  p_value numeric,
  p_unit text default null,
  p_source text default null,
  p_note text default null
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'label', p_label,
    'value', p_value,
    'unit', p_unit,
    'status', case when p_value is null then 'gap' else 'resolved' end,
    'source', p_source,
    'note', p_note
  );
$$;

create or replace function app.bind_text(
  p_label text,
  p_value text,
  p_source text default null
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'label', p_label,
    'text', nullif(btrim(coalesce(p_value, '')), ''),
    'status', case when nullif(btrim(coalesce(p_value, '')), '') is null then 'gap' else 'resolved' end,
    'source', p_source
  );
$$;

-- Any 'gap' anywhere in the tree marks the whole block, so the review preview can
-- tell the admin what is missing before a client sees it.
create or replace function app.has_gap(p_data jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_path_exists(p_data, '$.**.status ? (@ == "gap")'), false);
$$;

-- ---------------------------------------------------------------------------
-- Individual blocks
-- ---------------------------------------------------------------------------

-- The baseline, as captured during the audit. Carries the measured versus
-- estimated distinction, because later you need to know which numbers you can
-- defend.
create or replace function app.block_baseline(p_case_file_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with b as (
    select id, period_start, period_end, taken_at, tooling
    from public.snapshot
    where case_file_id = p_case_file_id and kind = 'baseline'
    order by taken_at
    limit 1
  )
  select case when b.id is null then jsonb_build_object('captured', false, 'rows', '[]'::jsonb)
  else jsonb_build_object(
    'captured', true,
    'period', jsonb_build_object('start', b.period_start, 'end', b.period_end),
    'taken_at', b.taken_at,
    'rows', coalesce((
      select jsonb_agg(
        app.bind(md.label, sm.value, md.unit, 'Baseline capture')
          || jsonb_build_object(
               'key', md.key,
               'category', md.category,
               'measurement', case when sm.source is null then null
                                   when sm.source = 'measured' then 'Measured'
                                   else 'Client estimate' end,
               'measurement_note', sm.measurement_note
             )
        order by md.sort_order
      )
      from public.metric_definition md
      left join public.snapshot_metric sm on sm.snapshot_id = b.id and sm.metric_key = md.key
    ), '[]'::jsonb),
    'lead_sources', coalesce((
      select jsonb_agg(
        jsonb_build_object('source', ls.source)
          || app.bind(ls.source, ls.leads_per_month, 'leads', 'Baseline capture')
        order by ls.leads_per_month desc
      )
      from public.snapshot_lead_source ls where ls.snapshot_id = b.id
    ), '[]'::jsonb),
    'tooling', coalesce(to_jsonb(b.tooling), '[]'::jsonb)
  ) end
  from b
  right join (select 1) x on true;
$$;

-- The cost of the leak, for the audit findings report. Every line is derived from
-- baseline figures, so a missing input produces a gap rather than a confident
-- wrong number.
create or replace function app.block_leak(p_case_file_id uuid)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v jsonb := '{}'::jsonb;
  v_snapshot uuid;
  v_response numeric;
  v_no_response numeric;
  v_leads numeric;
  v_booking_rate numeric;
  v_show_rate numeric;
  v_revenue numeric;
  v_dormant numeric;
  v_deal_value numeric;
  v_lost_appointments numeric;
  v_lost_revenue numeric;
  v_reactivation numeric;
begin
  select id into v_snapshot
  from public.snapshot
  where case_file_id = p_case_file_id and kind = 'baseline'
  order by taken_at limit 1;

  if v_snapshot is null then
    return jsonb_build_object('captured', false, 'rows', '[]'::jsonb);
  end if;

  select
    max(value) filter (where metric_key = 'avg_lead_response_minutes'),
    max(value) filter (where metric_key = 'leads_no_response_count'),
    max(value) filter (where metric_key = 'leads_per_month'),
    max(value) filter (where metric_key = 'booking_rate'),
    max(value) filter (where metric_key = 'show_rate'),
    max(value) filter (where metric_key = 'monthly_revenue'),
    max(value) filter (where metric_key = 'dormant_lead_count')
  into v_response, v_no_response, v_leads, v_booking_rate, v_show_rate, v_revenue, v_dormant
  from public.snapshot_metric where snapshot_id = v_snapshot;

  -- Average value of a kept appointment, worked back from revenue and the funnel.
  if v_revenue is not null and v_leads is not null and v_leads > 0
     and v_booking_rate is not null and v_booking_rate > 0
     and v_show_rate is not null and v_show_rate > 0 then
    v_deal_value := round(v_revenue / (v_leads * (v_booking_rate / 100) * (v_show_rate / 100)), 2);
  end if;

  if v_no_response is not null and v_booking_rate is not null then
    v_lost_appointments := round(v_no_response * (v_booking_rate / 100), 1);
  end if;

  if v_lost_appointments is not null and v_show_rate is not null and v_deal_value is not null then
    v_lost_revenue := round(v_lost_appointments * (v_show_rate / 100) * v_deal_value, 2);
  end if;

  if v_dormant is not null and v_booking_rate is not null and v_show_rate is not null and v_deal_value is not null then
    -- A deliberately conservative tenth of the dormant list, worked at the
    -- client's own conversion rates.
    v_reactivation := round(v_dormant * 0.1 * (v_booking_rate / 100) * (v_show_rate / 100) * v_deal_value, 2);
  end if;

  v := jsonb_build_object(
    'captured', true,
    'rows', jsonb_build_array(
      app.bind('Average time to first response', v_response, 'minutes', 'Baseline capture')
        || jsonb_build_object('note', 'The industry standard for a converted inbound lead is under five minutes.'),
      app.bind('Leads receiving no response at all, per month', v_no_response, 'leads', 'Baseline capture'),
      app.bind('Average value of a kept appointment', v_deal_value, 'currency', 'Derived from baseline revenue and funnel rates'),
      app.bind('Appointments lost to no response, per month', v_lost_appointments, 'appointments', 'Derived from unanswered leads at the current booking rate'),
      app.bind('Revenue lost to no response, per month', v_lost_revenue, 'currency', 'Derived from lost appointments at the current show rate'),
      app.bind('Dormant leads sitting unworked', v_dormant, 'leads', 'Baseline capture'),
      app.bind('Recoverable from the dormant list', v_reactivation, 'currency', 'Ten percent of the dormant list at the current conversion rates')
    )
  );

  return v;
end;
$$;

-- Baseline against current, for every metric the engagement is judged on.
-- Rule 3 of the tracking spec: metrics that got worse show alongside the ones
-- that improved. A report that only surfaces the good numbers is marketing, and
-- it fails the first time a client pushes back.
create or replace function app.block_growth(p_case_file_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'captured', exists (select 1 from public.snapshot where case_file_id = p_case_file_id and kind = 'baseline'),
    'rows', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'key', g.metric_key,
          'label', g.label,
          'unit', g.unit,
          'category', g.category,
          'direction', g.direction,
          'baseline', app.bind(g.label, g.baseline_value, g.unit, 'Baseline capture'),
          'current', app.bind(g.label, g.current_value, g.unit, 'Latest progress snapshot'),
          'absolute_change', g.absolute_change,
          'percent_change', g.percent_change,
          'improved', g.improved,
          'status', case when g.baseline_value is null or g.current_value is null then 'gap' else 'resolved' end
        )
        order by g.sort_order
      )
      from public.growth_for_case_file(p_case_file_id) g
    ), '[]'::jsonb),
    'as_at', (
      select max(coalesce(period_end, taken_at::date))
      from public.snapshot where case_file_id = p_case_file_id and kind = 'progress'
    )
  );
$$;

-- Direction of travel over the whole engagement, for the quarterly review.
create or replace function app.block_trajectory(p_case_file_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'metrics', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'key', md.key,
          'label', md.label,
          'unit', md.unit,
          'direction', md.direction,
          'points', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'kind', s.kind,
                'period_end', s.period_end,
                'value', s.value
              ) order by coalesce(s.period_end, s.taken_at::date)
            )
            from public.growth_series(p_case_file_id, md.key) s
            where s.value is not null
          ), '[]'::jsonb)
        ) order by md.sort_order
      )
      from public.metric_definition md
      where md.key in ('avg_lead_response_minutes', 'leads_per_month', 'booking_rate', 'show_rate', 'monthly_revenue')
    ), '[]'::jsonb)
  );
$$;

-- What the period actually did, as a funnel. Reads the same figures the client's
-- own dashboard reads, which is what keeps the two from disagreeing.
create or replace function app.block_funnel(p_case_file_id uuid, p_start date, p_end date)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_roll jsonb;
  v jsonb;
begin
  if p_start is null or p_end is null then
    return jsonb_build_object('rows', '[]'::jsonb);
  end if;

  v_roll := public.rollup_tracking(p_case_file_id, p_start, p_end);

  v := jsonb_build_object(
    'rows', jsonb_build_array(
      app.bind('Leads captured', (v_roll #>> '{leads_per_month,value}')::numeric, 'leads', 'Tracked activity, ' || to_char(p_start, 'FMDD Mon') || ' to ' || to_char(p_end, 'FMDD Mon YYYY')),
      app.bind('Average time to first response', (v_roll #>> '{avg_lead_response_minutes,value}')::numeric, 'minutes', 'Tracked activity'),
      app.bind('Leads with no response', (v_roll #>> '{leads_no_response_count,value}')::numeric, 'leads', 'Tracked activity'),
      app.bind('Booking rate', (v_roll #>> '{booking_rate,value}')::numeric, 'percent', 'Tracked activity'),
      app.bind('Show rate', (v_roll #>> '{show_rate,value}')::numeric, 'percent', 'Tracked activity'),
      app.bind('Revenue', (v_roll #>> '{monthly_revenue,value}')::numeric, 'currency', 'Tracked activity')
    )
  );

  return v;
end;
$$;

-- Milestones give the growth data a narrative. On the same timeline as the
-- snapshots, so it is visually obvious when a change in the numbers followed a
-- change in the system.
create or replace function app.block_milestones(p_case_file_id uuid, p_start date, p_end date)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'rows', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'occurred_on', m.occurred_on,
          'type', m.type,
          'title', m.title,
          'description', m.description,
          'automatic', m.auto_generated
        ) order by m.occurred_on
      )
      from public.milestone m
      where m.case_file_id = p_case_file_id
        and (p_start is null or m.occurred_on >= p_start)
        and (p_end is null or m.occurred_on <= p_end)
    ), '[]'::jsonb)
  );
$$;

-- What was built and where the client can see it. Doubles as their reference
-- document, so the Drive folders belong here.
create or replace function app.block_install(p_case_file_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'rows', jsonb_build_array(
      app.bind_text('Engagement started', to_char(cf.engagement_start, 'FMDDth FMMonth YYYY'), 'Case file'),
      app.bind_text('Install began', to_char(cf.install_started_at, 'FMDDth FMMonth YYYY'), 'Case file'),
      app.bind_text('Install completed', (
        select to_char(m.occurred_on, 'FMDDth FMMonth YYYY')
        from public.milestone m
        where m.case_file_id = cf.id and m.type = 'install_complete'
        order by m.occurred_on limit 1
      ), 'Milestone log'),
      app.bind('Monthly revenue goal', cf.revenue_goal_monthly, 'currency', 'Engagement terms')
    ),
    'folders', coalesce((
      select jsonb_agg(jsonb_build_object('category', f.category, 'url', f.folder_url) order by f.category)
      from public.case_file_drive_folder f where f.case_file_id = cf.id
    ), '[]'::jsonb),
    'components', coalesce((
      select jsonb_agg(
        jsonb_build_object('title', m.title, 'description', m.description, 'occurred_on', m.occurred_on)
        order by m.occurred_on
      )
      from public.milestone m
      where m.case_file_id = cf.id
        and m.type in ('install_complete', 'operator_placed', 'campaign_launched', 'first_lead', 'first_booking')
    ), '[]'::jsonb)
  )
  from public.client_case_file cf where cf.id = p_case_file_id;
$$;

-- The work behind the numbers, included only when DA chooses to disclose it.
-- Hours are DA's internal cost basis and never cross into a client document.
create or replace function app.block_effort(p_case_file_id uuid, p_start date, p_end date)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'rows', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'performed_on', e.performed_on,
          'phase', e.phase,
          'description', e.description
        ) order by e.performed_on
      )
      from public.effort_entry e
      where e.case_file_id = p_case_file_id
        and e.superseded_by_id is null
        and (p_start is null or e.performed_on >= p_start)
        and (p_end is null or e.performed_on <= p_end)
    ), '[]'::jsonb)
  );
$$;

-- The client's own requests and what was quoted against them. Their figures, so
-- they may see them. DA's internal reason for an out of scope verdict may not
-- cross over, and neither may the dispute record.
create or replace function app.block_scope(p_case_file_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'rows', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'requested_on', r.requested_on,
          'summary', r.summary,
          'verdict', r.verdict,
          'quotes', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'proposed_on', q.proposed_on,
                'summary', q.summary,
                'amount', q.amount,
                'status', q.status
              ) order by q.proposed_on
            )
            from public.scope_quote q where q.scope_request_id = r.id
          ), '[]'::jsonb)
        ) order by r.requested_on desc
      )
      from public.scope_request r where r.case_file_id = p_case_file_id
    ), '[]'::jsonb),
    'terms', (
      select jsonb_build_array(
        app.bind('Monthly retainer', cf.retainer_amount, 'currency', 'Engagement terms'),
        app.bind_text('Engagement status', cf.status::text, 'Case file')
      )
      from public.client_case_file cf where cf.id = p_case_file_id
    )
  );
$$;

create or replace function app.block_evidence(p_case_file_id uuid, p_start date, p_end date)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'rows', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', e.id,
          'filename', e.filename,
          'what_it_proves', e.what_it_proves,
          'happened_on', e.happened_on,
          'thumbnail_url', e.thumbnail_url
        ) order by e.happened_on desc
      )
      from public.evidence_item e
      where e.case_file_id = p_case_file_id
        and e.needs_metadata = false
        and e.category in ('evidence', 'deliverables')
        and (p_start is null or e.happened_on >= p_start)
        and (p_end is null or e.happened_on <= p_end)
    ), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------------
-- The resolver
-- ---------------------------------------------------------------------------

-- Rule 7: this is the only place a document acquires data, and it reads nothing
-- from the never-see list. No operator names or performance, no internal notes,
-- no decision log, no other client, and no DA figure beyond this client's own.
create or replace function app.resolve_bindings(
  p_case_file_id uuid,
  p_type public.document_type,
  p_start date,
  p_end date,
  p_include_effort boolean default false
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_blocks jsonb := '{}'::jsonb;
begin
  if p_type = 'audit_findings' then
    v_blocks := jsonb_build_object(
      'baseline_metrics', app.block_baseline(p_case_file_id),
      'leak_analysis', app.block_leak(p_case_file_id)
    );
  elsif p_type = 'install_completion' then
    v_blocks := jsonb_build_object(
      'install_summary', app.block_install(p_case_file_id),
      'milestones_all', app.block_milestones(p_case_file_id, null, null)
    );
  elsif p_type = 'monthly_performance' then
    v_blocks := jsonb_build_object(
      'growth_table', app.block_growth(p_case_file_id),
      'period_funnel', app.block_funnel(p_case_file_id, p_start, p_end),
      'milestones_period', app.block_milestones(p_case_file_id, p_start, p_end),
      'effort_period', case when p_include_effort
        then app.block_effort(p_case_file_id, p_start, p_end)
        else jsonb_build_object('rows', '[]'::jsonb, 'withheld', true) end
    );
  elsif p_type = 'quarterly_review' then
    v_blocks := jsonb_build_object(
      'growth_table', app.block_growth(p_case_file_id),
      'growth_arc', app.block_trajectory(p_case_file_id),
      'milestones_all', app.block_milestones(p_case_file_id, null, null),
      'evidence_selected', app.block_evidence(p_case_file_id, p_start, p_end),
      'effort_period', case when p_include_effort
        then app.block_effort(p_case_file_id, p_start, p_end)
        else jsonb_build_object('rows', '[]'::jsonb, 'withheld', true) end
    );
  elsif p_type = 'proposal_scope' then
    v_blocks := jsonb_build_object(
      'scope_open', app.block_scope(p_case_file_id)
    );
  else
    v_blocks := jsonb_build_object(
      'growth_table', app.block_growth(p_case_file_id),
      'milestones_all', app.block_milestones(p_case_file_id, null, null),
      'evidence_selected', app.block_evidence(p_case_file_id, p_start, p_end)
    );
  end if;

  return v_blocks;
end;
$$;
