import { listWorkspaceAccounts } from '@/lib/workspace/workspace-lists';
import AccountsList from './components/AccountsList';

export const dynamic = 'force-dynamic';

export default async function AccountsPage() {
  const accounts = await listWorkspaceAccounts();
  return (
    <div className="animate-rise">
      <AccountsList accounts={accounts} />
    </div>
  );
}
