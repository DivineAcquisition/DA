import { FONT_HEAD, renderEmailHtml, type EmailContent } from './layout';

/**
 * Supabase Auth emails. The HTML is a Go template: `{{ .ConfirmationURL }}`
 * and the other fields are filled in by Supabase, so they must stay literal.
 * Hosted projects do not read these files on their own. Paste each subject
 * and file into Authentication → Email Templates, or push them with the
 * Management API (`mailer_templates_*_content`).
 */

const CONFIRM = '{{ .ConfirmationURL }}';
const TOKEN = '{{ .Token }}';

function codeHtml(token: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
<td align="center" style="padding:8px 0 0;">
<p style="margin:0;font-family:${FONT_HEAD};font-size:32px;font-weight:700;letter-spacing:0.28em;line-height:1.2;color:#ffffff;">${token}</p>
</td></tr></table>`;
}

export type AuthEmailTemplate = {
  /** File name under supabase/templates. */
  file: string;
  /** Supabase mailer subject. The message title uses the same words. */
  subject: string;
  /** Management API field, when this template is pushed to a hosted project. */
  contentKey: string;
  subjectKey: string;
  html: string;
};

function message(file: string, contentKey: string, subjectKey: string, content: EmailContent): AuthEmailTemplate {
  return { file, subject: content.subject, contentKey, subjectKey, html: renderEmailHtml(content) };
}

const security = (reason: string) => ({
  reason,
});

export function authEmailTemplates(): AuthEmailTemplate[] {
  return [
    message('confirmation.html', 'mailer_templates_confirmation_content', 'mailer_subjects_confirmation', {
      subject: 'Confirm your Divine Acquisition email',
      preheader: 'Confirm your address to finish signing up. The link expires soon.',
      eyebrow: 'Account',
      title: 'Confirm your email',
      paragraphs: ['Confirm this address so you can sign in to Divine Acquisition. The link expires soon and works once.'],
      cta: { href: CONFIRM, label: 'Confirm email' },
      showFallbackLink: true,
      note: 'If you did not sign up, you can ignore this email.',
      footer: security('You received this because a Divine Acquisition account was created for {{ .Email }}.'),
    }),
    message('invite.html', 'mailer_templates_invite_content', 'mailer_subjects_invite', {
      subject: "You're invited to Divine Acquisition",
      preheader: 'Accept the invitation to create your account. The link works once.',
      eyebrow: 'Account',
      title: "You're invited",
      paragraphs: ['You have been invited to create a Divine Acquisition account. The link expires soon and works once.'],
      cta: { href: CONFIRM, label: 'Accept the invitation' },
      showFallbackLink: true,
      note: 'If you were not expecting this invitation, you can ignore this email.',
      footer: security('You received this because {{ .Email }} was invited to Divine Acquisition.'),
    }),
    message('magic_link.html', 'mailer_templates_magic_link_content', 'mailer_subjects_magic_link', {
      subject: 'Your Divine Acquisition sign-in link',
      preheader: 'This link expires soon and works once.',
      eyebrow: 'Account',
      title: 'Sign in',
      paragraphs: ['Use the button to sign in to Divine Acquisition. The link expires soon and can only be used once.'],
      cta: { href: CONFIRM, label: 'Sign in' },
      showFallbackLink: true,
      note: 'If you did not ask to sign in, you can ignore this email.',
      footer: security('You received this because a sign-in link was requested for {{ .Email }}.'),
    }),
    message('recovery.html', 'mailer_templates_recovery_content', 'mailer_subjects_recovery', {
      subject: 'Reset your Divine Acquisition password',
      preheader: 'Use this link to choose a new password. It expires in 1 hour.',
      eyebrow: 'Account security',
      title: 'Reset your password',
      paragraphs: ['We received a request to reset the password for your Divine Acquisition account. Use the button below to choose a new one.'],
      cta: { href: CONFIRM, label: 'Choose a new password' },
      showFallbackLink: true,
      note: 'If you did not ask for this, you can ignore this email. Your password stays the same.',
      footer: security('You received this because a password reset was requested for {{ .Email }}.'),
    }),
    message('email_change.html', 'mailer_templates_email_change_content', 'mailer_subjects_email_change', {
      subject: 'Confirm your new Divine Acquisition email',
      preheader: 'Confirm {{ .NewEmail }} to finish the change.',
      eyebrow: 'Account security',
      title: 'Confirm your new email',
      paragraphs: ['Confirm {{ .NewEmail }} as the new sign-in address for your Divine Acquisition account. The link expires soon and works once.'],
      cta: { href: CONFIRM, label: 'Confirm new email' },
      showFallbackLink: true,
      note: 'If you did not ask to change the email on {{ .Email }}, you can ignore this email.',
      footer: security('You received this because an email change was requested for {{ .Email }}.'),
    }),
    message('reauthentication.html', 'mailer_templates_reauthentication_content', 'mailer_subjects_reauthentication', {
      subject: 'Your Divine Acquisition verification code',
      preheader: 'Enter this code to continue. It expires shortly.',
      eyebrow: 'Account security',
      title: 'Your verification code',
      paragraphs: ["Enter this code to confirm it is you. It expires shortly and works once."],
      bodyHtml: codeHtml(TOKEN),
      note: 'If you did not try to do this, you can ignore this email.',
      footer: security('You received this because a verification was requested for {{ .Email }}.'),
    }),
    message(
      'password_changed_notification.html',
      'mailer_templates_password_changed_notification_content',
      'mailer_subjects_password_changed_notification',
      {
        subject: 'Your Divine Acquisition password was changed',
        preheader: 'If this was not you, reset your password.',
        eyebrow: 'Account security',
        title: 'Your password was changed',
        paragraphs: ['The password for {{ .Email }} was just changed.'],
        note: 'If you did not make this change, reset your password and contact Divine Acquisition immediately.',
        footer: security('You received this because the password changed on {{ .Email }}.'),
      },
    ),
    message(
      'email_changed_notification.html',
      'mailer_templates_email_changed_notification_content',
      'mailer_subjects_email_changed_notification',
      {
        subject: 'Your Divine Acquisition email address was changed',
        preheader: 'If this was not you, contact Divine Acquisition.',
        eyebrow: 'Account security',
        title: 'Your email address was changed',
        paragraphs: ['The email address for your account was changed from {{ .OldEmail }} to {{ .Email }}.'],
        note: 'If you did not make this change, contact Divine Acquisition immediately.',
        footer: security('You received this because the email address on your Divine Acquisition account changed.'),
      },
    ),
    message(
      'phone_changed_notification.html',
      'mailer_templates_phone_changed_notification_content',
      'mailer_subjects_phone_changed_notification',
      {
        subject: 'Your Divine Acquisition phone number was changed',
        preheader: 'If this was not you, contact Divine Acquisition.',
        eyebrow: 'Account security',
        title: 'Your phone number was changed',
        paragraphs: ['The phone number for {{ .Email }} was changed from {{ .OldPhone }} to {{ .Phone }}.'],
        note: 'If you did not make this change, contact Divine Acquisition immediately.',
        footer: security('You received this because the phone number on your Divine Acquisition account changed.'),
      },
    ),
    message(
      'mfa_factor_enrolled_notification.html',
      'mailer_templates_mfa_factor_enrolled_notification_content',
      'mailer_subjects_mfa_factor_enrolled_notification',
      {
        subject: 'A verification method was added to your Divine Acquisition account',
        preheader: 'If this was not you, contact Divine Acquisition.',
        eyebrow: 'Account security',
        title: 'A verification method was added',
        paragraphs: ['{{ .FactorType }} was added as a sign-in verification method for {{ .Email }}.'],
        note: 'If you did not make this change, contact Divine Acquisition immediately.',
        footer: security('You received this because a verification method was added to {{ .Email }}.'),
      },
    ),
    message(
      'mfa_factor_unenrolled_notification.html',
      'mailer_templates_mfa_factor_unenrolled_notification_content',
      'mailer_subjects_mfa_factor_unenrolled_notification',
      {
        subject: 'A verification method was removed from your Divine Acquisition account',
        preheader: 'If this was not you, contact Divine Acquisition.',
        eyebrow: 'Account security',
        title: 'A verification method was removed',
        paragraphs: ['{{ .FactorType }} was removed as a sign-in verification method for {{ .Email }}.'],
        note: 'If you did not make this change, contact Divine Acquisition immediately.',
        footer: security('You received this because a verification method was removed from {{ .Email }}.'),
      },
    ),
    message(
      'identity_linked_notification.html',
      'mailer_templates_identity_linked_notification_content',
      'mailer_subjects_identity_linked_notification',
      {
        subject: 'A sign-in method was linked to your Divine Acquisition account',
        preheader: 'If this was not you, contact Divine Acquisition.',
        eyebrow: 'Account security',
        title: 'A sign-in method was linked',
        paragraphs: ['Your {{ .Provider }} account was linked as a sign-in method for {{ .Email }}.'],
        note: 'If you did not make this change, contact Divine Acquisition immediately.',
        footer: security('You received this because a sign-in method was linked to {{ .Email }}.'),
      },
    ),
    message(
      'identity_unlinked_notification.html',
      'mailer_templates_identity_unlinked_notification_content',
      'mailer_subjects_identity_unlinked_notification',
      {
        subject: 'A sign-in method was removed from your Divine Acquisition account',
        preheader: 'If this was not you, contact Divine Acquisition.',
        eyebrow: 'Account security',
        title: 'A sign-in method was removed',
        paragraphs: ['Your {{ .Provider }} account was removed as a sign-in method for {{ .Email }}.'],
        note: 'If you did not make this change, contact Divine Acquisition immediately.',
        footer: security('You received this because a sign-in method was removed from {{ .Email }}.'),
      },
    ),
  ];
}
