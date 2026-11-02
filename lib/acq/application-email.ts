import { renderEmailHtml, textFooter } from '@/lib/email/layout';
import { createHash } from 'node:crypto';
import { idempotencyKey } from '@/lib/email/policy';
import { requireSent, sendAppEmail } from '@/lib/email/service';
import { ACQ_AUDIT_CC } from './config';
import { AI_FRONT_OFFICE_OFFER } from '@/lib/ghl/tags';
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
  const frontOffice = payload.coachingNiche === AI_FRONT_OFFICE_OFFER;
  const subject = frontOffice
    ? `New application: ${AI_FRONT_OFFICE_OFFER}: ${payload.fullName}`
    : `New application: ${payload.fullName}`;
  const inquiries =
    payload.inquiriesPerMonth != null ? String(payload.inquiriesPerMonth) : 'Not given';
  const intro = frontOffice
    ? `${payload.businessLabel || payload.niche} application for the ${AI_FRONT_OFFICE_OFFER}.`
    : niche
      ? `A ${payload.niche} owner requested the Lead Leak Audit.`
      : 'A coach just filled out the application.';
  const lines = [
    `Name: ${payload.fullName}`,
    `Email: ${payload.email}`,
    payload.phone ? `Phone: ${payload.phone}` : null,
    `Company: ${payload.companyName}`,
    frontOffice ? `Offer: ${payload.coachingNiche}` : `What they sell: ${payload.coachingNiche}`,
    payload.niche ? `Niche: ${payload.niche}` : null,
    payload.businessLabel ? `Business: ${payload.businessLabel}` : null,
    payload.spendBand ? `Spend band: ${payload.spendBand}` : null,
    payload.monthlyRevenue ? `Monthly revenue: ${payload.monthlyRevenue}` : null,
    payload.weeklyLeads ? `Weekly leads: ${payload.weeklyLeads}` : null,
    payload.biggestLeak ? `Biggest leak: ${payload.biggestLeak}` : null,
    payload.adName ? `Ad name: ${payload.adName}` : null,
    payload.firstCampaign ? `First-touch campaign: ${payload.firstCampaign}` : null,
    payload.lastCampaign ? `Last-touch campaign: ${payload.lastCampaign}` : null,
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

  const reason = frontOffice
    ? `You received this because someone submitted the ${AI_FRONT_OFFICE_OFFER} form.`
    : niche
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
      { label: frontOffice ? 'Offer' : 'What they sell', value: payload.coachingNiche },
      ...(payload.niche ? [{ label: 'Niche', value: payload.niche }] : []),
      ...(payload.businessLabel ? [{ label: 'Business', value: payload.businessLabel }] : []),
      ...(payload.spendBand ? [{ label: 'Spend band', value: payload.spendBand }] : []),
      ...(payload.monthlyRevenue ? [{ label: 'Monthly revenue', value: payload.monthlyRevenue }] : []),
      ...(payload.weeklyLeads ? [{ label: 'Weekly leads', value: payload.weeklyLeads }] : []),
      ...(payload.biggestLeak ? [{ label: 'Biggest leak', value: payload.biggestLeak }] : []),
      ...(payload.adName ? [{ label: 'Ad name', value: payload.adName }] : []),
      ...(payload.firstCampaign ? [{ label: 'First-touch campaign', value: payload.firstCampaign }] : []),
      ...(payload.lastCampaign ? [{ label: 'Last-touch campaign', value: payload.lastCampaign }] : []),
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

export async function sendCompletedApplicationEmail(input: {
  to: string;
  subject: string;
  text: string;
  filename: string;
  pdf: Uint8Array;
}): Promise<{ id: string }> {
  const footer = { reason: 'You received this because an application was completed.' };
  const html = renderEmailHtml({
    subject: input.subject,
    preheader: input.subject,
    eyebrow: 'Application',
    title: input.subject,
    bodyHtml: input.text
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => `<p style="margin:0 0 8px;font-family:Inter,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#c9c8d3;">${line.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p>`)
      .join(''),
    footer,
  });
  return requireSent(
    await sendAppEmail({
      purpose: 'alerts',
      to: input.to,
      subject: input.subject,
      html,
      text: [input.text, '', ...textFooter(footer)].join('\n'),
      template: 'application-completed',
      idempotencyKey: idempotencyKey(['application-completed', createHash('sha256').update(`${input.to}\n${input.filename}\n${input.text}`).digest('hex')]),
      event: 'application.completed',
      attachments: [{ filename: input.filename, content: Buffer.from(input.pdf) }],
    }),
  );
}

export async function sendApplicationAlertEmail(input: {
  payload: QualificationPayload;
  ghlContactId?: string;
  airtableRecordId?: string;
  scheduleUrl?: string;
}): Promise<{ id: string }> {
  const to = applicationNotifyTo();
  const content = buildApplicationAlertEmail(input);
  return requireSent(
    await sendAppEmail({
      purpose: 'alerts',
      to,
      replyTo: input.payload.email,
      subject: content.subject,
      html: content.html,
      text: content.text,
      template: 'application-alert',
      idempotencyKey: idempotencyKey([
        'application-alert',
        createHash('sha256')
          .update(`${input.payload.email}|${input.ghlContactId ?? ''}|${input.airtableRecordId ?? ''}|${input.scheduleUrl ?? ''}`)
          .digest('hex'),
      ]),
      event: 'application.alert',
      payload: { applicant: input.payload.email, ghlContactId: input.ghlContactId },
    }),
  );
}
