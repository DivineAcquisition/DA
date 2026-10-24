import { cn } from '@/lib/utils';

interface HeroPillProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  text: React.ReactNode;
  className?: string;
  pillClassName?: string;
  /**
   * @default true
   */
  animate?: boolean;
}

/** 21st.dev Hero Pill, adapted to the acquisition ink and purple. */
export function HeroPill({
  icon,
  text,
  className,
  pillClassName,
  animate = true,
  ...props
}: HeroPillProps) {
  return (
    <div className={cn(animate && 'animate-slide-up-fade', className)} {...props}>
      <p
        className={cn(
          'inline-flex items-center justify-center rounded-full border border-[rgba(154,136,252,0.35)] bg-[rgba(154,136,252,0.1)] px-3 py-1 text-sm font-medium text-[var(--lx-accent)] shadow-sm shadow-black/30',
          pillClassName,
        )}
      >
        {icon ? <span className="mr-2 flex shrink-0 border-r border-white/15 pr-2">{icon}</span> : null}
        {text}
      </p>
    </div>
  );
}
