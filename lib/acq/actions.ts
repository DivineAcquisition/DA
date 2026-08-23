'use server';

import { submitLead, type QualifyResult } from './submit-lead';
import type { QualificationInput } from './qualify';

export type { QualifyResult };

/** Kept for any remaining server-action callers. The form posts to /api/submit-lead. */
export async function submitQualification(
  input: QualificationInput,
  host?: string,
): Promise<QualifyResult> {
  return submitLead(input, host);
}
