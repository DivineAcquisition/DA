'use client';

import Link from 'next/link';
import { useState } from 'react';
import { btnPrimary, btnSecondary, btnSizeMd, btnSizeSm } from '@/app/components/ui';
import { addDays, eachDay } from '@/lib/vistrial/dates';
import { formatDateTime, formatDay } from '@/lib/vistrial/format';
import { EOD_CORE_FIELDS } from '@/lib/vistrial/industries';
import { emptyCore, validateEod, type EodDraft } from '@/lib/vistrial/rules/eod';
import { useOps } from '@/lib/vistrial/store';
import type { EodConfiguredField, EodCore } from '@/lib/vistrial/types';
import {
  Badge,
  EmptyState,
  PageHeader,
  Panel,
  SectionHeader,
  inputClass,
  labelClass,
  selectClass,
} from '../../components/ui';
import BenchState from '../components/BenchState';
import PlacementSwitcher from '../components/PlacementSwitcher';

export default function EodPage() {
  const { gateway, activePlacement } = useOps();

  if (gateway.isAdmin) {
    return (
      <EmptyState
        title="Operator surface"
        detail="EODs are filed by operators. Switch to an operator workspace to see the form."
        action={
          <Link href="/vistrial/admin" className={`${btnSecondary} ${btnSizeSm}`}>
            Back to the admin view
          </Link>
        }
      />
    );
  }

  if (!activePlacement) return <BenchState />;
  return <EodSurface />;
}

function EodSurface() {
  const { gateway, actor, activePlacement, submitEod, correctEod } = useOps();
  const placement = activePlacement!;
  const client = gateway.client(placement.clientId)!;
  const config = client.config;

  const today = gateway.today;
  const filed = gateway.currentReportsFor(placement.id);
  const filedDates = new Set(filed.map((report) => report.shiftDate));

  // Any shift day up to today without a report is still fileable.
  const owed = eachDay(
    Date.parse(placement.startDate) > Date.parse(addDays(today, -10))
      ? placement.startDate
      : addDays(today, -10),
    today,
  ).filter((day) => !filedDates.has(day));

  const [shiftDate, setShiftDate] = useState(owed[owed.length - 1] ?? today);
  const [core, setCore] = useState<EodCore>(() => emptyCore(config));
  const [configured, setConfigured] = useState<Record<string, string | number | boolean>>({});
  const [issues, setIssues] = useState<{ field: string; message: string }[]>([]);
  const [justFiled, setJustFiled] = useState<string | null>(null);

  const [correcting, setCorrecting] = useState<string | null>(null);
  const [correctionReason, setCorrectionReason] = useState('');
  const [correctionCore, setCorrectionCore] = useState<EodCore | null>(null);

  const draft: EodDraft = {
    placementId: placement.id,
    operatorId: actor.id,
    shiftDate,
    core,
    configured,
  };

  const submit = () => {
    const found = validateEod(draft, config);
    setIssues(found);
    if (found.length > 0) return;
    submitEod(draft);
    setJustFiled(shiftDate);
    setCore(emptyCore(config));
    setConfigured({});
    setShiftDate(today);
  };

  const issueFor = (field: string) => issues.find((issue) => issue.field === field)?.message;

  return (
    <div>
      <PlacementSwitcher />

      <PageHeader
        eyebrow={client.name}
        title="End of day"
        description="One report per shift. The core block is the same for every client so your numbers stay comparable; the block below it is specific to this placement."
      />

      {justFiled && (
        <Panel className="mb-6 border-flag-good/25 bg-flag-good/[0.06] p-5">
          <Badge tone="good">Filed</Badge>
          <p className="mt-2 text-sm text-white">
            Your report for {formatDay(justFiled)} is on file. Submitted reports are immutable — if you need to
            change it, file a correction and both versions stay visible.
          </p>
        </Panel>
      )}

      {owed.length > 1 && (
        <Panel className="mb-6 border-flag-warning/25 bg-flag-warning/[0.06] p-5">
          <Badge tone="warning">{owed.length} reports outstanding</Badge>
          <p className="mt-2 text-sm leading-relaxed text-white">
            {owed.map(formatDay).join(', ')} have no report yet. Submission rate is tracked as a standing
            metric, so backfill them.
          </p>
        </Panel>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="space-y-6"
      >
        <Panel className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-white">Core</h2>
              <p className="mt-1 text-xs text-neutral-500">Identical for every client and industry.</p>
            </div>
            <Badge tone="neutral">Locked</Badge>
          </div>

          <div className="mb-5">
            <label className={labelClass} htmlFor="shiftDate">
              Shift date
            </label>
            <select
              id="shiftDate"
              value={shiftDate}
              onChange={(event) => setShiftDate(event.target.value)}
              className={selectClass}
            >
              {(owed.includes(shiftDate) ? owed : [shiftDate, ...owed]).map((day) => (
                <option key={day} value={day}>
                  {formatDay(day)}
                  {day === today ? ' — today' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TimeField
              label="Shift start (actual)"
              value={core.shiftStartActual}
              onChange={(value) => setCore({ ...core, shiftStartActual: value })}
              error={issueFor('shiftStartActual')}
            />
            <TimeField
              label="Shift end (actual)"
              value={core.shiftEndActual}
              onChange={(value) => setCore({ ...core, shiftEndActual: value })}
              error={issueFor('shiftEndActual')}
            />
            <NumberField
              label="Leads / conversations handled"
              value={core.conversationsHandled}
              onChange={(value) => setCore({ ...core, conversationsHandled: value })}
              error={issueFor('conversationsHandled')}
            />
            <NumberField
              label="Appointments booked"
              value={core.appointmentsBooked}
              onChange={(value) => setCore({ ...core, appointmentsBooked: value })}
              error={issueFor('appointmentsBooked')}
            />
            <NumberField
              label="Follow-ups completed"
              value={core.followUpsCompleted}
              onChange={(value) => setCore({ ...core, followUpsCompleted: value })}
              error={issueFor('followUpsCompleted')}
            />
            <NumberField
              label="Escalations raised"
              value={core.escalationsRaised}
              onChange={(value) => setCore({ ...core, escalationsRaised: value })}
              error={issueFor('escalationsRaised')}
            />
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <label className={labelClass} htmlFor="blockers">
                Blockers
              </label>
              <textarea
                id="blockers"
                rows={2}
                value={core.blockers}
                onChange={(event) => setCore({ ...core, blockers: event.target.value })}
                className={`${inputClass} resize-none`}
                placeholder="Anything that stopped you from working. Leave empty if nothing did."
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="notes">
                Notes
              </label>
              <textarea
                id="notes"
                rows={3}
                value={core.notes}
                onChange={(event) => setCore({ ...core, notes: event.target.value })}
                className={`${inputClass} resize-none`}
                placeholder="Anything the admin should know."
              />
            </div>
          </div>
        </Panel>

        {config.configuredFields.length > 0 && (
          <Panel className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-white">{client.name} fields</h2>
                <p className="mt-1 text-xs text-neutral-500">
                  Configured for this placement from the {client.config.industry.replace('-', ' ')} template.
                </p>
              </div>
              <Badge tone="brand">Per client</Badge>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {config.configuredFields.map((field) => (
                <ConfiguredField
                  key={field.key}
                  field={field}
                  value={configured[field.key]}
                  onChange={(value) => setConfigured({ ...configured, [field.key]: value })}
                  error={issueFor(field.key)}
                />
              ))}
            </div>
          </Panel>
        )}

        {issues.length > 0 && (
          <Panel className="border-flag-critical/25 bg-flag-critical/[0.06] p-5">
            <Badge tone="critical">Not submitted</Badge>
            <ul className="mt-2.5 space-y-1 text-sm text-flag-critical">
              {issues.map((issue) => (
                <li key={issue.field}>{issue.message}</li>
              ))}
            </ul>
          </Panel>
        )}

        <button type="submit" className={`${btnPrimary} ${btnSizeMd} w-full sm:w-auto`}>
          Submit report for {formatDay(shiftDate)}
        </button>
      </form>

      {/* Filed reports */}
      <section className="mt-10">
        <SectionHeader
          title="Your filed reports"
          hint="Immutable once submitted. Corrections create a new version and both stay visible."
        />
        {filed.length === 0 ? (
          <EmptyState title="Nothing filed yet" />
        ) : (
          <ul className="space-y-2.5">
            {[...filed]
              .sort((a, b) => Date.parse(b.shiftDate) - Date.parse(a.shiftDate))
              .slice(0, 12)
              .map((report) => {
                const versions = gateway.reportVersions(placement.id, report.shiftDate);
                const isCorrecting = correcting === report.id;

                return (
                  <li key={report.id}>
                    <Panel className="px-5 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-white">{formatDay(report.shiftDate)}</p>
                          {report.version > 1 && <Badge tone="brand">v{report.version}</Badge>}
                          {versions.length > 1 && (
                            <span className="text-[11px] text-neutral-600">
                              {versions.length} versions on file
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] tabular-nums text-neutral-600">
                          {formatDateTime(report.submittedAt)}
                        </span>
                      </div>

                      <p className="mt-2 text-[13px] text-neutral-400">
                        {report.core.conversationsHandled} conversations · {report.core.appointmentsBooked} booked
                        · {report.core.followUpsCompleted} follow-ups
                        {report.core.escalationsRaised > 0 && ` · ${report.core.escalationsRaised} escalated`}
                      </p>

                      {report.core.blockers && (
                        <p className="mt-1.5 text-[13px] leading-relaxed text-flag-warning">
                          Blocker: {report.core.blockers}
                        </p>
                      )}

                      {report.adminComments.length > 0 && (
                        <ul className="mt-3 space-y-2">
                          {report.adminComments.map((comment) => (
                            <li key={comment.id} className="rounded-xl bg-white/[0.03] px-3.5 py-2.5">
                              <p className="text-xs font-semibold text-brand-300">{comment.authorName}</p>
                              <p className="mt-1 text-[13px] leading-relaxed text-neutral-300">{comment.body}</p>
                            </li>
                          ))}
                        </ul>
                      )}

                      {isCorrecting && correctionCore ? (
                        <div className="mt-4 space-y-3 border-t border-white/[0.06] pt-4">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <NumberField
                              label="Conversations handled"
                              value={correctionCore.conversationsHandled}
                              onChange={(value) =>
                                setCorrectionCore({ ...correctionCore, conversationsHandled: value })
                              }
                            />
                            <NumberField
                              label="Appointments booked"
                              value={correctionCore.appointmentsBooked}
                              onChange={(value) =>
                                setCorrectionCore({ ...correctionCore, appointmentsBooked: value })
                              }
                            />
                            <NumberField
                              label="Follow-ups completed"
                              value={correctionCore.followUpsCompleted}
                              onChange={(value) =>
                                setCorrectionCore({ ...correctionCore, followUpsCompleted: value })
                              }
                            />
                            <NumberField
                              label="Escalations raised"
                              value={correctionCore.escalationsRaised}
                              onChange={(value) =>
                                setCorrectionCore({ ...correctionCore, escalationsRaised: value })
                              }
                            />
                          </div>
                          <div>
                            <label className={labelClass} htmlFor={`reason-${report.id}`}>
                              Why the correction
                            </label>
                            <textarea
                              id={`reason-${report.id}`}
                              rows={2}
                              value={correctionReason}
                              onChange={(event) => setCorrectionReason(event.target.value)}
                              className={`${inputClass} resize-none`}
                              placeholder="This is recorded alongside both versions."
                            />
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={!correctionReason.trim()}
                              onClick={() => {
                                correctEod(
                                  report.id,
                                  {
                                    placementId: placement.id,
                                    operatorId: actor.id,
                                    shiftDate: report.shiftDate,
                                    core: correctionCore,
                                    configured: report.configured,
                                  },
                                  correctionReason.trim(),
                                );
                                setCorrecting(null);
                                setCorrectionReason('');
                                setCorrectionCore(null);
                              }}
                              className={`${btnPrimary} ${btnSizeSm}`}
                            >
                              File correction
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setCorrecting(null);
                                setCorrectionCore(null);
                              }}
                              className={`${btnSecondary} ${btnSizeSm}`}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setCorrecting(report.id);
                            setCorrectionCore({ ...report.core });
                            setCorrectionReason('');
                          }}
                          className="mt-3 text-xs font-semibold text-brand-300 transition-colors hover:text-brand-200"
                        >
                          File a correction
                        </button>
                      )}
                    </Panel>
                  </li>
                );
              })}
          </ul>
        )}
      </section>

      <Panel className="mt-6 p-5">
        <h2 className="text-sm font-semibold text-white">Why the core never changes</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-neutral-400">
          Every operator across every client answers the same {EOD_CORE_FIELDS.length} core questions. That is
          what makes it possible to compare a med spa placement against a cleaning placement, and what makes
          the case file usable as evidence if a client ever disputes what was delivered.
        </p>
      </Panel>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  error?: string;
}) {
  const id = label.toLowerCase().replace(/[^a-z]+/g, '-');
  return (
    <div>
      <label className={labelClass} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        min={0}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className={`${inputClass} ${error ? 'border-flag-critical/50' : ''}`}
      />
      {error && <p className="mt-1 text-xs text-flag-critical">{error}</p>}
    </div>
  );
}

function TimeField({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const id = label.toLowerCase().replace(/[^a-z]+/g, '-');
  return (
    <div>
      <label className={labelClass} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="time"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${inputClass} ${error ? 'border-flag-critical/50' : ''}`}
      />
      {error && <p className="mt-1 text-xs text-flag-critical">{error}</p>}
    </div>
  );
}

function ConfiguredField({
  field,
  value,
  onChange,
  error,
}: {
  field: EodConfiguredField;
  value: string | number | boolean | undefined;
  onChange: (value: string | number | boolean) => void;
  error?: string;
}) {
  if (field.type === 'number') {
    return (
      <NumberField
        label={`${field.label}${field.required ? ' *' : ''}`}
        value={typeof value === 'number' ? value : 0}
        onChange={onChange}
        error={error}
      />
    );
  }

  if (field.type === 'boolean') {
    return (
      <div>
        <span className={labelClass}>{field.label}</span>
        <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5">
          <input
            type="checkbox"
            checked={value === true}
            onChange={(event) => onChange(event.target.checked)}
            className="h-4 w-4 accent-[#9a88fc]"
          />
          <span className="text-sm text-neutral-300">Yes</span>
        </label>
        {field.help && <p className="mt-1 text-xs text-neutral-600">{field.help}</p>}
      </div>
    );
  }

  if (field.type === 'select') {
    return (
      <div>
        <label className={labelClass} htmlFor={field.key}>
          {field.label}
          {field.required ? ' *' : ''}
        </label>
        <select
          id={field.key}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
          className={`${selectClass} ${error ? 'border-flag-critical/50' : ''}`}
        >
          <option value="">Select…</option>
          {field.options?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        {error && <p className="mt-1 text-xs text-flag-critical">{error}</p>}
        {field.help && <p className="mt-1 text-xs text-neutral-600">{field.help}</p>}
      </div>
    );
  }

  return (
    <div>
      <label className={labelClass} htmlFor={field.key}>
        {field.label}
        {field.required ? ' *' : ''}
      </label>
      <input
        id={field.key}
        value={typeof value === 'string' ? value : ''}
        onChange={(event) => onChange(event.target.value)}
        className={`${inputClass} ${error ? 'border-flag-critical/50' : ''}`}
      />
      {error && <p className="mt-1 text-xs text-flag-critical">{error}</p>}
    </div>
  );
}
