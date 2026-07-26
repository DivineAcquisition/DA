import Link from 'next/link';
import { btnSecondary, btnSizeSm } from '@/app/components/ui';
import { Badge, EmptyState, PageHeader, Panel, SectionHeader } from '@/app/vistrial/components/ui';
import { getMyAccount, getMyMessages } from '@/lib/acct/queries';
import MessageForm from '../components/MessageForm';

export const dynamic = 'force-dynamic';

export default async function ClientMessages() {
  const account = await getMyAccount();
  if (!account) return <EmptyState title="No engagement attached to this account" />;

  const messages = await getMyMessages(account.case_file_id);
  const readOnly = account.state === 'archived';

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Messages"
        title="Ask DA something"
        description="A request channel with a record, not a chat. Anything you send here is logged against your engagement and comes back with an answer."
        actions={
          <Link href="/acct" className={`${btnSecondary} ${btnSizeSm}`}>
            Back to overview
          </Link>
        }
      />

      {!readOnly && <MessageForm caseFileId={account.case_file_id} />}

      {messages.length === 0 ? (
        <EmptyState title="Nothing sent yet" />
      ) : (
        <section>
          <SectionHeader title="Your requests" />
          <ul className="space-y-2.5">
            {messages.map((message) => (
              <li key={message.id}>
                <Panel className="px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge
                      tone={
                        message.status === 'open' ? 'warning' : message.status === 'answered' ? 'good' : 'neutral'
                      }
                    >
                      {message.status}
                    </Badge>
                    <span className="text-[11px] tabular-nums text-neutral-600">
                      {message.created_at.slice(0, 16).replace('T', ' ')}
                    </span>
                  </div>
                  <p className="mt-2 text-[13px] leading-relaxed text-neutral-200">{message.body}</p>

                  {message.answer && (
                    <div className="mt-3 rounded-xl border border-brand-500/20 bg-brand-500/[0.07] px-3.5 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-300">
                        Divine Acquisition
                      </p>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-brand-50">{message.answer}</p>
                    </div>
                  )}
                </Panel>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
