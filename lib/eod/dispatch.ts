import { idempotencyKey } from '@/lib/email/policy';
import { sendAppEmail, type SendAppEmailResult } from '@/lib/email/service';
import { serviceRoleClient, type UntypedClient } from '@/lib/workspace/db';
import { eodLetter, type EodMailPayload } from './mail';

type MailRow = { id: string; eod_id: string; kind: string; payload: EodMailPayload };

const DONE = new Set(['sent', 'delivered', 'blocked', 'suppressed', 'delayed']);

/**
 * Run the deadline sweep, then send every queued end-of-day letter.
 * Safe to call every minute. A row is sent once.
 */
export async function dispatchEodMail(): Promise<{ ok: boolean; sent: number; queued: number; error?: string }> {
  const db = serviceRoleClient();
  if (!db) return { ok: false, sent: 0, queued: 0, error: 'SUPABASE_SERVICE_ROLE_KEY is required' };

  const sweep = await db.rpc('so_eod_sweep');
  const claimed = await db.rpc('so_eod_mail_claim', { p_limit: 20 });
  if (claimed.error) {
    return { ok: false, sent: 0, queued: 0, error: claimed.error.message };
  }
  const rows = mailRows(claimed.data);
  let sent = 0;
  let error = sweep.error?.message;
  for (const row of rows) {
    try {
      const ok = await sendRow(db, row);
      if (ok) sent += 1;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Send failed';
      await db.rpc('so_eod_mail_finish', { p_id: row.id, p_ok: false });
    }
  }
  return { ok: !sweep.error && !error, sent, queued: rows.length, error };
}

function mailRows(data: unknown): MailRow[] {
  const value = typeof data === 'string' ? safeJson(data) : data;
  return Array.isArray(value) ? (value as MailRow[]) : [];
}

function safeJson(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function sendRow(db: UntypedClient, row: MailRow): Promise<boolean> {
  const payload = row.payload ?? {};
  const letter = eodLetter(row.kind, payload);
  if (letter.to.length === 0) {
    await db.rpc('so_eod_mail_finish', { p_id: row.id, p_ok: true });
    return false;
  }
  const result: SendAppEmailResult = await sendAppEmail({
    purpose: letter.purpose,
    to: letter.to,
    subject: letter.subject,
    html: letter.html,
    text: letter.text,
    template: row.kind,
    idempotencyKey: idempotencyKey(['eod-mail', row.id]),
    event: row.kind,
    related: {
      eodId: row.eod_id,
      operatorId: textId(payload.operator_id),
      placementId: textId(payload.placement_id),
      clientId: textId(payload.case_file_id),
    },
    payload: { kind: row.kind, workDate: payload.work_date ?? null },
  });
  const finished = DONE.has(result.status);
  await db.rpc('so_eod_mail_finish', { p_id: row.id, p_ok: finished });
  return finished;
}

function textId(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}
