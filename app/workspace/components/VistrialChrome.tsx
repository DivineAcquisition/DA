'use client';

import type { ReactNode } from 'react';
import { Particles } from '@/components/ui/particles';
import { MagicCard } from '@/components/ui/magic-card';

/** Landing atmosphere: a quiet grid, a brand glow, and a few particles. */
export function WorkspaceAtmosphere() {
  return (
    <div className="ws-atmosphere" aria-hidden>
      <Particles className="absolute inset-0" quantity={28} color="#9A88FC" ease={80} size={0.35} />
      <div className="ws-atmosphere-glow" />
      <div className="ws-atmosphere-grid" />
    </div>
  );
}

/** The landing status chip: a live dot and a short label. */
export function StatusPill({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p className={`status-pill ${className}`}>
      <span className="status-pill-dot" aria-hidden />
      {children}
    </p>
  );
}

/** Landing card: the border and fill follow the pointer. */
export function PointerCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <MagicCard className={className}>{children}</MagicCard>;
}
