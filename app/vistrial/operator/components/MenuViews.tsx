'use client';

import Link from 'next/link';
import { useState } from 'react';
import { btnPrimary, btnSecondary, btnSizeSm } from '@/app/components/ui';
import { markNotificationReadAction, replyFormalNoticeAction, setEmailPrefsAction } from '@/lib/portal/actions';
import { SEVERITY_LABEL, SEVERITY_TONE } from '@/lib/portal/labels';
import { formatDate, formatDateTime } from '@/lib/portal/time';
import type { FormalNotice, InboxItem, ProfileData } from '@/lib/portal/types';
import { Badge, inputClass } from '../../components/ui';
import { Card, CardTitle, Empty, Feedback, useAction, usePortal, VaButton, VaFieldset } from './portal';

/** Every message DA sent, each linking to the record it is about. */
export function InboxView({ items }: { items: InboxItem[] }) {
  const { operatorZone, context, readOnly } = usePortal();
  const prefs = useAction();
  const optional = context.operator.email_optional !== false;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Notifications</h1>
      <Card>
        {items.length === 0 ? <Empty>Nothing yet.</Empty> : null}
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id} className={`rounded-xl px-3 py-2.5 ${n.read_at ? 'bg-white/[0.02]' : 'bg-white/[0.05]'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={`text-sm ${n.read_at ? 'text-neutral-300' : 'font-semibold text-white'}`}>{n.title}</p>
                  <p className="mt-0.5 whitespace-pre-line text-xs leading-relaxed text-neutral-400">{n.body}</p>
                  <p className="mt-1 text-[11px] text-neutral-600">
                    {formatDateTime(n.created_at, operatorZone)}
                    {n.emailed ? ' · also emailed' : ''}
                  </p>
                </div>
                {n.severity !== 'informational' ? <Badge tone={SEVERITY_TONE[n.severity]}>{SEVERITY_LABEL[n.severity]}</Badge> : null}
              </div>
              <div className="mt-2 flex gap-3 text-xs">
                {n.link ? (
                  <Link
                    href={n.link}
                    onClick={() => {
                      if (!n.read_at && !readOnly) void markNotificationReadAction(n.id);
                    }}
                    className="text-brand-200 underline-offset-4 hover:underline"
                  >
                    Open the record
                  </Link>
                ) : null}
                {!n.read_at ? (
                  <VaButton type="button" onClick={() => markNotificationReadAction(n.id)} className="text-neutral-400 hover:text-white">
                    Mark read
                  </VaButton>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardTitle>Email</CardTitle>
        <p className="text-sm text-neutral-400">
          Messages about your shifts, pay, standards and notices always reach you. Non-urgent ones wait for your working hours and
          arrive together in one daily email.
        </p>
        <VaFieldset className="mt-3">
          <label className="flex items-center gap-2 text-sm text-neutral-200">
            <input type="checkbox" checked={optional} onChange={(e) => prefs.run(() => setEmailPrefsAction(e.target.checked))} />
            Also email me the optional ones (weekly summary, standards heads-up)
          </label>
        </VaFieldset>
        <Feedback message={prefs.message} error={prefs.error} />
      </Card>
    </div>
  );
}

/** Signed agreements and the tax document status: what someone needs after they leave too. */
export function AgreementsView({ data }: { data: ProfileData }) {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Agreements</h1>
      <Card>
        {data.agreements.length === 0 ? <Empty>No agreements on file.</Empty> : null}
        <ul className="space-y-2">
          {data.agreements.map((agreement) => (
            <li key={agreement.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5 text-sm">
              <span className="min-w-0">
                <span className="block text-neutral-200">{agreement.name}</span>
                <span className="block text-xs text-neutral-500">
                  {agreement.status === 'completed' && agreement.completed_at
                    ? `Signed ${formatDate(agreement.completed_at.slice(0, 10), true)}`
                    : 'Not signed yet'}
                </span>
              </span>
              {agreement.has_copy ? (
                <a href={`/vistrial/operator/agreements/${agreement.id}`} className={`${btnSecondary} px-3 py-1 text-xs`}>
                  Download
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>
      {data.pay_visible ? (
        <Card>
          <CardTitle>Tax document</CardTitle>
          <p className="text-sm text-neutral-300">
            {data.tax_doc_status === 'on_file'
              ? 'On file with DA.'
              : data.tax_doc_status === 'submitted'
                ? 'Submitted, waiting for DA to check it.'
                : data.tax_doc_status === 'expired'
                  ? 'Expired. DA will ask for a new one.'
                  : 'Not on file yet.'}
          </p>
        </Card>
      ) : null}
    </div>
  );
}

/** A formal notice: sent by a named admin, never automatically. The VA may reply once, on the record. */
export function NoticeView({ notice }: { notice: FormalNotice }) {
  const { operatorZone } = usePortal();
  const [reply, setReply] = useState('');
  const action = useAction();
  return (
    <div className="space-y-4">
      <Card className="border border-flag-critical/40">
        <Badge tone="critical">Formal notice</Badge>
        <h1 className="mt-3 text-lg font-semibold text-white">{notice.subject}</h1>
        <p className="mt-1 text-xs text-neutral-500">
          Sent {formatDateTime(notice.sent_at, operatorZone)}
          {notice.sent_by ? ` by ${notice.sent_by}` : ''}
        </p>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-neutral-200">{notice.body}</p>
      </Card>
      <Card>
        <CardTitle>Your response</CardTitle>
        {notice.reply ? (
          <>
            <p className="whitespace-pre-wrap text-sm text-neutral-200">{notice.reply}</p>
            {notice.replied_at ? <p className="mt-2 text-xs text-neutral-500">Sent {formatDateTime(notice.replied_at, operatorZone)}. It is kept with this record.</p> : null}
          </>
        ) : (
          <VaFieldset>
            <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={5} className={inputClass} placeholder="Your reply is kept with this notice." />
            <button
              type="button"
              disabled={action.pending || reply.trim().length < 5}
              onClick={() => action.run(() => replyFormalNoticeAction(notice.id, reply))}
              className={`${btnPrimary} ${btnSizeSm} mt-2`}
            >
              Send my reply
            </button>
          </VaFieldset>
        )}
        <Feedback message={action.message} error={action.error} />
      </Card>
    </div>
  );
}
