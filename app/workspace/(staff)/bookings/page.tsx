import ProspectBookingPanel from '../components/ProspectBookingPanel';
import { PageHeader } from '../components/ui';
import { airtableReady } from '@/lib/acq/pipeline';
import { calendarConfigured } from '@/lib/assessment/calendar';

export const dynamic = 'force-dynamic';

export default async function ProspectCallsPage() {
  return (
    <div className="animate-rise">
      <PageHeader
        title="Prospect calls"
        description="Internal booking for acquisition prospects stored in this workspace. Search, map the lead onto a Lead Leak Audit, and create the meeting. A copy is sent to the lead list when a destination token is set."
      />
      <ProspectBookingPanel airtableReady={await airtableReady()} calendarReady={calendarConfigured()} />
    </div>
  );
}
