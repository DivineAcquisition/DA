import Logo from '@/app/components/Logo';
import { EMAIL_FOOTER } from '@/lib/booking-messages/copy';
import { LEGAL_PRIVACY_URL, LEGAL_TERMS_URL } from '@/lib/acq/copy';
import { REVENUE_LEAK } from '@/lib/acq/revenue-leak-content';

export function LeakFooter({ sources = false }: { sources?: boolean }) {
  return (
    <footer className="border-t border-white/10 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-5xl text-sm text-neutral-400">
        <Logo className="h-5 w-auto" title={REVENUE_LEAK.brand} />
        <p className="mt-4">{EMAIL_FOOTER}</p>
        <p className="mt-2">
          Legal contact:{' '}
          <a className="text-brand-200 underline-offset-2 hover:underline" href={`mailto:${REVENUE_LEAK.legalEmail}`}>
            {REVENUE_LEAK.legalEmail}
          </a>
        </p>
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
          <a className="text-brand-200 underline-offset-2 hover:underline" href={LEGAL_PRIVACY_URL}>
            Privacy Policy
          </a>
          <a className="text-brand-200 underline-offset-2 hover:underline" href={LEGAL_TERMS_URL}>
            Terms
          </a>
        </p>
        {sources ? (
          <ul id="sources" className="mt-8 space-y-1 text-xs leading-relaxed text-neutral-500">
            {REVENUE_LEAK.sources.map((source) => (
              <li key={source}>{source}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </footer>
  );
}
