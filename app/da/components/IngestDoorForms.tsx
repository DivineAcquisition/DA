'use client';

import { useState, useTransition } from 'react';
import { btnSecondary, btnSizeSm } from '@/app/components/ui';
import { inputClass, labelClass, selectClass } from '@/app/vistrial/components/ui';
import {
  drainBacklogAction,
  mapAccountAction,
  refreshRollupAction,
  registerEndpointAction,
  rotateSecretAction,
  setEndpointActiveAction,
} from '@/lib/ingest/actions';
import { ActionForm, Disclosure } from './ActionForm';

type CaseFileOption = { id: string; name: string };

/**
 * Opening a door. The secret comes back in the result and is never readable
 * again — afterwards Vistrial holds a digest, or a Vault reference for a signed
 * door — so the message is the one chance to copy it into the provider.
 */
export function RegisterDoorForm({ caseFiles }: { caseFiles: CaseFileOption[] }) {
  return (
    <Disclosure label="Open a door">
      <ActionForm submitLabel="Open it" action={registerEndpointAction}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="door-provider">
              Provider
            </label>
            <select id="door-provider" name="provider" defaultValue="gohighlevel" className={selectClass}>
              <option value="gohighlevel">GoHighLevel</option>
              <option value="payments">Payment processor</option>
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="door-auth">
              How it authenticates
            </label>
            <select id="door-auth" name="auth_mode" defaultValue="shared_secret" className={selectClass}>
              <option value="shared_secret">Secret in a header</option>
              <option value="hmac_sha256">Signature over the body</option>
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="door-label">
              Name it
            </label>
            <input
              id="door-label"
              name="label"
              required
              className={inputClass}
              placeholder="Northside Dental GHL"
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="door-client">
              Client
            </label>
            <select id="door-client" name="case_file_id" defaultValue="" className={selectClass}>
              <option value="">No client — the payload says which</option>
              {caseFiles.map((caseFile) => (
                <option key={caseFile.id} value={caseFile.id}>
                  {caseFile.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs leading-relaxed text-neutral-500">
          A door bound to a client is the fallback tenant for anything arriving through it. Leave it unset for a
          shared pipe, such as the payment processor, where the client comes from the payload or the invoice the
          payment references.
        </p>
      </ActionForm>
    </Disclosure>
  );
}

/**
 * Mapping a sending account to a client. This is the action that clears an
 * unattributed backlog, because every event already stored against that account
 * is dispatched on the way out.
 */
export function MapAccountForm({ caseFiles }: { caseFiles: CaseFileOption[] }) {
  return (
    <Disclosure label="Map a sending account" tone="neutral">
      <ActionForm variant="secondary" submitLabel="Map it and process what was waiting" action={mapAccountAction}>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClass} htmlFor="map-provider">
              Provider
            </label>
            <select id="map-provider" name="provider" defaultValue="gohighlevel" className={selectClass}>
              <option value="gohighlevel">GoHighLevel</option>
              <option value="payments">Payment processor</option>
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="map-account">
              Account in the payload
            </label>
            <input id="map-account" name="account_ref" required className={inputClass} placeholder="loc_A1b2C3" />
          </div>
          <div>
            <label className={labelClass} htmlFor="map-client">
              Client
            </label>
            <select id="map-client" name="case_file_id" required defaultValue="" className={selectClass}>
              <option value="">Choose a client…</option>
              {caseFiles.map((caseFile) => (
                <option key={caseFile.id} value={caseFile.id}>
                  {caseFile.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs leading-relaxed text-neutral-500">
          One account resolves to exactly one client, which is what makes attribution a lookup rather than a
          judgement.
        </p>
      </ActionForm>
    </Disclosure>
  );
}

export function DoorActions({ endpointId, active }: { endpointId: string; active: boolean }) {
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean } & ({ message: string } | { error: string })>) =>
    startTransition(async () => {
      const result = await fn();
      setMessage({ ok: result.ok, text: 'message' in result ? result.message : result.error });
    });

  return (
    <div className="mt-3 border-t border-white/[0.06] pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => rotateSecretAction(endpointId))}
          className={`${btnSecondary} ${btnSizeSm}`}
        >
          Rotate the secret
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => setEndpointActiveAction(endpointId, !active))}
          className={`${btnSecondary} ${btnSizeSm}`}
        >
          {active ? 'Close the door' : 'Open the door'}
        </button>
      </div>

      {message && (
        <p
          className={`mt-3 break-words rounded-xl border px-3.5 py-2.5 text-[13px] leading-relaxed ${
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

/** Runs the sweeper now rather than waiting for the next cron minute. */
export function DrainBacklogButton() {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <span className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await drainBacklogAction();
            setMessage(result.ok ? result.message : result.error);
          })
        }
        className={`${btnSecondary} ${btnSizeSm}`}
      >
        {pending ? 'Processing…' : 'Process the queue now'}
      </button>
      {message && <span className="text-[11px] text-neutral-500">{message}</span>}
    </span>
  );
}

export function RefreshRollupButton() {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <span className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await refreshRollupAction();
            setMessage(result.ok ? result.message : result.error);
          })
        }
        className={`${btnSecondary} ${btnSizeSm}`}
      >
        {pending ? 'Recomputing…' : 'Recompute'}
      </button>
      {message && <span className="text-[11px] text-neutral-500">{message}</span>}
    </span>
  );
}
