const RECORD_ID = /^rec[A-Za-z0-9]{14}$/;
const BASE_ID = /^app[A-Za-z0-9]{14}$/;

export function cellText(value: unknown): string {
  if (value == null || value === '') return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'true' : '';
  if (Array.isArray(value)) {
    return value.map(cellText).filter(Boolean).join(', ');
  }
  if (typeof value === 'object' && value !== null && 'name' in value) {
    return cellText((value as { name?: unknown }).name);
  }
  return '';
}

export function cellNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function cellIds(value: unknown): string[] {
  if (typeof value === 'string' && RECORD_ID.test(value)) return [value];
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  for (const item of value) {
    if (typeof item === 'string' && RECORD_ID.test(item)) {
      ids.push(item);
      continue;
    }
    if (item && typeof item === 'object' && 'id' in item) {
      const id = String((item as { id?: unknown }).id ?? '');
      if (RECORD_ID.test(id)) ids.push(id);
    }
  }
  return ids;
}

export function isRecordId(value: string): boolean {
  return RECORD_ID.test(value);
}

export function isAirtableBaseId(value: string): boolean {
  return BASE_ID.test(value);
}

/** Accepts a raw app id or an airtable.com URL that contains one. */
export function parseAirtableBaseId(value: string): string | null {
  const trimmed = value.trim();
  if (isAirtableBaseId(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (!url.hostname.endsWith('airtable.com')) return null;
    const fromPath = url.pathname.split('/').find((part) => isAirtableBaseId(part));
    if (fromPath) return fromPath;
  } catch {
    const match = trimmed.match(/app[A-Za-z0-9]{14}/);
    if (match && isAirtableBaseId(match[0])) return match[0];
  }
  return null;
}

export function escapeFormulaValue(value: string): string {
  return value.replace(/'/g, "''");
}

export function sanitizeSearchQuery(query: string): string {
  return query.replace(/[{}]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}
