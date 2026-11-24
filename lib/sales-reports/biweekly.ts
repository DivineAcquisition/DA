/**
 * Bi-weekly client report analysis. Pure: it takes the period's data (as
 * so_report_analysis_data returns it) and works out, by rule, how the period
 * went, what to improve, and what to focus on for the next 2 weeks. It also
 * cross-checks the operator's numbers against GoHighLevel for staff.
 *
 * Client-facing text only uses the numbers the client report shows (verified
 * where GoHighLevel confirms them, otherwise marked operator reported). The
 * GoHighLevel cross-check stays in `integrity`, which only staff see.
 */

export type AnalysisDay = {
  date: string;
  status: string;
  submitted: boolean;
  late: boolean;
  excused: boolean;
  hours: number | null;
  wins: string;
  blockers: string;
  plan: string;
  needs_help: boolean;
};

export type AnalysisMetric = {
  key: string;
  label: string;
  unit: string;
  source: 'operator' | 'ghl' | 'both' | string;
  sort: number;
  operator: number | null;
  ghl: number | null;
  verified: number | null;
  previous: number | null;
  target: number | null;
};

export type AnalysisMismatch = {
  date: string;
  metric: string;
  outcome: string | null;
  operator: number | null;
  ghl: number | null;
  gap: number | null;
  status: string;
  decision: string | null;
};

export type AnalysisData = {
  report: { id: string; kind: string; period_start: string; period_end: string; status: string; auto_send_at: string | null };
  client: {
    operator?: string;
    client?: string;
    outcomes?: { name: string; value: number | null; previous: number | null; reported: boolean }[];
    headline?: { label: string; value: number | null; target: number | null; pace: string | null; reported: boolean }[];
  } | null;
  placement: {
    id: string;
    operator: string | null;
    client: string | null;
    start_date: string | null;
    time_zone: string | null;
    working_days: number[];
    categories: string[];
    tracks_results: boolean;
  };
  days: AnalysisDay[];
  metrics: AnalysisMetric[];
  mismatches: AnalysisMismatch[];
  ghl: { linked: boolean; status: string | null; last_success_at: string | null; last_error: string | null; synced_days: number };
  staff_emails: string[];
};

export type MetricFinding = {
  key: string;
  label: string;
  unit: string;
  value: number | null;
  verified: boolean;
  target: number | null;
  pct: number | null;
  previous: number | null;
  change: number | null;
};

export type Findings = {
  operator: string;
  firstName: string;
  client: string;
  period: string;
  workdays: number;
  submitted: number;
  late: number;
  missed: number;
  excused: number;
  helpDays: number;
  metrics: MetricFinding[];
  behind: MetricFinding[];
  ahead: MetricFinding[];
  dropped: MetricFinding[];
  outcomes: { name: string; value: number | null; previous: number | null }[];
  blockers: string[];
};

export type Integrity = {
  state: 'verified' | 'partly_verified' | 'unverified';
  linked: boolean;
  ghlStatus: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  syncedDays: number;
  submittedDays: number;
  open: AnalysisMismatch[];
  resolved: number;
  lines: string[];
};

export type Draft = { summary: string; improvements: string[]; focus: string[]; source: 'rules' | 'ai'; model?: string };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function num(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function fmt(value: number | null | undefined, unit = 'count'): string {
  if (value == null) return '—';
  if (unit === 'percent') return `${round1(value)}%`;
  if (unit === 'minutes') return value >= 60 ? `${round1(value / 60)} hrs` : `${round1(value)} min`;
  if (unit === 'seconds') return value >= 60 ? `${round1(value / 60)} min` : `${round1(value)} sec`;
  if (unit === 'currency') return `$${round1(value)}`;
  return new Intl.NumberFormat('en-US').format(round1(value));
}

export function rangeLabel(start: string, end: string): string {
  const [ay, am, ad] = start.split('-').map(Number);
  const [by, bm, bd] = end.split('-').map(Number);
  const first = `${MONTHS[(am ?? 1) - 1]} ${ad}`;
  const last = am === bm ? `${bd}` : `${MONTHS[(bm ?? 1) - 1]} ${bd}`;
  return `${first} – ${last}, ${by ?? ay}`;
}

/** The number the client report shows: verified where GoHighLevel confirms it, else what the operator reported. */
function shownValue(metric: AnalysisMetric): { value: number | null; verified: boolean } {
  const verified = num(metric.verified);
  if (verified != null) return { value: verified, verified: true };
  if (metric.source === 'ghl') return { value: num(metric.ghl), verified: num(metric.ghl) != null };
  return { value: num(metric.operator), verified: false };
}

/** Timing metrics are better when lower; everything else is better when higher. */
function lowerIsBetter(metric: { key: string; unit: string }): boolean {
  return metric.unit === 'seconds' || metric.key.includes('speed');
}

export function findings(data: AnalysisData): Findings {
  const operator = data.placement.operator?.trim() || data.client?.operator || 'The operator';
  const firstName = operator.split(/\s+/)[0] || operator;
  const client = data.placement.client?.trim() || data.client?.client || 'the client';
  const start = data.placement.start_date;
  const days = data.days.filter((day) => !start || day.date >= start);
  const workdays = days.filter((day) => !day.excused).length;
  const submitted = days.filter((day) => day.submitted).length;
  const late = days.filter((day) => day.submitted && day.late).length;
  const excused = days.filter((day) => day.excused).length;
  const missed = days.filter((day) => !day.submitted && !day.excused).length;
  const helpDays = days.filter((day) => day.needs_help).length;

  const metrics: MetricFinding[] = data.metrics.map((metric) => {
    const shown = shownValue(metric);
    const target = num(metric.target);
    const previous = num(metric.previous);
    const pct = shown.value != null && target != null && target > 0 ? Math.round((shown.value / target) * 100) : null;
    // The previous period is the operator's own numbers, so compare like with like.
    const current = num(metric.operator) ?? shown.value;
    const change = current != null && previous != null && previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;
    return { key: metric.key, label: metric.label, unit: metric.unit, value: shown.value, verified: shown.verified, target, pct, previous, change };
  });

  const behind = metrics
    .filter((m) => m.pct != null && (lowerIsBetter(m) ? m.pct > 120 : m.pct < 80))
    .sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0));
  const ahead = metrics.filter((m) => m.pct != null && !lowerIsBetter(m) && m.pct >= 100).sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0));
  const dropped = metrics
    .filter((m) => m.change != null && (lowerIsBetter(m) ? m.change >= 25 : m.change <= -20) && !behind.includes(m))
    .sort((a, b) => (a.change ?? 0) - (b.change ?? 0));

  const outcomes = (data.client?.outcomes ?? []).map((o) => ({ name: o.name, value: num(o.value), previous: num(o.previous) }));
  const blockers = days
    .map((day) => day.blockers.trim())
    .filter((text) => text && !/^no blockers/i.test(text))
    .slice(0, 6);

  return {
    operator,
    firstName,
    client,
    period: rangeLabel(data.report.period_start, data.report.period_end),
    workdays,
    submitted,
    late,
    missed,
    excused,
    helpDays,
    metrics,
    behind,
    ahead,
    dropped,
    outcomes,
    blockers,
  };
}

/** Operator numbers vs GoHighLevel for the period. Staff only. */
export function integrity(data: AnalysisData): Integrity {
  const submittedDays = data.days.filter((day) => day.submitted).length;
  const open = data.mismatches.filter((m) => m.status === 'open');
  const resolved = data.mismatches.length - open.length;
  const linked = Boolean(data.ghl.linked);
  const syncedDays = Number(data.ghl.synced_days) || 0;
  const state: Integrity['state'] =
    linked && data.ghl.status !== 'needs_attention' && syncedDays >= submittedDays && submittedDays > 0
      ? 'verified'
      : linked && syncedDays > 0
        ? 'partly_verified'
        : 'unverified';

  const lines: string[] = [];
  if (!linked) {
    lines.push('This seat is not linked to a GoHighLevel user, so none of the numbers could be checked against GoHighLevel. The client report shows them as operator reported.');
  } else if (data.ghl.status === 'needs_attention' || syncedDays === 0) {
    lines.push(
      `GoHighLevel did not sync for this period${data.ghl.last_error ? ` (${data.ghl.last_error})` : ''}, so the numbers could not be checked. The client report shows them as operator reported.`,
    );
  } else if (syncedDays < submittedDays) {
    lines.push(`GoHighLevel synced ${syncedDays} of the ${submittedDays} reported days. The rest show as operator reported.`);
  } else {
    lines.push(`GoHighLevel synced every reported day (${syncedDays}).`);
  }
  if (open.length) {
    lines.push(`${open.length} number${open.length === 1 ? '' : 's'} the operator entered did not match GoHighLevel:`);
    for (const m of open.slice(0, 12)) {
      lines.push(
        `${m.date} · ${m.metric}${m.outcome ? ` (${m.outcome})` : ''}: operator ${fmt(num(m.operator))}, GoHighLevel ${fmt(num(m.ghl))}`,
      );
    }
    if (open.length > 12) lines.push(`…and ${open.length - 12} more on the seat's Mismatches list.`);
  } else if (linked && syncedDays > 0) {
    lines.push('No mismatches: every checked number the operator entered matched GoHighLevel.');
  }
  if (resolved) lines.push(`${resolved} earlier mismatch${resolved === 1 ? ' was' : 'es were'} already reviewed.`);

  return {
    state,
    linked,
    ghlStatus: data.ghl.status,
    lastSuccessAt: data.ghl.last_success_at,
    lastError: data.ghl.last_error,
    syncedDays,
    submittedDays,
    open,
    resolved,
    lines,
  };
}

/** A draft written by rule from the findings. Used as is when the AI writer is off or fails, and given to it as the basis. */
export function ruleDraft(f: Findings): Draft {
  const parts: string[] = [];
  parts.push(
    `${f.firstName} submitted ${f.submitted} of ${f.workdays} end-of-day report${f.workdays === 1 ? '' : 's'} for ${f.period}${f.late ? `, ${f.late} of them late` : ''}.`,
  );
  const top = f.ahead[0];
  if (top) parts.push(`${top.label} reached ${fmt(top.value, top.unit)} against a target of ${fmt(top.target, top.unit)}.`);
  const worst = f.behind[0];
  if (worst) parts.push(`${worst.label} came in at ${fmt(worst.value, worst.unit)} of a ${fmt(worst.target, worst.unit)} target (${worst.pct}%).`);
  const booked = f.outcomes.filter((o) => (o.value ?? 0) > 0);
  if (booked.length) parts.push(`Results: ${booked.map((o) => `${fmt(o.value)} ${o.name.toLowerCase()}`).join(', ')}.`);
  else if (f.outcomes.length) parts.push('No bookings were logged in these two weeks.');

  const improvements: string[] = [];
  if (f.missed || f.late) {
    improvements.push(
      `Submit an end-of-day report every shift, on time: ${[f.missed ? `${f.missed} missed` : '', f.late ? `${f.late} late` : ''].filter(Boolean).join(', ')} this period.`,
    );
  }
  for (const m of f.behind.slice(0, 2)) {
    improvements.push(`Raise ${m.label.toLowerCase()}: ${fmt(m.value, m.unit)} against a target of ${fmt(m.target, m.unit)} (${m.pct}%).`);
  }
  for (const m of f.dropped.slice(0, 1)) {
    improvements.push(`${m.label} fell from ${fmt(m.previous, m.unit)} to ${fmt(m.value, m.unit)} compared with the two weeks before.`);
  }
  if (f.helpDays) improvements.push(`Clear the blockers flagged on ${f.helpDays} day${f.helpDays === 1 ? '' : 's'} before they slow the next period.`);
  if (!improvements.length) improvements.push('Hold the current pace: no tracked number fell behind target this period.');

  const focus: string[] = [];
  const workdaysAhead = 10;
  for (const m of f.behind.slice(0, 2)) {
    if (m.target != null && !lowerIsBetter(m)) {
      const perDay = Math.ceil(m.target / workdaysAhead);
      focus.push(`Hit the ${m.label.toLowerCase()} target of ${fmt(m.target, m.unit)} over the next 2 weeks, about ${fmt(perDay, m.unit)} a working day.`);
    }
  }
  const mainOutcome = f.outcomes[0];
  if (mainOutcome) {
    const goal = Math.max(1, Math.ceil((mainOutcome.value ?? 0) * 1.25));
    focus.push(`Turn conversations into ${mainOutcome.name.toLowerCase()}: aim for at least ${goal} in the next 2 weeks.`);
  }
  if (f.missed || f.late) focus.push('Log every shift in the end-of-day report by the deadline so the numbers stay complete.');
  if (!focus.length) focus.push('Keep the same daily volume and push for more booked jobs from each conversation.');

  return { summary: parts.join(' '), improvements: improvements.slice(0, 4), focus: focus.slice(0, 4), source: 'rules' };
}

/** The two text fields the client report carries. */
export function formatDraft(draft: Pick<Draft, 'summary' | 'improvements' | 'focus'>): { summary: string; nextFocus: string } {
  const improvements = draft.improvements.map((line) => line.trim()).filter(Boolean);
  const summary = [draft.summary.trim(), improvements.length ? ['What to improve:', ...improvements.map((line) => `- ${line}`)].join('\n') : '']
    .filter(Boolean)
    .join('\n\n');
  const nextFocus = draft.focus
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `- ${line}`)
    .join('\n');
  return { summary, nextFocus };
}

/** What the AI writer may read: client-safe numbers, the findings and the operator's own notes. Never the GoHighLevel cross-check. */
export function aiInput(data: AnalysisData, f: Findings, base: Draft): string {
  const days = data.days
    .filter((day) => day.submitted)
    .map((day) => ({ date: day.date, wins: day.wins.slice(0, 400), blockers: day.blockers.slice(0, 300), plan: day.plan.slice(0, 200) }));
  return JSON.stringify({
    client: f.client,
    operator_first_name: f.firstName,
    period: f.period,
    consistency: { working_days: f.workdays, reports_submitted: f.submitted, late: f.late, missed: f.missed, days_off: f.excused, days_flagged_need_help: f.helpDays },
    numbers: f.metrics.map((m) => ({
      metric: m.label,
      value: m.value,
      unit: m.unit,
      target: m.target,
      percent_of_target: m.pct,
      previous_two_weeks: m.previous,
      change_percent: m.change,
      source: m.verified ? 'verified in GoHighLevel' : 'operator reported',
    })),
    results: f.outcomes,
    behind_target: f.behind.map((m) => m.label),
    ahead_of_target: f.ahead.map((m) => m.label),
    dropped_vs_previous: f.dropped.map((m) => m.label),
    end_of_day_notes: days,
    rule_based_draft: base,
  });
}
