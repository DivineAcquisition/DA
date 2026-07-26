'use client';

import { useEffect, useRef } from 'react';
import { btnSecondary, btnSizeSm } from '@/app/components/ui';

/**
 * Records that the client opened this document, once per visit.
 *
 * Opens are tracked because a client who has not opened three monthly reports is
 * telling you something before they cancel. Nothing here is hidden from them: the
 * page says the open was recorded.
 */
export default function DocumentReader({
  recordOpen,
}: {
  recordOpen: () => Promise<void>;
}) {
  const recorded = useRef(false);

  useEffect(() => {
    if (recorded.current) return;
    recorded.current = true;
    void recordOpen();
  }, [recordOpen]);

  return (
    <button type="button" onClick={() => window.print()} className={`${btnSecondary} ${btnSizeSm}`}>
      Print or save as PDF
    </button>
  );
}
