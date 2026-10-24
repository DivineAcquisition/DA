'use client';

import { cn } from '@/lib/utils';

export interface OfferBentoItem {
  title: string;
  description: string;
  icon: React.ReactNode;
  status?: string;
  meta?: string;
  colSpan?: number;
}

interface OfferBentoProps {
  items: OfferBentoItem[];
  className?: string;
}

/**
 * 21st.dev bento grid (kokonutd), restyled for this dark page.
 * Items come from the caller. There is no sample marketing copy.
 */
export function OfferBento({ items, className }: OfferBentoProps) {
  return (
    <div className={cn('grid w-full grid-cols-1 gap-3 md:grid-cols-3', className)}>
      {items.map((item) => (
        <div
          key={item.title}
          className={cn(
            'group relative overflow-hidden rounded-xl border border-white/10 bg-black p-4 transition-all duration-300',
            'hover:-translate-y-0.5 hover:shadow-[0_2px_12px_rgba(255,255,255,0.04)]',
            item.colSpan === 2 ? 'md:col-span-2' : 'col-span-1',
          )}
        >
          <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[length:4px_4px]" />
          </div>
          <div className="relative flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex size-8 items-center justify-center rounded-lg bg-white/10 text-[#C3B6FE]">{item.icon}</div>
              {item.status ? (
                <span className="rounded-lg bg-white/10 px-2 py-1 text-xs font-medium text-neutral-300">{item.status}</span>
              ) : null}
            </div>
            <div className="space-y-2">
              <h3 className="text-[15px] font-medium tracking-tight text-white">
                {item.title}
                {item.meta ? <span className="ml-2 text-xs font-normal text-neutral-400">{item.meta}</span> : null}
              </h3>
              <p className="text-sm leading-snug text-neutral-300">{item.description}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
