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
  const subject = `New application: ${payload.fullName}`;
  const inquiries =
    payload.inquiriesPerMonth != null ? String(payload.inquiriesPerMonth) : 'Not given';
  const lines = [
    `Name: ${payload.fullName}`,
    `Email: ${payload.email}`,
    payload.phone ? `Phone: ${payload.phone}` : null,
    `Company: ${payload.companyName}`,
    `What they sell: ${payload.coachingNiche}`,
    payload.monthlyAdSpend ? `Monthly ad spend: ${payload.monthlyAdSpend}` : null,
    `Inquiries per month: ${inquiries}`,
    `Follow-up: ${payload.followUpOwnerLabel}`,
    `Program price: ${payload.programPrice}`,
    input.ghlContactId ? `GHL contact: ${input.ghlContactId}` : 'GHL contact: not created',
    input.airtableRecordId ? `Airtable record: ${input.airtableRecordId}` : 'Airtable record: not written',
    input.scheduleUrl ? `Schedule link: ${input.scheduleUrl}` : null,
  ].filter((line): line is string => Boolean(line));

  const text = [
    'A coach just filled out the application.',
    '',
    ...lines,
    '',
    '— Divine Acquisition',
    '',
    ...textFooter({
      reason: 'You received this because an application was submitted on the coaches landing page.',
    }),
  ].join('\n');

  const html = renderEmailHtml({
    subject,
    preheader: `${payload.fullName} applied. ${payload.email}`,
    eyebrow: 'New application',
    title: payload.fullName,
    paragraphs: ['A coach just filled out the application.'],
    details: [
      { label: 'Email', value: payload.email },
      ...(payload.phone ? [{ label: 'Phone', value: payload.phone }] : []),
      { label: 'Company', value: payload.companyName },
      { label: 'What they sell', value: payload.coachingNiche },
      ...(payload.monthlyAdSpend ? [{ label: 'Monthly ad spend', value: payload.monthlyAdSpend }] : []),
      { label: 'Inquiries per month', value: inquiries },
      { label: 'Follow-up', value: payload.followUpOwnerLabel },
      { label: 'Program price', value: payload.programPrice },
      { label: 'GHL', value: input.ghlContactId || 'Not created' },
      { label: 'Airtable', value: input.airtableRecordId || 'Not written' },
    ],
    cta: input.scheduleUrl ? { href: input.scheduleUrl, label: 'Open their scheduling link' } : null,
    footer: {
      reason: 'You received this because an application was submitted on the coaches landing page.',
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
