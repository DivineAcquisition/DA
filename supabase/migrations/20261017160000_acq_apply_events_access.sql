-- Admins can read coaches application events. The service role writes them.
-- Event names match lib/acq/application-events.ts.

alter table public.acq_apply_events
  drop constraint if exists acq_apply_events_name_chk;

alter table public.acq_apply_events
  add constraint acq_apply_events_name_chk
  check (event_name in (
    'popup_opened',
    'step1_submitted',
    'question_answered',
    'step2_completed',
    'route_shown',
    'calendar_booked',
    'sync_failed'
  ));

revoke all on table public.acq_apply_events from public, anon, authenticated;
grant select on table public.acq_apply_events to authenticated;
grant all on table public.acq_apply_events to service_role;

drop policy if exists acq_apply_events_admin on public.acq_apply_events;
create policy acq_apply_events_admin on public.acq_apply_events
  for select to authenticated
  using (app.is_admin());

comment on table public.acq_apply_events is
  'Coaches application funnel events. Service role inserts. Admins can read. Test rows stay in the table and are filtered out of the workspace count.';
