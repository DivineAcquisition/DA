import type { Metadata } from 'next';
import { OfferBriefView } from '@/app/components/placement/OfferBrief';
import { controlRpc } from '@/lib/ad/rpc';
import type { OfferBrief } from '@/lib/placement/offer';
import { workingDays } from '@/lib/portal/labels';
import { createClient } from '@/lib/supabase/server';
import { ClientCard } from '../components/SalesHome';
import { WorkNav } from '../components/RecordNav';
import { renderPortal } from '../components/frame';
import { loadPortal } from '@/lib/portal/load';

export const metadata: Metadata = { title: 'Client' };
export const dynamic = 'force-dynamic';

/** The short client card. Name, shift, days, and time zone. Nothing else about the account. */
export default async function ClientPage() {
  const load = await loadPortal<null>('client');
  const brief = await operatorBrief();
  return renderPortal(load, 'client', (_data, placementId, context) => (
    <>
      {context.sales_operator ? <WorkNav current="client" /> : null}
      <ClientCard placementId={placementId} />
      {brief ? (
        <div className="mt-4">
          <OfferBriefView
            client={placementId ? null : brief.client}
            shift={
              placementId
                ? null
                : `${brief.shift_start}–${brief.shift_end} ${brief.time_zone}. ${workingDays(brief.working_days)}. Starts ${brief.start_date}.`
            }
            offer={brief.offer}
            outcomes={brief.outcomes}
          />
        </div>
      ) : null}
    </>
  ));
}

async function operatorBrief() {
  const supabase = await createClient();
  const { data } = await controlRpc<{
    client: string | null;
    shift_start: string;
    shift_end: string;
    time_zone: string;
    working_days: number[];
    start_date: string;
    offer: Partial<OfferBrief>;
    outcomes: Array<{ name: string; definition: string }>;
  } | null>(supabase, 'so_offer_brief');
  return data;
}
