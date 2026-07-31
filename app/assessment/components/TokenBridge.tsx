'use client';

import { useEffect } from 'react';

const STORAGE_KEY = 'da_assessment_token';

/** Keeps the invite token available for the thank-you page after GHL redirects. */
export function PersistAssessmentToken({ token }: { token: string }) {
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, token);
    } catch {
      // Private mode / blocked storage — thank-you can still use ?token=
    }
  }, [token]);

  return null;
}

export function readStoredAssessmentToken(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearStoredAssessmentToken() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
