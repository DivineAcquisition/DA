'use client';

import Link from 'next/link';
import { btnPrimary, btnSizeMd } from '@/app/components/ui';
import { useOps } from '@/lib/vistrial/store';
import { PageHeader, Panel } from './components/ui';

/**
 * Entry point. Real auth decides the surface, so this only routes: the admin goes
 * to the exception queue, an operator to their shift.
 */
export default function VistrialHome() {
  const { gateway, actor } = useOps();
  const target = gateway.isAdmin ? '/vistrial/admin' : '/vistrial/operator';

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow="VA Ops Hub"
        title={gateway.isAdmin ? 'Where do I need to look today' : `Your shift, ${actor.name.split(' ')[0]}`}
        description={
          gateway.isAdmin
            ? 'Every client, placement, operator, log and metric, with the exceptions first.'
            : 'Your active placement, your standing numbers, and the things you can do about them.'
        }
      />

      <Panel className="p-6">
        <Link href={target} className={`${btnPrimary} ${btnSizeMd}`}>
          {gateway.isAdmin ? 'Open the admin view' : 'Go to my shift'}
        </Link>
        <p className="mt-4 text-xs leading-relaxed text-neutral-500">
          Clients have no access to any part of the hub, and operators see only their own placements. That is
          enforced by the database, not by which links are shown here.
        </p>
      </Panel>
    </div>
  );
}
