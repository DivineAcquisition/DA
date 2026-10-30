/**
 * The only shape a client email, PDF, or feedback page may render.
 * Anything else is refused before it can leave the app.
 */

export type ClientHeadline = {
  key: string;
  label: string;
  value: number | null;
  target: number | null;
  pace: 'met' | 'on_track' | 'behind' | null;
  reported: boolean;
};

export type ClientReport = {
  test: boolean;
  kind: 'weekly' | 'daily';
  client: string;
  operator: string;
  role: string;
  manager: string;
  period_start: string;
  period_end: string;
  headline: ClientHeadline[];
  outcomes: { name: string; value: number | null; previous: number | null; reported: boolean }[];
  activity: { category: string; label: string; value: number | null; target: number | null; reported: boolean }[];
  speed: { median: number | null; leads: number; not_touched: number; reported: boolean } | null;
  results: {
    show_rate: number | null;
    show_reported: boolean;
    closes: number | null;
    closes_reported: boolean;
    window: string;
  } | null;
  trend: { start: string; end: string; conversations: number | null; outcomes: number | null }[];
  wins: string[];
  summary: string | null;
  next_focus: string | null;
  plan: string[];
  gaps: { date: string; label: string }[];
  show_rate_note: string | null;
};

const KEYS = new Set([
  'test', 'kind', 'client', 'operator', 'role', 'manager', 'period_start', 'period_end',
  'headline', 'outcomes', 'activity', 'speed', 'results', 'trend', 'wins', 'summary',
  'next_focus', 'plan', 'gaps', 'show_rate_note',
]);

const FORBIDDEN = ['blockers', 'mismatch', 'mismatches', 'pay', 'payout', 'credential', 'credentials', 'note_to_manager', 'operator_value', 'ghl_value', 'escalation'];

export function asClientReport(value: unknown): ClientReport {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('client_payload: the report payload is missing');
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (FORBIDDEN.includes(key) || !KEYS.has(key)) {
      throw new Error(`client_payload: ${key} cannot leave the app`);
    }
  }
  return value as ClientReport;
}

export function reportedLabel(reported: boolean): string {
  return reported ? 'Operator reported' : '';
}

export function paceLabel(pace: string | null | undefined): string {
  if (pace === 'met') return 'Met';
  if (pace === 'on_track') return 'On track';
  if (pace === 'behind') return 'Behind';
  return '';
}

export function formatValue(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const n = Number(value);
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function periodLabel(report: Pick<ClientReport, 'kind' | 'period_start' | 'period_end'>): string {
  if (report.kind === 'daily' || report.period_start === report.period_end) return report.period_start;
  return `${report.period_start} to ${report.period_end}`;
}

export function reportFileName(report: Pick<ClientReport, 'kind' | 'client' | 'period_start' | 'period_end'>): string {
  const client = report.client.replace(/[\\/]/g, '-').trim() || 'Client';
  if (report.kind === 'daily') return `${client} - Daily Report - ${report.period_start}.pdf`;
  return `${client} - Weekly Report - ${report.period_start} to ${report.period_end}.pdf`;
}

export function reportSubject(report: Pick<ClientReport, 'test' | 'kind' | 'client' | 'period_start' | 'period_end'>): string {
  const range = periodLabel(report);
  const base = report.kind === 'daily'
    ? `${report.client} | Daily Report | ${report.period_start}`
    : `${report.client} | Weekly Sales Operations Report | ${range}`;
  return report.test ? `TEST | ${base}` : base;
}
