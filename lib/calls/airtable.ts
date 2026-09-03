import { resolveAirtableApiKey } from '@/lib/acq/airtable-key';
import { PipelineStepError } from '@/lib/acq/pipeline';
import {
  AIRTABLE_BASE_ID,
  AIRTABLE_DEBRIEFS_TABLE_ID,
  AIRTABLE_LEADS_TABLE_ID,
  AIRTABLE_ONBOARDING_TABLE_ID,
  AIRTABLE_TOUCHES_TABLE_ID,
} from './config';

const REQUEST_MS = 20_000;

type AirtableRecord = { id: string; fields?: Record<string, unknown> };

async function readBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

async function headers(): Promise<HeadersInit> {
  const key = await resolveAirtableApiKey();
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
}

export async function airtableFetch<T>(
  tableId: string,
  path: string,
  init: RequestInit,
  step = 'airtable-calls',
): Promise<T> {
  const key = await resolveAirtableApiKey();
  if (!key || !AIRTABLE_BASE_ID || !tableId) {
    throw new PipelineStepError(
      step,
      'Airtable is not configured. Set da_settings.pipeline_airtable_pat.',
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_MS);
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableId}${path}`;

  try {
    const response = await fetch(url, {
      ...init,
      headers: { ...(await headers()), ...init.headers },
      signal: controller.signal,
      cache: 'no-store',
    });
    const text = await readBody(response);
    if (!response.ok) {
      throw new PipelineStepError(
        step,
        `Airtable ${init.method ?? 'GET'} ${tableId}${path || '/'} failed (${response.status}): ${text}`,
      );
    }
    return (text ? JSON.parse(text) : {}) as T;
  } catch (error) {
    if (error instanceof PipelineStepError) throw error;
    throw new PipelineStepError(step, 'Airtable request threw', { cause: error });
  } finally {
    clearTimeout(timer);
  }
}

function listQuery(options: {
  formula?: string | null;
  fields?: readonly string[];
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  pageSize?: number;
  offset?: string;
}): string {
  const params = new URLSearchParams();
  if (options.formula) params.set('filterByFormula', options.formula);
  params.set('pageSize', String(Math.max(1, Math.min(options.pageSize ?? 100, 100))));
  if (options.sortField) {
    params.set('sort[0][field]', options.sortField);
    params.set('sort[0][direction]', options.sortDirection ?? 'desc');
  }
  for (const field of options.fields ?? []) {
    params.append('fields[]', field);
  }
  if (options.offset) params.set('offset', options.offset);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export async function listRecords(
  tableId: string,
  options: {
    formula?: string | null;
    fields?: readonly string[];
    sortField?: string;
    sortDirection?: 'asc' | 'desc';
    pageSize?: number;
    maxRecords?: number;
  } = {},
): Promise<AirtableRecord[]> {
  const records: AirtableRecord[] = [];
  let offset: string | undefined;
  const cap = options.maxRecords ?? 500;

  do {
    const payload = await airtableFetch<{ records?: AirtableRecord[]; offset?: string }>(
      tableId,
      listQuery({ ...options, offset }),
      { method: 'GET' },
    );
    records.push(...(payload.records ?? []));
    offset = payload.offset;
    if (records.length >= cap) return records.slice(0, cap);
  } while (offset);

  return records;
}

export async function getRecord(tableId: string, recordId: string): Promise<AirtableRecord> {
  return airtableFetch<AirtableRecord>(tableId, `/${recordId}`, { method: 'GET' });
}

function recordIdFormula(ids: string[]): string {
  if (ids.length === 1) return `RECORD_ID()='${ids[0]}'`;
  return `OR(${ids.map((id) => `RECORD_ID()='${id}'`).join(',')})`;
}

export async function getRecordsByIds(
  tableId: string,
  ids: string[],
  fields?: readonly string[],
): Promise<AirtableRecord[]> {
  if (!ids.length) return [];
  const unique = [...new Set(ids)];
  const records: AirtableRecord[] = [];
  for (let i = 0; i < unique.length; i += 40) {
    const chunk = unique.slice(i, i + 40);
    const found = await listRecords(tableId, {
      formula: recordIdFormula(chunk),
      fields,
      pageSize: 100,
    });
    records.push(...found);
  }
  return records;
}

export async function createRecord(
  tableId: string,
  fields: Record<string, unknown>,
): Promise<AirtableRecord> {
  return airtableFetch<AirtableRecord>(
    tableId,
    '',
    {
      method: 'POST',
      body: JSON.stringify({ fields, typecast: true }),
    },
    'airtable-calls-create',
  );
}

export async function updateRecord(
  tableId: string,
  recordId: string,
  fields: Record<string, unknown>,
): Promise<AirtableRecord> {
  return airtableFetch<AirtableRecord>(
    tableId,
    `/${recordId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ fields, typecast: true }),
    },
    'airtable-calls-update',
  );
}

export const tables = {
  leads: AIRTABLE_LEADS_TABLE_ID,
  touches: AIRTABLE_TOUCHES_TABLE_ID,
  debriefs: AIRTABLE_DEBRIEFS_TABLE_ID,
  onboarding: AIRTABLE_ONBOARDING_TABLE_ID,
};
