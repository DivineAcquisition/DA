'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Logo from '@/app/components/Logo';
import { AGREEMENT_UNAVAILABLE } from '@/lib/workspace/agreement-copy';
import type { AgreementPageState } from '@/lib/workspace/agreement-page';
import AgreementSign from './AgreementSign';

type SignFieldNames = { signature: string[]; initials: string[] };

type Props = {
  token: string;
  initial: AgreementPageState;
  signFields?: SignFieldNames;
};

const POLL_EVERY_MS = 3000;
const POLL_FOR_MS = 60000;

type Finalizing = 'idle' | 'waiting' | 'slow';

export default function AgreementView({ token, initial, signFields = { signature: [], initials: [] } }: Props) {
  const [page, setPage] = useState<AgreementPageState>(initial);
  const [finalizing, setFinalizing] = useState<Finalizing>('idle');
  const startedAt = useRef<number>(0);

  const check = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch(`/s/${encodeURIComponent(token)}/state`, { cache: 'no-store' });
      const next = (await response.json()) as AgreementPageState;
      if (next.state !== 'open') {
        setPage(next);
        setFinalizing('idle');
        return true;
      }
    } catch {
      // A dropped request is just another tick.
    }
    return false;
  }, [token]);

  // Placing the signature is not the record by itself. The agreement moves to
  // completed when DocuSeal finishes the submission, so wait for that.
  useEffect(() => {
    if (finalizing !== 'waiting') return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      if (await check()) return;
      if (Date.now() - startedAt.current >= POLL_FOR_MS) {
        if (!cancelled) setFinalizing('slow');
        return;
      }
      timer = window.setTimeout(tick, POLL_EVERY_MS);
    };
    let timer = window.setTimeout(tick, POLL_EVERY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [finalizing, check]);

  const startFinalizing = useCallback(() => {
    startedAt.current = Date.now();
    setFinalizing('waiting');
  }, []);

  if (page.state === 'open' && finalizing !== 'idle') {
    return (
      <Shell>
        <Card>
          {finalizing === 'waiting' ? (
            <>
              <Spinner />
              <h1 className="mt-5 text-xl font-semibold text-white">Finalizing your agreement…</h1>
              <p className="mt-2 text-sm text-[var(--ws-body)]">This usually takes a few seconds. Keep this page open.</p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-white">We received your signature</h1>
              <p className="mt-2 text-sm leading-relaxed text-[var(--ws-body)]">
                Your signed copy will be ready here shortly. You don&apos;t need to sign again.
              </p>
              <button
                type="button"
                onClick={startFinalizing}
                className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-[var(--ws-btn)] px-6 py-3 text-sm font-semibold text-[var(--ws-page)] sm:w-auto"
              >
                Check again
              </button>
            </>
          )}
        </Card>
      </Shell>
    );
  }

  switch (page.state) {
    case 'invalid':
      return (
        <Shell>
          <Card>
            <p className="text-sm leading-relaxed text-[var(--ws-body)]">{AGREEMENT_UNAVAILABLE}</p>
          </Card>
        </Shell>
      );

    case 'declined':
      return (
        <Shell>
          <Card>
            <h1 className="text-xl font-semibold text-white">You declined this agreement</h1>
            <p className="mt-2 text-sm leading-relaxed text-[var(--ws-body)]">
              Nothing else is needed. If that was a mistake, reach out to Divine Acquisition and we&apos;ll send it
              again.
            </p>
          </Card>
        </Shell>
      );

    case 'superseded':
      return (
        <Shell>
          <Card>
            <h1 className="text-xl font-semibold text-white">A newer version was sent</h1>
            <p className="mt-2 text-sm leading-relaxed text-[var(--ws-body)]">
              This agreement was replaced. Please use the link in your most recent email from Divine Acquisition.
            </p>
          </Card>
        </Shell>
      );

    case 'completed':
      return (
        <Shell>
          <Card>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--ws-success)]/15 text-2xl text-[var(--ws-success)]">
              ✓
            </div>
            <h1 className="mt-5 text-2xl font-semibold text-white">Agreement signed</h1>
            <p className="mt-2 text-sm text-[var(--ws-body)]">
              {page.templateName}
              {page.completedAt ? ` · signed ${formatDate(page.completedAt)}` : ''}
            </p>
            <div className="mt-7 flex flex-col gap-3">
              {page.onboardingUrl && (
                <a
                  href={page.onboardingUrl}
                  className="inline-flex items-center justify-center rounded-xl bg-[var(--ws-btn)] px-6 py-3 text-sm font-semibold text-[var(--ws-page)]"
                >
                  Continue to onboarding
                </a>
              )}
              {page.hasSignedDocument && (
                <a
                  href={`/s/${encodeURIComponent(token)}/document`}
                  className={
                    page.onboardingUrl
                      ? 'inline-flex items-center justify-center rounded-xl border border-[var(--ws-border)] px-6 py-3 text-sm font-semibold text-white'
                      : 'inline-flex items-center justify-center rounded-xl bg-[var(--ws-btn)] px-6 py-3 text-sm font-semibold text-[var(--ws-page)]'
                  }
                >
                  Download your signed copy
                </a>
              )}
            </div>
          </Card>
        </Shell>
      );

    case 'open':
      return (
        <div className="mx-auto w-full max-w-3xl">
          <header className="mb-6 flex items-center justify-between gap-4">
            <Logo className="h-7 w-auto" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ws-dim)]">
              Private link
            </span>
          </header>

          <section className="animate-rise rounded-2xl border border-[var(--ws-border)] bg-[var(--ws-card)] p-5 sm:p-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ws-accent)]">
              Prepared for {page.recipientName}
              {page.businessName ? ` · ${page.businessName}` : ''}
            </p>
            <h1 className="mt-2 text-2xl font-semibold leading-tight text-white sm:text-3xl">{page.templateName}</h1>
            {page.templateDescription && (
              <p className="mt-2 text-sm leading-relaxed text-[var(--ws-body)]">{page.templateDescription}</p>
            )}
            <p className="mt-4 text-sm text-[var(--ws-body)]">
              Review it below, then sign in the signature box. Your signature is placed on each signature line in
              the agreement.
            </p>
          </section>

          {page.pages.map((section, index) => (
            <article
              key={`${index}-${section.title}`}
              className="animate-rise mt-4 rounded-2xl border border-[var(--ws-border)] bg-[var(--ws-card)] p-5 sm:p-7"
            >
              {section.title && <h2 className="text-lg font-semibold text-white">{section.title}</h2>}
              <div className="prose-da mt-4" dangerouslySetInnerHTML={{ __html: section.html }} />
            </article>
          ))}

          <AgreementSign
            token={token}
            embedSrc={page.embedSrc}
            recipientName={page.recipientName}
            recipientType={page.recipientType}
            signFields={signFields}
            onDone={startFinalizing}
          />

          <p className="mt-6 text-center text-xs text-[var(--ws-dim)]">
            Sent by Divine Acquisition. This link is private to you; please don&apos;t forward it.
          </p>
        </div>
      );
  }
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

function Spinner() {
  return (
    <div
      aria-hidden
      className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[var(--ws-border)] border-t-[var(--ws-accent)]"
    />
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}
