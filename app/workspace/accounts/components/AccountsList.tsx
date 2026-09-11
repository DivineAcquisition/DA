'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { createWorkspaceAccountAction } from '@/lib/workspace/workspace-actions';
import { formatDate } from '@/lib/workspace/format';
import { nicheFamily, nicheLabel, type NicheFamily, type WorkspaceNiche } from '@/lib/workspace/niches';
import {
  PRACTICE_STAGES,
  formatCurrency,
  practiceStageLabel,
  type PracticeStage,
} from '@/lib/workspace/practices';
import { matchesWorkspaceSearch, type WorkspaceAccountListRow } from '@/lib/workspace/workspace-list-types';
import NicheSelect from '../../components/NicheSelect';
import { Button, DataTable, Dialog, EmptyState, Field, Input, PageHeader } from '../../components/ui';
import { StageBadge } from '../../practices/components/badges';

const FAMILY_FILTERS: { id: NicheFamily | 'all'; label: string }[] = [
  { id: 'all', label: 'All niches' },
  { id: 'practice', label: 'Practices' },
  { id: 'home_services', label: 'Home services' },
];

export default function AccountsList({ accounts }: { accounts: WorkspaceAccountListRow[] }) {
  const [query, setQuery] = useState('');
  const [stages, setStages] = useState<PracticeStage[]>([]);
  const [family, setFamily] = useState<NicheFamily | 'all'>('all');
  const [open, setOpen] = useState(false);

  const visible = useMemo(() => {
    return accounts.filter((row) => {
      if (!matchesWorkspaceSearch(row, query)) return false;
      if (stages.length > 0 && !stages.includes(row.stage)) return false;
      if (family !== 'all' && nicheFamily(row.niche) !== family) return false;
      return true;
    });
  }, [accounts, query, stages, family]);

  function toggleStage(stage: PracticeStage) {
    setStages((current) =>
      current.includes(stage) ? current.filter((item) => item !== stage) : [...current, stage],
    );
  }

  return (
    <div>
      <PageHeader
        title="Accounts"
        description="Audit, debrief, and kickoff requirements. The form set follows the niche you pick."
        actions={
          <Button type="button" onClick={() => setOpen(true)} style={{ backgroundColor: '#6A00FF', color: '#fff' }}>
            New account
          </Button>
        }
      />

      <div className="mb-5 flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <label className="block flex-1 sm:max-w-sm">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6E6C80]">
              Search
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Account, contact, or niche"
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-brand-500/60"
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
        <div className="flex flex-wrap gap-1.5">
          {FAMILY_FILTERS.map((item) => {
            const active = family === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setFamily(item.id)}
                className="rounded-full border px-3 py-1 text-[12px] font-semibold transition"
                style={{
                  color: active ? '#937DFF' : '#6E6C80',
                  borderColor: active ? '#937DFF88' : 'rgba(255,255,255,0.1)',
                  backgroundColor: active ? '#937DFF22' : 'transparent',
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={accounts.length === 0 ? 'No accounts yet' : 'No matching accounts'}
          description={
            accounts.length === 0
              ? 'Create an account and pick a niche. Practice and home-services audits stay on their own forms.'
              : 'Clear the filters or search to see more records.'
          }
        />
      ) : (
        <DataTable headers={['Account', 'Niche', 'Contact', 'Stage', 'Revenue', 'Created']}>
          {visible.map((row) => (
            <tr key={`${row.family}:${row.id}`} className="hover:bg-white/[0.02]">
              <td className="px-4 py-3">
                <Link href={row.href} className="font-medium text-white hover:text-[#937DFF]">
                  {row.name}
                </Link>
              </td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center rounded-full border border-brand-500/25 bg-brand-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-brand-300">
                  {nicheLabel(row.niche)}
                </span>
              </td>
              <td className="px-4 py-3 text-[#B0AEC0]">{row.contact_name}</td>
              <td className="px-4 py-3">
                <StageBadge stage={row.stage} />
              </td>
              <td className="px-4 py-3 tabular-nums text-white">{formatCurrency(row.revenue)}</td>
              <td className="px-4 py-3 text-[#6E6C80]">{formatDate(row.created_at)}</td>
            </tr>
          ))}
        </DataTable>
      )}

      <NewAccountDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function NewAccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [niche, setNiche] = useState<WorkspaceNiche | ''>('');
  const family = niche ? nicheFamily(niche) : null;

  return (
    <Dialog
      open={open}
      onClose={() => {
        onClose();
        setNiche('');
        setError(null);
      }}
      title="New account"
    >
      <form
        className="space-y-4"
        action={(formData) => {
          setError(null);
          startTransition(async () => {
            const result = await createWorkspaceAccountAction(formData);
            if (result && !result.ok) setError(result.error);
          });
        }}
      >
        <NicheSelect value={niche} onChange={setNiche} />
        {family ? (
          <>
            <Field label={family === 'practice' ? 'Practice name' : 'Company name'}>
              <Input name="account_name" required autoComplete="organization" />
            </Field>
            <Field label="Contact name">
              <Input name="contact_name" required autoComplete="name" />
            </Field>
          </>
        ) : (
          <p className="text-sm text-[#B0AEC0]">
            Pick a niche. Dental and med spa open the practice audit. Home-services trades open the
            operations audit.
          </p>
        )}
        {error && <p className="text-sm text-[#FF6A6A]">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={pending || !family}
            style={{ backgroundColor: '#6A00FF', color: '#fff' }}
          >
            {pending ? 'Creating…' : 'Create account'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
