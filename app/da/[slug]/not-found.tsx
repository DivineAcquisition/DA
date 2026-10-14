import Link from 'next/link';
import { btnSecondary, btnSizeSm } from '@/app/components/ui';

export default function EngagementNotFound() {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-300">Growth</p>
      <h1 className="mt-3 text-2xl font-semibold text-white">That engagement is not on file</h1>
      <p className="mt-3 text-sm leading-relaxed text-neutral-400">
        The case file may have been removed, or the address is wrong.
      </p>
      <Link href="/da" className={`${btnSecondary} ${btnSizeSm} mt-6`}>
        All engagements
      </Link>
    </div>
  );
}
