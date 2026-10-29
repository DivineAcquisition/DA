/**
 * Form data to the payloads the so_* functions take. Pure, so the shapes are
 * tested without a database. The database validates again; these only shape.
 */

type Form = { get(name: string): FormDataEntryValue | null; getAll(name: string): FormDataEntryValue[] };

const text = (fd: Form, name: string) => String(fd.get(name) ?? '').trim();

/** Blank is "not set" (null). Anything else must be a non-negative number. */
export function optionalNumber(value: string): number | null | 'invalid' {
  const v = value.trim();
  if (v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 'invalid';
}

export function placementPayload(fd: Form) {
  return {
    id: text(fd, 'id') || null,
    operator_id: text(fd, 'operator_id'),
    case_file_id: text(fd, 'case_file_id'),
    placement_type: text(fd, 'placement_type'),
    manager_profile_id: text(fd, 'manager_profile_id') || null,
    start_date: text(fd, 'start_date'),
    end_date: text(fd, 'end_date') || null,
    time_zone: text(fd, 'time_zone'),
    working_days: fd.getAll('working_days').map((d) => Number(d)).filter((d) => d >= 1 && d <= 7),
    shift_start: text(fd, 'shift_start'),
    shift_end: text(fd, 'shift_end'),
    eod_deadline: text(fd, 'eod_deadline') || null,
    campaign_summary: text(fd, 'campaign_summary'),
    activity_categories: fd.getAll('activity_categories').map(String),
    tracks_results: fd.get('tracks_results') === 'on',
  };
}

export function metricPayload(fd: Form) {
  const sort = Number(text(fd, 'sort_order'));
  return {
    key: text(fd, 'key'),
    label: text(fd, 'label'),
    description: text(fd, 'description'),
    category: text(fd, 'category'),
    source: text(fd, 'source'),
    unit: text(fd, 'unit'),
    // GHL-only metrics are never operator-editable; the database refuses it too.
    operator_editable: text(fd, 'source') !== 'ghl' && fd.get('operator_editable') === 'on',
    by_outcome: fd.get('by_outcome') === 'on',
    active: fd.get('active') === 'on',
    sort_order: Number.isFinite(sort) ? sort : 1000,
  };
}

const INTEGER_SETTINGS = [
  'mismatch_small_count_under',
  'eod_reminder_minutes_before',
  'eod_late_minutes_after',
  'eod_manager_alert_minutes_after',
  'client_feedback_token_days',
  'cert_warning_days',
  'cert_grace_days',
  'view_as_idle_minutes',
  'placement_review_months',
  'eod_min_text_chars',
  'ghl_sync_interval_minutes',
  'ghl_connect_seconds',
  'ghl_conversation_seconds',
  'ghl_reply_window_days',
  'ghl_noshow_window_days',
  'ghl_stl_notouch_hours',
  'ghl_backfill_days',
  'ghl_sync_fail_after',
] as const;

const NULLABLE_INTEGER_SETTINGS = [
  'eod_missed_hours_after',
  'eod_edit_hours_after',
  'speed_to_lead_target_seconds',
  'target_override_min_pct',
  'target_override_max_pct',
] as const;

export function settingsPayload(fd: Form): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  const value: Record<string, unknown> = {
    eod_missed_rule: text(fd, 'eod_missed_rule'),
    eod_edit_rule: text(fd, 'eod_edit_rule'),
    eod_hours_worked_enabled: fd.get('eod_hours_worked_enabled') === 'on',
    eod_note_to_manager_enabled: fd.get('eod_note_to_manager_enabled') === 'on',
    ghl_stl_pause_outside_shift: fd.get('ghl_stl_pause_outside_shift') === 'on',
  };
  for (const key of ['mismatch_tolerance_pct', 'mismatch_small_count_gap', ...INTEGER_SETTINGS] as const) {
    const n = optionalNumber(text(fd, key));
    if (n === 'invalid' || n === null) return { ok: false, error: `${key.replace(/_/g, ' ')} needs a number.` };
    value[key] = INTEGER_SETTINGS.includes(key as (typeof INTEGER_SETTINGS)[number]) ? Math.round(n) : n;
  }
  for (const key of NULLABLE_INTEGER_SETTINGS) {
    const n = optionalNumber(text(fd, key));
    if (n === 'invalid') return { ok: false, error: `${key.replace(/_/g, ' ')} must be blank or a number.` };
    value[key] = n === null ? null : Math.round(n);
  }
  return { ok: true, value };
}
