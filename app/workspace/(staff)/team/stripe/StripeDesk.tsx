'use client';

import { useActionState, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, KeyRound, Link2, Search } from 'lucide-react';
import type { ActionResult } from '@/lib/ad/rpc';
import { connectStripeAction, disconnectStripeAction, findCustomersAction, linkClientAction } from '@/lib/stripe/actions';
import type { StripeCustomerView } from '@/lib/stripe/connection';
import { DeskHeader, Pill, Section, danger, field, primary, secondary } from '../../components/desk';

export type StripeStatus =
  | { connected: false }
  | {
      connected: true;
      account_id: string | null;
      account_name: string | null;
      livemode: boolean;
      key_kind: 'secret' | 'restricted';
      key_last4: string;
      connected_at: string;
      connected_by: string | null;
    };

export type ClientRow = {
  case_file_id: string;
  name: string;
  contact_email: string | null;
  stripe_customer_id: string | null;
  seats: number;
  customer: StripeCustomerView | null;
  customerError: string | null;
};

function Result({ state }: { state: ActionResult | null }) {
  if (!state) return null;
  return <p className={`text-sm ${state.ok ? 'text-flag-good' : 'text-flag-critical'}`}>{state.ok ? state.message : state.error}</p>;
}

function cardText(card: StripeCustomerView['card']): string {
  if (!card) return 'No card on file';
  const brand = card.brand.charAt(0).toUpperCase() + card.brand.slice(1);
  return `${brand} ending ${card.last4}, expires ${String(card.expMonth).padStart(2, '0')}/${String(card.expYear).slice(-2)}`;
}

function ClientLink({ client, connected }: { client: ClientRow; connected: boolean }) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState(client.stripe_customer_id ?? '');
  const [matches, setMatches] = useState<StripeCustomerView[] | null>(null);
  const [message, setMessage] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  const link = (id: string) =>
    start(async () => {
      const result = await linkClientAction(client.case_file_id, id);
      setMessage(result);
      if (result.ok) {
        setMatches(null);
        router.refresh();
      }
    });

  const find = () =>
    start(async () => {
      const result = await findCustomersAction(client.contact_email ?? '');
      if (result.ok) {
        setMatches(result.customers);
        setMessage(result.customers.length ? null : { ok: false, error: `No Stripe customer uses ${client.contact_email}.` });
      } else setMessage({ ok: false, error: result.error });
    });

  const chargeable = Boolean(client.customer?.card) && !client.customer?.deleted;

  return (
    <li className="py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white">{client.name}</p>
          <p className="text-[13px] text-neutral-500">
            {client.contact_email ?? 'No contact email'} · {client.seats} seat{client.seats === 1 ? '' : 's'}
          </p>
        </div>
        {client.stripe_customer_id ? (
          chargeable ? <Pill tone="good">Ready to charge</Pill> : <Pill tone="warn">{client.customerError ? 'Check the link' : 'No card on file'}</Pill>
        ) : (
          <Pill tone="neutral">Not linked</Pill>
        )}
      </div>

      {client.customer ? (
        <p className="mt-2 flex items-center gap-2 text-[13px] text-neutral-300">
          <CreditCard className="size-3.5 text-neutral-500" aria-hidden />
          {client.customer.name ?? client.customer.email ?? client.customer.id} · {cardText(client.customer.card)}
        </p>
      ) : client.customerError ? (
        <p className="mt-2 text-[13px] text-flag-critical">{client.customerError}</p>
      ) : null}

      {connected ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            aria-label={`Stripe customer for ${client.name}`}
            placeholder="cus_..."
            className={`${field} w-56 font-mono text-[13px]`}
            value={customerId}
            onChange={(event) => setCustomerId(event.target.value)}
          />
          <button type="button" className={secondary} disabled={pending || customerId.trim() === (client.stripe_customer_id ?? '')} onClick={() => link(customerId)}>
            <Link2 className="size-4" aria-hidden />
            {customerId.trim() ? 'Link' : 'Unlink'}
          </button>
          {client.contact_email ? (
            <button type="button" className={secondary} disabled={pending} onClick={find}>
              <Search className="size-4" aria-hidden />
              Find by email
            </button>
          ) : null}
        </div>
      ) : null}

      {matches && matches.length ? (
        <ul className="mt-3 space-y-1.5">
          {matches.map((match) => (
            <li key={match.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.08] px-3 py-2 text-[13px]">
              <span className="text-neutral-300">
                <span className="font-mono text-white">{match.id}</span> · {match.name ?? 'No name'} · {cardText(match.card)}
              </span>
              <button type="button" className={secondary} disabled={pending} onClick={() => link(match.id)}>
                Use this one
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {message ? (
        <div className="mt-2">
          <Result state={message} />
        </div>
      ) : null}
    </li>
  );
}

export default function StripeDesk({ status, deployKey, clients }: { status: StripeStatus; deployKey: boolean; clients: ClientRow[] }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(connectStripeAction, null);
  const [removing, startRemove] = useTransition();
  const [removed, setRemoved] = useState<ActionResult | null>(null);
  const connected = status.connected || deployKey;

  return (
    <div className="space-y-5">
      <DeskHeader
        crumb="Account"
        title="Stripe"
        description="Connect Stripe so Billing can charge a client's card on file for each week. The key is checked with Stripe, then stored encrypted; nobody can read it back."
        actions={
          status.connected ? (
            <Pill tone={status.livemode ? 'good' : 'warn'}>{status.livemode ? 'Connected, live' : 'Connected, test mode'}</Pill>
          ) : deployKey ? (
            <Pill tone="good">Connected from the deploy</Pill>
          ) : (
            <Pill tone="bad">Not connected</Pill>
          )
        }
      />

      <Section title="Connection" icon={KeyRound}>
        {status.connected ? (
          <div className="mb-5 space-y-1 text-sm text-neutral-300">
            <p>
              <span className="text-white">{status.account_name ?? status.account_id ?? 'Stripe account'}</span>
              {status.account_id ? <span className="text-neutral-500"> · {status.account_id}</span> : null}
            </p>
            <p>
              {status.key_kind === 'restricted' ? 'Restricted key' : 'Secret key'} ending {status.key_last4} · {status.livemode ? 'live mode: real charges' : 'test mode: no real charges'}
            </p>
            <p className="text-neutral-500">
              Connected {new Date(status.connected_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              {status.connected_by ? ` by ${status.connected_by}` : ''}
            </p>
          </div>
        ) : deployKey ? (
          <p className="mb-5 text-sm text-neutral-300">Billing is using the STRIPE_SECRET_KEY set on the deploy. Connect a key here to manage it from the workspace instead.</p>
        ) : (
          <p className="mb-5 text-sm text-neutral-300">Billing cannot charge a card until Stripe is connected.</p>
        )}

        <form action={action} className="space-y-3">
          <label className="block text-[13px] text-neutral-400">
            {status.connected ? 'Replace the key' : 'Stripe key'}
            <input
              name="key"
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="rk_live_... or sk_live_..."
              className={`${field} mt-1.5 w-full font-mono`}
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className={primary} disabled={pending}>
              {pending ? 'Checking with Stripe…' : status.connected ? 'Check and replace' : 'Check and connect'}
            </button>
            {status.connected ? (
              <button
                type="button"
                className={danger}
                disabled={removing}
                onClick={() => {
                  if (!window.confirm('Disconnect Stripe? Billing will not be able to charge cards until you connect it again.')) return;
                  startRemove(async () => {
                    setRemoved(await disconnectStripeAction());
                    router.refresh();
                  });
                }}
              >
                Disconnect
              </button>
            ) : null}
            <Result state={state ?? removed} />
          </div>
        </form>

        <details className="mt-5 rounded-xl border border-white/[0.08] px-4 py-3 text-[13px] text-neutral-400">
          <summary className="cursor-pointer text-neutral-200">Which key to use</summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>In Stripe, open Developers, API keys, and choose Create restricted key.</li>
            <li>
              Set <span className="text-white">Customers: Read</span>, <span className="text-white">Invoices: Write</span>,{' '}
              <span className="text-white">PaymentIntents: Write</span> and <span className="text-white">Payment methods: Read</span>. Leave everything
              else at None. If a charge is refused, Stripe&apos;s message names the permission to add.
            </li>
            <li>Copy the key (it starts with rk_live_) and paste it above. A secret key (sk_live_) also works but can do far more.</li>
          </ol>
        </details>
      </Section>

      <Section title="Clients" icon={CreditCard} hint="Billing charges the card on file of the Stripe customer each client is linked to.">
        {clients.length === 0 ? (
          <p className="text-sm text-neutral-400">No clients with a seat yet.</p>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {clients.map((client) => (
              <ClientLink key={client.case_file_id} client={client} connected={connected} />
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
