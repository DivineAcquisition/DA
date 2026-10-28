'use client';

import { useState } from 'react';
import { btnPrimary, btnSecondary, btnSizeSm } from '@/app/components/ui';
import { saveProfileAction, saveStandardItemAction } from '@/lib/ghl/actions';
import type { Standard } from '@/lib/ghl/types';
import { inputClass, labelClass, selectClass } from '../../components/ui';
import { Feedback, useAction } from '../../operator/components/portal';
import { Panel, Pill } from './ui';

type Item = Standard['items'][number];

const KIND_LABEL: Record<string, string> = {
  pipeline: 'Pipeline',
  stage: 'Stage',
  custom_field: 'Custom field',
  tag: 'Tag',
  calendar: 'Calendar',
};

export default function StandardView({ standard }: { standard: Standard }) {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-white">The DA sub-account standard</h1>
      <p className="text-sm text-neutral-400">
        Every client sub-account is built from the master snapshot and checked against this list by name. Anything missing or different is drift: it is
        flagged on the client and blocks placements there until fixed.
      </p>
      <Panel title="Items">
        <ul className="space-y-2">
          {standard.items.map((item) => (
            <ItemRow key={item.id} item={item} canManage={standard.can_manage} />
          ))}
        </ul>
        {standard.can_manage ? <ItemRow item={null} canManage /> : null}
      </Panel>
      {standard.profiles.map((profile) => (
        <ProfileEditor key={profile.key} profile={profile} canManage={standard.can_manage} />
      ))}
    </div>
  );
}

function ItemRow({ item, canManage }: { item: Item | null; canManage: boolean }) {
  const [editing, setEditing] = useState(item === null);
  const [form, setForm] = useState({
    kind: item?.kind ?? 'stage',
    name: item?.name ?? '',
    parentName: item?.parent_name ?? '',
    position: item?.position ?? null,
    fieldType: item?.field_type ?? '',
    active: item?.active ?? true,
  });
  const { run, pending, message, error } = useAction();
  if (!editing && item) {
    return (
      <li className="flex flex-wrap items-center gap-2 text-sm">
        <Pill tone={item.active ? 'good' : 'muted'}>{KIND_LABEL[item.kind]}</Pill>
        <span className="text-neutral-100">
          {item.parent_name ? `${item.parent_name} › ` : ''}
          {item.name}
          {item.position ? ` (#${item.position})` : ''}
          {item.field_type ? ` · ${item.field_type}` : ''}
        </span>
        {!item.active ? <span className="text-xs text-neutral-500">inactive</span> : null}
        {canManage ? (
          <button type="button" onClick={() => setEditing(true)} className="text-xs text-neutral-500 hover:text-white">
            Edit
          </button>
        ) : null}
      </li>
    );
  }
  return (
    <li className="mt-3 grid gap-2 rounded-xl bg-white/[0.03] p-3 sm:grid-cols-6">
      <label className="block sm:col-span-1">
        <span className={labelClass}>Kind</span>
        <select value={form.kind} disabled={item !== null} onChange={(e) => setForm({ ...form, kind: e.target.value })} className={selectClass}>
          {Object.entries(KIND_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label className="block sm:col-span-2">
        <span className={labelClass}>Name</span>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
      </label>
      {form.kind === 'stage' ? (
        <>
          <label className="block">
            <span className={labelClass}>Pipeline</span>
            <input value={form.parentName} onChange={(e) => setForm({ ...form, parentName: e.target.value })} className={inputClass} />
          </label>
          <label className="block">
            <span className={labelClass}>Position</span>
            <input type="number" min={1} value={form.position ?? ''} onChange={(e) => setForm({ ...form, position: e.target.value ? Number(e.target.value) : null })} className={inputClass} />
          </label>
        </>
      ) : null}
      {form.kind === 'custom_field' ? (
        <label className="block">
          <span className={labelClass}>Type</span>
          <input value={form.fieldType} placeholder="TEXT" onChange={(e) => setForm({ ...form, fieldType: e.target.value })} className={inputClass} />
        </label>
      ) : null}
      <label className="flex items-center gap-2 text-sm text-neutral-300">
        <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
        Active
      </label>
      <div className="flex items-end gap-2 sm:col-span-6">
        <button
          type="button"
          disabled={pending || !form.name}
          onClick={() =>
            run(
              () =>
                saveStandardItemAction({
                  id: item?.id ?? null,
                  kind: form.kind,
                  name: form.name,
                  parentName: form.kind === 'stage' ? form.parentName : null,
                  position: form.kind === 'stage' ? form.position : null,
                  fieldType: form.kind === 'custom_field' ? form.fieldType : null,
                  active: form.active,
                }),
              (result) => {
                if (result.ok && item) setEditing(false);
              },
            )
          }
          className={`${btnPrimary} ${btnSizeSm}`}
        >
          {item ? 'Save' : 'Add item'}
        </button>
        {item ? (
          <button type="button" onClick={() => setEditing(false)} className={`${btnSecondary} ${btnSizeSm}`}>
            Cancel
          </button>
        ) : null}
      </div>
      <div className="sm:col-span-6">
        <Feedback message={message} error={error} />
      </div>
    </li>
  );
}

function ProfileEditor({ profile, canManage }: { profile: Standard['profiles'][number]; canManage: boolean }) {
  const [flags, setFlags] = useState(profile.permissions);
  const { run, pending, message, error } = useAction();
  return (
    <Panel title={`${profile.label} permission profile`}>
      <p className="mb-3 text-xs text-neutral-500">
        Applied through the GHL Users API to every {profile.key === 'va' ? 'VA' : 'manager'} user (role &quot;{profile.ghl_role}&quot;, type &quot;{profile.ghl_type}&quot;).
      </p>
      <div className="grid gap-1.5 sm:grid-cols-3">
        {Object.keys(flags)
          .sort()
          .map((key) => (
            <label key={key} className="flex items-center gap-2 text-xs text-neutral-300">
              <input type="checkbox" disabled={!canManage} checked={flags[key]} onChange={(e) => setFlags({ ...flags, [key]: e.target.checked })} />
              {key}
            </label>
          ))}
      </div>
      {profile.verify_manually.length ? (
        <div className="mt-3 text-xs text-amber-300">
          <p className="font-semibold">The API has no field for these. Verify by hand in GHL:</p>
          <ul className="list-disc pl-5">
            {profile.verify_manually.map((v) => (
              <li key={v}>{v}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {canManage ? (
        <button type="button" disabled={pending} onClick={() => run(() => saveProfileAction(profile.key, flags))} className={`${btnPrimary} ${btnSizeSm} mt-3`}>
          Save profile
        </button>
      ) : null}
      <Feedback message={message} error={error} />
    </Panel>
  );
}
