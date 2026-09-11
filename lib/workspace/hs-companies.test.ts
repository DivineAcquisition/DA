import { describe, expect, it } from 'vitest'
import {
  HS_OBJECTION_CHIPS,
  HS_REQUIREMENT_ITEMS,
  computeIdleRevenue,
  computeLeadToJobGap,
  formatHsCountdown,
  formatPercentInput,
  formatUsd,
  formatUsdInput,
  hsAuditComplete,
  hsDebriefComplete,
  hsFormStatus,
  hsMatchesNameSearch,
  hsRequirementsComplete,
  hsRequirementsDueAt,
  hsStageAfterDebriefOutcome,
  parsePercentInput,
  parseUsdInput,
  mergeHsRequirementItems,
  seedHsRequirementItems,
} from '@/lib/workspace/hs-companies'

describe('computeIdleRevenue', () => {
  it('returns null when all three inputs are null', () => {
    expect(computeIdleRevenue(null, null, null)).toBeNull()
  })

  it('treats missing inputs as zero once any value is present', () => {
    expect(computeIdleRevenue(40, null, null)).toBe(0)
    expect(computeIdleRevenue(40, 2500, null)).toBe(100_000)
    expect(computeIdleRevenue(null, null, 18_000)).toBe(18_000)
  })

  it('adds unsold estimates to the past-customer product', () => {
    expect(computeIdleRevenue(40, 2500, 18_000)).toBe(118_000)
  })
})

describe('computeLeadToJobGap', () => {
  it('returns null unless both inputs are present', () => {
    expect(computeLeadToJobGap(null, 20)).toBeNull()
    expect(computeLeadToJobGap(80, null)).toBeNull()
    expect(computeLeadToJobGap(null, null)).toBeNull()
  })

  it('subtracts booked jobs from lead volume', () => {
    expect(computeLeadToJobGap(80, 20)).toBe(60)
  })
})

describe('currency and percent formatting', () => {
  it('formats USD without cents', () => {
    expect(formatUsd(118000)).toBe('$118,000')
  })

  it('parses typed currency back to a number', () => {
    expect(parseUsdInput('$1,200')).toBe(1200)
    expect(parseUsdInput('')).toBeNull()
  })

  it('round-trips a currency input value', () => {
    expect(formatUsdInput(1200)).toBe('1,200')
    expect(formatUsdInput(null)).toBe('')
  })

  it('clamps percentages to 0–100', () => {
    expect(parsePercentInput('45')).toBe(45)
    expect(parsePercentInput('140')).toBe(100)
    expect(parsePercentInput('')).toBeNull()
    expect(formatPercentInput(45)).toBe('45')
  })
})

describe('form completeness', () => {
  it('treats an audit as complete only when completed_at is set', () => {
    expect(hsAuditComplete(null)).toBe(false)
    expect(hsAuditComplete({ completed_at: null })).toBe(false)
    expect(hsAuditComplete({ completed_at: '2026-09-11T12:00:00Z' })).toBe(true)
  })

  it('treats a debrief as complete only when outcome is set', () => {
    expect(hsDebriefComplete(null)).toBe(false)
    expect(hsDebriefComplete({ outcome: null })).toBe(false)
    expect(hsDebriefComplete({ outcome: 'thinking' })).toBe(true)
  })

  it('treats requirements as complete only when every seeded item is checked', () => {
    expect(hsRequirementsComplete(null)).toBe(false)
    const items = seedHsRequirementItems()
    expect(hsRequirementsComplete(items)).toBe(false)
    expect(hsRequirementsComplete(items.map((item) => ({ ...item, checked: true })))).toBe(true)
  })

  it('maps save state onto tab dots', () => {
    expect(hsFormStatus(false, false)).toBe('empty')
    expect(hsFormStatus(true, false)).toBe('started')
    expect(hsFormStatus(true, true)).toBe('complete')
  })
})

describe('debrief stage side effects', () => {
  it('moves verbal yes to proposal sent and not a fit to lost', () => {
    expect(hsStageAfterDebriefOutcome('verbal_yes')).toBe('proposal_sent')
    expect(hsStageAfterDebriefOutcome('not_a_fit')).toBe('lost')
  })

  it('leaves other outcomes unchanged', () => {
    expect(hsStageAfterDebriefOutcome('thinking')).toBeNull()
    expect(hsStageAfterDebriefOutcome('needs_partner')).toBeNull()
    expect(hsStageAfterDebriefOutcome('no_decision')).toBeNull()
  })
})

describe('requirements seed and countdown', () => {
  it('seeds sixteen unchecked items across three groups', () => {
    const items = seedHsRequirementItems()
    expect(items).toHaveLength(16)
    expect(HS_REQUIREMENT_ITEMS).toHaveLength(16)
    expect(items.every((item) => item.checked === false)).toBe(true)
    expect(new Set(items.map((item) => item.group))).toEqual(new Set(['Access', 'People', 'Assets']))
  })

  it('sets due_at 72 hours after sent_at', () => {
    const sent = new Date('2026-09-11T12:00:00Z')
    expect(hsRequirementsDueAt(sent).toISOString()).toBe('2026-09-14T12:00:00.000Z')
  })

  it('formats remaining time and overdue state', () => {
    const due = '2026-09-12T12:00:00.000Z'
    expect(formatHsCountdown(due, new Date('2026-09-12T10:00:00.000Z'))).toEqual({
      label: '2h 0m remaining',
      overdue: false,
    })
    expect(formatHsCountdown(due, new Date('2026-09-13T12:00:00.000Z'))).toEqual({
      label: 'Overdue',
      overdue: true,
    })
  })
})

describe('list search and objection chips', () => {
  it('matches company or contact name', () => {
    expect(hsMatchesNameSearch('Apex HVAC', 'Jordan Lee', 'apex')).toBe(true)
    expect(hsMatchesNameSearch('Apex HVAC', 'Jordan Lee', 'jordan')).toBe(true)
    expect(hsMatchesNameSearch('Apex HVAC', 'Jordan Lee', 'roof')).toBe(false)
  })

  it('keeps the hardcoded objection list', () => {
    expect(HS_OBJECTION_CHIPS).toContain('Price')
    expect(HS_OBJECTION_CHIPS).toHaveLength(12)
  })
})

describe('requirement item merge', () => {
  it('keeps hardcoded labels and restores checked state by key', () => {
    const merged = mergeHsRequirementItems([
      { key: 'google_ads_access', checked: true },
      { key: 'unknown', checked: true },
    ])
    expect(merged).toHaveLength(16)
    expect(merged.find((item) => item.key === 'google_ads_access')?.checked).toBe(true)
    expect(merged.find((item) => item.key === 'job_photos')?.checked).toBe(false)
    expect(merged.some((item) => item.key === 'unknown')).toBe(false)
  })
})
