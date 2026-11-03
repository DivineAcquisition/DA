import { EMAIL_IDENTITY_DEFAULTS, OPERATIONS_CC, formatFrom, identityFromRow, type EmailIdentity } from './identity';
import {
  EMAIL_PURPOSES,
  backoffMs,
  blockedRecipients,
  cronBackoffMs,
  deliveryMode,
  isEmail,
  parseAllowlist,
  retryableStatus,
  safeError,
  uniqueEmails,
  type EmailPurpose,
  type EmailStatus,
} from './policy';
import type { UntypedClient } from '@/lib/workspace/db';

const MAX_ATTEMPTS = 8;
const IN_REQUEST_TRIES = 4;
const MIN_GAP_MS = 500;

export type EmailAttachment = { filename: string; content: Buffer };

export type EmailRelation = {
  operatorId?: string | null;
  eodId?: string | null;
  reportId?: string | null;
  clientId?: string | null;
  placementId?: string | null;
  relatedType?: string | null;
  relatedId?: string | null;
};

export type SendAppEmailInput = {
  purpose: EmailPurpose;
  to: string | string[];
  cc?: string[];
  /** Set to override the purpose reply-to. Null means no reply-to. */
  replyTo?: string | null;
  subject: string;
  html: string;
  text: string;
  template: string;
  idempotencyKey: string;
  event: string;
  related?: EmailRelation;
  /** Data needed to understand the send. Do not put the body, tokens, or secrets here. */
  payload?: Record<string, unknown>;
  attachments?: EmailAttachment[];
};

export type SendAppEmailResult = {
  ok: boolean;
  status: EmailStatus;
  id: string | null;
  logId: string | null;
  error?: string;
};

export class EmailNotSent extends Error {
  constructor(readonly result: SendAppEmailResult) {
    super(result.error || result.status);
    this.name = 'EmailNotSent';
  }
}

export function requireSent(result: SendAppEmailResult): { id: string } {
  if (!result.ok || !result.id) throw new EmailNotSent(result);
  return { id: result.id };
}

type StoredEmail = {
  id: string;
  purpose: EmailPurpose;
  status: EmailStatus;
  sender: string;
  replyTo: string | null;
  recipients: string[];
  cc: string[];
  subject: string;
  template: string;
  event: string;
  idempotencyKey: string;
  resendId: string | null;
  error: string | null;
  attemptCount: number;
  reportId: string | null;
  payload: Record<string, unknown>;
};

type Outbox = { html: string; text: string; attachments: { filename: string; content: string }[] };

export type EmailTransportResult = { id?: string; error?: string; statusCode?: number };

export type EmailTransport = (message: {
  from: string;
  to: string[];
  cc: string[];
  replyTo: string | null;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
  attachments: EmailAttachment[];
  tags: { name: string; value: string }[];
}) => Promise<EmailTransportResult>;

type EmailStore = {
  findByKey(key: string): Promise<StoredEmail | null>;
  insert(row: Record<string, unknown>): Promise<StoredEmail | 'duplicate'>;
  update(id: string, patch: Record<string, unknown>): Promise<void>;
  saveOutbox(id: string, outbox: Outbox): Promise<void>;
  clearOutbox(id: string): Promise<void>;
  suppressed(emails: string[]): Promise<Set<string>>;
  loadIdentities(): Promise<EmailIdentity[]>;
};

export type SendDeps = {
  env?: Record<string, string | undefined>;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
  transport?: EmailTransport;
  store?: EmailStore;
  pace?: boolean;
  alertSuppressed?: (info: { email: string; logId: string; reason: string }) => Promise<void>;
  alertGaveUp?: (info: { logId: string; subject: string; error: string }) => Promise<void>;
};

const FINISHED = new Set<EmailStatus>(['sent', 'delivered', 'bounced', 'complained', 'delayed']);

let paceChain: Promise<void> = Promise.resolve();
let lastSendAt = 0;

async function paceSend(sleep: (ms: number) => Promise<void>) {
  const run = paceChain.then(async () => {
    const wait = Math.max(0, lastSendAt + MIN_GAP_MS - Date.now());
    if (wait > 0) await sleep(wait);
    lastSendAt = Date.now();
  });
  paceChain = run.then(() => undefined, () => undefined);
  return run;
}

function asPurpose(value: string): EmailPurpose {
  return EMAIL_PURPOSES.includes(value as EmailPurpose) ? (value as EmailPurpose) : 'team';
}

function rowFromDb(row: Record<string, unknown>): StoredEmail {
  return {
    id: String(row.id),
    purpose: asPurpose(String(row.purpose)),
    status: String(row.status) as EmailStatus,
    sender: String(row.sender ?? ''),
    replyTo: (row.reply_to as string | null) ?? null,
    recipients: (row.recipients as string[]) ?? [],
    cc: (row.cc as string[]) ?? [],
    subject: String(row.subject ?? ''),
    template: String(row.template ?? ''),
    event: String(row.event ?? ''),
    idempotencyKey: String(row.idempotency_key ?? ''),
    resendId: (row.resend_id as string | null) ?? null,
    error: (row.error as string | null) ?? null,
    attemptCount: Number(row.attempt_count ?? 0),
    reportId: (row.report_id as string | null) ?? null,
    payload: (row.payload as Record<string, unknown>) ?? {},
  };
}

function resultFrom(row: StoredEmail): SendAppEmailResult {
  const ok = row.status === 'sent' || row.status === 'delivered' || row.status === 'delayed';
  return {
    ok,
    status: row.status,
    id: row.resendId,
    logId: row.id,
    error: row.error ?? undefined,
  };
}

function cleanPayload(payload: Record<string, unknown> | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload ?? {})) {
    if (/html|text|body|token|password|secret|key/i.test(key)) continue;
    out[key] = value;
  }
  return out;
}

async function db(): Promise<UntypedClient> {
  const { serviceRoleClient } = await import('@/lib/workspace/db');
  const client = serviceRoleClient();
  if (!client) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required to send email');
  return client;
}

function supabaseStore(): EmailStore {
  return {
    async findByKey(key) {
      const client = await db();
      const { data, error } = await client.from('email_log').select('*').eq('idempotency_key', key).maybeSingle();
      if (error) throw new Error(safeError(error.message));
      return data ? rowFromDb(data as Record<string, unknown>) : null;
    },
    async insert(row) {
      const client = await db();
      const { data, error } = await client.from('email_log').insert(row).select('*').single();
      if (error?.code === '23505') return 'duplicate';
      if (error || !data) throw new Error(safeError(error?.message || 'Could not record the email'));
      return rowFromDb(data as Record<string, unknown>);
    },
    async update(id, patch) {
      const client = await db();
      const { error } = await client.from('email_log').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw new Error(safeError(error.message));
    },
    async saveOutbox(id, outbox) {
      const client = await db();
      const { error } = await client.from('email_outbox').upsert({
        log_id: id,
        html: outbox.html,
        text_body: outbox.text,
        attachments: outbox.attachments,
      });
      if (error) throw new Error(safeError(error.message));
    },
    async clearOutbox(id) {
      const client = await db();
      await client.from('email_outbox').delete().eq('log_id', id);
    },
    async suppressed(emails) {
      if (!emails.length) return new Set<string>();
      const client = await db();
      const { data, error } = await client
        .from('email_suppression')
        .select('email')
        .is('lifted_at', null)
        .in('email', emails);
      if (error) throw new Error(safeError(error.message));
      return new Set((data ?? []).map((row: { email: string }) => row.email.toLowerCase()));
    },
    async loadIdentities() {
      const client = await db();
      const { data, error } = await client.from('email_identity').select('purpose, display_name, address, reply_to');
      if (error || !data) return [];
      return (data as Record<string, unknown>[])
        .map((row) => identityFromRow(row as { purpose: string }))
        .filter((row): row is EmailIdentity => Boolean(row));
    },
  };
}

function resendTransport(env: Record<string, string | undefined>): EmailTransport {
  const key = env.RESEND_API_KEY?.trim();
  if (!key) {
    return async () => ({ error: 'RESEND_API_KEY is not configured', statusCode: 401 });
  }
  return async (message) => {
    const { Resend } = await import('resend');
    const resend = new Resend(key);
    const { data, error } = await resend.emails.send(
      {
        from: message.from,
        to: message.to,
        ...(message.cc.length ? { cc: message.cc } : {}),
        ...(message.replyTo ? { replyTo: message.replyTo } : {}),
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(message.attachments.length
          ? { attachments: message.attachments.map((file) => ({ filename: file.filename, content: file.content })) }
          : {}),
        tags: message.tags,
      },
      { idempotencyKey: message.idempotencyKey },
    );
    if (error || !data?.id) {
      const statusCode = 'statusCode' in (error ?? {}) ? Number((error as { statusCode?: number }).statusCode) : undefined;
      return { error: safeError(error?.message || 'Resend did not return an email id'), statusCode };
    }
    return { id: data.id };
  };
}

function resolveIdentity(purpose: EmailPurpose, loaded: EmailIdentity[]): EmailIdentity {
  const fallback = EMAIL_IDENTITY_DEFAULTS[purpose];
  const row = loaded.find((item) => item.purpose === purpose);
  return row ?? fallback;
}

export async function loadEmailIdentity(purpose: EmailPurpose): Promise<EmailIdentity> {
  try {
    const loaded = await supabaseStore().loadIdentities();
    return resolveIdentity(purpose, loaded);
  } catch {
    return EMAIL_IDENTITY_DEFAULTS[purpose];
  }
}

export async function sendAppEmail(input: SendAppEmailInput, deps: SendDeps = {}): Promise<SendAppEmailResult> {
  const env = deps.env ?? process.env;
  const sleep = deps.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const now = deps.now ?? (() => new Date());
  const store = deps.store ?? supabaseStore();
  const transport = deps.transport ?? resendTransport(env);
  const pace = deps.pace !== false;
  const productionAlerts = deps.store == null;
  const alertSuppressed =
    deps.alertSuppressed ??
    (productionAlerts
      ? async (info: { email: string; logId: string; reason: string }) => {
          const { notifySuppression } = await import('./alerts');
          await notifySuppression(info);
        }
      : async () => {});
  const alertGaveUp =
    deps.alertGaveUp ??
    (productionAlerts
      ? async (info: { logId: string; subject: string; error: string }) => {
          const { notifyGaveUp } = await import('./alerts');
          await notifyGaveUp(info);
        }
      : async () => {});

  const to = uniqueEmails(Array.isArray(input.to) ? input.to : [input.to]).filter(isEmail);
  const cc = uniqueEmails([...(input.cc ?? []), ...(input.purpose === 'team' ? [OPERATIONS_CC] : [])]).filter(
    (email) => isEmail(email) && !to.includes(email),
  );
  const loaded = await store.loadIdentities().catch(() => [] as EmailIdentity[]);
  const identity = resolveIdentity(input.purpose, loaded);
  const replyTo =
    input.replyTo === null
      ? null
      : input.replyTo?.trim().toLowerCase() || (identity.purpose === 'security' ? null : identity.replyTo);
  const sender = formatFrom(identity);
  const mode = deliveryMode(env);

  let row = await store.findByKey(input.idempotencyKey);
  if (row && (FINISHED.has(row.status) || row.status === 'suppressed')) return resultFrom(row);
  if (row?.status === 'blocked' && mode !== 'live') {
    const stillBlocked = blockedRecipients([...to, ...cc], mode, parseAllowlist(env));
    if (stillBlocked.length || to.length === 0) return resultFrom(row);
  }

  if (!row) {
    const inserted = await store.insert({
      purpose: input.purpose,
      status: 'queued',
      sender,
      reply_to: replyTo,
      recipient: to.join(', ') || '(none)',
      recipients: to,
      cc,
      subject: input.subject,
      template: input.template,
      event: input.event,
      idempotency_key: input.idempotencyKey,
      operator_id: input.related?.operatorId ?? null,
      eod_id: input.related?.eodId ?? null,
      report_id: input.related?.reportId ?? null,
      client_id: input.related?.clientId ?? null,
      placement_id: input.related?.placementId ?? null,
      related_type: input.related?.relatedType ?? null,
      related_id: input.related?.relatedId ?? null,
      payload: cleanPayload(input.payload),
      attempt_count: 0,
      queued_at: now().toISOString(),
    });
    if (inserted === 'duplicate') {
      row = await store.findByKey(input.idempotencyKey);
      if (row && (FINISHED.has(row.status) || row.status === 'suppressed')) return resultFrom(row);
    } else {
      row = inserted;
    }
  }
  if (!row) return { ok: false, status: 'failed', id: null, logId: null, error: 'Could not record the email' };

  if (!to.length) {
    await store.update(row.id, { status: 'failed', error: 'Add a valid recipient', failed_at: now().toISOString() });
    return { ok: false, status: 'failed', id: null, logId: row.id, error: 'Add a valid recipient' };
  }

  const blocked = blockedRecipients([...to, ...cc], mode, parseAllowlist(env));
  if (blocked.length) {
    const error = `Blocked outside production: ${blocked.join(', ')}`;
    await store.update(row.id, { status: 'blocked', error, sender, reply_to: replyTo });
    return { ok: false, status: 'blocked', id: null, logId: row.id, error };
  }

  const suppressed = await store.suppressed([...to, ...cc]);
  const blockedTo = to.filter((email) => suppressed.has(email));
  if (blockedTo.length) {
    const error = `Suppressed: ${blockedTo.join(', ')}`;
    await store.update(row.id, { status: 'suppressed', error, sender, reply_to: replyTo });
    if (!input.event.startsWith('suppression.alert')) {
      await alertSuppressed({ email: blockedTo[0], logId: row.id, reason: 'already suppressed' });
    }
    return { ok: false, status: 'suppressed', id: null, logId: row.id, error };
  }
  const ccOk = cc.filter((email) => !suppressed.has(email));

  const attachments = (input.attachments ?? []).filter((file) => file.content.byteLength <= 8_000_000);
  await store.saveOutbox(row.id, {
    html: input.html,
    text: input.text,
    attachments: attachments.map((file) => ({ filename: file.filename, content: file.content.toString('base64') })),
  });

  let lastError = 'Email failed';
  let statusCode: number | undefined;
  let tries = 0;
  for (let attempt = 0; attempt < IN_REQUEST_TRIES; attempt += 1) {
    tries += 1;
    if (pace) await paceSend(sleep);
    if (attempt > 0) await sleep(backoffMs(attempt - 1));
    const sent = await transport({
      from: sender,
      to,
      cc: ccOk,
      replyTo,
      subject: input.subject,
      html: input.html,
      text: input.text,
      idempotencyKey: input.idempotencyKey,
      attachments,
      tags: [
        { name: 'purpose', value: input.purpose },
        { name: 'template', value: input.template.slice(0, 40).replace(/[^\w.-]/g, '_') || 'email' },
      ],
    });
    if (sent.id) {
      await store.update(row.id, {
        status: 'sent',
        resend_id: sent.id,
        sender,
        reply_to: replyTo,
        error: null,
        sent_at: now().toISOString(),
        attempt_count: row.attemptCount + tries,
        next_attempt_at: null,
      });
      await store.clearOutbox(row.id);
      return { ok: true, status: 'sent', id: sent.id, logId: row.id };
    }
    lastError = safeError(sent.error || 'Email failed');
    statusCode = sent.statusCode;
    if (!retryableStatus(statusCode)) break;
  }

  const attemptCount = row.attemptCount + tries;
  const gaveUp = attemptCount >= MAX_ATTEMPTS || !retryableStatus(statusCode);
  await store.update(row.id, {
    status: 'failed',
    error: lastError,
    sender,
    reply_to: replyTo,
    attempt_count: attemptCount,
    failed_at: now().toISOString(),
    next_attempt_at: gaveUp ? null : new Date(now().getTime() + cronBackoffMs(attemptCount)).toISOString(),
  });
  if (gaveUp && !input.event.startsWith('suppression.alert') && input.event !== 'email.gave_up') {
    await alertGaveUp({ logId: row.id, subject: input.subject, error: lastError });
  }
  return { ok: false, status: 'failed', id: null, logId: row.id, error: lastError };
}

export async function retryEmailLog(logId: string, deps: SendDeps = {}): Promise<SendAppEmailResult> {
  const client = await db();
  const { data, error } = await client.from('email_log').select('*').eq('id', logId).maybeSingle();
  if (error || !data) return { ok: false, status: 'failed', id: null, logId, error: 'That email is not in the log' };
  const row = rowFromDb(data as Record<string, unknown>);
  if (row.status !== 'failed' && row.status !== 'queued') {
    return resultFrom(row);
  }
  const outbox = await client.from('email_outbox').select('html, text_body, attachments').eq('log_id', logId).maybeSingle();
  const body = outbox.data as { html?: string; text_body?: string; attachments?: { filename: string; content: string }[] } | null;
  if (!body?.html || !body.text_body) {
    return { ok: false, status: 'failed', id: null, logId, error: 'This email cannot be retried because its content was not kept' };
  }
  await client.from('email_log').update({ status: 'queued', error: null, next_attempt_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', logId);
  return sendAppEmail(
    {
      purpose: row.purpose,
      to: row.recipients,
      cc: row.cc,
      replyTo: row.replyTo,
      subject: row.subject,
      html: body.html,
      text: body.text_body,
      template: row.template,
      idempotencyKey: row.idempotencyKey,
      event: row.event,
      related: { reportId: row.reportId },
      payload: row.payload,
      attachments: (body.attachments ?? []).map((file) => ({ filename: file.filename, content: Buffer.from(file.content, 'base64') })),
    },
    deps,
  );
}
