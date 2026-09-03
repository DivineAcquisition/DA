import { Badge, Panel } from '@/app/vistrial/components/ui';
import { entryHow, formatShortDate, openerLine } from '@/lib/calls/map';
import type { HistoryLine, LeadRecord } from '@/lib/calls/types';
import BriefNoteForm from './BriefNoteForm';

function scoreTone(score: number | null): 'good' | 'warning' | 'critical' | 'neutral' {
  if (score == null) return 'neutral';
  if (score >= 60) return 'good';
  if (score >= 40) return 'warning';
  return 'critical';
}

export default function CallBrief({
  lead,
  history,
  noteEditable = true,
}: {
  lead: LeadRecord;
  history: HistoryLine[];
  noteEditable?: boolean;
}) {
  const opener = openerLine(lead);
  const days =
    lead.daysSinceTouch == null
      ? '—'
      : lead.daysSinceTouch === 999
        ? 'Never touched'
        : `${lead.daysSinceTouch} day${lead.daysSinceTouch === 1 ? '' : 's'}`;

  return (
    <div className="space-y-4">
      <Panel className="px-5 py-5 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-300">
          Call brief
        </p>
        <h2 className="mt-2 text-xl font-semibold text-white">
          {lead.fullName || 'Unnamed lead'}
          {lead.companyName ? (
            <span className="font-normal text-neutral-400"> · {lead.companyName}</span>
          ) : null}
        </h2>
        {opener ? (
          <blockquote className="mt-4 border-l-2 border-brand-500/50 pl-4 text-base leading-relaxed text-neutral-200">
            “{opener}”
            <footer className="mt-1.5 text-xs uppercase tracking-[0.12em] text-neutral-500">
              Verbatim from the application
            </footer>
          </blockquote>
        ) : (
          <p className="mt-4 text-sm text-neutral-500">No stated pain on the application.</p>
        )}
      </Panel>

      <Panel className="px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={scoreTone(lead.readinessScore)}>
            Readiness {lead.readinessScore ?? '—'}
          </Badge>
          {lead.qualificationResult && (
            <Badge
              tone={
                lead.qualificationResult === 'Qualified'
                  ? 'good'
                  : lead.qualificationResult === 'Manual Review'
                    ? 'warning'
                    : 'critical'
              }
            >
              {lead.qualificationResult}
            </Badge>
          )}
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          {lead.scoreInputs.map((input) => (
            <div key={input.label} className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-3">
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                {input.label}
              </dt>
              <dd className="mt-1 text-sm text-white">{input.value || '—'}</dd>
              <dd className="text-xs text-neutral-500">{input.points} pts</dd>
            </div>
          ))}
        </dl>
        {lead.painSeverity && (
          <p className="mt-3 text-xs text-neutral-500">
            Pain severity {lead.painSeverity} is also in the score, but the brief shows the three
            survey inputs that the number is mostly made of.
          </p>
        )}
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2">
        <Panel className="px-5 py-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
            How they entered
          </p>
          <p className="mt-2 text-sm text-white">{entryHow(lead) || '—'}</p>
          <p className="mt-1 text-xs text-neutral-500">{lead.sourceTrustTier || 'No trust tier yet'}</p>
        </Panel>
        <Panel className="px-5 py-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
            Follow-up clock
          </p>
          <p className="mt-2 text-sm text-white">{lead.touchStatus || '—'}</p>
          <p className="mt-1 text-xs text-neutral-500">Days since touch: {days}</p>
        </Panel>
      </div>

      {lead.whyNow && (
        <Panel className="px-5 py-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
            Why now
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-neutral-200">{lead.whyNow}</p>
        </Panel>
      )}

      <Panel className="px-5 py-5 sm:px-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
          Prior history
        </p>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">No touches or debriefs yet.</p>
        ) : (
          <ol className="mt-3 divide-y divide-white/[0.05]">
            {history.map((line) => (
              <li key={`${line.kind}-${line.id}`} className="flex gap-3 py-2.5 text-sm">
                <span className="w-16 shrink-0 tabular-nums text-neutral-500">
                  {line.date ? formatShortDate(line.date) : '—'}
                </span>
                <span className="min-w-0 flex-1 text-neutral-200">
                  <span className="text-neutral-400">{line.type}</span>
                  {line.outcome ? ` · ${line.outcome}` : ''}
                  {line.summary ? ` — ${line.summary}` : ''}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Panel>

      <Panel className="px-5 py-5 sm:px-6">
        {noteEditable ? (
          <BriefNoteForm leadId={lead.recordId} initialNote={lead.callBriefNote} />
        ) : lead.callBriefNote ? (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
              Going into this call
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-200">{lead.callBriefNote}</p>
          </>
        ) : null}
      </Panel>
    </div>
  );
}
