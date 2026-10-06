import { CalendarCheck, LayoutDashboard, MessageCircle, Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import { Panel } from '@/components/ui/panel';
import { BUILD } from '@/lib/acq/copy';

function ReplyPreview() {
  return (
    <div className="space-y-2">
      <p className="ml-auto w-fit max-w-[16rem] rounded-2xl rounded-br-md bg-white/[0.06] px-3 py-2 text-xs text-neutral-300">
        Just saw the page. Is there a time this week?
      </p>
      <p className="w-fit max-w-[16rem] rounded-2xl rounded-bl-md bg-brand-500/20 px-3 py-2 text-xs text-brand-100">
        Yes. Here is a link to book.
      </p>
    </div>
  );
}

function ShowUpPreview() {
  return (
    <ul className="space-y-2">
      {['Confirmed', 'Reminder the day before', 'Reminder the morning of'].map((item) => (
        <li
          key={item}
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-neutral-300"
        >
          <span className="size-1.5 shrink-0 rounded-full bg-brand-400" />
          {item}
        </li>
      ))}
    </ul>
  );
}

function NurturePreview() {
  return (
    <ol className="space-y-2">
      {['Not yet', 'A check-in, no pressure', 'Still open when they are ready'].map((item, index) => (
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

function DashboardPreview() {
  return (
    <ul className="grid grid-cols-4 gap-2">
      {['Leads', 'Calls', 'Shows', 'Closes'].map((label) => (
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
        return (
          <li key={item.title}>
            <Panel className="flex h-full flex-col overflow-hidden rounded-3xl p-0">
              <div className="flex min-h-36 items-center border-b border-white/[0.06] bg-white/[0.02] px-5 py-4">
                <div className="w-full">{visuals[index]}</div>
              </div>
              <div className="p-6">
                {Icon ? <Icon className="size-5 text-brand-300" aria-hidden /> : null}
                <h3 className="acq-headline mt-3 text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-400">{item.points[0]}</p>
              </div>
            </Panel>
          </li>
        );
      })}
    </ul>
  );
}
