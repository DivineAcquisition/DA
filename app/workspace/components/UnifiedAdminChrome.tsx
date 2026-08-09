import { headers } from 'next/headers';
import Shell from './Shell';
import '../workspace.css';

/** True when the request is the unified admin portal (or a local unified path). */
export async function isUnifiedAdminRequest(): Promise<boolean> {
  const headerStore = await headers();
  return headerStore.get('x-da-unified-admin') === '1';
}

/**
 * Shared chrome for every admin surface on admin.divineacquisition.io.
 * Sidebar is agreements-focused; other surfaces remain reachable by URL.
 */
export default function UnifiedAdminChrome({
  email,
  children,
}: {
  email: string;
  children: React.ReactNode;
}) {
  return (
    <div className="da-workspace">
      <Shell email={email}>{children}</Shell>
    </div>
  );
}
