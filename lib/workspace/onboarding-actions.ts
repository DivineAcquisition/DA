'use server';

import { submitOnboarding } from './onboarding';

export async function submitOnboardingAction(input: {
  token: string;
  answers: Record<string, string>;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  return submitOnboarding(input);
}
