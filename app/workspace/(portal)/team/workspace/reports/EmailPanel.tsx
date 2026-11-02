import { controlRpc, readable } from '@/lib/ad/rpc';
import { statusLabel } from '@/lib/email/policy';
import { createClient } from '@/lib/supabase/server';
import ReportForm from './ReportForm';
import { liftSuppressionAction, retryEmailAction, saveEmailIdentityAction, sendEmailTestAction } from '@/lib/email/actions';

export type EmailQuery = {
  e_purpose?: string;
  e_status?: string;
  e_recipient?: string;
  e_from?: string;
  e_to?: string;
};

type LogRow = {
  id: string;
  purpose: string;
  status: string;
  sender: string;
  reply_to: string | null;
  recipient: string;
  subject: string;
  template: string;
  event: string;
  resend_id: string | null;
  error: string | null;
  attempt_count: number;
  created_at: string;
  sent_at: string | null;
  delivered_at: string | null;
};

type Identity = { purpose: string; display_name: string; address: string; reply_to: string | null };
type Suppression = { email: string; reason: string; detail: string | null; created_at: string };

const PURPOSES = ['security', 'team', 'alerts', 'client'] as const;
const STATUSES = ['queued', 'sent', 'delivered', 'delayed', 'bounced', 'complained', 'failed', 'suppressed', 'blocked'];
const LABELS: Record<string, string> = {
  security: 'Security and sign-in',
  team: 'Team and operator',
  alerts: 'Manager and admin alerts',
  client: 'Client mail',
};

function when(value: string | null): string {
  if (!value) return '';
  return new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default async function EmailPanel({ query }: { query: EmailQuery }) {
  const supabase = await createClient();
  const [log, identities, suppressed] = await Promise.all([
    controlRpc<LogRow[]>(supabase, 'email_log_list', {
      p_purpose: query.e_purpose ?? null,
      p_status: query.e_status ?? null,
      p_recipient: query.e_recipient ?? null,
      p_from: query.e_from || null,
      p_to: query.e_to || null,
    }),
    controlRpc<Identity[]>(supabase, 'email_identity_list', {}),
    controlRpc<Suppression[]>(supabase, 'email_suppression_list', {}),
  ]);
  const rows = identities.data ?? [];
  const replyTo = rows.find((row) => row.purpose === 'team')?.reply_to ?? '';

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-white">Email log</h2>
      <p className="text-sm text-neutral-400">Every app email. The body is not stored. DA Admin only.</p>
      {log.error ? <p className="text-sm text-[#FFB020]">{readable(log.error)}</p> : null}
      <form className="flex flex-wrap gap-2" method="get">
        <select name="e_purpose" defaultValue={query.e_purpose ?? ''} aria-label="Purpose" className="h-9 rounded-lg border border-white/10 bg-ink-950 px-2 text-sm">
          <option value="">All purposes</option>
          {PURPOSES.map((purpose) => <option key={purpose} value={purpose}>{LABELS[purpose]}</option>)}
        </select>
        <select name="e_status" defaultValue={query.e_status ?? ''} aria-label="Email status" className="h-9 rounded-lg border border-white/10 bg-ink-950 px-2 text-sm">
          <option value="">All statuses</option>
          {STATUSES.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
        </select>
        <input name="e_recipient" defaultValue={query.e_recipient ?? ''} placeholder="Recipient" aria-label="Recipient" className="h-9 rounded-lg border border-white/10 bg-ink-950 px-2 text-sm" />
        <input name="e_from" type="date" defaultValue={query.e_from ?? ''} aria-label="From date" className="h-9 rounded-lg border border-white/10 bg-ink-950 px-2 text-sm" />
        <input name="e_to" type="date" defaultValue={query.e_to ?? ''} aria-label="To date" className="h-9 rounded-lg border border-white/10 bg-ink-950 px-2 text-sm" />
        <button className="rounded-lg bg-white/10 px-3 text-sm" type="submit">Filter email</button>
      </form>
      <ul className="divide-y divide-white/10 rounded-2xl border border-white/10">
        {(log.data ?? []).map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
            <span>
              <span className="text-white">{row.subject}</span>
              <span className="mt-1 block text-neutral-400">
                {LABELS[row.purpose] ?? row.purpose} · {row.recipient} · {statusLabel(row.status)}
                {row.error ? ` · ${row.error}` : ''} · {when(row.delivered_at || row.sent_at || row.created_at)}
              </span>
              <span className="mt-1 block text-neutral-500">{row.sender} · {row.template} · {row.event}{row.resend_id ? ` · ${row.resend_id}` : ''}</span>
            </span>
            {row.status === 'failed' ? (
              <ReportForm action={retryEmailAction}>
                <input type="hidden" name="log_id" value={row.id} />
                <button className="text-brand-300" type="submit">Retry</button>
              </ReportForm>
            ) : null}
          </li>
        ))}
        {(log.data ?? []).length === 0 && !log.error ? <li className="px-4 py-3 text-sm text-neutral-400">No email matches.</li> : null}
      </ul>

      <h3 className="text-lg font-semibold text-white">Send a test to me</h3>
      <ReportForm action={sendEmailTestAction} className="flex flex-wrap items-center gap-2">
        <select name="purpose" aria-label="Test type" className="h-9 rounded-lg border border-white/10 bg-ink-950 px-2 text-sm">
          {PURPOSES.map((purpose) => <option key={purpose} value={purpose}>{LABELS[purpose]}</option>)}
        </select>
        <button className="rounded-lg bg-white/10 px-3 py-2 text-sm" type="submit">Send test</button>
      </ReportForm>

      <h3 className="text-lg font-semibold text-white">Senders</h3>
      {identities.error ? <p className="text-sm text-[#FFB020]">{readable(identities.error)}</p> : (
        <ReportForm action={saveEmailIdentityAction} className="space-y-3">
          {PURPOSES.map((purpose) => {
            const row = rows.find((item) => item.purpose === purpose);
            return (
              <div key={purpose} className="grid gap-2 rounded-xl border border-white/10 p-3 sm:grid-cols-3">
                <p className="text-sm text-white sm:col-span-3">{LABELS[purpose]}</p>
                <input name={`${purpose}_name`} defaultValue={row?.display_name ?? ''} aria-label={`${purpose} name`} className="h-9 rounded-lg border border-white/10 bg-ink-950 px-2 text-sm" />
                <input name={`${purpose}_address`} defaultValue={row?.address ?? ''} aria-label={`${purpose} address`} className="h-9 rounded-lg border border-white/10 bg-ink-950 px-2 text-sm sm:col-span-2" />
              </div>
            );
          })}
          <label className="block text-sm text-neutral-300">
            Reply-to for team, alerts, and client mail
            <input name="reply_to" defaultValue={replyTo} aria-label="Reply-to" className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-ink-950 px-2 text-sm" />
          </label>
          <button className="rounded-lg bg-white/10 px-3 py-2 text-sm" type="submit">Save senders</button>
        </ReportForm>
      )}

      <h3 className="text-lg font-semibold text-white">Suppression list</h3>
      {suppressed.error ? <p className="text-sm text-[#FFB020]">{readable(suppressed.error)}</p> : (
        <ul className="divide-y divide-white/10 rounded-2xl border border-white/10">
          {(suppressed.data ?? []).map((row) => (
            <li key={row.email} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <span>
                <span className="text-white">{row.email}</span>
                <span className="mt-1 block text-neutral-400">{row.reason}{row.detail ? ` · ${row.detail}` : ''}</span>
              </span>
              <ReportForm action={liftSuppressionAction} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="email" value={row.email} />
                <input name="reason" required minLength={3} placeholder="Why it can receive mail" aria-label={`Reason for ${row.email}`} className="h-9 rounded-lg border border-white/10 bg-ink-950 px-2 text-sm" />
                <button className="text-brand-300" type="submit">Remove</button>
              </ReportForm>
            </li>
          ))}
          {(suppressed.data ?? []).length === 0 ? <li className="px-4 py-3 text-sm text-neutral-400">No suppressed addresses.</li> : null}
        </ul>
      )}
    </section>
  );
}
