'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { createHsCompanyAction } from '@/lib/workspace/hs-company-actions'
import { formatDate } from '@/lib/workspace/format'
import { HS_TRADES, hsTradeLabel, type HsTrade } from '@/lib/workspace/hs-calls'
import {
  HS_COMPANY_STAGES,
  formatCurrency,
  hsCompanyStageLabel,
  hsMatchesNameSearch,
  type HsCompanyListRow,
  type HsCompanyStage,
} from '@/lib/workspace/hs-companies'
import { Button, DataTable, Dialog, EmptyState, Field, Input, PageHeader, Select } from '../../../components/ui'
import { StageBadge, TradeBadge } from './badges'

export default function HsCompaniesList({ companies }: { companies: HsCompanyListRow[] }) {
  const [query, setQuery] = useState('')
  const [stages, setStages] = useState<HsCompanyStage[]>([])
  const [trades, setTrades] = useState<HsTrade[]>([])
  const [open, setOpen] = useState(false)

  const visible = useMemo(() => {
    return companies.filter((row) => {
      if (!hsMatchesNameSearch(row.company_name, row.contact_name, query)) return false
      if (stages.length > 0 && !stages.includes(row.stage)) return false
      if (trades.length > 0 && !trades.includes(row.trade)) return false
      return true
    })
  }, [companies, query, stages, trades])

  function toggleStage(stage: HsCompanyStage) {
    setStages((current) =>
      current.includes(stage) ? current.filter((item) => item !== stage) : [...current, stage],
    )
  }

  function toggleTrade(trade: HsTrade) {
    setTrades((current) =>
      current.includes(trade) ? current.filter((item) => item !== trade) : [...current, trade],
    )
  }

  return (
    <div>
      <PageHeader
        title="HS companies"
        description="Audit, debrief, and kickoff requirements. Newest first."
        actions={
          <Button type="button" onClick={() => setOpen(true)} style={{ backgroundColor: '#6A00FF', color: '#fff' }}>
            New company
          </Button>
        }
      />

      <div className="mb-5 flex flex-col gap-3">
        <label className="block flex-1 sm:max-w-sm">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6E6C80]">
            Search
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Company or contact"
            className="w-full rounded-xl border border-[#2A2A3A] bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-[#937DFF]/60"
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {HS_COMPANY_STAGES.map((stage) => {
            const active = stages.includes(stage)
            return (
              <button
                key={stage}
                type="button"
                onClick={() => toggleStage(stage)}
                className="rounded-full border px-3 py-1 text-[12px] font-semibold transition"
                style={{
                  color: active ? '#937DFF' : '#6E6C80',
                  borderColor: active ? '#937DFF88' : '#2A2A3A',
                  backgroundColor: active ? '#937DFF22' : 'transparent',
                }}
              >
                {hsCompanyStageLabel(stage)}
              </button>
            )
          })}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {HS_TRADES.map((trade) => {
            const active = trades.includes(trade)
            return (
              <button
                key={trade}
                type="button"
                onClick={() => toggleTrade(trade)}
                className="rounded-full border px-3 py-1 text-[12px] font-semibold transition"
                style={{
                  color: active ? '#937DFF' : '#6E6C80',
                  borderColor: active ? '#937DFF88' : '#2A2A3A',
                  backgroundColor: active ? '#937DFF22' : 'transparent',
                }}
              >
                {hsTradeLabel(trade)}
              </button>
            )
          })}
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={companies.length === 0 ? 'No companies yet' : 'No matching companies'}
          description={
            companies.length === 0
              ? 'Create a company to open the audit, debrief, and requirements forms.'
              : 'Clear the stage or trade pills, or search, to see more records.'
          }
        />
      ) : (
        <DataTable headers={['Company', 'Trade', 'Contact', 'Stage', 'Idle revenue', 'Created']}>
          {visible.map((row) => (
            <tr key={row.id} className="hover:bg-white/[0.02]">
              <td className="px-4 py-3">
                <Link
                  href={`/workspace/hs/companies/${row.id}/audit`}
                  className="font-medium text-white hover:text-[#937DFF]"
                >
                  {row.company_name}
                </Link>
              </td>
              <td className="px-4 py-3">
                <TradeBadge trade={row.trade} />
              </td>
              <td className="px-4 py-3 text-[#B0AEC0]">{row.contact_name}</td>
              <td className="px-4 py-3">
                <StageBadge stage={row.stage} />
              </td>
              <td className="px-4 py-3 tabular-nums text-white">{formatCurrency(row.idle_revenue)}</td>
              <td className="px-4 py-3 text-[#6E6C80]">{formatDate(row.created_at)}</td>
            </tr>
          ))}
        </DataTable>
      )}

      <NewCompanyDialog open={open} onClose={() => setOpen(false)} />
    </div>
  )
}

function NewCompanyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <Dialog open={open} onClose={onClose} title="New company">
      <form
        className="space-y-4"
        action={(formData) => {
          setError(null)
          startTransition(async () => {
            const result = await createHsCompanyAction(formData)
            if (result && !result.ok) setError(result.error)
          })
        }}
      >
        <Field label="Company name">
          <Input name="company_name" required autoComplete="organization" />
        </Field>
        <Field label="Contact name">
          <Input name="contact_name" required autoComplete="name" />
        </Field>
        <Field label="Trade">
          <Select name="trade" required defaultValue="">
            <option value="" disabled>
              Select trade
            </option>
            {HS_TRADES.map((trade) => (
              <option key={trade} value={trade}>
                {hsTradeLabel(trade)}
              </option>
            ))}
          </Select>
        </Field>
        {error && <p className="text-sm text-[#FF6A6A]">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending} style={{ backgroundColor: '#6A00FF', color: '#fff' }}>
            {pending ? 'Creating…' : 'Create company'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
