'use client';

import { useEffect, useState } from 'react';
import { GO_DEMO_MEDIA_ID } from '@/lib/go/config';
import { CTA_LABEL, DEMO_LABEL } from '@/lib/go/copy';
import { GoWistia } from './GoWistia';

export function DemoLink() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <p className="go-demo">
        See our{' '}
        <button type="button" onClick={() => setOpen(true)}>
          {DEMO_LABEL}
        </button>
        .
      </p>
      {open ? (
        <div
          className="go-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="AI booking layer demo"
          onClick={() => setOpen(false)}
        >
          <button type="button" className="go-lightbox-close" onClick={() => setOpen(false)}>
            Close
          </button>
          <div className="go-lightbox-panel" onClick={(event) => event.stopPropagation()}>
            <div className="lx-video-shell">
              <GoWistia mediaId={GO_DEMO_MEDIA_ID} />
            </div>
            <div className="lx-center">
              <a className="acq-button" href="#calendar" onClick={() => setOpen(false)}>
                {CTA_LABEL}
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
