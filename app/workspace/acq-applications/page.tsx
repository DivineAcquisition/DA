import { listApplicationCounts } from '@/lib/acq/application-server';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Application counts',
};

export default async function ApplicationCountsPage() {
  const counts = await listApplicationCounts();

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 text-white">
      <h1 className="text-2xl font-semibold tracking-tight">Application counts</h1>
      <p className="mt-2 max-w-2xl text-sm text-neutral-400">
        One row per ad per day. Test applications are excluded. Drop-off is the gap between popup opens and
        step 1, step 1 and a finished application, and calendar routes and bookings.
      </p>
      {counts.length === 0 ? (
        <p className="mt-8 text-sm text-neutral-400">No applications yet.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
            <thead className="text-neutral-400">
              <tr>
                {[
                  'Day',
                  'Ad',
                  'Opens',
                  'Step 1',
                  'Step 2',
                  'Calendar',
                  'Not a fit',
                  'Not yet',
                  'Booked',
                  'Left after open',
                  'Left after step 1',
                  'Left after calendar',
                  'Sync failures',
                ].map((label) => (
                  <th key={label} className="border-b border-white/10 px-2 py-2 font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {counts.map((row) => (
                <tr key={`${row.day}-${row.ad}`}>
                  <td className="border-b border-white/5 px-2 py-2">{row.day}</td>
                  <td className="border-b border-white/5 px-2 py-2">{row.ad}</td>
                  <td className="border-b border-white/5 px-2 py-2">{row.popupOpens}</td>
                  <td className="border-b border-white/5 px-2 py-2">{row.step1Submits}</td>
                  <td className="border-b border-white/5 px-2 py-2">{row.step2Completions}</td>
                  <td className="border-b border-white/5 px-2 py-2">{row.calendar}</td>
                  <td className="border-b border-white/5 px-2 py-2">{row.closed}</td>
                  <td className="border-b border-white/5 px-2 py-2">{row.later}</td>
                  <td className="border-b border-white/5 px-2 py-2">{row.bookings}</td>
                  <td className="border-b border-white/5 px-2 py-2">{row.dropOffAfterOpen}</td>
                  <td className="border-b border-white/5 px-2 py-2">{row.dropOffAfterStep1}</td>
                  <td className="border-b border-white/5 px-2 py-2">{row.dropOffAfterStep2}</td>
                  <td className="border-b border-white/5 px-2 py-2">{row.failures}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
