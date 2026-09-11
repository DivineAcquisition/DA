'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { markHsRequirementSentAction, saveHsRequirementAction } from '@/lib/workspace/hs-company-actions'
import {
  HS_REQUIREMENT_GROUPS,
  hsRequirementDraftFrom,
  hsRequirementsCheckedCount,
  type HsRequirementDraft,
  type HsRequirementItem,
  type HsRequirementsRecord,
} from '@/lib/workspace/hs-companies'
import { Button, Dialog, Field, Input } from '../../../components/ui'
import { useDebounced } from '../useDebounced'

function headingClass(extra = '') {
  return `font-[family-name:var(--font-plus-jakarta)] tracking-tight text-white ${extra}`
}

type FormValues = {
  items: HsRequirementItem[]
  crm_export_owner_name: string
  crm_export_owner_email: string
  crm_export_owner_phone: string
  dispatch_owner_name: string
  decision_maker_name: string
}

function valuesFrom(row: HsRequirementsRecord | null): FormValues {
  const draft = hsRequirementDraftFrom(row)
  return {
    items: draft.items.map((item) => ({ ...item })),
    crm_export_owner_name: draft.crm_export_owner_name ?? '',
    crm_export_owner_email: draft.crm_export_owner_email ?? '',
    crm_export_owner_phone: draft.crm_export_owner_phone ?? '',
    dispatch_owner_name: draft.dispatch_owner_name ?? '',
    decision_maker_name: draft.decision_maker_name ?? '',
  }
}

function toDraft(values: FormValues): HsRequirementDraft {
  return {
    items: values.items,
    crm_export_owner_name: values.crm_export_owner_name,
    crm_export_owner_email: values.crm_export_owner_email,
    crm_export_owner_phone: values.crm_export_owner_phone,
    dispatch_owner_name: values.dispatch_owner_name,
    decision_maker_name: values.decision_maker_name,
  }
}

export default function HsRequirementsForm({
  companyId,
  requirements,
}: {
  companyId: string
  requirements: HsRequirementsRecord | null
}) {
  const router = useRouter()
  const [values, setValues] = useState<FormValues>(() => valuesFrom(requirements))
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [sentAt, setSentAt] = useState(requirements?.sent_at ?? null)
  const [pending, startTransition] = useTransition()
  const requirementIdRef = useRef(requirements?.id ?? null)
  const valuesRef = useRef(values)

  useEffect(() => {
    valuesRef.current = values
  }, [values])

  const persist = useCallback(async () => {
    const result = await saveHsRequirementAction(companyId, requirementIdRef.current, toDraft(valuesRef.current))
    if (!result.ok) {
      setError(result.error)
      return
    }
    setError(null)
    if (typeof result.data?.id === 'string') requirementIdRef.current = result.data.id
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

  function toggleItem(key: string) {
    setValues((current) => ({
      ...current,
      items: current.items.map((item) => (item.key === key ? { ...item, checked: !item.checked } : item)),
    }))
  }

  const { checked, total } = hsRequirementsCheckedCount(values.items)
  const progress = total === 0 ? 0 : Math.round((checked / total) * 100)

  return (
    <div className="space-y-8">
      <div>
        <div className="mb-2 flex items-center justify-between text-sm text-[#B0AEC0]">
          <span>
            {checked} of {total} complete
          </span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[#2A2A3A]">
          <div className="h-full rounded-full bg-[#937DFF]" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {HS_REQUIREMENT_GROUPS.map((group) => (
        <section key={group}>
          <h2 className={headingClass('mb-3 text-lg font-semibold')}>{group}</h2>
          <ul className="space-y-2">
            {values.items
              .filter((item) => item.group === group)
              .map((item) => (
                <li key={item.key}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#2A2A3A] bg-[#1C1C26] px-4 py-3">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => toggleItem(item.key)}
                      className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[#937DFF]"
                    />
                    <span className="text-sm text-[#B0AEC0]">{item.label}</span>
                  </label>
                </li>
              ))}
          </ul>
        </section>
      ))}

      <section className="space-y-4">
        <h2 className={headingClass('text-lg font-semibold')}>Named owners</h2>
        <div className="rounded-2xl border border-[#2A2A3A] bg-[#1C1C26] p-4 sm:p-5">
          <p className="mb-1 text-sm font-semibold text-white">
            CRM export owner <span style={{ color: '#FF6A6A' }}>*</span>
          </p>
          {/* Visual required only. Does not block Mark as sent. */}
          <p className="mb-4 text-xs text-[#6E6C80]">The build cannot start without this</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Name">
              <Input
                value={values.crm_export_owner_name}
                onChange={(e) => setValues((current) => ({ ...current, crm_export_owner_name: e.target.value }))}
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={values.crm_export_owner_email}
                onChange={(e) => setValues((current) => ({ ...current, crm_export_owner_email: e.target.value }))}
              />
            </Field>
            <Field label="Phone">
              <Input
                type="tel"
                value={values.crm_export_owner_phone}
                onChange={(e) => setValues((current) => ({ ...current, crm_export_owner_phone: e.target.value }))}
              />
            </Field>
          </div>
        </div>
        <Field label="Dispatch owner">
          <Input
            value={values.dispatch_owner_name}
            onChange={(e) => setValues((current) => ({ ...current, dispatch_owner_name: e.target.value }))}
          />
        </Field>
        <Field label="Decision maker">
          <Input
            value={values.decision_maker_name}
            onChange={(e) => setValues((current) => ({ ...current, decision_maker_name: e.target.value }))}
          />
        </Field>
      </section>

      {error && <p className="text-sm text-[#FF6A6A]">{error}</p>}

      {!sentAt && (
        <Button type="button" style={{ backgroundColor: '#6A00FF', color: '#fff' }} onClick={() => setConfirmOpen(true)}>
          Mark as sent
        </Button>
      )}

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Mark requirements as sent">
        <p className="text-sm text-[#B0AEC0]">This starts the 72-hour clock.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setConfirmOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={pending}
            style={{ backgroundColor: '#6A00FF', color: '#fff' }}
            onClick={() => {
              startTransition(async () => {
                const result = await markHsRequirementSentAction(
                  companyId,
                  requirementIdRef.current,
                  toDraft(valuesRef.current),
                )
                if (!result.ok) {
                  setError(result.error)
                  return
                }
                setError(null)
                if (typeof result.data?.id === 'string') requirementIdRef.current = result.data.id
                if (typeof result.data?.sent_at === 'string') setSentAt(result.data.sent_at)
                setConfirmOpen(false)
                router.refresh()
              })
            }}
          >
            Confirm
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
