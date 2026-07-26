'use client';

import Link from 'next/link';
import { formatDay, formatMoney } from '@/lib/vistrial/format';
import { industryName } from '@/lib/vistrial/industries';
import { PLACEMENT_STATUS_LABELS } from '@/lib/vistrial/rules/lifecycle';
import { useOps } from '@/lib/vistrial/store';
import { AdminOnly } from '../../components/AppShell';
import { Badge, PageHeader } from '../../components/ui';

export default function ClientsPage() {
  return (
    <AdminOnly>
      <CaseFileList />
    </AdminOnly>
  );
}

function CaseFileList() {
  const { gateway } = useOps();
  const clients = gateway.allClients();

  return (
    <div>
      <PageHeader
        eyebrow="Case files"
        title="Client workspaces"
        description="The case file is the container: configuration, current and past placements, every log, uploaded evidence, and scope requests. It stays with the client when a placement ends."
      />

      <ul className="space-y-2.5">
        {clients.map((client) => {
          const placements = gateway.placementsForClient(client.id);
          const live = placements.find((placement) => placement.status === 'active');
          const status = live ? gateway.statusOf(live) : 'ended';
          const logCount =
            gateway.reports().filter((report) => placements.some((p) => p.id === report.placementId)).length;

          return (
            <li key={client.id}>
              <Link
                href={`/vistrial/admin/clients/${client.id}`}
                className="panel panel-hover block rounded-2xl px-5 py-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h2 className="text-[15px] font-semibold text-white">{client.name}</h2>
                      <Badge tone="brand">{industryName(client.config.industry)}</Badge>
                      <Badge tone={status === 'active' ? 'good' : status === 'expiring' ? 'warning' : 'neutral'}>
                        {live ? PLACEMENT_STATUS_LABELS[status] : 'No live placement'}
                      </Badge>
                    </div>
                    <p className="mt-1.5 text-sm text-neutral-500">{client.vertical}</p>
                    <p className="mt-2 text-xs text-neutral-600">
                      {live
                        ? `${gateway.operatorName(live.operatorId)} · quota ${live.monthlyBookingQuota}/mo · ${formatMoney(live.commissionPerBooking)} per booking`
                        : `Onboarded ${formatDay(client.onboardedOn)} · case file retained`}
                    </p>
                  </div>
                  <div className="shrink-0 text-left sm:text-right">
                    <p className="text-sm font-semibold tabular-nums text-white">{logCount}</p>
                    <p className="text-[11px] text-neutral-500">EOD reports on file</p>
                    <p className="mt-1 text-[11px] text-neutral-600">
                      {placements.length} placement{placements.length === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
