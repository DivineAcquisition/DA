'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/workspace/db';
import { buildGhlSetup, type GhlSetupSummary } from './ghl-setup';

export async function buildGhlSetupAction(): Promise<
  { ok: true; summary: GhlSetupSummary } | { ok: false; error: string }
> {
  const session = await requireAdmin();
  if (!session) return { ok: false, error: 'Admin access required.' };
  try {
    const summary = await buildGhlSetup('workspace');
    revalidatePath('/workspace/settings');
    return { ok: true, summary };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Build in GHL failed.' };
  }
}
