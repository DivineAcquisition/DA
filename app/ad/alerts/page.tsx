import { ActionForm } from '@/app/ad/components/ActionForm';
import { acknowledgeOwnerAlertAction } from '@/lib/ad/actions';
import { listOwnerAlerts } from '@/lib/ad/queries';

export default async function AlertsPage() {
  const alerts = await listOwnerAlerts();

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">Owners</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Owner alerts</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-400">
          Uninvited signups, impersonation starts, and lockdown events surface here.
        </p>
      </div>

      <ul className="divide-y divide-white/[0.04] overflow-hidden rounded-2xl border border-white/[0.06]">
        {alerts.map((alert) => (
          <li key={alert.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-flag-warning">{alert.kind}</p>
              <p className="mt-1 text-sm text-white">{alert.summary}</p>
              <p className="mt-1 text-xs text-neutral-500">{new Date(alert.at).toLocaleString()}</p>
            </div>
            <ActionForm
              action={async () => acknowledgeOwnerAlertAction(alert.id)}
              submitLabel="Acknowledge"
              variant="secondary"
            />
          </li>
        ))}
        {alerts.length === 0 && (
          <li className="px-4 py-10 text-center text-neutral-500">No open owner alerts.</li>
        )}
      </ul>
    </div>
  );
}
