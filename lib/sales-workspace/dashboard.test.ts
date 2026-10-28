import { describe, expect, it } from 'vitest';
import { formatMetric, formatSpan, showsTargetBar, type MetricRow } from './dashboard';

const metric = {
  today_display: 'number',
  week_display: 'number',
  target_today: 10,
  target_week: null,
} as Pick<MetricRow, 'today_display' | 'week_display' | 'target_today' | 'target_week'>;

describe('target bars', () => {
  it('hides the bar when there is no target or the number has not synced', () => {
    expect(showsTargetBar(metric, 'today')).toBe(true);
    expect(showsTargetBar(metric, 'week')).toBe(false);
    expect(showsTargetBar({ ...metric, target_today: 0 }, 'today')).toBe(false);
    expect(showsTargetBar({ ...metric, target_today: null }, 'today')).toBe(false);
    expect(showsTargetBar({ ...metric, today_display: 'pending_sync' }, 'today')).toBe(false);
  });
});

describe('formatSpan', () => {
  it('reads a remaining or late interval in hours and minutes', () => {
    expect(formatSpan(null)).toBeNull();
    expect(formatSpan(0)).toBe('0m');
    expect(formatSpan(90)).toBe('2m');
    expect(formatSpan(7200)).toBe('2h');
    expect(formatSpan(5400)).toBe('1h 30m');
  });
});

describe('formatMetric', () => {
  it('keeps units and never prints a number for a missing value', () => {
    expect(formatMetric('count', 2)).toBe('2');
    expect(formatMetric('count', 2.5)).toBe('2.5');
    expect(formatMetric('minutes', 12)).toBe('12 min');
    expect(formatMetric('percent', 40)).toBe('40%');
    expect(formatMetric('seconds', 90)).toBe('1m 30s');
    expect(formatMetric('count', null)).toBe('Pending sync');
  });
});
