'use client';

import Link from 'next/link';
import { useState } from 'react';
import { btnPrimary, btnSecondary, btnSizeSm } from '@/app/components/ui';
import { fixMismatchAction, restoreAccessAction, revokeAllAccessAction, setAdminAccessAction } from '@/lib/ghl/actions';
import type { AccessOverview } from '@/lib/ghl/types';
import { inputClass, labelClass } from '../../components/ui';
import { Feedback, useAction } from '../../operator/components/portal';
import { Empty, Panel, Pill, StepUpField, when } from './ui';

type Person = AccessOverview['people'][number];

export default function AccessView({ data }: { data: AccessOverview }) {
  const { run, pending, message, error } = useAction();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-white">GHL access</h1>

      <Panel title={`Mismatches (${data.mismatches.length})`}>
        {data.mismatches.length === 0 ? (
          <Empty>Everyone has exactly the access they should.</Empty>
        ) : (
          <ul className="space-y-2">
            {data.mismatches.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2 text-sm">
                <Pill tone="bad">{m.kind === 'missing' ? 'Missing' : m.kind === 'extra' ? 'Extra' : 'Wrong permissions'}</Pill>
                <Link href={`/vistrial/team/ghl/client/${m.case_file_id}`} className="text-neutral-100 underline-offset-2 hover:underline">
                  {m.client}
                </Link>
                <span className="text-neutral-400">{m.detail}</span>
                {data.can_manage && m.kind !== 'extra' ? (
                  <button type="button" disabled={pending} onClick={() => run(() => fixMismatchAction(m.id, null))} className={`${btnPrimary} ${btnSizeSm}`}>
                    Fix
                  </button>
                ) : null}
                {m.kind === 'extra' ? <span className="text-xs text-neutral-500">Remove or mark from the client&apos;s page (needs your password).</span> : null}
              </li>
            ))}
          </ul>
        )}
        <Feedback message={message} error={error} />
      </Panel>

      <Panel title="People">
        {data.people.length === 0 ? (
          <Empty>Nobody yet.</Empty>
        ) : (
          <ul className="space-y-2">
            {data.people.map((p) => (
              <PersonRow key={p.profile_id} person={p} canManage={data.can_manage} />
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Provisioning queue">
        {data.jobs.length === 0 ? (
          <Empty>Nothing queued.</Empty>
        ) : (
          <ul className="space-y-1 text-xs text-neutral-400">
            {data.jobs.map((j) => (
              <li key={j.id}>
                <Pill tone={j.status === 'dead' ? 'bad' : j.status === 'failed' ? 'warn' : 'muted'}>{j.status}</Pill> {j.kind.replace('_', ' ')} · {j.client} · attempt {j.attempts}
                {j.last_error ? ` · ${j.last_error}` : ''} · next {when(j.next_attempt_at)}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Permission profiles">
        <ul className="space-y-3 text-sm">
          {data.profiles.map((profile) => (
            <li key={profile.key}>
              <p className="text-neutral-100">
                {profile.label} <span className="text-xs text-neutral-500">(GHL role: {profile.ghl_role})</span>
              </p>
              <p className="text-xs text-flag-good">Allowed: {Object.entries(profile.permissions).filter(([, v]) => v).map(([k]) => k).join(', ')}</p>
              <p className="text-xs text-neutral-500">Denied: {Object.entries(profile.permissions).filter(([, v]) => !v).map(([k]) => k).join(', ')}</p>
              {profile.verify_manually.length ? <p className="text-xs text-amber-300">Verify manually: {profile.verify_manually.join('; ')}</p> : null}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-neutral-500">
          Edit them on <Link href="/vistrial/team/ghl/standard" className="underline">Standard</Link>.
        </p>
      </Panel>
    </div>
  );
}

function PersonRow({ person, canManage }: { person: Person; canManage: boolean }) {
  const [mode, setMode] = useState<'none' | 'revoke' | 'disable'>('none');
  const [reason, setReason] = useState('');
  const [password, setPassword] = useState('');
  const { run, pending, message, error } = useAction();
  const isAdmin = person.role === 'owner' || person.role === 'admin';
  const hasIds = new Set(person.has.map((h) => h.case_file_id));
  const shouldIds = new Set(person.should_have.map((s) => s.case_file_id));
  return (
    <li className="rounded-xl bg-white/[0.03] px-3 py-2.5 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-neutral-100">{person.name}</span>
        <span className="text-xs text-neutral-500">{person.role}</span>
        {person.ghl_user_id ? <span className="font-mono text-[11px] text-neutral-600">GHL {person.ghl_user_id}</span> : <Pill tone="muted">No GHL user</Pill>}
        {person.blocked ? <Pill tone="bad">All GHL access revoked</Pill> : null}
        {person.barrier && !person.blocked ? <Pill tone="warn">No access: {person.barrier}</Pill> : null}
        {isAdmin ? <Pill tone={person.admin_optin ? 'good' : 'muted'}>{person.admin_optin ? 'Admin access enabled' : 'Admin access off'}</Pill> : null}
      </div>
      <div className="mt-1 grid gap-1 text-xs sm:grid-cols-2">
        <p className="text-neutral-400">
          Should have:{' '}
          {person.should_have.length ? person.should_have.map((s) => `${s.name} (${s.reason.replace('_', ' ')})`).join(', ') : 'none'}
        </p>
        <p className="text-neutral-400">
          Has in GHL:{' '}
          {person.has.length
            ? person.has.map((h) => (
                <span key={h.case_file_id} className={shouldIds.has(h.case_file_id) ? '' : 'text-flag-critical'}>
                  {h.name}{' '}
                </span>
              ))
            : 'none seen'}
          {person.should_have.filter((s) => !hasIds.has(s.case_file_id)).length && person.has.length ? (
            <span className="text-amber-300"> · missing {person.should_have.filter((s) => !hasIds.has(s.case_file_id)).map((s) => s.name).join(', ')}</span>
          ) : null}
        </p>
      </div>
      {person.grants.some((g) => g.state !== 'active') ? (
        <p className="mt-1 text-xs text-amber-300">
          {person.grants.filter((g) => g.state !== 'active').map((g) => `${g.name}: ${g.state === 'failed' || g.state === 'pending' ? 'access pending' : 'being removed'}${g.last_error ? ` (${g.last_error})` : ''}`).join('; ')}
        </p>
      ) : null}
      {canManage ? (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          {isAdmin && !person.admin_optin ? (
            <button type="button" disabled={pending} onClick={() => run(() => setAdminAccessAction(person.profile_id, true, null))} className={`${btnSecondary} ${btnSizeSm}`}>
              Enable admin GHL access
            </button>
          ) : null}
          {isAdmin && person.admin_optin ? (
            <button type="button" onClick={() => setMode(mode === 'disable' ? 'none' : 'disable')} className={`${btnSecondary} ${btnSizeSm}`}>
              Disable admin GHL access
            </button>
          ) : null}
          {person.blocked ? (
            <button type="button" disabled={pending} onClick={() => run(() => restoreAccessAction(person.profile_id))} className={`${btnSecondary} ${btnSizeSm}`}>
              Lift the block
            </button>
          ) : (
            <button type="button" onClick={() => setMode(mode === 'revoke' ? 'none' : 'revoke')} className={`${btnSecondary} ${btnSizeSm} text-flag-critical`}>
              Revoke all GHL access
            </button>
          )}
        </div>
      ) : null}
      {mode !== 'none' ? (
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <label className="block">
            <span className={labelClass}>Why</span>
            <input value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} />
          </label>
          <StepUpField value={password} onChange={setPassword} />
          <div className="flex items-end gap-2">
            <button
              type="button"
              disabled={pending || !password || (mode === 'revoke' && !reason)}
              onClick={() =>
                run(
                  () => (mode === 'disable' ? setAdminAccessAction(person.profile_id, false, password) : revokeAllAccessAction(person.profile_id, reason, password)),
                  () => {
                    setPassword('');
                    setMode('none');
                  },
                )
              }
              className={`${btnPrimary} ${btnSizeSm}`}
            >
              {mode === 'disable' ? 'Disable now' : 'Revoke now'}
            </button>
          </div>
        </div>
      ) : null}
      <Feedback message={message} error={error} />
    </li>
  );
}
