import { headers } from 'next/headers';
import { loadPortal } from '@/lib/portal/load';
import type { TabKey } from '@/lib/portal/zones';
import PortalShell from '../components/PortalShell';
import { jakarta } from './fonts';

function tabFor(pathname: string): TabKey {
  if (pathname.includes('/workspace/eod') || pathname.includes('/workspace/history')) return 'reports';
  return 'today';
}

/** Sales dashboard and EOD screens use the same operator shell as the rest of the portal. */
export async function WorkspaceShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  const pathname = (await headers()).get('x-pathname') ?? '';
  const load = await loadPortal<null>(tabFor(pathname));
  if (load.kind === 'closed') {
    return <p className="px-4 py-10 text-sm text-neutral-300">{load.message}</p>;
  }
  return (
    <PortalShell context={load.context} placementId={load.placementId} tab={tabFor(pathname)} blocked={load.blocked}>
      <div className={`${jakarta.variable} ${wide ? 'mx-auto max-w-6xl' : 'mx-auto max-w-3xl'}`}>{children}</div>
    </PortalShell>
  );
}
