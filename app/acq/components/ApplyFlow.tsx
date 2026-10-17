'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';
import { X } from 'lucide-react';
import Logo from '@/app/components/Logo';
import { BlurFade } from '@/components/ui/blur-fade';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { MagicCard } from '@/components/ui/magic-card';
import { Particles } from '@/components/ui/particles';
import {
  APPLY_LEGAL_FOOTER,
  APPLY_QUESTIONS,
  APPLY_SCREENS,
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
type ContactStep = FieldName | 'sms';

const CONTACT_STEPS: readonly ContactStep[] = ['firstName', 'email', 'phone', 'sms'];

const CONTACT_PROMPTS: Record<ContactStep, string> = {
  firstName: 'What is your first name?',
  email: 'What is your email?',
  phone: 'What is your phone number?',
  sms: 'Want a text reminder for your audit?',
};

type Phase =
  | { name: 'contact'; step: ContactStep }
  | { name: 'question'; index: number }
  | { name: 'screen'; screen: ApplyScreen };

const STEP_TOTAL = CONTACT_STEPS.length + APPLY_QUESTIONS.length;

function stepPosition(phase: Phase): number {
  if (phase.name === 'screen') return STEP_TOTAL;
  if (phase.name === 'question') return CONTACT_STEPS.length + phase.index + 1;
  return CONTACT_STEPS.indexOf(phase.step) + 1;
}

function choiceKey(index: number): string {
  return String.fromCharCode(65 + index);
}

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
  const [phase, setPhase] = useState<Phase>({ name: 'contact', step: 'firstName' });
  const [answers, setAnswers] = useState<ApplyAnswers>({});
  const [token, setToken] = useState('');
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [smsConsent, setSmsConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const opened = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const websiteRef = useRef<HTMLInputElement | null>(null);

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

  useEffect(() => {
    if (phase.name !== 'contact' || phase.step === 'sms') return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [phase]);

  const close = () => {
    if (pending) return;
    dialogRef.current?.close();
  };

  const submitStart = async () => {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError(null);
    const result = await postApply({
      action: 'start',
      firstName,
      email,
      phone,
      smsConsent,
      website: websiteRef.current?.value ?? '',
      page: window.location.href,
      tracking,
      test: testMode,
    });
    lock.current = false;
    setPending(false);
    if (!result.ok || !result.token) {
      if (result.field) setPhase({ name: 'contact', step: result.field });
      setError(result.error || 'Try that once more.');
      return;
    }
    remember(result.token);
    setPhase({ name: 'question', index: 0 });
    trackPixel('Lead');
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (phase.name !== 'contact' || pending) return;
    setError(null);
    if (phase.step === 'firstName') {
      if (firstName.trim().length < 2 || !/[A-Za-z]/.test(firstName)) {
        setError('Enter your first name.');
        return;
      }
      setPhase({ name: 'contact', step: 'email' });
      return;
    }
    if (phase.step === 'email') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        setError('Enter a valid email.');
        return;
      }
      setPhase({ name: 'contact', step: 'phone' });
      return;
    }
    if (phase.step === 'phone') {
      const digits = phone.replace(/\D/g, '');
      if (digits.length < 10) {
        setError('Enter a valid phone number.');
        return;
      }
      setPhase({ name: 'contact', step: 'sms' });
      return;
    }
    await submitStart();
  };

  const goBack = () => {
    if (pending) return;
    setError(null);
    if (phase.name === 'contact') {
      const index = CONTACT_STEPS.indexOf(phase.step);
      if (index > 0) setPhase({ name: 'contact', step: CONTACT_STEPS[index - 1] });
      return;
    }
    if (phase.name === 'question') {
      if (phase.index > 0) setPhase({ name: 'question', index: phase.index - 1 });
      else setPhase({ name: 'contact', step: 'sms' });
    }
  };

  const choose = useCallback(async (value: string) => {
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
  }, [phase, testMode, token, tracking]);

  const question = phase.name === 'question' ? APPLY_QUESTIONS[phase.index] : null;
  const screen = phase.name === 'screen' ? APPLY_SCREENS[phase.screen] : null;
  const position = stepPosition(phase);
  const canGoBack = phase.name === 'question' || (phase.name === 'contact' && phase.step !== 'firstName');

  useEffect(() => {
    if (!question || phase.name !== 'question') return;
    const onKey = (event: KeyboardEvent) => {
      if (pending || event.metaKey || event.ctrlKey || event.altKey) return;
      const index = event.key.toUpperCase().charCodeAt(0) - 65;
      const option = question.options[index];
      if (!option) return;
      event.preventDefault();
      void choose(option);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choose, pending, phase.name, question]);

  return (
    <div className="acq-apply-screen">
      <Particles
        className="absolute inset-0"
        quantity={42}
        color="#9A88FC"
        ease={70}
        size={0.45}
      />
      <div className="acq-apply-meter" aria-hidden>
        <span style={{ width: `${(position / STEP_TOTAL) * 100}%` }} />
      </div>
      <header className="acq-apply-bar">
        <Logo className="h-7 w-auto sm:h-8" title="Divine Acquisition" />
        <p className="acq-apply-count">
          {position} of {STEP_TOTAL}
        </p>
        <button type="button" onClick={close} className="acq-apply-close" aria-label="Close">
          <X className="size-5" aria-hidden />
        </button>
      </header>

      <div className="acq-apply-main">
        <div className="acq-apply-stage">
          <BlurFade
            key={phase.name === 'contact' ? phase.step : phase.name === 'question' ? `q-${phase.index}` : phase.screen}
            delay={0.02}
            offset={12}
          >
            {canGoBack ? (
              <button type="button" className="acq-apply-back" onClick={goBack}>
                Back
              </button>
            ) : null}
            <p className="acq-apply-index">
              {position}
              <span aria-hidden>→</span>
            </p>
            <h2 id={titleId} className="acq-apply-title">
              {phase.name === 'contact' ? CONTACT_PROMPTS[phase.step] : question ? question.prompt : screen?.heading}
            </h2>
            {screen ? <p className="acq-apply-note">{screen.line}</p> : null}

            {phase.name === 'contact' && phase.step !== 'sms' ? (
              <form onSubmit={onSubmit} className="acq-typeform" noValidate>
                <Field>
                  <FieldLabel className="sr-only" htmlFor={`apply-${phase.step}`}>
                    {CONTACT_PROMPTS[phase.step]}
                  </FieldLabel>
                  <div className="acq-typeform-row">
                    <Input
                      nativeInput
                      id={`apply-${phase.step}`}
                      ref={(node) => {
                        inputRef.current = node;
                        if (phase.step === 'firstName') firstFieldRef.current = node;
                      }}
                      name={phase.step}
                      type={phase.step === 'email' ? 'email' : phase.step === 'phone' ? 'tel' : 'text'}
                      autoComplete={
                        phase.step === 'firstName' ? 'given-name' : phase.step === 'email' ? 'email' : 'tel'
                      }
                      autoCapitalize={phase.step === 'firstName' ? 'words' : 'off'}
                      inputMode={phase.step === 'email' ? 'email' : phase.step === 'phone' ? 'tel' : 'text'}
                      required
                      placeholder={
                        phase.step === 'firstName' ? 'Jordan' : phase.step === 'email' ? 'you@company.com' : '(555) 201-8890'
                      }
                      size="lg"
                      className="min-h-14 text-lg"
                      value={phase.step === 'firstName' ? firstName : phase.step === 'email' ? email : phone}
                      onChange={(event) => {
                        const next = event.target.value;
                        if (phase.step === 'firstName') setFirstName(next);
                        else if (phase.step === 'email') setEmail(next);
                        else setPhone(next);
                      }}
                      aria-invalid={error ? true : undefined}
                    />
                    <button type="submit" className="acq-button" disabled={pending}>
                      OK
                    </button>
                  </div>
                </Field>
                {error ? (
                  <p className="acq-apply-error" role="alert">
                    {error}
                  </p>
                ) : null}
                <p className="acq-apply-enter">
                  press <kbd>Enter</kbd>
                </p>
              </form>
            ) : null}

            {phase.name === 'contact' && phase.step === 'sms' ? (
              <form onSubmit={onSubmit} className="acq-typeform" noValidate>
                <Field className="acq-consent">
                  <FieldLabel className="flex cursor-pointer items-start gap-3 text-[0.95rem] font-normal normal-case tracking-normal text-[#d4d4d4]">
                    <Checkbox checked={smsConsent} onCheckedChange={(checked) => setSmsConsent(checked === true)} />
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
                    <input ref={websiteRef} name="website" type="text" tabIndex={-1} autoComplete="off" />
                  </label>
                </div>
                {error ? (
                  <p className="acq-apply-error" role="alert">
                    {error}
                  </p>
                ) : null}
                <div className="acq-typeform-row">
                  <button type="submit" className="acq-button" disabled={pending}>
                    {pending ? 'Saving…' : 'OK'}
                  </button>
                  <p className="acq-apply-enter">
                    press <kbd>Enter</kbd>
                  </p>
                </div>
              </form>
            ) : null}

            {question ? (
              <div className="acq-apply-options">
                {question.options.map((option, index) => {
                  const selected = answers[question.key] === option;
                  return (
                    <MagicCard
                      key={option}
                      className={`rounded-2xl border bg-white/[0.03] ${selected ? 'border-brand-300' : 'border-[rgba(195,182,254,0.28)]'}`}
                    >
                      <button
                        type="button"
                        className="acq-choice"
                        disabled={pending}
                        onClick={() => void choose(option)}
                      >
                        <span className="acq-choice-key">{choiceKey(index)}</span>
                        {option}
                      </button>
                    </MagicCard>
                  );
                })}
                {error ? (
                  <p className="acq-apply-error" role="alert">
                    {error}
                  </p>
                ) : null}
                <p className="acq-apply-enter">Choose one, or press its letter.</p>
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
        </div>
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
