'use client';

import { useState } from 'react';
import { btnSecondary, btnSizeSm } from '@/app/components/ui';

export default function CopyOnboardLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className={`${btnSecondary} ${btnSizeSm}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? 'Copied' : 'Copy client link'}
      </button>
      <span className="max-w-full truncate text-xs text-neutral-500">{url}</span>
    </div>
  );
}
