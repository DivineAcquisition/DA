'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  generateHsCallCalendarLinkAction,
  markHsCallCalendarSentAction,
  saveHsCallAnswerAction,
  saveHsCallNotesAction,
  saveHsStageProgressAction,
  setHsCallOutcomeAction,
  updateHsCallStatusAction,
} from '@/lib/workspace/hs-call-actions';
import {
  HS_CALL_STAGES,
  HS_CALL_STATUSES,
  HS_STAGE_PROGRESS_KEY,
  hsCallRoleLabel,
  hsCallStatusLabel,
  hsCrewCountLabel,
  hsFitChecks,
  hsPhoneCoverageLabel,
  hsTradeLabel,
  nextHsStageId,
  type HsCallAnswer,
  type HsCallRecord,
  type HsCallStageId,
  type HsCallStatus,
  type HsFitTone,
  type HsStageProgress,
} from '@/lib/workspace/hs-calls';
import { formatDateTime } from '@/lib/workspace/format';
import { Button, CopyButton, Dialog, Select, Textarea, ws } from '../../../components/ui';

const FIT_COLOR: Record<HsFitTone, string> = {
  green: '#7AFF8A',
  amber: '#FFD06A',
  red: '#FF6A6A',
};

const ACCENT = '#937DFF';
const SUCCESS = '#7AFF8A';
const FLAG_FILL = '#FFD06A';
const PRIMARY_BTN = '#6A00FF';

function headingClass(extra = '') {
  return `font-[family-name:var(--font-plus-jakarta)] tracking-tight text-white ${extra}`;
}

function useDebounced<T>(value: T, delay: number, onChange: (value: T) => void, enabled: boolean) {
  const skip = useRef(true);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!enabled) return;
    if (skip.current) {
      skip.current = false;
      return;
    }
    const timer = window.setTimeout(() => onChangeRef.current(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay, enabled]);
}

function ClickToCopy({ value, empty = '—' }: { value: string | null; empty?: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) return <span className="text-[#6E6C80]">{empty}</span>;
  return (
    <button
      type="button"
      className="text-left text-sm text-[#937DFF] hover:underline"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      }}
    >
      {copied ? 'Copied' : value}
    </button>
  );
}

function CallTimer() {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const tick = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(tick);
  }, []);
  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;
  const body =
    hours > 0
      ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return <span className="tabular-nums text-sm font-semibold text-white">{body}</span>;
}

function answersMap(rows: HsCallAnswer[]): Record<string, { text: string; flagged: boolean }> {
  const map: Record<string, { text: string; flagged: boolean }> = {};
  for (const row of rows) {
    if (row.question_key === HS_STAGE_PROGRESS_KEY) continue;
    map[row.question_key] = { text: row.answer_text ?? '', flagged: row.flagged };
  }
  return map;
}

export default function HsCallWorkspace({
  call,
  answers,
  progress,
  calendarUrl,
}: {
  call: HsCallRecord;
  answers: HsCallAnswer[];
  progress: HsStageProgress;
  calendarUrl: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<HsCallStatus>(call.status);
  const [notes, setNotes] = useState(call.outcome_note ?? '');
  const [openStage, setOpenStage] = useState<HsCallStageId>(progress.open);
  const [completed, setCompleted] = useState<HsCallStageId[]>(progress.completed);
  const [fields, setFields] = useState(() => answersMap(answers));
  const [linkUrl, setLinkUrl] = useState(calendarUrl);
  const [sentAt, setSentAt] = useState(call.calendar_sent_at);
  const [pendingOutcome, setPendingOutcome] = useState<'booked' | 'not_booked' | 'no_show' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const persistProgress = useCallback(
    (nextOpen: HsCallStageId, nextCompleted: HsCallStageId[]) => {
      startTransition(async () => {
        await saveHsStageProgressAction(call.id, nextOpen, nextCompleted);
      });
    },
    [call.id],
  );

  useDebounced(notes, 2000, (value) => {
    startTransition(async () => {
      await saveHsCallNotesAction(call.id, value);
    });
  }, true);

  const fieldSignature = JSON.stringify(fields);
  useDebounced(
    fieldSignature,
    2000,
    () => {
      startTransition(async () => {
        await Promise.all(
          Object.entries(fields).map(([key, value]) =>
            saveHsCallAnswerAction({
              callId: call.id,
              questionKey: key,
              answerText: value.text,
              flagged: value.flagged,
            }),
          ),
        );
      });
    },
    true,
  );

  function open(stage: HsCallStageId) {
    setOpenStage(stage);
    persistProgress(stage, completed);
  }

  function markComplete(stage: HsCallStageId) {
    const nextCompleted = completed.includes(stage) ? completed : [...completed, stage];
    const nextOpen = nextHsStageId(stage) ?? stage;
    setCompleted(nextCompleted);
    setOpenStage(nextOpen);
    persistProgress(nextOpen, nextCompleted);
  }

  function setAnswer(key: string, patch: Partial<{ text: string; flagged: boolean }>) {
    setFields((current) => ({
      ...current,
      [key]: {
        text: patch.text ?? current[key]?.text ?? '',
        flagged: patch.flagged ?? current[key]?.flagged ?? false,
      },
    }));
  }

  const fits = hsFitChecks(call);

  return (
    <div className="-mx-5 -my-8 flex min-h-[calc(100vh-4rem)] flex-col sm:-mx-8 sm:-my-10 lg:min-h-screen">
      <header className="sticky top-16 z-20 flex flex-wrap items-center gap-3 border-b border-[#2A2A3A] bg-[#0B0B0F]/90 px-4 py-3 backdrop-blur-xl lg:top-0 lg:px-6">
        <div className="min-w-0 flex-1">
          <p className={headingClass('truncate text-base font-semibold')}>{call.contact_name}</p>
          <p className="truncate text-sm text-[#B0AEC0]">{call.company_name}</p>
        </div>
        <span className="inline-flex items-center rounded-full border border-[#937DFF]/40 bg-[#241442] px-2.5 py-0.5 text-[11px] font-semibold text-[#937DFF]">
          {hsTradeLabel(call.trade)}
        </span>
        <CallTimer />
        <Select
          value={status}
          className="w-40"
          onChange={(e) => {
            const next = e.target.value as HsCallStatus;
            setStatus(next);
            startTransition(async () => {
              await updateHsCallStatusAction(call.id, next);
            });
          }}
        >
          {HS_CALL_STATUSES.map((item) => (
            <option key={item} value={item}>
              {hsCallStatusLabel(item)}
            </option>
          ))}
        </Select>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(220px,300px)_minmax(0,1fr)_minmax(240px,320px)] lg:items-start lg:gap-5 lg:p-5">
        <section className="space-y-4">
          <div className={`${ws.card} p-4`}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#937DFF]">Context</p>
            <h2 className={headingClass('mt-2 text-lg font-semibold')}>{call.company_name}</h2>
            <p className="mt-1 text-sm text-[#B0AEC0]">{hsTradeLabel(call.trade)}</p>
            <p className="mt-4 text-sm text-white">
              {call.contact_name}
              <span className="text-[#6E6C80]"> · {hsCallRoleLabel(call.role)}</span>
            </p>
            <p className="mt-4 text-sm text-[#B0AEC0]">Crew: {hsCrewCountLabel(call.crew_count)}</p>
            <p className={headingClass('mt-5 text-2xl font-semibold')}>
              {hsPhoneCoverageLabel(call.who_answers_phone)}
            </p>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6E6C80]">Who answers the phone</p>
            {call.stated_pain ? (
              <blockquote className="mt-4 border-l-2 border-[#937DFF]/50 pl-3 text-sm italic text-[#B0AEC0]">
                “{call.stated_pain}”
              </blockquote>
            ) : (
              <p className="mt-4 text-sm text-[#6E6C80]">No stated pain on the lead form.</p>
            )}
            <dl className="mt-4 space-y-2 text-sm">
              <div>
                <dt className="text-[11px] uppercase tracking-[0.12em] text-[#6E6C80]">Phone</dt>
                <dd>
                  <ClickToCopy value={call.phone} />
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.12em] text-[#6E6C80]">Email</dt>
                <dd>
                  <ClickToCopy value={call.email} />
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.12em] text-[#6E6C80]">Source</dt>
                <dd className="text-[#B0AEC0]">{call.source || '—'}</dd>
              </div>
            </dl>
          </div>

          <div className={`${ws.card} p-4`}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#937DFF]">Fit</p>
            <ul className="mt-3 space-y-2.5">
              {fits.map((check) => (
                <li key={check.key} className="flex items-center gap-2.5 text-sm text-[#B0AEC0]">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: FIT_COLOR[check.tone] }}
                    aria-hidden
                  />
                  {check.label}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className={`${ws.card} p-4 sm:p-5`}>
          <div className="mb-4 flex items-center justify-center gap-3">
            {HS_CALL_STAGES.map((stage) => {
              const filled = completed.includes(stage.id);
              return (
                <button
                  key={stage.id}
                  type="button"
                  aria-label={`${stage.title}${filled ? ' complete' : ''}`}
                  onClick={() => open(stage.id)}
                  className="h-2.5 w-2.5 rounded-full border"
                  style={{
                    backgroundColor: filled ? ACCENT : 'transparent',
                    borderColor: filled ? ACCENT : '#2A2A3A',
                  }}
                />
              );
            })}
          </div>

          <div className="divide-y divide-[#2A2A3A]">
            {HS_CALL_STAGES.map((stage) => {
              const isOpen = openStage === stage.id;
              return (
                <div key={stage.id}>
                  <button
                    type="button"
                    onClick={() => open(stage.id)}
                    className="flex w-full items-center justify-between gap-3 py-3 text-left"
                  >
                    <span className={headingClass('text-base font-semibold')} style={{ color: ACCENT }}>
                      {stage.title}
                    </span>
                    <span className="text-xs text-[#6E6C80]">{stage.duration}</span>
                  </button>
                  {isOpen && (
                    <div className="pb-5">
                      <p className="text-sm text-[#6E6C80]">{stage.instruction}</p>
                      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[#B0AEC0]">
                        {stage.prompts.map((prompt) => (
                          <li key={prompt}>{prompt}</li>
                        ))}
                      </ul>
                      {stage.questions.length > 0 && (
                        <div className="mt-4 space-y-3">
                          {stage.questions.map((question) => {
                            const current = fields[question.key] ?? { text: '', flagged: false };
                            return (
                              <div key={question.key}>
                                <div className="mb-1.5 flex items-center justify-between gap-2">
                                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6E6C80]">
                                    {question.label}
                                  </span>
                                  {question.flaggable && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const next = !current.flagged;
                                        setAnswer(question.key, { flagged: next });
                                        startTransition(async () => {
                                          await saveHsCallAnswerAction({
                                            callId: call.id,
                                            questionKey: question.key,
                                            answerText: current.text,
                                            flagged: next,
                                          });
                                        });
                                      }}
                                      className="rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
                                      style={
                                        current.flagged
                                          ? {
                                              backgroundColor: FLAG_FILL,
                                              borderColor: FLAG_FILL,
                                              color: '#0B0B0F',
                                            }
                                          : { borderColor: '#2A2A3A', color: '#B0AEC0' }
                                      }
                                    >
                                      Flag
                                    </button>
                                  )}
                                </div>
                                <Textarea
                                  value={current.text}
                                  onChange={(e) => setAnswer(question.key, { text: e.target.value })}
                                  className="min-h-24"
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {stage.objections && (
                        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {stage.objections.map((row) => (
                            <div key={row.ifTheySay} className="rounded-xl border border-[#2A2A3A] bg-[#1C1C26] p-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6E6C80]">
                                If they say
                              </p>
                              <p className="mt-1 text-sm text-white">“{row.ifTheySay}”</p>
                              <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6E6C80]">
                                Respond
                              </p>
                              <p className="mt-1 text-sm text-[#B0AEC0]">{row.respond}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="mt-4">
                        <Button
                          type="button"
                          size="sm"
                          style={{ backgroundColor: PRIMARY_BTN, color: '#fff' }}
                          onClick={() => markComplete(stage.id)}
                        >
                          Mark complete
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div className={`${ws.card} p-4`}>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6E6C80]">
                Notes
              </span>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-40 font-mono text-[13px]"
              />
            </label>
          </div>

          <div className={`${ws.card} p-4`}>
            <p className={headingClass('text-base font-semibold')}>Book the audit</p>
            {sentAt ? (
              <p className="mt-3 text-sm font-semibold" style={{ color: SUCCESS }}>
                Link sent
                <span className="mt-1 block font-normal text-[#6E6C80]">{formatDateTime(sentAt)}</span>
              </p>
            ) : (
              <>
                <Button
                  type="button"
                  className="mt-3 w-full"
                  style={{ backgroundColor: PRIMARY_BTN, color: '#fff' }}
                  onClick={() => {
                    setError(null);
                    startTransition(async () => {
                      const result = await generateHsCallCalendarLinkAction(call.id);
                      if (!result.ok) setError(result.error);
                      else setLinkUrl(String(result.data?.url ?? ''));
                    });
                  }}
                >
                  Generate calendar link
                </Button>
                {linkUrl && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-[#2A2A3A] p-3">
                    <code className="min-w-0 flex-1 truncate text-xs text-[#937DFF]">{linkUrl}</code>
                    <CopyButton value={linkUrl} />
                  </div>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-3 w-full"
                  disabled={!linkUrl}
                  onClick={() => {
                    startTransition(async () => {
                      const result = await markHsCallCalendarSentAction(call.id);
                      if (!result.ok) setError(result.error);
                      else setSentAt(new Date().toISOString());
                    });
                  }}
                >
                  Mark as sent
                </Button>
              </>
            )}
          </div>

          <div className="space-y-2">
            <OutcomeButton label="Audit booked" tone="success" onClick={() => setPendingOutcome('booked')} />
            <OutcomeButton label="Not booked" tone="danger" onClick={() => setPendingOutcome('not_booked')} />
            <OutcomeButton label="No show" tone="danger" onClick={() => setPendingOutcome('no_show')} />
          </div>
          {error && <p className="text-sm text-[#FF6A6A]">{error}</p>}
        </section>
      </div>

      <Dialog
        open={pendingOutcome !== null}
        onClose={() => setPendingOutcome(null)}
        title="Confirm outcome"
      >
        <p className="text-sm text-[#B0AEC0]">
          {pendingOutcome === 'booked'
            ? 'Mark this call as audit booked and return to the list?'
            : pendingOutcome === 'not_booked'
              ? 'Mark this call as not booked and return to the list?'
              : 'Mark this call as no show and return to the list?'}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setPendingOutcome(null)}>
            Cancel
          </Button>
          <Button
            type="button"
            style={{ backgroundColor: PRIMARY_BTN, color: '#fff' }}
            onClick={() => {
              const outcome = pendingOutcome;
              if (!outcome) return;
              startTransition(async () => {
                const result = await setHsCallOutcomeAction(call.id, outcome);
                if (result && !result.ok) {
                  setError(result.error);
                  setPendingOutcome(null);
                } else {
                  router.push('/workspace/hs/calls');
                }
              });
            }}
          >
            Confirm
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

function OutcomeButton({
  label,
  tone,
  onClick,
}: {
  label: string;
  tone: 'success' | 'danger';
  onClick: () => void;
}) {
  const color = tone === 'success' ? SUCCESS : '#FF6A6A';
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-full border px-5 py-2.5 text-sm font-semibold"
      style={{ color, borderColor: `${color}66`, backgroundColor: `${color}14` }}
    >
      {label}
    </button>
  );
}
