import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, inputClass, labelClass } from '@/app/vistrial/components/ui';
import { ActionForm, Disclosure } from '@/app/ad/components/ActionForm';
import {
  archiveAccountAction,
  changeRoleAction,
  reactivateAccountAction,
  requirePasswordResetAction,
  resetSecondFactorAction,
  restoreAccountAction,
  setAccountNoticeAction,
  setExpiryAction,
  setMfaRequirementAction,
  setPermissionOverrideAction,
  setScopeAction,
  setSignInRestrictionsAction,
  softDeleteAccountAction,
  startImpersonationAction,
  suspendAccountAction,
} from '@/lib/ad/actions';
import {
  explainPermission,
  getAccount,
  getAccountScope,
  listAccountOverrides,
  listAuditEvents,
  listCaseFiles,
  listPermissions,
  openWorkFor,
} from '@/lib/ad/queries';
import { roleLabel, stateLabel } from '@/lib/ad/types';

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const account = await getAccount(id);
  if (!account) notFound();

  const [scope, work, audit, overrides, permissions, caseFiles, canImpersonate] = await Promise.all([
    getAccountScope(id),
    openWorkFor(id),
    listAuditEvents(40, id),
    listAccountOverrides(id),
    listPermissions(),
    listCaseFiles(),
    explainPermission('accounts.impersonate'),
  ]);

  const openItems = work.filter((w) => w.count > 0);

  return (
    <div className="space-y-10">
      <div>
        <Link href="/ad" className="text-sm text-neutral-500 hover:text-neutral-300">
          ← Accounts
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              {account.full_name ?? account.email}
            </h1>
            <p className="mt-1 text-sm text-neutral-400">{account.email}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="brand">{roleLabel(account.role)}</Badge>
              <Badge tone={account.state === 'active' ? 'good' : 'warning'}>
                {stateLabel(account.state)}
              </Badge>
              {account.must_change_password && <Badge tone="warning">Must change password</Badge>}
            </div>
          </div>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Expires', account.expires_on ?? '—'],
          ['MFA required', account.mfa_required === false ? 'No' : 'Yes / role default'],
          ['Session timeout', account.session_timeout_minutes ? `${account.session_timeout_minutes}m` : 'Default'],
          ['Failed attempts', String(account.failed_attempts)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
            <p className="mt-1 text-sm text-white">{value}</p>
          </div>
        ))}
      </section>

      {openItems.length > 0 && (
        <section className="rounded-2xl border border-flag-warning/25 bg-flag-warning/[0.06] px-4 py-4">
          <h2 className="text-sm font-semibold text-flag-warning">Open work before archive/delete</h2>
          <ul className="mt-2 space-y-1 text-sm text-neutral-300">
            {openItems.map((item) => (
              <li key={item.kind}>
                {item.label}: {item.count}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Lifecycle</h2>
        <div className="flex flex-wrap gap-3">
          {account.state === 'active' && (
            <Disclosure label="Suspend">
              <ActionForm
                action={suspendAccountAction.bind(null, id)}
                submitLabel="Suspend now"
                variant="danger"
              >
                <label className={labelClass}>Reason</label>
                <input name="reason" required className={inputClass} />
              </ActionForm>
            </Disclosure>
          )}
          {account.state === 'suspended' && (
            <ActionForm action={async () => reactivateAccountAction(id)} submitLabel="Reactivate" />
          )}
          <Disclosure label="Set expiry">
            <ActionForm action={setExpiryAction.bind(null, id)} submitLabel="Save expiry">
              <label className={labelClass}>Expires on</label>
              <input name="expires_on" type="date" className={inputClass} defaultValue={account.expires_on ?? ''} />
            </ActionForm>
          </Disclosure>
          <ActionForm action={async () => archiveAccountAction(id)} submitLabel="Archive" variant="secondary" />
          <ActionForm
            action={async () => softDeleteAccountAction(id)}
            submitLabel="Soft delete"
            variant="danger"
          />
          {account.soft_deleted_at && (
            <ActionForm action={async () => restoreAccountAction(id)} submitLabel="Restore" />
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Role &amp; scope</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <ActionForm action={changeRoleAction.bind(null, id)} submitLabel="Change role">
            <label className={labelClass}>Role</label>
            <select name="role" defaultValue={account.role} className={inputClass}>
              {['owner', 'admin', 'manager', 'operator', 'contractor', 'client'].map((role) => (
                <option key={role} value={role}>
                  {roleLabel(role)}
                </option>
              ))}
            </select>
          </ActionForm>

          <ActionForm action={setScopeAction.bind(null, id)} submitLabel="Set scope">
            <label className={labelClass}>Scope kind</label>
            <select name="kind" defaultValue={scope.scope?.kind ?? 'clients'} className={inputClass}>
              <option value="all_clients">All clients</option>
              <option value="clients">Named clients</option>
              <option value="placements">Placements</option>
            </select>
            <label className={labelClass}>Case file IDs (comma-separated)</label>
            <input
              name="case_file_ids"
              className={inputClass}
              defaultValue={scope.caseFileIds.join(',')}
              placeholder={caseFiles.map((c) => c.id).slice(0, 1).join('') || 'uuid'}
            />
            <label className={labelClass}>Placement IDs (comma-separated)</label>
            <input
              name="placement_ids"
              className={inputClass}
              defaultValue={scope.placementIds.join(',')}
            />
          </ActionForm>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Permission overrides</h2>
        <p className="text-sm text-neutral-400">
          Explicit deny beats every grant. Current overrides:{' '}
          {overrides.length === 0 ? 'none' : overrides.map((o) => `${o.permission_key}=${o.effect}`).join(', ')}
        </p>
        <ActionForm action={setPermissionOverrideAction.bind(null, id)} submitLabel="Save override">
          <label className={labelClass}>Permission</label>
          <select name="permission_key" className={inputClass}>
            {permissions.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label} ({p.key})
              </option>
            ))}
          </select>
          <label className={labelClass}>Effect</label>
          <select name="effect" className={inputClass}>
            <option value="deny">Deny</option>
            <option value="grant">Grant</option>
          </select>
          <label className={labelClass}>Reason</label>
          <input name="reason" className={inputClass} />
        </ActionForm>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Credentials &amp; sessions</h2>
        <div className="flex flex-wrap gap-3">
          <ActionForm
            action={async () => requirePasswordResetAction(id)}
            submitLabel="Force password reset"
            variant="secondary"
          />
          <ActionForm
            action={async () => resetSecondFactorAction(id)}
            submitLabel="Reset MFA"
            variant="secondary"
          />
          <ActionForm action={setMfaRequirementAction.bind(null, id)} submitLabel="Set MFA flag">
            <select name="required" className={inputClass} defaultValue="true">
              <option value="true">Required</option>
              <option value="false">Not required</option>
            </select>
          </ActionForm>
        </div>
        <ActionForm action={setSignInRestrictionsAction.bind(null, id)} submitLabel="Save restrictions">
          <label className={labelClass}>IP allowlist</label>
          <input
            name="ip_allowlist"
            className={inputClass}
            defaultValue={(account.ip_allowlist ?? []).join(', ')}
          />
          <label className="flex items-center gap-2 text-sm text-neutral-300">
            <input type="checkbox" name="restrict_to_shift" defaultChecked={account.restrict_to_shift} />
            Restrict to shift
          </label>
          <label className={labelClass}>Session timeout (minutes)</label>
          <input
            name="session_timeout_minutes"
            type="number"
            className={inputClass}
            defaultValue={account.session_timeout_minutes ?? ''}
          />
        </ActionForm>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Communication</h2>
        <ActionForm action={setAccountNoticeAction.bind(null, id)} submitLabel="Post notice">
          <label className={labelClass}>Body</label>
          <textarea name="body" required rows={3} className={inputClass} />
          <label className={labelClass}>Severity</label>
          <select name="severity" className={inputClass} defaultValue="urgent">
            <option value="urgent">Urgent</option>
            <option value="critical">Critical</option>
            <option value="normal">Normal</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-neutral-300">
            <input type="checkbox" name="blocking" />
            Blocking (must acknowledge before work)
          </label>
        </ActionForm>
      </section>

      {canImpersonate?.allowed && account.role !== 'owner' && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Impersonate</h2>
          <p className="text-sm text-neutral-400">
            Step-up required. You keep your session; the target is notified; Owner cannot be
            impersonated.
          </p>
          <ActionForm
            action={startImpersonationAction.bind(null, id)}
            submitLabel="Start impersonation"
            variant="secondary"
          >
            <label className={labelClass}>Reason</label>
            <input name="reason" required className={inputClass} />
            <label className={labelClass}>Minutes</label>
            <input name="minutes" type="number" defaultValue={30} className={inputClass} />
            <label className={labelClass}>Confirm password (step-up)</label>
            <input name="password" type="password" required className={inputClass} />
          </ActionForm>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Recent audit for this account</h2>
        <div className="overflow-hidden rounded-2xl border border-white/[0.06]">
          <ul className="divide-y divide-white/[0.04] text-sm">
            {audit.map((event) => (
              <li key={event.id} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-white">{event.action}</span>
                  <span className="text-xs text-neutral-500">
                    {new Date(event.at).toLocaleString()}
                  </span>
                </div>
                <p className="mt-1 text-neutral-400">{event.summary}</p>
                <p className="mt-1 text-xs text-neutral-600">
                  {event.actor_email}
                  {event.acting_as_profile_id ? ' (impersonating)' : ''}
                </p>
              </li>
            ))}
            {audit.length === 0 && (
              <li className="px-4 py-8 text-center text-neutral-500">No audit events yet.</li>
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}
