import { automatedSignature, footerText, personalSignature, type FooterKind } from './blocks';
import type { AcademyCommsConfig } from './config';
import { resolveCommsConfig } from './config';
import { discordAlert } from './discord';
import { emailTemplate } from './emails';
import { fillMerge, type MergeFields } from './fields';
import { buttonLabel, primaryUrl, renderAcademyHtml } from './layout';
import { safetyViolations } from './safety';
import { smsTemplate } from './sms';

export type RenderedEmail = {
  id: string;
  subject: string;
  preheader: string;
  html: string;
  text: string;
  fromName: string;
  fromAddress: string;
  replyTo: string;
};

export type RenderFailure = { ok: false; missing: string[]; violations: string[] };

function defaults(fields: MergeFields, config: AcademyCommsConfig): MergeFields {
  return {
    senderName: config.senderName,
    supportEmail: config.supportEmail,
    companyAddress: config.companyAddress,
    numberOfDays: config.replyDays,
    rolePing: config.rolePing,
    ...fields,
  };
}

function apply(template: string, fields: MergeFields): { text: string; missing: string[] } {
  return fillMerge(template, fields);
}

export function renderEmail(
  id: string,
  fields: MergeFields,
  options?: { config?: Partial<AcademyCommsConfig>; footer?: FooterKind },
): { ok: true; email: RenderedEmail } | RenderFailure {
  const template = emailTemplate(id);
  if (!template) return { ok: false, missing: [`unknown email ${id}`], violations: [] };
  const config = resolveCommsConfig(options?.config);
  const merged = defaults(fields, config);
  const subject = apply(template.subject, merged);
  const preheader = apply(template.preheader, merged);
  const body = apply(template.body, merged);
  const missing = [...subject.missing, ...preheader.missing, ...body.missing];
  const signoff =
    template.signoff === 'automated'
      ? automatedSignature()
      : template.signoff === 'personal'
        ? personalSignature(merged.senderName || config.senderName)
        : '';
  const message = signoff ? `${body.text.trim()}\n\n${signoff}` : body.text.trim();
  const footer = footerText(options?.footer ?? template.footer, config, merged);
  missing.push(...footer.missing);
  const text = `${message}\n\n${footer.text}`;
  const violations = safetyViolations('email', text, template.id);
  if (missing.length > 0 || violations.length > 0) {
    return { ok: false, missing: [...new Set(missing)], violations };
  }
  const href = primaryUrl(message, [merged.link, merged.pulseLink, merged.certificateLink, merged.adminLink, merged.verifyLink]);
  const html = renderAcademyHtml({
    subject: subject.text,
    preheader: preheader.text,
    message,
    footer: footer.text,
    href,
    button: href ? buttonLabel(message, href) : null,
  });
  return {
    ok: true,
    email: {
      id: template.id,
      subject: subject.text,
      preheader: preheader.text,
      html,
      text,
      fromName: template.personalFrom ? `${merged.senderName || config.senderName} at ${config.fromName}` : config.fromName,
      fromAddress: config.fromAddress,
      replyTo: config.replyTo,
    },
  };
}

export function renderDiscord(
  id: string,
  fields: MergeFields,
  options?: { config?: Partial<AcademyCommsConfig>; channel?: string },
): { ok: true; channel: string; text: string } | RenderFailure {
  const alert = discordAlert(id);
  if (!alert) return { ok: false, missing: [`unknown discord ${id}`], violations: [] };
  const config = resolveCommsConfig(options?.config);
  const filled = apply(alert.body, defaults(fields, config));
  const violations = safetyViolations('discord', filled.text, alert.id);
  if (filled.missing.length > 0 || violations.length > 0) {
    return { ok: false, missing: filled.missing, violations };
  }
  return { ok: true, channel: options?.channel ?? alert.channel, text: filled.text };
}

export function renderSms(
  id: string,
  fields: MergeFields,
  options?: { config?: Partial<AcademyCommsConfig> },
): { ok: true; text: string } | RenderFailure {
  const template = smsTemplate(id);
  if (!template) return { ok: false, missing: [`unknown sms ${id}`], violations: [] };
  const config = resolveCommsConfig(options?.config);
  const filled = apply(template.body, defaults(fields, config));
  const violations = safetyViolations('sms', filled.text, template.id);
  if (filled.missing.length > 0 || violations.length > 0) {
    return { ok: false, missing: filled.missing, violations };
  }
  return { ok: true, text: filled.text };
}
