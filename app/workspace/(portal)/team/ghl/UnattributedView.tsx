'use client';

import { useState } from 'react';
import { btnSecondary, btnSizeSm } from '@/app/components/ui';
import { resolveUserAction } from '@/lib/ghl/actions';
import type { Unattributed } from '@/lib/ghl/types';
import { selectClass } from '../../components/ui';
import { Feedback, useAction } from '../../operator/components/portal';
import { Empty, Panel, Pill, when } from './ui';

/**
 * Messages sent from GHL by someone DA does not know. They are recorded and
 * credited to nobody until an admin says who they are: a DA person (a VA,
 * manager or admin) or the client's own staff. Resolving re-attributes their
 * past touches and recalculates the response times they affect.
 */
export default function UnattributedView({ data }: { data: Unattributed }) {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-white">Unattributed events</h1>
      <p className="text-sm text-neutral-400">
        These GHL users sent messages, calls or notes that DA could not match to anyone. Nothing here counts toward any VA&apos;s response time until you resolve it.
      </p>

      <Panel title={`Unknown GHL users (${data.users.length})`}>
        {data.users.length === 0 ? (
          <Empty>Every sender GHL has named is known.</Empty>
        ) : (
          <ul className="divide-y divide-white/5">
            {data.users.map((u) => (
              <UserRow key={`${u.case_file_id}:${u.ghl_user_id}`} user={u} data={data} />
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Sent with no user at all">
        {data.no_user.length === 0 ? (
          <Empty>None. Every human message GHL reported carried a sending user.</Empty>
        ) : (
          <>
            <ul className="space-y-1 text-sm text-neutral-300">
              {data.no_user.map((n) => (
                <li key={n.case_file_id}>
                  {n.client}: {n.touches} {n.touches === 1 ? 'message' : 'messages'}, latest {when(n.last_seen)}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-neutral-500">
              GHL named nobody, so there is no one to map. They are recorded as unattributed and never guessed or credited.
            </p>
          </>
        )}
      </Panel>
    </div>
  );
}

function UserRow({ user, data }: { user: Unattributed['users'][number]; data: Unattributed }) {
  const [person, setPerson] = useState('');
  const { run, pending, message, error } = useAction();
  const free = data.people.filter((p) => !p.ghl_user_id);
  return (
    <li className="space-y-2 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-white">{user.name ?? 'Unnamed GHL user'}</span>
        {user.email ? <span className="text-xs text-neutral-400">{user.email}</span> : null}
        <Pill tone="warn">{user.touches} {user.touches === 1 ? 'touch' : 'touches'}</Pill>
        {!user.known_in_ghl ? <Pill tone="muted">Not in the users list yet</Pill> : null}
      </div>
      <p className="font-mono text-[11px] text-neutral-500">
        {user.ghl_user_id} · {user.client} · first {when(user.first_seen)} · latest {when(user.last_seen)}
      </p>
      {data.can_manage ? (
        <div className="flex flex-wrap items-center gap-2">
          <select value={person} onChange={(e) => setPerson(e.target.value)} className={`${selectClass} py-1.5 text-xs`} aria-label="DA person">
            <option value="">Choose a DA person…</option>
            {free.map((p) => (
              <option key={p.profile_id} value={p.profile_id}>
                {p.name} ({p.role})
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={pending || !person}
            onClick={() => run(() => resolveUserAction(user.ghl_user_id, 'person', person, user.case_file_id))}
            className={`${btnSecondary} ${btnSizeSm}`}
          >
            Map to this person
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => resolveUserAction(user.ghl_user_id, 'client_staff', null, user.case_file_id))}
            className={`${btnSecondary} ${btnSizeSm}`}
          >
            Mark as {user.client} staff
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => resolveUserAction(user.ghl_user_id, 'agency_staff', null, user.case_file_id))}
            className={`${btnSecondary} ${btnSizeSm}`}
          >
            Mark as DA staff
          </button>
        </div>
      ) : null}
      <Feedback message={message} error={error} />
    </li>
  );
}
