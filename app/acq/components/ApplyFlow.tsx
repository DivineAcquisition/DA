'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';
import { X } from 'lucide-react';
import Logo from '@/app/components/Logo';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import {
  APPLY_LEGAL_FOOTER,
  APPLY_QUESTIONS,
  APPLY_SCREENS,
  SMS_CONSENT_WORDING,
  type ApplyAnswers,
  type ApplyQuestionKey,
  type ApplyScreen,
} from '@/lib/acq/application-copy';
import { LEGAL_DISCLAIMER_URL, LEGAL_PRIVACY_URL, LEGAL_TERMS_URL } from '@/lib/acq/copy';
import type { TrackingParamKey } from '@/lib/acq/config';
import { AcqScheduler } from '../schedule/Scheduler';
import { CalendarEmbed } from './CalendarEmbed';
import { trackPixel } from './MetaPixel';

const TOKEN_KEY = 'acq-apply-token';

type FieldName = 'firstName' | 'email' | 'phone';

type TextStep = {
  kind: 'text';
  key: FieldName;
  prompt: string;
  placeholder: string;
  type: 'text' | 'email' | 'tel';
  autoComplete: string;
  inputMode: 'text' | 'email' | 'tel';
};

type ChoiceStep = {
  kind: 'choice';
  key: ApplyQuestionKey;
  prompt: string;
  options: readonly string[];
};

type SmsStep = { kind: 'sms'; prompt: string };

type Step = TextStep | ChoiceStep | SmsStep;

const STEPS: readonly Step[] = [
  {
    kind: 'text',
    key: 'firstName',
    prompt: 'What is your first name?',
    placeholder: 'Jordan',
    type: 'text',
    autoComplete: 'given-name',
    inputMode: 'text',
  },
  {
    kind: 'text',
    key: 'email',
    prompt: 'What is your email?',
    placeholder: 'you@company.com',
    type: 'email',
    autoComplete: 'email',
    inputMode: 'email',
  },
  {
    kind: 'text',
    key: 'phone',
    prompt: 'What is your phone number?',
    placeholder: '(555) 201-8890',
    type: 'tel',
    autoComplete: 'tel',
    inputMode: 'tel',
  },
  ...APPLY_QUESTIONS.map(
    (question): ChoiceStep => ({
      kind: 'choice',
      key: question.key,
      prompt: question.prompt,
      options: question.options,
    }),
  ),
  { kind: 'sms', prompt: 'Want a text reminder for your audit?' },
];

const TEXT_INDEX: Record<FieldName, number> = { firstName: 0, email: 1, phone: 2 };

type Phase = { name: 'pages' } | { name: 'screen'; screen: ApplyScreen };

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

function choose(current: ApplyAnswers, key: ApplyQuestionKey, value: string): ApplyAnswers {
  return { ...current, [key]: value } as ApplyAnswers;
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
  const [phase, setPhase] = useState<Phase>({ name: 'pages' });
  const [index, setIndex] = useState(0);
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
    if (result.firstName) setFirstName(result.firstName);
    if (result.screen) setPhase({ name: 'screen', screen: result.screen });
    else if (result.question) setIndex(TEXT_INDEX.phone + result.question);
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

  const step = STEPS[index];
  const textStep = step?.kind === 'text';

  useEffect(() => {
    if (phase.name !== 'pages' || !textStep) return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [index, phase.name, textStep]);

  const close = () => {
    if (pending) return;
    dialogRef.current?.close();
  };

  const textValue = (key: FieldName) => (key === 'firstName' ? firstName : key === 'email' ? email : phone);

  const setTextValue = (key: FieldName, value: string) => {
    if (key === 'firstName') setFirstName(value);
    else if (key === 'email') setEmail(value);
    else setPhone(value);
  };

  const validText = (key: FieldName) => {
    if (key === 'firstName') return firstName.trim().length >= 2 && /[A-Za-z]/.test(firstName);
    if (key === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    return phone.replace(/\D/g, '').length >= 10;
  };

  const textError = (key: FieldName) => {
    if (key === 'firstName') return 'Enter your first name.';
    if (key === 'email') return 'Enter a valid email.';
    return 'Enter a valid phone number.';
  };

  const finish = async () => {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError(null);
    const started = await postApply({
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
    if (!started.ok || !started.token) {
      lock.current = false;
      setPending(false);
      if (started.field) setIndex(TEXT_INDEX[started.field]);
      setError(started.error || 'Try that once more.');
      return;
    }
    remember(started.token);
    trackPixel('Lead');

    let screen: ApplyScreen | undefined;
    for (let questionIndex = 0; questionIndex < APPLY_QUESTIONS.length; questionIndex += 1) {
      const question = APPLY_QUESTIONS[questionIndex];
      const value = answers[question.key];
      if (!value) break;
      const result = await postApply({
        action: 'answer',
        token: started.token,
        question: questionIndex + 1,
        value,
        tracking,
        test: testMode,
      });
      if (!result.ok) {
        lock.current = false;
        setPending(false);
        setIndex(TEXT_INDEX.phone + questionIndex + 1);
        setError(result.error || 'Try that once more.');
        return;
      }
      if (result.screen) screen = result.screen;
    }
    lock.current = false;
    setPending(false);
    if (screen) setPhase({ name: 'screen', screen });
    else setError('Try that once more.');
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || phase.name !== 'pages') return;
    const current = STEPS[index];
    setError(null);
    if (current.kind === 'text') {
      if (!validText(current.key)) {
        setError(textError(current.key));
        return;
      }
      setIndex(index + 1);
      return;
    }
    if (current.kind === 'choice') {
      if (!answers[current.key]) {
        setError('Choose one.');
        return;
      }
      setIndex(index + 1);
      return;
    }
    await finish();
  };

  const back = () => {
    if (pending || index === 0) return;
    setError(null);
    setIndex(index - 1);
  };

  const screen = phase.name === 'screen' ? APPLY_SCREENS[phase.screen] : null;
  const last = index === STEPS.length - 1;

  return (
    <div className="acq-apply-screen">
      <div className="acq-apply-meter" aria-hidden>
        <span style={{ width: `${((phase.name === 'screen' ? STEPS.length : index + 1) / STEPS.length) * 100}%` }} />
      </div>
      <header className="acq-apply-bar">
        <Logo className="h-7 w-auto sm:h-8" title="Divine Acquisition" />
        {phase.name === 'pages' ? (
          <p className="acq-apply-count">
            {index + 1} of {STEPS.length}
          </p>
        ) : (
          <span />
        )}
        <button type="button" onClick={close} className="acq-apply-close" aria-label="Close">
          <X className="size-5" aria-hidden />
        </button>
      </header>

      <div className="acq-apply-main">
        {screen ? (
          <div className="acq-apply-stage">
            <h2 id={titleId} className="acq-apply-title">
              {screen.heading}
            </h2>
            <p className="acq-apply-note">{screen.line}</p>
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
          </div>
        ) : (
          <form onSubmit={onSubmit} className="acq-apply-stage" noValidate>
            <p className="acq-apply-index">
              {index + 1}
              <span aria-hidden>→</span>
            </p>
            <h2 id={titleId} className="acq-apply-title">
              {step.prompt}
            </h2>

            {step.kind === 'text' ? (
              <Field className="acq-apply-control">
                <FieldLabel className="sr-only" htmlFor={`apply-${step.key}`}>
                  {step.prompt}
                </FieldLabel>
                <Input
                  nativeInput
                  id={`apply-${step.key}`}
                  ref={(node) => {
                    inputRef.current = node;
                    if (step.key === 'firstName') firstFieldRef.current = node;
                  }}
                  name={step.key}
                  type={step.type}
                  autoComplete={step.autoComplete}
                  autoCapitalize={step.key === 'firstName' ? 'words' : 'off'}
                  inputMode={step.inputMode}
                  required
                  placeholder={step.placeholder}
                  size="lg"
                  className="min-h-12 text-base"
                  value={textValue(step.key)}
                  onChange={(event) => setTextValue(step.key, event.target.value)}
                  aria-invalid={error ? true : undefined}
                />
              </Field>
            ) : null}

            {step.kind === 'choice' ? (
              <Field className="acq-apply-control">
                <FieldLabel className="sr-only" htmlFor={`apply-${step.key}`}>
                  {step.prompt}
                </FieldLabel>
                <NativeSelect
                  id={`apply-${step.key}`}
                  name={step.key}
                  value={answers[step.key] ?? ''}
                  onChange={(event) => {
                    const value = event.target.value;
                    setAnswers((current) => choose(current, step.key, value));
                    if (value) setError(null);
                  }}
                  className="h-12 text-base sm:h-12"
                  aria-invalid={error ? true : undefined}
                >
                  <option value="">Choose one</option>
                  {step.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            ) : null}

            {step.kind === 'sms' ? (
              <Field className="acq-consent acq-apply-control">
                <FieldLabel className="flex cursor-pointer items-start gap-3 text-[0.9rem] font-normal normal-case tracking-normal text-[#d4d4d4]">
                  <Checkbox checked={smsConsent} onCheckedChange={(checked) => setSmsConsent(checked === true)} />
                  <span>{SMS_CONSENT_WORDING}</span>
                </FieldLabel>
              </Field>
            ) : null}

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

            <div className="acq-apply-nav">
              {index > 0 ? (
                <button type="button" className="acq-apply-back" onClick={back}>
                  Back
                </button>
              ) : null}
              <button type="submit" className="acq-button acq-apply-next" disabled={pending}>
                {last ? (pending ? 'Saving…' : 'Submit') : 'Next'}
              </button>
            </div>
          </form>
        )}
      </div>

      <footer className="acq-apply-legal">
        <p>
          {APPLY_LEGAL_FOOTER.company}. {APPLY_LEGAL_FOOTER.lines[0]}
        </p>
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
