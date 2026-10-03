import { CalendarCheck, LayoutDashboard, MessageCircle, Zap } from 'lucide-react';
import { BentoCard, BentoGrid } from '@/components/ui/bento-grid';
import { BUILD } from '@/lib/acq/copy';

function ReplyPreview() {
  return (
    <div className="absolute inset-x-6 top-6 space-y-2">
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
    <ul className="absolute inset-x-6 top-6 space-y-2">
      {['Confirmed', 'Reminder the day before', 'Reminder the morning of'].map((item) => (
        <li
          key={item}
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-neutral-300"
        >
          <span className="size-1.5 rounded-full bg-brand-400" />
          {item}
        </li>
      ))}
    </ul>
  );
}

function NurturePreview() {
  return (
    <ol className="absolute inset-x-6 top-6 space-y-2">
      {['Not yet', 'A check-in, no pressure', 'Still open when they are ready'].map((item, index) => (
        <li key={item} className="flex items-center gap-3 text-xs text-neutral-300">
          <span className="flex size-6 items-center justify-center rounded-full border border-white/10 text-[11px] text-brand-200">
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
    <ul className="absolute inset-x-6 top-6 grid grid-cols-4 gap-2">
      {['Leads', 'Calls', 'Shows', 'Closes'].map((label) => (
        <li
          key={label}
          className="rounded-xl border border-white/10 bg-white/[0.03] px-2 py-3 text-center text-[11px] font-medium text-neutral-400"
        >
          {label}
        </li>
      ))}
    </ul>
  );
}

const visuals = [ReplyPreview, ShowUpPreview, NurturePreview, DashboardPreview] as const;
const icons = [Zap, CalendarCheck, MessageCircle, LayoutDashboard] as const;
const spans = ['md:col-span-2', 'md:col-span-1', 'md:col-span-1', 'md:col-span-2'] as const;

export function BuildBento() {
  return (
    <BentoGrid className="mt-8">
      {BUILD.items.map((item, index) => {
        const Icon = icons[index];
        const Visual = visuals[index];
        return (
          <BentoCard
            key={item.title}
            name={item.title}
            description={item.body}
            Icon={Icon}
            className={spans[index]}
            background={<Visual />}
          />
        );
      })}
    </BentoGrid>
  );
}
