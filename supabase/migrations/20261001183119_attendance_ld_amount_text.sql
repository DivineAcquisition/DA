-- Attendance messages quote the configured amount.
CREATE OR REPLACE FUNCTION public.staff_set_attendance(p_placement_id uuid, p_shift_date date, p_status text, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_pl public.placement;
  v_op public.operator;
  v_starts timestamptz;
  v_ends timestamptz;
  v_before public.shift_attendance;
  v_row public.shift_attendance;
  v_ld public.ld_proposal;
  v_abandoned_30 integer;
  v_amount text := to_char(coalesce((select abandonment_ld_amount from public.team_setting where id = 1), 250), 'FM999G990D00');
begin
  perform app.require_own_name('attendance.manage');
  select * into v_pl from public.placement where id = p_placement_id;
  if v_pl.id is null then
    raise exception 'placement_not_found' using errcode = 'P0002';
  end if;
  perform app.require_reach_placement(v_pl.id);
  select * into v_op from public.operator where id = v_pl.operator_id;

  if coalesce(p_status, '') not in ('worked', 'excused_emergency', 'abandoned', 'notified_absence') then
    raise exception 'status_invalid: pick worked, excused, abandoned or notified absence' using errcode = '23514';
  end if;
  if length(btrim(coalesce(p_reason, ''))) not between 5 and 2000 then
    raise exception 'reason_required: every attendance decision records why' using errcode = '23514';
  end if;
  if p_shift_date is null or p_shift_date < v_pl.start_date
     or not (extract(isodow from p_shift_date)::smallint = any(v_pl.working_days)) then
    raise exception 'not_a_shift: that date is not a scheduled shift on this placement' using errcode = '23514';
  end if;

  select sb.starts_at, sb.ends_at into v_starts, v_ends from app.shift_bounds(v_pl, p_shift_date) sb;
  if p_status in ('abandoned', 'worked') and (v_ends is null or v_ends > now()) then
    raise exception 'shift_not_over: that shift has not ended yet' using errcode = '23514';
  end if;

  select * into v_before from public.shift_attendance where placement_id = v_pl.id and shift_date = p_shift_date;

  if v_before.status = 'abandoned' and p_status <> 'abandoned'
     and exists (select 1 from public.ld_proposal l where l.attendance_id = v_before.id and l.status = 'approved') then
    raise exception 'ld_applied: the liquidated damages for this abandonment are already on a pay statement. Reverse that adjustment in Payroll first.'
      using errcode = '23514';
  end if;

  insert into public.shift_attendance (placement_id, operator_id, shift_date, status, reason, decided_by, decided_at)
  values (v_pl.id, v_pl.operator_id, p_shift_date, p_status, btrim(p_reason), auth.uid(), now())
  on conflict (placement_id, shift_date) do update
    set status = excluded.status, reason = excluded.reason, decided_by = excluded.decided_by, decided_at = excluded.decided_at
  returning * into v_row;

  if p_status = 'abandoned' then
    insert into public.ld_proposal (attendance_id, operator_id, placement_id, shift_date)
    values (v_row.id, v_row.operator_id, v_row.placement_id, v_row.shift_date)
    on conflict (attendance_id) do update
      set status = 'proposed', decided_by = null, decided_at = null, decision_reason = null,
          statement_id = null, applied_amount = null
      where public.ld_proposal.status = 'dismissed'
    returning * into v_ld;

    perform app.notify_staff(app.admin_recipient_ids(), 'ld.proposed', 'important',
      format('Proposed $%s liquidated damages for %s', v_amount, v_op.name),
      format('Abandoned shift on %s (Section 6.3). Approve or dismiss it; it can only come from unearned bonus or commission.',
             to_char(p_shift_date, 'FMDy DD Mon')),
      v_op.id);

    select count(*) into v_abandoned_30 from public.shift_attendance sa
    where sa.operator_id = v_op.id and sa.status = 'abandoned'
      and sa.shift_date between p_shift_date - 29 and p_shift_date + 29;
    if v_abandoned_30 >= 2 then
      perform app.notify_staff(app.admin_recipient_ids(), 'attendance.two_abandonments', 'urgent',
        format('%s: two abandoned shifts within 30 days', v_op.name),
        'Section 6.4 applies. Review the attendance record and decide what happens next; nothing changes automatically.',
        v_op.id);
    end if;

    insert into public.operator_notification (operator_id, placement_id, severity, title, body, sent_by)
    values (v_op.id, v_pl.id, 'urgent', 'A shift was recorded as abandoned',
            format('%s: %s', to_char(p_shift_date, 'FMDy DD Mon'), btrim(p_reason)), app.profile_name(auth.uid()));
  else
    update public.ld_proposal
       set status = 'dismissed', decided_by = auth.uid(), decided_at = now(),
           decision_reason = 'Attendance corrected: ' || btrim(p_reason)
     where attendance_id = v_row.id and status = 'proposed';

    if p_status = 'excused_emergency' then
      insert into public.operator_notification (operator_id, placement_id, severity, title, body, sent_by)
      values (v_op.id, v_pl.id, 'informational', 'Shift excused',
              format('%s was excused: %s', to_char(p_shift_date, 'FMDy DD Mon'), btrim(p_reason)), app.profile_name(auth.uid()));
    end if;
  end if;

  perform app.audit('attendance.decided', 'shift_attendance', v_row.id::text,
    format('Recorded the %s shift as %s: %s', p_shift_date, replace(p_status, '_', ' '), btrim(p_reason)),
    case when v_before.id is not null then jsonb_build_object('status', v_before.status, 'reason', v_before.reason) end,
    jsonb_build_object('status', v_row.status, 'reason', v_row.reason), v_pl.case_file_id, v_op.profile_id);

  return jsonb_build_object('ok', true, 'status', v_row.status, 'ld_proposal_id', v_ld.id);
end;
$function$;
