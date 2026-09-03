import Link from 'next/link';
import { btnPrimary, btnSecondary, btnSizeSm } from '@/app/components/ui';
import { Badge, EmptyState, PageHeader } from '@/app/vistrial/components/ui';
import { callsReady } from '@/lib/calls/ready';
import { listLeads } from '@/lib/calls/queries';

function scoreTone(score: number | null): 'good' | 'warning' | 'critical' | 'neutral' {
  if (score == null) return 'neutral';
  if (score >= 60) return 'good';
  if (score >= 40) return 'warning';
  return 'critical';
}

export default async function CallsHomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  if (!(await callsReady())) {
    return (
      <EmptyState
        title="Airtable is not configured"
        detail="Set da_settings.pipeline_airtable_pat. The base and table ids already default to DA Pipeline — ClientAcquisition."
      />
    );
  }

  const leads = await listLeads(q);

  return (
    <>
      <PageHeader
        eyebrow="DA Pipeline"
        title="Leads"
        description="Live CRM from Airtable. Call events land in Supabase first, then are sent to Touches and Call Debriefs."
        actions={
          <>
            <Link href="/calls/phone" className={`${btnSecondary} ${btnSizeSm}`}>
              Log phone
            </Link>
            <Link href="/calls/audit" className={`${btnPrimary} ${btnSizeSm}`}>
              Log audit
            </Link>
          </>
        }
      />

      <form action="/calls" className="mb-6 flex gap-2">
        <input
          name="q"
          defaultValue={q ?? ''}
          placeholder="Search name, email, company, phone"
          className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder-neutral-600 focus:border-brand-500/60 focus:outline-none"
        />
        <button
          type="submit"
          className="shrink-0 rounded-full border border-white/[0.12] px-4 py-2 text-sm font-semibold text-white hover:bg-white/[0.07]"
        >
          Search
        </button>
      </form>

      {leads.length === 0 ? (
        <EmptyState title="No leads" detail={q ? 'Nothing matched that search.' : 'The Leads table is empty.'} />
      ) : (
        <ul className="space-y-2">
          {leads.map((lead) => (
            <li key={lead.recordId}>
              <Link href={`/calls/${lead.recordId}`} className="panel panel-hover block rounded-2xl px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{lead.fullName || 'Unnamed lead'}</p>
                    <p className="mt-0.5 truncate text-xs text-neutral-500">
                      {lead.companyName || lead.email || lead.phone || 'No contact'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {lead.clientBaseId || lead.stage === 'Closed Won' ? (
                      <Badge tone="good">Client</Badge>
                    ) : null}
                    <Badge tone={scoreTone(lead.readinessScore)}>
                      {lead.readinessScore ?? '—'} {lead.qualificationResult}
                    </Badge>
                    {lead.stage && <Badge>{lead.stage}</Badge>}
                  </div>
                </div>
                <p className="mt-3 text-xs text-neutral-400">{lead.nextAction || lead.touchStatus}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
