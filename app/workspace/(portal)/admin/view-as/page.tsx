'use client';

import { useEffect, useMemo, useState } from 'react';
import { viewAsSessionsAction } from '@/lib/portal/staffActions';
import { AdminOnly } from '../../components/AppShell';
import { PageHeader, inputClass, labelClass, selectClass } from '../../components/ui';
import { SessionList, type SessionRow } from '../../components/ViewAs';

/** Every View As session across every operator. Owners only; the database refuses anyone else. */
export default function ViewAsLogPage() {
  return (
    <AdminOnly>
      <ViewAsLog />
    </AdminOnly>
  );
}

function ViewAsLog() {
  const [rows, setRows] = useState<SessionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actor, setActor] = useState('');
  const [target, setTarget] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    void (async () => {
      const result = await viewAsSessionsAction({ from: from || null, to: to || null });
      if (result.ok) {
        setRows((result.data ?? []) as SessionRow[]);
        setError(null);
      } else setError(result.error);
    })();
  }, [from, to]);

  const actors = useMemo(() => [...new Map((rows ?? []).map((r) => [r.actor_profile_id, r.actor_name])).entries()], [rows]);
  const targets = useMemo(() => [...new Set((rows ?? []).map((r) => r.target_name))], [rows]);
  const shown = (rows ?? []).filter((r) => (!actor || r.actor_profile_id === actor) && (!target || r.target_name === target));

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Audit" title="View As log" description="Every View As session: who viewed which operator, when, for how long, and why." />
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="block">
          <span className={labelClass}>Viewer</span>
          <select value={actor} onChange={(e) => setActor(e.target.value)} className={selectClass}>
            <option value="">Everyone</option>
            {actors.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>Operator</span>
          <select value={target} onChange={(e) => setTarget(e.target.value)} className={selectClass}>
            <option value="">Every operator</option>
            {targets.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className={labelClass}>To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} />
        </label>
      </div>
      {error ? <p className="text-sm text-flag-critical">{error}</p> : null}
      {rows ? <SessionList rows={shown} showTarget /> : error ? null : <p className="text-sm text-neutral-500">Loading…</p>}
    </div>
  );
}
