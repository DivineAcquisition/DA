/**
 * Turns raw GHL records into operator counts. Pure: no network, no message
 * bodies. Only the mapped user's own manual activity counts.
 */

export type GhlTouch = {
  id: string;
  contactId: string;
  at: string;
  kind: 'call' | 'text' | 'email';
  direction: 'inbound' | 'outbound';
  userId: string | null;
  /** workflow, automation, campaign, bulk, or app. Manual user activity is null or "app". */
  source: string | null;
  durationSeconds?: number | null;
  answered?: boolean;
};

export type CountOptions = {
  userId: string;
  connectSeconds: number;
  conversationSeconds: number;
  replyWindowDays: number;
  recoveryWindowDays: number;
};

export type CountLine = { metric: string; contactId: string; ghlId: string; at: string };

const AUTO = /workflow|automation|campaign|bulk/i;

export function isManualUserActivity(touch: GhlTouch, userId: string): boolean {
  if (!touch.userId || touch.userId !== userId) return false;
  if (touch.source && AUTO.test(touch.source)) return false;
  return true;
}

export function countTouches(touches: GhlTouch[], options: CountOptions): CountLine[] {
  const lines: CountLine[] = [];
  const outbound = touches.filter((touch) => isManualUserActivity(touch, options.userId) && touch.direction === 'outbound');

  for (const touch of outbound) {
    if (touch.kind === 'call') {
      lines.push({ metric: 'dials_made', contactId: touch.contactId, ghlId: touch.id, at: touch.at });
      const seconds = touch.durationSeconds ?? 0;
      const answered = touch.answered === true || seconds >= options.connectSeconds;
      if (answered && seconds >= options.connectSeconds) {
        lines.push({ metric: 'connects', contactId: touch.contactId, ghlId: touch.id, at: touch.at });
      }
      if (answered && seconds >= options.conversationSeconds) {
        lines.push({ metric: 'conversations_held', contactId: touch.contactId, ghlId: touch.id, at: touch.at });
      }
    }
    if (touch.kind === 'text') lines.push({ metric: 'texts_sent', contactId: touch.contactId, ghlId: touch.id, at: touch.at });
    if (touch.kind === 'email') lines.push({ metric: 'emails_sent', contactId: touch.contactId, ghlId: touch.id, at: touch.at });
  }

  const windowMs = options.replyWindowDays * 86_400_000;
  for (const touch of touches) {
    if (touch.direction !== 'inbound' || (touch.kind !== 'text' && touch.kind !== 'email')) continue;
    const at = Date.parse(touch.at);
    if (Number.isNaN(at)) continue;
    const sent = outbound.some((item) => {
      if (item.contactId !== touch.contactId || item.kind === 'call') return false;
      const when = Date.parse(item.at);
      return !Number.isNaN(when) && when <= at && at - when <= windowMs;
    });
    if (sent) lines.push({ metric: 'replies_received', contactId: touch.contactId, ghlId: touch.id, at: touch.at });
  }
  return lines;
}

/** Talk time is the sum of conversation seconds, stored as minutes. */
export function talkMinutes(lines: Pick<CountLine, 'metric' | 'ghlId'>[], touches: GhlTouch[]): number {
  const ids = new Set(lines.filter((line) => line.metric === 'conversations_held').map((line) => line.ghlId));
  const seconds = touches.filter((touch) => ids.has(touch.id)).reduce((sum, touch) => sum + (touch.durationSeconds ?? 0), 0);
  return Math.round((seconds / 60) * 100) / 100;
}

export function median(values: number[]): number | null {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

/** Shift pause: subtract minutes outside [start, end] on the lead's local calendar. Times are epoch ms. */
export function elapsedInsideShift(fromMs: number, toMs: number, shiftStart: string, shiftEnd: string, pauseOutside: boolean): number {
  if (!pauseOutside) return Math.max(0, Math.round((toMs - fromMs) / 1000));
  if (toMs <= fromMs) return 0;
  const [sh, sm] = shiftStart.split(':').map(Number);
  const [eh, em] = shiftEnd.split(':').map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  let seconds = 0;
  const day = 86_400_000;
  for (let cursor = fromMs; cursor < toMs; cursor += day) {
    const sliceEnd = Math.min(toMs, cursor + day);
    const start = new Date(cursor);
    const minutes = start.getUTCHours() * 60 + start.getUTCMinutes();
    const inShift = endMin > startMin ? minutes >= startMin && minutes < endMin : minutes >= startMin || minutes < endMin;
    if (inShift) seconds += Math.round((sliceEnd - cursor) / 1000);
  }
  return seconds;
}

export function isMismatch(operator: number, ghl: number, tolerancePct: number, smallUnder: number, smallGap: number): boolean {
  const gap = Math.abs(operator - ghl);
  const countLimit = Math.max(operator, ghl) < smallUnder ? smallGap : 0;
  const pctLimit = (Math.max(operator, ghl) * tolerancePct) / 100;
  return gap > Math.max(pctLimit, countLimit) && gap > 0;
}
