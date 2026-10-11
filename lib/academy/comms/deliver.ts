import type { AcademyCommsConfig } from './config';
import { resolveCommsConfig } from './config';
import type { AcademyEvent } from './events';
import { academyEvent } from './events';
import type { MergeFields } from './fields';
import { renderDiscord, renderEmail, renderSms, type RenderedEmail } from './render';
import { isQuietHours, nextWindow, nudgeBlock } from './rules';

export type PlannedItem = {
  channel: 'email' | 'discord' | 'sms' | 'in_app';
  templateId: string;
  action: 'send' | 'defer' | 'skip' | 'redirect';
  reason: string;
  notBefore?: string;
  email?: RenderedEmail;
  discord?: { channel: string; text: string };
  sms?: { text: string };
  to?: string;
};

export type DeliveryInput = {
  fields?: MergeFields;
  now?: Date;
  config?: Partial<AcademyCommsConfig>;
  status?: string;
  agreementSigned?: boolean;
  timeZone?: string;
  livePlacement?: boolean;
  smsOptIn?: boolean;
  smsStopped?: boolean;
  clientContactEnabled?: boolean;
  unansweredNudges?: number;
  lastNudgeAt?: string | null;
  alreadySent?: boolean;
  approved?: boolean;
  emailFallback?: boolean;
  due?: boolean;
  variant?: 'approved';
};

function defer(channel: PlannedItem['channel'], templateId: string, reason: string, notBefore: Date): PlannedItem {
  return { channel, templateId, action: 'defer', reason, notBefore: notBefore.toISOString() };
}

function skip(channel: PlannedItem['channel'], templateId: string, reason: string): PlannedItem {
  return { channel, templateId, action: 'skip', reason };
}

export function planDelivery(key: string, input: DeliveryInput = {}): { event: AcademyEvent; items: PlannedItem[] } | { error: string } {
  const event = academyEvent(key);
  if (!event) return { error: `Unknown event ${key}` };
  const config = resolveCommsConfig(input.config);
  const now = input.now ?? new Date();
  const timeZone = input.timeZone || config.timeZone;
  const fields = input.fields ?? {};
  const items: PlannedItem[] = [];

  if (event.gate === 'client' && !(config.clientContactEnabled && input.clientContactEnabled)) {
    return { event, items: [skip('email', event.email ?? 'C', 'client_contact_disabled')] };
  }
  if (event.gate === 'module_complete' && !config.moduleCompleteEmailEnabled) {
    return {
      event,
      items: [
        ...(event.inApp ? [{ channel: 'in_app' as const, templateId: event.inApp, action: 'send' as const, reason: 'show' }] : []),
        skip('email', event.email ?? 'B06', 'module_complete_disabled'),
      ],
    };
  }
  if (event.gate === 'sign_in_alert' && !config.newSignInAlerts) {
    return { event, items: [skip('email', event.email ?? 'I07', 'sign_in_alerts_disabled')] };
  }
  if (event.manual && !input.approved) {
    const held: PlannedItem[] = [];
    if (event.email) held.push(defer('email', event.email, 'manual_approval', now));
    if (event.discord) held.push(defer('discord', event.discord, 'manual_approval', now));
    return { event, items: held };
  }
  if (event.once && input.alreadySent) {
    return { event, items: [skip(event.email ? 'email' : 'discord', event.email ?? event.discord ?? key, 'already_sent')] };
  }
  if (event.nudge) {
    const reason = nudgeBlock({
      status: input.status,
      agreementSigned: input.agreementSigned,
      unansweredNudges: input.unansweredNudges,
      lastNudgeAt: input.lastNudgeAt,
      now,
    });
    if (reason) {
      return {
        event,
        items: [
          ...(event.email ? [skip('email', event.email, reason)] : []),
          ...(event.sms ? [skip('sms', event.sms, reason)] : []),
        ],
      };
    }
  }

  if (event.inApp) items.push({ channel: 'in_app', templateId: event.inApp, action: 'send', reason: 'show' });

  const emailId = event.key === 'practical_reviewed' && input.variant === 'approved' ? 'B07-approved' : event.email;
  if (emailId) items.push(planEmail(event, emailId, fields, config, input, now, timeZone));
  if (event.discord) items.push(planDiscord(event, fields, config, input, now));
  if (event.sms) items.push(planSms(event, fields, config, input, now, timeZone));

  return { event, items };
}

function planEmail(
  event: AcademyEvent,
  emailId: string,
  fields: MergeFields,
  config: AcademyCommsConfig,
  input: DeliveryInput,
  now: Date,
  timeZone: string,
): PlannedItem {
  if (event.emailFallback && !input.emailFallback) return skip('email', emailId, 'discord_primary');
  if (event.timing === 'fixed' && !input.due) return defer('email', emailId, 'fixed_time', now);
  const footer = event.audience === 'client' ? 'client' : undefined;
  const rendered = renderEmail(emailId, fields, { config, footer });
  if (!rendered.ok) return skip('email', emailId, rendered.missing.length ? 'missing_fields' : 'unsafe');
  if (event.timing === 'allowed_hours' && isQuietHours(now, timeZone)) {
    return defer('email', emailId, 'quiet_hours', nextWindow(now, timeZone, 'waking'));
  }
  if (event.timing === 'business_hours') {
    const when = nextWindow(now, timeZone, 'business');
    if (when.getTime() !== now.getTime()) return defer('email', emailId, 'business_hours', when);
  }
  if (config.testMode) {
    if (!config.testEmail) return skip('email', emailId, 'test_address_missing');
    return { channel: 'email', templateId: emailId, action: 'redirect', reason: 'test_mode', email: rendered.email, to: config.testEmail };
  }
  return { channel: 'email', templateId: emailId, action: 'send', reason: 'ready', email: rendered.email };
}

function planDiscord(
  event: AcademyEvent,
  fields: MergeFields,
  config: AcademyCommsConfig,
  input: DeliveryInput,
  now: Date,
): PlannedItem {
  const id = event.discord!;
  if (event.timing === 'fixed' && !event.email && !input.due) return defer('discord', id, 'fixed_time', now);
  const channel = config.testMode ? config.testDiscordChannel : undefined;
  const rendered = renderDiscord(id, fields, { config, channel });
  if (!rendered.ok) return skip('discord', id, rendered.missing.length ? 'missing_fields' : 'unsafe');
  if (config.testMode) {
    return { channel: 'discord', templateId: id, action: 'redirect', reason: 'test_mode', discord: { channel: rendered.channel, text: rendered.text } };
  }
  return { channel: 'discord', templateId: id, action: 'send', reason: 'ready', discord: { channel: rendered.channel, text: rendered.text } };
}

function planSms(
  event: AcademyEvent,
  fields: MergeFields,
  config: AcademyCommsConfig,
  input: DeliveryInput,
  now: Date,
  timeZone: string,
): PlannedItem {
  const id = event.sms!;
  if (config.testMode) return skip('sms', id, 'test_mode');
  if (!config.smsEnabled) return skip('sms', id, 'sms_disabled');
  if (input.smsStopped) return skip('sms', id, 'sms_stopped');
  if (!input.smsOptIn) return skip('sms', id, 'sms_no_consent');
  const when = nextWindow(now, timeZone, 'sms', Boolean(input.livePlacement));
  if (when.getTime() !== now.getTime()) return defer('sms', id, 'sms_window', when);
  const rendered = renderSms(id, fields, { config });
  if (!rendered.ok) return skip('sms', id, rendered.missing.length ? 'missing_fields' : 'unsafe');
  return { channel: 'sms', templateId: id, action: 'send', reason: 'ready', sms: { text: rendered.text } };
}
