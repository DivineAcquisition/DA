import { fillMerge, type MergeFields } from './fields';

function page(template: string, fields: MergeFields): string {
  const filled = fillMerge(template, fields);
  if (filled.missing.length > 0) {
    throw new Error(`Missing ${filled.missing.join(', ')}`);
  }
  return filled.text;
}

/** Single-use operator pulse. No sign-in. Expires in 7 days. */
export const operatorPulse = {
  header: 'Divine Acquisition',
  title: (fields: MergeFields) => page('Quick check-in on your first [Days] days', fields),
  intro: 'Three questions. Two minutes. Your answers go to your manager so we can support you.',
  questions: [
    'How confident do you feel in the role right now? (1 to 5)',
    'What is slowing you down or unclear?',
    "What do you need from DA that you don't have?",
  ],
  button: 'Send',
  thankYou: 'Thank you. Your manager will see your answers. You can close this page.',
  alreadyAnswered: 'You already answered this check-in. Thank you.',
  expired: "This link has expired. Reply to the email you received and we'll help.",
  invalid: "This link is not valid. Reply to the email you received and we'll help.",
};

/** Single-use client pulse. Shows no training information. */
export const clientPulse = {
  header: 'Divine Acquisition',
  title: (fields: MergeFields) => page('How is [Operator first name] doing?', fields),
  intro: 'Two quick questions. It takes under a minute.',
  questions: (fields: MergeFields) => [
    page("How satisfied are you with [Operator first name]'s work so far? (1 to 5)", fields),
    'Is there anything Divine Acquisition should know?',
  ],
  button: 'Send',
  thankYou: 'Thank you. We read every response.',
  alreadyAnswered: 'You already answered this check-in. Thank you.',
  expired: 'This link has expired. If you would like to share feedback, reply to the email you received.',
};

export type CertificateStatus = 'valid' | 'expired' | 'revoked' | 'link_off' | 'not_found';

/** Public verification. Name, level, vertical or track, date, and status only. */
export function certificateVerification(status: CertificateStatus, fields: MergeFields): { title: string; body: string; footer: string } {
  const title = 'Certification verification';
  const footer = page('Issued by Divine Acquisition. For questions, contact [Support email].', fields);
  if (status === 'valid') {
    return { title, footer, body: page('[Full name] holds [Level] ([Vertical or Track]). Granted [Date]. Status: Valid.', fields) };
  }
  if (status === 'expired') {
    return { title, footer, body: page('[Full name] held [Level] ([Vertical or Track]). Granted [Date]. Status: Expired.', fields) };
  }
  if (status === 'revoked') return { title, footer, body: 'This certification is no longer valid.' };
  if (status === 'link_off') return { title, footer, body: 'This verification link is no longer available.' };
  return { title, footer, body: 'We could not find that certificate. Check the link or code and try again.' };
}
