import type { Metadata } from 'next';
import { controlRpc, readable } from '@/lib/ad/rpc';
import { checkStripeKey, readStripeCustomer, resolveStripeKey, type StripeCustomerView } from '@/lib/stripe/connection';
import { createClient } from '@/lib/supabase/server';
import { DeskHeader, Problem } from '../../components/desk';
import StripeDesk, { type ClientRow, type StripeStatus } from './StripeDesk';

export const metadata: Metadata = { title: 'Stripe' };
export const dynamic = 'force-dynamic';

export default async function StripePage() {
  const supabase = await createClient();
  const clients = await controlRpc<Array<Omit<ClientRow, 'customer' | 'customerError'>>>(supabase, 'stripe_clients', {});
  if (clients.error) {
    return (
      <div>
        <DeskHeader title="Stripe" />
        <Problem>{readable(clients.error)}</Problem>
      </div>
    );
  }

  // The key lives on the server only (STRIPE_SECRET_KEY). It is checked with
  // Stripe here; nothing about it but the outcome reaches the page.
  const key = await resolveStripeKey();
  const check = key ? await checkStripeKey(key.key) : null;
  const status: StripeStatus = !key
    ? { state: 'missing' }
    : check?.ok
      ? { state: 'connected', accountName: check.accountName, accountId: check.accountId, livemode: check.livemode, restricted: key.key.startsWith('rk_') }
      : { state: 'failing', error: check?.ok === false ? check.error : 'Stripe did not answer.' };

  const usable = status.state === 'connected' ? key : null;
  const rows: ClientRow[] = await Promise.all(
    (clients.data ?? []).map(async (client) => {
      if (!client.stripe_customer_id || !usable) return { ...client, customer: null, customerError: null };
      const found = await readStripeCustomer(usable.key, client.stripe_customer_id);
      return found.ok ? { ...client, customer: found.customer as StripeCustomerView, customerError: null } : { ...client, customer: null, customerError: found.error };
    }),
  );

  return <StripeDesk status={status} clients={rows} />;
}
