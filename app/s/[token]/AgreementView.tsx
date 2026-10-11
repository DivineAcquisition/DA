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
              <h1 className="mt-6 text-[1.7rem] font-medium tracking-[-0.03em] text-white">Finalizing your agreement</h1>
              <p className="mt-2 text-sm text-[var(--ws-body)]">This usually takes a few seconds. Keep this page open.</p>
            </>
          ) : (
            <>
              <h1 className="text-[1.7rem] font-medium tracking-[-0.03em] text-white">We received your signature</h1>
              <p className="mt-2 text-sm leading-relaxed text-[var(--ws-body)]">
                Your signed copy will be ready here shortly. You don&apos;t need to sign again.
              </p>
              <button
                type="button"
                onClick={startFinalizing}
                className="mt-8 inline-flex h-12 w-full items-center justify-center rounded-full bg-white px-6 text-[13px] font-semibold tracking-[0.08em] text-[#121018] uppercase sm:w-auto"
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
            <h1 className="text-[1.7rem] font-medium tracking-[-0.03em] text-white">You declined this agreement</h1>
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
            <h1 className="text-[1.7rem] font-medium tracking-[-0.03em] text-white">A newer version was sent</h1>
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
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[var(--ws-success)]/30 bg-[var(--ws-success)]/10 text-xl text-[var(--ws-success)]">
              ✓
            </div>
            <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#c3b6fe]">Complete</p>
            <h1 className="mt-3 text-[2rem] font-medium leading-none tracking-[-0.03em] text-white">Agreement signed</h1>
            <p className="mt-3 text-sm leading-relaxed text-[var(--ws-body)]">
              {page.templateName}
              {page.completedAt ? ` · signed ${formatDate(page.completedAt)}` : ''}
            </p>
            <div className="mt-8 flex flex-col gap-3">
              {page.onboardingUrl && (
                <a
                  href={page.onboardingUrl}
                  className="inline-flex h-12 items-center justify-center rounded-full bg-white px-6 text-[13px] font-semibold tracking-[0.08em] text-[#121018] uppercase"
                >
                  Continue to onboarding
                </a>
              )}
              {page.hasSignedDocument && (
                <a
                  href={`/s/${encodeURIComponent(token)}/document`}
                  className={
                    page.onboardingUrl
                      ? 'inline-flex h-12 items-center justify-center rounded-full border border-white/15 px-6 text-[13px] font-semibold tracking-[0.08em] text-white uppercase'
                      : 'inline-flex h-12 items-center justify-center rounded-full bg-white px-6 text-[13px] font-semibold tracking-[0.08em] text-[#121018] uppercase'
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
        <div className="mx-auto w-full max-w-[760px] pb-8">
          <header className="flex items-end justify-between gap-6 border-b border-white/10 pb-5">
            <Logo className="h-6 w-auto" />
            <p className="pb-0.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/40">Private signing</p>
          </header>

          <section className="animate-rise pt-10 sm:pt-14">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#c3b6fe]">
              Prepared for {page.recipientName}
              {page.businessName ? ` · ${page.businessName}` : ''}
            </p>
            <h1 className="mt-4 max-w-[16ch] text-[2.4rem] font-medium leading-[1.02] tracking-[-0.04em] text-white sm:text-[3.35rem]">
              {page.templateName}
            </h1>
            {page.templateDescription && (
              <p className="mt-5 max-w-[46ch] text-[15px] leading-7 text-white/60">{page.templateDescription}</p>
            )}
            <p className="mt-6 max-w-[46ch] text-sm leading-relaxed text-white/40">
              Read the agreement, then sign once. That signature is placed on each signature line.
            </p>
          </section>

          {page.pages.map((section, index) => (
            <article
              key={`${index}-${section.title}`}
              className="animate-rise mt-8 rounded-[28px] border border-white/10 bg-[#12111a] px-6 py-8 sm:px-10 sm:py-10"
            >
              {section.title && (
                <h2 className="text-xl font-medium tracking-[-0.02em] text-white">{section.title}</h2>
              )}
              <div className="prose-da mt-4 text-[15px]" dangerouslySetInnerHTML={{ __html: section.html }} />
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

          <p className="mt-10 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-white/30">
            Divine Acquisition · Private to you
          </p>
        </div>
      );
  }
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[82vh] w-full max-w-[440px] flex-col items-center justify-center">
      <Logo className="mb-10 h-6 w-auto" />
      {children}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full animate-rise rounded-[28px] border border-white/10 bg-white/[0.04] px-8 py-10 text-center shadow-[0_30px_80px_rgba(0,0,0,0.35)] sm:px-10">
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
