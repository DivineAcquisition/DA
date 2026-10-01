'use client';

import Link from 'next/link';
import { useState } from 'react';
import { btnPrimary, btnSecondary, btnSizeSm } from '@/app/components/ui';
import { addConnectionAction, checkNowAction, removeConnectionAction, rotateConnectionAction } from '@/lib/ghl/actions';
import type { Connection, Overview } from '@/lib/ghl/types';
import { inputClass, labelClass } from '../../components/ui';
import { Feedback, useAction } from '../../operator/components/portal';
import { Empty, HealthPill, Panel, Pill, StepUpField, when } from './ui';

/** Token age, scopes, health and rotation for one connection. */
export function ConnectionSummary({ connection, required }: { connection: Connection; required: string[] }) {
  const [now] = useState(() => Date.now());
  const daysLeft = Math.ceil((new Date(connection.rotation_due_on).getTime() - now) / 86_400_000);
  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <HealthPill status={connection.status} />
        <span className="text-neutral-300">{connection.label}</span>
        <span className="font-mono text-xs text-neutral-500">token ••••{connection.last4}</span>
        {connection.candidate ? <Pill tone="warn">Rotation being tested (••••{connection.candidate.last4})</Pill> : null}
      </div>
      <dl className="grid gap-x-4 gap-y-1 text-xs text-neutral-400 sm:grid-cols-2">
        <div>Last successful call: <span className="text-neutral-200">{when(connection.last_success_at)}</span></div>
        <div>Last checked: <span className="text-neutral-200">{when(connection.last_checked_at)}</span></div>
        <div>Token created: <span className="text-neutral-200">{connection.token_created_on}</span></div>
        <div>
          Rotate by: <span className={daysLeft <= 14 ? 'text-amber-300' : 'text-neutral-200'}>{connection.rotation_due_on}</span>
          {daysLeft <= 14 ? ` (${daysLeft < 0 ? 'overdue' : `${daysLeft} days`})` : ''}
        </div>
      </dl>
      {connection.scopes_missing.length ? (
        <p className="text-xs text-amber-300">Missing scopes: {connection.scopes_missing.join(', ')}</p>
      ) : connection.last_success_at ? (
        <p className="text-xs text-neutral-500">All {required.length} required scopes present.</p>
      ) : null}
      {connection.last_error ? <p className="text-xs text-flag-critical">Last error: {connection.last_error}</p> : null}
      {connection.paused_reason ? <p className="text-xs text-flag-critical">Paused: {connection.paused_reason}</p> : null}
    </div>
  );
}

/** Rotate or remove. The new token is tested before the old one is retired. */
export function ConnectionControls({ connection, caseFileId }: { connection: Connection; caseFileId: string | null }) {
  const [mode, setMode] = useState<'none' | 'rotate' | 'remove'>('none');
  const [token, setToken] = useState('');
  const [reason, setReason] = useState('');
  const [password, setPassword] = useState('');
  const { run, pending, message, error } = useAction();
  const done = () => {
    setToken('');
    setPassword('');
  };
  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={() => run(() => checkNowAction(caseFileId))} className={`${btnSecondary} ${btnSizeSm}`}>
          Check now
        </button>
        <button type="button" onClick={() => setMode(mode === 'rotate' ? 'none' : 'rotate')} className={`${btnSecondary} ${btnSizeSm}`}>
          Rotate token
        </button>
        <button type="button" onClick={() => setMode(mode === 'remove' ? 'none' : 'remove')} className={`${btnSecondary} ${btnSizeSm}`}>
          Remove
        </button>
      </div>
      {mode === 'rotate' ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>New Private Integration Token</span>
            <input type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} className={inputClass} />
          </label>
          <StepUpField value={password} onChange={setPassword} />
          <button
            type="button"
            disabled={pending || !token || !password}
            onClick={() =>
              run(
                () =>
                  rotateConnectionAction({
                    connectionId: connection.id,
                    level: connection.level,
                    locationId: connection.location_id,
                    companyId: connection.company_id,
                    caseFileId,
                    token,
                    password,
                  }),
                done,
              )
            }
            className={`${btnPrimary} ${btnSizeSm} sm:col-span-2 sm:justify-self-start`}
          >
            {pending ? 'Testing…' : 'Test and rotate'}
          </button>
        </div>
      ) : null}
      {mode === 'remove' ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Why</span>
            <input value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} />
          </label>
          <StepUpField value={password} onChange={setPassword} />
          <button
            type="button"
            disabled={pending || !reason || !password}
            onClick={() => run(() => removeConnectionAction(connection.id, reason, password), done)}
            className={`${btnSecondary} ${btnSizeSm} border-flag-critical/40 text-flag-critical sm:col-span-2 sm:justify-self-start`}
          >
            Remove connection
          </button>
        </div>
      ) : null}
      <Feedback message={message} error={error} />
    </div>
  );
}

/** Paste a token; it is tested before it is saved and never shown again. */
export function AddConnectionForm({ level, caseFileId }: { level: 'agency' | 'location'; caseFileId?: string }) {
  const [token, setToken] = useState('');
  const [label, setLabel] = useState(level === 'agency' ? 'DA agency' : '');
  const [locationId, setLocationId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [isTest, setIsTest] = useState(false);
  const [password, setPassword] = useState('');
  const { run, pending, message, error } = useAction();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block">
        <span className={labelClass}>Label</span>
        <input value={label} onChange={(e) => setLabel(e.target.value)} className={inputClass} />
      </label>
      {level === 'agency' ? (
        <label className="block">
          <span className={labelClass}>GHL Company ID</span>
          <input value={companyId} onChange={(e) => setCompanyId(e.target.value)} className={inputClass} />
        </label>
      ) : (
        <label className="block">
          <span className={labelClass}>Location ID</span>
          <input value={locationId} onChange={(e) => setLocationId(e.target.value)} className={inputClass} />
        </label>
      )}
      <label className="block sm:col-span-2">
        <span className={labelClass}>Private Integration Token</span>
        <input type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} className={inputClass} />
      </label>
      {level === 'location' ? (
        <label className="flex items-center gap-2 text-sm text-neutral-300 sm:col-span-2">
          <input type="checkbox" checked={isTest} onChange={(e) => setIsTest(e.target.checked)} />
          This is the test sub-account (Novara Cleaning or a sandbox), never a paying client
        </label>
      ) : null}
      <StepUpField value={password} onChange={setPassword} />
      <div className="flex items-end">
        <button
          type="button"
          disabled={pending || !token || !password || !label}
          onClick={() =>
            run(
              () => addConnectionAction({ level, token, label, caseFileId, locationId, companyId, isTest, password }),
              (result) => {
                if (result.ok) {
                  setToken('');
                  setPassword('');
                }
              },
            )
          }
          className={`${btnPrimary} ${btnSizeSm}`}
        >
          {pending ? 'Testing…' : 'Test and save'}
        </button>
      </div>
      <div className="sm:col-span-2">
        <Feedback message={message} error={error} />
      </div>
    </div>
  );
}

export default function ConnectionsView({ overview }: { overview: Overview }) {
  const connected = overview.clients.filter((c) => c.location_id);
  const unconnected = overview.clients.filter((c) => !c.location_id);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-white">GHL connections</h1>

      <Panel title="Agency connection">
        {overview.agency ? (
          <>
            <ConnectionSummary connection={overview.agency} required={overview.required_scopes.agency} />
            {overview.can_manage ? <ConnectionControls connection={overview.agency} caseFileId={null} /> : null}
          </>
        ) : overview.can_manage ? (
          <>
            <p className="mb-3 text-sm text-neutral-400">
              DA&apos;s agency-level Private Integration Token, used only to create, update and deactivate users and to read which sub-accounts exist.
              Needs: {overview.required_scopes.agency.join(', ')}.
            </p>
            <AddConnectionForm level="agency" />
          </>
        ) : (
          <Empty>No agency connection yet.</Empty>
        )}
      </Panel>

      <Panel title={`Client sub-accounts (${connected.length})`}>
        {connected.length === 0 ? (
          <Empty>No client is connected yet. Open a client below to add its sub-account token and Location ID.</Empty>
        ) : (
          <ul className="space-y-2">
            {connected.map((c) => (
              <li key={c.case_file_id}>
                <Link href={`/vistrial/team/ghl/client/${c.case_file_id}`} className="flex flex-wrap items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2.5 text-sm hover:bg-white/[0.06]">
                  <span className="min-w-0 flex-1 truncate text-neutral-100">
                    {c.name} {c.is_test ? <Pill tone="muted">Test</Pill> : null}
                  </span>
                  <HealthPill status={c.connection?.status} />
                  {c.readiness.ready ? <Pill tone="good">Ready</Pill> : <Pill tone="warn">Not ready</Pill>}
                  {c.drift ? <Pill tone="bad">{c.drift} drift</Pill> : null}
                  {c.open_mismatches ? <Pill tone="bad">{c.open_mismatches} access mismatch</Pill> : null}
                  {c.pending_access ? <Pill tone="warn">{c.pending_access} access pending</Pill> : null}
                  {c.connection ? <span className="text-xs text-neutral-500">••••{c.connection.last4} · rotate by {c.connection.rotation_due_on}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {unconnected.length ? (
        <Panel title="Clients without a sub-account">
          <ul className="flex flex-wrap gap-2">
            {unconnected.map((c) => (
              <li key={c.case_file_id}>
                <Link href={`/vistrial/team/ghl/client/${c.case_file_id}`} className={`${btnSecondary} ${btnSizeSm}`}>
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
