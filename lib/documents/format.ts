import type { BoundField } from './payload';

/**
 * Value formatting for generated documents. Kept apart from the hub's formatters
 * because a document is read on paper: no abbreviations, currency in full, and a
 * missing figure spelled out rather than dashed.
 */

export const DOCUMENT_TYPE_LABEL: Record<string, string> = {
  audit_findings: 'Audit findings',
  install_completion: 'Install completion',
  monthly_performance: 'Monthly performance',
  quarterly_review: 'Quarterly review',
  proposal_scope: 'Proposal and scope',
  case_study: 'Case study',
};

export const DOCUMENT_STATE_LABEL: Record<string, string> = {
  draft: 'Draft',
  in_review: 'In review',
  published: 'Published',
  archived: 'Archived',
};

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const decimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

/** The one string a reader should see where the tracked record had nothing. */
export const GAP_TEXT = 'Not captured';

export function formatValue(value: number | null | undefined, unit: string | null | undefined): string {
  if (value === null || value === undefined) return GAP_TEXT;

  switch (unit) {
    case 'currency':
      return currency.format(value);
    case 'percent':
      return `${decimal.format(value)}%`;
    case 'minutes':
      return formatMinutes(value);
    default:
      return unit ? `${decimal.format(value)} ${unit}` : decimal.format(value);
  }
}

/** A response time of 412 minutes reads as 6 hours 52 minutes, which lands harder. */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${decimal.format(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  if (hours < 24) return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours === 0 ? `${days} days` : `${days} days ${restHours} hr`;
}

export function isGap(field: BoundField | null | undefined): boolean {
  return !field || field.status === 'gap';
}

export function fieldText(field: BoundField): string {
  if (field.status === 'gap') return GAP_TEXT;
  if (field.text !== undefined && field.text !== null) return field.text;
  return formatValue(field.value ?? null, field.unit);
}

export function formatChange(
  absolute: number | null,
  percent: number | null,
  unit: string | null,
): string {
  if (absolute === null) return GAP_TEXT;
  const sign = absolute > 0 ? '+' : '';
  const abs = unit === 'currency' ? currency.format(absolute) : `${sign}${decimal.format(absolute)}`;
  const signed = unit === 'currency' && absolute > 0 ? `+${abs}` : abs;
  if (percent === null) return signed;
  return `${signed} (${percent > 0 ? '+' : ''}${decimal.format(percent)}%)`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return GAP_TEXT;
  const date = new Date(value.length <= 10 ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatShortDate(value: string | null | undefined): string {
  if (!value) return GAP_TEXT;
  const date = new Date(value.length <= 10 ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** Every number is stated with its period, so "the period covered" is never implied. */
export function formatPeriod(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  if (start && end) return `${formatDate(start)} to ${formatDate(end)}`;
  return formatDate(start ?? end);
}

export function milestoneLabel(type: string): string {
  return (
    {
      install_complete: 'Install complete',
      operator_placed: 'Operator placed',
      campaign_launched: 'Campaign launched',
      first_lead: 'First lead',
      first_booking: 'First booking',
      first_reactivation_revenue: 'First reactivation revenue',
      first_month_over_goal: 'First month over goal',
      custom: 'Milestone',
    }[type] ?? 'Milestone'
  );
}
