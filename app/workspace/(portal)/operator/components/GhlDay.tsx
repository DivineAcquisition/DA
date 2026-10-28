import { btnPrimary, btnSecondary, btnSizeSm } from '@/app/components/ui';
import { ghlAppUrl } from '@/lib/ghl/rules';
import type { PortalGhl } from '@/lib/ghl/types';

const APP_URL = process.env.NEXT_PUBLIC_GHL_APP_URL?.trim() || 'https://app.gohighlevel.com';

const STATE: Record<PortalGhl['clients'][number]['state'], { label: string; tone: string; detail: string }> = {
  ready: { label: 'Ready', tone: 'text-flag-good', detail: '' },
  pending: { label: 'Access pending', tone: 'text-amber-300', detail: 'DA is setting up your GHL user. You will get a notice here when it is ready.' },
  removing: { label: 'Access ending', tone: 'text-neutral-400', detail: 'This placement is ending, so your access is being removed.' },
  none: { label: 'Access pending', tone: 'text-amber-300', detail: 'Your access has not been requested yet. DA has been alerted.' },
  not_connected: { label: 'Not connected yet', tone: 'text-neutral-400', detail: 'This client is not connected to DA yet.' },
};

/** My Day: GHL access per client, the button into each sub-account, and leads routed to this VA. */
export default function GhlDay({ data }: { data: PortalGhl | null }) {
  if (!data || (data.clients.length === 0 && data.leads.length === 0)) return null;
  return (
    <section className="panel rounded-2xl p-4">
      {data.leads.length ? (
        <div className="mb-4">
          <h2 className="mb-2 text-sm font-semibold text-white">Leads waiting for you</h2>
          <ul className="space-y-2">
            {data.leads.map((lead) => {
              const late = lead.minutes_waiting >= lead.standard_minutes;
              return (
                <li key={lead.lead_id} className={`flex flex-wrap items-center gap-2 rounded-xl px-3 py-2.5 text-sm ${late ? 'bg-flag-critical/[0.08]' : 'bg-white/[0.03]'}`}>
                  <span className="min-w-0 flex-1">
                    <span className="block text-neutral-100">{lead.name ?? 'New lead'}</span>
                    <span className={`block text-xs ${late ? 'text-flag-critical' : 'text-neutral-500'}`}>
                      {lead.client} · assigned {lead.minutes_waiting} min ago · respond within {lead.standard_minutes} min
                    </span>
                  </span>
                  {lead.location_id ? (
                    <a href={ghlAppUrl(APP_URL, lead.location_id, lead.contact_id)} target="_blank" rel="noopener noreferrer" className={`${btnPrimary} ${btnSizeSm}`}>
                      Open in GHL
                    </a>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      {data.clients.length ? (
        <>
          <h2 className="mb-2 text-sm font-semibold text-white">Your clients in GHL</h2>
          <ul className="space-y-2">
            {data.clients.map((client) => {
              const state = STATE[client.state];
              return (
                <li key={client.case_file_id} className="flex flex-wrap items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2.5 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block text-neutral-100">{client.client}</span>
                    <span className={`block text-xs ${state.tone}`}>
                      {state.label}
                      {state.detail ? ` · ${state.detail}` : ''}
                    </span>
                  </span>
                  {client.state === 'ready' && client.location_id ? (
                    <a href={ghlAppUrl(APP_URL, client.location_id)} target="_blank" rel="noopener noreferrer" className={`${btnSecondary} ${btnSizeSm}`}>
                      Open GHL
                    </a>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-neutral-500">First time in GHL? Sign in with your DA email and use &quot;Forgot password&quot; to set your own password.</p>
        </>
      ) : null}
    </section>
  );
}
