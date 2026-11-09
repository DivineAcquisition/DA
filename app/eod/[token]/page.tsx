import type { Metadata } from 'next';
import Logo from '@/app/components/Logo';
import EodForm, { type EodFormData } from '@/app/workspace/(portal)/operator/workspace/eod/EodForm';
import { interDisplay } from '@/app/workspace/(staff)/components/fonts';
import '@/app/workspace/(portal)/operator/workspace/eod/eod.css';
import { controlRpc, readable } from '@/lib/ad/rpc';
import { eodToken } from '@/lib/sales-workspace/eod-link';
import { createClient, supabaseConfigured } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { absolute: 'End of day · Divine Acquisition' },
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: 'no-referrer',
};

/** The Vistrial app frame: solid ink, a lavender glow at the top, a quiet header. */
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${interDisplay.variable} da-eod min-h-screen bg-[#0b0a11] text-white antialiased`}>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-80 bg-[radial-gradient(55%_100%_at_50%_0%,rgba(154,136,252,0.2),transparent)]"
      />
      <header className="sticky top-0 z-30 border-b border-[rgba(154,136,252,0.14)] bg-[#0b0a11]">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4">
          <span className="flex items-center gap-2.5">
            <Logo markOnly className="h-5 w-auto" />
            <span className="eod-title text-[15px]">End of day</span>
          </span>
          <span className="text-[12px] text-[var(--eod-dim)]">Private link · no sign-in</span>
        </div>
      </header>
      <main className="relative z-10 mx-auto max-w-3xl px-4 py-8 sm:py-10">{children}</main>
    </div>
  );
}

function Unavailable({ title, body }: { title: string; body: string }) {
  return (
    <section className="eod-card eod-card-glow p-6">
      <p className="eod-label">End of day</p>
      <h1 className="eod-title mt-2 text-2xl">{title}</h1>
      <p className="mt-3 text-[15px] text-[var(--eod-muted)]">{body}</p>
    </section>
  );
}

export default async function PublicEodPage({ params }: { params: Promise<{ token: string }> }) {
  const token = eodToken((await params).token);
  if (!token) {
    return (
      <Frame>
        <Unavailable
          title="This link is not valid."
          body="Ask Divine Acquisition for a new end-of-day link. This page does not use a sign-in."
        />
      </Frame>
    );
  }
  if (!supabaseConfigured) {
    return (
      <Frame>
        <Unavailable title="The report could not open." body="The workspace is not connected." />
      </Frame>
    );
  }

  const supabase = await createClient();
  const { data, error } = await controlRpc<EodFormData>(supabase, 'so_eod_open', { p_token: token });
  if (error || !data) {
    return (
      <Frame>
        <Unavailable
          title="This link is not valid."
          body={error ? readable(error) : 'Nothing came back. Ask Divine Acquisition for a new link.'}
        />
      </Frame>
    );
  }

  return (
    <Frame>
      <EodForm data={data} token={token} />
    </Frame>
  );
}
