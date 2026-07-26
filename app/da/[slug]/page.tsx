import Link from 'next/link';
import { notFound } from 'next/navigation';
import { btnPrimary, btnSecondary, btnSizeSm } from '@/app/components/ui';
import {
  Badge,
  DefinitionList,
  KeyValue,
  PageHeader,
  Panel,
  SectionHeader,
} from '@/app/vistrial/components/ui';
import {
  getBaseline,
  getCaseFileBySlug,
  getGrowth,
  getHealth,
  listEffort,
  listEvidence,
  listMilestones,
  listReports,
  listSnapshots,
} from '@/lib/da/queries';
import BeginInstallButton from '../components/BeginInstallButton';
import { GrowthTable, HeadlineDelta } from '../components/growth';

export const dynamic = 'force-dynamic';

export default async function CaseFileOverview({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const caseFile = await getCaseFileBySlug(slug);
  if (!caseFile) notFound();

  const [health, baseline, growth, snapshots, milestones, evidence, effort, reports] = await Promise.all([
    getHealth(caseFile.id),
    getBaseline(caseFile.id),
    getGrowth(caseFile.id),
    listSnapshots(caseFile.id),
    listMilestones(caseFile.id),
    listEvidence(caseFile.id),
    listEffort(caseFile.id),
    listReports(caseFile.id),
  ]);

  const hasBaseline = Boolean(baseline);
  const baselineLocked = Boolean(baseline?.snapshot.locked_at);
  const comparable = growth.filter((row) => row.improved !== null);
  const untagged = evidence.filter((item) => item.needs_metadata);

  const sections = [
    { href: `/da/${slug}/baseline`, label: 'Baseline', hint: hasBaseline ? (baselineLocked ? 'Locked' : 'Open for editing') : 'Not captured' },
    { href: `/da/${slug}/progress`, label: 'Progress', hint: `${snapshots.length} snapshots` },
    { href: `/da/${slug}/milestones`, label: 'Milestones', hint: `${milestones.length} events` },
    { href: `/da/${slug}/evidence`, label: 'Evidence', hint: `${evidence.length} items${untagged.length ? `, ${untagged.length} untagged` : ''}` },
    { href: `/da/${slug}/effort`, label: 'Effort', hint: `${effort.filter((e) => !e.superseded_by_id).length} entries` },
    { href: `/da/${slug}/scope`, label: 'Scope', hint: `${health?.out_of_scope_count ?? 0} out of scope` },
    { href: `/da/${slug}/decisions`, label: 'Decisions', hint: 'Material choices' },
    { href: `/da/${slug}/reports`, label: 'Reports', hint: `${reports.length} generated` },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={caseFile.vertical ?? 'Engagement'}
        title={caseFile.name}
        description={
          caseFile.contact_name
            ? `${caseFile.contact_name}${caseFile.contact_email ? ` · ${caseFile.contact_email}` : ''}`
            : undefined
        }
        actions={
          <>
            <Link href="/da" className={`${btnSecondary} ${btnSizeSm}`}>
              All engagements
            </Link>
            {hasBaseline && !baselineLocked && (
              <BeginInstallButton caseFileId={caseFile.id} slug={slug} />
            )}
            {baselineLocked && (
              <Link href={`/da/${slug}/reports`} className={`${btnPrimary} ${btnSizeSm}`}>
                Generate report
              </Link>
            )}
          </>
        }
      />

      {/* Rule: no baseline means the case file warns and growth reporting is off. */}
      {!hasBaseline && (
        <Panel className="border-flag-critical/25 bg-flag-critical/[0.06] p-6">
          <Badge tone="critical">No baseline captured</Badge>
          <h2 className="mt-3 text-lg font-semibold text-white">
            Growth reporting is switched off for this engagement
          </h2>
          <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-neutral-300">
            Nothing in this system works without a baseline. It has to be captured during the audit, before
            anything is installed, because every figure reported afterwards is a measured delta from it.
            Showing numbers without one would be showing numbers that mean nothing.
          </p>
          <Link href={`/da/${slug}/baseline`} className={`${btnPrimary} ${btnSizeSm} mt-5`}>
            Capture the baseline
          </Link>
        </Panel>
      )}

      {hasBaseline && !baselineLocked && (
        <Panel className="border-flag-warning/25 bg-flag-warning/[0.06] p-5">
          <Badge tone="warning">Baseline still open</Badge>
          <p className="mt-2.5 text-sm leading-relaxed text-white">
            The baseline is captured but not yet locked, so progress snapshots cannot be taken. Locking happens
            when you begin the install, and it is permanent — after that the baseline can only be annotated.
          </p>
        </Panel>
      )}

      {baselineLocked && comparable.length > 0 && (
        <>
          <section>
            <SectionHeader
              title="Is this client better off than when we started"
              hint={
                health?.last_period_end
                  ? `Measured to ${health.last_period_end}, against a baseline locked ${baseline!.snapshot.locked_at?.slice(0, 10)}.`
                  : undefined
              }
            />
            <HeadlineDelta rows={growth} />
          </section>

          <section>
            <SectionHeader title="Every metric" hint="Improvements and regressions together." />
            <GrowthTable rows={growth} />
          </section>
        </>
      )}

      {baselineLocked && comparable.length === 0 && (
        <Panel className="p-5">
          <Badge tone="warning">No progress snapshot yet</Badge>
          <p className="mt-2.5 text-sm leading-relaxed text-neutral-300">
            The baseline is locked, so measurement can begin. Snapshots are taken automatically each week, or
            you can take one now.
          </p>
          <Link href={`/da/${slug}/progress`} className={`${btnPrimary} ${btnSizeSm} mt-4`}>
            Take a snapshot
          </Link>
        </Panel>
      )}

      <section>
        <SectionHeader title="Engagement" />
        <Panel className="px-5 py-2">
          <DefinitionList>
            <KeyValue label="Status">
              <Badge tone={caseFile.status === 'active' ? 'good' : 'warning'}>{caseFile.status}</Badge>
            </KeyValue>
            <KeyValue label="Engagement start">{caseFile.engagement_start ?? '—'}</KeyValue>
            <KeyValue label="Install began">
              {caseFile.install_started_at ? caseFile.install_started_at.slice(0, 10) : 'Not yet'}
            </KeyValue>
            <KeyValue label="Retainer">
              {caseFile.retainer_amount ? `$${Number(caseFile.retainer_amount).toLocaleString()}/mo` : '—'}
            </KeyValue>
            <KeyValue label="Revenue goal">
              {caseFile.revenue_goal_monthly
                ? `$${Number(caseFile.revenue_goal_monthly).toLocaleString()}/mo`
                : '—'}
            </KeyValue>
            <KeyValue label="Drive folder">
              {caseFile.drive_folder_url ? (
                <a
                  href={caseFile.drive_folder_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-300 underline decoration-brand-500/40 underline-offset-2 hover:text-brand-200"
                >
                  Open in Drive
                </a>
              ) : (
                <span className="text-neutral-500">Not connected</span>
              )}
            </KeyValue>
          </DefinitionList>
        </Panel>
      </section>

      <section>
        <SectionHeader title="Sections" />
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {sections.map((section) => (
            <Link key={section.href} href={section.href} className="panel panel-hover rounded-2xl px-4 py-3.5">
              <p className="text-sm font-medium text-white">{section.label}</p>
              <p className="mt-1 text-xs text-neutral-500">{section.hint}</p>
            </Link>
          ))}
        </div>
      </section>

      {untagged.length > 0 && (
        <Panel className="border-flag-warning/25 bg-flag-warning/[0.06] p-5">
          <Badge tone="warning">{untagged.length} evidence items awaiting metadata</Badge>
          <p className="mt-2.5 text-sm leading-relaxed text-white">
            These were added straight to Drive rather than through Vistrial, so the sync brought them in
            untagged. Every item needs what it proves and the date it happened before it can be used in a
            report.
          </p>
          <Link href={`/da/${slug}/evidence`} className={`${btnSecondary} ${btnSizeSm} mt-4`}>
            Tag them
          </Link>
        </Panel>
      )}
    </div>
  );
}
