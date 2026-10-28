import { hsTradeLabel, type HsTrade } from '@/lib/workspace/hs-calls'
import {
  hsCompanyStageColor,
  hsCompanyStageLabel,
  type HsCompanyStage,
} from '@/lib/workspace/hs-companies'

export function StageBadge({ stage }: { stage: HsCompanyStage }) {
  const color = hsCompanyStageColor(stage)
  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
      style={{ color, borderColor: `${color}55`, backgroundColor: `${color}18` }}
    >
      {hsCompanyStageLabel(stage)}
    </span>
  )
}

export function TradeBadge({ trade }: { trade: HsTrade }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[#937DFF]/25 bg-[#937DFF]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#937DFF]">
      {hsTradeLabel(trade)}
    </span>
  )
}
