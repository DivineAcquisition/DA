import type { Metadata } from 'next';
import Link from 'next/link';
import { ENGAGEMENT_STATUSES, STATUS_LABEL, listClientFiles, type EngagementStatus } from '@/lib/clients/desk';
import { DeskHeader, Empty, primary, when } from '../components/desk';
import { EngagementPill } from './bits';

export const metadata: Metadata = { title: 'Clients' };
export const dynamic = 'force-dynamic';

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const all = await listClientFiles();
  const filter = (ENGAGEMENT_STATUSES as readonly string[]).includes(status ?? '') ? (status as EngagementStatus) : null;
  const rows = filter ? all.filter((row) => row.status === filter) : all.filter((row) => row.status !== 'ended');

  return (
    <div>
      <DeskHeader
        title="Case files"
        description="One client, one case file, for the whole engagement. Prospects become a file with Establish account."
        actions={
          <Link href="/workspace/clients/prospects" className={primary}>
            Establish from a prospect
          </Link>
        }
      />
      <nav aria-label="Status" className="mb-4 flex flex-wrap gap-1">
        <Chip href="/workspace/clients" active={!filter}>
          Open
        </Chip>
        {ENGAGEMENT_STATUSES.map((value) => (
          <Chip key={value} href={`/workspace/clients?status=${value}`} active={filter === value}>
            {STATUS_LABEL[value]} · {all.filter((row) => row.status === value).length}
          </Chip>
        ))}
      </nav>
      {rows.length === 0 ? (
        <Empty>No case files here.</Empty>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id}>
              <Link href={`/workspace/clients/${row.id}`} className="panel panel-hover flex flex-wrap items-center gap-3 rounded-2xl px-5 py-4">
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-white">{row.name}</span>
                    <EngagementPill status={row.status} />
                  </span>
                  <span className="mt-1 block truncate text-sm text-neutral-400">
                    {[row.vertical, row.contact_name, row.contact_email].filter(Boolean).join(' · ') || 'No contact on file'}
                  </span>
                </span>
                <span className="text-sm text-neutral-400">
                  {row.live ? `${row.live} seat${row.live === 1 ? '' : 's'}` : 'No seat'} · since {when(row.engagement_start)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`rounded-lg px-3 py-1.5 text-sm ${active ? 'bg-[#6A00FF]/20 text-white' : 'text-neutral-400 hover:text-white'}`}
    >
      {children}
    </Link>
  );
}
