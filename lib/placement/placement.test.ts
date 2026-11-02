import { describe, expect, it } from 'vitest';
import { bestMatch, mappingFromConfirmed, mappingRows, rankNames } from './mapping';
import { offerMissing } from './offer';
import { addMinutes, addMonths, availabilityWarnings, clockInZone, parseWorkDays, parseWorkHours } from './schedule';
import { FIRST_DAY_TASKS, PLACEMENT_TEMPLATES, fillTask } from './templates';

describe('placement templates', () => {
  it('loads the four verticals and the shared first day', () => {
    expect(PLACEMENT_TEMPLATES.map((template) => template.slug)).toEqual(['cleaning', 'home_services', 'med_spa', 'coaches']);
    expect(PLACEMENT_TEMPLATES.every((template) => template.speedTracked)).toBe(true);
    expect(PLACEMENT_TEMPLATES.find((template) => template.slug === 'coaches')?.categories).not.toContain('reactivation');
    expect(PLACEMENT_TEMPLATES.find((template) => template.slug === 'coaches')?.ghl.tag).toBeNull();
    expect(PLACEMENT_TEMPLATES.find((template) => template.slug === 'cleaning')?.ghl.calendars).toEqual(['First Clean', 'Walkthrough']);
    expect(FIRST_DAY_TASKS).toHaveLength(5);
    expect(fillTask(FIRST_DAY_TASKS[0], 'Bay Area Cleaning', '17:30')).toContain('Bay Area Cleaning');
    expect(fillTask(FIRST_DAY_TASKS[4], 'Bay Area Cleaning', '17:30')).toContain('17:30');
  });
});

describe('shift clocks', () => {
  it('adds thirty minutes and rolls past midnight', () => {
    expect(addMinutes('17:00', 30)).toBe('17:30');
    expect(addMinutes('23:50', 30)).toBe('00:20');
  });

  it('sets the review three months out without overflowing the month', () => {
    expect(addMonths('2026-11-02', 3)).toBe('2027-02-02');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
  });

  it('shows the operator the same instant in their zone', () => {
    expect(clockInZone('2026-11-02', '09:00', 'America/New_York', 'America/Los_Angeles')).toBe('06:00');
  });

  it('warns when the shift leaves the hours from onboarding', () => {
    const warnings = availabilityWarnings({
      workingDays: [1, 2, 3, 4, 5],
      shiftStart: '06:00',
      shiftEnd: '14:00',
      shiftZone: 'America/New_York',
      operatorZone: 'America/Los_Angeles',
      workDays: 'Monday to Friday',
      workHours: '9:00 AM - 5:00 PM',
      onDate: '2026-11-02',
    });
    expect(parseWorkDays('Monday to Friday')).toEqual([1, 2, 3, 4, 5]);
    expect(parseWorkHours('9:00 AM - 5:00 PM')).toEqual({ start: '09:00', end: '17:00' });
    expect(warnings.some((warning) => warning.includes('outside the hours'))).toBe(true);
  });
});

describe('offer brief', () => {
  it('requires the five fields the operator must have', () => {
    expect(offerMissing({})).toEqual(['Business in one line', 'Service area', 'Ideal customer', 'Booking rules', 'What never to do or promise']);
    expect(offerMissing({ one_liner: 'Homes and offices', service_area: 'Bay Area', ideal_customer: 'Homeowners', booking_rules: 'Collect the address', never: 'Do not promise a price' })).toEqual([]);
  });
});

describe('GHL name ranking', () => {
  const calendars = [
    { id: 'cal-walk', name: 'Walkthrough' },
    { id: 'cal-clean', name: 'First Clean' },
    { id: 'cal-other', name: 'Team huddle' },
  ];

  it('ranks the template name above a partial and an unrelated calendar', () => {
    expect(rankNames('First Clean', calendars).map((row) => row.id)).toEqual(['cal-clean', 'cal-other', 'cal-walk']);
    expect(bestMatch('First Clean', calendars)?.id).toBe('cal-clean');
    expect(bestMatch('Membership', calendars)).toBeNull();
  });

  it('keeps unconfirmed rows out of the saved mapping', () => {
    const rows = mappingRows({
      outcomes: [{ name: 'Cleaning booked' }, { name: 'Walkthrough booked' }, { name: 'Recurring plan booked' }],
      calendars: ['First Clean', 'Walkthrough'],
      stage: 'Recurring Plan Booked',
      tag: 'reactivation-list',
      tracksResults: false,
      tracksSpeed: true,
      tracksReactivation: true,
    });
    expect(rows.some((row) => row.key === 'speed')).toBe(true);
    expect(rows.some((row) => row.key === 'show')).toBe(false);
    const saved = mappingFromConfirmed({
      outcomes: [{ name: 'Cleaning booked' }, { name: 'Walkthrough booked' }, { name: 'Recurring plan booked' }],
      confirmed: { outcome_calendar_0: ['cal-clean'], speed: ['tag-speed'] },
    });
    expect(saved.outcomes).toEqual([{ name: 'Cleaning booked', calendar_id: 'cal-clean' }]);
    expect(saved.speed.ids).toEqual(['tag-speed']);
    expect(saved.reactivation.ids).toEqual([]);
  });
});
