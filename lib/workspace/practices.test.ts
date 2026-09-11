import { describe, expect, it } from 'vitest';

import {
  blankToNull,
  currencyDisplay,
  dormantRevenue,
  formatDormantRevenue,
  formatNumberInput,
  isRequirementComplete,
  matchesPracticeSearch,
  parseNumberInput,
  parsePercentInput,
  percentDisplay,
  practiceStageColor,
  remainingLabel,
  REQUIREMENT_ITEMS,
  tabDot,
} from './practices';

describe('dormantRevenue', () => {
  it('treats null inputs as zero', () => {
    expect(
      dormantRevenue({
        recall_list_size: 10,
        avg_hygiene_value: 200,
        unscheduled_treatment_value: null,
      }),
    ).toBe(2000);
  });

  it('adds unscheduled treatment to recall × visit value', () => {
    expect(
      dormantRevenue({
        recall_list_size: 40,
        avg_hygiene_value: 185,
        unscheduled_treatment_value: 12_000,
      }),
    ).toBe(19_400);
  });
});

describe('formatDormantRevenue', () => {
  it('shows a dash until at least one input is present', () => {
    expect(
      formatDormantRevenue({
        recall_list_size: null,
        avg_hygiene_value: null,
        unscheduled_treatment_value: null,
      }),
    ).toBe('—');
  });

  it('shows a figure when one input is non-null even if the product is zero', () => {
    expect(
      formatDormantRevenue({
        recall_list_size: 0,
        avg_hygiene_value: null,
        unscheduled_treatment_value: null,
      }),
    ).toBe('$0');
  });
});

describe('currency and percent display', () => {
  it('formats currency with a dollar prefix and separators', () => {
    expect(currencyDisplay(1234.5)).toBe('$1,234.50');
    expect(currencyDisplay(null)).toBe('');
  });

  it('round-trips number input', () => {
    expect(parseNumberInput('$1,234.50')).toBe(1234.5);
    expect(formatNumberInput(1234.5)).toBe('1,234.5');
    expect(parseNumberInput('')).toBeNull();
  });

  it('stores percent as 0–100', () => {
    expect(percentDisplay(12.5)).toBe('12.5%');
    expect(parsePercentInput('12.5%')).toBe(12.5);
    expect(parsePercentInput('150')).toBe(100);
    expect(parsePercentInput('-4')).toBe(0);
  });
});

describe('requirement items', () => {
  it('seeds fourteen hardcoded checklist items', () => {
    expect(REQUIREMENT_ITEMS).toHaveLength(14);
    expect(REQUIREMENT_ITEMS.every((item) => item.checked === false)).toBe(true);
    expect(new Set(REQUIREMENT_ITEMS.map((item) => item.group))).toEqual(
      new Set(['Access', 'People', 'Assets']),
    );
  });

  it('is complete only when every item is checked', () => {
    expect(isRequirementComplete(REQUIREMENT_ITEMS)).toBe(false);
    expect(
      isRequirementComplete(REQUIREMENT_ITEMS.map((item) => ({ ...item, checked: true }))),
    ).toBe(true);
  });
});

describe('tabDot', () => {
  it('is empty until a row exists', () => {
    expect(tabDot({ exists: false, complete: false })).toBe('empty');
    expect(tabDot({ exists: true, complete: false })).toBe('started');
    expect(tabDot({ exists: true, complete: true })).toBe('complete');
  });
});

describe('remainingLabel', () => {
  it('shows overdue after due_at', () => {
    expect(remainingLabel('2020-01-01T00:00:00.000Z', Date.parse('2020-01-02T00:00:00.000Z'))).toEqual({
      text: 'Overdue',
      overdue: true,
    });
  });

  it('shows remaining hours and minutes', () => {
    expect(remainingLabel('2020-01-01T12:00:00.000Z', Date.parse('2020-01-01T10:30:00.000Z'))).toEqual({
      text: '1h 30m remaining',
      overdue: false,
    });
  });
});

describe('matchesPracticeSearch', () => {
  it('matches practice or contact name', () => {
    const row = { practice_name: 'Summit Dental', contact_name: 'Dr. Lee' };
    expect(matchesPracticeSearch(row, 'summit')).toBe(true);
    expect(matchesPracticeSearch(row, 'lee')).toBe(true);
    expect(matchesPracticeSearch(row, 'spa')).toBe(false);
    expect(matchesPracticeSearch(row, '')).toBe(true);
  });
});

describe('practiceStageColor', () => {
  it('uses the brief colours for each stage', () => {
    expect(practiceStageColor('audit_scheduled')).toBe('#6E6C80');
    expect(practiceStageColor('audited')).toBe('#FFD06A');
    expect(practiceStageColor('proposal_sent')).toBe('#937DFF');
    expect(practiceStageColor('won')).toBe('#7AFF8A');
    expect(practiceStageColor('lost')).toBe('#FF6A6A');
  });
});

describe('blankToNull', () => {
  it('trims empty strings to null', () => {
    expect(blankToNull('  ')).toBeNull();
    expect(blankToNull('ok')).toBe('ok');
  });
});
