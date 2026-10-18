'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';
import { X } from 'lucide-react';
import Logo from '@/app/components/Logo';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import {
  APPLY_LEGAL_FOOTER,
  APPLY_QUESTIONS,
  APPLY_SCREENS,
  APPLY_STEP_NOTE,
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

type Phase = { name: 'form' } | { name: 'screen'; screen: ApplyScreen };

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
  const [phase, setPhase] = useState<Phase>({ name: 'form' });
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
    setError(null);
    if (firstName.trim().length < 2 || !/[A-Za-z]/.test(firstName)) {
      setError('Enter your first name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email.');
      return;
    }
    if (phone.replace(/\D/g, '').length < 10) {
      setError('Enter a valid phone number.');
      return;
    }
    const missing = APPLY_QUESTIONS.find((question) => !answers[question.key]);
    if (missing) {
      setError(missing.prompt);
      document.getElementById(`apply-${missing.key}`)?.focus();
      return;
    }

    lock.current = true;
    setPending(true);
    const result = await postApply({
      action: 'complete',
      firstName,
      email,
      phone,
      smsConsent,
      answers,
      website: websiteRef.current?.value ?? '',
      page: window.location.href,
      tracking,
      test: testMode,
    });
    lock.current = false;
    setPending(false);
    if (!result.ok || !result.screen) {
      setError(result.error || 'Try that once more.');
      return;
    }
    if (result.token) remember(result.token);
    trackPixel('Lead');
    setPhase({ name: 'screen', screen: result.screen });
  };

  const screen = phase.name === 'screen' ? APPLY_SCREENS[phase.screen] : null;

  return (
    <div className="acq-apply-screen">
      <header className="acq-apply-bar">
        <Logo className="h-7 w-auto sm:h-8" title="Divine Acquisition" />
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
            <h2 id={titleId} className="acq-apply-title">
              See if you qualify
            </h2>
            <p className="acq-apply-note">{APPLY_STEP_NOTE}</p>

            <FieldGroup className="acq-apply-fields">
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
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="apply-email">Email</FieldLabel>
                <Input
                  nativeInput
                  id="apply-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  required
                  placeholder="you@company.com"
                  size="lg"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </Field>
              <Field className="acq-span">
                <FieldLabel htmlFor="apply-phone">Phone</FieldLabel>
                <Input
                  nativeInput
                  id="apply-phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  required
                  placeholder="(555) 201-8890"
                  size="lg"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </Field>

              {APPLY_QUESTIONS.map((question) => (
                <Field key={question.key} className="acq-span">
                  <FieldLabel htmlFor={`apply-${question.key}`}>{question.prompt}</FieldLabel>
                  <NativeSelect
                    id={`apply-${question.key}`}
                    name={question.key}
                    value={answers[question.key] ?? ''}
                    onChange={(event) => {
                      const value = event.target.value;
                      setAnswers((current) => choose(current, question.key, value));
                      if (value) setError(null);
                    }}
                    className="h-12 text-base sm:h-12"
                  >
                    <option value="">Choose one</option>
                    {question.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              ))}
            </FieldGroup>

            <Field className="acq-consent">
              <FieldLabel className="flex cursor-pointer items-start gap-3 text-[0.85rem] font-normal normal-case tracking-normal text-[#d4d4d4]">
                <Checkbox checked={smsConsent} onCheckedChange={(checked) => setSmsConsent(checked === true)} />
                <span>{SMS_CONSENT_WORDING}</span>
              </FieldLabel>
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
            <button type="submit" className="acq-button acq-button-full" disabled={pending}>
              {pending ? 'Saving…' : 'Submit'}
            </button>
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
