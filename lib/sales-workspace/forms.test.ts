import { describe, expect, it } from 'vitest';
import { metricPayload, optionalNumber, placementPayload, settingsPayload } from './forms';

function form(entries: [string, string][]) {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  return fd;
}

describe('optionalNumber', () => {
  it('treats blank as not set and refuses negatives', () => {
    expect(optionalNumber('')).toBeNull();
    expect(optionalNumber(' 12 ')).toBe(12);
    expect(optionalNumber('-1')).toBe('invalid');
    expect(optionalNumber('ten')).toBe('invalid');
  });
});

describe('placementPayload', () => {
  it('collects days and categories, and blanks become null', () => {
    const p = placementPayload(
      form([
        ['operator_id', 'op'],
        ['case_file_id', 'cf'],
        ['placement_type', 'client_placed'],
        ['start_date', '2026-11-02'],
        ['working_days', '1'],
        ['working_days', '3'],
        ['working_days', '9'],
        ['activity_categories', 'outbound_calling'],
        ['eod_deadline', ''],
        ['tracks_results', 'on'],
      ]),
    );
    expect(p.id).toBeNull();
    expect(p.working_days).toEqual([1, 3]);
    expect(p.activity_categories).toEqual(['outbound_calling']);
    expect(p.eod_deadline).toBeNull();
    expect(p.manager_profile_id).toBeNull();
    expect(p.tracks_results).toBe(true);
  });
});

describe('metricPayload', () => {
  it('never marks a GHL-only metric editable', () => {
    const m = metricPayload(form([['key', 'dials_made'], ['source', 'ghl'], ['operator_editable', 'on'], ['active', 'on']]));
    expect(m.operator_editable).toBe(false);
    expect(m.active).toBe(true);
  });
});

describe('settingsPayload', () => {
  const base: [string, string][] = [
    ['mismatch_tolerance_pct', '10'],
    ['mismatch_small_count_under', '30'],
    ['mismatch_small_count_gap', '3'],
    ['eod_reminder_minutes_before', '60'],
    ['eod_late_minutes_after', '0'],
    ['eod_manager_alert_minutes_after', '120'],
    ['client_feedback_token_days', '14'],
    ['cert_warning_days', '14'],
    ['cert_grace_days', '7'],
    ['view_as_idle_minutes', '30'],
    ['placement_review_months', '3'],
    ['eod_min_text_chars', '20'],
    ['eod_missed_rule', 'next_shift_start'],
    ['eod_edit_rule', 'until_next_shift'],
    ['speed_to_lead_target_seconds', ''],
  ];

  it('keeps optional settings empty until set', () => {
    const r = settingsPayload(form(base));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.speed_to_lead_target_seconds).toBeNull();
      expect(r.value.eod_late_minutes_after).toBe(0);
      expect(r.value.cert_warning_days).toBe(14);
      expect(r.value.cert_grace_days).toBe(7);
      expect(r.value.eod_hours_worked_enabled).toBe(false);
    }
  });

  it('refuses a required setting left blank', () => {
    const r = settingsPayload(form(base.map(([k, v]) => [k, k === 'eod_reminder_minutes_before' ? '' : v])));
    expect(r.ok).toBe(false);
  });
});
