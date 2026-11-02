import { appUrl } from '@/lib/apps';
import { renderEmailHtml, textFooter } from './layout';
import { idempotencyKey, uniqueEmails } from './policy';
import { loadEmailIdentity, sendAppEmail } from './service';

type Admin = { id: string; email: string };

const quiet = {
  alertSuppressed: async () => {},
  alertGaveUp: async () => {},
};

async function database() {
  const { serviceRoleClient } = await import('@/lib/workspace/db');
  const client = serviceRoleClient();
  if (!client) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required to send email');
  return client;
}

async function admins(): Promise<Admin[]> {
  const client = await database();
  const { data } = await client.from('profile').select('id, email').in('role', ['owner', 'admin']).eq('state', 'active');
  return ((data ?? []) as Admin[]).filter((row) => row.email);
}

function branded(input: { subject: string; title: string; paragraphs: string[]; href: string; label: string; reason: string }) {
  const footer = { reason: input.reason, replyTo: null as string | null };
  return {
    html: renderEmailHtml({
      subject: input.subject,
      preheader: input.paragraphs[0] ?? input.title,
      eyebrow: 'DA Operations',
      title: input.title,
      paragraphs: input.paragraphs,
      cta: { href: input.href, label: input.label },
      footer,
    }),
    text: [...input.paragraphs, '', `${input.label}: ${input.href}`, '', ...textFooter(footer)].join('\n'),
  };
}

async function deliveriesUrl(): Promise<string> {
  return `${appUrl('admin')}/workspace/team/workspace/reports/deliveries`;
}

export async function notifySuppression(info: { email: string; logId: string; reason: string }): Promise<void> {
  const identity = await loadEmailIdentity('alerts');
  const people = await admins().catch(() => [] as Admin[]);
  const targets = uniqueEmails([identity.replyTo, ...people.map((person) => person.email)]).filter((email) => email !== info.email.toLowerCase());
  const href = await deliveriesUrl();
  const reasonLabel = info.reason === 'complaint' ? 'a spam complaint' : info.reason === 'hard_bounce' ? 'a hard bounce' : info.reason;
  const subject = `Suppressed: ${info.email}`;
  const paragraphs = [
    `${info.email} was added to the suppression list after ${reasonLabel}.`,
    'Mail to this address is skipped until a DA Admin removes it and writes down why.',
  ];
  const mail = branded({
    subject,
    title: 'An address was suppressed',
    paragraphs,
    href,
    label: 'Open the email log',
    reason: 'You received this because you are a DA Admin.',
  });
  for (const to of targets) {
    await sendAppEmail(
      {
        purpose: 'alerts',
        to,
        replyTo: identity.replyTo,
        subject,
        html: mail.html,
        text: mail.text,
        template: 'suppression-alert',
        idempotencyKey: idempotencyKey(['suppression-alert', info.logId, to]),
        event: 'suppression.alert',
        payload: { address: info.email, reason: info.reason },
      },
      quiet,
    );
  }
  if (people.length) {
    const client = await database();
    await client.from('staff_notification').insert(
      people.map((person) => ({
        recipient_profile_id: person.id,
        kind: 'email.suppressed',
        severity: 'important',
        title: subject,
        body: paragraphs.join(' '),
      })),
    );
  }
}

export async function notifyReportBounce(info: { email: string; reportId: string; logId: string }): Promise<void> {
  const client = await database();
  const { data: report } = await client.from('sales_report').select('id, placement_id').eq('id', info.reportId).maybeSingle();
  const placementId = (report as { placement_id?: string } | null)?.placement_id;
  if (!placementId) return;
  const { data: placement } = await client.from('placement').select('manager_profile_id, case_file_id').eq('id', placementId).maybeSingle();
  const managerId = (placement as { manager_profile_id?: string } | null)?.manager_profile_id;
  if (!managerId) return;
  const { data: manager } = await client.from('profile').select('id, email, full_name').eq('id', managerId).maybeSingle();
  const email = (manager as { email?: string } | null)?.email;
  if (!email) return;
  const { data: file } = await client
    .from('client_case_file')
    .select('name')
    .eq('id', (placement as { case_file_id?: string }).case_file_id ?? '')
    .maybeSingle();
  const clientName = (file as { name?: string } | null)?.name || 'the client';
  const href = await deliveriesUrl();
  const subject = `Report bounced for ${clientName}`;
  const paragraphs = [
    `The report for ${clientName} did not reach ${info.email}.`,
    'The address is suppressed. Fix the recipient, then resend the report.',
  ];
  const mail = branded({
    subject,
    title: 'A client report bounced',
    paragraphs,
    href,
    label: 'Review the report delivery',
    reason: 'You received this because you manage this placement.',
  });
  const identity = await loadEmailIdentity('alerts');
  await sendAppEmail(
    {
      purpose: 'alerts',
      to: email,
      replyTo: identity.replyTo,
      subject,
      html: mail.html,
      text: mail.text,
      template: 'report-bounce',
      idempotencyKey: idempotencyKey(['report-bounce', info.reportId, info.logId, email]),
      event: 'report.bounce',
      related: { reportId: info.reportId, placementId },
      payload: { address: info.email, client: clientName },
    },
    quiet,
  );
  await client.from('staff_notification').insert({
    recipient_profile_id: managerId,
    kind: 'email.report_bounce',
    severity: 'important',
    title: subject,
    body: paragraphs.join(' '),
  });
}

export async function notifyGaveUp(info: { logId: string; subject: string; error: string }): Promise<void> {
  const identity = await loadEmailIdentity('alerts');
  if (!identity.replyTo) return;
  const href = await deliveriesUrl();
  const subject = `Email failed: ${info.subject}`.slice(0, 120);
  const paragraphs = [
    `An email did not send after repeated tries.`,
    info.error,
    'It is marked Failed in the email log. Retry it from there once the cause is fixed.',
  ];
  const mail = branded({
    subject,
    title: 'An email failed',
    paragraphs,
    href,
    label: 'Open the email log',
    reason: 'You received this because a DA email exhausted its retries.',
  });
  await sendAppEmail(
    {
      purpose: 'alerts',
      to: identity.replyTo,
      replyTo: identity.replyTo,
      subject,
      html: mail.html,
      text: mail.text,
      template: 'email-gave-up',
      idempotencyKey: idempotencyKey(['email-gave-up', info.logId]),
        event: 'email.gave_up',
        payload: { failedLogId: info.logId },
    },
    quiet,
  );
}
