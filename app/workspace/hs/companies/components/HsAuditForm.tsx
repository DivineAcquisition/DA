'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { markHsAuditCompleteAction, saveHsAuditAction } from '@/lib/workspace/hs-company-actions'
import {
  HS_CREW_COUNTS,
  HS_PHONE_COVERAGE,
  HS_PILLAR_SCORES,
  computeLeadToJobGap,
  formatIdleRevenue,
  formatNumberInput,
  hsAuditDraftFrom,
  hsCrewCountLabel,
  hsPhoneCoverageLabel,
  hsPillarColor,
  isHsCrewCount,
  isHsPhoneCoverage,
  parseInteger,
  parseNumberInput,
  parsePercentInput,
  type HsAuditDraft,
  type HsAuditRecord,
  type HsPillarScore,
} from '@/lib/workspace/hs-companies'
import { Button, Field, Input, Select } from '../../../components/ui'
import { CurrencyInput, PercentInput } from './fields'
import { useDebounced } from '../useDebounced'

function headingClass(extra = '') {
  return `font-[family-name:var(--font-plus-jakarta)] tracking-tight text-white ${extra}`
}

type FormValues = {
  crm_in_use: string
  crew_count: string
  trucks: string
  who_answers_phone: string
  after_hours_handling: string
  current_ad_spend: string
  current_ad_channels: string
  missed_calls_weekly: string
  avg_response_time: string
  existing_followup: string
  pillar_speed: HsPillarScore | ''
  pillar_speed_note: string
  pillar_estimates: HsPillarScore | ''
  pillar_estimates_note: string
  pillar_repeat: HsPillarScore | ''
  pillar_repeat_note: string
  past_customer_count: string
  avg_job_value: string
  unsold_estimates_value: string
  monthly_lead_volume: string
  monthly_jobs_booked: string
  close_rate: string
}

function valuesFrom(audit: HsAuditRecord | null): FormValues {
  const draft = hsAuditDraftFrom(audit)
  return {
    crm_in_use: draft.crm_in_use ?? '',
    crew_count: draft.crew_count ?? '',
    trucks: draft.trucks == null ? '' : String(draft.trucks),
    who_answers_phone: draft.who_answers_phone ?? '',
    after_hours_handling: draft.after_hours_handling ?? '',
    current_ad_spend: formatNumberInput(draft.current_ad_spend),
    current_ad_channels: draft.current_ad_channels ?? '',
    missed_calls_weekly: draft.missed_calls_weekly == null ? '' : String(draft.missed_calls_weekly),
    avg_response_time: draft.avg_response_time ?? '',
    existing_followup: draft.existing_followup ?? '',
    pillar_speed: draft.pillar_speed ?? '',
    pillar_speed_note: draft.pillar_speed_note ?? '',
    pillar_estimates: draft.pillar_estimates ?? '',
    pillar_estimates_note: draft.pillar_estimates_note ?? '',
    pillar_repeat: draft.pillar_repeat ?? '',
    pillar_repeat_note: draft.pillar_repeat_note ?? '',
    past_customer_count: draft.past_customer_count == null ? '' : String(draft.past_customer_count),
    avg_job_value: formatNumberInput(draft.avg_job_value),
    unsold_estimates_value: formatNumberInput(draft.unsold_estimates_value),
    monthly_lead_volume: draft.monthly_lead_volume == null ? '' : String(draft.monthly_lead_volume),
    monthly_jobs_booked: draft.monthly_jobs_booked == null ? '' : String(draft.monthly_jobs_booked),
    close_rate: draft.close_rate == null ? '' : String(draft.close_rate),
  }
}

function toDraft(values: FormValues): HsAuditDraft {
  return {
    crm_in_use: values.crm_in_use,
    crew_count: isHsCrewCount(values.crew_count) ? values.crew_count : null,
    trucks: parseInteger(values.trucks),
    who_answers_phone: isHsPhoneCoverage(values.who_answers_phone) ? values.who_answers_phone : null,
    after_hours_handling: values.after_hours_handling,
    current_ad_spend: parseNumberInput(values.current_ad_spend),
    current_ad_channels: values.current_ad_channels,
    missed_calls_weekly: parseInteger(values.missed_calls_weekly),
    avg_response_time: values.avg_response_time,
    existing_followup: values.existing_followup,
    pillar_speed: values.pillar_speed || null,
    pillar_speed_note: values.pillar_speed_note,
    pillar_estimates: values.pillar_estimates || null,
    pillar_estimates_note: values.pillar_estimates_note,
    pillar_repeat: values.pillar_repeat || null,
    pillar_repeat_note: values.pillar_repeat_note,
    past_customer_count: parseInteger(values.past_customer_count),
    avg_job_value: parseNumberInput(values.avg_job_value),
    unsold_estimates_value: parseNumberInput(values.unsold_estimates_value),
    monthly_lead_volume: parseInteger(values.monthly_lead_volume),
    monthly_jobs_booked: parseInteger(values.monthly_jobs_booked),
    close_rate: parsePercentInput(values.close_rate),
  }
}

const PILLARS: {
  key: 'pillar_speed' | 'pillar_estimates' | 'pillar_repeat'
  note: 'pillar_speed_note' | 'pillar_estimates_note' | 'pillar_repeat_note'
  label: string
  helper: string
}[] = [
  {
    key: 'pillar_speed',
    note: 'pillar_speed_note',
    label: 'Speed to Lead',
    helper: 'How fast does a new lead actually get a callback',
  },
  {
    key: 'pillar_estimates',
    note: 'pillar_estimates_note',
    label: 'Unsold Estimates',
    helper: 'Is anyone following up on quotes that did not close',
  },
  {
    key: 'pillar_repeat',
    note: 'pillar_repeat_note',
    label: 'Repeat and Referral',
    helper: 'Is anyone bringing past customers back',
  },
]

export default function HsAuditForm({
  companyId,
  audit,
}: {
  companyId: string
  audit: HsAuditRecord | null
}) {
  const router = useRouter()
  const [values, setValues] = useState<FormValues>(() => valuesFrom(audit))
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const auditIdRef = useRef(audit?.id ?? null)
  const valuesRef = useRef(values)

  useEffect(() => {
    valuesRef.current = values
  }, [values])

  const patch = useCallback(<K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }))
  }, [])

  const persist = useCallback(async () => {
    const result = await saveHsAuditAction(companyId, auditIdRef.current, toDraft(valuesRef.current))
    if (!result.ok) {
      setError(result.error)
      return
    }
    setError(null)
    if (typeof result.data?.id === 'string') auditIdRef.current = result.data.id
  }, [companyId])

  useDebounced(
    values,
    2000,
    () => {
      startTransition(() => {
        void persist()
      })
    },
    true,
  )

  const idle = useMemo(
    () =>
      formatIdleRevenue({
        past_customer_count: parseInteger(values.past_customer_count),
        avg_job_value: parseNumberInput(values.avg_job_value),
        unsold_estimates_value: parseNumberInput(values.unsold_estimates_value),
      }),
    [values.past_customer_count, values.avg_job_value, values.unsold_estimates_value],
  )

  const leadGap = useMemo(
    () => computeLeadToJobGap(parseInteger(values.monthly_lead_volume), parseInteger(values.monthly_jobs_booked)),
    [values.monthly_lead_volume, values.monthly_jobs_booked],
  )

  return (
    <div className="space-y-10">
      <section>
        <h2 className={headingClass('mb-4 text-lg font-semibold')}>Current state</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="CRM in use">
            <Input
              value={values.crm_in_use}
              onChange={(e) => patch('crm_in_use', e.target.value)}
              placeholder="ServiceTitan, Jobber, Housecall Pro, spreadsheet, none"
            />
          </Field>
          <Field label="Crew count">
            <Select value={values.crew_count} onChange={(e) => patch('crew_count', e.target.value)}>
              <option value="">Select size</option>
              {HS_CREW_COUNTS.map((count) => (
                <option key={count} value={count}>
                  {hsCrewCountLabel(count)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Trucks">
            <Input inputMode="numeric" value={values.trucks} onChange={(e) => patch('trucks', e.target.value)} />
          </Field>
          <Field label="Who answers the phone">
            <Select
              value={values.who_answers_phone}
              onChange={(e) => patch('who_answers_phone', e.target.value)}
            >
              <option value="">Select coverage</option>
              {HS_PHONE_COVERAGE.map((coverage) => (
                <option key={coverage} value={coverage}>
                  {hsPhoneCoverageLabel(coverage)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="After hours handling">
            <Input
              value={values.after_hours_handling}
              onChange={(e) => patch('after_hours_handling', e.target.value)}
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
          <Field label="Missed calls per week">
            <Input
              inputMode="numeric"
              value={values.missed_calls_weekly}
              onChange={(e) => patch('missed_calls_weekly', e.target.value)}
            />
          </Field>
          <Field label="Average response time">
            <Input
              value={values.avg_response_time}
              onChange={(e) => patch('avg_response_time', e.target.value)}
              placeholder="Same day, couple hours"
            />
          </Field>
          <Field label="Existing follow-up process">
            <Input
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
              <div
                className="flex overflow-hidden rounded-xl border border-[#2A2A3A]"
                role="radiogroup"
                aria-label={pillar.label}
              >
                {HS_PILLAR_SCORES.map((score) => {
                  const active = values[pillar.key] === score
                  return (
                    <button
                      key={score}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => patch(pillar.key, score)}
                      className="flex-1 py-2 text-sm font-semibold capitalize"
                      style={{
                        backgroundColor: active ? hsPillarColor(score) : 'transparent',
                        color: active ? '#0B0B0F' : '#6E6C80',
                      }}
                    >
                      {score}
                    </button>
                  )
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
        <h2 className={headingClass('mb-4 text-lg font-semibold')}>Idle revenue</h2>
        <div className="space-y-4">
          <Field label="Past customers not serviced in 12 months">
            <Input
              inputMode="numeric"
              className="px-4 py-3.5 text-2xl font-semibold"
              value={values.past_customer_count}
              onChange={(e) => patch('past_customer_count', e.target.value)}
            />
          </Field>
          <Field label="Average job value">
            <CurrencyInput
              large
              value={values.avg_job_value}
              onChange={(value) => patch('avg_job_value', value)}
              ariaLabel="Average job value"
            />
          </Field>
          <Field label="Unsold estimates outstanding">
            <CurrencyInput
              large
              value={values.unsold_estimates_value}
              onChange={(value) => patch('unsold_estimates_value', value)}
              ariaLabel="Unsold estimates outstanding"
            />
          </Field>
          <div className="rounded-2xl border border-[#937DFF] bg-[#241442] px-6 py-8 text-center">
            <p className="text-sm text-[#6E6C80]">Idle revenue</p>
            <p className="mt-3 font-[family-name:var(--font-plus-jakarta)] text-[48px] leading-none text-white">
              {idle}
            </p>
            <p className="mt-3 text-sm text-[#6E6C80]">(past customers × average job value) + unsold estimates</p>
          </div>
        </div>
      </section>

      <section>
        <h2 className={headingClass('mb-4 text-lg font-semibold')}>Lead flow</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Monthly lead volume">
            <Input
              inputMode="numeric"
              value={values.monthly_lead_volume}
              onChange={(e) => patch('monthly_lead_volume', e.target.value)}
            />
          </Field>
          <Field label="Monthly jobs booked">
            <Input
              inputMode="numeric"
              value={values.monthly_jobs_booked}
              onChange={(e) => patch('monthly_jobs_booked', e.target.value)}
            />
          </Field>
          <Field label="Close rate">
            <PercentInput
              value={values.close_rate}
              onChange={(value) => patch('close_rate', value)}
              ariaLabel="Close rate"
            />
          </Field>
        </div>
        {leadGap != null && (
          <div className="mt-4 rounded-2xl border border-[#2A2A3A] bg-[#1C1C26] px-6 py-6 text-center">
            <p className="text-sm text-[#6E6C80]">Leads that did not become jobs</p>
            <p className="mt-3 font-[family-name:var(--font-plus-jakarta)] text-[32px] leading-none text-white">
              {leadGap}
            </p>
          </div>
        )}
      </section>

      {error && <p className="text-sm text-[#FF6A6A]">{error}</p>}

      <Button
        type="button"
        disabled={pending}
        style={{ backgroundColor: '#6A00FF', color: '#fff' }}
        onClick={() => {
          startTransition(async () => {
            const result = await markHsAuditCompleteAction(
              companyId,
              auditIdRef.current,
              toDraft(valuesRef.current),
            )
            if (!result.ok) {
              setError(result.error)
              return
            }
            setError(null)
            if (typeof result.data?.id === 'string') auditIdRef.current = result.data.id
            router.refresh()
          })
        }}
      >
        Mark audit complete
      </Button>
    </div>
  )
}
