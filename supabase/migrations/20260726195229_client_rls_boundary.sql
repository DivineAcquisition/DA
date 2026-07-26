-- Rule 2: the never-see list is enforced by the query layer, not by hiding
-- interface elements. In practice that means a client gets a SELECT policy on
-- exactly the tables in A3 and no policy at all on the tables in A4, so the rows
-- are not merely hidden -- they do not come back.

-- The single case file a client account is bound to. Security definer so it can
-- read client_account without recursing through that table''s own policies.
create or replace function app.client_case_file_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select ca.case_file_id
  from public.client_account ca
  join public.profile p on p.id = ca.profile_id
  where ca.profile_id = auth.uid()
    and p.role = 'client'
    -- Rule 9: an archived account keeps reading until its window closes.
    and ca.state in ('active', 'archived')
    and (ca.access_until is null or ca.access_until >= current_date);
$$;

comment on function app.client_case_file_id() is 'Rule 1: returns one uuid or nothing. There is no shape of this function that could return a list.';

create or replace function app.is_client()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profile p where p.id = auth.uid() and p.role = 'client');
$$;

-- Rule 3: read-only except uploads and messages.
create or replace function app.client_can_read(p_case_file_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_case_file_id is not null and p_case_file_id = app.client_case_file_id();
$$;

-- ---------------------------------------------------------------------------
-- What a client may read (A3)
-- ---------------------------------------------------------------------------

create policy case_file_client_read on public.client_case_file
  for select to authenticated
  using (app.client_can_read(id));

create policy snapshot_client_read on public.snapshot
  for select to authenticated
  using (app.client_can_read(case_file_id));

create policy snapshot_metric_client_read on public.snapshot_metric
  for select to authenticated
  using (exists (select 1 from public.snapshot s where s.id = snapshot_id and app.client_can_read(s.case_file_id)));

create policy snapshot_lead_source_client_read on public.snapshot_lead_source
  for select to authenticated
  using (exists (select 1 from public.snapshot s where s.id = snapshot_id and app.client_can_read(s.case_file_id)));

-- Annotations explain an anomaly in the client''s own numbers, so they travel
-- with the snapshot rather than being withheld.
create policy snapshot_annotation_client_read on public.snapshot_annotation
  for select to authenticated
  using (exists (select 1 from public.snapshot s where s.id = snapshot_id and app.client_can_read(s.case_file_id)));

create policy tracking_client_read on public.tracking_metric_daily
  for select to authenticated
  using (app.client_can_read(case_file_id));

create policy milestone_client_read on public.milestone
  for select to authenticated
  using (app.client_can_read(case_file_id));

-- Only reports DA has explicitly published.
create policy growth_report_client_read on public.growth_report
  for select to authenticated
  using (
    app.client_can_read(case_file_id)
    and published_to_client_at is not null
    and mode = 'client_facing'
  );

-- Their own uploads, and any evidence DA filed in the client-provided folder.
create policy evidence_client_read on public.evidence_item
  for select to authenticated
  using (app.client_can_read(case_file_id) and category = 'client_provided');

create policy invoice_client_read on public.invoice
  for select to authenticated
  using (app.client_can_read(case_file_id) and status <> 'draft');

-- The line items behind a performance invoice, so the client can open the
-- breakdown and see the individual bookings they are paying for.
create policy invoice_line_client_read on public.invoice_line
  for select to authenticated
  using (exists (
    select 1 from public.invoice i
    where i.id = invoice_id and app.client_can_read(i.case_file_id) and i.status <> 'draft'
  ));

create policy credit_note_client_read on public.credit_note
  for select to authenticated
  using (exists (
    select 1 from public.invoice i where i.id = invoice_id and app.client_can_read(i.case_file_id)
  ));

create policy metric_definition_client_read on public.metric_definition
  for select to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- What a client may write (A2, A7): uploads and messages only
-- ---------------------------------------------------------------------------

create policy evidence_client_insert on public.evidence_item
  for insert to authenticated
  with check (
    app.client_can_read(case_file_id)
    and category = 'client_provided'
    and uploaded_by_client = true
  );

alter table public.client_message enable row level security;

create policy client_message_admin_all on public.client_message
  for all to authenticated
  using (app.is_admin()) with check (app.is_admin());

create policy client_message_client_read on public.client_message
  for select to authenticated
  using (app.client_can_read(case_file_id));

create policy client_message_client_insert on public.client_message
  for insert to authenticated
  with check (app.client_can_read(case_file_id) and author_profile_id = auth.uid());

-- Their own account row and preferences.
alter table public.client_account enable row level security;

create policy client_account_admin_all on public.client_account
  for all to authenticated
  using (app.is_admin()) with check (app.is_admin());

create policy client_account_self_read on public.client_account
  for select to authenticated
  using (profile_id = auth.uid());

alter table public.client_notification_pref enable row level security;

create policy client_notification_pref_admin_all on public.client_notification_pref
  for all to authenticated
  using (app.is_admin()) with check (app.is_admin());

create policy client_notification_pref_self on public.client_notification_pref
  for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Admin-only on everything new. No client policy exists on any of these, which
-- is what enforces A4.
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
  admin_only text[] := array[
    'operator', 'placement', 'booking', 'pay_period', 'pay_statement', 'pay_adjustment',
    'payout_batch', 'payout', 'payout_adjustment',
    'invoice_line', 'credit_note', 'payment_attempt', 'subscription', 'dunning_event',
    'revenue_record', 'pass_through_cost',
    'client_invite', 'client_dashboard_link', 'client_dashboard_link_view'
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

alter table public.invoice enable row level security;
create policy invoice_admin_all on public.invoice
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

-- Rule 8: an operator sees their own statements, payouts, and the bookings
-- behind their commission. Nothing about any other operator, and nothing about
-- the client relationship.
create policy pay_statement_operator_read on public.pay_statement
  for select to authenticated
  using (exists (
    select 1 from public.operator o where o.id = operator_id and o.profile_id = auth.uid()
  ));

create policy payout_operator_read on public.payout
  for select to authenticated
  using (exists (
    select 1 from public.operator o where o.id = operator_id and o.profile_id = auth.uid()
  ));

create policy booking_operator_read on public.booking
  for select to authenticated
  using (exists (
    select 1 from public.operator o where o.id = operator_id and o.profile_id = auth.uid()
  ));

create policy operator_self_read on public.operator
  for select to authenticated
  using (profile_id = auth.uid());

create policy pay_adjustment_operator_read on public.pay_adjustment
  for select to authenticated
  using (exists (
    select 1 from public.pay_statement s
    join public.operator o on o.id = s.operator_id
    where s.id = statement_id and o.profile_id = auth.uid()
  ));

revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon;
