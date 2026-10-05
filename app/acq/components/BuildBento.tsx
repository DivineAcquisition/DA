import { CalendarCheck, LayoutDashboard, MessageCircle, Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import { Panel } from '@/components/ui/panel';
import { BUILD } from '@/lib/acq/copy';

function ReplyPreview() {
  return (
    <ol className="space-y-2">
      {['Day 1, welcome', 'Day 3, first win', 'Day 7, milestone'].map((item, index) => (
        <li key={item} className="flex items-center gap-3 text-xs text-neutral-300">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-white/10 text-[11px] text-brand-200">
            {index + 1}
          </span>
          {item}
        </li>
      ))}
    </ol>
  );
}

function ShowUpPreview() {
  return (
    <ul className="space-y-2">
      {[
        ['bg-emerald-400', 'Green, active'],
        ['bg-amber-300', 'Yellow, slipping'],
        ['bg-rose-400', 'Red, at risk'],
      ].map(([dot, label]) => (
        <li
          key={label}
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-neutral-300"
        >
          <span className={`size-1.5 shrink-0 rounded-full ${dot}`} />
          {label}
        </li>
      ))}
    </ul>
  );
}

function NurturePreview() {
  return (
    <div className="space-y-2">
      <p className="w-fit max-w-[16rem] rounded-2xl rounded-bl-md bg-white/[0.06] px-3 py-2 text-xs text-neutral-300">
        Day 60. Here is what members in your spot did next.
      </p>
      <p className="ml-auto w-fit max-w-[16rem] rounded-2xl rounded-br-md bg-brand-500/20 px-3 py-2 text-xs text-brand-100">
        Day 90. The annual plan is open.
      </p>
    </div>
  );
}

function DashboardPreview() {
  return (
    <ul className="grid grid-cols-4 gap-2">
      {['Active', 'Churn', 'At risk', 'MRR'].map((label) => (
        <li
          key={label}
          className="rounded-xl border border-white/10 bg-white/[0.03] px-2 py-3 text-center text-[11px] font-medium text-neutral-300"
        >
          {label}
        </li>
      ))}
    </ul>
  );
}

const visuals: ReactNode[] = [
  <ReplyPreview key="reply" />,
  <ShowUpPreview key="show" />,
  <NurturePreview key="nurture" />,
  <DashboardPreview key="dash" />,
];
const icons = [Zap, CalendarCheck, MessageCircle, LayoutDashboard] as const;

export function BuildBento() {
  return (
    <ul className="mt-8 grid gap-4 md:grid-cols-2">
      {BUILD.items.map((item, index) => {
        const Icon = icons[index];
        const visual = visuals[index];
        return (
          <li key={item.title}>
            <Panel className="flex h-full flex-col overflow-hidden rounded-3xl p-0">
              {visual ? (
                <div className="flex min-h-36 items-center border-b border-white/[0.06] bg-white/[0.02] px-5 py-4">
                  <div className="w-full">{visual}</div>
                </div>
              ) : null}
              <div className="p-6">
                {Icon ? <Icon className="size-5 text-brand-300" aria-hidden /> : null}
                <h3 className="acq-headline mt-3 text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-400">{item.body}</p>
              </div>
            </Panel>
          </li>
        );
      })}
    </ul>
  );
}
