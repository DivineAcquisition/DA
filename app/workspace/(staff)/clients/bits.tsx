import { STATUS_LABEL, type EngagementStatus } from '@/lib/clients/desk';
import { Pill, type Tone } from '../components/desk';

const STATUS_TONE: Record<EngagementStatus, Tone> = {
  audit: 'neutral',
  installing: 'warn',
  active: 'good',
  paused: 'warn',
  ended: 'bad',
};

export function EngagementPill({ status }: { status: string }) {
  const key = status as EngagementStatus;
  return <Pill tone={STATUS_TONE[key] ?? 'neutral'}>{STATUS_LABEL[key] ?? status}</Pill>;
}
