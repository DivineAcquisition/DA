import { ArrowRight } from "lucide-react"
import { type ComponentPropsWithoutRef, type ReactNode } from "react"

import { cn } from "@/lib/utils"

interface BentoGridProps extends ComponentPropsWithoutRef<"div"> {
  children: ReactNode
  className?: string
}

interface BentoCardProps extends ComponentPropsWithoutRef<"div"> {
  name: string
  className?: string
  background?: ReactNode
  Icon: React.ElementType
  description: string
  href?: string
  cta?: string
}

/**
 * Magic UI bento layout, adapted to the ink panels used on this site.
 * Cards do not require a link, so a feature can stand on its own copy.
 */
export function BentoGrid({ children, className, ...props }: BentoGridProps) {
  return (
    <div
      className={cn("grid w-full grid-cols-1 gap-4 md:grid-cols-3", className)}
      {...props}
    >
      {children}
    </div>
  )
}

export function BentoCard({
  name,
  className,
  background,
  Icon,
  description,
  href,
  cta,
  ...props
}: BentoCardProps) {
  return (
    <div
      className={cn(
        "group panel relative flex min-h-[22rem] flex-col justify-end overflow-hidden rounded-3xl",
        className,
      )}
      {...props}
    >
      {background ? (
        <div className="pointer-events-none absolute inset-0">{background}</div>
      ) : null}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-[#0b0a11] via-[#0b0a11]/92 to-transparent" />
      <div className="relative z-[1] p-6">
        <Icon className="size-7 text-brand-300" aria-hidden />
        <h3 className="acq-headline mt-4 text-xl font-semibold text-white">{name}</h3>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-neutral-300">{description}</p>
        {href && cta ? (
          <a
            href={href}
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-200"
          >
            {cta}
            <ArrowRight className="size-4" aria-hidden />
          </a>
        ) : null}
      </div>
    </div>
  )
}
