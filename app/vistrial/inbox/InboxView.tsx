'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { btnSecondary } from '@/app/components/ui';
import { markStaffNotificationsReadAction } from '@/lib/portal/staffActions';

export type InboxData = {
  unread: number;
  items: {
    id: string;
    kind: string;
    severity: 'informational' | 'important' | 'urgent';
    title: string;
    body: string;
    operator_id: string | null;
    created_at: string;
    read_at: string | null;
  }[];
};

const TONE = {
  informational: 'border-white/[0.06]',
  important: 'border-flag-warning/40',
  urgent: 'border-flag-critical/50',
};

export default function InboxView({ data, error }: { data: InboxData; error: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const markAll = () =>
    startTransition(async () => {
      await markStaffNotificationsReadAction(null);
      router.refresh();
    });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-white">Inbox {data.unread ? <span className="text-sm text-neutral-400">({data.unread} unread)</span> : null}</h1>
        {data.unread ? (
          <button type="button" disabled={pending} onClick={markAll} className={`${btnSecondary} px-3 py-1.5 text-xs`}>
            Mark all read
          </button>
        ) : null}
      </div>
      {error ? <p className="text-sm text-flag-critical">{error}</p> : null}
      {data.items.length === 0 ? <p className="text-sm text-neutral-500">Nothing yet.</p> : null}
      <ul className="space-y-2">
        {data.items.map((item) => (
          <li key={item.id} className={`rounded-2xl border bg-white/[0.02] p-3.5 ${TONE[item.severity] ?? TONE.informational} ${item.read_at ? 'opacity-60' : ''}`}>
            <p className="text-sm font-medium text-white">{item.title}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-300">{item.body}</p>
            <p className="mt-1 text-[11px] text-neutral-500">
              {new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(item.created_at))}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
