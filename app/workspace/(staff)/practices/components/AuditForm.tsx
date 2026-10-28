'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { markAuditCompleteAction, saveAuditAction } from '@/lib/workspace/practice-actions';
import { FRONT_DESK_SIZES, frontDeskLabel } from '@/lib/workspace/calls';
import {
  auditDraftFrom,
  formatDormantRevenue,
  formatNumberInput,
  parseInteger,
  parseNumberInput,
  parsePercentInput,
  pillarColor,
  PILLAR_SCORES,
  type AuditDraft,
  type AuditRecord,
  type PillarScore,
} from '@/lib/workspace/practices';
import { Button, Field, Input, Select, Textarea } from '../../components/ui';
import { CurrencyInput, PercentInput } from './fields';
import { useDebounced } from '../useDebounced';

function headingClass(extra = '') {
  return `font-[family-name:var(--font-plus-jakarta)] tracking-tight text-white ${extra}`;
}

type FormValues = {
  pms_in_use: string;
  front_desk_size: string;
  operatories: string;
  current_ad_spend: string;
  current_ad_channels: string;
  phone_owner: string;
  missed_calls_weekly: string;
  existing_followup: string;
  pillar_acquisition: PillarScore | '';
  pillar_acquisition_note: string;
  pillar_reactivation: PillarScore | '';
  pillar_reactivation_note: string;
  pillar_showup: PillarScore | '';
  pillar_showup_note: string;
  recall_list_size: string;
  avg_hygiene_value: string;
  unscheduled_treatment_value: string;
  avg_new_patient_value: string;
  current_no_show_rate: string;
  monthly_new_patients: string;
};

function valuesFrom(audit: AuditRecord | null): FormValues {
  const draft = auditDraftFrom(audit);
  return {
    pms_in_use: draft.pms_in_use ?? '',
    front_desk_size: draft.front_desk_size ?? '',
    operatories: draft.operatories == null ? '' : String(draft.operatories),
    current_ad_spend: formatNumberInput(draft.current_ad_spend),
    current_ad_channels: draft.current_ad_channels ?? '',
    phone_owner: draft.phone_owner ?? '',
    missed_calls_weekly: draft.missed_calls_weekly == null ? '' : String(draft.missed_calls_weekly),
    existing_followup: draft.existing_followup ?? '',
    pillar_acquisition: draft.pillar_acquisition ?? '',
    pillar_acquisition_note: draft.pillar_acquisition_note ?? '',
    pillar_reactivation: draft.pillar_reactivation ?? '',
    pillar_reactivation_note: draft.pillar_reactivation_note ?? '',
    pillar_showup: draft.pillar_showup ?? '',
    pillar_showup_note: draft.pillar_showup_note ?? '',
    recall_list_size: draft.recall_list_size == null ? '' : String(draft.recall_list_size),
    avg_hygiene_value: formatNumberInput(draft.avg_hygiene_value),
    unscheduled_treatment_value: formatNumberInput(draft.unscheduled_treatment_value),
    avg_new_patient_value: formatNumberInput(draft.avg_new_patient_value),
    current_no_show_rate: draft.current_no_show_rate == null ? '' : String(draft.current_no_show_rate),
    monthly_new_patients: draft.monthly_new_patients == null ? '' : String(draft.monthly_new_patients),
  };
}

function toDraft(values: FormValues): AuditDraft {
  return {
    pms_in_use: values.pms_in_use,
    front_desk_size: values.front_desk_size === 'one' || values.front_desk_size === 'two' || values.front_desk_size === 'three_plus'
      ? values.front_desk_size
      : null,
    operatories: parseInteger(values.operatories),
    current_ad_spend: parseNumberInput(values.current_ad_spend),
    current_ad_channels: values.current_ad_channels,
    phone_owner: values.phone_owner,
    missed_calls_weekly: parseInteger(values.missed_calls_weekly),
    existing_followup: values.existing_followup,
    pillar_acquisition: values.pillar_acquisition || null,
    pillar_acquisition_note: values.pillar_acquisition_note,
    pillar_reactivation: values.pillar_reactivation || null,
    pillar_reactivation_note: values.pillar_reactivation_note,
    pillar_showup: values.pillar_showup || null,
    pillar_showup_note: values.pillar_showup_note,
    recall_list_size: parseInteger(values.recall_list_size),
    avg_hygiene_value: parseNumberInput(values.avg_hygiene_value),
    unscheduled_treatment_value: parseNumberInput(values.unscheduled_treatment_value),
    avg_new_patient_value: parseNumberInput(values.avg_new_patient_value),
    current_no_show_rate: parsePercentInput(values.current_no_show_rate),
    monthly_new_patients: parseInteger(values.monthly_new_patients),
  };
}

const PILLARS: { key: 'pillar_acquisition' | 'pillar_reactivation' | 'pillar_showup'; note: 'pillar_acquisition_note' | 'pillar_reactivation_note' | 'pillar_showup_note'; label: string; helper: string }[] = [
  {
    key: 'pillar_acquisition',
    note: 'pillar_acquisition_note',
    label: 'Acquisition',
    helper: 'Are inbound leads captured and answered quickly',
  },
  {
    key: 'pillar_reactivation',
    note: 'pillar_reactivation_note',
    label: 'Reactivation',
    helper: 'Is anyone working recall and unscheduled treatment',
  },
  {
    key: 'pillar_showup',
    note: 'pillar_showup_note',
    label: 'Show-Up',
    helper: 'What is the actual no-show rate',
  },
];

export default function AuditForm({
  practiceId,
  audit,
}: {
  practiceId: string;
  audit: AuditRecord | null;
}) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(() => valuesFrom(audit));
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(() => Boolean(audit?.completed_at));
  const [pending, startTransition] = useTransition();
  const auditIdRef = useRef(audit?.id ?? null);
  const valuesRef = useRef(values);

  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  const patch = useCallback(<K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
  }, []);

  const persist = useCallback(async () => {
    const result = await saveAuditAction(practiceId, auditIdRef.current, toDraft(valuesRef.current));
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    if (typeof result.data?.id === 'string') auditIdRef.current = result.data.id;
  }, [practiceId]);

  useDebounced(values, 2000, () => {
    startTransition(() => {
      void persist();
    });
  }, true);

  const dormant = useMemo(
    () =>
      formatDormantRevenue({
        recall_list_size: parseInteger(values.recall_list_size),
        avg_hygiene_value: parseNumberInput(values.avg_hygiene_value),
        unscheduled_treatment_value: parseNumberInput(values.unscheduled_treatment_value),
      }),
    [values.recall_list_size, values.avg_hygiene_value, values.unscheduled_treatment_value],
  );

  return (
    <div className="space-y-10">
      <section>
        <h2 className={headingClass('mb-4 text-lg font-semibold')}>Current state</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="PMS in use">
            <Input value={values.pms_in_use} onChange={(e) => patch('pms_in_use', e.target.value)} />
          </Field>
          <Field label="Front desk size">
            <Select
              value={values.front_desk_size}
              onChange={(e) => patch('front_desk_size', e.target.value)}
            >
              <option value="">Select size</option>
              {FRONT_DESK_SIZES.map((size) => (
                <option key={size} value={size}>
                  {frontDeskLabel(size)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Operatories">
            <Input
              inputMode="numeric"
              value={values.operatories}
              onChange={(e) => patch('operatories', e.target.value)}
            />
          </Field>
          <Field label="Current ad spend">
            <CurrencyInput
              value={values.current_ad_spend}
              onChange={(value) => patch('current_ad_spend', value)}
              ariaLabel="Current ad spend"
            />
          </Field>
          <Field label="Current ad channels">
            <Input
              value={values.current_ad_channels}
              onChange={(e) => patch('current_ad_channels', e.target.value)}
            />
          </Field>
          <Field label="Who answers the phone">
            <Input value={values.phone_owner} onChange={(e) => patch('phone_owner', e.target.value)} />
          </Field>
          <Field label="Missed calls per week">
            <Input
              inputMode="numeric"
              value={values.missed_calls_weekly}
              onChange={(e) => patch('missed_calls_weekly', e.target.value)}
            />
          </Field>
          <Field label="Existing follow-up process">
            <Textarea
              value={values.existing_followup}
              onChange={(e) => patch('existing_followup', e.target.value)}
            />
          </Field>
        </div>
      </section>

      <section>
        <h2 className={headingClass('mb-4 text-lg font-semibold')}>Pillar scores</h2>
        <div className="space-y-4">
          {PILLARS.map((pillar) => (
            <div key={pillar.key} className="grid gap-3 lg:grid-cols-[180px_220px_1fr] lg:items-center">
              <div>
                <p className="text-sm font-semibold text-white">{pillar.label}</p>
                <p className="text-xs text-[#6E6C80]">{pillar.helper}</p>
              </div>
              <div className="flex overflow-hidden rounded-xl border border-white/10" role="radiogroup" aria-label={pillar.label}>
                {PILLAR_SCORES.map((score) => {
                  const active = values[pillar.key] === score;
                  return (
                    <button
                      key={score}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => patch(pillar.key, score)}
                      className="flex-1 py-2 text-sm font-semibold capitalize"
                      style={{
                        backgroundColor: active ? pillarColor(score) : 'transparent',
                        color: active ? '#0B0B0F' : '#6E6C80',
                      }}
                    >
                      {score}
                    </button>
                  );
                })}
              </div>
              <Input
                value={values[pillar.note]}
                onChange={(e) => patch(pillar.note, e.target.value)}
                placeholder="Note"
              />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className={headingClass('mb-4 text-lg font-semibold')}>Dormant revenue</h2>
        <div className="space-y-4">
          <Field label="Patients overdue on recall">
            <Input
              inputMode="numeric"
              className="px-4 py-3.5 text-2xl font-semibold"
              value={values.recall_list_size}
              onChange={(e) => patch('recall_list_size', e.target.value)}
            />
          </Field>
          <Field label="Average hygiene or treatment visit value">
            <CurrencyInput
              large
              value={values.avg_hygiene_value}
              onChange={(value) => patch('avg_hygiene_value', value)}
              ariaLabel="Average hygiene or treatment visit value"
            />
          </Field>
          <Field label="Unscheduled treatment total">
            <CurrencyInput
              large
              value={values.unscheduled_treatment_value}
              onChange={(value) => patch('unscheduled_treatment_value', value)}
              ariaLabel="Unscheduled treatment total"
            />
          </Field>
          <div className="rounded-2xl border border-[#937DFF] bg-[#241442] px-6 py-8 text-center">
            <p className="text-sm text-[#6E6C80]">Dormant revenue</p>
            <p className="mt-3 font-[family-name:var(--font-plus-jakarta)] text-[48px] leading-none text-white">
              {dormant}
            </p>
            <p className="mt-3 text-sm text-[#6E6C80]">(recall count × visit value) + unscheduled treatment</p>
          </div>
        </div>
      </section>

      <section>
        <h2 className={headingClass('mb-4 text-lg font-semibold')}>Baseline</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Average new patient value">
            <CurrencyInput
              value={values.avg_new_patient_value}
              onChange={(value) => patch('avg_new_patient_value', value)}
              ariaLabel="Average new patient value"
            />
          </Field>
          <Field label="Current no-show rate">
            <PercentInput
              value={values.current_no_show_rate}
              onChange={(value) => patch('current_no_show_rate', value)}
              ariaLabel="Current no-show rate"
            />
          </Field>
          <Field label="Monthly new patients">
            <Input
              inputMode="numeric"
              value={values.monthly_new_patients}
              onChange={(e) => patch('monthly_new_patients', e.target.value)}
            />
          </Field>
        </div>
      </section>

      {error && <p className="text-sm text-[#FF6A6A]">{error}</p>}

      {completed ? (
        <p className="text-sm text-[#7AFF8A]">Audit complete</p>
      ) : (
        <Button
          type="button"
          disabled={pending}
          style={{ backgroundColor: '#6A00FF', color: '#fff' }}
          onClick={() => {
            startTransition(async () => {
              const result = await markAuditCompleteAction(practiceId, auditIdRef.current, toDraft(valuesRef.current));
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setError(null);
              setCompleted(true);
              if (typeof result.data?.id === 'string') auditIdRef.current = result.data.id;
              router.refresh();
            });
          }}
        >
          Mark audit complete
        </Button>
      )}
    </div>
  );
}
