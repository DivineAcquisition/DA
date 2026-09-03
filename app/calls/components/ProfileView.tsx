import Link from 'next/link';
import { btnPrimary, btnSecondary, btnSizeSm } from '@/app/components/ui';
import { Badge, EmptyState, Panel, StatGrid, StatTile } from '@/app/vistrial/components/ui';
import { conversionFrom, onboardCta } from '@/lib/calls/conversion';
import { airtableDebriefUrl, airtableTouchUrl, formatDisplayDate, formatShortDate } from '@/lib/calls/map';
import type { DebriefRecord, LeadProfile, TouchRecord } from '@/lib/calls/types';
import ConversionPanel from './ConversionPanel';
import TranscriptAttachForm from './TranscriptAttachForm';

function scoreTone(score: number | null): 'good' | 'warning' | 'critical' | 'neutral' {
  if (score == null) return 'neutral';
  if (score >= 60) return 'good';
  if (score >= 40) return 'warning';
  return 'critical';
}

const SAVED: Record<string, string> = {
  touch: 'Touch logged in Supabase and sent to Airtable. It is on this profile now.',
  debrief: 'Debrief submitted as complete. It landed in Supabase, then Call Debriefs — Airtable will run its existing automations on that create.',
  'closed-won':
    'Closed Won is on this profile. Onboarding does not start from the debrief — confirm Commas payment first.',
  draft: 'Draft saved through Supabase onto this debrief. Finish it from Continue — it will not create a second record.',
  transcript: 'Attached through Supabase onto the existing debrief. Nothing new was created.',
  payment: 'Payment marked Paid on this lead. Start onboarding when you are ready.',
  onboard: 'Onboarding saved to the Client Onboarding table. The lead record was not changed.',
  onboarding: 'Onboarding saved to the Client Onboarding table. The lead record was not changed.',
  base: 'Operating base recorded. Start Onboarding is now a link to that base.',
};

export default function ProfileView({
  profile,
  saved,
}: {
  profile: LeadProfile;
  saved?: string;
}) {
  const { lead, touches, debriefs } = profile;
  const conversion = conversionFrom(profile);
  const cta = onboardCta(conversion);
  const days =
    lead.daysSinceTouch == null
      ? '—'
      : lead.daysSinceTouch === 999
        ? 'Never'
        : String(lead.daysSinceTouch);

  return (
    <div className="space-y-6">
      {profile.pendingAirtableSend && (
        <p className="rounded-2xl border border-flag-warning/25 bg-flag-warning/[0.08] px-4 py-3 text-sm text-flag-warning">
          A call event is in Supabase and has not finished sending to Airtable. It will retry
          automatically.
        </p>
      )}

      {saved && SAVED[saved] && (
        <p className="rounded-2xl border border-flag-good/25 bg-flag-good/[0.08] px-4 py-3 text-sm text-flag-good">
          {SAVED[saved]}
        </p>
      )}

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-300">
            Client profile
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-white sm:text-[28px]">
            {lead.fullName || 'Unnamed lead'}
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            {lead.companyName || lead.coachingNiche || 'No company'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/calls/${lead.recordId}/brief`} className={`${btnSecondary} ${btnSizeSm}`}>
            Call brief
          </Link>
          <Link href={`/calls/${lead.recordId}/phone`} className={`${btnSecondary} ${btnSizeSm}`}>
            Log phone
          </Link>
          <Link href={`/calls/${lead.recordId}/audit`} className={`${btnPrimary} ${btnSizeSm}`}>
            Log audit
          </Link>
        </div>
      </header>

      <ConversionPanel
        conversion={conversion}
        cta={cta}
        leadId={lead.recordId}
        onboarding={profile.onboarding}
      />

      <StatGrid columns={4}>
        <StatTile
          label="Readiness"
          value={lead.readinessScore == null ? '—' : String(lead.readinessScore)}
          hint={lead.qualificationResult || undefined}
          tone={scoreTone(lead.readinessScore)}
        />
        <StatTile label="Stage" value={lead.stage || '—'} hint={lead.nextAction || undefined} />
        <StatTile label="Days since touch" value={days} hint={lead.touchStatus || undefined} />
        <StatTile
          label="Deals"
          value={lead.dealValue != null ? `$${lead.dealValue.toLocaleString()}` : '—'}
          hint={lead.auditOutcome || lead.objection || undefined}
        />
      </StatGrid>

      <Panel className="px-5 py-5 sm:px-6">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
          Contact
        </h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">Email</dt>
            <dd className="mt-1 text-sm text-neutral-200">{lead.email || '—'}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">Phone</dt>
            <dd className="mt-1 text-sm text-neutral-200">{lead.phone || '—'}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
              Scoring inputs
            </dt>
            <dd className="mt-1 text-sm text-neutral-200">
              {lead.scoreInputs.map((input) => `${input.label} ${input.value || '—'}`).join(' · ')}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">Source</dt>
            <dd className="mt-1 text-sm text-neutral-200">
              {[lead.entryPoint, lead.leadSource, lead.sourceTrustTier].filter(Boolean).join(' · ') || '—'}
            </dd>
          </div>
        </dl>
        {lead.statedPain && (
          <p className="mt-4 border-l-2 border-brand-500/40 pl-4 text-sm leading-relaxed text-neutral-200">
            {lead.statedPain}
          </p>
        )}
        {lead.googleMeetUrl && (
          <p className="mt-3 text-sm">
            <a href={lead.googleMeetUrl} className="text-brand-300 hover:underline" target="_blank" rel="noreferrer">
              Google Meet
            </a>
            {profile.incomingCall?.meetUrl === lead.googleMeetUrl ? (
              <span className="ml-2 text-xs text-neutral-500">from the booked call</span>
            ) : null}
          </p>
        )}
        {profile.incomingCall?.recordingUrl && profile.incomingCall.recordingUrl !== lead.googleMeetUrl && (
          <p className="mt-2 text-sm">
            <a
              href={profile.incomingCall.recordingUrl}
              className="text-brand-300 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              Incoming recording
            </a>
            <span className="ml-2 text-xs text-neutral-500">arrived through Supabase</span>
          </p>
        )}
        <p className="mt-4 text-xs text-neutral-500">
          Call events land in Supabase, then are sent to Airtable. The rest of this profile is live
          from DA Pipeline.
        </p>
        <p className="mt-4 text-xs">
          <a href={lead.airtableUrl} className="text-neutral-500 hover:text-neutral-300 hover:underline" target="_blank" rel="noreferrer">
            Open in Airtable
          </a>
        </p>
      </Panel>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
            Phone touches
          </h2>
          <Link href={`/calls/${lead.recordId}/phone`} className="text-xs font-medium text-brand-300 hover:underline">
            Log a touch
          </Link>
        </div>
        {touches.length === 0 ? (
          <EmptyState title="No touches yet" detail="Phone, SMS, DM, voicemail, and email land here." />
        ) : (
          <ol className="space-y-3">
            {touches.map((touch) => (
              <TouchCard key={touch.recordId} touch={touch} />
            ))}
          </ol>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
            Audit debriefs
          </h2>
          <Link href={`/calls/${lead.recordId}/audit`} className="text-xs font-medium text-brand-300 hover:underline">
            Log an audit
          </Link>
        </div>
        {debriefs.length === 0 ? (
          <EmptyState title="No debriefs yet" detail="The live audit form writes here. Drafts show up as soon as they are saved." />
        ) : (
          <ol className="space-y-3">
            {debriefs.map((debrief) => (
              <DebriefCard key={debrief.recordId} debrief={debrief} leadId={lead.recordId} />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function TouchCard({ touch }: { touch: TouchRecord }) {
  return (
    <Panel as="li" className="px-5 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium text-white">
          {touch.date ? formatDisplayDate(touch.date) : 'Undated'} · {touch.channel || 'Touch'}
        </p>
        {touch.outcome && <Badge>{touch.outcome}</Badge>}
        {touch.sentiment && (
          <Badge tone={touch.sentiment === 'Positive' ? 'good' : touch.sentiment === 'Negative' ? 'critical' : 'neutral'}>
            {touch.sentiment}
          </Badge>
        )}
      </div>
      {touch.summary && <p className="mt-2 text-sm leading-relaxed text-neutral-300">{touch.summary}</p>}
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-neutral-500">
        {touch.recordingLink && (
          <a href={touch.recordingLink} className="text-brand-300 hover:underline" target="_blank" rel="noreferrer">
            Recording
          </a>
        )}
        <a href={airtableTouchUrl(touch.recordId)} className="hover:underline" target="_blank" rel="noreferrer">
          Airtable
        </a>
      </div>
      {touch.transcript && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-neutral-400">Transcript</summary>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed text-neutral-300">
            {touch.transcript}
          </pre>
        </details>
      )}
    </Panel>
  );
}

function DebriefCard({ debrief, leadId }: { debrief: DebriefRecord; leadId: string }) {
  return (
    <Panel as="li" className="px-5 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium text-white">
          {debrief.callDate ? formatShortDate(debrief.callDate) : 'Undated'}
          {debrief.callType ? ` · ${debrief.callType}` : ''}
          {debrief.owner ? ` · ${debrief.owner}` : ''}
        </p>
        {debrief.complete ? (
          debrief.outcome && <Badge tone="good">{debrief.outcome}</Badge>
        ) : (
          <Badge tone="warning">Draft</Badge>
        )}
        {debrief.objection && <Badge>{debrief.objection}</Badge>}
      </div>
      {debrief.statedGoal && (
        <p className="mt-3 text-sm leading-relaxed text-neutral-200">“{debrief.statedGoal}”</p>
      )}
      <dl className="mt-3 grid gap-2 text-sm text-neutral-300 sm:grid-cols-2">
        {debrief.agreedNextStep && (
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">Next step</dt>
            <dd className="mt-0.5">{debrief.agreedNextStep}</dd>
          </div>
        )}
        {debrief.dealRisk && (
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">Deal risk</dt>
            <dd className="mt-0.5">{debrief.dealRisk}</dd>
          </div>
        )}
        {debrief.amountQuoted != null && (
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">Quoted</dt>
            <dd className="mt-0.5">${debrief.amountQuoted.toLocaleString()}</dd>
          </div>
        )}
        {debrief.closeConfidence != null && (
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">Confidence</dt>
            <dd className="mt-0.5">{debrief.closeConfidence}/5</dd>
          </div>
        )}
      </dl>
      <div className="mt-3 flex flex-wrap gap-3 text-xs">
        {!debrief.complete && (
          <Link href={`/calls/${leadId}/audit/${debrief.recordId}`} className="font-medium text-brand-300 hover:underline">
            Continue draft
          </Link>
        )}
        {debrief.recordingLink && (
          <a href={debrief.recordingLink} className="text-brand-300 hover:underline" target="_blank" rel="noreferrer">
            Recording
          </a>
        )}
        <a
          href={airtableDebriefUrl(debrief.recordId)}
          className="text-neutral-500 hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          Airtable
        </a>
      </div>
      {debrief.transcript ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-neutral-400">Transcript</summary>
          <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap font-sans text-sm leading-relaxed text-neutral-300">
            {debrief.transcript}
          </pre>
        </details>
      ) : (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-neutral-400">
            Attach transcript or recording
          </summary>
          <TranscriptAttachForm leadId={leadId} debriefId={debrief.recordId} />
        </details>
      )}
    </Panel>
  );
}
