import type { ReactNode } from 'react';
import { ArrowRight, ArrowUpRight } from 'lucide-react';

import { BlurFade } from '@/components/ui/blur-fade';
import type { Tool } from '@/lib/site/content';
import { cn } from '@/lib/utils';

export const shell = 'mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8';

/** `// 02  THE GAP BETWEEN ACTIVITY AND EXECUTION` */
export function Eyebrow({ index, children, className }: { index?: string; children: ReactNode; className?: string }) {
  return (
    <p className={cn('da-mono flex items-center gap-2 text-[11px] tracking-[0.18em] text-white/55 uppercase', className)}>
      {index ? <span className="text-[#9a88fc]">{'// '}{index}</span> : null}
      <span>{children}</span>
    </p>
  );
}

export function SectionHeading({
  index,
  eyebrow,
  headline,
  lead,
  align = 'start',
  className,
}: {
  index?: string;
  eyebrow: string;
  headline: string;
  lead?: string;
  align?: 'start' | 'center';
  className?: string;
}) {
  const center = align === 'center';
  return (
    <div className={cn(center && 'mx-auto text-center', className)}>
      <Eyebrow index={index} className={cn(center && 'justify-center')}>
        {eyebrow}
      </Eyebrow>
      <h2
        className={cn(
          'da-display da-gradient-text-soft mt-5 max-w-3xl text-[2rem] leading-[1.06] font-semibold text-balance sm:text-5xl lg:text-[3.4rem]',
          center && 'mx-auto',
        )}
      >
        {headline}
      </h2>
      {lead ? (
        <p className={cn('mt-5 max-w-2xl text-base leading-relaxed text-[#a3a3a3] sm:text-lg', center && 'mx-auto')}>{lead}</p>
      ) : null}
    </div>
  );
}

export function Section({
  id,
  children,
  className,
  bare = false,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  /** Skip the fade-in wrapper (for sections that animate themselves). */
  bare?: boolean;
}) {
  return (
    <section id={id} className={cn('relative scroll-mt-28 py-24 sm:py-32', className)}>
      {bare ? (
        <div className={shell}>{children}</div>
      ) : (
        <BlurFade inView inViewMargin="-80px" offset={14} blur="4px" duration={0.6} className={shell}>
          {children}
        </BlurFade>
      )}
    </section>
  );
}

export function ButtonLink({
  href,
  children,
  variant = 'primary',
  size = 'lg',
  className,
  external,
}: {
  href: string;
  children: ReactNode;
  variant?: 'primary' | 'ghost';
  size?: 'md' | 'lg';
  className?: string;
  external?: boolean;
}) {
  const opensElsewhere = external ?? href.startsWith('http');
  return (
    <a
      href={href}
      {...(opensElsewhere ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className={cn(
        'group inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl font-medium whitespace-nowrap text-white outline-none focus-visible:ring-2 focus-visible:ring-[#9a88fc] focus-visible:ring-offset-2 focus-visible:ring-offset-black',
        variant === 'primary' ? 'da-btn-primary' : 'da-btn-ghost',
        size === 'lg' ? 'h-12 px-6 text-[15px]' : 'h-10 px-4 text-sm',
        className,
      )}
    >
      <span className="relative z-[1]">{children}</span>
      {opensElsewhere ? (
        <ArrowUpRight className="relative z-[1] size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
      ) : (
        <ArrowRight className="relative z-[1] size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
      )}
    </a>
  );
}

/** Text link with an arrow, for the "Explore…" calls to action. */
export function ArrowLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  const external = href.startsWith('http');
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className={cn(
        'da-mono group inline-flex items-center gap-2 text-xs tracking-[0.16em] text-[#c9bcff] uppercase transition-colors hover:text-white',
        className,
      )}
    >
      {children}
      <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" aria-hidden />
    </a>
  );
}

/** A tool's brand mark in a small dark tile. Decorative unless `labelled`. */
export function ToolLogo({
  tool,
  size = 18,
  className,
  tile = true,
  labelled = false,
}: {
  tool: Tool;
  size?: number;
  className?: string;
  tile?: boolean;
  labelled?: boolean;
}) {
  const mark = (
    // eslint-disable-next-line @next/next/no-img-element -- tiny static SVGs; next/image adds nothing here
    <img
      src={tool.src}
      alt={labelled ? tool.name : ''}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      style={{ width: size, height: size }}
      className="object-contain"
    />
  );
  if (!tile) return <span className={cn('inline-flex', className)} title={tool.name}>{mark}</span>;
  return (
    <span
      title={tool.name}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg bg-[#1a1a1a] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]',
        className,
      )}
      style={{ width: size + 14, height: size + 14 }}
    >
      {mark}
    </span>
  );
}
