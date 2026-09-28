'use client';

import { useEffect, useMemo, useState } from 'react';
import { btnPrimary, btnSecondary, btnSizeSm } from '@/app/components/ui';
import { correctReportAction, prefillAction, submitReportAction, type ReportInput } from '@/lib/portal/actions';
import { attendance } from '@/lib/portal/labels';
import { formatDate, formatDateTime } from '@/lib/portal/time';
import type { ConfiguredField, Prefill, ReportRow, ReportsData } from '@/lib/portal/types';
import { Badge, inputClass, labelClass, selectClass } from '../../components/ui';
import { Card, CardTitle, Empty, Feedback, Sheet, useAction, usePortal, VaButton, VaFieldset } from './portal';

/** Section 5.4: a report for every shift. Filed once; changes are new versions with a reason. */
export default function ReportsView({ data, initialDate }: { data: ReportsData; initialDate: string | null }) {
  const [formDate, setFormDate] = useState<string | null>(initialDate ?? (data.due[0] ?? null));
  const [correcting, setCorrecting] = useState<ReportRow | null>(null);
  const current = data.reports.filter((r) => r.current);
  const history = (id: string) => {
    const chain: ReportRow[] = [];
    let row = data.reports.find((r) => r.id === id);
    while (row?.supersedes_id) {
      row = data.reports.find((r) => r.id === row!.supersedes_id);
      if (row) chain.push(row);
    }
    return chain;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Shift Reports</h1>
        <VaButton type="button" onClick={() => setFormDate(data.today)} className={`${btnPrimary} ${btnSizeSm}`}>
          File a report
        </VaButton>
      </div>

      {data.due.length > 0 ? (
        <Card className="border border-flag-warning/40">
          <CardTitle>Reports due</CardTitle>
          <div className="flex flex-wrap gap-2">
            {data.due.map((day) => (
              <button key={day} type="button" onClick={() => setFormDate(day)} className="rounded-full bg-flag-warning/[0.12] px-3 py-1.5 text-xs text-flag-warning">
                {formatDate(day)}
              </button>
            ))}
          </div>
        </Card>
      ) : null}

      <Card>
        <CardTitle>Filed reports</CardTitle>
        {current.length === 0 ? <Empty>No reports yet.</Empty> : null}
        <ul className="divide-y divide-white/[0.05]">
          {current.map((report) => (
            <li key={report.id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white">{formatDate(report.shift_date, true)}</p>
                  <p className="text-xs text-neutral-500">
                    {report.shift_start_actual}–{report.shift_end_actual} · {report.conversations_handled} conversations ·{' '}
                    {report.appointments_booked} booked · {report.follow_ups_completed} follow-ups · {report.escalations_raised} escalations
                  </p>
                  {report.variance_explanation ? (
                    <p className="mt-1 text-xs text-neutral-400">Your note on the numbers: {report.variance_explanation}</p>
                  ) : null}
                </div>
                {report.version > 1 ? <Badge tone="brand">Version {report.version}</Badge> : null}
              </div>
              {report.comments.map((comment, index) => (
                <p key={index} className="mt-2 rounded-xl bg-white/[0.03] px-3 py-2 text-xs text-neutral-300">
                  <span className="text-neutral-500">{comment.author}: </span>
                  {comment.body}
                </p>
              ))}
              {history(report.id).map((old) => (
                <p key={old.id} className="mt-1.5 text-xs text-neutral-500">
                  Version {old.version} (superseded): {old.conversations_handled} conversations, {old.appointments_booked} booked
                </p>
              ))}
              {report.correction_reason ? <p className="mt-1 text-xs text-neutral-400">Corrected because: {report.correction_reason}</p> : null}
              <div className="mt-2">
                {report.correctable ? (
                  <VaButton type="button" onClick={() => setCorrecting(report)} className={`${btnSecondary} px-3 py-1.5 text-xs`}>
                    Correct it
                  </VaButton>
                ) : (
                  <span className="text-[11px] text-neutral-600">The pay period is closed: a manager or admin makes corrections now.</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardTitle>Attendance</CardTitle>
        <ul className="divide-y divide-white/[0.05]">
          {data.attendance.map((row) => {
            const label = attendance(row.status);
            return (
              <li key={row.shift_date} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="text-neutral-200">{formatDate(row.shift_date)}</p>
                  <p className="text-xs text-neutral-500">
                    {label.detail}
                    {row.late_notice ? ' (late notice)' : ''}
                    {row.reason && ['abandoned', 'excused_emergency', 'notified_absence'].includes(row.status) ? `. ${row.reason}` : ''}
                    {row.decided_by ? ` · ${row.decided_by}` : ''}
                  </p>
                </div>
                <Badge tone={label.tone}>{label.label}</Badge>
              </li>
            );
          })}
          {data.attendance.length === 0 ? <li className="py-3 text-sm text-neutral-500">No scheduled shifts yet.</li> : null}
        </ul>
      </Card>

      <Sheet open={formDate !== null} onClose={() => setFormDate(null)} title="Shift report" wide>
        {formDate ? <ReportForm data={data} initialDate={formDate} onDone={() => setFormDate(null)} /> : null}
      </Sheet>
      <Sheet open={correcting !== null} onClose={() => setCorrecting(null)} title="Correct a report" wide>
        {correcting ? <ReportForm data={data} initialDate={correcting.shift_date} original={correcting} onDone={() => setCorrecting(null)} /> : null}
      </Sheet>
    </div>
  );
}

function ReportForm({
  data,
  initialDate,
  original,
  onDone,
}: {
  data: ReportsData;
  initialDate: string;
  original?: ReportRow;
  onDone: () => void;
}) {
  const { placementId, operatorZone } = usePortal();
  const action = useAction();
  const [date, setDate] = useState(initialDate);
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const [values, setValues] = useState<ReportInput>(() => ({
    start: original?.shift_start_actual ?? data.shift_start?.slice(0, 5) ?? '09:00',
    end: original?.shift_end_actual ?? data.shift_end?.slice(0, 5) ?? '17:00',
    conversations: original?.conversations_handled ?? 0,
    appointments: original?.appointments_booked ?? 0,
    followUps: original?.follow_ups_completed ?? 0,
    escalations: original?.escalations_raised ?? 0,
    blockers: original?.blockers ?? '',
    notes: original?.notes ?? '',
    configured: original?.configured ?? {},
    varianceExplanation: original?.variance_explanation ?? '',
  }));
  const [reason, setReason] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await prefillAction(placementId ?? data.placement_id, date);
      if (cancelled || !result.ok || !result.data) return;
      setPrefill(result.data);
      if (!original) {
        setValues((v) => ({ ...v, appointments: result.data!.appointments_booked, escalations: result.data!.escalations_raised }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [date, placementId, data.placement_id, original]);

  const differs = useMemo(
    () => prefill !== null && (values.appointments !== prefill.appointments_booked || values.escalations !== prefill.escalations_raised),
    [prefill, values.appointments, values.escalations],
  );

  const set = (patch: Partial<ReportInput>) => setValues((v) => ({ ...v, ...patch }));
  const num = (value: string) => Math.max(0, Number.parseInt(value || '0', 10) || 0);

  return (
    <VaFieldset>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className={labelClass}>Shift date</span>
          <input
            type="date"
            value={date}
            max={data.today}
            min={data.start_date}
            disabled={Boolean(original)}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Started</span>
          <input type="time" value={values.start} onChange={(e) => set({ start: e.target.value })} className={inputClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Finished</span>
          <input type="time" value={values.end} onChange={(e) => set({ end: e.target.value })} className={inputClass} />
        </label>
      </div>
      {prefill?.starts_at ? (
        <p className="mt-1 text-[11px] text-neutral-500">
          Scheduled {formatDateTime(prefill.starts_at, operatorZone)} to {formatDateTime(prefill.ends_at!, operatorZone)} your time. Times above are in the
          client&apos;s time zone ({data.time_zone}).
        </p>
      ) : null}
      {prefill?.has_report && !original ? (
        <p className="mt-2 text-sm text-flag-warning">There is already a report for this shift. Correct it instead.</p>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <NumberField label="Conversations" value={values.conversations} onChange={(v) => set({ conversations: num(v) })} />
        <NumberField
          label="Appointments booked"
          value={values.appointments}
          hint={prefill ? `System: ${prefill.appointments_booked}` : undefined}
          onChange={(v) => set({ appointments: num(v) })}
        />
        <NumberField label="Follow-ups done" value={values.followUps} onChange={(v) => set({ followUps: num(v) })} />
        <NumberField
          label="Escalations raised"
          value={values.escalations}
          hint={prefill ? `System: ${prefill.escalations_raised}` : undefined}
          onChange={(v) => set({ escalations: num(v) })}
        />
      </div>

      {differs ? (
        <label className="mt-3 block">
          <span className={labelClass}>Your numbers differ from what the system recorded. Why?</span>
          <textarea value={values.varianceExplanation} onChange={(e) => set({ varianceExplanation: e.target.value })} rows={2} className={inputClass} />
        </label>
      ) : null}

      {data.configured_fields.map((field) => (
        <ConfiguredInput
          key={field.key}
          field={field}
          value={values.configured[field.key]}
          onChange={(value) => set({ configured: { ...values.configured, [field.key]: value } })}
        />
      ))}

      <label className="mt-3 block">
        <span className={labelClass}>Blockers</span>
        <textarea value={values.blockers} onChange={(e) => set({ blockers: e.target.value })} rows={2} className={inputClass} />
      </label>
      <label className="mt-3 block">
        <span className={labelClass}>Notes</span>
        <textarea value={values.notes} onChange={(e) => set({ notes: e.target.value })} rows={2} className={inputClass} />
      </label>

      {original ? (
        <label className="mt-3 block">
          <span className={labelClass}>Why are you correcting it?</span>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className={inputClass} />
          <span className="mt-1 block text-[11px] text-neutral-500">The original stays on record, marked as superseded.</span>
        </label>
      ) : null}

      <button
        type="button"
        disabled={action.pending || (differs && values.varianceExplanation.trim().length < 5) || (original ? reason.trim().length < 5 : Boolean(prefill?.has_report))}
        onClick={() =>
          action.run(
            () =>
              original
                ? correctReportAction(original.id, values, reason)
                : submitReportAction(placementId ?? data.placement_id, date, values),
            (result) => result.ok && onDone(),
          )
        }
        className={`${btnPrimary} ${btnSizeSm} mt-4`}
      >
        {original ? 'File the correction' : 'File the report'}
      </button>
      <Feedback message={action.message} error={action.error} />
    </VaFieldset>
  );
}

function NumberField({ label, value, hint, onChange }: { label: string; value: number; hint?: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <input type="number" min={0} inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} />
      {hint ? <span className="mt-1 block text-[11px] text-neutral-500">{hint}</span> : null}
    </label>
  );
}

function ConfiguredInput({ field, value, onChange }: { field: ConfiguredField; value: unknown; onChange: (value: unknown) => void }) {
  const label = `${field.label}${field.required ? '' : ' (optional)'}`;
  if (field.type === 'boolean') {
    return (
      <label className="mt-3 flex items-center gap-2 text-sm text-neutral-300">
        <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
        {label}
      </label>
    );
  }
  if (field.options && field.options.length) {
    return (
      <label className="mt-3 block">
        <span className={labelClass}>{label}</span>
        <select value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} className={selectClass}>
          <option value="">Choose</option>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <label className="mt-3 block">
      <span className={labelClass}>{label}</span>
      <input
        type={field.type === 'number' || field.type === 'integer' ? 'number' : 'text'}
        value={String(value ?? '')}
        onChange={(e) => onChange(field.type === 'number' || field.type === 'integer' ? Number(e.target.value) : e.target.value)}
        className={inputClass}
      />
      {field.help ? <span className="mt-1 block text-[11px] text-neutral-500">{field.help}</span> : null}
    </label>
  );
}
