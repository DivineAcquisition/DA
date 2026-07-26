import Link from 'next/link';
import { btnSecondary, btnSizeSm } from '@/app/components/ui';
import { Badge, Panel } from '@/app/vistrial/components/ui';
import { getSessionContext } from '@/lib/supabase/server';

/**
 * Rule 8, at the front of an admin page. The layout already gates the surface and
 * RLS refuses the data regardless; this is what a non-admin sees if they navigate
 * straight to a route.
 *
 * Deliberately not the operator hub's AdminOnly, which reads the hub's client
 * store and therefore cannot run outside it.
 */
export default async function AdminGate({ children }: { children: React.ReactNode }) {
  const session = await getSessionContext();

  if (session?.isAdmin) return <>{children}</>;

  return (
    <Panel className="px-6 py-14 text-center">
      <Badge tone="critical">Refused at the data layer</Badge>
      <h1 className="mt-4 text-xl font-semibold text-white">This surface is admin-only</h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-neutral-400">
        {session
          ? `${session.email} is signed in without an admin role.`
          : 'Sign in with an admin account to see this.'}{' '}
        Row-level security returns nothing for this account on every table here.
      </p>
      <Link href="/da" className={`${btnSecondary} ${btnSizeSm} mt-6`}>
        Back
      </Link>
    </Panel>
  );
}
