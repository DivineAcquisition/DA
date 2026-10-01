import { adminMfaState } from '@/lib/auth/mfa';
import { hubSignOutAction } from '@/lib/vistrial/authActions';
import AdminMfaGate from './AdminMfaGate';

/**
 * The admin app's second-factor rule, for every admin surface's layout. Renders
 * the enrol or challenge screen in place of the page until this session has
 * verified a factor; renders the page once it has.
 */
export default async function RequireAdminMfa({ email, children }: { email: string; children: React.ReactNode }) {
  const mfa = await adminMfaState();
  if (mfa.state === 'ok') return <>{children}</>;
  return <AdminMfaGate state={mfa.state} factorId={mfa.factorId} email={email} signOut={hubSignOutAction} />;
}
