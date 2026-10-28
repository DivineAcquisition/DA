import { practiceTypeLabel, type PracticeType } from '@/lib/workspace/calls';
import { practiceStageColor, practiceStageLabel, type PracticeStage } from '@/lib/workspace/practices';

export function StageBadge({ stage }: { stage: PracticeStage }) {
  const color = practiceStageColor(stage);
  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
      style={{ color, borderColor: `${color}55`, backgroundColor: `${color}18` }}
    >
      {practiceStageLabel(stage)}
    </span>
  );
}

export function TypeBadge({ type }: { type: PracticeType }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[#937DFF]/25 bg-[#937DFF]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#937DFF]">
      {practiceTypeLabel(type)}
    </span>
  );
}
