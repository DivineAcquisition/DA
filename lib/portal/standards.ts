import type { Tone } from '@/app/vistrial/components/ui';
import type { BlockerControl, StandardStatus } from './types';

/** Plain words for statuses. Calm colours: "at risk" is a nudge, not an alarm. */
export const STATUS_LABEL: Record<StandardStatus, { label: string; tone: Tone }> = {
  on_track: { label: 'On track', tone: 'good' },
  at_risk: { label: 'At risk', tone: 'brand' },
  below: { label: 'Below', tone: 'neutral' },
  not_measured: { label: 'Not yet measured', tone: 'neutral' },
};

export const CONTROL_LABEL: Record<BlockerControl, string> = {
  mine: 'Within my control',
  client: 'Client side',
  da: 'DA side',
  outside: "Outside anyone's control",
};

export function formatStandard(value: number | null | undefined, unit: string): string {
  if (value === null || value === undefined) return '–';
  if (unit === 'percent') return `${Number(value).toFixed(Number(value) % 1 === 0 ? 0 : 1)}%`;
  return `${value} ${unit}`;
}
