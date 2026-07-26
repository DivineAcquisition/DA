import type {
  DeliveryAttempt,
  Notification,
  NotificationChannel,
  NotificationSeverity,
  Operator,
} from '../types';

/**
 * One notification engine, four channels. Severity decides routing, and every
 * send attempt is logged with its status — when a placement is going wrong, the
 * question is always whether the operator was actually told.
 */

export const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  'in-app': 'In-app',
  discord: 'Discord',
  email: 'Email',
  whatsapp: 'WhatsApp',
};

export const SEVERITY_LABELS: Record<NotificationSeverity, string> = {
  informational: 'Informational',
  important: 'Important',
  urgent: 'Urgent',
};

/** Routing table. WhatsApp is reserved for urgent so it keeps its weight. */
export const SEVERITY_ROUTING: Record<NotificationSeverity, NotificationChannel[]> = {
  informational: ['in-app', 'discord'],
  important: ['in-app', 'discord', 'email'],
  urgent: ['in-app', 'discord', 'email', 'whatsapp'],
};

/** Fallback order when a channel fails. WhatsApp is the final backup. */
export const FALLBACK_ORDER: NotificationChannel[] = ['in-app', 'discord', 'email', 'whatsapp'];

/**
 * Resolves which channels a notification goes to.
 *
 * An operator's preferred channel is honoured by moving it to the front, but an
 * urgent notification ignores preference entirely and goes everywhere.
 */
export function resolveChannels(
  severity: NotificationSeverity,
  operator: Pick<Operator, 'preferredChannel'>,
): NotificationChannel[] {
  const routed = SEVERITY_ROUTING[severity];
  if (severity === 'urgent') return [...FALLBACK_ORDER];

  const preferred = operator.preferredChannel;
  if (!routed.includes(preferred)) return [...routed];

  return [preferred, ...routed.filter((channel) => channel !== preferred)];
}

export type ChannelTransport = (
  channel: NotificationChannel,
  notification: Pick<Notification, 'severity' | 'title' | 'body'>,
) => { ok: boolean; detail?: string };

/**
 * Attempts delivery across the routed channels, then walks the fallback order if
 * everything routed failed. Channels outside the routing table are recorded as
 * skipped rather than omitted, so the log explains itself.
 */
export function deliver(
  notification: Pick<Notification, 'severity' | 'title' | 'body'>,
  operator: Pick<Operator, 'preferredChannel'>,
  transport: ChannelTransport,
  at: string,
): DeliveryAttempt[] {
  const channels = resolveChannels(notification.severity, operator);
  const attempts: DeliveryAttempt[] = [];
  let anyDelivered = false;

  for (const channel of channels) {
    const result = transport(channel, notification);
    attempts.push({
      channel,
      status: result.ok ? 'delivered' : 'failed',
      attemptedAt: at,
      detail: result.detail ?? null,
    });
    if (result.ok) anyDelivered = true;
  }

  if (!anyDelivered) {
    const remaining = FALLBACK_ORDER.filter((channel) => !channels.includes(channel));
    for (const channel of remaining) {
      const result = transport(channel, notification);
      attempts.push({
        channel,
        status: result.ok ? 'delivered' : 'failed',
        attemptedAt: at,
        detail: result.detail ?? 'Fallback after all routed channels failed.',
      });
      if (result.ok) break;
    }
  }

  for (const channel of FALLBACK_ORDER) {
    if (!attempts.some((attempt) => attempt.channel === channel)) {
      attempts.push({
        channel,
        status: 'skipped',
        attemptedAt: at,
        detail: `Not routed for ${SEVERITY_LABELS[notification.severity].toLowerCase()} severity.`,
      });
    }
  }

  return attempts;
}

export function wasReceived(notification: Notification): boolean {
  return notification.attempts.some((attempt) => attempt.status === 'delivered');
}

export function deliveredChannels(notification: Notification): NotificationChannel[] {
  return notification.attempts
    .filter((attempt) => attempt.status === 'delivered')
    .map((attempt) => attempt.channel);
}

/** Severity a system-raised event carries, kept in one place so it stays consistent. */
export const EVENT_SEVERITY = {
  taskAssigned: 'informational',
  eodReminder: 'informational',
  eodComment: 'informational',
  bookingApproved: 'informational',
  bookingRejected: 'important',
  belowResponseStandard: 'important',
  quotaWarning: 'important',
  placementExpiring: 'important',
  missedEod: 'urgent',
  escalationUnanswered: 'urgent',
  shiftCoverageGap: 'urgent',
} as const satisfies Record<string, NotificationSeverity>;
