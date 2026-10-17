"use client";

import { useCallback, type ReactNode } from "react";
import { motion, useMotionTemplate, useMotionValue } from "motion/react";

import { cn } from "@/lib/utils";

type MagicCardProps = {
  children?: ReactNode;
  className?: string;
  contentClassName?: string;
  gradientSize?: number;
  gradientColor?: string;
  gradientFrom?: string;
  gradientTo?: string;
};

/**
 * Magic UI card: a border and a soft fill that follow the pointer.
 * Tuned to the Divine Acquisition purple. Children stay above the glow.
 */
export function MagicCard({
  children,
  className,
  contentClassName,
  gradientSize = 220,
  gradientColor = "rgba(154, 136, 252, 0.16)",
  gradientFrom = "#9A88FC",
  gradientTo = "#C3B6FE",
}: MagicCardProps) {
  const mouseX = useMotionValue(-gradientSize);
  const mouseY = useMotionValue(-gradientSize);

  const reset = useCallback(() => {
    mouseX.set(-gradientSize);
    mouseY.set(-gradientSize);
  }, [gradientSize, mouseX, mouseY]);

  const borderGlow = useMotionTemplate`radial-gradient(${gradientSize}px circle at ${mouseX}px ${mouseY}px, ${gradientFrom}, ${gradientTo}, transparent 72%)`;
  const fillGlow = useMotionTemplate`radial-gradient(${gradientSize}px circle at ${mouseX}px ${mouseY}px, ${gradientColor}, transparent 68%)`;

  return (
    <div
      className={cn("group relative isolate overflow-hidden rounded-[inherit]", className)}
      onPointerMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        mouseX.set(event.clientX - rect.left);
        mouseY.set(event.clientY - rect.top);
      }}
      onPointerLeave={reset}
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: borderGlow,
          padding: "1px",
          mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
        }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: fillGlow }}
      />
      <div className={cn("relative z-[1]", contentClassName)}>{children}</div>
    </div>
  );
}
