'use client';

import { useState, useTransition } from 'react';
import { btnPrimary, btnSecondary, btnSizeSm } from '@/app/components/ui';
import { inputClass, labelClass } from '@/app/vistrial/components/ui';
import type { ActionResult } from '@/lib/da/documentActions';

/**
 * The state transitions, which run one way only: a draft goes to review, a review
 * publishes and freezes, and a published document is either archived or corrected
 * by a new version. Nothing comes back.
 */
export default function DocumentActions({
  state,
  isCaseStudy,
  anonymisationConfirmed,
  openFlags,
  superseded,
  submitForReview,
  publish,
  archive,
  correct,
  createCaseStudy,
  markReady,
  refresh,
}: {
  state: string;
  isCaseStudy: boolean;
  anonymisationConfirmed: boolean;
  openFlags: number;
  superseded: boolean;
  submitForReview: () => Promise<ActionResult>;
  publish: () => Promise<ActionResult>;
  archive: () => Promise<ActionResult>;
  correct: (formData: FormData) => Promise<ActionResult | void>;
  createCaseStudy: (formData: FormData) => Promise<ActionResult | void>;
  markReady: () => Promise<ActionResult>;
  refresh: () => Promise<ActionResult>;
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [showCorrect, setShowCorrect] = useState(false);
  const [showCaseStudy, setShowCaseStudy] = useState(false);

  const run = (action: () => Promise<ActionResult>) => () => {
    setResult(null);
    startTransition(async () => setResult(await action()));
  };

  const submitForm = (action: (formData: FormData) => Promise<ActionResult | void>) => (formData: FormData) => {
    setResult(null);
    startTransition(async () => {
      const outcome = await action(formData);
      if (outcome) setResult(outcome);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {state === 'draft' && (
          <>
            <button onClick={run(refresh)} disabled={pending} className={`${btnSecondary} ${btnSizeSm}`}>
              Re-read the figures
            </button>
            {isCaseStudy && !anonymisationConfirmed && (
              <button
                onClick={run(markReady)}
                disabled={pending || openFlags > 0}
                className={`${btnPrimary} ${btnSizeSm}`}
              >
                {openFlags > 0
                  ? `${openFlags} reference${openFlags === 1 ? '' : 's'} still to decide`
                  : 'Confirm anonymisation'}
              </button>
            )}
            <button
              onClick={run(submitForReview)}
              disabled={pending || (isCaseStudy && openFlags > 0)}
              className={`${isCaseStudy && !anonymisationConfirmed ? btnSecondary : btnPrimary} ${btnSizeSm}`}
            >
              Send to review
            </button>
          </>
        )}

        {state === 'in_review' && !isCaseStudy && (
          <button onClick={run(publish)} disabled={pending} className={`${btnPrimary} ${btnSizeSm}`}>
            Publish to the client
          </button>
        )}

        {state === 'published' && !superseded && !isCaseStudy && (
          <button
            onClick={() => setShowCorrect((value) => !value)}
            className={`${btnSecondary} ${btnSizeSm}`}
          >
            {showCorrect ? 'Cancel' : 'Publish a correction'}
          </button>
        )}

        {state === 'published' && !isCaseStudy && (
          <button
            onClick={() => setShowCaseStudy((value) => !value)}
            className={`${btnSecondary} ${btnSizeSm}`}
          >
            {showCaseStudy ? 'Cancel' : 'Draft a case study'}
          </button>
        )}

        {state !== 'archived' && state !== 'draft' && (
          <button onClick={run(archive)} disabled={pending} className={`${btnSecondary} ${btnSizeSm}`}>
            Archive
          </button>
        )}

        <button onClick={() => window.print()} className={`${btnSecondary} ${btnSizeSm}`}>
          Print or save as PDF
        </button>
      </div>

      {showCorrect && (
        <form className="space-y-3 rounded-xl border border-white/[0.1] bg-white/[0.02] p-4" action={submitForm(correct)}>
          <div>
            <label className={labelClass} htmlFor="correction_note">
              What was wrong, and what changed *
            </label>
            <input
              id="correction_note"
              name="correction_note"
              required
              placeholder="Show rate was stated for the wrong period. Corrected to July."
              className={inputClass}
            />
          </div>
          <p className="text-xs leading-relaxed text-neutral-500">
            This note appears on the cover of the new version. The published original stays exactly as the client
            received it, and both versions remain on the record.
          </p>
          <button type="submit" disabled={pending} className={`${btnPrimary} ${btnSizeSm}`}>
            Create version
          </button>
        </form>
      )}

      {showCaseStudy && (
        <form
          className="space-y-3 rounded-xl border border-white/[0.1] bg-white/[0.02] p-4"
          action={submitForm(createCaseStudy)}
        >
          <div>
            <label className={labelClass} htmlFor="descriptor">
              How the subject should read *
            </label>
            <input
              id="descriptor"
              name="descriptor"
              required
              placeholder="a med spa in the Mid-Atlantic"
              className={inputClass}
            />
          </div>
          <p className="text-xs leading-relaxed text-neutral-500">
            The numbers, the growth arc and the selected evidence carry through intact. Identifying references in the
            narrative are flagged for you to rewrite rather than silently stripped, because an automatic pass that
            misses one reference is worse than none.
          </p>
          <button type="submit" disabled={pending} className={`${btnPrimary} ${btnSizeSm}`}>
            Create draft
          </button>
        </form>
      )}

      {result && (
        <div
          className={`rounded-xl border px-3.5 py-2.5 text-sm leading-relaxed ${
            result.ok
              ? 'border-flag-good/25 bg-flag-good/[0.08] text-flag-good'
              : 'border-flag-critical/25 bg-flag-critical/[0.08] text-flag-critical'
          }`}
        >
          {result.ok ? result.message : result.error}
        </div>
      )}
    </div>
  );
}
