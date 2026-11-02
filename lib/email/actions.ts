'use server';

import { revalidatePath } from 'next/cache';
import { controlRpc, readable, type ActionResult } from '@/lib/ad/rpc';
import { renderEmailHtml, textFooter } from '@/lib/email/layout';
import { EMAIL_PURPOSES, idempotencyKey, type EmailPurpose } from '@/lib/email/policy';
import { requireSent, retryEmailLog, sendAppEmail } from '@/lib/email/service';
import { createClient, getSessionContext } from '@/lib/supabase/server';

const PATH = '/workspace/team/workspace/reports/deliveries';

async function admin() {
  const session = await getSessionContext();
  if (!session?.isAdmin || session.impersonation) return null;
  return session;
}

function refresh() {
  revalidatePath(PATH);
}

export async function retryEmailAction(fd: FormData): Promise<ActionResult> {
  if (!(await admin())) return { ok: false, error: 'DA Admin only.' };
  const id = String(fd.get('log_id') ?? '');
  const result = await retryEmailLog(id);
  refresh();
  if (!result.ok) return { ok: false, error: result.error || 'Retry failed.' };
  return { ok: true, message: 'Email sent again.' };
}

export async function saveEmailIdentityAction(fd: FormData): Promise<ActionResult> {
  if (!(await admin())) return { ok: false, error: 'DA Admin only.' };
  const supabase = await createClient();
  const replyTo = String(fd.get('reply_to') ?? '').trim();
  for (const purpose of EMAIL_PURPOSES) {
    const { error } = await controlRpc(supabase, 'email_identity_save', {
      p_purpose: purpose,
      p_display_name: String(fd.get(`${purpose}_name`) ?? ''),
      p_address: String(fd.get(`${purpose}_address`) ?? ''),
      p_reply_to: purpose === 'security' ? '' : replyTo,
    });
    if (error) return { ok: false, error: readable(error) };
  }
  refresh();
  return { ok: true, message: 'Senders saved.' };
}

export async function liftSuppressionAction(fd: FormData): Promise<ActionResult> {
  if (!(await admin())) return { ok: false, error: 'DA Admin only.' };
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, 'email_suppression_lift', {
    p_email: String(fd.get('email') ?? ''),
    p_reason: String(fd.get('reason') ?? ''),
  });
  if (error) return { ok: false, error: readable(error) };
  refresh();
  return { ok: true, message: 'Address removed from the suppression list.' };
}

const TEST_COPY: Record<EmailPurpose, { subject: string; title: string; body: string; template: string }> = {
  security: {
    subject: 'Test: Divine Acquisition sign-in',
    title: 'This is a test sign-in email',
    body: 'This is a test of the security sender. It does not sign you in.',
    template: 'test-security',
  },
  team: {
    subject: 'Test: operator mail',
    title: 'This is a test operator email',
    body: 'This is a test of team and operator mail. No action is required.',
    template: 'test-team',
  },
  alerts: {
    subject: 'Test: admin alert',
    title: 'This is a test alert',
    body: 'This is a test of manager and admin alerts. No action is required.',
    template: 'test-alerts',
  },
  client: {
    subject: 'Test: client report',
    title: 'This is a test client report',
    body: 'This is a test of client mail. It was sent only to you.',
    template: 'test-client',
  },
};

export async function sendEmailTestAction(fd: FormData): Promise<ActionResult> {
  const session = await admin();
  if (!session) return { ok: false, error: 'DA Admin only.' };
  const purpose = String(fd.get('purpose') ?? '') as EmailPurpose;
  if (!EMAIL_PURPOSES.includes(purpose)) return { ok: false, error: 'Choose an email type.' };
  const supabase = await createClient();
  const { data: profile } = await supabase.from('profile').select('email').eq('id', session.userId).maybeSingle();
  const to = profile?.email?.trim().toLowerCase();
  if (!to) return { ok: false, error: 'Your profile has no email.' };
  const copy = TEST_COPY[purpose];
  const nonce = new Date().toISOString().slice(0, 16);
  const footer = {
    reason: 'You received this because you sent yourself a test from the email log.',
    replyTo: purpose === 'client' ? to : null,
  };
  const html = renderEmailHtml({
    subject: copy.subject,
    preheader: copy.body,
    eyebrow: 'Test',
    title: copy.title,
    paragraphs: [copy.body],
    footer,
  });
  const text = [copy.body, '', ...textFooter(footer)].join('\n');
  try {
    const sent = requireSent(
      await sendAppEmail({
        purpose,
        to,
        subject: copy.subject,
        html,
        text,
        template: copy.template,
        idempotencyKey: idempotencyKey(['email-test', purpose, session.userId, nonce]),
        event: 'email.test',
        payload: { purpose },
      }),
    );
    refresh();
    return { ok: true, message: `Test sent to ${to}. Message ${sent.id}.` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Test failed.' };
  }
}
