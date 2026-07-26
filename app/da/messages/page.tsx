import Link from 'next/link';
import { btnSecondary, btnSizeSm } from '@/app/components/ui';
import { Badge, EmptyState, PageHeader, Panel, SectionHeader, StatGrid, StatTile } from '@/app/vistrial/components/ui';
import AdminGate from '../components/AdminGate';
import { listClientMessages } from '@/lib/da/billing';
import AnswerMessageForm from '../components/AnswerMessageForm';

export const dynamic = 'force-dynamic';

export default async function MessagesPage() {
  return (
    <AdminGate>
      <Messages />
    </AdminGate>
  );
}

async function Messages() {
  const messages = await listClientMessages();

  const open = messages.filter((message) => message.status === 'open');
  const isOverdue = (message: { status: string; response_due_at: string }) =>
    message.status === 'open' && new Date(message.response_due_at) < new Date();
  const overdue = open.filter(isOverdue);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Client requests"
        title="What clients have asked for"
        description="A request channel with a record. Each one carries a response window and is logged against the engagement."
        actions={
          <Link href="/da" className={`${btnSecondary} ${btnSizeSm}`}>
            All engagements
          </Link>
        }
      />

      <StatGrid columns={3}>
        <StatTile label="Open" value={String(open.length)} tone={open.length > 0 ? 'warning' : 'good'} />
        <StatTile
          label="Past the response window"
          value={String(overdue.length)}
          tone={overdue.length > 0 ? 'critical' : 'good'}
        />
        <StatTile label="Total logged" value={String(messages.length)} />
      </StatGrid>

      {messages.length === 0 ? (
        <EmptyState title="Nothing from clients yet" />
      ) : (
        <section>
          <SectionHeader title="Queue" hint="Oldest unanswered first." />
          <ul className="space-y-2.5">
            {[...messages]
              .sort((a, b) => {
                if (a.status !== b.status) return a.status === 'open' ? -1 : 1;
                return Date.parse(a.created_at) - Date.parse(b.created_at);
              })
              .map((message) => {
                const client = message.client_case_file as { name: string; slug: string } | null;
                const overdueRow = isOverdue(message);

                return (
                  <li key={message.id}>
                    <Panel className={`px-5 py-4 ${overdueRow ? 'border-flag-critical/25' : ''}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={message.status === 'open' ? (overdueRow ? 'critical' : 'warning') : 'good'}>
                            {overdueRow ? 'overdue' : message.status}
                          </Badge>
                          {client && (
                            <Link href={`/da/${client.slug}`} className="text-xs text-neutral-400 hover:text-brand-200">
                              {client.name}
                            </Link>
                          )}
                          <span className="text-[11px] text-neutral-600">from {message.author_name}</span>
                        </div>
                        <span className="text-[11px] tabular-nums text-neutral-600">
                          {message.created_at.slice(0, 16).replace('T', ' ')}
                        </span>
                      </div>

                      <p className="mt-2 text-[13px] leading-relaxed text-neutral-200">{message.body}</p>

                      {message.answer && (
                        <div className="mt-3 rounded-xl border border-brand-500/20 bg-brand-500/[0.07] px-3.5 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-300">
                            Answered
                          </p>
                          <p className="mt-1.5 text-[13px] leading-relaxed text-brand-50">{message.answer}</p>
                        </div>
                      )}

                      {message.status === 'open' && (
                        <div className="mt-3.5">
                          <AnswerMessageForm messageId={message.id} />
                        </div>
                      )}
                    </Panel>
                  </li>
                );
              })}
          </ul>
        </section>
      )}
    </div>
  );
}
