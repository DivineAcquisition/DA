import type { Metadata } from 'next';
import Logo from '@/app/components/Logo';
import EodForm, { type EodFormData } from '@/app/workspace/(portal)/operator/workspace/eod/EodForm';
import { jakarta } from '@/app/workspace/(portal)/operator/workspace/fonts';
import { brand } from '@/app/workspace/(portal)/operator/workspace/WorkspaceFrame';
import { controlRpc, readable } from '@/lib/ad/rpc';
import { eodToken } from '@/lib/sales-workspace/eod-link';
import { createClient, supabaseConfigured } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { absolute: 'End of day · Divine Acquisition' },
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: 'no-referrer',
};

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${jakarta.variable} min-h-screen bg-ink-950 font-sans text-white antialiased`}>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-72 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(106,0,255,0.22),transparent)]"
      />
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-ink-950/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2.5 px-4">
          <Logo markOnly className="h-5 w-auto" />
          <span className={`${brand.heading} text-[15px]`}>End of day</span>
        </div>
      </header>
      <main className="relative mx-auto max-w-3xl px-4 py-8 sm:py-10">{children}</main>
    </div>
  );
}

function Unavailable({ title, body }: { title: string; body: string }) {
  return (
    <section className={brand.panel}>
      <p className={brand.eyebrow}>End of day</p>
      <h1 className={`${brand.heading} mt-2 text-2xl`}>{title}</h1>
      <p className="mt-3 text-sm text-neutral-300">{body}</p>
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
      <div className="space-y-4">
        <p className="text-sm text-neutral-400">No sign-in. This link opens only this report.</p>
        <EodForm data={data} token={token} />
      </div>
    </Frame>
  );
}
