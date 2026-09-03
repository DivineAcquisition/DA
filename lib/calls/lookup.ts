import { escapeFormulaValue } from './cells';
import { listRecords, tables } from './airtable';

export async function findLeadByEmail(email: string): Promise<string | null> {
  const needle = email.trim().toLowerCase();
  if (!needle || !needle.includes('@')) return null;
  const records = await listRecords(tables.leads, {
    formula: `LOWER({Email})='${escapeFormulaValue(needle)}'`,
    fields: ['Email'],
    maxRecords: 2,
  });
  return records[0]?.id ?? null;
}

export async function findLeadByGhlContactId(contactId: string): Promise<string | null> {
  const id = contactId.trim();
  if (!id) return null;
  try {
    const records = await listRecords(tables.leads, {
      formula: `{GHL Contact ID}='${escapeFormulaValue(id)}'`,
      fields: ['GHL Contact ID'],
      maxRecords: 2,
    });
    return records[0]?.id ?? null;
  } catch {
    // Field may not exist on every DA Pipeline copy; email matching still works.
    return null;
  }
}

export async function matchInboundLead(input: {
  email?: string;
  ghlContactId?: string;
}): Promise<string | null> {
  const fromGhl = input.ghlContactId ? await findLeadByGhlContactId(input.ghlContactId) : null;
  if (fromGhl) return fromGhl;
  return input.email ? findLeadByEmail(input.email) : null;
}
