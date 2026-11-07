'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { ActionResult } from '@/lib/ad/rpc';

type Result = ActionResult & { href?: string };

/**
 * A stage action on a desk. On success it opens the record the action made
 * (href) or refreshes the page so the new stage shows.
 */
export default function DeskForm({
  action,
  className,
  children,
}: {
  action: (fd: FormData) => Promise<Result>;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className={className}
      action={(formData) => {
        setResult(null);
        start(async () => {
          const next = await action(formData);
          setResult(next);
          if (next.ok && next.href) router.push(next.href);
          else if (next.ok) router.refresh();
        });
      }}
    >
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {result && !result.ok ? (
        <p role="alert" className="basis-full text-sm text-[#FFB020]">
          {result.error}
        </p>
      ) : null}
      {result?.ok ? <p className="basis-full text-sm text-neutral-300">{result.message}</p> : null}
      {pending ? <p className="basis-full text-xs text-neutral-500">Saving.</p> : null}
    </form>
  );
}
