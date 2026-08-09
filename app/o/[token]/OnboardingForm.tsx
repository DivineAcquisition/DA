'use client';

import { useMemo, useState, useTransition } from 'react';
import Logo from '@/app/components/Logo';
import { submitOnboardingAction } from '@/lib/workspace/onboarding-actions';
import type { OnboardingProtocol } from '@/lib/workspace/onboarding-protocol';

type Props = {
  token: string;
  protocol: OnboardingProtocol;
  recipientName: string;
  recipientEmail: string;
  recipientPhone: string | null;
  agreementSigned: boolean;
  agreementTemplateName: string | null;
  completed: boolean;
  initialAnswers: Record<string, string>;
};

const inputClass =
  'w-full rounded-xl border border-[var(--ws-border)] bg-[var(--ws-panel)] px-3.5 py-2.5 text-sm text-white outline-none focus:border-[var(--ws-accent)]';

export default function OnboardingForm({
  token,
  protocol,
  recipientName,
  recipientEmail,
  recipientPhone,
  agreementSigned,
  agreementTemplateName,
  completed: initiallyCompleted,
  initialAnswers,
}: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>(() => ({
    legal_name: initialAnswers.legal_name || recipientName,
    preferred_name: initialAnswers.preferred_name || recipientName.split(/\s+/)[0] || '',
    email: initialAnswers.email || recipientEmail,
    whatsapp: initialAnswers.whatsapp || recipientPhone || '',
    ...initialAnswers,
  }));
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(initiallyCompleted);
  const [pending, startTransition] = useTransition();

  const visibleFieldIds = useMemo(() => {
    const ids = new Set<string>();
    for (const section of protocol.sections) {
      for (const field of section.fields) {
        if (!field.showWhen) {
          ids.add(field.id);
          continue;
        }
        const controlling = answers[field.showWhen.fieldId] ?? '';
        if (field.showWhen.values.includes(controlling)) ids.add(field.id);
      }
    }
    return ids;
  }, [answers, protocol.sections]);

  if (completed) {
    return (
      <div className="mx-auto max-w-2xl animate-rise rounded-2xl border border-[var(--ws-border)] bg-[var(--ws-card)] p-8 text-center">
        <Logo className="mx-auto h-8 w-auto" />
        <h1 className="mt-6 text-2xl font-semibold text-white">Onboarding received</h1>
        <p className="mt-2 text-sm text-[var(--ws-body)]">
          Thanks, {recipientName}. We’ll use this to set up your training and placement.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl animate-rise space-y-6">
      <section className="rounded-2xl border border-[var(--ws-border)] bg-[var(--ws-card)] p-5 sm:p-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ws-accent)]">
          Divine Acquisition
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">{protocol.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--ws-body)]">{protocol.intro}</p>
        {!agreementSigned && (
          <p className="mt-4 rounded-xl border border-[var(--ws-pending)]/30 bg-[var(--ws-pending)]/10 px-3 py-2 text-sm text-[var(--ws-pending)]">
            Sign your{agreementTemplateName ? ` ${agreementTemplateName}` : ' agreement'} first.
            You can fill this form afterward from the same email link.
          </p>
        )}
      </section>

      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          startTransition(async () => {
            const result = await submitOnboardingAction({ token, answers });
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setCompleted(true);
          });
        }}
      >
        {protocol.sections.map((section) => (
          <section
            key={section.id}
            className="space-y-4 rounded-2xl border border-[var(--ws-border)] bg-[var(--ws-card)] p-5 sm:p-6"
          >
            <div>
              <h2 className="text-lg font-semibold text-white">{section.title}</h2>
              {section.intro && (
                <p className="mt-1 text-sm text-[var(--ws-body)]">{section.intro}</p>
              )}
            </div>

            <div className="space-y-4">
              {section.fields
                .filter((field) => visibleFieldIds.has(field.id))
                .map((field) => {
                  if (field.type === 'checkbox') {
                    return (
                      <label
                        key={field.id}
                        className="flex items-start gap-3 rounded-xl border border-[var(--ws-border)] bg-[var(--ws-panel)] p-3 text-sm leading-relaxed text-[var(--ws-body)]"
                      >
                        <input
                          type="checkbox"
                          required={field.required}
                          className="mt-1 h-4 w-4 rounded border-[var(--ws-border)] bg-[var(--ws-page)]"
                          checked={answers[field.id] === 'true'}
                          onChange={(e) =>
                            setAnswers((prev) => ({
                              ...prev,
                              [field.id]: e.target.checked ? 'true' : '',
                            }))
                          }
                        />
                        <span>{field.label}</span>
                      </label>
                    );
                  }

                  if (field.type === 'single_select') {
                    return (
                      <fieldset key={field.id} className="space-y-2">
                        <legend className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ws-dim)]">
                          {field.label}
                          {field.required ? ' *' : ''}
                        </legend>
                        <div className="space-y-2">
                          {(field.options ?? []).map((option) => (
                            <label
                              key={option.value}
                              className="flex items-center gap-3 rounded-xl border border-[var(--ws-border)] bg-[var(--ws-panel)] px-3 py-2.5 text-sm text-white"
                            >
                              <input
                                type="radio"
                                name={field.id}
                                required={field.required}
                                checked={answers[field.id] === option.value}
                                onChange={() =>
                                  setAnswers((prev) => ({ ...prev, [field.id]: option.value }))
                                }
                              />
                              <span>{option.label}</span>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    );
                  }

                  return (
                    <label key={field.id} className="block">
                      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ws-dim)]">
                        {field.label}
                        {field.required ? ' *' : ''}
                      </span>
                      {field.help && (
                        <span className="mb-2 block text-xs text-[var(--ws-body)]">{field.help}</span>
                      )}
                      {field.link && (
                        <a
                          href={field.link.href}
                          target="_blank"
                          rel="noreferrer"
                          className="mb-2 inline-block text-xs font-medium text-[var(--ws-accent)] hover:underline"
                        >
                          {field.link.label}
                        </a>
                      )}
                      {field.type === 'textarea' ? (
                        <textarea
                          required={field.required}
                          rows={4}
                          value={answers[field.id] ?? ''}
                          placeholder={field.placeholder}
                          onChange={(e) =>
                            setAnswers((prev) => ({ ...prev, [field.id]: e.target.value }))
                          }
                          className={inputClass}
                        />
                      ) : field.type === 'select' ? (
                        <select
                          required={field.required}
                          value={answers[field.id] ?? ''}
                          onChange={(e) =>
                            setAnswers((prev) => ({ ...prev, [field.id]: e.target.value }))
                          }
                          className={inputClass}
                        >
                          <option value="">Select…</option>
                          {(field.options ?? []).map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={
                            field.type === 'email'
                              ? 'email'
                              : field.type === 'phone'
                                ? 'tel'
                                : 'text'
                          }
                          required={field.required}
                          value={answers[field.id] ?? ''}
                          placeholder={field.placeholder}
                          autoComplete={
                            field.id === 'account_number_confirm' ? 'off' : undefined
                          }
                          onPaste={
                            field.id === 'account_number_confirm'
                              ? (e) => e.preventDefault()
                              : undefined
                          }
                          onChange={(e) =>
                            setAnswers((prev) => ({ ...prev, [field.id]: e.target.value }))
                          }
                          className={inputClass}
                        />
                      )}
                    </label>
                  );
                })}
            </div>
          </section>
        ))}

        {error && (
          <p className="rounded-xl border border-[var(--ws-error)]/30 bg-[var(--ws-error)]/10 px-3 py-2 text-sm text-[var(--ws-error)]">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending || !agreementSigned}
          className="inline-flex w-full items-center justify-center rounded-xl bg-[var(--ws-btn)] px-5 py-3 text-sm font-semibold text-[var(--ws-page)] transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? 'Submitting…' : 'Submit onboarding'}
        </button>
      </form>
    </div>
  );
}
