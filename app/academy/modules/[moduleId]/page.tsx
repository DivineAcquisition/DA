import Link from 'next/link';
import { moduleStatusLabel } from '@/lib/academy/paths';
import { loadAcademyShell } from '@/lib/academy/load';
import { academyContentOpen } from '@/lib/academy/types';

export default async function AcademyModulePage({ params }: { params: Promise<{ moduleId: string }> }) {
  const { moduleId } = await params;
  const loaded = await loadAcademyShell();
  if (!loaded.ok || !academyContentOpen(loaded.shell.state)) return null;
  const current = loaded.shell.modules.find((item) => item.id === moduleId);

  if (!current) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <h1 className="text-2xl font-semibold">This module is not in your program.</h1>
        <Link href="/academy/modules" className="mt-6 inline-flex min-h-11 items-center text-sm text-[#937DFF]">
          Back to modules
        </Link>
      </section>
    );
  }

  const label = moduleStatusLabel(current.display);
  const detail =
    current.display === 'unpublished'
      ? 'This module has no lessons yet.'
      : current.display === 'locked'
        ? 'Finish the previous module before this one opens.'
        : 'The lesson player is not in this release.';

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#937DFF]">{label}</p>
      <h1 className="mt-2 text-2xl font-semibold">
        {current.order}. {current.title}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-neutral-300">{detail}</p>
      <Link href="/academy/modules" className="mt-6 inline-flex min-h-11 items-center text-sm text-[#937DFF]">
        Back to modules
      </Link>
    </section>
  );
}
