'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { OfferBriefView } from '@/app/components/placement/OfferBrief';
import { Button, Field, Input, Select, Textarea } from '../../components/ui';
import { DAY_NAMES } from '@/lib/portal/labels';
import {
  activateWizardAction,
  readGhlAction,
  saveWizardAction,
  waiveLaunchAction,
} from '@/lib/placement/actions';
import { mappingFromConfirmed } from '@/lib/placement/mapping';
import { OFFER_FIELDS } from '@/lib/placement/offer';
import { addMinutes, addMonths, availabilityWarnings, clockInZone } from '@/lib/placement/schedule';
import { EMPTY_PAYLOAD, normalizePayload, type CheckItem, type WizardPayload } from '@/lib/placement/types';
import { ACTIVITY_CATEGORIES } from '@/lib/sales-workspace/types';
import { connectPlacementGhlAction, testPlacementGhlAction } from '@/lib/workspace/sales-ghl-actions';

const STEPS = ['Operator', 'Client', 'Template', 'Schedule', 'Work', 'Offer', 'Reporting', 'GHL', 'First day', 'Review'];
const ZONES = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Phoenix', 'America/Los_Angeles', 'America/Toronto', 'Asia/Manila', 'Europe/London', 'UTC'];

type OperatorOption = {
  id: string;
  name: string;
  stage: string;
  ready: boolean;
  has_open: boolean;
  missing: string;
  time_zone: string | null;
  work_days: unknown;
  work_hours: string | null;
};
type ClientOption = {
  id: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  ghl: boolean;
  placements: Array<{ id: string; operator: string; status: string }>;
};
type TemplateOption = {
  slug: string;
  name: string;
  vertical: string;
  speed_tracked: boolean;
  categories: string[];
  outcomes: Array<{ name: string; definition: string }>;
  offer_outline: Record<string, string>;
  ghl: { calendars?: string[]; stage?: string | null; tag?: string | null };
  first_day: string[];
  report: { send_dow?: number; send_time?: string; daily?: boolean; approval?: boolean; cc_manager?: boolean };
};
type Bundle = {
  role: 'admin' | 'manager';
  wizard: { id: string; placement_id: string | null; step: number; status: string; payload: unknown } | null;
  checklist: CheckItem[];
  templates: TemplateOption[];
  operators: OperatorOption[];
  clients: ClientOption[];
  managers: Array<{ id: string; name: string }>;
  metrics: Array<{ key: string; label: string }>;
  copy_from: Array<{ id: string; label: string }>;
};

/** Who the wizard was opened from: a Ready operator or a client case file. */
export type WizardPrefill = { operator_id?: string; case_file_id?: string };

export default function PlacementWizard({ bundle, prefill }: { bundle: Bundle; prefill?: WizardPrefill }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Opened from a client file with no operator yet, step 1 is still the
  // operator; opened from a Ready operator, step 2 picks the client.
  const [step, setStep] = useState(bundle.wizard?.step ?? (prefill?.operator_id && !prefill?.case_file_id ? 2 : 1));
  const [wizardId, setWizardId] = useState(bundle.wizard?.id ?? null);
  const [placementId, setPlacementId] = useState(bundle.wizard?.placement_id ?? null);
  const [payload, setPayload] = useState<WizardPayload>(() =>
    bundle.wizard?.payload
      ? normalizePayload(bundle.wizard.payload)
      : {
          ...normalizePayload(EMPTY_PAYLOAD),
          ...(prefill?.operator_id && bundle.operators.some((item) => item.id === prefill.operator_id) ? { operator_id: prefill.operator_id } : {}),
          ...(prefill?.case_file_id && bundle.clients.some((item) => item.id === prefill.case_file_id) ? { case_file_id: prefill.case_file_id } : {}),
        },
  );
  const [checklist, setChecklist] = useState<CheckItem[]>(bundle.checklist ?? []);
  const [showOthers, setShowOthers] = useState(Boolean(bundle.wizard?.payload && !operatorsReady(bundle, normalizePayload(bundle.wizard.payload).operator_id)));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [proposal, setProposal] = useState<{
    connected: boolean;
    warning: string | null;
    users: Array<{ id: string; name: string; email: string }>;
    rows: Array<{ key: string; label: string; pool: string; suggestedName: string; multiple: boolean; options: Array<{ id: string; name: string }>; suggestedId: string | null }>;
  } | null>(null);
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const [waivers, setWaivers] = useState<Record<string, string>>({});

  const operator = bundle.operators.find((item) => item.id === payload.operator_id) ?? null;
  const client = bundle.clients.find((item) => item.id === payload.case_file_id) ?? null;
  const template = bundle.templates.find((item) => item.slug === payload.template_slug) ?? null;
  const onDate = payload.start_date || new Date().toISOString().slice(0, 10);
  const localStart = operator?.time_zone ? clockInZone(onDate, payload.shift_start, payload.time_zone, operator.time_zone) : null;
  const localEnd = operator?.time_zone ? clockInZone(onDate, payload.shift_end, payload.time_zone, operator.time_zone) : null;
  const warnings = operator
    ? availabilityWarnings({
        workingDays: payload.working_days,
        shiftStart: payload.shift_start,
        shiftEnd: payload.shift_end,
        shiftZone: payload.time_zone,
        operatorZone: operator.time_zone,
        workDays: operator.work_days,
        workHours: operator.work_hours,
        onDate,
      })
    : [];

  function save(nextStep: number, patch?: Partial<WizardPayload>, done?: () => void) {
    const body = patch ? { ...payload, ...patch } : payload;
    setError(null);
    startTransition(async () => {
      const result = await saveWizardAction({ id: wizardId, step: nextStep, payload: body });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPayload(body);
      setWizardId(result.id);
      setPlacementId(result.placement_id);
      setChecklist((result.checklist as CheckItem[]) ?? []);
      setStep(nextStep);
      setNotice('Draft saved. You can leave and come back.');
      done?.();
    });
  }

  const operators = bundle.operators.filter((item) => showOthers || item.ready || item.id === payload.operator_id);
  const blocking = checklist.filter((item) => item.blocking);
  const waived = checklist.filter((item) => item.waived);

  return (
    <div className="space-y-6">
      <ol className="flex gap-1 overflow-x-auto pb-1" aria-label="Placement steps">
        {STEPS.map((label, index) => {
          const number = index + 1;
          const current = number === step;
          return (
            <li key={label}>
              <button
                type="button"
                disabled={number > (bundle.wizard?.step ?? 1) + 1 && number > step}
                onClick={() => setStep(number)}
                aria-current={current ? 'step' : undefined}
                className={`rounded-full px-3 py-1 text-xs ${current ? 'da-primary text-white' : 'bg-white/5 text-neutral-300 hover:bg-white/10'}`}
              >
                {number}. {label}
              </button>
            </li>
          );
        })}
      </ol>
      {error ? <p className="text-sm text-amber-200">{error}</p> : null}
      {notice ? <p className="text-sm text-emerald-200">{notice}</p> : null}

      {step === 1 ? (
        <section className="space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showOthers} onChange={(event) => setShowOthers(event.target.checked)} />
            Show operators who are not Ready to place
          </label>
          <Field label="Operator">
            <Select value={payload.operator_id} onChange={(event) => setPayload({ ...payload, operator_id: event.target.value })}>
              <option value="">Choose an operator</option>
              {operators.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.ready ? '' : ` — ${item.missing || item.stage}`}
                </option>
              ))}
            </Select>
          </Field>
          {operator && !operator.ready ? (
            bundle.role === 'admin' ? (
              <Field label="Why this operator is being placed before they are Ready" hint="DA Admin only. This is recorded as a waiver.">
                <Textarea value={payload.not_ready_reason} onChange={(event) => setPayload({ ...payload, not_ready_reason: event.target.value })} rows={3} />
              </Field>
            ) : (
              <p className="text-sm text-amber-200">Only DA Admin can place someone who is not Ready to place.</p>
            )
          ) : null}
          {operator?.has_open ? <p className="text-sm text-amber-200">This operator already has an open placement. A second one cannot be activated until that one is paused or ended.</p> : null}
        </section>
      ) : null}

      {step === 2 ? (
        <section className="space-y-4">
          <Field label="Client">
            <Select value={payload.case_file_id} onChange={(event) => setPayload({ ...payload, case_file_id: event.target.value })}>
              <option value="">Choose a client</option>
              {bundle.clients.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </Field>
          {client ? (
            <div className="space-y-2 text-sm text-neutral-300">
              <p>Contact: {client.contact_name || 'No name'} · {client.contact_email || 'No email on the case file'}</p>
              <p>GHL: {client.ghl ? 'Connected' : 'Not connected'}</p>
              {client.placements.length > 0 ? (
                <ul>
                  {client.placements.map((item) => (
                    <li key={item.id}>
                      {item.operator} · {item.status}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No other open placement on this client. A client can hold more than one.</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-neutral-300">
              No client record yet? <Link className="underline" href="/workspace/clients">Create the case file</Link>, then come back to this draft.
            </p>
          )}
          <Field label="Assigned manager">
            <Select value={payload.manager_profile_id} onChange={(event) => setPayload({ ...payload, manager_profile_id: event.target.value })}>
              <option value="">No manager yet</option>
              {bundle.managers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </Field>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="space-y-4">
          <Field label="Vertical template">
            <Select
              value={payload.template_slug}
              onChange={(event) => {
                const next = bundle.templates.find((item) => item.slug === event.target.value);
                if (!next) {
                  setPayload({ ...payload, template_slug: '', speed_tracked: false });
                  return;
                }
                setPayload({
                  ...payload,
                  template_slug: next.slug,
                  activity_categories: next.categories,
                  outcomes: next.outcomes,
                  first_day: next.first_day,
                  speed_tracked: next.speed_tracked,
                  ghl_suggestions: next.ghl ?? {},
                  reporting: {
                    ...payload.reporting,
                    send_dow: next.report?.send_dow ?? 1,
                    send_time: next.report?.send_time ?? '09:00',
                    daily: Boolean(next.report?.daily),
                    approval: next.report?.approval !== false,
                    cc_manager: next.report?.cc_manager !== false,
                  },
                });
              }}
            >
              <option value="">No template</option>
              {bundle.templates.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.name}
                </option>
              ))}
            </Select>
          </Field>
          {template ? (
            <div className="space-y-2 text-sm text-neutral-300">
              <p>{template.vertical}. Speed-to-lead is tracked. You can change every field after this.</p>
              <p>Categories: {template.categories.join(', ')}</p>
              <ul>
                {template.outcomes.map((outcome) => (
                  <li key={outcome.name}>
                    {outcome.name}: {outcome.definition}
                  </li>
                ))}
              </ul>
              <p>
                Suggested GHL: {(template.ghl?.calendars ?? []).join(', ')}
                {template.ghl?.stage ? ` · stage ${template.ghl.stage}` : ''}
                {template.ghl?.tag ? ` · tag ${template.ghl.tag}` : ''}
              </p>
            </div>
          ) : (
            <p className="text-sm text-neutral-300">No template. You will fill categories, outcomes, and tasks yourself.</p>
          )}
        </section>
      ) : null}

      {step === 4 ? (
        <section className="grid gap-4 md:grid-cols-2">
          <Field label="Start date">
            <Input
              type="date"
              value={payload.start_date}
              onChange={(event) => setPayload({ ...payload, start_date: event.target.value, review_on: payload.review_on || addMonths(event.target.value, 3) })}
            />
          </Field>
          <Field label="Review date" hint="Defaults to three months after the start.">
            <Input type="date" value={payload.review_on} onChange={(event) => setPayload({ ...payload, review_on: event.target.value })} />
          </Field>
          <Field label="Shift time zone" hint="Defaults to the client account. Case files do not store a zone, so New York is the starting point.">
            <Select value={payload.time_zone} onChange={(event) => setPayload({ ...payload, time_zone: event.target.value })}>
              {(ZONES.includes(payload.time_zone) ? ZONES : [payload.time_zone, ...ZONES]).map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Shift start" hint={localStart && operator?.time_zone ? `${localStart} for the operator (${operator.time_zone})` : 'Operator local time appears when their onboarding zone is known.'}>
            <Input type="time" value={payload.shift_start} onChange={(event) => setPayload({ ...payload, shift_start: event.target.value })} />
          </Field>
          <Field label="Shift end" hint={localEnd && operator?.time_zone ? `${localEnd} for the operator (${operator.time_zone})` : undefined}>
            <Input
              type="time"
              value={payload.shift_end}
              onChange={(event) => setPayload({ ...payload, shift_end: event.target.value, eod_deadline: addMinutes(event.target.value, 30) })}
            />
          </Field>
          <Field label="EOD deadline" hint="30 minutes after the shift end unless you change it.">
            <Input type="time" value={payload.eod_deadline} onChange={(event) => setPayload({ ...payload, eod_deadline: event.target.value })} />
          </Field>
          <fieldset className="md:col-span-2">
            <legend className="mb-2 text-sm text-neutral-300">Working days</legend>
            <div className="flex flex-wrap gap-3 text-sm">
              {DAY_NAMES.map((label, index) => {
                const day = index + 1;
                return (
                  <label key={label} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={payload.working_days.includes(day)}
                      onChange={(event) =>
                        setPayload({
                          ...payload,
                          working_days: event.target.checked ? [...payload.working_days, day].sort() : payload.working_days.filter((value) => value !== day),
                        })
                      }
                    />
                    {label}
                  </label>
                );
              })}
            </div>
          </fieldset>
          {warnings.map((warning) => (
            <p key={warning} className="md:col-span-2 text-sm text-amber-200">
              {warning}
            </p>
          ))}
        </section>
      ) : null}

      {step === 5 ? (
        <section className="space-y-4">
          <fieldset>
            <legend className="mb-2 text-sm text-neutral-300">Activity categories</legend>
            <div className="space-y-2 text-sm">
              {ACTIVITY_CATEGORIES.map((category) => (
                <label key={category.value} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={payload.activity_categories.includes(category.value)}
                    onChange={(event) =>
                      setPayload({
                        ...payload,
                        activity_categories: event.target.checked
                          ? [...payload.activity_categories, category.value]
                          : payload.activity_categories.filter((value) => value !== category.value),
                      })
                    }
                  />
                  {category.label}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={payload.tracks_results} onChange={(event) => setPayload({ ...payload, tracks_results: event.target.checked })} />
            Track show rate and closes
          </label>
          <div className="space-y-3">
            {payload.outcomes.map((outcome, index) => (
              <div key={index} className="grid gap-2 md:grid-cols-2">
                <Input value={outcome.name} onChange={(event) => updateOutcome(index, { name: event.target.value })} placeholder="Outcome name" />
                <Input value={outcome.definition} onChange={(event) => updateOutcome(index, { definition: event.target.value })} placeholder="What counts" />
              </div>
            ))}
            <Button type="button" variant="secondary" onClick={() => setPayload({ ...payload, outcomes: [...payload.outcomes, { name: '', definition: '' }] })}>
              Add outcome
            </Button>
          </div>
        </section>
      ) : null}

      {step === 6 ? (
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            {OFFER_FIELDS.map((field) => (
              <Field key={field.key} label={field.label} hint={field.required ? 'Required' : 'Optional'}>
                <Textarea
                  rows={3}
                  value={payload.offer[field.key]}
                  placeholder={template?.offer_outline?.[field.key] ?? ''}
                  onChange={(event) => setPayload({ ...payload, offer: { ...payload.offer, [field.key]: event.target.value } })}
                />
              </Field>
            ))}
          </div>
          <div>
            <p className="mb-2 text-sm text-neutral-300">Client card preview</p>
            <OfferBriefView client={client?.name} offer={payload.offer} outcomes={payload.outcomes.filter((outcome) => outcome.name && outcome.definition)} />
          </div>
        </section>
      ) : null}

      {step === 7 ? (
        <section className="space-y-4 text-sm">
          <fieldset className="space-y-2">
            <legend>Recipients on the case file</legend>
            {client?.contact_email ? (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={payload.reporting.recipients.includes(client.contact_email)}
                  onChange={(event) =>
                    setPayload({
                      ...payload,
                      reporting: {
                        ...payload.reporting,
                        recipients: event.target.checked
                          ? [...payload.reporting.recipients, client.contact_email!]
                          : payload.reporting.recipients.filter((email) => email !== client.contact_email),
                      },
                    })
                  }
                />
                {client.contact_name ? `${client.contact_name} · ` : ''}
                {client.contact_email}
              </label>
            ) : (
              <p className="text-neutral-300">No contact email on this client yet.</p>
            )}
          </fieldset>
          <Field label="Extra recipient emails">
            <Input value={payload.reporting.extra.join(', ')} onChange={(event) => setPayload({ ...payload, reporting: { ...payload.reporting, extra: splitEmails(event.target.value) } })} />
          </Field>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={payload.reporting.cc_manager} onChange={(event) => setPayload({ ...payload, reporting: { ...payload.reporting, cc_manager: event.target.checked } })} />
            CC the manager
          </label>
          <Field label="Weekly report day">
            <Select value={String(payload.reporting.send_dow)} onChange={(event) => setPayload({ ...payload, reporting: { ...payload.reporting, send_dow: Number(event.target.value) } })}>
              {DAY_NAMES.map((label, index) => (
                <option key={label} value={index + 1}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Weekly report time" hint={`In ${payload.time_zone}. Default Monday 9:00.`}>
            <Input type="time" value={payload.reporting.send_time} onChange={(event) => setPayload({ ...payload, reporting: { ...payload.reporting, send_time: event.target.value } })} />
          </Field>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={payload.reporting.daily} onChange={(event) => setPayload({ ...payload, reporting: { ...payload.reporting, daily: event.target.checked } })} />
            Daily report after each submitted EOD
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={payload.reporting.approval} onChange={(event) => setPayload({ ...payload, reporting: { ...payload.reporting, approval: event.target.checked } })} />
            Manager approval before sending
          </label>
          <Field label="Client introduction email">
            <Select value={payload.reporting.intro} onChange={(event) => setPayload({ ...payload, reporting: { ...payload.reporting, intro: event.target.value as WizardPayload['reporting']['intro'] } })}>
              <option value="activation">Send when this placement is activated</option>
              <option value="date">Schedule for a date</option>
              <option value="hold">Hold for preview. Do not send until released.</option>
              <option value="none">Do not send</option>
            </Select>
          </Field>
          {payload.reporting.intro === 'date' ? (
            <Field label="Introduction date">
              <Input type="date" value={payload.reporting.intro_on} onChange={(event) => setPayload({ ...payload, reporting: { ...payload.reporting, intro_on: event.target.value } })} />
            </Field>
          ) : null}
          {payload.reporting.intro === 'hold' ? (
            <p className="text-amber-200">The introduction is saved for your preview. Activating does not send it. Release it from the placement when you have read it.</p>
          ) : null}
        </section>
      ) : null}

      {step === 8 ? (
        <section className="space-y-4 text-sm">
          <p>{client?.ghl ? 'This client already has a GHL connection. The wizard reuses it.' : 'This client has no GHL connection yet.'}</p>
          {bundle.role === 'admin' && placementId ? (
            <form
              className="grid gap-3 md:grid-cols-2"
              action={async (formData) => {
                const result = await connectPlacementGhlAction(formData);
                setNotice(result.ok ? result.message ?? 'Connection saved.' : null);
                setError(result.ok ? null : result.error);
              }}
            >
              <input type="hidden" name="placement_id" value={placementId} />
              <input type="hidden" name="case_file_id" value={payload.case_file_id} />
              <input type="hidden" name="ghl_user_id" value={payload.ghl.user_id} />
              <Field label="Location ID">
                <Input name="location_id" />
              </Field>
              <Field label="Private integration token" hint="Stored in the vault. Not shown again.">
                <Input name="token" type="password" autoComplete="off" />
              </Field>
              <Button type="submit">Save connection</Button>
            </form>
          ) : null}
          {bundle.role !== 'admin' ? <p className="text-neutral-300">Only DA Admin can enter or change GHL credentials.</p> : null}
          {placementId ? (
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => {
                const form = new FormData();
                form.set('placement_id', placementId);
                form.set('case_file_id', payload.case_file_id);
                startTransition(async () => {
                  const tested = await testPlacementGhlAction(form);
                  const read = await readGhlAction({
                    caseFileId: payload.case_file_id,
                    placementId,
                    outcomes: payload.outcomes,
                    suggestions: payload.ghl_suggestions,
                    tracksResults: payload.tracks_results,
                    tracksSpeed: payload.speed_tracked,
                    tracksReactivation: payload.activity_categories.includes('reactivation'),
                  });
                  setNotice(tested.ok ? tested.message ?? 'Connection checked.' : null);
                  if (!read.ok) {
                    setError(read.error);
                    return;
                  }
                  setProposal(read.proposal);
                  setPicked(Object.fromEntries(read.proposal.rows.map((row) => [row.key, row.suggestedId ? [row.suggestedId] : []])));
                  setError(read.proposal.warning);
                });
              }}
            >
              Read this client&apos;s GHL
            </Button>
          ) : (
            <p className="text-amber-200">Save the operator, client, and start date first. GHL is attached to the placement record.</p>
          )}
          <Field label="Operator GHL user">
            <Select
              value={payload.ghl.user_pending ? '' : payload.ghl.user_id}
              onChange={(event) => setPayload({ ...payload, ghl: { ...payload.ghl, user_id: event.target.value, user_pending: false } })}
            >
              <option value="">Not chosen</option>
              {(proposal?.users ?? []).map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name || user.email || user.id}
                </option>
              ))}
            </Select>
          </Field>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={payload.ghl.user_pending}
              onChange={(event) => setPayload({ ...payload, ghl: { ...payload.ghl, user_pending: event.target.checked, user_id: event.target.checked ? '' : payload.ghl.user_id } })}
            />
            GHL user not created yet
          </label>
          {payload.ghl.user_pending ? (
            <ol className="list-decimal space-y-1 pl-5 text-neutral-300">
              <li>In the client sub-account, open Settings, then My Staff.</li>
              <li>Add the operator with their own email. Do not share a login.</li>
              <li>Give them the calendars, pipelines, or tags this placement uses. A booking in another tool is marked with tags.</li>
              <li>Come back here, read GHL again, and choose that user.</li>
            </ol>
          ) : null}
          <Field label="Phone number">
            <Select value={payload.ghl.phone} onChange={(event) => setPayload({ ...payload, ghl: { ...payload.ghl, phone: event.target.value as WizardPayload['ghl']['phone'] } })}>
              <option value="">Choose</option>
              <option value="assigned">Assigned</option>
              <option value="not_assigned">Not assigned</option>
              <option value="not_needed">Not needed</option>
            </Select>
          </Field>
          {(proposal?.rows ?? []).map((row) => (
            <div key={row.key} className="rounded-xl border border-white/10 p-3">
              <p className="font-medium text-white">{row.label}</p>
              <p className="text-neutral-400">Suggested name: {row.suggestedName}</p>
              {row.options.length === 0 || (row.suggestedName && !row.suggestedId) ? (
                <p className="text-amber-200">
                  Nothing in GHL matched. Create a {row.pool === 'calendars' ? 'calendar' : row.pool === 'stages' ? 'stage' : row.pool === 'pipelines' ? 'pipeline' : 'tag'}
                  {row.suggestedName ? ` named ${row.suggestedName}` : ''}, then read GHL again.
                </p>
              ) : null}
              {row.multiple ? (
                <ul className="mt-2 max-h-40 space-y-1 overflow-auto">
                  {row.options.map((option) => {
                    const selected = (picked[row.key] ?? []).includes(option.id);
                    return (
                      <li key={option.id}>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={(event) => {
                              const current = picked[row.key] ?? [];
                              setPicked({
                                ...picked,
                                [row.key]: event.target.checked ? [...current, option.id] : current.filter((id) => id !== option.id),
                              });
                            }}
                          />
                          {option.name}
                          {option.id === row.suggestedId ? ' (suggested)' : ''}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <Select
                  value={(picked[row.key] ?? [])[0] ?? ''}
                  onChange={(event) => setPicked({ ...picked, [row.key]: event.target.value ? [event.target.value] : [] })}
                >
                  <option value="">Do not map yet</option>
                  {row.options.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                      {option.id === row.suggestedId ? ' (suggested)' : ''}
                    </option>
                  ))}
                </Select>
              )}
              <label className="mt-2 flex items-center gap-2">
                <input type="checkbox" checked={Boolean(confirmed[row.key])} onChange={(event) => setConfirmed({ ...confirmed, [row.key]: event.target.checked })} />
                Confirm this mapping
              </label>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => {
              const chosen: Record<string, string[]> = {};
              for (const row of proposal?.rows ?? []) {
                const ids = (picked[row.key] ?? []).filter(Boolean);
                if (confirmed[row.key] && ids.length) chosen[row.key] = ids;
              }
              const mapping = mappingFromConfirmed({ outcomes: payload.outcomes, confirmed: chosen });
              save(8, { ...payload, mapping_confirmed: true, ghl: { ...payload.ghl, mapping } });
            }}
          >
            Save mapping so far
          </Button>
        </section>
      ) : null}

      {step === 9 ? (
        <section className="space-y-4">
          <Field label="First-day tasks" hint="One task per line. [client] and [deadline] are filled in when the placement is activated.">
            <Textarea rows={6} value={payload.first_day.join('\n')} onChange={(event) => setPayload({ ...payload, first_day: event.target.value.split('\n').map((line) => line.trim()).filter(Boolean) })} />
          </Field>
          <Field label="Targets">
            <Select value={payload.targets_mode} onChange={(event) => setPayload({ ...payload, targets_mode: event.target.value as WizardPayload['targets_mode'] })}>
              <option value="empty">Leave empty (recommended for a new placement)</option>
              <option value="copy">Copy from another placement</option>
              <option value="set">Set now</option>
            </Select>
          </Field>
          {payload.targets_mode === 'copy' ? (
            <Field label="Copy from">
              <Select value={payload.copy_from} onChange={(event) => setPayload({ ...payload, copy_from: event.target.value })}>
                <option value="">Choose a placement</option>
                {bundle.copy_from.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          {payload.targets_mode === 'set'
            ? bundle.metrics.slice(0, 8).map((metric) => {
                const current = payload.targets.find((target) => target.metric === metric.key) ?? { metric: metric.key, daily: '', weekly: '' };
                return (
                  <div key={metric.key} className="grid gap-2 md:grid-cols-3">
                    <p className="self-center text-sm">{metric.label}</p>
                    <Input placeholder="Daily" value={current.daily} onChange={(event) => setTarget(metric.key, { daily: event.target.value })} />
                    <Input placeholder="Weekly" value={current.weekly} onChange={(event) => setTarget(metric.key, { weekly: event.target.value })} />
                  </div>
                );
              })
            : null}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={payload.launch_week} onChange={(event) => setPayload({ ...payload, launch_week: event.target.checked })} />
            Launch week summary for the manager
          </label>
        </section>
      ) : null}

      {step === 10 ? (
        <section className="space-y-4 text-sm">
          <Summary label="Operator" value={operator?.name} onEdit={() => setStep(1)} />
          <Summary label="Client" value={client?.name} onEdit={() => setStep(2)} />
          <Summary label="Template" value={template?.name || 'No template'} onEdit={() => setStep(3)} />
          <Summary label="Schedule" value={`${payload.start_date} · ${payload.shift_start}–${payload.shift_end} ${payload.time_zone}`} onEdit={() => setStep(4)} />
          <Summary label="Outcomes" value={payload.outcomes.map((outcome) => outcome.name).filter(Boolean).join(', ')} onEdit={() => setStep(5)} />
          <Summary label="Offer" value={payload.offer.one_liner} onEdit={() => setStep(6)} />
          <Summary label="Reporting" value={payload.reporting.recipients.concat(payload.reporting.extra).join(', ') || 'No recipients'} onEdit={() => setStep(7)} />
          <Summary
            label="Client introduction"
            value={payload.reporting.intro === 'hold' ? 'Held for preview. Nothing is sent.' : payload.reporting.intro}
            onEdit={() => setStep(7)}
          />
          {payload.reporting.intro === 'hold' ? (
            <div className="rounded-lg border border-amber-200/40 px-3 py-2 text-amber-100">
              <p className="font-medium">Introduction preview</p>
              <p>{operator?.name || 'The operator'} is the Sales Operator Divine Acquisition is placing with {client?.name || 'the client'}.</p>
              <p>The first shift is {payload.start_date || 'the start date'}.</p>
              <p>This stays with you until you release it. The client does not receive it on activation.</p>
            </div>
          ) : null}
          <Summary label="GHL phone" value={payload.ghl.phone || 'Not set'} onEdit={() => setStep(8)} />
          <Summary label="First day" value={`${payload.first_day.length} tasks`} onEdit={() => setStep(9)} />
          <h3 className="text-base font-semibold text-white">Launch checklist</h3>
          <ul className="space-y-2">
            {checklist.map((item) => (
              <li key={item.key} className="rounded-lg border border-white/10 px-3 py-2">
                <p className={item.overdue ? 'text-red-300' : undefined}>
                  {item.overdue ? 'Overdue' : item.blocking ? 'Still needed before activation' : item.waived ? 'Waived' : item.met ? 'Met' : 'Open'} — {item.label}
                </p>
                {item.fix && !item.met && !item.waived ? <p className="text-neutral-300">{item.fix}</p> : null}
                {item.waiver_reason ? <p className="text-neutral-400">Waived: {item.waiver_reason}</p> : null}
                {item.checked_by ? <p className="text-neutral-400">Confirmed by {item.checked_by}.</p> : null}
                {bundle.role === 'admin' && item.blocking ? (
                  <div className="mt-2 flex gap-2">
                    <Input value={waivers[item.key] ?? ''} placeholder="Reason for the waiver" onChange={(event) => setWaivers({ ...waivers, [item.key]: event.target.value })} />
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={pending || !placementId}
                      onClick={() => {
                        if (!placementId) return;
                        startTransition(async () => {
                          const result = await waiveLaunchAction(placementId, item.key, waivers[item.key] ?? '');
                          if (!result.ok) setError(result.error);
                          else save(10);
                        });
                      }}
                    >
                      Waive
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
          {blocking.length > 0 ? <p className="text-amber-200">Activation is blocked until the items marked still needed are met or waived by DA Admin.</p> : null}
          {bundle.role === 'manager' && waived.length > 0 ? <p className="text-amber-200">A manager can activate only when every item is met and nothing is waived.</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" disabled={pending} onClick={() => save(10)}>
              Save as draft
            </Button>
            <Button type="button" disabled={pending || !wizardId} onClick={() => activate('schedule')}>
              Schedule activation for the start date
            </Button>
            <Button type="button" disabled={pending || !wizardId} onClick={() => activate('now')}>
              Activate now
            </Button>
          </div>
        </section>
      ) : null}

      {step < 10 ? (
        <div className="flex gap-2">
          {step > 1 ? (
            <Button type="button" variant="secondary" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          ) : null}
          <Button type="button" disabled={pending} onClick={() => save(Math.min(10, step + 1), flagsFor(step, payload))}>
            Save and continue
          </Button>
        </div>
      ) : null}
    </div>
  );

  function updateOutcome(index: number, patch: Partial<{ name: string; definition: string }>) {
    setPayload({
      ...payload,
      outcomes: payload.outcomes.map((outcome, item) => (item === index ? { ...outcome, ...patch } : outcome)),
    });
  }

  function setTarget(metric: string, patch: Partial<{ daily: string; weekly: string }>) {
    const existing = payload.targets.find((target) => target.metric === metric) ?? { metric, daily: '', weekly: '' };
    const next = { ...existing, ...patch };
    setPayload({
      ...payload,
      targets: [...payload.targets.filter((target) => target.metric !== metric), next],
    });
  }

  function activate(mode: 'now' | 'schedule') {
    if (!wizardId) return;
    setError(null);
    startTransition(async () => {
      const saved = await saveWizardAction({ id: wizardId, step: 10, payload: flagsFor(9, payload) });
      if (!saved.ok) {
        setError(saved.error);
        return;
      }
      const result = await activateWizardAction(saved.id, mode);
      if (!result.ok) {
        setError(result.error);
        setChecklist((saved.checklist as CheckItem[]) ?? checklist);
        return;
      }
      router.push(`/workspace/placements/${result.placement_id}`);
    });
  }
}

function flagsFor(step: number, payload: WizardPayload): WizardPayload {
  return {
    ...payload,
    schedule_confirmed: step >= 4 ? true : payload.schedule_confirmed,
    work_confirmed: step >= 5 ? true : payload.work_confirmed,
    offer_confirmed: step >= 6 ? true : payload.offer_confirmed,
    reporting_confirmed: step >= 7 ? true : payload.reporting_confirmed,
    targets_confirmed: step >= 9 ? true : payload.targets_confirmed,
  };
}

function splitEmails(value: string) {
  return value.split(/[\s,;]+/).map((item) => item.trim()).filter(Boolean);
}

function operatorsReady(bundle: Bundle, operatorId: string) {
  return bundle.operators.find((item) => item.id === operatorId)?.ready ?? true;
}

function Summary({ label, value, onEdit }: { label: string; value?: string | null; onEdit: () => void }) {
  return (
    <p>
      <span className="text-neutral-400">{label}: </span>
      <span className="text-white">{value || 'Not set'}</span>{' '}
      <button type="button" className="underline" onClick={onEdit}>
        Edit
      </button>
    </p>
  );
}
