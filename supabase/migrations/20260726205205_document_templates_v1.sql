-- Voice rules for every template below: direct and plain, outcome first and
-- mechanism second, no hype, numbers stated with their period and their source,
-- and no em dashes. The last one is enforced by app.reject_em_dash().

do $$
declare
  t uuid;
begin

  -- ---------------------------------------------------------------------------
  -- Audit Findings Report. Pre-sale, and the most important document here: it is
  -- both the deliverable a prospect keeps and the thing that closes the
  -- engagement.
  -- ---------------------------------------------------------------------------
  insert into public.document_template (type, version, name, producer_line)
  values ('audit_findings', 1, 'Audit Findings Report', 'Prepared by Divine Acquisition')
  returning id into t;

  insert into public.document_template_section (template_id, key, title, kind, sort_order, body, bound_source, required) values
    (t, 'summary', 'What we found', 'narrative', 10,
     'Two or three sentences. Lead with the single largest leak and what it costs per month. Mechanism second.', null, true),
    (t, 'starting_position', 'Where the operation stands today', 'bound_metrics', 20,
     null, 'baseline_metrics', true),
    (t, 'cost_of_leak', 'What the gap is costing', 'bound_table', 30,
     null, 'leak_analysis', true),
    (t, 'lead_sources', 'Where the leads come from', 'bound_table', 40,
     null, 'baseline_metrics.lead_sources', false),
    (t, 'current_stack', 'What is running now', 'bound_table', 50,
     null, 'baseline_metrics.tooling', false),
    (t, 'findings', 'Why it is happening', 'narrative', 60,
     'The causes behind the numbers above. Name the specific break, not a category. Do not prescribe the fix here.', null, true),
    (t, 'roadmap', 'What we would install', 'narrative', 70,
     'The fix, in the order it would be built, with the metric each phase moves.', null, true),
    (t, 'next_step', 'Next step', 'fixed', 80,
     'This report is yours to keep, whether or not we work together. If you want the roadmap installed, the next step is a scoping call to agree the sequence and the terms.', null, true);

  -- ---------------------------------------------------------------------------
  -- Install Completion Report. Delivered at handover, doubles as the client''s
  -- reference document.
  -- ---------------------------------------------------------------------------
  insert into public.document_template (type, version, name, producer_line)
  values ('install_completion', 1, 'Install Completion Report', 'Prepared by Divine Acquisition · Powered by Vistrial')
  returning id into t;

  insert into public.document_template_section (template_id, key, title, kind, sort_order, body, bound_source, required) values
    (t, 'summary', 'Handover summary', 'narrative', 10,
     'What is now live, in one paragraph. State the date the install completed.', null, true),
    (t, 'timeline', 'Install record', 'bound_table', 20, null, 'install_summary', true),
    (t, 'what_was_built', 'What was built', 'bound_table', 30, null, 'install_summary.components', true),
    (t, 'how_it_works', 'How each piece works', 'narrative', 40,
     'One short paragraph per component. Plain language: what triggers it, what it does, what the client will see.', null, true),
    (t, 'where_to_look', 'Where to see it', 'bound_table', 50, null, 'install_summary.folders', false),
    (t, 'milestones', 'Milestones to date', 'milestones', 60, null, 'milestones_all', false),
    (t, 'support', 'If something looks wrong', 'fixed', 70,
     'Report anything that looks wrong through your account at acct.vistrial.io. Messages reach the team directly and are answered inside one business day.', null, true);

  -- ---------------------------------------------------------------------------
  -- Monthly Performance Report. The recurring deliverable.
  -- ---------------------------------------------------------------------------
  insert into public.document_template (type, version, name, producer_line)
  values ('monthly_performance', 1, 'Monthly Performance Report', 'Prepared by Divine Acquisition · Powered by Vistrial')
  returning id into t;

  insert into public.document_template_section (template_id, key, title, kind, sort_order, body, bound_source, required) values
    (t, 'summary', 'The month in short', 'narrative', 10,
     'Outcome first: what moved and by how much. Then the one thing that did not.', null, true),
    (t, 'period_funnel', 'This period', 'bound_table', 20, null, 'period_funnel', true),
    (t, 'against_baseline', 'Against where we started', 'bound_metrics', 30, null, 'growth_table', true),
    (t, 'reading', 'Reading the numbers', 'narrative', 40,
     'Your interpretation. Explain any metric that went the wrong way before the client asks. Reference the period explicitly.', null, true),
    (t, 'milestones', 'What happened this period', 'milestones', 50, null, 'milestones_period', false),
    (t, 'work_delivered', 'Work delivered', 'effort', 60, null, 'effort_period', false),
    (t, 'next_period', 'Next period', 'narrative', 70,
     'The one or two things being changed next, and the metric each is aimed at.', null, true);

  -- ---------------------------------------------------------------------------
  -- Quarterly Review. Aimed at the renewal conversation.
  -- ---------------------------------------------------------------------------
  insert into public.document_template (type, version, name, producer_line)
  values ('quarterly_review', 1, 'Quarterly Review', 'Prepared by Divine Acquisition · Powered by Vistrial')
  returning id into t;

  insert into public.document_template_section (template_id, key, title, kind, sort_order, body, bound_source, required) values
    (t, 'summary', 'The quarter in short', 'narrative', 10,
     'The growth arc in three sentences. Start and end position, then the driver.', null, true),
    (t, 'growth_arc', 'Full arc from baseline', 'bound_metrics', 20, null, 'growth_table', true),
    (t, 'trajectory', 'Direction of travel', 'bound_table', 30, null, 'growth_arc', true),
    (t, 'timeline', 'Milestone timeline', 'milestones', 40, null, 'milestones_all', true),
    (t, 'evidence', 'Selected evidence', 'evidence', 50, null, 'evidence_selected', false),
    (t, 'assessment', 'Assessment', 'narrative', 60,
     'An honest read, including what has not worked. This is the section that earns the renewal.', null, true),
    (t, 'recommendations', 'Recommendations', 'narrative', 70,
     'What you would do next quarter and why, in priority order.', null, true);

  -- ---------------------------------------------------------------------------
  -- Proposal and Scope Document.
  -- ---------------------------------------------------------------------------
  insert into public.document_template (type, version, name, producer_line)
  values ('proposal_scope', 1, 'Proposal and Scope', 'Prepared by Divine Acquisition')
  returning id into t;

  insert into public.document_template_section (template_id, key, title, kind, sort_order, body, bound_source, required) values
    (t, 'context', 'What is being proposed', 'narrative', 10,
     'What was asked for and what is being offered against it. Outcome first.', null, true),
    (t, 'requests', 'Requests on record', 'scope', 20, null, 'scope_open', true),
    (t, 'proposed', 'Scope of work', 'narrative', 30,
     'What is included, stated as deliverables. Then a short list of what is explicitly not included.', null, true),
    (t, 'terms', 'Terms', 'bound_table', 40, null, 'scope_open.terms', true),
    (t, 'acceptance', 'Acceptance', 'fixed', 50,
     'Reply in writing to accept. Work begins on the first business day after acceptance. Anything outside the scope above is quoted separately before it starts.', null, true);

end $$;
