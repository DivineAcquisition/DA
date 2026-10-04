import { headers } from 'next/headers';
import { academyAdminSession, academyHoldSession } from '@/lib/academy/access';
import Shell from './Shell';
import '../workspace.css';

/** True when the request is the unified admin portal (or a local unified path). */
export async function isUnifiedAdminRequest(): Promise<boolean> {
  const headerStore = await headers();
  return headerStore.get('x-da-unified-admin') === '1';
}

/**
 * Shared chrome for every admin surface on admin.divineacquisition.io.
 * One sidebar for the admin portal. Other surfaces remain reachable by URL.
 * Academy and Holds are resolved here too, so the sidebar is the same on
 * /vistrial, /da, /ad and /admin as it is on /workspace.
 */
export default async function UnifiedAdminChrome({
  email,
  children,
}: {
  email: string;
  children: React.ReactNode;
}) {
  const [academy, holds] = await Promise.all([academyAdminSession(), academyHoldSession()]);
  return (
    <div className="da-workspace">
      <Shell email={email} showAcademy={Boolean(academy)} showHolds={Boolean(holds)}>
        {children}
      </Shell>
    </div>
  );
}
