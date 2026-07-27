import { inputClass, labelClass } from '@/app/vistrial/components/ui';
import { ActionForm } from '@/app/ad/components/ActionForm';
import { engageLockdownAction, releaseLockdownAction } from '@/lib/ad/actions';
import { createClient, isControlPlaneSession } from '@/lib/supabase/server';

async function currentLockdown() {
  if (!(await isControlPlaneSession())) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from('lockdown')
    .select('*')
    .is('released_at', null)
    .order('engaged_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export default async function LockdownPage() {
  const live = await currentLockdown();

  return (
    <div className="space-y-10">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">Break glass</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Lockdown</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-400">
          While engaged, the decision engine refuses everyone except the acting Owner. Only the Owner
          who engaged it can release it. Engaging ends every other session.
        </p>
      </div>

      {live ? (
        <section className="rounded-2xl border border-flag-critical/30 bg-flag-critical/[0.08] p-5">
          <h2 className="text-lg font-semibold text-flag-critical">Lockdown is active</h2>
          <p className="mt-2 text-sm text-neutral-300">
            Since {new Date(live.engaged_at).toLocaleString()}
          </p>
          <p className="mt-2 text-sm text-neutral-400">{live.reason ?? 'No reason recorded.'}</p>
          <div className="mt-4">
            <ActionForm action={releaseLockdownAction} submitLabel="Release lockdown" />
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h2 className="text-lg font-semibold">Engage lockdown</h2>
          <ActionForm className="mt-4" action={engageLockdownAction} submitLabel="Engage" variant="danger">
            <label className={labelClass}>Reason</label>
            <textarea name="reason" required rows={3} className={inputClass} />
            <label className={labelClass}>Type LOCKDOWN to confirm</label>
            <input name="typed_confirmation" required className={inputClass} autoComplete="off" />
          </ActionForm>
        </section>
      )}
    </div>
  );
}
