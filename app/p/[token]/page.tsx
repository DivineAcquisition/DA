import Logo from '@/app/components/Logo';
import Backdrop from '@/app/components/Backdrop';
import { renderMarkdown, renderTitle } from '@/lib/workspace/markdown';
import { NEUTRAL_UNAVAILABLE_MESSAGE } from '@/lib/workspace/tokens';
import { controlRpc } from '@/lib/ad/rpc';
import { createClient, supabaseConfigured } from '@/lib/supabase/server';
export const dynamic = 'force-dynamic';

type ResolvedPage = {
  title: string;
  body_markdown: string;
  resolved_values: Record<string, string>;
};

function Unavailable() {
  return (
    <div className="da-workspace relative flex min-h-screen items-center justify-center px-5">
      <Backdrop />
      <div className="relative z-10 max-w-md rounded-2xl border border-[var(--ws-border)] bg-[var(--ws-card)] p-8 text-center animate-rise">
        <Logo className="mx-auto h-7 w-auto" />
        <p className="mt-6 text-sm leading-relaxed text-[var(--ws-body)]">{NEUTRAL_UNAVAILABLE_MESSAGE}</p>
      </div>
    </div>
  );
}

export default async function PublicPageTokenRoute({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  if (!supabaseConfigured) return <Unavailable />;

  const supabase = await createClient();
  const { data } = await controlRpc<ResolvedPage>(supabase, 'da_resolve_page_token', {
    p_token: token,
  });

  if (!data?.title || !data.body_markdown) return <Unavailable />;

  const values = (data.resolved_values ?? {}) as Record<string, string>;
  const title = renderTitle(data.title, values);
  const html = renderMarkdown(data.body_markdown, values);

  return (
    <div className="da-workspace relative min-h-screen">
      <Backdrop />
      <div className="relative z-10 mx-auto max-w-3xl px-5 py-12 sm:py-16">
        <header className="mb-10 animate-fade">
          <Logo className="h-8 w-auto" />
        </header>
        <article className="animate-rise rounded-2xl border border-[var(--ws-border)] bg-[var(--ws-card)] p-6 sm:p-10">
          <h1 className="font-[family-name:var(--font-plus-jakarta)] text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {title}
          </h1>
          <div
            className="prose-da mt-8"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </article>
      </div>
    </div>
  );
}
