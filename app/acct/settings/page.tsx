import Link from 'next/link';
import { btnSecondary, btnSizeSm } from '@/app/components/ui';
import { Badge, EmptyState, PageHeader, Panel, SectionHeader } from '@/app/vistrial/components/ui';
import { getMyAccount, getMyPreferences } from '@/lib/acct/queries';
import PreferencesForm from '../components/PreferencesForm';

export const dynamic = 'force-dynamic';

export default async function ClientSettings() {
  const account = await getMyAccount();
  if (!account) return <EmptyState title="No engagement attached to this account" />;

  const prefs = await getMyPreferences();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Settings"
        title="Notifications"
        description="Choose what we email you. Billing notices always send, so they are not listed here."
        actions={
          <Link href="/acct" className={`${btnSecondary} ${btnSizeSm}`}>
            Back to overview
          </Link>
        }
      />

      <PreferencesForm
        initial={{
          weekly_digest: prefs?.weekly_digest ?? true,
          milestone_alerts: prefs?.milestone_alerts ?? true,
          report_published: prefs?.report_published ?? true,
        }}
      />

      <section>
        <SectionHeader title="Your account" />
        <Panel className="px-5 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.05] py-3.5">
            <span className="text-[13px] text-neutral-400">Access</span>
            <Badge tone={account.state === 'active' ? 'good' : 'warning'}>{account.state}</Badge>
          </div>
          {account.job_title && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.05] py-3.5">
              <span className="text-[13px] text-neutral-400">Role</span>
              <span className="text-[13px] text-white">{account.job_title}</span>
            </div>
          )}
          {account.access_until && (
            <div className="flex flex-wrap items-center justify-between gap-2 py-3.5">
              <span className="text-[13px] text-neutral-400">Access until</span>
              <span className="text-[13px] text-white">{account.access_until}</span>
            </div>
          )}
        </Panel>
        <p className="mt-2.5 text-xs leading-relaxed text-neutral-600">
          Colleagues can have their own accounts on this engagement. Ask your Divine Acquisition contact to
          invite them; logins are never shared.
        </p>
      </section>
    </div>
  );
}
