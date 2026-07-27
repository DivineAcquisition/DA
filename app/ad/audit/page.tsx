import { listAuditEvents } from '@/lib/ad/queries';

export default async function AuditPage() {
  const events = await listAuditEvents(200);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">Append-only</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Audit log</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-400">
          Updates and deletes are refused even for privileged roles. Impersonation actions are
          attributed to the real actor.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/[0.06]">
        <ul className="divide-y divide-white/[0.04] text-sm">
          {events.map((event) => (
            <li key={event.id} className="px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium text-white">{event.action}</span>
                <span className="text-xs text-neutral-500">{new Date(event.at).toLocaleString()}</span>
              </div>
              <p className="mt-1 text-neutral-400">{event.summary}</p>
              <p className="mt-1 text-xs text-neutral-600">
                {event.actor_email ?? 'system'}
                {event.actor_role ? ` · ${event.actor_role}` : ''}
                {event.acting_as_profile_id ? ' · impersonating' : ''}
                {event.entity_type ? ` · ${event.entity_type}` : ''}
              </p>
            </li>
          ))}
          {events.length === 0 && (
            <li className="px-4 py-10 text-center text-neutral-500">No audit events visible.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
