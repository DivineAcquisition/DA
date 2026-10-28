'use client';

import { useState } from 'react';
import { saveWorkspaceSettingsAction } from '@/lib/workspace/sales-ops-actions';
import type { WorkspaceSettings } from '@/lib/workspace/sales-ops-queries';
import { Card, Field, Input, Select, Toggle } from '../../components/ui';
import ActionForm from './ActionForm';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4 rounded-xl border border-white/[0.06] bg-ink-850/60 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-300">{title}</p>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{children}</div>
    </div>
  );
}

function Num({ name, value, label, hint, step }: { name: string; value: number | null; label: string; hint?: string; step?: string }) {
  return (
    <Field label={label} hint={hint}>
      <Input name={name} type="number" min={0} step={step ?? '1'} defaultValue={value ?? ''} />
    </Field>
  );
}

export default function WorkspaceSettingsForm({ settings: s }: { settings: WorkspaceSettings }) {
  const [missedRule, setMissedRule] = useState(s.eod_missed_rule);
  const [editRule, setEditRule] = useState(s.eod_edit_rule);

  return (
    <Card className="p-5 sm:p-7">
      <ActionForm action={saveWorkspaceSettingsAction} submitLabel="Save settings">
        <Section title="Data mismatch tolerance">
          <Num name="mismatch_tolerance_pct" value={s.mismatch_tolerance_pct} label="Tolerance (%)" step="0.1" />
          <Num name="mismatch_small_count_under" value={s.mismatch_small_count_under} label="Small count is under" />
          <Num
            name="mismatch_small_count_gap"
            value={s.mismatch_small_count_gap}
            label="Allowed gap on small counts"
            step="0.1"
            hint="The larger of the two tolerances applies."
          />
        </Section>

        <Section title="EOD timing">
          <Num name="eod_reminder_minutes_before" value={s.eod_reminder_minutes_before} label="Reminder, minutes before deadline" />
          <Num name="eod_late_minutes_after" value={s.eod_late_minutes_after} label="Late, minutes after deadline" hint="0 means late at the deadline." />
          <Num name="eod_manager_alert_minutes_after" value={s.eod_manager_alert_minutes_after} label="Manager alert, minutes after deadline" />
          <Field label="Marked Missed">
            <Select name="eod_missed_rule" value={missedRule} onChange={(e) => setMissedRule(e.target.value as typeof missedRule)}>
              <option value="next_shift_start">At the start of the next shift</option>
              <option value="hours_after_deadline">A set number of hours after the deadline</option>
            </Select>
          </Field>
          {missedRule === 'hours_after_deadline' ? (
            <Num name="eod_missed_hours_after" value={s.eod_missed_hours_after} label="Hours after deadline" />
          ) : (
            <input type="hidden" name="eod_missed_hours_after" value={s.eod_missed_hours_after ?? ''} />
          )}
        </Section>

        <Section title="EOD edits and fields">
          <Field label="Operator can edit a submitted EOD">
            <Select name="eod_edit_rule" value={editRule} onChange={(e) => setEditRule(e.target.value as typeof editRule)}>
              <option value="until_next_shift">Until the next shift starts</option>
              <option value="hours_after_submit">For a set number of hours after submitting</option>
              <option value="never">Never</option>
            </Select>
          </Field>
          {editRule === 'hours_after_submit' ? (
            <Num name="eod_edit_hours_after" value={s.eod_edit_hours_after} label="Hours after submitting" />
          ) : (
            <input type="hidden" name="eod_edit_hours_after" value={s.eod_edit_hours_after ?? ''} />
          )}
          <div className="space-y-3 md:col-span-2 lg:col-span-3">
            <Toggle name="eod_hours_worked_enabled" label="Hours worked field" defaultChecked={s.eod_hours_worked_enabled} />
            <Toggle name="eod_note_to_manager_enabled" label="Note to manager field" defaultChecked={s.eod_note_to_manager_enabled} />
          </div>
        </Section>

        <Section title="Certification">
          <Num
            name="cert_warning_days"
            value={s.cert_warning_days}
            label="Warn this many days before re-certification"
            hint="The operator sees the date and a link to the Academy."
          />
          <Num
            name="cert_grace_days"
            value={s.cert_grace_days}
            label="Grace days after the re-certify date"
            hint="Workspace access stays open through these days."
          />
        </Section>

        <Section title="Clients and targets">
          <Num name="client_feedback_token_days" value={s.client_feedback_token_days} label="Client feedback link expires after (days)" />
          <Num
            name="speed_to_lead_target_seconds"
            value={s.speed_to_lead_target_seconds}
            label="Speed-to-lead target (seconds)"
            hint="Blank until set."
          />
          <div />
          <Num
            name="target_override_min_pct"
            value={s.target_override_min_pct}
            label="Manager override floor (% of default)"
            hint="Blank means no limit."
          />
          <Num
            name="target_override_max_pct"
            value={s.target_override_max_pct}
            label="Manager override ceiling (% of default)"
            hint="Blank means no limit."
          />
        </Section>
      </ActionForm>
    </Card>
  );
}
