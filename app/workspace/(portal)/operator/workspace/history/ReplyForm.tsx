'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { replyEodAction } from '@/lib/sales-workspace/actions';
import { brand } from '../WorkspaceFrame';

export default function ReplyForm({ eodId, parentId, readOnly }: { eodId: string; parentId: string; readOnly: boolean }) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (readOnly) return <p className="mt-3 text-sm text-neutral-400">View-as is read-only. Exit to let the operator reply.</p>;
  return (
    <form
      className="mt-3 space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        start(async () => {
          const result = await replyEodAction(eodId, parentId, body);
          if (!result.ok) setError(result.error);
          else {
            setBody('');
            router.refresh();
          }
        });
      }}
    >
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={3}
        required
        placeholder="Reply"
        className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-white outline-none focus:border-[#937DFF]"
      />
      {error ? <p className="text-sm text-[#FFB020]">{error}</p> : null}
      <button type="submit" disabled={pending} className={brand.primaryButton}>
        {pending ? 'Sending' : 'Reply'}
      </button>
    </form>
  );
}
