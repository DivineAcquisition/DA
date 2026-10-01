import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type MagicCardProps = {
  children?: ReactNode;
  className?: string;
};

/** Card content frame. The pointer spotlight is intentionally not painted. */
export function MagicCard({ children, className }: MagicCardProps) {
  return <div className={cn("relative", className)}>{children}</div>;
}
