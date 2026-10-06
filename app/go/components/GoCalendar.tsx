'use client';

import Script from 'next/script';
import { GO_CALENDAR_EMBED_SCRIPT, GO_CALENDAR_IFRAME_ID, GO_CALENDAR_SRC } from '@/lib/go/config';

export function GoCalendar() {
  return (
    <div className="go-calendar-wrap">
      <Script src={GO_CALENDAR_EMBED_SCRIPT} strategy="afterInteractive" />
      <div className="lx-video-shell">
        <iframe
          src={GO_CALENDAR_SRC}
          title="Divine Acquisition strategy session"
          id={GO_CALENDAR_IFRAME_ID}
          className="go-calendar"
        />
      </div>
    </div>
  );
}
