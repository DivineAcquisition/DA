'use client';

import type { ReactNode } from 'react';
import Logo from '@/app/components/Logo';
import { Particles } from '@/components/ui/particles';
import { ShineBorder } from '@/components/ui/shine-border';

/** The Vistrial sign-in desk: crest, glow, and a lit card. */
export default function TeamAuthDesk({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="auth-stage">
      <div className="auth-stage-atmosphere" aria-hidden>
        <Particles className="absolute inset-0" quantity={56} color="#9A88FC" ease={70} size={0.45} />
        <div className="auth-stage-glow" />
        <div className="auth-stage-glow-aux" />
        <div className="auth-stage-grid" />
      </div>
      <main className="auth-stage-frame">
        <div className="auth-desk-inner animate-rise">
          <ShineBorder borderWidth={1} duration={14} shineColor={['#9A88FC', '#C3B6FE', '#7C63FA']} />
          <Logo markOnly title="" className="auth-mark" />
          <p className="auth-eyebrow">{eyebrow}</p>
          <h1 className="auth-title">{title}</h1>
          {subtitle ? <p className="auth-subtitle">{subtitle}</p> : null}
          {children ? <div className="auth-desk-body">{children}</div> : null}
          <p className="auth-desk-foot">
            Divine Acquisition is invite only.{' '}
            <a href="https://acq.divineacquisition.io/privacy">Privacy</a>
            {' · '}
            <a href="https://acq.divineacquisition.io/terms">Terms</a>
          </p>
        </div>
      </main>
    </div>
  );
}
