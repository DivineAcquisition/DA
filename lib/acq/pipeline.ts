import {
  ACQ_ERROR_WEBHOOK,
  ACQ_GHL_LOCATION_ID,
  AIRTABLE_API_KEY,
  AIRTABLE_BASE_ID,
  AIRTABLE_ENTRY_POINT,
  AIRTABLE_LEADS_TABLE_ID,
  GHL_FIELD_AD_SPEND,
  GHL_FIELD_COMPANY_NAME,
  GHL_FIELD_FOLLOW_UP,
  GHL_FIELD_PROGRAM_PRICE,
  GHL_FIELD_QUAL_RESULT,
  GHL_FIELD_READINESS,
  GHL_PIT_TOKEN,
} from './config';
import {
  APP_COMPLETE_TAG,
  RESULT_TAGS,
  airtableFieldsFromPayload,
  normalizeQualificationResult,
  parseReadinessScore,
  qualificationResultTag,
  type QualificationPayload,
  type QualificationResult,
} from './qualify';

const GHL_API = 'https://services.leadconnectorhq.com';
const REQUEST_MS = 20_000;

export class PipelineStepError extends Error {
  readonly step: string;

  constructor(step: string, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'PipelineStepError';
    this.step = step;
  }
}

export type GhlContactRef = { contactId: string };

export type AirtableScore = {
  recordId: string;
  readinessScore: number | null;
  qualificationResult: QualificationResult | null;
};

type GhlCustomField = {
  id?: string;
  name?: string;
  fieldKey?: string;
  key?: string;
};

type ResolvedGhlFields = {
  companyName?: string;
  adSpend?: string;
  followUp?: string;
  programPrice?: string;
  readiness?: string;
  qualification?: string;
};

function ghlHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${GHL_PIT_TOKEN}`,
    Version: '2021-07-28',
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

async function readBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

async function ghlFetch<T>(path: string, init: RequestInit, step: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_MS);
  try {
    const response = await fetch(`${GHL_API}${path}`, {
      ...init,
      headers: { ...ghlHeaders(), ...init.headers },
      signal: controller.signal,
      cache: 'no-store',
    });
    const text = await readBody(response);
    if (!response.ok) {
      throw new PipelineStepError(step, `GHL ${init.method ?? 'GET'} ${path} failed (${response.status}): ${text}`);
    }
    if (!text) return {} as T;
    return JSON.parse(text) as T;
  } catch (error) {
    if (error instanceof PipelineStepError) throw error;
    throw new PipelineStepError(step, `GHL ${init.method ?? 'GET'} ${path} threw`, { cause: error });
  } finally {
    clearTimeout(timer);
  }
}

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function fieldMatches(field: GhlCustomField, aliases: string[]): boolean {
  const haystacks = [field.name, field.fieldKey, field.key, field.id]
    .filter(Boolean)
    .map((value) => normalizeName(String(value).replace(/^contact\./, '')));
  const wanted = aliases.map(normalizeName);
  return haystacks.some((value) => wanted.includes(value));
}

function pickField(fields: GhlCustomField[], aliases: string[], fallbackId?: string): string | undefined {
  if (fallbackId) return fallbackId;
  const match = fields.find((field) => field.id && fieldMatches(field, aliases));
  return match?.id;
}

let customFieldCache: { at: number; fields: ResolvedGhlFields } | null = null;

async function resolveGhlCustomFields(): Promise<ResolvedGhlFields> {
  if (customFieldCache && Date.now() - customFieldCache.at < 10 * 60 * 1000) {
    return customFieldCache.fields;
  }

  const resolved: ResolvedGhlFields = {
    companyName: GHL_FIELD_COMPANY_NAME || undefined,
    adSpend: GHL_FIELD_AD_SPEND || undefined,
    followUp: GHL_FIELD_FOLLOW_UP || undefined,
    programPrice: GHL_FIELD_PROGRAM_PRICE || undefined,
    readiness: GHL_FIELD_READINESS || undefined,
    qualification: GHL_FIELD_QUAL_RESULT || undefined,
  };

  if (!GHL_PIT_TOKEN || !ACQ_GHL_LOCATION_ID) return resolved;

  try {
    const payload = await ghlFetch<{ customFields?: GhlCustomField[] }>(
      `/locations/${ACQ_GHL_LOCATION_ID}/customFields`,
      { method: 'GET' },
      'ghl-custom-fields',
    );
    const fields = payload.customFields ?? [];
    resolved.companyName = pickField(fields, ['DA - Company Name', 'Company Name', 'company_name'], resolved.companyName);
    resolved.adSpend = pickField(
      fields,
      ['DA - Monthly Ad Spend', 'Monthly Ad Spend', 'monthly_ad_spend', 'da_monthly_ad_spend'],
      resolved.adSpend,
    );
    resolved.followUp = pickField(
      fields,
      ['DA - Follow-Up Owner', 'Follow-Up Owner', 'follow_up_owner', 'da_follow_up_owner'],
      resolved.followUp,
    );
    resolved.programPrice = pickField(
      fields,
      ['DA - Program Price', 'Program Price', 'program_price', 'da_program_price'],
      resolved.programPrice,
    );
    resolved.readiness = pickField(
      fields,
      ['DA - Readiness Score', 'Readiness Score', 'readiness_score', 'da_readiness_score'],
      resolved.readiness,
    );
    resolved.qualification = pickField(
      fields,
      ['DA - Qualification Result', 'Qualification Result', 'qualification_result', 'da_qualification_result'],
      resolved.qualification,
    );
    customFieldCache = { at: Date.now(), fields: resolved };
  } catch (error) {
    console.error('[acq:ghl-custom-fields]', error);
  }

  return resolved;
}

function customFieldEntries(
  ids: ResolvedGhlFields,
  values: Partial<Record<keyof ResolvedGhlFields, string | number | null | undefined>>,
): Array<{ id: string; field_value: string | number }> {
  const entries: Array<{ id: string; field_value: string | number }> = [];
  for (const key of Object.keys(values) as Array<keyof ResolvedGhlFields>) {
    const id = ids[key];
    const value = values[key];
    if (!id || value == null || value === '') continue;
    entries.push({ id, field_value: value });
  }
  return entries;
}

function contactIdFrom(payload: { contact?: { id?: string }; id?: string }): string | null {
  return payload.contact?.id ?? payload.id ?? null;
}

async function searchGhlContact(email: string): Promise<string | null> {
  try {
    const duplicate = await ghlFetch<{ contact?: { id?: string }; id?: string }>(
      `/contacts/search/duplicate?locationId=${encodeURIComponent(ACQ_GHL_LOCATION_ID)}&email=${encodeURIComponent(email)}`,
      { method: 'GET' },
      'ghl-search',
    );
    const id = contactIdFrom(duplicate);
    if (id) return id;
  } catch (error) {
    if (!(error instanceof PipelineStepError) || !error.message.includes('(404)')) {
      console.error('[acq:ghl-search-duplicate]', error);
    }
  }

  const listed = await ghlFetch<{ contacts?: Array<{ id?: string; email?: string }> }>(
    `/contacts/?locationId=${encodeURIComponent(ACQ_GHL_LOCATION_ID)}&query=${encodeURIComponent(email)}&limit=20`,
    { method: 'GET' },
    'ghl-search',
  );
  const match = (listed.contacts ?? []).find(
    (contact) => contact.email?.trim().toLowerCase() === email && contact.id,
  );
  return match?.id ?? null;
}

async function addGhlTags(contactId: string, tags: string[], step: string): Promise<void> {
  if (!tags.length) return;
  await ghlFetch(`/contacts/${contactId}/tags`, {
    method: 'POST',
    body: JSON.stringify({ tags }),
  }, step);
}

async function removeGhlTags(contactId: string, tags: string[], step: string): Promise<void> {
  if (!tags.length) return;
  try {
    await ghlFetch(`/contacts/${contactId}/tags`, {
      method: 'DELETE',
      body: JSON.stringify({ tags }),
    }, step);
  } catch (error) {
    console.error(`[acq:${step}] tag remove failed`, error);
  }
}

export function ghlConfigured(): boolean {
  return Boolean(GHL_PIT_TOKEN && ACQ_GHL_LOCATION_ID);
}

export function airtableConfigured(): boolean {
  return Boolean(AIRTABLE_API_KEY && AIRTABLE_BASE_ID && AIRTABLE_LEADS_TABLE_ID);
}

export async function upsertGhlContact(payload: QualificationPayload): Promise<GhlContactRef> {
  if (!ghlConfigured()) {
    throw new PipelineStepError(
      'ghl-contact',
      'ACQ GHL location or PIT token is not configured. Set ACQ_GHL_LOCATION_ID and GHL_PIT_TOKEN.',
    );
  }

  const fields = await resolveGhlCustomFields();
  const customFields = customFieldEntries(fields, {
    companyName: payload.companyName,
    adSpend: payload.monthlyAdSpend,
    followUp: payload.followUpOwner,
    programPrice: payload.programPrice,
  });

  const body: Record<string, unknown> = {
    email: payload.email,
    firstName: payload.firstName,
    lastName: payload.lastName || undefined,
    name: payload.fullName,
    phone: payload.phone,
    companyName: payload.companyName,
    source: payload.source,
  };
  if (customFields.length) body.customFields = customFields;

  const existingId = await searchGhlContact(payload.email);
  let contactId: string | null = existingId;

  if (existingId) {
    const updated = await ghlFetch<{ contact?: { id?: string }; id?: string }>(
      `/contacts/${existingId}`,
      { method: 'PUT', body: JSON.stringify(body) },
      'ghl-contact',
    );
    contactId = contactIdFrom(updated) ?? existingId;
  } else {
    const created = await ghlFetch<{ contact?: { id?: string }; id?: string }>(
      '/contacts/',
      {
        method: 'POST',
        body: JSON.stringify({
          ...body,
          locationId: ACQ_GHL_LOCATION_ID,
          tags: [APP_COMPLETE_TAG],
        }),
      },
      'ghl-contact',
    );
    contactId = contactIdFrom(created);
  }

  if (!contactId) {
    throw new PipelineStepError('ghl-contact', 'GHL contact create/update returned no id');
  }

  await addGhlTags(contactId, [APP_COMPLETE_TAG], 'ghl-contact');
  return { contactId };
}

export async function writeScoreToGhl(
  contactId: string,
  score: AirtableScore,
): Promise<void> {
  if (!ghlConfigured()) {
    throw new PipelineStepError('ghl-score', 'ACQ GHL location or PIT token is not configured.');
  }

  const fields = await resolveGhlCustomFields();
  const customFields = customFieldEntries(fields, {
    readiness: score.readinessScore,
    qualification: score.qualificationResult,
  });

  if (customFields.length) {
    await ghlFetch(
      `/contacts/${contactId}`,
      { method: 'PUT', body: JSON.stringify({ customFields }) },
      'ghl-score',
    );
  }

  if (score.qualificationResult) {
    const keep = qualificationResultTag(score.qualificationResult);
    await removeGhlTags(
      contactId,
      RESULT_TAGS.filter((tag) => tag !== keep),
      'ghl-score',
    );
    await addGhlTags(contactId, [keep], 'ghl-score');
  }
}

function airtableUrl(path = ''): string {
  return `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_LEADS_TABLE_ID}${path}`;
}

function airtableHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${AIRTABLE_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function airtableFetch<T>(path: string, init: RequestInit, step: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_MS);
  try {
    const response = await fetch(airtableUrl(path), {
      ...init,
      headers: { ...airtableHeaders(), ...init.headers },
      signal: controller.signal,
      cache: 'no-store',
    });
    const text = await readBody(response);
    if (!response.ok) {
      throw new PipelineStepError(
        step,
        `Airtable ${init.method ?? 'GET'} ${path || '/'} failed (${response.status}): ${text}`,
      );
    }
    return (text ? JSON.parse(text) : {}) as T;
  } catch (error) {
    if (error instanceof PipelineStepError) throw error;
    throw new PipelineStepError(step, `Airtable ${init.method ?? 'GET'} ${path || '/'} threw`, { cause: error });
  } finally {
    clearTimeout(timer);
  }
}

function escapeFormulaValue(value: string): string {
  return value.replace(/'/g, "\\'");
}

export async function upsertAirtableLead(
  payload: QualificationPayload,
  ghlContactId: string,
): Promise<AirtableScore> {
  if (!airtableConfigured()) {
    throw new PipelineStepError('airtable-lead', 'Airtable API key or base/table id is not configured.');
  }

  const fields = airtableFieldsFromPayload(payload, {
    ghlContactId,
    entryPoint: AIRTABLE_ENTRY_POINT,
  });

  const formula = `LOWER({Email})='${escapeFormulaValue(payload.email)}'`;
  const found = await airtableFetch<{ records?: Array<{ id: string }> }>(
    `?filterByFormula=${encodeURIComponent(formula)}&maxRecords=1`,
    { method: 'GET' },
    'airtable-lead',
  );

  const existingId = found.records?.[0]?.id;
  const written = existingId
    ? await airtableFetch<{ id: string }>(
        `/${existingId}`,
        { method: 'PATCH', body: JSON.stringify({ fields, typecast: true }) },
        'airtable-lead',
      )
    : await airtableFetch<{ id: string }>(
        '',
        { method: 'POST', body: JSON.stringify({ fields, typecast: true }) },
        'airtable-lead',
      );

  const recordId = written.id;
  if (!recordId) {
    throw new PipelineStepError('airtable-lead', 'Airtable write returned no record id');
  }

  const read = await airtableFetch<{
    id: string;
    fields?: Record<string, unknown>;
  }>(`/${recordId}`, { method: 'GET' }, 'airtable-lead');

  return {
    recordId,
    readinessScore: parseReadinessScore(read.fields?.['Readiness Score']),
    qualificationResult: normalizeQualificationResult(read.fields?.['Qualification Result']),
  };
}

export async function logPipelineFailure(step: string, email: string, error: unknown): Promise<void> {
  const timestamp = new Date().toISOString();
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`[acq:${step}]`, { email, timestamp, detail, error });

  if (!ACQ_ERROR_WEBHOOK) return;

  try {
    await fetch(ACQ_ERROR_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `[${step}] ${email} at ${timestamp}: ${detail}`,
        step,
        email,
        timestamp,
        detail,
      }),
      cache: 'no-store',
    });
  } catch (webhookError) {
    console.error('[acq:error-log] webhook failed', webhookError);
  }
}
