import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Backdrop from '@/app/components/Backdrop';
import Logo from '@/app/components/Logo';
import { Badge, EmptyState, PageHeader, Panel, SectionHeader } from '@/app/vistrial/components/ui';
import { createClient, supabaseConfigured } from '@/lib/supabase/server';
import type { FunnelSummary } from '@/lib/acct/queries';
import type { GrowthRow } from '@/lib/da/queries';
import { GrowthTable } from '@/app/da/components/growth';
import {
  EfficiencyTiles,
  FunnelStages,
  HeadlineTiles,
  SourceTable,
  money,
} from '@/app/acct/components/dashboard';
import PassphraseForm from './PassphraseForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Your dashboard',
  robots: { index: false, follow: false, nocache: true },
};

type SharedPayload = {
  client: { name: string; vertical: string | null; status: string };
  link: { label: string | null; expires_at: string };
  funnel: FunnelSummary;
  growth: GrowthRow[];
  milestones: { id: string; title: string; description: string | null; occurred_on: string }[];
};

/**
 * A6: the lower-friction alternative to an account, for clients who will not
 * create one. The token is the authorization — a single gated database function
 * validates it and returns only the fields A3 permits.
 */
export default async function SharedDashboard({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ p?: string }>;
}) {
  const { token } = await params;
  const { p: passphrase } = await searchParams;

  if (!supabaseConfigured) {
    return (
      <Shell>
        <EmptyState title="Not available" />
      </Shell>
    );
  }

  const supabase = await createClient();
  const userAgent = (await headers()).get('user-agent');

  const { data, error } = await supabase.rpc('shared_dashboard', {
    p_token: token,
    p_passphrase: passphrase,
    p_user_agent: userAgent ?? undefined,
  });

  if (error || !data) {
    if (error?.message?.includes('link_passphrase_required')) {
      return (
        <Shell>
          <PassphraseForm token={token} wrong={Boolean(passphrase)} />
        </Shell>
      );
    }

    return (
      <Shell>
        <Panel className="p-8 text-center">
          <Badge tone="critical">Link unavailable</Badge>
          <h1 className="mt-4 text-lg font-semibold text-white">This link cannot be opened</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-neutral-400">
            It may have expired or been revoked. Ask your Divine Acquisition contact for a fresh one.
          </p>
        </Panel>
      </Shell>
    );
  }

  const payload = data as unknown as SharedPayload;
  const { funnel, growth, milestones, client, link } = payload;
  const comparable = growth.filter((row) => row.improved !== null);

  return (
    <Shell>
      <div className="space-y-8">
        <PageHeader
          eyebrow={client.vertical ?? 'Shared dashboard'}
          title={client.name}
          description={`${funnel.period.start} to ${funnel.period.end}. A read-only view, shared by Divine Acquisition, which expires ${new Date(link.expires_at).toLocaleDateString('en-GB')}.`}
        />

        <HeadlineTiles funnel={funnel} />

        <div className="grid gap-6 lg:grid-cols-2">
          <section>
            <SectionHeader title="Your funnel" hint="Where inquiries go, step by step." />
            <FunnelStages funnel={funnel} />
          </section>
          <section>
            <SectionHeader title="Efficiency" />
            <EfficiencyTiles funnel={funnel} />
          </section>
        </div>

        <section>
          <SectionHeader title="By source" />
          <SourceTable funnel={funnel} />
        </section>

        {funnel.totals.reactivation_revenue > 0 && (
          <Panel className="border-flag-good/25 bg-flag-good/[0.06] p-5">
            <Badge tone="good">Recovered revenue</Badge>
            <p className="mt-2.5 text-sm leading-relaxed text-white">
              {money(funnel.totals.reactivation_revenue)} came from customers already in the database who had
              gone quiet, at no ad spend.
            </p>
          </Panel>
        )}

        {comparable.length > 0 && (
          <section>
            <SectionHeader
              title="Since the audit"
              hint="Against the starting position captured before anything was installed."
            />
            <GrowthTable rows={growth} />
          </section>
        )}

        {milestones.length > 0 && (
          <section>
            <SectionHeader title="Milestones" />
            <ul className="space-y-2.5">
              {milestones.slice(0, 8).map((milestone) => (
                <li key={milestone.id}>
                  <Panel className="px-5 py-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-white">{milestone.title}</p>
                      <span className="text-[11px] tabular-nums text-neutral-600">{milestone.occurred_on}</span>
                    </div>
                    {milestone.description && (
                      <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">{milestone.description}</p>
                    )}
                  </Panel>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ink-950 text-white antialiased">
      <Backdrop />
      <div className="relative z-10">
        <header className="border-b border-white/[0.06]">
          <div className="mx-auto flex h-16 max-w-5xl items-center px-5 sm:px-6">
            <Logo className="h-6 w-auto" />
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-5 py-8 sm:px-6">{children}</main>
        <footer className="border-t border-white/[0.06] px-5 py-5 sm:px-6">
          <p className="mx-auto max-w-5xl text-xs leading-relaxed text-neutral-600">
            Shared by Divine Acquisition. Read-only, time limited, revocable, and every view is logged.
          </p>
        </footer>
      </div>
    </div>
  );
}
