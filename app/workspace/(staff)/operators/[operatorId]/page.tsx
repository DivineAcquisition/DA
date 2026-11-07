import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  clearSetupAction,
  extendOverrideAction,
  grantOverrideAction,
  offboardAction,
  revokeOverrideAction,
  saveGhlAction,
  tickOffboardAction,
  waiveReadinessAction,
} from '@/lib/hire/actions';
import { READINESS_LABEL, STAGE_LABEL, nextHireAction, stepErrors, type HireStage, type OnboardingDraft } from '@/lib/hire/rules';
import { resendOperatorInviteAction, saveJourneyNoteAction, setStageAction } from '@/lib/operators/actions';
import { loadOperatorFile } from '@/lib/operators/desk';
import { loadOperator } from '@/lib/sales-workspace/team-data';
import DeskForm from '../../components/DeskForm';
import { Fact, NextStep, Pill, Section, area, danger, field, primary, secondary, when } from '../../components/desk';
import ApplicationAnswers from '../ApplicationAnswers';
import { StagePill } from '../JourneyTable';
import LiveSeat from './LiveSeat';

export const metadata: Metadata = { title: 'Operator' };
export const dynamic = 'force-dynamic';

/** The eight steps of the form the operator fills in on their portal. */
const FORM_STEPS = ['Identity', 'Availability', 'Experience', 'Equipment', 'Payout', 'Emergency contact', 'Acknowledgments', 'Motivation'];

const ANSWER_LABEL: Record<string, string> = {
  legal_name: 'Legal name',
  preferred_name: 'Goes by',
  personal_email: 'Personal email',
  mobile: 'Mobile',
  discord: 'Discord',
  city: 'City',
  region: 'Region',
  country: 'Country',
  time_zone: 'Time zone',
  weekly_hours: 'Weekly hours',
  work_days: 'Work days',
  work_hours: 'Work hours',
  earliest_start: 'Earliest start',
  time_off: 'Time off',
  us_zones: 'US zones',
  years: 'Years in sales',
  roles: 'Roles held',
  tools: 'Tools',
  industries: 'Industries',
  verticals: 'Verticals',
  laptop: 'Laptop',
  internet: 'Reliable internet',
  internet_speed: 'Speed test',
  headset: 'Headset',
  quiet: 'Quiet place',
  emergency_name: 'Emergency contact',
  emergency_relationship: 'Relationship',
  emergency_phone: 'Emergency phone',
  why: 'Why DA',
  skill: 'Strongest skill',
  year_goal: 'In 12 months',
};

const STATE_TONE = { met: 'good', missing: 'neutral', waived: 'warn', flagged: 'bad' } as const;
const STATE_LABEL = { met: 'Met', missing: 'Missing', waived: 'Waived', flagged: 'Flagged' } as const;

function display(value: unknown): string {
  if (Array.isArray(value)) return value.join(', ');
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return String(value ?? '');
}

export default async function OperatorFilePage({ params }: { params: Promise<{ operatorId: string }> }) {
  const { operatorId } = await params;
  const file = await loadOperatorFile(operatorId);
  if (!file) notFound();
  const { journey, view, admin } = file;
  const stage: HireStage | null = journey?.stage ?? view?.journey?.stage ?? null;
  const readiness = view?.readiness ?? [];
  const answers = (view?.answers ?? {}) as OnboardingDraft & Record<string, unknown>;
  const payout = Boolean(view?.payout_complete);
  const stepsDone = FORM_STEPS.map((_, index) => stepErrors(index + 1, answers, payout).length === 0);
  const seat = stage === 'placed' || stage === 'paused' ? await loadOperator(operatorId) : null;
  const placementId = seat?.data?.placement?.id ?? file.openPlacement?.id ?? null;
  const next = stage
    ? nextHireAction({ operatorId, stage, signedIn: Boolean(journey?.signed_in_at ?? view?.journey?.signed_in_at), readiness, placementId })
    : null;

  return (
    <div className="space-y-5">
      <Link href="/workspace/operators" className="text-sm text-neutral-400 hover:text-white">
        Operators
      </Link>

      <header className="panel rounded-2xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-white">{file.name}</h1>
              {stage ? <StagePill stage={stage} /> : <Pill>No hire record</Pill>}
            </div>
            <p className="mt-1 text-sm text-neutral-400">{[file.email, file.phone].filter(Boolean).join(' · ') || 'No contact details on file.'}</p>
          </div>
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-4">
          <Fact label="Stage">{stage ? STAGE_LABEL[stage] : 'Roster only'}</Fact>
          <Fact label="Manager">{journey?.manager_name ?? <span className="text-amber-200">None assigned</span>}</Fact>
          <Fact label="Invited">{when(journey?.invited_at)}</Fact>
          <Fact label="Ready since">{when(journey?.ready_at)}</Fact>
        </dl>
        {next ? (
          <div className="mt-4">
            <NextStep label={next.label} href={next.href} />
          </div>
        ) : (
          <p className="mt-4 text-sm text-neutral-500">
            This operator joined before the hire flow, so there is no stage to move. Their live seat is below.
          </p>
        )}
        {file.error ? <p className="mt-3 text-sm text-[#FFB020]">{file.error}</p> : null}
      </header>

      {journey ? (
        <>
          <Section id="application" title="Application" hint="Read-only, from the careers form.">
            {file.application ? (
              <>
                <ApplicationAnswers application={file.application} />
                <Link href={`/workspace/operators/applicants/${file.application.id}`} className="mt-3 inline-block text-sm text-brand-200 hover:text-white">
                  Open the application
                </Link>
              </>
            ) : (
              <p className="text-sm text-neutral-500">Added without an application.</p>
            )}
          </Section>

          <Section id="account" title="Invite and account">
            <dl className="grid gap-3 sm:grid-cols-4">
              <Fact label="Work email">{journey.work_email}</Fact>
              <Fact label="Signed in">{journey.signed_in_at ? when(journey.signed_in_at) : <span className="text-amber-200">Not yet</span>}</Fact>
              <Fact label="Invite sent">{when(file.invite?.last_sent_at)}</Fact>
              <Fact label="Invite expires">
                {file.invite?.accepted_at ? 'Accepted' : file.invite?.cancelled_at ? 'Cancelled' : when(file.invite?.expires_at)}
              </Fact>
            </dl>
            {admin && !journey.signed_in_at && file.invite && !file.invite.accepted_at && !file.invite.cancelled_at ? (
              <DeskForm action={resendOperatorInviteAction} className="mt-4 flex flex-wrap gap-2">
                <input type="hidden" name="invite_id" value={file.invite.id} />
                <input type="hidden" name="operator_id" value={operatorId} />
                <button type="submit" className={secondary}>
                  Resend the invite
                </button>
              </DeskForm>
            ) : null}
          </Section>

          <Section
            id="onboarding"
            title="Onboarding form"
            hint="The operator fills this in on their portal. Payout answers stay on the payout record."
            aside={<Pill tone={view?.submitted ? 'good' : 'neutral'}>{view?.submitted ? `Submitted ${when(view.submitted)}` : `${stepsDone.filter(Boolean).length} of 8 steps`}</Pill>}
          >
            <ol className="grid gap-2 sm:grid-cols-4">
              {FORM_STEPS.map((label, index) => (
                <li key={label} className="flex items-center gap-2 text-sm">
                  <span className={`size-2 rounded-full ${stepsDone[index] ? 'bg-emerald-400' : 'bg-white/15'}`} aria-hidden />
                  <span className={stepsDone[index] ? 'text-white' : 'text-neutral-500'}>
                    {index + 1}. {label}
                  </span>
                  <span className="sr-only">{stepsDone[index] ? 'complete' : 'not complete'}</span>
                </li>
              ))}
            </ol>
            {view?.setup_flags?.length ? (
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-neutral-400">Setup flags:</span>
                {view.setup_flags.map((flag) => (
                  <Pill key={flag} tone={view.setup_cleared ? 'neutral' : 'bad'}>
                    {flag}
                  </Pill>
                ))}
                {!view.setup_cleared ? (
                  <form
                    action={async () => {
                      'use server';
                      await clearSetupAction(operatorId);
                    }}
                  >
                    <button type="submit" className="text-sm text-brand-200 hover:text-white">
                      Clear flagged setup
                    </button>
                  </form>
                ) : (
                  <span className="text-neutral-500">Cleared</span>
                )}
              </div>
            ) : null}
            {Object.keys(answers).length ? (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-neutral-300">Answers</summary>
                <dl className="mt-3 grid gap-3 sm:grid-cols-3">
                  {Object.entries(answers)
                    .filter(([key]) => !/payout|account_number|routing|^ack_/i.test(key))
                    .map(([key, value]) => (
                      <Fact key={key} label={ANSWER_LABEL[key] ?? key.replaceAll('_', ' ')}>
                        <span className="whitespace-pre-wrap">{display(value) || '—'}</span>
                      </Fact>
                    ))}
                </dl>
              </details>
            ) : null}
          </Section>

          <Section id="readiness" title="Readiness" hint="All seven met or waived moves the operator to Ready. A waiver stays marked Waived.">
            <ul className="divide-y divide-white/[0.06]">
              {readiness.map((item) => (
                <li key={item.key} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-sm text-white">
                      {READINESS_LABEL[item.key] ?? item.key}
                      <Pill tone={STATE_TONE[item.state]}>{STATE_LABEL[item.state]}</Pill>
                    </span>
                    {item.detail ? <span className="mt-0.5 block text-xs text-neutral-500">{item.detail}</span> : null}
                  </span>
                  {admin && item.state !== 'waived' && item.state !== 'met' ? (
                    <DeskForm action={waiveReadinessAction} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="operator_id" value={operatorId} />
                      <input type="hidden" name="item" value={item.key} />
                      <input name="reason" required minLength={3} placeholder="Reason" aria-label={`Reason to waive ${READINESS_LABEL[item.key]}`} className={field} />
                      <button type="submit" className={secondary}>
                        Waive
                      </button>
                    </DeskForm>
                  ) : null}
                </li>
              ))}
            </ul>

            <div className="mt-4 border-t border-white/[0.06] pt-4">
              <h3 className="text-sm font-semibold text-white">Certification override</h3>
              {view?.override ? (
                <p className="mt-1 text-sm text-neutral-300">
                  Through {view.override.expires_on}, {view.override.days_left} days left. {view.override.modules_done} of {view.override.modules_total} lessons
                  done. {view.override.reason}
                </p>
              ) : (
                <p className="mt-1 text-sm text-neutral-500">None. Up to 60 days; an exception allows up to 365. It is not a certification.</p>
              )}
              {admin ? (
                <div className="mt-3 space-y-3">
                  {!view?.override ? (
                    <DeskForm action={grantOverrideAction} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="operator_id" value={operatorId} />
                      <input type="hidden" name="email" value={journey.work_email} />
                      <input type="hidden" name="name" value={file.name} />
                      <input name="reason" required minLength={3} placeholder="Reason" aria-label="Override reason" className={field} />
                      <input name="start" type="date" aria-label="Override start" className={field} />
                      <input name="days" type="number" min={1} max={365} defaultValue={30} aria-label="Override days" className={`${field} w-24`} />
                      <label className="flex items-center gap-1.5 text-sm text-neutral-300">
                        <input type="checkbox" name="exception" /> Exception past 60 days
                      </label>
                      <button type="submit" className={secondary}>
                        Grant override
                      </button>
                    </DeskForm>
                  ) : (
                    <>
                      <DeskForm action={extendOverrideAction} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="override_id" value={view.override.id} />
                        <input name="expires" type="date" required aria-label="New expiry" className={field} />
                        <input name="reason" required minLength={3} placeholder="Why extend" aria-label="Extend reason" className={field} />
                        <label className="flex items-center gap-1.5 text-sm text-neutral-300">
                          <input type="checkbox" name="exception" /> Exception
                        </label>
                        <button type="submit" className={secondary}>
                          Extend
                        </button>
                      </DeskForm>
                      <DeskForm action={revokeOverrideAction} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="override_id" value={view.override.id} />
                        <input name="reason" required minLength={3} placeholder="Why revoke" aria-label="Revoke reason" className={field} />
                        <button type="submit" className={danger}>
                          Revoke
                        </button>
                      </DeskForm>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          </Section>

          <Section
            id="agreement"
            title="Agreement"
            hint="From the DocuSeal flow. Sending one starts on Agreements."
            aside={
              admin ? (
                <Link href="/workspace/agreements" className="text-sm text-brand-200 hover:text-white">
                  Agreements
                </Link>
              ) : null
            }
          >
            {file.agreements.length === 0 ? (
              <p className="text-sm text-neutral-500">No agreement sent to this operator yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {file.agreements.map((agreement) => (
                  <li key={agreement.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-white">{agreement.template ?? 'Agreement'}</span>
                    <span className="flex items-center gap-2 text-neutral-400">
                      <Pill tone={agreement.status === 'completed' ? 'good' : agreement.status === 'declined' || agreement.status === 'expired' ? 'bad' : 'warn'}>
                        {agreement.status}
                      </Pill>
                      sent {when(agreement.sent_at)}
                      {agreement.completed_at ? ` · signed ${when(agreement.completed_at)}` : ''}
                      {agreement.signed_document_url ? (
                        <a href={agreement.signed_document_url} target="_blank" rel="noopener noreferrer" className="text-brand-200 hover:text-white">
                          Signed copy
                        </a>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section id="note" title="Note and stage reason">
            <dl className="mb-4 grid gap-3 sm:grid-cols-2">
              <Fact label="Stage reason">{journey.stage_reason ?? '—'}</Fact>
              <Fact label="Last change">{when(journey.updated_at)}</Fact>
            </dl>
            {admin ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <DeskForm action={saveJourneyNoteAction} className="grid gap-2">
                  <input type="hidden" name="operator_id" value={operatorId} />
                  <textarea name="note" defaultValue={journey.note ?? ''} className={area} aria-label="Note" placeholder="A note for whoever opens this file next" />
                  <button type="submit" className={`${secondary} justify-self-start`}>
                    Save note
                  </button>
                </DeskForm>
                <DeskForm action={setStageAction} className="grid content-start gap-2">
                  <input type="hidden" name="operator_id" value={operatorId} />
                  <div className="flex flex-wrap gap-2">
                    <select name="stage" defaultValue={journey.stage} aria-label="Stage" className={field}>
                      {(['invited', 'onboarding', 'ready', 'paused'] as const).map((value) => (
                        <option key={value} value={value}>
                          {STAGE_LABEL[value]}
                        </option>
                      ))}
                    </select>
                    <input name="reason" required minLength={3} placeholder="Why" aria-label="Why you are setting the stage" className={`${field} flex-1`} />
                  </div>
                  <button type="submit" className={`${secondary} justify-self-start`}>
                    Set stage
                  </button>
                  <p className="text-xs text-neutral-500">Signing in, readiness, and a placement still move the stage on their own.</p>
                </DeskForm>
              </div>
            ) : journey.note ? (
              <p className="whitespace-pre-wrap text-sm text-neutral-200">{journey.note}</p>
            ) : null}
          </Section>
        </>
      ) : null}

      {stage === 'ready' ? (
        <div className="panel flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-4">
          <p className="text-sm text-neutral-300">Ready to place. The wizard opens with this operator chosen; pick the client in step 2.</p>
          <Link href={`/workspace/placements/new?operator=${operatorId}`} className={primary}>
            Place on a client
          </Link>
        </div>
      ) : null}

      <LiveSeat operatorId={operatorId} />

      {admin && journey ? (
        <Section id="exit" title="GHL and off-boarding">
          <DeskForm action={saveGhlAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="operator_id" value={operatorId} />
            <input type="hidden" name="placement_id" value={placementId ?? ''} />
            <input type="hidden" name="client_id" value={file.openPlacement?.case_file_id ?? ''} />
            <select name="user" aria-label="GHL user exists" className={field}>
              <option value="no">GHL user: no</option>
              <option value="yes">GHL user: yes</option>
            </select>
            <select name="mapped" aria-label="Mapped" className={field}>
              <option value="no">Mapped: no</option>
              <option value="yes">Mapped: yes</option>
            </select>
            <select name="phone" aria-label="Phone" className={field}>
              <option value="no">Phone: no</option>
              <option value="yes">Phone: yes</option>
              <option value="not_needed">Phone: not needed</option>
            </select>
            <input name="confirmed_on" type="date" aria-label="Date confirmed" className={field} />
            <button type="submit" className={secondary}>
              Save GHL readiness
            </button>
          </DeskForm>
          {view?.ghl?.length ? (
            <ul className="mt-2 text-sm text-neutral-400">
              {view.ghl.map((row) => (
                <li key={row.id}>
                  GHL user {row.user ? 'yes' : 'no'} · mapped {row.mapped ? 'yes' : 'no'} · phone {row.phone ?? 'no'} · operator confirmed{' '}
                  {row.operator_confirmed ? 'yes' : 'no'}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-5 border-t border-white/[0.06] pt-4">
            {stage === 'offboarded' ? (
              <ul className="space-y-1 text-sm">
                {(view?.offboard ?? []).map((item) => (
                  <li key={item.key} className="flex items-center justify-between gap-2">
                    <span className={item.done ? 'text-neutral-500 line-through' : 'text-white'}>{item.label}</span>
                    {!item.done ? (
                      <DeskForm action={tickOffboardAction}>
                        <input type="hidden" name="operator_id" value={operatorId} />
                        <input type="hidden" name="item" value={item.key} />
                        <button className="text-brand-200 hover:text-white" type="submit">
                          Done
                        </button>
                      </DeskForm>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <DeskForm action={offboardAction} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="operator_id" value={operatorId} />
                <input name="last_day" type="date" required aria-label="Last day" className={field} />
                <input name="reason" required minLength={3} placeholder="Why they are leaving" aria-label="Off-board reason" className={field} />
                <button type="submit" className={danger}>
                  Off-board
                </button>
              </DeskForm>
            )}
          </div>
        </Section>
      ) : null}
    </div>
  );
}
