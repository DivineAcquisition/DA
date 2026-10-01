'use client';

import { useState } from 'react';
import { btnPrimary, btnSecondary, btnSizeSm } from '@/app/components/ui';
import { saveCommitmentAction, saveTeamSettingAction, saveTemplateAction, saveTierCriterionAction } from '@/lib/team/actions';
import type { AccountabilitySettings } from '@/lib/team/types';
import { Surface } from '@/components/ui/surface';
import { inputClass, labelClass, selectClass } from '../components/ui';
import { Feedback, useAction } from '../operator/components/portal';

const KINDS: Record<string, string> = {
  months_placed: 'Months placed',
  standards_met_months: 'Months in a row with every standard met',
  zero_abandonments_days: 'Days with no abandoned shift',
  training_complete: 'All assigned training complete (1 = yes)',
};

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Surface as="section" className="p-4 sm:p-5">
      <h2 className="mb-3 text-sm font-semibold text-white">{title}</h2>
      {children}
    </Surface>
  );
}

/** Admin-configurable: sending, DA's targets, tier criteria, and every message template. */
export default function SettingsView({ data }: { data: AccountabilitySettings }) {
  const edit = data.can_edit;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-white">Accountability settings</h1>
        {!edit ? <p className="mt-1 text-sm text-neutral-500">Read-only: only an owner or admin changes these.</p> : null}
      </div>
      <TeamPanel data={data} edit={edit} />
      <Panel title="DA's commitments">
        <ul className="space-y-2">
          {data.commitments.map((c) => (
            <CommitmentRow key={c.key} c={c} edit={edit} />
          ))}
        </ul>
      </Panel>
      <Panel title="Tier criteria">
        {[2, 3].map((tier) => (
          <div key={tier} className="mb-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400">Tier {tier}</h3>
            <ul className="space-y-2">
              {data.tier_criteria
                .filter((c) => c.tier === tier)
                .map((c) => (
                  <CriterionRow key={c.id} c={c} edit={edit} />
                ))}
              {edit ? <CriterionRow c={{ id: '', tier, kind: 'months_placed', threshold: 1, label: '', sort_order: 100 }} edit isNew /> : null}
            </ul>
          </div>
        ))}
      </Panel>
      <Panel title="Message templates">
        <p className="mb-3 text-xs text-neutral-500">
          Each message states the fact, the standard, the next step, and who owns it by when. Words in double braces are filled in
          from the record. Never add customer names, phone numbers or emails.
        </p>
        <ul className="space-y-3">
          {data.templates.map((t) => (
            <TemplateRow key={t.key} t={t} edit={edit} />
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function TeamPanel({ data, edit }: { data: AccountabilitySettings; edit: boolean }) {
  const [replyTo, setReplyTo] = useState(data.team.reply_to ?? '');
  const [fromName, setFromName] = useState(data.team.from_name);
  const [months, setMonths] = useState(String(data.team.inactive_access_months));
  const action = useAction();
  return (
    <Panel title="Sending and access">
      <p className="mb-3 text-xs text-neutral-500">
        Email goes from {data.team.from_address}. Links point to {data.team.base_url}.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label>
          <span className={labelClass}>From name</span>
          <input value={fromName} onChange={(e) => setFromName(e.target.value)} disabled={!edit} className={inputClass} />
        </label>
        <label>
          <span className={labelClass}>Reply-to (monitored)</span>
          <input value={replyTo} onChange={(e) => setReplyTo(e.target.value)} disabled={!edit} className={inputClass} placeholder="team@divineacquisition.io" />
        </label>
        <label>
          <span className={labelClass}>Months inactive VAs keep pay and agreements</span>
          <input value={months} onChange={(e) => setMonths(e.target.value)} disabled={!edit} inputMode="numeric" className={inputClass} />
        </label>
      </div>
      {edit ? (
        <button
          type="button"
          onClick={() => action.run(() => saveTeamSettingAction({ replyTo, fromName, inactiveMonths: months ? Number(months) : null }))}
          className={`${btnPrimary} ${btnSizeSm} mt-3`}
        >
          Save
        </button>
      ) : null}
      {!data.team.reply_to ? <p className="mt-2 text-xs text-flag-warning">Set a monitored reply-to address before emails go out.</p> : null}
      <Feedback message={action.message} error={action.error} />
    </Panel>
  );
}

function CommitmentRow({ c, edit }: { c: AccountabilitySettings['commitments'][number]; edit: boolean }) {
  const [label, setLabel] = useState(c.target_label);
  const [value, setValue] = useState(c.target_value === null ? '' : String(c.target_value));
  const action = useAction();
  const hasValue = ['pay_on_schedule', 'pay_questions'].includes(c.key);
  return (
    <li className="rounded-xl bg-white/[0.03] p-3">
      <p className="text-sm text-neutral-200">{c.label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <input value={label} onChange={(e) => setLabel(e.target.value)} disabled={!edit} className={`${inputClass} min-w-0 flex-1`} />
        {hasValue ? (
          <input value={value} onChange={(e) => setValue(e.target.value)} disabled={!edit} inputMode="numeric" className={`${inputClass} w-24`} aria-label="Target" />
        ) : null}
        {edit ? (
          <button type="button" onClick={() => action.run(() => saveCommitmentAction(c.key, value === '' ? null : Number(value), label))} className={`${btnSecondary} ${btnSizeSm}`}>
            Save
          </button>
        ) : null}
      </div>
      <Feedback message={action.message} error={action.error} />
    </li>
  );
}

function CriterionRow({ c, edit, isNew = false }: { c: AccountabilitySettings['tier_criteria'][number]; edit: boolean; isNew?: boolean }) {
  const [kind, setKind] = useState(c.kind);
  const [threshold, setThreshold] = useState(String(c.threshold));
  const [label, setLabel] = useState(c.label);
  const action = useAction();
  return (
    <li className="rounded-xl bg-white/[0.03] p-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_6rem_1fr_auto]">
        <select value={kind} onChange={(e) => setKind(e.target.value)} disabled={!edit} className={selectClass}>
          {Object.entries(KINDS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <input value={threshold} onChange={(e) => setThreshold(e.target.value)} disabled={!edit} inputMode="numeric" className={inputClass} aria-label="Threshold" />
        <input value={label} onChange={(e) => setLabel(e.target.value)} disabled={!edit} className={inputClass} placeholder="What the VA reads" />
        {edit ? (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => action.run(() => saveTierCriterionAction({ id: isNew ? null : c.id, tier: c.tier, kind, threshold: Number(threshold), label }))}
              className={`${btnSecondary} ${btnSizeSm}`}
            >
              {isNew ? 'Add' : 'Save'}
            </button>
            {!isNew ? (
              <button
                type="button"
                onClick={() => action.run(() => saveTierCriterionAction({ id: c.id, tier: c.tier, kind, threshold: 0, label: '', remove: true }))}
                className="px-2 text-neutral-500 hover:text-white"
                aria-label="Remove"
              >
                ×
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <Feedback message={action.message} error={action.error} />
    </li>
  );
}

function TemplateRow({ t, edit }: { t: AccountabilitySettings['templates'][number]; edit: boolean }) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState(t.subject);
  const [body, setBody] = useState(t.body);
  const action = useAction();
  return (
    <li className="rounded-xl bg-white/[0.03] p-3">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-2 text-left">
        <span className="text-sm text-neutral-200">{t.label}</span>
        <span className="text-[11px] text-neutral-500">
          {t.formal ? 'Admin only' : t.urgency === 'immediate' ? 'Immediate' : 'Daily digest'} · {t.required ? 'Required' : 'Optional'}
        </span>
      </button>
      {open ? (
        <div className="mt-2 space-y-2">
          <input value={subject} onChange={(e) => setSubject(e.target.value)} disabled={!edit} className={inputClass} />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} disabled={!edit} rows={6} className={inputClass} />
          {edit ? (
            <button type="button" onClick={() => action.run(() => saveTemplateAction(t.key, subject, body))} className={`${btnSecondary} ${btnSizeSm}`}>
              Save template
            </button>
          ) : null}
        </div>
      ) : null}
      <Feedback message={action.message} error={action.error} />
    </li>
  );
}
