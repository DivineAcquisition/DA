'use server';

import { createCallAction } from './call-actions';
import { createHsCallAction } from './hs-call-actions';
import { createHsCompanyAction } from './hs-company-actions';
import { nicheFamily, parseNiche } from './niches';
import { createPracticeAction } from './practice-actions';
import type { ActionResult } from './types';

function withAccountName(formData: FormData): FormData {
  const accountName = String(formData.get('account_name') ?? formData.get('practice_name') ?? formData.get('company_name') ?? '').trim();
  if (accountName) {
    formData.set('practice_name', accountName);
    formData.set('company_name', accountName);
  }
  return formData;
}

export async function createWorkspaceCallAction(formData: FormData): Promise<ActionResult> {
  const niche = parseNiche(String(formData.get('niche') ?? ''));
  if (!niche) return { ok: false, error: 'Select a niche.' };
  const next = withAccountName(formData);
  if (nicheFamily(niche) === 'practice') {
    next.set('practice_type', niche);
    return createCallAction(next);
  }
  next.set('trade', niche);
  return createHsCallAction(next);
}

export async function createWorkspaceAccountAction(formData: FormData): Promise<ActionResult> {
  const niche = parseNiche(String(formData.get('niche') ?? ''));
  if (!niche) return { ok: false, error: 'Select a niche.' };
  const next = withAccountName(formData);
  if (nicheFamily(niche) === 'practice') {
    next.set('practice_type', niche);
    return createPracticeAction(next);
  }
  next.set('trade', niche);
  return createHsCompanyAction(next);
}
