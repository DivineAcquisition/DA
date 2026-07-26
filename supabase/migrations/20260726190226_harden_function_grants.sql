-- rls_auto_enable is an event-trigger function, so it can never be usefully
-- invoked over the REST API, but leaving EXECUTE granted to anon and
-- authenticated is noise on the security advisor. Take it away.
revoke all on function public.rls_auto_enable() from anon, authenticated;

-- Nothing on this surface is reachable without signing in.
revoke all on function public.capture_baseline(uuid, jsonb, jsonb, text[], text) from anon;
revoke all on function public.begin_install(uuid) from anon;
revoke all on function public.take_snapshot(uuid, date, date, jsonb, public.snapshot_trigger, text) from anon;
revoke all on function public.annotate_snapshot(uuid, text) from anon;
revoke all on function public.rollup_tracking(uuid, date, date) from anon;
revoke all on function public.growth_for_case_file(uuid) from anon;
revoke all on function public.growth_series(uuid, text) from anon;
revoke all on function public.snapshots_due() from anon;
revoke all on function public.log_effort(uuid, date, text, text, numeric) from anon;
revoke all on function public.correct_effort(uuid, date, text, text, numeric, text) from anon;
revoke all on function public.log_decision(uuid, date, text, text, text, boolean) from anon;
revoke all on function public.correct_decision(uuid, date, text, text, text, boolean, text) from anon;
revoke all on function public.log_scope_request(uuid, date, text, text, text, public.scope_verdict, text) from anon;
revoke all on function public.quote_scope_request(uuid, date, text, numeric) from anon;
revoke all on function public.decide_quote(uuid, public.quote_status, date, text) from anon;
revoke all on function public.record_evidence(uuid, public.evidence_category, text, text, text, date, text, text, bigint, text) from anon;
revoke all on function public.link_evidence(uuid, uuid, uuid, uuid) from anon;
revoke all on function public.create_share_link(uuid, integer, text) from anon;
revoke all on function public.revoke_share_link(uuid) from anon;
revoke all on function public.record_drive_sync(uuid, jsonb) from anon;
revoke all on function public.detect_milestones(uuid) from anon;
revoke all on function public.generate_growth_report(uuid, public.report_mode, date, date, uuid[]) from anon;
revoke all on function public.attach_report_to_drive(uuid, text, text) from anon;
revoke all on function public.create_case_file(text, text, text, text, date, numeric, numeric) from anon;
revoke all on function public.register_drive_folders(uuid, text, text, jsonb) from anon;
revoke all on function public.run_weekly_snapshots() from anon;
