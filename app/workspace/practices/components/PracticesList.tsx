'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { createPracticeAction } from '@/lib/workspace/practice-actions';
import { formatDate } from '@/lib/workspace/format';
import { PRACTICE_TYPES, practiceTypeLabel } from '@/lib/workspace/calls';
import {
  formatCurrency,
  matchesPracticeSearch,
  PRACTICE_STAGES,
  practiceStageLabel,
  type PracticeListRow,
  type PracticeStage,
} from '@/lib/workspace/practices';
import { Button, DataTable, Dialog, EmptyState, Field, Input, PageHeader, Select } from '../../components/ui';
import { StageBadge, TypeBadge } from './badges';

export default function PracticesList({ practices }: { practices: PracticeListRow[] }) {
  const [query, setQuery] = useState('');
  const [stages, setStages] = useState<PracticeStage[]>([]);
  const [open, setOpen] = useState(false);

  const visible = useMemo(() => {
    return practices.filter((row) => {
      if (!matchesPracticeSearch(row, query)) return false;
      if (stages.length > 0 && !stages.includes(row.stage)) return false;
      return true;
    });
  }, [practices, query, stages]);

  function toggleStage(stage: PracticeStage) {
    setStages((current) =>
      current.includes(stage) ? current.filter((item) => item !== stage) : [...current, stage],
    );
  }

  return (
    <div>
      <PageHeader
        title="Practices"
        description="Audit, debrief, and kickoff requirements. Newest first."
        actions={
          <Button type="button" onClick={() => setOpen(true)} style={{ backgroundColor: '#6A00FF', color: '#fff' }}>
            New practice
          </Button>
        }
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <label className="block flex-1 sm:max-w-sm">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6E6C80]">
            Search
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Practice or contact"
            className="w-full rounded-xl border border-[#2A2A3A] bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-[#937DFF]/60"
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {PRACTICE_STAGES.map((stage) => {
            const active = stages.includes(stage);
            return (
              <button
                key={stage}
                type="button"
                onClick={() => toggleStage(stage)}
                className="rounded-full border px-3 py-1 text-[12px] font-semibold transition"
                style={{
                  color: active ? '#937DFF' : '#6E6C80',
                  borderColor: active ? '#937DFF88' : '#2A2A3A',
                  backgroundColor: active ? '#937DFF22' : 'transparent',
                }}
              >
                {practiceStageLabel(stage)}
              </button>
            );
          })}
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={practices.length === 0 ? 'No practices yet' : 'No matching practices'}
          description={
            practices.length === 0
              ? 'Create a practice to open the audit, debrief, and requirements forms.'
              : 'Clear the stage pills or search to see more records.'
          }
        />
      ) : (
        <DataTable headers={['Practice', 'Type', 'Contact', 'Stage', 'Dormant revenue', 'Created']}>
          {visible.map((row) => (
            <tr key={row.id} className="hover:bg-white/[0.02]">
              <td className="px-4 py-3">
                <Link
                  href={`/workspace/practices/${row.id}/audit`}
                  className="font-medium text-white hover:text-[#937DFF]"
                >
                  {row.practice_name}
                </Link>
              </td>
              <td className="px-4 py-3">
                <TypeBadge type={row.practice_type} />
              </td>
              <td className="px-4 py-3 text-[#B0AEC0]">{row.contact_name}</td>
              <td className="px-4 py-3">
                <StageBadge stage={row.stage} />
              </td>
              <td className="px-4 py-3 tabular-nums text-white">{formatCurrency(row.dormant_revenue)}</td>
              <td className="px-4 py-3 text-[#6E6C80]">{formatDate(row.created_at)}</td>
            </tr>
          ))}
        </DataTable>
      )}

      <NewPracticeDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function NewPracticeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open={open} onClose={onClose} title="New practice">
      <form
        className="space-y-4"
        action={(formData) => {
          setError(null);
          startTransition(async () => {
            const result = await createPracticeAction(formData);
            if (result && !result.ok) setError(result.error);
          });
        }}
      >
        <Field label="Practice name">
          <Input name="practice_name" required autoComplete="organization" />
        </Field>
        <Field label="Contact name">
          <Input name="contact_name" required autoComplete="name" />
        </Field>
        <Field label="Practice type">
          <Select name="practice_type" required defaultValue="">
            <option value="" disabled>
              Select type
            </option>
            {PRACTICE_TYPES.map((type) => (
              <option key={type} value={type}>
                {practiceTypeLabel(type)}
              </option>
            ))}
          </Select>
        </Field>
        {error && <p className="text-sm text-[#FF6A6A]">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending} style={{ backgroundColor: '#6A00FF', color: '#fff' }}>
            {pending ? 'Creating…' : 'Create practice'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
