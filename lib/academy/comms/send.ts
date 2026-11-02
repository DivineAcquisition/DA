import type { EmailPurpose } from '@/lib/email/policy';
import { requireSent, sendAppEmail } from '@/lib/email/service';
import type { EmailAudience } from './emails';
import type { RenderedEmail } from './render';

/** Academy mail uses the same four senders as the rest of the app. The root domain is not a sender. */
export function purposeForAudience(audience: EmailAudience): EmailPurpose {
  if (audience === 'security') return 'security';
  if (audience === 'client') return 'client';
  if (audience === 'internal') return 'alerts';
  return 'team';
}

export async function sendAcademyEmail(input: {
  audience: EmailAudience;
  to: string;
  email: RenderedEmail;
  idempotencyKey: string;
  event: string;
  relatedId?: string | null;
}): Promise<{ id: string }> {
  return requireSent(
    await sendAppEmail({
      purpose: purposeForAudience(input.audience),
      to: input.to,
      subject: input.email.subject,
      html: input.email.html,
      text: input.email.text,
      template: input.email.id,
      idempotencyKey: input.idempotencyKey,
      event: input.event,
      related: { relatedType: 'academy', relatedId: input.relatedId ?? null },
      payload: { template: input.email.id, audience: input.audience },
    }),
  );
}
