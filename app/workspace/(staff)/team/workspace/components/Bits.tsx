'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { CERT_LABEL, CERT_TONE, EOD_LABEL, EOD_TONE, PACE_LABEL, PACE_TONE, SHIFT_LABEL, formatWhen, viewerTimeZone, type CertStatus, type EodStatus, type Pace, type ShiftStatus } from '@/lib/sales-workspace/team';

export function Pill({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${className}`}>{children}</span>;
}

export function EodPill({ status, wasLate }: { status: EodStatus | null; wasLate?: boolean }) {
  if (!status) return <span className="text-neutral-500">—</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Pill className={EOD_TONE[status]}>{EOD_LABEL[status]}</Pill>
      {wasLate && status === 'submitted' ? <Pill className={EOD_TONE.late}>Late</Pill> : null}
    </span>
  );
}

export function ShiftPill({ status }: { status: ShiftStatus | null }) {
  if (!status) return <span className="text-neutral-500">—</span>;
  const tone =
    status === 'on_shift'
      ? 'border-flag-good/35 bg-flag-good/12 text-flag-good'
      : status === 'off_shift'
        ? 'border-white/10 bg-white/[0.04] text-neutral-300'
        : 'border-white/10 text-neutral-500';
  return <Pill className={tone}>{SHIFT_LABEL[status]}</Pill>;
}

export function CertPill({ status }: { status: CertStatus }) {
  return <Pill className={CERT_TONE[status]}>{CERT_LABEL[status]}</Pill>;
}

export function PacePill({ pace }: { pace: Pace | null | undefined }) {
  if (!pace) return <span className="text-neutral-500">—</span>;
  return <Pill className={PACE_TONE[pace]}>{PACE_LABEL[pace]}</Pill>;
}

function useViewerZone(): string {
  return useSyncExternalStore(
    () => () => {},
    () => viewerTimeZone(),
    () => 'UTC',
  );
}

/** Viewer time, with the operator's local time under it when a zone is known. */
export function When({ iso, operatorZone }: { iso: string | null; operatorZone?: string | null }) {
  const viewer = useViewerZone();
  if (!iso) return <>—</>;
  return (
    <span>
      <span>{formatWhen(iso, viewer)}</span>
      {operatorZone ? <span className="mt-0.5 block text-[11px] text-neutral-500">{formatWhen(iso, operatorZone)} local</span> : null}
    </span>
  );
}

/** Puts the viewer's time zone on a filter form so date ranges match the clock they see. */
export function ZoneInput({ current }: { current?: string }) {
  const detected = useViewerZone();
  return <input type="hidden" name="zone" value={current || detected} />;
}

export function RefreshNote({ minutes, at }: { minutes: number; at: string }) {
  const router = useRouter();
  const zone = useViewerZone();
  useEffect(() => {
    const id = window.setInterval(() => router.refresh(), Math.max(1, minutes) * 60_000);
    return () => window.clearInterval(id);
  }, [minutes, router]);
  return (
    <p className="text-xs text-neutral-500">
      Updated {formatWhen(at, zone)}. Refreshes every {minutes} min.
    </p>
  );
}
