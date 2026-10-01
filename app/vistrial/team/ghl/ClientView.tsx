'use client';

import { useState } from 'react';
import { btnPrimary, btnSecondary, btnSizeSm } from '@/app/components/ui';
import {
  fixMismatchAction,
  markKnownUserAction,
  retryGrantAction,
  saveRoutingAction,
  setLocationDetailsAction,
  setupEndpointAction,
} from '@/lib/ghl/actions';
import type { CaseDetail, PlacementOption } from '@/lib/ghl/types';
import { inputClass, labelClass, selectClass } from '../../components/ui';
import { Feedback, useAction } from '../../operator/components/portal';
import { AddConnectionForm, ConnectionControls, ConnectionSummary } from './ConnectionsView';
import { Empty, Panel, Pill, StepUpField, when } from './ui';

const STATE_TONE: Record<string, 'good' | 'warn' | 'bad' | 'muted'> = {
  active: 'good',
  pending: 'warn',
  failed: 'bad',
  revoking: 'warn',
  revoked: 'muted',
};

const STATE_LABEL: Record<string, string> = {
  active: 'Has access',
  pending: 'Access pending',
  failed: 'Access pending (failed, retrying)',
  revoking: 'Being removed',
  revoked: 'Removed',
};

export default function ClientView({ detail, placements, origin }: { detail: CaseDetail; placements: PlacementOption[]; origin: string }) {
  const linked = Boolean(detail.location);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold text-white">{detail.name}: GHL</h1>
        {detail.location?.is_test ? <Pill tone="muted">Test sub-account</Pill> : null}
        {detail.readiness.ready ? <Pill tone="good">Ready</Pill> : <Pill tone="warn">Not ready</Pill>}
      </div>

      <Panel title="Connection">
        {detail.connection ? (
          <>
            <p className="mb-2 text-xs text-neutral-500">
              Location {detail.location?.location_id}
              {detail.location?.location_name ? ` · ${detail.location.location_name}` : ''}
              {detail.location?.time_zone ? ` · ${detail.location.time_zone}` : ''}
            </p>
            <ConnectionSummary connection={detail.connection} required={[]} />
            {detail.can_manage ? <ConnectionControls connection={detail.connection} caseFileId={detail.case_file_id} /> : null}
          </>
        ) : detail.can_manage ? (
          <>
            <p className="mb-3 text-sm text-neutral-400">
              Paste a Private Integration Token created inside this client&apos;s sub-account, and its Location ID. It is tested before it is saved, and only
              its last four characters are ever shown again.
            </p>
            <AddConnectionForm level="location" caseFileId={detail.case_file_id} />
          </>
        ) : (
          <Empty>Not connected.</Empty>
        )}
      </Panel>

      <Panel title="Readiness">
        <ul className="space-y-1.5 text-sm">
          {detail.readiness.checks.map((c) => (
            <li key={c.key} className="flex flex-wrap items-center gap-2">
              <Pill tone={c.ok ? 'good' : c.blocking ? 'bad' : 'warn'}>{c.ok ? 'Done' : c.blocking ? 'Blocking' : 'Not yet'}</Pill>
              <span className="text-neutral-200">{c.label}</span>
              <span className="text-xs text-neutral-500">{c.detail}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-neutral-500">A placement cannot start on this client until every blocking item is done.</p>
        {linked && detail.can_manage ? <LocationDetails detail={detail} /> : null}
      </Panel>

      {linked ? (
        <Panel title="Mapping to the standard">
          <p className="mb-2 text-xs text-neutral-500">Last mapped {when(detail.location?.mapping_checked_at)}. Matched by name on connect and on every health check.</p>
          <ul className="space-y-1 text-sm">
            {detail.mapping.map((m) => (
              <li key={`${m.kind}-${m.parent ?? ''}-${m.name}`} className="flex flex-wrap items-center gap-2">
                <Pill tone={m.status === 'mapped' ? 'good' : m.status === 'unchecked' ? 'muted' : 'bad'}>{m.status}</Pill>
                <span className="text-neutral-400">{m.kind.replace('_', ' ')}</span>
                <span className="text-neutral-100">
                  {m.parent ? `${m.parent} › ` : ''}
                  {m.name}
                  {m.position ? ` (#${m.position})` : ''}
                </span>
                {m.ghl_id ? <span className="font-mono text-[11px] text-neutral-600">{m.ghl_id}</span> : null}
                {m.detail ? <span className="text-xs text-flag-critical">{m.detail}</span> : null}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {linked ? <EndpointPanel detail={detail} origin={origin} /> : null}
      {linked ? <RoutingPanel detail={detail} placements={placements} /> : null}
      {linked ? <AccessPanel detail={detail} /> : null}

      {detail.requests.length ? (
        <Panel title="Recent GHL calls">
          <ul className="space-y-1 font-mono text-[11px] text-neutral-400">
            {detail.requests.map((r, i) => (
              <li key={i} className={r.outcome === 'ok' ? '' : 'text-flag-critical'}>
                {when(r.at)} · {r.method} {r.path} · {r.purpose} · {r.status_code ?? '—'} {r.outcome} · {r.duration_ms ?? '—'} ms
                {r.burst_remaining !== null ? ` · ${r.burst_remaining} left in burst` : ''}
                {r.error ? ` · ${r.error}` : ''}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}

function LocationDetails({ detail }: { detail: CaseDetail }) {
  const [isTest, setIsTest] = useState(detail.location?.is_test ?? false);
  const [a2p, setA2p] = useState(detail.location?.a2p_reference ?? '');
  const { run, pending, message, error } = useAction();
  return (
    <div className="mt-4 grid gap-3 border-t border-white/[0.06] pt-4 sm:grid-cols-2">
      <label className="flex items-center gap-2 text-sm text-neutral-300">
        <input type="checkbox" checked={isTest} onChange={(e) => setIsTest(e.target.checked)} />
        Test sub-account
      </label>
      <label className="block">
        <span className={labelClass}>A2P registration reference (approved)</span>
        <input value={a2p} onChange={(e) => setA2p(e.target.value)} className={inputClass} />
      </label>
      <button type="button" disabled={pending} onClick={() => run(() => setLocationDetailsAction(detail.case_file_id, isTest, a2p))} className={`${btnSecondary} ${btnSizeSm} sm:justify-self-start`}>
        Save
      </button>
      <div className="sm:col-span-2">
        <Feedback message={message} error={error} />
      </div>
    </div>
  );
}

function EndpointPanel({ detail, origin }: { detail: CaseDetail; origin: string }) {
  const [password, setPassword] = useState('');
  const [shown, setShown] = useState<{ path: string; secret: string; header: string } | null>(null);
  const { run, pending, message, error } = useAction();
  const url = (path: string) => `${origin}${path}`;
  return (
    <Panel title="Live activity">
      <div className="space-y-2 text-sm text-neutral-300">
        <p>
          Messages (inbound and outbound, with the sending user and source) are read from the Conversations API every minute
          {detail.location?.polled_at ? `; last read ${when(detail.location.polled_at)}` : ''}. New contacts, stage changes and appointments come from the
          master snapshot&apos;s workflow webhooks to this client&apos;s own endpoint.
        </p>
        {detail.endpoint ? (
          <p className="text-xs text-neutral-400">
            Endpoint: <span className="font-mono text-neutral-200">{url(detail.endpoint.path)}</span> · header <span className="font-mono">{detail.endpoint.header}</span> ·
            last delivery {when(detail.endpoint.last_event_at)}
          </p>
        ) : (
          <p className="text-xs text-amber-300">No endpoint yet.</p>
        )}
      </div>
      {shown ? (
        <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/[0.06] p-3 text-xs text-neutral-200">
          <p className="mb-2 font-semibold text-amber-300">Paste these into the snapshot&apos;s workflow webhook actions now. The secret is not shown again.</p>
          <p>URL: <span className="select-all font-mono">{url(shown.path)}</span></p>
          <p>Header: <span className="font-mono">{shown.header}</span></p>
          <p>Value: <span className="select-all font-mono">{shown.secret}</span></p>
          <p className="mt-2 text-neutral-400">
            Body (Custom Webhook, JSON): {'{'}&quot;type&quot;: &quot;ContactCreate&quot; | &quot;PipelineStageChanged&quot; | &quot;AppointmentStatus&quot;, &quot;locationId&quot;:
            &quot;{'{{location.id}}'}&quot;, &quot;contactId&quot;: &quot;{'{{contact.id}}'}&quot;, &quot;dateAdded&quot;: &quot;{'{{right_now}}'}&quot;{'}'}
          </p>
        </div>
      ) : null}
      {detail.can_manage ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <StepUpField value={password} onChange={setPassword} />
          <div className="flex items-end">
            <button
              type="button"
              disabled={pending || !password}
              onClick={() =>
                run(
                  () => setupEndpointAction(detail.case_file_id, password),
                  (result) => {
                    setPassword('');
                    if (result.ok && result.data) setShown(result.data);
                  },
                )
              }
              className={`${btnSecondary} ${btnSizeSm}`}
            >
              {detail.endpoint ? 'Rotate the secret' : 'Create the endpoint'}
            </button>
          </div>
        </div>
      ) : null}
      <Feedback message={message} error={error} />
    </Panel>
  );
}

function RoutingPanel({ detail, placements }: { detail: CaseDetail; placements: PlacementOption[] }) {
  const r = detail.routing;
  const [form, setForm] = useState({
    enabled: r.enabled,
    method: r.routing_method,
    singleOwnerPlacementId: r.single_owner_placement_id,
    afterHours: r.after_hours_behavior,
    remindAfter: r.remind_after_minutes,
    managerAfter: r.manager_after_minutes,
    maxOpen: r.max_open_leads,
    autoReassign: r.auto_reassign,
    reassignAfter: r.reassign_after_minutes,
    silenceMinutes: r.silence_alert_minutes,
  });
  const { run, pending, message, error } = useAction();
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));
  const disabled = !detail.can_manage_routing;
  const num = (key: 'remindAfter' | 'managerAfter' | 'maxOpen' | 'reassignAfter' | 'silenceMinutes', label: string) => (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <input type="number" min={1} disabled={disabled} value={form[key]} onChange={(e) => set(key, Number(e.target.value))} className={inputClass} />
    </label>
  );
  return (
    <Panel title="Lead routing">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-sm text-neutral-300">
          <input type="checkbox" disabled={disabled} checked={form.enabled} onChange={(e) => set('enabled', e.target.checked)} />
          Routing on
        </label>
        <label className="block">
          <span className={labelClass}>Method</span>
          <select disabled={disabled} value={form.method} onChange={(e) => set('method', e.target.value as typeof form.method)} className={selectClass}>
            <option value="round_robin">Round robin among VAs on shift</option>
            <option value="single_owner">Single owner</option>
            <option value="manual">Manual</option>
          </select>
        </label>
        {form.method === 'single_owner' ? (
          <label className="block">
            <span className={labelClass}>Owner</span>
            <select disabled={disabled} value={form.singleOwnerPlacementId ?? ''} onChange={(e) => set('singleOwnerPlacementId', e.target.value || null)} className={selectClass}>
              <option value="">Pick a placement</option>
              {placements.map((p) => (
                <option key={p.placement_id} value={p.placement_id}>
                  {p.operator} ({p.shift})
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="block">
          <span className={labelClass}>Nobody on shift</span>
          <select disabled={disabled} value={form.afterHours} onChange={(e) => set('afterHours', e.target.value as typeof form.afterHours)} className={selectClass}>
            <option value="next_shift">Queue for the next shift start</option>
            <option value="manual">Hold for manual assignment</option>
          </select>
        </label>
        {num('remindAfter', 'Remind the VA after (minutes)')}
        {num('managerAfter', 'Alert the manager after (minutes)')}
        {num('maxOpen', 'Open-lead limit per VA')}
        {num('silenceMinutes', 'Silence alert during business hours (minutes)')}
        <label className="flex items-center gap-2 text-sm text-neutral-300">
          <input type="checkbox" disabled={disabled} checked={form.autoReassign} onChange={(e) => set('autoReassign', e.target.checked)} />
          Reassign automatically when untouched
        </label>
        {form.autoReassign ? num('reassignAfter', 'Reassign after (minutes)') : null}
      </div>
      {!disabled ? (
        <button type="button" disabled={pending} onClick={() => run(() => saveRoutingAction({ caseFileId: detail.case_file_id, ...form }))} className={`${btnPrimary} ${btnSizeSm} mt-3`}>
          Save routing
        </button>
      ) : null}
      <Feedback message={message} error={error} />
    </Panel>
  );
}

function AccessPanel({ detail }: { detail: CaseDetail }) {
  const { run, pending, message, error } = useAction();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const staff = detail.ghl_users.filter((u) => u.known_kind);
  const others = detail.ghl_users.filter((u) => !u.known_kind && !u.da_person);
  return (
    <Panel title="Access">
      <p className="mb-2 text-xs text-neutral-500">Users last read from GHL {when(detail.location?.users_checked_at)}. Reconciliation runs daily and on &quot;Check now&quot;.</p>

      {detail.mismatches.length ? (
        <ul className="mb-4 space-y-2">
          {detail.mismatches.map((m) => (
            <li key={m.id} className="rounded-xl border border-flag-critical/20 bg-flag-critical/[0.05] p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone="bad">{m.kind === 'missing' ? 'Should have access, does not' : m.kind === 'extra' ? 'Has access, should not' : 'Wrong permissions'}</Pill>
                <span className="text-neutral-200">{m.detail}</span>
                {m.resolution ? <span className="text-xs text-neutral-500">({m.resolution})</span> : null}
              </div>
              {detail.can_manage_access ? (
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  {m.kind === 'extra' ? (
                    confirming === m.id ? (
                      <>
                        <div className="w-60">
                          <StepUpField value={password} onChange={setPassword} />
                        </div>
                        <button type="button" disabled={pending || !password} onClick={() => run(() => fixMismatchAction(m.id, password), () => setPassword(''))} className={`${btnSecondary} ${btnSizeSm} text-flag-critical`}>
                          Confirm removal
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" onClick={() => setConfirming(m.id)} className={`${btnSecondary} ${btnSizeSm}`}>
                          Remove access
                        </button>
                        {m.ghl_user_id ? (
                          <button type="button" disabled={pending} onClick={() => run(() => markKnownUserAction(m.ghl_user_id!, 'client_staff', detail.case_file_id))} className={`${btnSecondary} ${btnSizeSm}`}>
                            Mark as client staff
                          </button>
                        ) : null}
                        {m.ghl_user_id ? (
                          <button type="button" disabled={pending} onClick={() => run(() => markKnownUserAction(m.ghl_user_id!, 'agency_staff', detail.case_file_id))} className={`${btnSecondary} ${btnSizeSm}`}>
                            Mark as agency staff
                          </button>
                        ) : null}
                      </>
                    )
                  ) : (
                    <button type="button" disabled={pending} onClick={() => run(() => fixMismatchAction(m.id, null))} className={`${btnPrimary} ${btnSizeSm}`}>
                      Fix
                    </button>
                  )}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">DA people</h3>
      {detail.access.length === 0 ? (
        <Empty>Nobody from DA has access here yet.</Empty>
      ) : (
        <ul className="space-y-2">
          {detail.access.map((a) => (
            <li key={a.grant_id} className="rounded-xl bg-white/[0.03] px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-neutral-100">{a.name}</span>
                <span className="text-xs text-neutral-500">
                  {a.role} · {a.reason.replace('_', ' ')}
                </span>
                <Pill tone={STATE_TONE[a.state] ?? 'muted'}>{STATE_LABEL[a.state] ?? a.state}</Pill>
                {a.state === 'failed' && detail.can_manage_access ? (
                  <button type="button" disabled={pending} onClick={() => run(() => retryGrantAction(a.grant_id))} className={`${btnSecondary} ${btnSizeSm}`}>
                    Retry now
                  </button>
                ) : null}
              </div>
              {a.last_error ? <p className="mt-1 text-xs text-flag-critical">{a.last_error}</p> : null}
              {a.revoke_reason ? <p className="mt-1 text-xs text-neutral-500">Removed because: {a.revoke_reason}</p> : null}
              {a.verify_manually.length ? (
                <p className="mt-1 text-xs text-amber-300">Verify manually in GHL: {a.verify_manually.join('; ')}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wider text-neutral-500">Client staff and agency staff (never touched)</h3>
      {staff.length === 0 ? (
        <Empty>None marked.</Empty>
      ) : (
        <ul className="space-y-1 text-sm">
          {staff.map((u) => (
            <li key={u.ghl_user_id} className="flex flex-wrap items-center gap-2">
              <span className="text-neutral-200">{u.name ?? u.ghl_user_id}</span>
              <span className="text-xs text-neutral-500">{u.email}</span>
              <Pill tone="muted">{u.known_kind === 'client_staff' ? 'Client staff' : 'Agency staff'}</Pill>
              {detail.can_manage_access ? (
                <button type="button" disabled={pending} onClick={() => run(() => markKnownUserAction(u.ghl_user_id, null, detail.case_file_id))} className="text-xs text-neutral-500 hover:text-white">
                  Unmark
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {others.length ? (
        <p className="mt-3 text-xs text-neutral-500">
          Other GHL users here: {others.map((u) => u.name ?? u.ghl_user_id).join(', ')}. Mark them above if they belong to the client.
        </p>
      ) : null}
      <Feedback message={message} error={error} />
    </Panel>
  );
}
