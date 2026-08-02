import { btnPrimary, btnSizeLg } from '@/app/components/ui';

function ArrowIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m0 0-5.5-5.5M19 12l-5.5 5.5" />
    </svg>
  );
}

/**
 * Sole CTA. `href` is built on the server from the request query string so
 * ad tracking params (utm_*, fbclid, gclid, …) ride into the booking URL.
 */
export default function BookCallButton({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${btnPrimary} ${btnSizeLg} w-full uppercase tracking-[0.08em] sm:w-auto`}
    >
      Book a call
      <ArrowIcon />
    </a>
  );
}
