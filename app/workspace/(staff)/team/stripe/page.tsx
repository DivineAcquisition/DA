import type { Metadata } from 'next';
import { controlRpc, readable } from '@/lib/ad/rpc';
import { readStripeCustomer, resolveStripeKey, type StripeCustomerView } from '@/lib/stripe/connection';
import { createClient } from '@/lib/supabase/server';
import { DeskHeader, Problem } from '../../components/desk';
import StripeDesk, { type ClientRow, type StripeStatus } from './StripeDesk';

export const metadata: Metadata = { title: 'Stripe' };
export const dynamic = 'force-dynamic';

export default async function StripePage() {
  const supabase = await createClient();
  const [status, clients] = await Promise.all([
    controlRpc<StripeStatus>(supabase, 'stripe_connection_status', {}),
    controlRpc<Array<Omit<ClientRow, 'customer' | 'customerError'>>>(supabase, 'stripe_clients', {}),
  ]);
  if (status.error || !status.data) {
    return (
      <div>
        <DeskHeader title="Stripe" />
        <Problem>{readable(status.error)}</Problem>
      </div>
    );
  }

  const key = await resolveStripeKey();
  const rows: ClientRow[] = await Promise.all(
    (clients.data ?? []).map(async (client) => {
      if (!client.stripe_customer_id || !key) return { ...client, customer: null, customerError: null };
      const found = await readStripeCustomer(key.key, client.stripe_customer_id);
      return found.ok ? { ...client, customer: found.customer as StripeCustomerView, customerError: null } : { ...client, customer: null, customerError: found.error };
    }),
  );

  return <StripeDesk status={status.data} deployKey={key?.source === 'deploy'} clients={rows} />;
}
