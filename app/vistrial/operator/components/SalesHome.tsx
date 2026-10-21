'use client';

import Link from 'next/link';
import { btnPrimary, btnSecondary, btnSizeSm } from '@/app/components/ui';
import { workingDays } from '@/lib/portal/labels';
import { zoneAbbreviation } from '@/lib/portal/time';
import { Card, CardTitle, usePortal } from './portal';

const ACADEMY = 'https://training.divineacquisition.io/academy';

/** Team home for a Sales Operator: training, end of day, sales, and the client card. */
export default function SalesHome({ placementId }: { placementId: string | null }) {
  const { context } = usePortal();
  const placed = Boolean(placementId ?? context.placements[0]);
  const name = context.operator.first_name || context.operator.name;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Hi {name}</h1>
      <Card>
        <CardTitle>Training</CardTitle>
        <p className="text-sm text-neutral-300">
          The Academy is where you take the quizzes. Start with the first three: Who We Are, The DA Standard, and What We Sell and Why It Works.
        </p>
        <a href={ACADEMY} className={`${btnPrimary} ${btnSizeSm} mt-4`}>
          Open the Academy
        </a>
      </Card>
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardTitle>End of day</CardTitle>
          <p className="text-sm text-neutral-400">File what you worked at the end of the shift.</p>
          <Link href="/vistrial/operator/reports" className={`${btnSecondary} ${btnSizeSm} mt-4`}>
            {placed ? 'File end of day' : 'End of day opens with a client'}
          </Link>
        </Card>
        <Card>
          <CardTitle>Sales</CardTitle>
          <p className="text-sm text-neutral-400">Log a sale when you book someone. DA reviews it before it counts.</p>
          <Link href="/vistrial/operator/bookings" className={`${btnSecondary} ${btnSizeSm} mt-4`}>
            {placed ? 'Log a sale' : 'Sales logging opens with a client'}
          </Link>
        </Card>
      </div>
      <ClientCard placementId={placementId} />
    </div>
  );
}

/** Name, shift, days, and time zone. No credentials, money, or the rest of the account. */
export function ClientCard({ placementId }: { placementId: string | null }) {
  const { context } = usePortal();
  const placement = context.placements.find((item) => item.id === placementId) ?? context.placements[0] ?? null;
  return (
    <Card>
      <CardTitle>Client</CardTitle>
      {placement ? (
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <Detail label="Account" value={placement.client_name} />
          <Detail label="Time zone" value={zoneAbbreviation(new Date().toISOString(), placement.time_zone) || placement.time_zone} />
          <Detail label="Shift" value={placement.shift_start && placement.shift_end ? `${placement.shift_start}–${placement.shift_end}` : 'Set by DA'} />
          <Detail label="Days" value={workingDays(placement.working_days)} />
        </dl>
      ) : (
        <p className="text-sm text-neutral-400">No client is assigned yet. You will see the account name, shift, and time zone here when one is.</p>
      )}
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] px-3 py-2">
      <dt className="text-[11px] text-neutral-500">{label}</dt>
      <dd className="font-medium text-white">{value}</dd>
    </div>
  );
}
