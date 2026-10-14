import Link from 'next/link';
import OnboardingView from '@/app/o/[token]/OnboardingView';
import { appUrl } from '@/lib/apps';
import { formatDateTime } from '@/lib/workspace/format';
import { publicOnboardingUrl } from '@/lib/workspace/paths';
import {
  getSettings,
  listRecipients,
  listSalesOperatorOnboarding,
  loadSalesOperatorProtocol,
} from '@/lib/workspace/queries';
import { signingPublicBaseUrl } from '@/lib/workspace/resolve-signing';
import { StartOnboardingForm } from '../components/StartOnboardingForm';
import { DataTable, EmptyState, PageHeader, StatusBadge } from '../components/ui';
import { ws } from '../components/tokens';

export const dynamic = 'force-dynamic';

export default async function OnboardingAdminPage() {
  const [protocol, runs, operators, settings] = await Promise.all([
    loadSalesOperatorProtocol(),
    listSalesOperatorOnboarding(),
    listRecipients({ type: 'operator', status: 'active' }),
    getSettings(),
  ]);
  const base = signingPublicBaseUrl(settings?.public_base_url);

  return (
    <div className="animate-rise space-y-10">
      <PageHeader
        title="Sales operator onboarding"
        description="The form an operator fills after you start it: who they are, their shift, bank details, and four confirmations. Finishing enrolls them in the Academy and opens the case file their end-of-day reports and metrics are filed on."
      />

      <section className={`${ws.card} space-y-4 p-5 sm:p-6`}>
        <h2 className={`${ws.heading} text-lg font-semibold`}>Start it</h2>
        <p className="max-w-2xl text-sm text-[var(--ws-dim)]">
          Choose the operator and start their onboarding. The form opens right away. Sending the placement
          agreement is still a separate step. If they already have one open, this gives you that same link.
        </p>
        {operators.length === 0 ? (
          <EmptyState
            title="No active operators"
            description="Add an operator under Recipients, then start onboarding from here."
          />
        ) : (
          <StartOnboardingForm
            operators={operators.map((operator) => ({
              id: operator.id,
              full_name: operator.full_name,
              email: operator.email,
            }))}
          />
        )}
        <p className="text-sm">
          <Link href="/workspace/recipients?type=operator" className="text-[var(--ws-accent)] hover:underline">
            Operator recipients
          </Link>
        </p>
      </section>

      <section>
        <h2 className={`${ws.heading} mb-3.5 text-lg font-semibold`}>Open and finished</h2>
        {runs.length === 0 ? (
          <EmptyState title="No onboarding yet" description="Started runs show up here with their link." />
        ) : (
          <DataTable headers={['Operator', 'Status', 'Opened', 'Finished', 'Case file', 'Link']}>
            {runs.map((run) => (
              <tr key={run.id}>
                <td className="px-4 py-3 text-white">
                  <Link href={`/workspace/recipients/${run.recipientId}`} className="hover:underline">
                    {run.recipientName}
                  </Link>
                  <p className="text-xs text-[var(--ws-dim)]">{run.email}</p>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={run.status} />
                </td>
                <td className="px-4 py-3 text-[var(--ws-dim)]">{formatDateTime(run.openedAt)}</td>
                <td className="px-4 py-3 text-[var(--ws-dim)]">{formatDateTime(run.completedAt)}</td>
                <td className="px-4 py-3">
                  {run.caseFileId ? (
                    <Link href={`/vistrial/admin/clients/${run.caseFileId}`} className="text-sm text-[var(--ws-accent)] hover:underline">
                      Profile
                    </Link>
                  ) : (
                    <span className="text-[var(--ws-dim)]">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <a
                    className="text-sm text-[var(--ws-accent)] hover:underline"
                    href={publicOnboardingUrl(base, run.token)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open
                  </a>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className={`${ws.heading} text-lg font-semibold`}>What they see</h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--ws-dim)]">
            The same screens, with nothing saved. Four pages: who they are, the shift, bank details, then the confirmations.
          </p>
        </div>
        {protocol && protocol.steps.length > 0 ? (
          <div className="rounded-3xl border border-white/10 bg-ink-950 p-4 sm:p-6">
            <OnboardingView
              preview
              academyUrl={appUrl('training')}
              token="preview"
              initial={{
                state: 'open',
                recipientName: 'Alex Rivera',
                recipientType: 'operator',
                protocolName: protocol.name,
                protocolIntro: protocol.intro,
                prefill: {},
                answers: {},
                steps: protocol.steps,
              }}
            />
          </div>
        ) : (
          <EmptyState
            title="The onboarding steps could not be loaded"
            description="They live on the sales operator protocol. Refresh once the database is available."
          />
        )}
      </section>
    </div>
  );
}
