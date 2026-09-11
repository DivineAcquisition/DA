'use client';

import { useEffect, useState, useTransition, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { deletePracticeAction, updatePracticeStageAction } from '@/lib/workspace/practice-actions';
import {
  auditFormDot,
  debriefFormDot,
  formDotColor,
  PRACTICE_STAGES,
  practiceStageLabel,
  remainingLabel,
  requirementsFormDot,
  type AuditRecord,
  type DebriefRecord,
  type PracticeRecord,
  type PracticeStage,
  type RequirementsRecord,
} from '@/lib/workspace/practices';
import { Button, Dialog, Select } from '../../components/ui';
import { StageBadge, TypeBadge } from './badges';

function headingClass(extra = '') {
  return `font-[family-name:var(--font-plus-jakarta)] tracking-tight text-white ${extra}`;
}

function DueCountdown({ dueAt }: { dueAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const { text, overdue } = remainingLabel(dueAt, now);
  return (
    <span className="text-[12px] font-semibold" style={{ color: overdue ? '#FF6A6A' : '#FFD06A' }}>
      {text}
    </span>
  );
}

export default function PracticeShell({
  practice,
  audit,
  debrief,
  requirements,
  children,
}: {
  practice: PracticeRecord;
  audit: AuditRecord | null;
  debrief: DebriefRecord | null;
  requirements: RequirementsRecord | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [typedName, setTypedName] = useState('');
  const [, startTransition] = useTransition();

  const tabs = [
    { href: `/workspace/practices/${practice.id}/audit`, label: 'Audit', dot: auditFormDot(audit) },
    { href: `/workspace/practices/${practice.id}/debrief`, label: 'Debrief', dot: debriefFormDot(debrief) },
    {
      href: `/workspace/practices/${practice.id}/requirements`,
      label: 'Requirements',
      dot: requirementsFormDot(requirements),
    },
  ];

  return (
    <div className="animate-rise">
      <header className="mb-6 rounded-2xl border border-white/10 bg-[#1C1C26] p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className={headingClass('text-2xl font-semibold sm:text-[28px]')}>{practice.practice_name}</h1>
              <TypeBadge type={practice.practice_type} />
              <StageBadge stage={practice.stage} />
            </div>
            <p className="mt-2 text-sm text-[#B0AEC0]">{practice.contact_name}</p>
            {practice.call_id && (
              <Link
                href={`/workspace/calls/${practice.call_id}`}
                className="mt-2 inline-block text-sm font-medium text-[#937DFF] hover:underline"
              >
                View 15-min call
              </Link>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-[#6E6C80]">
              <span>Stage</span>
              <Select
                value={practice.stage}
                onChange={(e) => {
                  const next = e.target.value as PracticeStage;
                  startTransition(async () => {
                    const result = await updatePracticeStageAction(practice.id, next);
                    if (!result.ok) setError(result.error);
                    else {
                      setError(null);
                      router.refresh();
                    }
                  });
                }}
                className="w-auto min-w-44"
              >
                {PRACTICE_STAGES.map((value) => (
                  <option key={value} value={value}>
                    {practiceStageLabel(value)}
                  </option>
                ))}
              </Select>
            </label>
            <Button type="button" variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
              Delete
            </Button>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-[#FF6A6A]">{error}</p>}
      </header>

      <div className="mb-6 flex flex-wrap gap-1 border-b border-white/10">
        {tabs.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition"
              style={{
                borderColor: active ? '#937DFF' : 'transparent',
                color: active ? '#937DFF' : '#6E6C80',
              }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: formDotColor(tab.dot) }}
                aria-hidden
              />
              {tab.label}
              {tab.label === 'Requirements' && requirements?.due_at && (
                <DueCountdown dueAt={requirements.due_at} />
              )}
            </Link>
          );
        })}
      </div>

      {children}

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete practice">
        <p className="text-sm text-[#B0AEC0]">
          This deletes the audit, debrief, and requirements. Type <span className="text-white">{practice.practice_name}</span> to
          confirm.
        </p>
        <input
          value={typedName}
          onChange={(e) => setTypedName(e.target.value)}
          className="mt-4 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white outline-none focus:border-brand-500/60"
        />
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setDeleteOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={typedName !== practice.practice_name}
            onClick={() => {
              startTransition(async () => {
                const result = await deletePracticeAction(practice.id, typedName);
                if (result && !result.ok) setError(result.error);
              });
            }}
          >
            Delete
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
