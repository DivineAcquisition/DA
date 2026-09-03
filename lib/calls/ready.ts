import { resolveAirtableApiKey } from '@/lib/acq/airtable-key';
import { callsTablesConfigured } from './config';

/** Server-only. Loads the Airtable token from da_settings when env is empty. */
export async function callsReady(): Promise<boolean> {
  if (!callsTablesConfigured()) return false;
  return Boolean(await resolveAirtableApiKey());
}
