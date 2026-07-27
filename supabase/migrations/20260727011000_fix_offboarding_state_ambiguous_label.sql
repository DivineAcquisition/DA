-- offboarding_state: qualify open_work_for columns, and join pay_statement to
-- pay_period on period_id (not the non-existent pay_period_id).
create or replace function public.offboarding_state(p_profile_id uuid)
returns table (
  step integer,
  key text,
  label text,
  detail text,
  done boolean,
  blocked boolean,
  blocker text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  o public.offboarding;
  v_open text;
  v_creds integer;
  v_open_period integer;
begin
  select * into o from public.offboarding where profile_id = p_profile_id;

  select string_agg(format('%s (%s)', w.label, w.count), ', ' order by w.kind)
    into v_open
  from public.open_work_for(p_profile_id) w
  where w.count > 0;

  select count(*)::integer into v_creds from public.credentials_reachable_by(p_profile_id);

  select count(*)::integer into v_open_period
  from public.pay_statement st
  join public.pay_period pp on pp.id = st.period_id
  join public.operator op on op.id = st.operator_id
  where op.profile_id = p_profile_id and pp.closed_at is null;

  return query
  select 1, 'revoke_sessions', 'Revoke sessions',
         'Ends every live session so nothing continues under this account.',
         o.sessions_revoked_at is not null, false, null::text
  union all
  select 2, 'suspend', 'Suspend the account',
         'Immediate. Every permission check reads the state, so it applies on the next query.',
         o.suspended_at is not null,
         o.sessions_revoked_at is null, 'Revoke the sessions first.'
  union all
  select 3, 'reassign_work', 'Reassign open work',
         coalesce('Still open: ' || v_open, 'Nothing is left unassigned.'),
         o.work_reassigned_at is not null and v_open is null,
         o.suspended_at is null, 'Suspend the account first.'
  union all
  select 4, 'list_credentials', 'List credentials for rotation',
         format('%s credential(s) this account could reach.', v_creds),
         o.credentials_listed_at is not null,
         v_open is not null, 'Reassign the open work first.'
  union all
  select 5, 'close_pay_period', 'Close any open pay period',
         case when v_open_period > 0
              then format('%s statement(s) sit in an open period.', v_open_period)
              else 'No open pay period for this account.' end,
         o.pay_period_closed_at is not null or v_open_period = 0,
         o.credentials_listed_at is null, 'List the credentials first.'
  union all
  select 6, 'archive', 'Archive',
         'Archive rather than delete, so the audit trail and the case file history survive.',
         o.archived_at is not null,
         o.credentials_listed_at is null or v_open is not null,
         'Finish the earlier steps first.'
  order by 1;
end;
$$;
