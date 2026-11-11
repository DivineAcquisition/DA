import type { Metadata } from 'next';
import { loadWeekCharge } from '@/lib/billing/week-data';
import { DeskHeader, Empty, Problem } from '../components/desk';
import WeeklyBilling from './WeeklyBilling';

export const metadata: Metadata = { title: 'Billing' };
export const dynamic = 'force-dynamic';

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ seat?: string; week?: string }> }) {
  const query = await searchParams;
  const { data, error } = await loadWeekCharge(query.seat, query.week);

  if (error || !data) {
    return (
      <div>
        <DeskHeader title="Weekly billing" />
        <Problem>{error ?? 'Billing did not load.'}</Problem>
      </div>
    );
  }
  if (!data.placement) {
    return (
      <div>
        <DeskHeader title="Weekly billing" />
        <Empty>There is no seat to bill yet. Billing opens once a seat is scheduled or active.</Empty>
      </div>
    );
  }
  return <WeeklyBilling key={`${data.placement.id}:${data.week_start}`} data={data} />;
}
