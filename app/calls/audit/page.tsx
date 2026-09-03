import Link from 'next/link';
import { EmptyState, PageHeader } from '@/app/vistrial/components/ui';
import { callsReady } from '@/lib/calls/config';
import { listLeads } from '@/lib/calls/queries';

export default async function IndependentAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  if (!(await callsReady())) {
    return (
      <EmptyState title="Airtable is not configured" detail="Set da_settings.pipeline_airtable_pat." />
    );
  }
  const leads = await listLeads(q);

  return (
    <>
      <PageHeader
        eyebrow="Lead Leak Audit"
        title="Who is on this call?"
        description="Pick a lead. The call brief is the next screen — then the debrief form."
      />
      <form action="/calls/audit" className="mb-6 flex gap-2">
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
        <EmptyState title="No leads" detail="Nothing matched." />
      ) : (
        <ul className="space-y-2">
          {leads.map((lead) => (
            <li key={lead.recordId}>
              <Link
                href={`/calls/${lead.recordId}/audit`}
                className="panel panel-hover block rounded-2xl px-5 py-4"
              >
                <p className="text-sm font-semibold text-white">{lead.fullName || 'Unnamed lead'}</p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {lead.companyName || lead.email || 'Open brief, then debrief'}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
