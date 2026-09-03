'use client';

import { useMemo, useState, useTransition } from 'react';
import { searchLeadsAction } from '@/lib/calls/actions';
import { inputClass, labelClass } from '@/app/vistrial/components/ui';
import type { LeadRecord } from '@/lib/calls/types';

export default function LeadPicker({
  name = 'leadId',
  initialLead,
}: {
  name?: string;
  initialLead?: LeadRecord | null;
}) {
  const [query, setQuery] = useState('');
  const [leads, setLeads] = useState<LeadRecord[]>(initialLead ? [initialLead] : []);
  const [selectedId, setSelectedId] = useState(initialLead?.recordId ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = useMemo(
    () => leads.find((lead) => lead.recordId === selectedId) ?? initialLead ?? null,
    [leads, selectedId, initialLead],
  );

  if (initialLead) {
    return (
      <div>
        <p className={labelClass}>Lead</p>
        <p className="text-sm text-white">
          {initialLead.fullName}
          {initialLead.companyName ? ` · ${initialLead.companyName}` : ''}
        </p>
        <input type="hidden" name={name} value={initialLead.recordId} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className={labelClass}>Find a lead</span>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, email, company, phone"
            className={inputClass}
          />
          <button
            type="button"
            disabled={pending}
            className="shrink-0 rounded-full border border-white/[0.12] px-4 py-2 text-sm font-semibold text-white hover:bg-white/[0.07]"
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await searchLeadsAction(query);
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setLeads(result.leads);
                if (result.leads.length === 1) setSelectedId(result.leads[0].recordId);
              });
            }}
          >
            {pending ? 'Searching…' : 'Search'}
          </button>
        </div>
      </label>
      {error && <p className="text-sm text-flag-critical">{error}</p>}
      {leads.length > 0 && (
        <label className="block">
          <span className={labelClass}>Lead</span>
          <select
            name={name}
            required
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
            className={inputClass}
          >
            <option value="">Select…</option>
            {leads.map((lead) => (
              <option key={lead.recordId} value={lead.recordId}>
                {lead.fullName || 'Unnamed'}
                {lead.companyName ? ` · ${lead.companyName}` : ''}
              </option>
            ))}
          </select>
        </label>
      )}
      {selected && (
        <p className="text-xs text-neutral-500">
          {selected.qualificationResult || 'Unscored'} · {selected.stage || 'No stage'} ·{' '}
          {selected.nextAction || 'No next action'}
        </p>
      )}
    </div>
  );
}
