'use client';

import { useEffect, useState } from 'react';
import { markAssessmentUsed } from '@/lib/assessment/actions';
import { clearStoredAssessmentToken, readStoredAssessmentToken } from './TokenBridge';

/** Marks the invite used when GHL lands here without ?token= in the URL. */
export default function ThankYouMarker({ tokenFromQuery }: { tokenFromQuery?: string }) {
  const [done, setDone] = useState(Boolean(tokenFromQuery));

  useEffect(() => {
    if (done) return;
    const token = tokenFromQuery || readStoredAssessmentToken();
    if (!token) {
      setDone(true);
      return;
    }
    void markAssessmentUsed(token).finally(() => {
      clearStoredAssessmentToken();
      setDone(true);
    });
  }, [done, tokenFromQuery]);

  return null;
}
