'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { btnPrimary, btnSizeMd } from '@/app/components/ui';
import { Badge, Panel, inputClass, labelClass } from '@/app/vistrial/components/ui';

export default function PassphraseForm({ token, wrong = false }: { token: string; wrong?: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState('');

  return (
    <Panel className="mx-auto max-w-md p-7">
      <Badge tone="brand">Protected link</Badge>
      <h1 className="mt-4 text-lg font-semibold text-white">Enter the passphrase</h1>
      <p className="mt-2 text-sm leading-relaxed text-neutral-400">
        Your Divine Acquisition contact will have sent it separately from the link.
      </p>

      {wrong && (
        <p className="mt-4 rounded-xl border border-flag-critical/25 bg-flag-critical/[0.08] px-3.5 py-2.5 text-sm text-flag-critical">
          That passphrase did not match. Check it and try again.
        </p>
      )}

      <form
        className="mt-6 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          router.push(`/share/${token}?p=${encodeURIComponent(value)}`);
        }}
      >
        <div>
          <label className={labelClass} htmlFor="passphrase">
            Passphrase
          </label>
          <input
            id="passphrase"
            type="password"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className={inputClass}
            required
          />
        </div>
        <button type="submit" className={`${btnPrimary} ${btnSizeMd} w-full`}>
          Open dashboard
        </button>
      </form>
    </Panel>
  );
}
