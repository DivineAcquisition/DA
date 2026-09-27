'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Logo from '@/app/components/Logo';
import type { FinishResult, OnboardingPageState, SaveResult } from '@/lib/workspace/onboarding';
import {
  groupSteps,
  isDone,
  isVisible,
  progress,
  type OnboardingAnswer,
  type OnboardingStep,
} from '@/lib/workspace/onboarding-steps';

type Props = { token: string; initial: OnboardingPageState };

const INVALID_MESSAGE =
  "This link isn't valid or has expired. If you're expecting onboarding from Divine Acquisition, reply to the email it came in and we'll send you a fresh one.";

type SaveStatus = { state: 'saving' } | { state: 'saved' } | { state: 'error'; message: string };

const inputClass =
  'w-full rounded-xl border border-[var(--ws-border)] bg-[var(--ws-panel)] px-3.5 py-3 text-base text-white outline-none focus:border-[var(--ws-accent)] sm:text-sm';

export default function OnboardingView({ token, initial }: Props) {
  switch (initial.state) {
    case 'invalid':
      return (
        <Shell>
          <Card>
            <p className="text-sm leading-relaxed text-[var(--ws-body)]">{INVALID_MESSAGE}</p>
          </Card>
        </Shell>
      );
    case 'sign_first':
      return (
        <Shell>
          <Card>
            <h1 className="text-xl font-semibold text-white">Sign your agreement first</h1>
            <p className="mt-2 text-sm leading-relaxed text-[var(--ws-body)]">
              Onboarding opens once your agreement is signed. It only takes a few minutes, and you&apos;ll come
              straight back here.
            </p>
            {initial.agreementToken ? (
              <a
                href={`/s/${encodeURIComponent(initial.agreementToken)}`}
                className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-[var(--ws-btn)] px-6 py-3 text-sm font-semibold text-[var(--ws-page)]"
              >
                Go to my agreement
              </a>
            ) : (
              <p className="mt-4 text-sm text-[var(--ws-body)]">
                Reach out to Divine Acquisition
                {initial.contactEmail ? (
                  <>
                    {' '}at{' '}
                    <a className="text-[var(--ws-accent)] underline" href={`mailto:${initial.contactEmail}`}>
                      {initial.contactEmail}
                    </a>
                  </>
                ) : null}{' '}
                and we&apos;ll send you a fresh agreement link.
              </p>
            )}
          </Card>
        </Shell>
      );
    case 'completed':
      return <Completed page={initial} />;
    case 'open':
      return <Steps token={token} page={initial} />;
  }
}

function Completed({ page }: { page: Extract<OnboardingPageState, { state: 'completed' }> }) {
  const firstName = page.recipientName.split(/\s+/)[0] || 'there';
  const next =
    page.nextSteps ??
    (page.recipientType === 'client'
      ? 'Next up is your kickoff. Divine Acquisition will reach out to schedule it.'
      : 'Next up is your training. Divine Acquisition will send your training schedule and shift details.');
  return (
    <Shell>
      <Card>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--ws-success)]/15 text-2xl text-[var(--ws-success)]">
          ✓
        </div>
        <h1 className="mt-5 text-2xl font-semibold text-white">You&apos;re all set, {firstName}!</h1>
        <p className="mt-2 text-sm text-[var(--ws-body)]">{page.protocolName} is complete. Welcome aboard.</p>
        <div className="mt-6 rounded-xl border border-[var(--ws-border)] bg-[var(--ws-panel)] p-4 text-left">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ws-accent)]">What happens next</p>
          <p className="mt-2 text-sm leading-relaxed text-white">{next}</p>
          {page.hasOpenAccessIssue && (
            <p className="mt-3 text-sm leading-relaxed text-[var(--ws-pending)]">
              You told us some tool access hasn&apos;t arrived yet. We&apos;re on it and will get you set up.
            </p>
          )}
        </div>
        {page.contactEmail && (
          <p className="mt-5 text-sm text-[var(--ws-body)]">
            Questions? Email{' '}
            <a className="text-[var(--ws-accent)] underline" href={`mailto:${page.contactEmail}`}>
              {page.contactEmail}
            </a>
          </p>
        )}
      </Card>
    </Shell>
  );
}

function Steps({ token, page }: { token: string; page: Extract<OnboardingPageState, { state: 'open' }> }) {
  const [answers, setAnswers] = useState<Record<string, OnboardingAnswer>>(page.answers);
  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    const initialDrafts: Record<string, string> = {};
    for (const step of page.steps) {
      if (step.kind !== 'form_question') continue;
      initialDrafts[step.key] = page.answers[step.key]?.value ?? '';
    }
    return initialDrafts;
  });
  const [status, setStatus] = useState<Record<string, SaveStatus>>({});
  const [groupIndex, setGroupIndex] = useState(0);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [lockedMessage, setLockedMessage] = useState<string | null>(null);
  const timers = useRef<Record<string, number>>({});
  const lastInput = useRef<Record<string, Record<string, unknown>>>({});
  const inflight = useRef<Record<string, Promise<boolean>>>({});

  const groups = useMemo(() => groupSteps(page.steps), [page.steps]);
  const count = progress(page.steps, answers);
  const group = groups[Math.min(groupIndex, groups.length - 1)];
  const isLast = groupIndex >= groups.length - 1;

  const save = useCallback(
    async (step: OnboardingStep, input: Record<string, unknown>): Promise<boolean> => {
      lastInput.current[step.key] = input;
      setStatus((prev) => ({ ...prev, [step.key]: { state: 'saving' } }));
      const request = (async () => {
        try {
          const response = await fetch(`/o/${encodeURIComponent(token)}/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ step: step.key, input }),
          });
          const result = (await response.json()) as SaveResult;
          if (!result.ok) {
            if (result.error === 'locked' || result.error === 'sign_first' || result.error === 'invalid') {
              setLockedMessage(result.message ?? 'This link can no longer be edited. Reload the page.');
            }
            setStatus((prev) => ({
              ...prev,
              [step.key]: { state: 'error', message: result.message ?? "That didn't save. Try again." },
            }));
            return false;
          }
          setAnswers((prev) => {
            const next = { ...prev };
            if (result.answer) next[step.key] = result.answer;
            else delete next[step.key];
            return next;
          });
          setStatus((prev) => ({ ...prev, [step.key]: { state: 'saved' } }));
          return true;
        } catch {
          setStatus((prev) => ({
            ...prev,
            [step.key]: { state: 'error', message: "Not saved: you look offline. We'll keep what you typed." },
          }));
          return false;
        }
      })();
      inflight.current[step.key] = request;
      return request;
    },
    [token],
  );

  const retry = useCallback(
    (step: OnboardingStep) => {
      const input = lastInput.current[step.key];
      if (input) void save(step, input);
    },
    [save],
  );

  // Text answers save a moment after typing stops, and immediately on leaving the field.
  const queueText = useCallback(
    (step: OnboardingStep, value: string, delay = 900) => {
      window.clearTimeout(timers.current[step.key]);
      timers.current[step.key] = window.setTimeout(() => {
        delete timers.current[step.key];
        if ((answers[step.key]?.value ?? '') !== value.trim()) void save(step, { value });
      }, delay);
    },
    [answers, save],
  );

  // Details we already know are filled in and saved, so they count as answered.
  useEffect(() => {
    for (const step of page.steps) {
      if (step.kind !== 'form_question' || !step.prefill || page.answers[step.key]) continue;
      const known = page.prefill[step.prefill];
      if (known) {
        setDrafts((prev) => ({ ...prev, [step.key]: known }));
        void save(step, { value: known });
      }
    }
    // Run once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Warn before leaving with a save still pending or failed.
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      const pending =
        Object.keys(timers.current).length > 0 ||
        Object.values(status).some((s) => s.state === 'saving' || s.state === 'error');
      if (pending) event.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [status]);

  async function flushPending() {
    const keys = Object.keys(timers.current);
    for (const key of keys) {
      window.clearTimeout(timers.current[key]);
      delete timers.current[key];
      const step = page.steps.find((s) => s.key === key);
      if (step && (answers[key]?.value ?? '') !== (drafts[key] ?? '').trim()) {
        await save(step, { value: drafts[key] ?? '' });
      }
    }
    await Promise.all(Object.values(inflight.current));
  }

  function goTo(index: number) {
    setGroupIndex(Math.max(0, Math.min(groups.length - 1, index)));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function jumpToStep(key: string) {
    const index = groups.findIndex((g) => g.steps.some((s) => s.key === key));
    if (index >= 0) goTo(index);
    setHighlight(key);
    window.setTimeout(() => document.getElementById(`step-${key}`)?.scrollIntoView({ block: 'center' }), 150);
  }

  async function finish() {
    if (finishing) return;
    setFinishError(null);
    setFinishing(true);
    try {
      await flushPending();
      // The server decides what is missing; it sends back the first step to fix.
      const response = await fetch(`/o/${encodeURIComponent(token)}/finish`, { method: 'POST' });
      const result = (await response.json()) as FinishResult;
      if (result.ok) {
        window.location.reload();
        return;
      }
      if (result.step) {
        setFinishError(result.message ?? 'One more thing needs an answer before you can finish.');
        jumpToStep(result.step);
      } else {
        setFinishError(result.message ?? "We couldn't finish just now. Your answers are saved; try again.");
      }
    } catch {
      setFinishError("You look offline. Your answers are saved; try again once you're back online.");
    } finally {
      setFinishing(false);
    }
  }

  const percent = count.total ? Math.round((count.done / count.total) * 100) : 0;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <header className="mb-5 flex items-center justify-between gap-4">
        <Logo className="h-7 w-auto" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ws-dim)]">Onboarding</span>
      </header>

      <section className="rounded-2xl border border-[var(--ws-border)] bg-[var(--ws-card)] p-5 sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ws-accent)]">
          Welcome, {page.recipientName}
        </p>
        <h1 className="mt-2 text-2xl font-semibold leading-tight text-white">{page.protocolName}</h1>
        {groupIndex === 0 && page.protocolIntro && (
          <p className="mt-2 text-sm leading-relaxed text-[var(--ws-body)]">{page.protocolIntro}</p>
        )}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-[var(--ws-body)]">
            <span>
              {count.done} of {count.total} done
            </span>
            <span>
              Page {groupIndex + 1} of {groups.length}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--ws-panel)]" aria-hidden>
            <div className="h-full rounded-full bg-[var(--ws-accent)] transition-all" style={{ width: `${percent}%` }} />
          </div>
        </div>
      </section>

      {lockedMessage && (
        <p className="mt-4 rounded-xl border border-[var(--ws-error)]/40 bg-[var(--ws-error)]/10 p-3 text-sm text-white">
          {lockedMessage}
        </p>
      )}

      {group && (
        <section className="animate-rise mt-4 rounded-2xl border border-[var(--ws-border)] bg-[var(--ws-card)] p-5 sm:p-6">
          {group.title && <h2 className="text-lg font-semibold text-white">{group.title}</h2>}
          {group.intro && <p className="mt-1 text-sm text-[var(--ws-body)]">{group.intro}</p>}
          <div className={group.title ? 'mt-5 space-y-6' : 'space-y-6'}>
            {group.steps
              .filter((step) => isVisible(step, answers))
              .map((step) => (
                <StepBlock
                  key={step.key}
                  step={step}
                  answer={answers[step.key]}
                  draft={drafts[step.key] ?? ''}
                  status={status[step.key]}
                  highlighted={highlight === step.key && !isDone(step, answers[step.key])}
                  onDraft={(value) => {
                    setDrafts((prev) => ({ ...prev, [step.key]: value }));
                    queueText(step, value);
                  }}
                  onBlurText={() => queueText(step, drafts[step.key] ?? '', 0)}
                  onChoose={(value) => {
                    setDrafts((prev) => ({ ...prev, [step.key]: value }));
                    void save(step, { value });
                  }}
                  onSave={(input) => void save(step, input)}
                  onRetry={() => retry(step)}
                />
              ))}
          </div>
        </section>
      )}

      {finishError && (
        <p role="alert" className="mt-4 rounded-xl border border-[var(--ws-pending)]/40 bg-[var(--ws-pending)]/10 p-3 text-sm text-white">
          {finishError}
        </p>
      )}

      <nav className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={() => {
            setFinishError(null);
            goTo(groupIndex - 1);
          }}
          disabled={groupIndex === 0}
          className="flex-1 rounded-xl border border-[var(--ws-border)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-40"
        >
          Back
        </button>
        {isLast ? (
          <button
            type="button"
            onClick={() => void finish()}
            disabled={finishing}
            className="flex-[2] rounded-xl bg-[var(--ws-btn)] px-5 py-3 text-sm font-semibold text-[var(--ws-page)] disabled:opacity-60"
          >
            {finishing ? 'Finishing…' : 'Finish onboarding'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setFinishError(null);
              goTo(groupIndex + 1);
            }}
            className="flex-[2] rounded-xl bg-[var(--ws-btn)] px-5 py-3 text-sm font-semibold text-[var(--ws-page)]"
          >
            Next
          </button>
        )}
      </nav>
      <p className="mt-4 text-center text-xs text-[var(--ws-dim)]">
        Everything saves as you go. You can close this and come back any time.
      </p>
    </div>
  );
}

type StepProps = {
  step: OnboardingStep;
  answer: OnboardingAnswer | undefined;
  draft: string;
  status: SaveStatus | undefined;
  highlighted: boolean;
  onDraft: (value: string) => void;
  onBlurText: () => void;
  onChoose: (value: string) => void;
  onSave: (input: Record<string, unknown>) => void;
  onRetry: () => void;
};

function StepBlock({ step, answer, draft, status, highlighted, onDraft, onBlurText, onChoose, onSave, onRetry }: StepProps) {
  const ring = highlighted ? 'rounded-xl ring-2 ring-[var(--ws-pending)] ring-offset-4 ring-offset-[var(--ws-card)]' : '';
  return (
    <div id={`step-${step.key}`} className={ring}>
      {step.kind === 'form_question' && (
        <FormQuestion step={step} draft={draft} onDraft={onDraft} onBlur={onBlurText} onChoose={onChoose} />
      )}
      {step.kind === 'acknowledgment' && (
        <label className="flex items-start gap-3 rounded-xl border border-[var(--ws-border)] bg-[var(--ws-panel)] p-4 text-sm leading-relaxed text-white">
          <input
            type="checkbox"
            className="mt-0.5 h-5 w-5 shrink-0"
            checked={Boolean(answer?.confirmed_at)}
            onChange={(e) => onSave({ confirmed: e.target.checked })}
          />
          <span>
            {step.label}
            {step.help && <span className="mt-1 block text-xs text-[var(--ws-dim)]">{step.help}</span>}
            {answer?.confirmed_at && (
              <span className="mt-1 block text-xs text-[var(--ws-success)]">Confirmed {formatWhen(answer.confirmed_at)}</span>
            )}
          </span>
        </label>
      )}
      {step.kind === 'credential_handoff' && <CredentialHandoff step={step} answer={answer} onSave={onSave} />}
      {step.kind === 'material_review' && <MaterialReview step={step} answer={answer} onSave={onSave} />}
      <SaveLine status={status} onRetry={onRetry} />
    </div>
  );
}

function FormQuestion({
  step,
  draft,
  onDraft,
  onBlur,
  onChoose,
}: {
  step: OnboardingStep;
  draft: string;
  onDraft: (value: string) => void;
  onBlur: () => void;
  onChoose: (value: string) => void;
}) {
  const id = `input-${step.key}`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-white">
        {step.label}
        {step.required ? '' : <span className="text-[var(--ws-dim)]"> (optional)</span>}
      </label>
      {step.help && <p className="mt-1 text-xs leading-relaxed text-[var(--ws-body)]">{step.help}</p>}
      {step.link_url && (
        <a
          href={step.link_url}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-1 inline-block text-xs font-medium text-[var(--ws-accent)] underline"
        >
          {step.link_label ?? 'Open link'}
        </a>
      )}
      <div className="mt-2">
        {step.input_type === 'single_select' ? (
          <div className="space-y-2" role="radiogroup" aria-labelledby={id}>
            {(step.choices ?? []).map((choice) => (
              <label
                key={choice.value}
                className="flex items-center gap-3 rounded-xl border border-[var(--ws-border)] bg-[var(--ws-panel)] px-4 py-3 text-sm text-white"
              >
                <input
                  type="radio"
                  name={step.key}
                  className="h-4 w-4"
                  checked={draft === choice.value}
                  onChange={() => onChoose(choice.value)}
                />
                {choice.label}
              </label>
            ))}
          </div>
        ) : step.input_type === 'select' ? (
          <select id={id} className={inputClass} value={draft} onChange={(e) => onChoose(e.target.value)}>
            <option value="">Choose…</option>
            {(step.choices ?? []).map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
        ) : step.input_type === 'textarea' ? (
          <textarea
            id={id}
            rows={4}
            className={inputClass}
            value={draft}
            placeholder={step.placeholder ?? undefined}
            onChange={(e) => onDraft(e.target.value)}
            onBlur={onBlur}
          />
        ) : (
          <input
            id={id}
            className={inputClass}
            type={step.input_type === 'email' ? 'email' : step.input_type === 'phone' ? 'tel' : 'text'}
            inputMode={step.input_type === 'phone' ? 'tel' : undefined}
            value={draft}
            placeholder={step.placeholder ?? undefined}
            autoComplete={step.no_paste ? 'off' : undefined}
            onPaste={step.no_paste ? (e) => e.preventDefault() : undefined}
            onChange={(e) => onDraft(e.target.value)}
            onBlur={onBlur}
          />
        )}
      </div>
    </div>
  );
}

function CredentialHandoff({
  step,
  answer,
  onSave,
}: {
  step: OnboardingStep;
  answer: OnboardingAnswer | undefined;
  onSave: (input: Record<string, unknown>) => void;
}) {
  const choice = answer?.access;
  const option = (value: 'received' | 'not_received', text: string) => (
    <button
      type="button"
      onClick={() => onSave({ access: value })}
      className={`w-full rounded-xl border px-4 py-3 text-left text-sm font-medium ${
        choice === value
          ? 'border-[var(--ws-accent)] bg-[var(--ws-accent)]/15 text-white'
          : 'border-[var(--ws-border)] bg-[var(--ws-panel)] text-white'
      }`}
      aria-pressed={choice === value}
    >
      {text}
    </button>
  );
  return (
    <div>
      <p className="text-sm font-medium text-white">{step.label}</p>
      {step.tools && step.tools.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {step.tools.map((tool) => (
            <span key={tool} className="rounded-full border border-[var(--ws-border)] px-3 py-1 text-xs text-[var(--ws-body)]">
              {tool}
            </span>
          ))}
        </div>
      )}
      <p className="mt-2 text-xs text-[var(--ws-body)]">
        Just confirm it worked. Never type a password or login here.
      </p>
      <div className="mt-3 space-y-2">
        {option('received', "I have access and can log in")}
        {option('not_received', "I haven't received access yet")}
      </div>
      {choice === 'not_received' && (
        <p className="mt-2 text-xs leading-relaxed text-[var(--ws-pending)]">
          Got it. We&apos;ve flagged this for Divine Acquisition. You can still finish everything else.
        </p>
      )}
    </div>
  );
}

function MaterialReview({
  step,
  answer,
  onSave,
}: {
  step: OnboardingStep;
  answer: OnboardingAnswer | undefined;
  onSave: (input: Record<string, unknown>) => void;
}) {
  const opened = Boolean(answer?.opened_at);
  return (
    <div>
      <p className="text-sm font-medium text-white">{step.label}</p>
      <div className="mt-2 rounded-xl border border-[var(--ws-border)] bg-[var(--ws-panel)] p-4">
        <p className="text-sm font-semibold text-white">{step.asset?.title ?? 'Material'}</p>
        {step.asset?.description && (
          <p className="mt-1 text-xs leading-relaxed text-[var(--ws-body)]">{step.asset.description}</p>
        )}
        {step.asset?.url ? (
          <a
            href={step.asset.url}
            target="_blank"
            rel="noreferrer noopener"
            onClick={() => onSave({ action: 'opened' })}
            className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-[var(--ws-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--ws-accent)] sm:w-auto"
          >
            {opened ? 'Open again' : 'Open material'}
          </a>
        ) : (
          <p className="mt-2 text-xs text-[var(--ws-pending)]">This material isn&apos;t available right now.</p>
        )}
      </div>
      <label className={`mt-3 flex items-start gap-3 text-sm ${opened ? 'text-white' : 'text-[var(--ws-dim)]'}`}>
        <input
          type="checkbox"
          className="mt-0.5 h-5 w-5 shrink-0"
          disabled={!opened || Boolean(answer?.confirmed_at)}
          checked={Boolean(answer?.confirmed_at)}
          onChange={(e) => e.target.checked && onSave({ action: 'confirm' })}
        />
        <span>
          I&apos;ve reviewed it
          {!opened && <span className="block text-xs">Open the material first.</span>}
          {answer?.confirmed_at && (
            <span className="block text-xs text-[var(--ws-success)]">Reviewed {formatWhen(answer.confirmed_at)}</span>
          )}
        </span>
      </label>
    </div>
  );
}

function SaveLine({ status, onRetry }: { status: SaveStatus | undefined; onRetry: () => void }) {
  if (!status) return null;
  if (status.state === 'saving') return <p className="mt-1.5 text-xs text-[var(--ws-dim)]">Saving…</p>;
  if (status.state === 'saved') return <p className="mt-1.5 text-xs text-[var(--ws-success)]">Saved</p>;
  return (
    <p role="alert" className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-[var(--ws-error)]">
      {status.message}
      <button type="button" onClick={onRetry} className="font-semibold text-white underline">
        Retry
      </button>
    </p>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-md flex-col items-center justify-center">
      <Logo className="mb-8 h-7 w-auto" />
      {children}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full animate-rise rounded-2xl border border-[var(--ws-border)] bg-[var(--ws-card)] p-7 text-center">
      {children}
    </div>
  );
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
