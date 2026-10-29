'use client';

import {
  connectPlacementGhlAction,
  disconnectPlacementGhlAction,
  queueGhlRerunAction,
  saveGhlMappingAction,
  testPlacementGhlAction,
} from '@/lib/workspace/sales-ghl-actions';
import { Field, Input, Textarea } from '../../components/ui';
import ActionForm from './ActionForm';

type Panel = {
  placement_id: string;
  case_file_id: string;
  location_id: string | null;
  location_name: string | null;
  token_last4: string | null;
  status: string;
  ghl_user_id: string | null;
  duplicate_placement_id: string | null;
  last_success_at: string | null;
  last_error: string | null;
  mapping: Record<string, unknown>;
  catalog: { users?: { id: string; name: string; email: string }[] };
  missing: (string | null)[];
};

export default function GhlPlacement({ panel }: { panel: Panel }) {
  const missing = (panel.missing ?? []).filter(Boolean);
  const users = panel.catalog?.users ?? [];
  return (
    <div className="space-y-4 text-sm">
      <p className="text-white">
        {panel.status === 'connected' ? 'Connected' : panel.status === 'needs_attention' ? 'Needs attention' : 'Disconnected'}
        {panel.token_last4 ? ` · token ending ${panel.token_last4}` : ''}
        {panel.location_name ? ` · ${panel.location_name}` : ''}
      </p>
      {panel.last_success_at ? <p className="text-[var(--ws-dim)]">Last sync {panel.last_success_at}</p> : null}
      {panel.last_error ? <p className="text-amber-200">{panel.last_error}</p> : null}
      {panel.duplicate_placement_id ? (
        <p className="text-amber-200">This GHL user is already mapped to another active placement.</p>
      ) : null}
      {missing.length > 0 ? (
        <ul className="text-[var(--ws-dim)]">
          {missing.map((item) => (
            <li key={item}>Missing: {item}. That metric stays Pending sync.</li>
          ))}
        </ul>
      ) : (
        <p className="text-[var(--ws-dim)]">Mappings cover the checklist.</p>
      )}

      <ActionForm action={connectPlacementGhlAction} submitLabel="Save connection">
        <input type="hidden" name="placement_id" value={panel.placement_id} />
        <input type="hidden" name="case_file_id" value={panel.case_file_id} />
        <Field label="Location ID" hint="Leave blank to keep the client's existing sub-account.">
          <Input name="location_id" defaultValue={panel.location_id ?? ''} />
        </Field>
        <Field label="Private integration token" hint="Read only. Stored in the vault. Not shown again.">
          <Input name="token" type="password" autoComplete="off" placeholder={panel.token_last4 ? 'Saved' : 'Paste a new token'} />
        </Field>
        <Field label="Operator GHL user id">
          <Input name="ghl_user_id" defaultValue={panel.ghl_user_id ?? ''} />
        </Field>
        {users.length > 0 ? (
          <ul className="text-xs text-[var(--ws-dim)]">
            {users.map((user) => (
              <li key={user.id}>
                {user.name || user.email} · {user.id}
              </li>
            ))}
          </ul>
        ) : null}
      </ActionForm>

      <ActionForm action={testPlacementGhlAction} submitLabel="Test connection">
        <input type="hidden" name="placement_id" value={panel.placement_id} />
        <input type="hidden" name="case_file_id" value={panel.case_file_id} />
        <p className="text-[var(--ws-dim)]">Confirms read access and lists users. Nothing is written in GHL.</p>
      </ActionForm>

      <ActionForm action={saveGhlMappingAction} submitLabel="Save mapping">
        <input type="hidden" name="placement_id" value={panel.placement_id} />
        <Field label="Mapping JSON" hint="Applies from tomorrow. A history re-run can apply it sooner.">
          <Textarea name="mapping" rows={8} defaultValue={JSON.stringify(panel.mapping ?? {}, null, 2)} />
        </Field>
      </ActionForm>

      <ActionForm action={queueGhlRerunAction} submitLabel="Re-run this range">
        <input type="hidden" name="placement_id" value={panel.placement_id} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="From">
            <Input name="from" type="date" required />
          </Field>
          <Field label="To">
            <Input name="to" type="date" required />
          </Field>
        </div>
      </ActionForm>

      <ActionForm action={disconnectPlacementGhlAction} submitLabel="Disconnect">
        <input type="hidden" name="placement_id" value={panel.placement_id} />
      </ActionForm>
    </div>
  );
}
