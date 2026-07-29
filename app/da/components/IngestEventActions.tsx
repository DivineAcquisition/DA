'use client';

import { useState, useTransition } from 'react';
import { btnPrimary, btnSecondary, btnSizeSm } from '@/app/components/ui';
import { labelClass, selectClass } from '@/app/vistrial/components/ui';
import { attributeEventAction, replayEventAction } from '@/lib/ingest/actions';
import type { IngestStatus } from '@/lib/ingest/types';

/**
 * The two things an admin can do about a delivery the pipeline could not finish.
 *
 * Neither rewrites what arrived. Attributing says which client an unattributable
 * event belongs to; replaying reinterprets the same stored payload. Both are
 * audited, and both go through the database function rather than touching rows.
 */
export default function IngestEventActions({
  eventId,
  status,
  rawBody,
  caseFiles,
}: {
  eventId: string;
  status: IngestStatus;
  rawBody: string;
  caseFiles: { id: string; name: string }[];
}) {
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [showPayload, setShowPayload] = useState(false);
  const [attributing, setAttributing] = useState(false);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean } & ({ message: string } | { error: string })>) =>
    startTransition(async () => {
      const result = await fn();
      setMessage({ ok: result.ok, text: 'message' in result ? result.message : result.error });
      if (result.ok) setAttributing(false);
    });

  return (
    <div className="mt-3 border-t border-white/[0.06] pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => replayEventAction(eventId))}
          className={`${btnPrimary} ${btnSizeSm}`}
        >
          Replay
        </button>

        {status === 'unattributed' && (
          <button
            type="button"
            onClick={() => setAttributing((value) => !value)}
            className={`${btnSecondary} ${btnSizeSm}`}
          >
            {attributing ? 'Cancel' : 'Attribute to a client'}
          </button>
        )}

        <button
          type="button"
          onClick={() => setShowPayload((value) => !value)}
          className="text-xs font-semibold text-brand-300 transition-colors hover:text-brand-200"
        >
          {showPayload ? 'Hide payload' : 'Payload as it arrived'}
        </button>
      </div>

      {attributing && (
        <form className="mt-3 space-y-3" action={(formData) => run(() => attributeEventAction(eventId, formData))}>
          <div>
            <label className={labelClass} htmlFor={`client-${eventId}`}>
              Which client this belongs to
            </label>
            <select id={`client-${eventId}`} name="case_file_id" required className={selectClass}>
              <option value="">Choose a client…</option>
              {caseFiles.map((caseFile) => (
                <option key={caseFile.id} value={caseFile.id}>
                  {caseFile.name}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs leading-relaxed text-neutral-500">
            If the payload named an account, map the account instead — that clears every event queued behind it
            and every one that arrives later. Attributing by hand fixes this delivery only.
          </p>
          <button type="submit" disabled={pending} className={`${btnPrimary} ${btnSizeSm}`}>
            Attribute and process
          </button>
        </form>
      )}

      {showPayload && (
        <pre className="mt-3 max-h-64 overflow-auto rounded-xl bg-white/[0.02] px-3.5 py-3 text-[11px] leading-relaxed text-neutral-400">
          {rawBody}
        </pre>
      )}

      {message && (
        <p
          className={`mt-3 rounded-xl border px-3.5 py-2.5 text-[13px] leading-relaxed ${
            message.ok
              ? 'border-flag-good/25 bg-flag-good/[0.08] text-flag-good'
              : 'border-flag-critical/25 bg-flag-critical/[0.08] text-flag-critical'
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
