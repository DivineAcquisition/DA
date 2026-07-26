import Link from 'next/link';
import { notFound } from 'next/navigation';
import { btnSecondary, btnSizeSm } from '@/app/components/ui';
import {
  Badge,
  EmptyState,
  PageHeader,
  Panel,
  SectionHeader,
  inputClass,
  labelClass,
  selectClass,
} from '@/app/vistrial/components/ui';
import { addMilestoneAction } from '@/lib/da/actions';
import { getCaseFileBySlug, listMilestones, listSnapshots } from '@/lib/da/queries';
import { ActionForm, Disclosure } from '../../components/ActionForm';
import DetectMilestonesButton from '../../components/DetectMilestonesButton';

export const dynamic = 'force-dynamic';

const TYPES = [
  { value: 'install_complete', label: 'Install phase completed' },
  { value: 'operator_placed', label: 'Operator placed' },
  { value: 'campaign_launched', label: 'Campaign launched' },
  { value: 'first_lead', label: 'First lead through the system' },
  { value: 'first_booking', label: 'First booking' },
  { value: 'first_reactivation_revenue', label: 'First reactivation revenue' },
  { value: 'first_month_over_goal', label: 'First month over goal' },
  { value: 'custom', label: 'Something else' },
];

export default async function MilestonesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const caseFile = await getCaseFileBySlug(slug);
  if (!caseFile) notFound();

  const [milestones, snapshots] = await Promise.all([
    listMilestones(caseFile.id),
    listSnapshots(caseFile.id),
  ]);

  // Milestones and snapshots on one timeline, so it is visually obvious when a
  // change in the numbers followed a change in the system. That correlation is
  // the argument.
  const timeline = [
    ...milestones.map((item) => ({
      id: item.id,
      on: item.occurred_on,
      kind: 'milestone' as const,
      title: item.title,
      detail: item.description,
      auto: item.auto_generated,
    })),
    ...snapshots
      .filter((item) => item.period_end)
      .map((item) => ({
        id: item.id,
        on: item.period_end!,
        kind: 'snapshot' as const,
        title: `Measured ${item.period_start} → ${item.period_end}`,
        detail: item.notes,
        auto: item.trigger === 'automatic',
      })),
  ].sort((a, b) => (a.on < b.on ? 1 : -1));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={caseFile.name}
        title="Milestones"
        description="Dated events that give the growth numbers a narrative, plotted against the snapshots so a change in the numbers can be seen following a change in the system."
        actions={
          <>
            <DetectMilestonesButton caseFileId={caseFile.id} slug={slug} />
            <Link href={`/da/${slug}`} className={`${btnSecondary} ${btnSizeSm}`}>
              Back to case file
            </Link>
          </>
        }
      />

      <Disclosure label="Add a milestone">
        <Panel className="p-5">
          <ActionForm action={addMilestoneAction.bind(null, caseFile.id, slug)} submitLabel="Add milestone">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="occurred_on">
                  Date it happened *
                </label>
                <input id="occurred_on" name="occurred_on" type="date" required className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="type">
                  Type
                </label>
                <select id="type" name="type" defaultValue="custom" className={selectClass}>
                  {TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="title">
                Title *
              </label>
              <input id="title" name="title" required className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="description">
                Description
              </label>
              <textarea id="description" name="description" rows={2} className={`${inputClass} resize-none`} />
            </div>
          </ActionForm>
        </Panel>
      </Disclosure>

      <section>
        <SectionHeader
          title="Timeline"
          hint={`${milestones.length} milestones and ${snapshots.length} measurements.`}
        />
        {timeline.length === 0 ? (
          <EmptyState title="Nothing on the timeline yet" />
        ) : (
          <ol className="space-y-2.5">
            {timeline.map((entry) => (
              <li key={`${entry.kind}-${entry.id}`}>
                <Panel
                  className={`px-5 py-4 ${entry.kind === 'snapshot' ? 'border-white/[0.04] opacity-80' : ''}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={entry.kind === 'milestone' ? 'brand' : 'neutral'}>
                        {entry.kind === 'milestone' ? 'Milestone' : 'Measurement'}
                      </Badge>
                      {entry.auto && <Badge tone="neutral">detected automatically</Badge>}
                    </div>
                    <span className="text-[11px] tabular-nums text-neutral-600">{entry.on}</span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-white">{entry.title}</p>
                  {entry.detail && (
                    <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">{entry.detail}</p>
                  )}
                </Panel>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
