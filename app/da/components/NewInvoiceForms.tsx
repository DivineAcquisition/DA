'use client';

import { useState, useTransition } from 'react';
import { btnPrimary, btnSecondary, btnSizeSm } from '@/app/components/ui';
import { Badge, Panel, inputClass, labelClass, selectClass } from '@/app/vistrial/components/ui';
import { buildPerformanceInvoiceAction, createFixedInvoiceAction } from '@/lib/da/billingActions';

export default function NewInvoiceForms({
  caseFiles,
}: {
  caseFiles: { id: string; name: string; slug: string; status: string }[];
}) {
  const [mode, setMode] = useState<'none' | 'performance' | 'fixed'>('none');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (formData: FormData, fn: (data: FormData) => Promise<{ ok: boolean } & ({ message: string } | { error: string })>) =>
    startTransition(async () => {
      const result = await fn(formData);
      setMessage({ ok: result.ok, text: 'message' in result ? result.message : result.error });
      if (result.ok) setMode('none');
    });

  return (
    <section>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode(mode === 'performance' ? 'none' : 'performance')}
          className={`${btnPrimary} ${btnSizeSm}`}
        >
          Bill confirmed appointments
        </button>
        <button
          type="button"
          onClick={() => setMode(mode === 'fixed' ? 'none' : 'fixed')}
          className={`${btnSecondary} ${btnSizeSm}`}
        >
          New fixed charge
        </button>
      </div>

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

      {mode === 'performance' && (
        <Panel className="mt-4 p-5">
          <p className="mb-4 flex flex-wrap items-center gap-2 text-xs leading-relaxed text-neutral-500">
            <Badge tone="good">Confirmed only</Badge>
            The draft is drawn from confirmed bookings in the period. Pending claims and rejections are never
            included, and a booking already billed cannot be billed again.
          </p>
          <form className="space-y-4" action={(formData) => run(formData, buildPerformanceInvoiceAction)}>
            <div>
              <label className={labelClass} htmlFor="pf-client">
                Client
              </label>
              <select id="pf-client" name="case_file_id" required className={selectClass}>
                {caseFiles.map((caseFile) => (
                  <option key={caseFile.id} value={caseFile.id}>
                    {caseFile.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="pf-start">
                  Period start
                </label>
                <input id="pf-start" name="period_start" type="date" required className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="pf-end">
                  Period end
                </label>
                <input id="pf-end" name="period_end" type="date" required className={inputClass} />
              </div>
            </div>
            <button type="submit" disabled={pending} className={`${btnPrimary} ${btnSizeSm}`}>
              {pending ? 'Building…' : 'Build the draft'}
            </button>
          </form>
        </Panel>
      )}

      {mode === 'fixed' && (
        <Panel className="mt-4 p-5">
          <form className="space-y-4" action={(formData) => run(formData, createFixedInvoiceAction)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="fx-client">
                  Client
                </label>
                <select id="fx-client" name="case_file_id" required className={selectClass}>
                  {caseFiles.map((caseFile) => (
                    <option key={caseFile.id} value={caseFile.id}>
                      {caseFile.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="fx-type">
                  Charge
                </label>
                <select id="fx-type" name="charge_type" defaultValue="retainer" className={selectClass}>
                  <option value="audit_fee">Audit fee</option>
                  <option value="install_fee">Install fee</option>
                  <option value="retainer">Monthly retainer</option>
                  <option value="bundled_term">Three-month bundled term</option>
                </select>
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="fx-desc">
                Description
              </label>
              <input id="fx-desc" name="description" required className={inputClass} />
            </div>
            <div className="grid gap-4 sm:grid-cols-4">
              <div>
                <label className={labelClass} htmlFor="fx-amount">
                  Amount
                </label>
                <input id="fx-amount" name="amount" type="number" step="0.01" required className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="fx-due">
                  Due
                </label>
                <input id="fx-due" name="due_at" type="date" className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="fx-ps">
                  Period start
                </label>
                <input id="fx-ps" name="period_start" type="date" className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="fx-pe">
                  Period end
                </label>
                <input id="fx-pe" name="period_end" type="date" className={inputClass} />
              </div>
            </div>
            <button type="submit" disabled={pending} className={`${btnPrimary} ${btnSizeSm}`}>
              {pending ? 'Creating…' : 'Create draft'}
            </button>
          </form>
        </Panel>
      )}
    </section>
  );
}
