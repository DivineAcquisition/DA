import 'server-only';

import { createHash, randomUUID } from 'node:crypto';

import { applicationNotifyTo } from '@/lib/acq/application-email';
import { acqCalendarEmbedSrc } from '@/lib/acq/config';
import { logPipelineFailure } from '@/lib/acq/pipeline';
import { renderEmailHtml, textFooter } from '@/lib/email/layout';
import { idempotencyKey } from '@/lib/email/policy';
import { sendAppEmail } from '@/lib/email/service';
import { recordSiteContact } from '@/lib/go/contact';
import { SOURCE_TAGS, TAGS } from '@/lib/ghl/tags';

import {
  diagnosticSummary,
  discoverySummary,
  summaryText,
  type DiagnosticRequest,
  type DiscoveryAnswers,
} from './forms';

/**
 * Where a site submission goes. Each submission is written to two places: the
 * GoHighLevel contact (the CRM) and an alert email to the team, which the
 * email service also logs. It counts as received when at least one of them
 * took it. If neither did, the visitor sees an error and can try again; a
 * submission is never dropped while the page says it went through.
 */
export type Destinations = {
  crm: (input: Parameters<typeof recordSiteContact>[0]) => Promise<string>;
  alert: (input: { subject: string; title: string; intro: string; rows: Array<[string, string]>; replyTo: string; key: string; event: string }) => Promise<boolean>;
  logFailure: (step: string, email: string, error: unknown) => Promise<void>;
};

async function sendAlert(input: Parameters<Destinations['alert']>[0]): Promise<boolean> {
  const reason = 'You received this because someone submitted a form on divineacquisition.io.';
  const text = [input.intro, '', ...input.rows.map(([label, value]) => `${label}: ${value}`), '', ...textFooter({ reason })].join('\n');
  const html = renderEmailHtml({
    subject: input.subject,
    preheader: input.intro,
    eyebrow: 'Sales Operations Diagnostic',
    title: input.title,
    paragraphs: [input.intro],
    details: input.rows.map(([label, value]) => ({ label, value })),
    footer: { reason },
  });
  const result = await sendAppEmail({
    purpose: 'alerts',
    to: applicationNotifyTo(),
    replyTo: input.replyTo,
    subject: input.subject,
    html,
    text,
    template: input.event,
    idempotencyKey: idempotencyKey([input.event, createHash('sha256').update(input.key).digest('hex')]),
    event: input.event,
    payload: { submitter: input.replyTo },
  });
  if (!result.ok) throw new Error(result.error ?? `email ${result.status}`);
  return true;
}

export const LIVE_DESTINATIONS: Destinations = {
  crm: recordSiteContact,
  alert: sendAlert,
  logFailure: logPipelineFailure,
};

export type Recorded = { ok: true; crm: boolean; email: boolean } | { ok: false };

async function deliver(
  destinations: Destinations,
  email: string,
  crmInput: Parameters<Destinations['crm']>[0],
  alertInput: Parameters<Destinations['alert']>[0],
): Promise<Recorded> {
  const [crm, alert] = await Promise.allSettled([destinations.crm(crmInput), destinations.alert(alertInput)]);
  if (crm.status === 'rejected') await destinations.logFailure('site-crm', email, crm.reason);
  if (alert.status === 'rejected') await destinations.logFailure('site-alert', email, alert.reason);
  const crmOk = crm.status === 'fulfilled';
  const emailOk = alert.status === 'fulfilled';
  return crmOk || emailOk ? { ok: true, crm: crmOk, email: emailOk } : { ok: false };
}

/**
 * The calendar the diagnostic is booked on. SITE_DIAGNOSTIC_CALENDAR_URL points
 * the site at its own GoHighLevel calendar; without it, the site uses the
 * existing Sales Ops calendar the acq funnels book on. Null means no calendar.
 */
export function diagnosticCalendarUrl(): string | null {
  const own = process.env.SITE_DIAGNOSTIC_CALENDAR_URL?.trim();
  if (own) return own;
  try {
    return acqCalendarEmbedSrc();
  } catch {
    return null;
  }
}

export function diagnosticBookingConfigured(): boolean {
  return Boolean(diagnosticCalendarUrl());
}

export async function recordDiagnosticRequest(
  request: DiagnosticRequest,
  destinations: Destinations = LIVE_DESTINATIONS,
): Promise<Recorded & { inquiryId: string }> {
  const inquiryId = randomUUID();
  const rows = diagnosticSummary(request, inquiryId);
  const tags = [
    SOURCE_TAGS.salesOperationsDiagnostic,
    TAGS.diagnosticInquiry,
    ...(request.marketingConsent ? [TAGS.marketingOptIn] : []),
  ];
  const result = await deliver(
    destinations,
    request.email,
    {
      email: request.email,
      fullName: request.fullName,
      phone: request.phone || undefined,
      company: request.company,
      website: request.website,
      source: 'sales operations diagnostic',
      note: summaryText('New Sales Operations Diagnostic inquiry (divineacquisition.io)', rows),
      tags,
    },
    {
      subject: `New Sales Operations Diagnostic inquiry: ${request.company}`,
      title: request.fullName,
      intro: `${request.fullName} at ${request.company} requested a Sales Operations Diagnostic.`,
      rows,
      replyTo: request.email,
      key: inquiryId,
      event: 'site.diagnostic-request',
    },
  );
  return { ...result, inquiryId };
}

export async function recordDiscovery(
  answers: DiscoveryAnswers,
  destinations: Destinations = LIVE_DESTINATIONS,
): Promise<Recorded> {
  const rows = discoverySummary(answers);
  return deliver(
    destinations,
    answers.email,
    {
      email: answers.email,
      company: answers.company,
      source: 'sales operations diagnostic',
      note: summaryText('Pre-discovery questionnaire (divineacquisition.io)', rows),
      tags: [SOURCE_TAGS.salesOperationsDiagnostic, TAGS.diagnosticContext],
    },
    {
      subject: `Pre-discovery context received: ${answers.company}`,
      title: answers.company,
      intro: `${answers.company} (${answers.email}) completed the pre-discovery questionnaire.`,
      rows,
      replyTo: answers.email,
      key: `${answers.email}|${answers.inquiryId ?? ''}|${JSON.stringify(rows)}`,
      event: 'site.discovery-context',
    },
  );
}
