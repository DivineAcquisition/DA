'use client';

import { useEffect, useState } from 'react';
import { btnPrimary, btnSizeSm } from '@/app/components/ui';
import { savePlaybookAction, staffPlaybookAction } from '@/lib/portal/staffActions';
import { formatDate } from '@/lib/portal/time';
import { inputClass, labelClass, selectClass } from '../../components/ui';
import { Feedback, Sheet, useAction } from './portal';

type Row = Record<string, unknown> & { assets?: { asset_id: string }[]; version?: number; updated_by_name?: string | null; updated_at?: string };

type Loaded = {
  placement_id: string;
  client_name: string;
  operator_name: string;
  can_edit_client: boolean;
  client: Row | null;
  override: Row | null;
  versions: { id: string; scope: string; version: number; saved_at: string; saved_by: string | null; change_note: string | null; major: boolean }[];
  library: { id: string; title: string; audience: string }[];
};

const FIELDS: { key: string; label: string; help: string; rows: number }[] = [
  { key: 'business_name', label: 'Business name to answer as', help: 'Exactly how the VA names the business.', rows: 1 },
  { key: 'offer', label: 'What they offer', help: 'Services, treatments, packages.', rows: 3 },
  { key: 'locations', label: 'Locations', help: '', rows: 2 },
  { key: 'hours', label: 'Hours', help: '', rows: 2 },
  { key: 'qualifies', label: 'Who qualifies', help: 'What makes a Confirmed Booking under the Placement Order.', rows: 3 },
  { key: 'disqualifiers', label: 'Disqualifiers', help: 'Who is not booked.', rows: 3 },
  { key: 'handoff_steps', label: 'Handoff steps', help: 'Exact steps to book or transfer.', rows: 3 },
  { key: 'escalation_contacts', label: 'Escalation contacts', help: 'Who handles what, and how fast they answer.', rows: 3 },
  { key: 'never_say', label: 'Never say or do', help: 'Prohibited topics, claims and promises.', rows: 4 },
  { key: 'approved_pricing', label: 'Approved pricing and offers', help: 'Only what the VA may quote.', rows: 3 },
];

/**
 * Edits the client playbook (inherited by every VA placed with that client) or
 * this placement's override (anything specific to one VA's shift). Every save
 * is a new version with a note, and every VA working it is told.
 */
export default function PlaybookEditor({ placementId, onClose }: { placementId: string; onClose: () => void }) {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<'client' | 'placement'>('client');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [assets, setAssets] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [major, setMajor] = useState(false);
  const action = useAction();

  const fill = (loaded: Loaded, which: 'client' | 'placement') => {
    const row = which === 'client' ? loaded.client : loaded.override;
    const next: Record<string, string> = {};
    for (const field of FIELDS) next[field.key] = String(row?.[field.key] ?? '');
    next.handoff_method = String(row?.handoff_method ?? '');
    next.holding_lines = ((row?.holding_lines as string[] | null) ?? []).join('\n');
    setScope(which);
    setFields(next);
    setAssets((row?.assets ?? []).map((a) => a.asset_id));
  };

  useEffect(() => {
    let live = true;
    staffPlaybookAction(placementId).then((result) => {
      if (!live) return;
      if (!result.ok) return setError(result.error);
      const loaded = result.data as Loaded;
      setData(loaded);
      fill(loaded, loaded.can_edit_client ? 'client' : 'placement');
    });
    return () => {
      live = false;
    };
  }, [placementId]);

  const save = () =>
    action.run(
      () =>
        savePlaybookAction({
          placementId,
          scope,
          fields: {
            ...fields,
            holding_lines: fields.holding_lines
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean),
          },
          assetIds: assets,
          changeNote: note,
          major,
        }),
      async (result) => {
        if (!result.ok) return;
        setNote('');
        setMajor(false);
        const reloaded = await staffPlaybookAction(placementId);
        if (reloaded.ok) setData(reloaded.data as Loaded);
      },
    );

  return (
    <Sheet open onClose={onClose} title={data ? `Playbook: ${data.client_name}` : 'Playbook'} wide>
      {error ? <Feedback error={error} /> : null}
      {!data && !error ? <p className="text-sm text-neutral-500">Loading…</p> : null}
      {data ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!data.can_edit_client}
              onClick={() => fill(data, 'client')}
              className={`rounded-full px-3 py-1.5 text-xs ${scope === 'client' ? 'bg-brand-500 text-ink-950' : 'bg-white/[0.05] text-neutral-300'} disabled:opacity-40`}
            >
              Client playbook (every VA on {data.client_name})
            </button>
            <button
              type="button"
              onClick={() => fill(data, 'placement')}
              className={`rounded-full px-3 py-1.5 text-xs ${scope === 'placement' ? 'bg-brand-500 text-ink-950' : 'bg-white/[0.05] text-neutral-300'}`}
            >
              Override for {data.operator_name}
            </button>
          </div>
          <p className="text-xs text-neutral-500">
            {scope === 'placement'
              ? 'Only fill in what differs for this shift. Empty fields fall back to the client playbook.'
              : 'Everything a VA needs to represent this client. A placement override can change any field for one VA.'}
          </p>

          {FIELDS.map((field) => (
            <label key={field.key} className="block">
              <span className={labelClass}>{field.label}</span>
              {field.rows === 1 ? (
                <input
                  value={fields[field.key] ?? ''}
                  onChange={(e) => setFields({ ...fields, [field.key]: e.target.value })}
                  className={inputClass}
                />
              ) : (
                <textarea
                  value={fields[field.key] ?? ''}
                  onChange={(e) => setFields({ ...fields, [field.key]: e.target.value })}
                  rows={field.rows}
                  className={inputClass}
                />
              )}
              {field.help ? <span className="mt-1 block text-[11px] text-neutral-500">{field.help}</span> : null}
            </label>
          ))}

          <label className="block">
            <span className={labelClass}>Handoff method</span>
            <select value={fields.handoff_method ?? ''} onChange={(e) => setFields({ ...fields, handoff_method: e.target.value })} className={selectClass}>
              <option value="">{scope === 'placement' ? 'Same as the client playbook' : 'Not set'}</option>
              <option value="calendar">Book on the client&apos;s calendar</option>
              <option value="live_transfer">Live transfer to the front desk</option>
            </select>
          </label>

          <label className="block">
            <span className={labelClass}>Holding lines (one per line)</span>
            <textarea
              value={fields.holding_lines ?? ''}
              onChange={(e) => setFields({ ...fields, holding_lines: e.target.value })}
              rows={3}
              className={inputClass}
              placeholder="Let me confirm that with the team and get right back to you."
            />
          </label>

          <div>
            <span className={labelClass}>Scripts and templates from the library</span>
            <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-white/[0.06] p-2">
              {data.library.length === 0 ? <p className="text-xs text-neutral-500">The asset library is empty.</p> : null}
              {data.library.map((asset) => (
                <label key={asset.id} className="flex items-center gap-2 text-sm text-neutral-300">
                  <input
                    type="checkbox"
                    checked={assets.includes(asset.id)}
                    onChange={(e) => setAssets(e.target.checked ? [...assets, asset.id] : assets.filter((id) => id !== asset.id))}
                  />
                  {asset.title}
                </label>
              ))}
            </div>
          </div>

          <label className="block">
            <span className={labelClass}>What changed</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} placeholder="Added the new laser package pricing" />
          </label>
          <label className="flex items-center gap-2 text-sm text-neutral-300">
            <input type="checkbox" checked={major} onChange={(e) => setMajor(e.target.checked)} />
            Major change: every VA on it must read and confirm before working
          </label>
          <button type="button" disabled={action.pending || note.trim().length < 3} onClick={save} className={`${btnPrimary} ${btnSizeSm}`}>
            Save a new version
          </button>
          <Feedback message={action.message} error={action.error} />

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400">Version history</h3>
            <ul className="space-y-1.5 text-sm">
              {data.versions.length === 0 ? <li className="text-neutral-500">No versions yet.</li> : null}
              {data.versions.map((v) => (
                <li key={v.id} className="rounded-xl bg-white/[0.03] px-3 py-2">
                  <span className="text-neutral-200">
                    {v.scope === 'client' ? 'Client' : 'Override'} v{v.version}
                    {v.major ? ' · major' : ''}
                  </span>
                  <span className="text-neutral-500">
                    {' '}
                    · {formatDate(v.saved_at.slice(0, 10), true)} by {v.saved_by ?? 'someone'}
                  </span>
                  {v.change_note ? <p className="text-xs text-neutral-400">{v.change_note}</p> : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </Sheet>
  );
}
