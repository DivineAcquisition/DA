import { Badge, inputClass, labelClass } from '@/app/vistrial/components/ui';
import { ActionForm } from '@/app/ad/components/ActionForm';
import { cancelInviteAction, inviteAccountAction, resendInviteAction } from '@/lib/ad/actions';
import { listCaseFiles, listInvites } from '@/lib/ad/queries';
import { roleLabel } from '@/lib/ad/types';

export default async function InvitesPage() {
  const [invites, caseFiles] = await Promise.all([listInvites(), listCaseFiles()]);
  const live = invites.filter((i) => !i.accepted_at && !i.cancelled_at);

  return (
    <div className="space-y-10">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">Invite-only</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Invitations</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-400">
          There is no public signup. An uninvited authentication creates a pending profile with no
          scope and raises an Owner alert.
        </p>
      </div>

      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <h2 className="text-lg font-semibold">Invite an account</h2>
        <ActionForm className="mt-4" action={inviteAccountAction} submitLabel="Create invite">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Email</label>
              <input name="email" type="email" required className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Full name</label>
              <input name="full_name" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Role</label>
              <select name="role" className={inputClass} defaultValue="operator">
                {['admin', 'manager', 'operator', 'contractor'].map((role) => (
                  <option key={role} value={role}>
                    {roleLabel(role)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Scope</label>
              <select name="scope_kind" className={inputClass} defaultValue="clients">
                <option value="all_clients">All clients</option>
                <option value="clients">Named clients</option>
                <option value="placements">Placements</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Case file IDs (for named clients)</label>
              <input
                name="case_file_ids"
                className={inputClass}
                placeholder={caseFiles.map((c) => `${c.name}=${c.id}`).join(' · ')}
              />
            </div>
            <div>
              <label className={labelClass}>Account expiry (optional)</label>
              <input name="expires_on" type="date" className={inputClass} />
            </div>
          </div>
        </ActionForm>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Open invites ({live.length})</h2>
        <div className="overflow-hidden rounded-2xl border border-white/[0.06]">
          <ul className="divide-y divide-white/[0.04]">
            {live.map((invite) => (
              <li key={invite.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-medium text-white">{invite.full_name ?? invite.email}</p>
                  <p className="text-xs text-neutral-500">
                    {invite.email} · {roleLabel(invite.role)} · {invite.scope_kind} · expires{' '}
                    {new Date(invite.expires_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge tone="warning">Open</Badge>
                  <ActionForm
                    action={async () => resendInviteAction(invite.id)}
                    submitLabel="Resend"
                    variant="secondary"
                  />
                  <ActionForm
                    action={async () => cancelInviteAction(invite.id)}
                    submitLabel="Cancel"
                    variant="danger"
                  />
                </div>
              </li>
            ))}
            {live.length === 0 && (
              <li className="px-4 py-8 text-center text-neutral-500">No open invitations.</li>
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}
