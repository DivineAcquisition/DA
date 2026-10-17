'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';
import { X } from 'lucide-react';
import Logo from '@/app/components/Logo';
import { BorderBeam } from '@/components/ui/border-beam';
import { BlurFade } from '@/components/ui/blur-fade';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { MagicCard } from '@/components/ui/magic-card';
import { Panel } from '@/components/ui/panel';
import { Particles } from '@/components/ui/particles';
import { ShineBorder } from '@/components/ui/shine-border';
import {
  APPLY_LEGAL_FOOTER,
  APPLY_QUESTIONS,
  APPLY_SCREENS,
  APPLY_STEP_NOTE,
  SMS_CONSENT_WORDING,
  type ApplyAnswers,
  type ApplyScreen,
} from '@/lib/acq/application-copy';
import { LEGAL_DISCLAIMER_URL, LEGAL_PRIVACY_URL, LEGAL_TERMS_URL } from '@/lib/acq/copy';
import type { TrackingParamKey } from '@/lib/acq/config';
import { AcqScheduler } from '../schedule/Scheduler';
import { CalendarEmbed } from './CalendarEmbed';
import { trackPixel } from './MetaPixel';

const TOKEN_KEY = 'acq-apply-token';

type FieldName = 'firstName' | 'email' | 'phone';

type Phase =
  | { name: 'contact' }
  | { name: 'question'; index: number }
  | { name: 'screen'; screen: ApplyScreen };

async function postApply(body: Record<string, unknown>) {
  const response = await fetch('/api/acq/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  return (await response.json()) as {
    ok?: boolean;
    error?: string;
    field?: FieldName;
    token?: string;
    screen?: ApplyScreen;
    question?: number;
    answers?: ApplyAnswers;
    firstName?: string;
  };
}

export function ApplyAttribution({
  tracking,
  testMode,
}: {
  tracking: Partial<Record<TrackingParamKey, string>>;
  testMode: boolean;
}) {
  useEffect(() => {
    void postApply({ action: 'touch', tracking, test: testMode });
  }, [tracking, testMode]);
  return null;
}

export function ApplyDialog({
  dialogRef,
  firstFieldRef,
  tracking,
  testMode,
}: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  firstFieldRef: RefObject<HTMLInputElement | null>;
  tracking: Partial<Record<TrackingParamKey, string>>;
  testMode: boolean;
}) {
  const titleId = 'acq-apply-title';
  const [phase, setPhase] = useState<Phase>({ name: 'contact' });
  const [answers, setAnswers] = useState<ApplyAnswers>({});
  const [token, setToken] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<Partial<Record<FieldName, string>>>({});
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const opened = useRef(false);

  const remember = (next: string) => {
    setToken(next);
    try {
      sessionStorage.setItem(TOKEN_KEY, next);
    } catch {
      /* private mode can block storage; the server cookie still holds the visit */
    }
  };

  const restore = useCallback(async () => {
    let saved = '';
    try {
      saved = sessionStorage.getItem(TOKEN_KEY) ?? '';
    } catch {
      saved = '';
    }
    if (!saved) return;
    const result = await postApply({ action: 'resume', token: saved, tracking, test: testMode });
    if (!result.ok) return;
    setToken(saved);
    setAnswers(result.answers ?? {});
    if (result.screen) setPhase({ name: 'screen', screen: result.screen });
    else setPhase({ name: 'question', index: Math.max(0, (result.question ?? 1) - 1) });
  }, [testMode, tracking]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onOpen = () => {
      if (opened.current) return;
      opened.current = true;
      void postApply({ action: 'open', tracking, test: testMode });
      void restore();
    };
    const onClose = () => {
      opened.current = false;
    };
    dialog.addEventListener('acq-apply-shown', onOpen);
    dialog.addEventListener('close', onClose);
    return () => {
      dialog.removeEventListener('acq-apply-shown', onOpen);
      dialog.removeEventListener('close', onClose);
    };
  }, [dialogRef, restore, testMode, tracking]);

  const close = () => {
    if (pending) return;
    dialogRef.current?.close();
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError(null);
    setFieldError({});
    const form = new FormData(event.currentTarget);
    const nextPhone = String(form.get('phone') ?? '');
    const result = await postApply({
      action: 'start',
      firstName: String(form.get('firstName') ?? ''),
      email: String(form.get('email') ?? ''),
      phone: nextPhone,
      smsConsent: form.get('smsConsent') === 'on',
      website: String(form.get('website') ?? ''),
      page: window.location.href,
      tracking,
      test: testMode,
    });
    lock.current = false;
    setPending(false);
    if (!result.ok || !result.token) {
      if (result.field) setFieldError({ [result.field]: result.error || 'Check that field.' });
      else setError(result.error || 'Try that once more.');
      return;
    }
    setPhone(nextPhone);
    remember(result.token);
    setPhase({ name: 'question', index: 0 });
    trackPixel('Lead');
  };

  const choose = async (value: string) => {
    if (lock.current || phase.name !== 'question') return;
    lock.current = true;
    setPending(true);
    setError(null);
    const question = phase.index + 1;
    setAnswers((current) => ({ ...current, [APPLY_QUESTIONS[phase.index].key]: value }));
    const result = await postApply({
      action: 'answer',
      token,
      question,
      value,
      tracking,
      test: testMode,
    });
    lock.current = false;
    setPending(false);
    if (!result.ok) {
      setError(result.error || 'Try that once more.');
      return;
    }
    if (result.screen) {
      setPhase({ name: 'screen', screen: result.screen });
      return;
    }
    setPhase({ name: 'question', index: Math.max(0, (result.question ?? question + 1) - 1) });
  };

  const question = phase.name === 'question' ? APPLY_QUESTIONS[phase.index] : null;
  const screen = phase.name === 'screen' ? APPLY_SCREENS[phase.screen] : null;

  return (
    <div className="acq-apply-screen">
      <Particles
        className="absolute inset-0"
        quantity={42}
        color="#9A88FC"
        ease={70}
        size={0.45}
      />
      <header className="acq-apply-bar">
        <Logo className="h-7 w-auto sm:h-8" title="Divine Acquisition" />
        <button type="button" onClick={close} className="acq-apply-close" aria-label="Close">
          <X className="size-5" aria-hidden />
        </button>
      </header>

      <div className="acq-apply-main">
        <Panel className="relative overflow-hidden rounded-3xl p-0">
          <ShineBorder shineColor={['#9A88FC', '#C3B6FE']} borderWidth={1} duration={14} />
          <BorderBeam size={90} duration={11} colorFrom="#9A88FC" colorTo="#C3B6FE" borderWidth={1} />
          <MagicCard className="rounded-3xl" contentClassName="px-5 py-6 sm:px-7 sm:py-8">
            <BlurFade key={phase.name === 'question' ? `q-${phase.index}` : phase.name} delay={0.04} offset={8}>
              <p className="acq-apply-kicker">{phase.name === 'contact' ? 'Step 1 of 2' : 'Step 2 of 2'}</p>
              <h2 id={titleId} className="acq-apply-title">
                {phase.name === 'contact'
                  ? 'Tell us how to reach you.'
                  : question
                    ? question.prompt
                    : screen?.heading}
              </h2>
              {phase.name !== 'screen' ? <p className="acq-apply-note">{APPLY_STEP_NOTE}</p> : null}
              {screen ? <p className="acq-apply-note">{screen.line}</p> : null}

              {phase.name === 'question' ? (
                <div className="acq-apply-progress" aria-hidden>
                  {APPLY_QUESTIONS.map((item, index) => (
                    <span key={item.key} className={index <= phase.index ? 'is-on' : ''} />
                  ))}
                </div>
              ) : null}

              {phase.name === 'contact' ? (
                <form onSubmit={onSubmit} className="acq-apply-form" noValidate>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="apply-first-name">First name</FieldLabel>
                      <Input
                        nativeInput
                        id="apply-first-name"
                        ref={firstFieldRef}
                        name="firstName"
                        type="text"
                        autoComplete="given-name"
                        autoCapitalize="words"
                        required
                        placeholder="Jordan"
                        size="lg"
                        className="min-h-12 text-base"
                        aria-invalid={fieldError.firstName ? true : undefined}
                      />
                      {fieldError.firstName ? <FieldError match>{fieldError.firstName}</FieldError> : null}
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="apply-email">Email</FieldLabel>
                      <Input
                        nativeInput
                        id="apply-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        placeholder="you@company.com"
                        inputMode="email"
                        size="lg"
                        className="min-h-12 text-base"
                        aria-invalid={fieldError.email ? true : undefined}
                      />
                      {fieldError.email ? <FieldError match>{fieldError.email}</FieldError> : null}
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="apply-phone">Phone</FieldLabel>
                      <Input
                        nativeInput
                        id="apply-phone"
                        name="phone"
                        type="tel"
                        autoComplete="tel"
                        required
                        placeholder="(555) 201-8890"
                        inputMode="tel"
                        size="lg"
                        className="min-h-12 text-base"
                        aria-invalid={fieldError.phone ? true : undefined}
                      />
                      {fieldError.phone ? <FieldError match>{fieldError.phone}</FieldError> : null}
                    </Field>
                    <Field className="acq-consent">
                      <FieldLabel className="flex cursor-pointer items-start gap-3 text-[0.78rem] font-normal normal-case tracking-normal text-[#d4d4d4]">
                        <Checkbox name="smsConsent" />
                        <span>{SMS_CONSENT_WORDING}</span>
                      </FieldLabel>
                      <p>
                        <a href={LEGAL_PRIVACY_URL}>Privacy</a>
                        {' · '}
                        <a href={LEGAL_TERMS_URL}>Terms</a>
                      </p>
                    </Field>
                    <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                      <label>
                        Website
                        <input name="website" type="text" tabIndex={-1} autoComplete="off" />
                      </label>
                    </div>
                    {error ? (
                      <p className="acq-apply-error" role="alert">
                        {error}
                      </p>
                    ) : null}
                    <button type="submit" className="acq-button acq-button-full" disabled={pending}>
                      {pending ? 'Saving…' : 'Continue'}
                    </button>
                  </FieldGroup>
                </form>
              ) : null}

              {question ? (
                <div className="acq-apply-options">
                  {phase.name === 'question' && phase.index > 0 ? (
                    <button
                      type="button"
                      className="acq-apply-back"
                      onClick={() => setPhase({ name: 'question', index: phase.index - 1 })}
                    >
                      Back
                    </button>
                  ) : null}
                  {question.options.map((option) => (
                    <MagicCard
                      key={option}
                      className="rounded-2xl border border-[rgba(195,182,254,0.28)] bg-white/[0.03]"
                    >
                      <button
                        type="button"
                        className="acq-choice"
                        disabled={pending}
                        onClick={() => void choose(option)}
                      >
                        {option}
                      </button>
                    </MagicCard>
                  ))}
                  {error ? (
                    <p className="acq-apply-error" role="alert">
                      {error}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {phase.name === 'screen' && phase.screen === 'calendar' ? (
                <div className="acq-apply-calendar">
                  {token.length >= 32 ? (
                    <AcqScheduler
                      token={token}
                      initialPhone={phone}
                      onBooked={() => {
                        void postApply({ action: 'book', token, tracking, test: testMode });
                      }}
                    />
                  ) : (
                    <CalendarEmbed className="mt-4" iframeClassName="h-[640px]" />
                  )}
                </div>
              ) : null}
            </BlurFade>
          </MagicCard>
        </Panel>
      </div>

      <footer className="acq-apply-legal">
        <p>{APPLY_LEGAL_FOOTER.company}</p>
        {APPLY_LEGAL_FOOTER.lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
        <p>
          <a href={LEGAL_TERMS_URL}>Terms</a>
          {' · '}
          <a href={LEGAL_PRIVACY_URL}>Privacy</a>
          {' · '}
          <a href={LEGAL_DISCLAIMER_URL}>Disclaimer</a>
        </p>
      </footer>
    </div>
  );
}
