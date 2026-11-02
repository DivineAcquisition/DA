import { applyStatus, interpretResendEvent } from './events';
import type { EmailStatus } from './policy';

export async function ingestResendEvent(svixId: string, event: { type?: string; data?: unknown }): Promise<{ ok: boolean; duplicate?: boolean; error?: string }> {
  const { serviceRoleClient } = await import('@/lib/workspace/db');
  const client = serviceRoleClient();
  if (!client) return { ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY is required' };

  const { data: seen } = await client.from('email_webhook_event').select('id').eq('id', svixId).maybeSingle();
  if (seen) return { ok: true, duplicate: true };

  const interpreted = interpretResendEvent(event);
  if (!interpreted) {
    await client.from('email_webhook_event').insert({ id: svixId, type: event.type ?? 'unknown', resend_id: null, log_id: null });
    return { ok: true };
  }

  const { data: existing } = await client.from('email_log').select('id, status, purpose, report_id').eq('resend_id', interpreted.resendId).maybeSingle();
  const log = existing as { id: string; status: EmailStatus; purpose: string; report_id: string | null } | null;

  if (log && interpreted.status) {
    const status = applyStatus(log.status, interpreted.status);
    await client
      .from('email_log')
      .update({
        status,
        error: interpreted.error,
        updated_at: new Date().toISOString(),
        ...(status === 'delivered' ? { delivered_at: new Date().toISOString() } : {}),
        ...(status === 'bounced' ? { bounced_at: new Date().toISOString() } : {}),
        ...(status === 'complained' ? { complained_at: new Date().toISOString() } : {}),
        ...(status === 'failed' ? { failed_at: new Date().toISOString() } : {}),
      })
      .eq('id', log.id);
    if (status === 'delivered' || status === 'bounced' || status === 'complained') {
      await client.from('email_outbox').delete().eq('log_id', log.id);
    }
  }

  for (const item of interpreted.suppress) {
    const { data: already } = await client.from('email_suppression').select('email').eq('email', item.email).is('lifted_at', null).maybeSingle();
    if (!already) {
      await client.from('email_suppression').insert({
        email: item.email,
        reason: item.reason,
        detail: interpreted.error,
        source_log_id: log?.id ?? null,
      });
    }
  }

  if (interpreted.suppress.length) {
    const { notifyReportBounce, notifySuppression } = await import('./alerts');
    const address = interpreted.suppress[0]?.email;
    if (address) {
      await notifySuppression({
        email: address,
        logId: log?.id ?? interpreted.resendId,
        reason: interpreted.suppress[0].reason,
      });
      if (log?.purpose === 'client' && log.report_id) {
        await notifyReportBounce({ email: address, reportId: log.report_id, logId: log.id });
      }
    }
  }

  await client.from('email_webhook_event').insert({
    id: svixId,
    type: interpreted.type,
    resend_id: interpreted.resendId,
    log_id: log?.id ?? null,
  });
  return { ok: true };
}
