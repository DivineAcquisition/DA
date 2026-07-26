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
} from '@/app/vistrial/components/ui';
import { logDecisionAction } from '@/lib/da/actions';
import { getCaseFileBySlug, listDecisions } from '@/lib/da/queries';
import { ActionForm, Disclosure, ImmutableNotice } from '../../components/ActionForm';

export const dynamic = 'force-dynamic';

export default async function DecisionsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const caseFile = await getCaseFileBySlug(slug);
  if (!caseFile) notFound();

  const decisions = await listDecisions(caseFile.id);
  const current = decisions.filter((decision) => !decision.superseded_by_id);
  const againstAdvice = current.filter((decision) => decision.against_recommendation);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={caseFile.name}
        title="Decisions"
        description="Material choices made during the engagement. Short by design: this is not meeting notes, it is the decisions that would matter if the engagement went badly."
        actions={
          <Link href={`/da/${slug}`} className={`${btnSecondary} ${btnSizeSm}`}>
            Back to case file
          </Link>
        }
      />

      {againstAdvice.length > 0 && (
        <Panel className="border-flag-warning/25 bg-flag-warning/[0.06] p-5">
          <Badge tone="warning">
            {againstAdvice.length} decision{againstAdvice.length === 1 ? '' : 's'} against our recommendation
          </Badge>
          <p className="mt-2.5 text-sm leading-relaxed text-white">
            These are the ones that matter most if results are questioned later. Recorded at the time, with the
            reasoning, rather than reconstructed afterwards.
          </p>
        </Panel>
      )}

      <Disclosure label="Record a decision">
        <Panel className="p-5">
          <ActionForm action={logDecisionAction.bind(null, caseFile.id, slug)} submitLabel="Record decision">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="decided_on">
                  Date decided *
                </label>
                <input id="decided_on" name="decided_on" type="date" required className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="decided_by">
                  Who decided *
                </label>
                <input
                  id="decided_by"
                  name="decided_by"
                  required
                  className={inputClass}
                  placeholder="Dr. Renata Vos, or Malik (DA)"
                />
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="what_was_decided">
                What was decided *
              </label>
              <textarea
                id="what_was_decided"
                name="what_was_decided"
                rows={2}
                required
                className={`${inputClass} resize-none`}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="reasoning">
                Reasoning *
              </label>
              <textarea
                id="reasoning"
                name="reasoning"
                rows={3}
                required
                className={`${inputClass} resize-none`}
                placeholder="Why. Especially if this went against what we advised."
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5">
              <input
                type="checkbox"
                name="against_recommendation"
                className="h-4 w-4 accent-[#9a88fc]"
              />
              <span className="text-sm text-neutral-300">
                The client chose against our recommendation
              </span>
            </label>
            <ImmutableNotice>
              Recorded decisions cannot be edited. A change files a new version and both stay visible.
            </ImmutableNotice>
          </ActionForm>
        </Panel>
      </Disclosure>

      <section>
        <SectionHeader title="Log" hint={`${current.length} decisions.`} />
        {current.length === 0 ? (
          <EmptyState title="Nothing recorded yet" />
        ) : (
          <ul className="space-y-2.5">
            {current.map((decision) => (
              <li key={decision.id}>
                <Panel
                  className={`px-5 py-4 ${
                    decision.against_recommendation ? 'border-flag-warning/25' : ''
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={decision.against_recommendation ? 'warning' : 'neutral'}>
                        {decision.decided_by}
                      </Badge>
                      {decision.against_recommendation && (
                        <Badge tone="critical">against our recommendation</Badge>
                      )}
                      {decision.version > 1 && <Badge tone="neutral">v{decision.version}</Badge>}
                    </div>
                    <span className="text-[11px] tabular-nums text-neutral-600">{decision.decided_on}</span>
                  </div>

                  <p className="mt-2 text-sm font-medium text-white">{decision.what_was_decided}</p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-400">{decision.reasoning}</p>
                </Panel>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
