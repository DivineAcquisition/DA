import Logo from '@/app/components/Logo';
import Backdrop from '@/app/components/Backdrop';
import { NEUTRAL_UNAVAILABLE_MESSAGE } from '@/lib/workspace/tokens';
import { loadOnboardingPage } from '@/lib/workspace/onboarding';
import OnboardingForm from './OnboardingForm';

export const dynamic = 'force-dynamic';

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

export default async function PublicOnboardingTokenRoute({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const page = await loadOnboardingPage(token);
  if (!page) return <Unavailable />;

  return (
    <div className="da-workspace relative min-h-screen">
      <Backdrop />
      <div className="relative z-10 px-4 py-8 sm:px-6 sm:py-12">
        <header className="mx-auto mb-8 flex max-w-3xl items-center justify-between gap-4">
          <Logo className="h-7 w-auto sm:h-8" />
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ws-dim)]">
            Onboarding
          </span>
        </header>
        <OnboardingForm
          token={page.token}
          protocol={page.protocol}
          recipientName={page.recipientName}
          recipientEmail={page.recipientEmail}
          recipientPhone={page.recipientPhone}
          agreementSigned={page.agreementSigned}
          agreementTemplateName={page.agreementTemplateName}
          completed={page.completed}
          initialAnswers={page.answers}
        />
      </div>
    </div>
  );
}
