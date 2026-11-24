import 'server-only';

import { appUrl } from '@/lib/apps';
import { renderEmailHtml, textFooter } from '@/lib/email/layout';
import { idempotencyKey } from '@/lib/email/policy';
import { sendAppEmail } from '@/lib/email/service';
import type { UntypedClient } from '@/lib/workspace/db';
import { aiDraft } from './biweekly-ai';
import { aiInput, findings, formatDraft, integrity, rangeLabel, ruleDraft, type AnalysisData, type Draft } from './biweekly';

type Due = { id: string; analyzed: boolean; draft_sent: boolean };

function when(iso: string | null, zone: string | null): string {
  if (!iso) return 'in 24 hours';
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: zone || 'America/Chicago',
    timeZoneName: 'short',
  });
}

/**
 * Re-check the operator's numbers against GoHighLevel for each reported day,
 * so the integrity note reflects the latest sync.
 */
async function recheck(db: UntypedClient, data: AnalysisData): Promise<void> {
  for (const day of data.days.filter((d) => d.submitted)) {
    await db.rpc('so_check_mismatches', { p_placement: data.placement.id, p_day: day.date, p_reason: 'biweekly_report' });
  }
}

async function load(db: UntypedClient, id: string): Promise<AnalysisData | null> {
  const { data, error } = await db.rpc('so_report_analysis_data', { p_report: id });
  if (error) throw new Error(error.message);
  return (data as AnalysisData | null) ?? null;
}

async function analyze(db: UntypedClient, id: string): Promise<void> {
  const first = await load(db, id);
  if (!first) return;
  await recheck(db, first);
  const data = (await load(db, id)) ?? first;
  const f = findings(data);
  const base = ruleDraft(f);
  const draft: Draft = (await aiDraft(aiInput(data, f, base))) ?? base;
  const check = integrity(data);
  const text = formatDraft(draft);
  const { error } = await db.rpc('so_report_save_analysis', {
    p_report: id,
    p_summary: text.summary,
    p_next_focus: text.nextFocus,
    p_analysis: { source: draft.source, model: draft.model ?? null, draft, rules: base, findings: f, written_at: new Date().toISOString() },
    p_integrity: check,
  });
  if (error) throw new Error(error.message);
}

/** The draft, the GoHighLevel check and when it sends, to DA staff on the seat. */
async function sendDraft(db: UntypedClient, id: string): Promise<boolean> {
  const data = await load(db, id);
  if (!data) return false;
  const { data: row } = await db
    .from('sales_report')
    .select('summary,next_focus,integrity,analysis,status,auto_send_at')
    .eq('id', id)
    .maybeSingle();
  if (!row || row.status !== 'ready') return true;
  if (!String(row.summary ?? '').trim()) return false;
  const to = (data.staff_emails ?? []).filter((email) => email.includes('@'));
  if (to.length === 0) return true;

  const f = findings(data);
  const check = (row.integrity as ReturnType<typeof integrity> | null) ?? integrity(data);
  const source = (row.analysis as { source?: string } | null)?.source === 'ai' ? 'Written by Claude from the data' : 'Written by rule from the data';
  const sendsAt = when(row.auto_send_at as string | null, data.placement.time_zone);
  const period = rangeLabel(data.report.period_start, data.report.period_end);
  const href = `${appUrl('admin')}/workspace/review/reports/${id}`;
  const subject = `Draft: ${f.client} bi-weekly report for ${f.firstName}, ${period}`;
  const summary = String(row.summary ?? '');
  const focus = String(row.next_focus ?? '');
  const integrityTitle =
    check.state === 'verified' ? 'GoHighLevel check: verified' : check.state === 'partly_verified' ? 'GoHighLevel check: partly verified' : 'GoHighLevel check: not verified';

  const paragraphs = [
    `The bi-weekly report for ${f.operator} at ${f.client} (${period}) is drafted. It sends itself to the client ${sendsAt} unless you hold or edit it.`,
    `${source}. The client sees the summary, what to improve and the sales focus below, with their numbers. The GoHighLevel check is for you only.`,
  ];
  const footer = { reason: 'You received this because you are on the DA staff list for this seat.' };
  const html = renderEmailHtml({
    subject,
    preheader: `Sends itself ${sendsAt} unless you hold it.`,
    eyebrow: 'Bi-weekly report draft',
    title: `${f.client}: ${period}`,
    paragraphs,
    details: [
      { label: 'Summary and what to improve', value: summary },
      { label: 'Sales focus for the next 2 weeks', value: focus },
      { label: integrityTitle, value: check.lines.join('\n') },
      { label: 'End-of-day reports', value: `${f.submitted} of ${f.workdays} submitted, ${f.late} late, ${f.missed} missed${f.excused ? `, ${f.excused} days off` : ''}` },
    ],
    cta: { href, label: 'Review, edit or hold' },
    footer,
  });
  const text = [
    subject,
    '',
    ...paragraphs,
    '',
    summary,
    '',
    'Sales focus for the next 2 weeks:',
    focus,
    '',
    integrityTitle,
    ...check.lines,
    '',
    `Review, edit or hold: ${href}`,
    ...textFooter(footer),
  ].join('\n');

  const result = await sendAppEmail({
    purpose: 'team',
    to,
    subject,
    html,
    text,
    template: 'staff.biweekly_report_draft',
    idempotencyKey: idempotencyKey(['biweekly-draft', id]),
    event: 'staff.biweekly_report_draft',
    related: { placementId: data.placement.id, relatedType: 'sales_report', relatedId: id },
    payload: { reportId: id, integrity: check.state },
  });
  return result.ok || result.status === 'queued';
}

/**
 * Bi-weekly drafts: write the analysis for any that do not have it yet, then
 * send staff the draft. The sweep sends the report itself 24 hours after it
 * opened, unless it was held.
 */
export async function runBiweekly(db: UntypedClient): Promise<{ analyzed: number; drafts: number; errors: string[] }> {
  const out = { analyzed: 0, drafts: 0, errors: [] as string[] };
  const { data, error } = await db.rpc('so_report_biweekly_due', { p_limit: 3 });
  if (error) {
    out.errors.push(error.message);
    return out;
  }
  for (const item of (Array.isArray(data) ? data : []) as Due[]) {
    try {
      if (!item.analyzed) {
        await analyze(db, item.id);
        out.analyzed += 1;
      }
      if (!item.draft_sent && (await sendDraft(db, item.id))) {
        await db.rpc('so_report_mark_draft_sent', { p_report: item.id });
        out.drafts += 1;
      }
    } catch (cause) {
      out.errors.push(`biweekly ${item.id}: ${cause instanceof Error ? cause.message : 'failed'}`);
    }
  }
  return out;
}
