-- Rule 8: this surface is admin-only. No client or operator account may reach
-- it, and that is enforced here rather than by hiding routes in the UI.
--
-- metric_definition is readable by any signed-in user because it is a
-- dictionary, not client data. Everything else requires admin.

do $$
declare
  t text;
  admin_only text[] := array[
    'client_case_file', 'case_file_drive_folder', 'snapshot', 'snapshot_metric',
    'snapshot_lead_source', 'snapshot_annotation', 'tracking_metric_daily',
    'milestone', 'effort_entry', 'scope_request', 'scope_quote', 'decision',
    'evidence_item', 'evidence_link', 'evidence_share_link', 'growth_report',
    'drive_sync_run'
  ];
begin
  foreach t in array admin_only loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (app.is_admin()) with check (app.is_admin())',
      t || '_admin_only', t
    );
  end loop;
end $$;

alter table public.metric_definition enable row level security;

create policy metric_definition_read on public.metric_definition
  for select to authenticated
  using (true);

create policy metric_definition_admin_write on public.metric_definition
  for all to authenticated
  using (app.is_admin())
  with check (app.is_admin());

-- The anon role gets nothing at all on this surface.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;

alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on functions from anon;
