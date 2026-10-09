import { Resend } from 'resend';
import { renderEmailHtml, textFooter } from '@/lib/email/layout';
import { ACQ_AUDIT_CC } from './config';
import { WORKSPACE_RESEND_FROM } from '@/lib/workspace/email';
import type { QualificationPayload } from './qualify';

export function applicationNotifyTo(): string {
  return process.env.ACQ_APPLICATION_NOTIFY_EMAIL?.trim() || ACQ_AUDIT_CC;
}

export function buildApplicationAlertEmail(input: {
  payload: QualificationPayload;
  ghlContactId?: string;
  airtableRecordId?: string;
  scheduleUrl?: string;
}): { subject: string; html: string; text: string } {
  const { payload } = input;
  const niche = Boolean(payload.niche);
  const subject = `New application: ${payload.fullName}`;
  const inquiries =
    payload.inquiriesPerMonth != null ? String(payload.inquiriesPerMonth) : 'Not given';
  const intro = niche
    ? `A ${payload.niche} owner requested the Lead Leak Audit.`
    : 'A coach just filled out the application.';
  const lines = [
    `Name: ${payload.fullName}`,
    `Email: ${payload.email}`,
    payload.phone ? `Phone: ${payload.phone}` : null,
    `Company: ${payload.companyName}`,
    `What they sell: ${payload.coachingNiche}`,
    payload.niche ? `Niche: ${payload.niche}` : null,
    payload.spendBand ? `Spend band: ${payload.spendBand}` : null,
    payload.nicheQualified == null ? null : `Qualified: ${payload.nicheQualified ? 'yes' : 'no'}`,
    payload.headlineVariant ? `Headline: ${payload.headlineVariant}` : null,
    payload.monthlyAdSpend ? `Monthly ad spend: ${payload.monthlyAdSpend}` : null,
    niche ? null : `Inquiries per month: ${inquiries}`,
    payload.followUpOwnerLabel ? `Follow-up: ${payload.followUpOwnerLabel}` : null,
    payload.programPrice ? `Program price: ${payload.programPrice}` : null,
    payload.smsConsent ? 'Calls and texts: consented' : null,
    payload.emailConsent ? 'Email and blueprint: consented' : null,
    input.ghlContactId ? `GHL contact: ${input.ghlContactId}` : 'GHL contact: not created',
    input.airtableRecordId ? `Airtable record: ${input.airtableRecordId}` : 'Airtable record: not written',
    input.scheduleUrl ? `Schedule link: ${input.scheduleUrl}` : null,
    ...(niche
      ? Object.entries(payload.attribution ?? {})
          .filter((entry): entry is [string, string] => Boolean(entry[1]))
          .map(([key, value]) => `${key}: ${value}`)
      : []),
  ].filter((line): line is string => Boolean(line));

  const reason = niche
    ? `You received this because someone submitted the ${payload.niche} Lead Leak Audit form.`
    : 'You received this because an application was submitted on the coaches landing page.';
  const text = [
    intro,
    '',
    ...lines,
    '',
    '— Divine Acquisition',
    '',
    ...textFooter({
      reason,
    }),
  ].join('\n');

  const html = renderEmailHtml({
    subject,
    preheader: `${payload.fullName} applied. ${payload.email}`,
    eyebrow: 'New application',
    title: payload.fullName,
    paragraphs: [intro],
    details: [
      { label: 'Email', value: payload.email },
      ...(payload.phone ? [{ label: 'Phone', value: payload.phone }] : []),
      { label: 'Company', value: payload.companyName },
      { label: 'What they sell', value: payload.coachingNiche },
      ...(payload.niche ? [{ label: 'Niche', value: payload.niche }] : []),
      ...(payload.spendBand ? [{ label: 'Spend band', value: payload.spendBand }] : []),
      ...(payload.nicheQualified == null
        ? []
        : [{ label: 'Qualified', value: payload.nicheQualified ? 'yes' : 'no' }]),
      ...(payload.headlineVariant ? [{ label: 'Headline', value: payload.headlineVariant }] : []),
      ...(payload.monthlyAdSpend ? [{ label: 'Monthly ad spend', value: payload.monthlyAdSpend }] : []),
      ...(niche ? [] : [{ label: 'Inquiries per month', value: inquiries }]),
      ...(payload.followUpOwnerLabel ? [{ label: 'Follow-up', value: payload.followUpOwnerLabel }] : []),
      ...(payload.programPrice ? [{ label: 'Program price', value: payload.programPrice }] : []),
      { label: 'GHL', value: input.ghlContactId || 'Not created' },
      { label: 'Airtable', value: input.airtableRecordId || 'Not written' },
    ],
    cta: input.scheduleUrl ? { href: input.scheduleUrl, label: 'Open their scheduling link' } : null,
    footer: {
      reason,
    },
  });

  return { subject, html, text };
}

export async function sendApplicationAlertEmail(input: {
  payload: QualificationPayload;
  ghlContactId?: string;
  airtableRecordId?: string;
  scheduleUrl?: string;
}): Promise<{ id: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  const to = applicationNotifyTo();
  const content = buildApplicationAlertEmail(input);
  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: WORKSPACE_RESEND_FROM,
    to: [to],
    replyTo: input.payload.email,
    subject: content.subject,
    html: content.html,
    text: content.text,
    tags: [
      { name: 'surface', value: 'acq' },
      { name: 'type', value: 'application_alert' },
    ],
  });

  if (error || !data?.id) {
    throw new Error(error?.message ?? 'Resend did not return an email id');
  }

  return { id: data.id };
}
