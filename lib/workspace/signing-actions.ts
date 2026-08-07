'use server';

import { completeSigning } from './signing';

export async function completeSigningAction(input: {
  token: string;
  values: Record<string, string>;
  signatureDataUrl: string;
  consents: Record<string, boolean>;
}): Promise<{ ok: true; signedDocumentUrl: string | null } | { ok: false; error: string }> {
  return completeSigning(input);
}
