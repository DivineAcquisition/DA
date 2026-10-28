import { listWorkspaceAccounts } from '@/lib/workspace/workspace-lists';
import AccountsList from './components/AccountsList';

export const dynamic = 'force-dynamic';

export default async function AccountsPage() {
  let accounts: Awaited<ReturnType<typeof listWorkspaceAccounts>> = [];
  let loadError: string | undefined;
  try {
    accounts = await listWorkspaceAccounts();
  } catch (error) {
    loadError = error instanceof Error ? error.message : 'Accounts could not be loaded.';
  }

  return (
    <div>
      <AccountsList accounts={accounts} loadError={loadError} />
    </div>
  );
}
