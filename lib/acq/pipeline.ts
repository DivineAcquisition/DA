import { airtableKeyConfiguredSync, resolveAirtableApiKey } from './airtable-key';
import {
  ACQ_ERROR_WEBHOOK,
  ACQ_GHL_LOCATION_ID,
  AIRTABLE_BASE_ID,
  AIRTABLE_ENTRY_POINT,
  AIRTABLE_LEADS_TABLE_ID,
} from './config';
import { ghlPit, ghlPitSync } from '@/lib/ghl/pit';
import { redact } from '@/lib/ghl/rules';
import {
  GHL_CONTACT_FIELDS,
  applicationFieldValues,
  scoreFieldValues,
  type GhlFieldKey,
  type GhlFieldValues,
} from './ghl-fields';
import {
  airtableFieldsFromPayload,
  ghlContactNote,
  qualificationResultTag,
  type QualificationPayload,
  type QualificationResult,
} from './qualify';
import type { LeadStage } from './stages';
import { ACQ_SMS_CONSENT_VERSION } from '@/lib/booking-messages/copy';
import { QUALIFICATION_TAGS, exclusiveTagChange, legacyNamesFor } from '@/lib/ghl/tags';

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

type ResolvedGhlFields = Partial<Record<GhlFieldKey, string>>;

async function ghlHeaders(): Promise<HeadersInit> {
  return {
    Authorization: `Bearer ${await ghlPit()}`,
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

export async function ghlFetch<T>(path: string, init: RequestInit, step: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_MS);
  try {
    const response = await fetch(`${GHL_API}${path}`, {
      ...init,
      headers: { ...(await ghlHeaders()), ...init.headers },
      signal: controller.signal,
      cache: 'no-store',
    });
    const text = await readBody(response);
    if (!response.ok) {
      throw new PipelineStepError(
        step,
        redact(`GHL ${init.method ?? 'GET'} ${path} failed (${response.status}): ${text}`, [ghlPitSync()]),
      );
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

export async function resolveGhlCustomFields(): Promise<ResolvedGhlFields> {
  if (customFieldCache && Date.now() - customFieldCache.at < 10 * 60 * 1000) {
    return customFieldCache.fields;
  }

  const resolved: ResolvedGhlFields = {};
  for (const spec of GHL_CONTACT_FIELDS) {
    if ('envId' in spec && spec.envId) resolved[spec.key] = spec.envId;
  }

  if (!(await ghlPit()) || !ACQ_GHL_LOCATION_ID) return resolved;

  try {
    const payload = await ghlFetch<{ customFields?: GhlCustomField[] }>(
      `/locations/${ACQ_GHL_LOCATION_ID}/customFields`,
      { method: 'GET' },
      'ghl-custom-fields',
    );
    const fields = payload.customFields ?? [];
    for (const spec of GHL_CONTACT_FIELDS) {
      resolved[spec.key] = pickField(fields, [spec.name, ...spec.aliases], resolved[spec.key]);
    }
    customFieldCache = { at: Date.now(), fields: resolved };
  } catch (error) {
    console.error('[acq:ghl-custom-fields]', error);
  }

  return resolved;
}

export function customFieldEntries(
  ids: ResolvedGhlFields,
  values: GhlFieldValues,
): Array<{ id: string; field_value: string | number }> {
  const entries: Array<{ id: string; field_value: string | number }> = [];
  for (const key of Object.keys(values) as GhlFieldKey[]) {
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

async function searchGhlContact(email: string, phone?: string): Promise<string | null> {
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
  if (match?.id) return match.id;

  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length < 7) return null;
  try {
    const byPhone = await ghlFetch<{ contact?: { id?: string }; id?: string }>(
      `/contacts/search/duplicate?locationId=${encodeURIComponent(ACQ_GHL_LOCATION_ID)}&phone=${encodeURIComponent(phone ?? '')}`,
      { method: 'GET' },
      'ghl-search',
    );
    return contactIdFrom(byPhone);
  } catch (error) {
    if (!(error instanceof PipelineStepError) || !error.message.includes('(404)')) {
      console.error('[acq:ghl-search-phone]', error);
    }
  }
  return null;
}

export async function addGhlTags(contactId: string, tags: string[], step: string): Promise<void> {
  if (!tags.length) return;
  await ghlFetch(`/contacts/${contactId}/tags`, {
    method: 'POST',
    body: JSON.stringify({ tags }),
  }, step);
}

export async function removeGhlTags(contactId: string, tags: string[], step: string): Promise<void> {
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
  return Boolean(ghlPitSync() && ACQ_GHL_LOCATION_ID);
}

export async function ghlReady(): Promise<boolean> {
  return Boolean((await ghlPit()) && ACQ_GHL_LOCATION_ID);
}

export function forgetGhlCustomFields(): void {
  customFieldCache = null;
}

export function airtableConfigured(): boolean {
  return Boolean(AIRTABLE_BASE_ID && AIRTABLE_LEADS_TABLE_ID && airtableKeyConfiguredSync());
}

export async function airtableReady(): Promise<boolean> {
  return Boolean(AIRTABLE_BASE_ID && AIRTABLE_LEADS_TABLE_ID && (await resolveAirtableApiKey()));
}

export async function upsertGhlContact(
  payload: QualificationPayload,
  extras: { stage?: LeadStage } = {},
): Promise<GhlContactRef> {
  if (!(await ghlReady())) {
    throw new PipelineStepError(
      'ghl-contact',
      'ACQ GHL location or PIT token is not configured. Save the token in Workspace settings or set GHL_PIT_TOKEN.',
    );
  }

  const fields = await resolveGhlCustomFields();
  const customFields = customFieldEntries(
    fields,
    applicationFieldValues(payload, { stage: extras.stage, smsConsentVersion: ACQ_SMS_CONSENT_VERSION }),
  );

  const body: Record<string, unknown> = {
    email: payload.email,
    firstName: payload.firstName,
    lastName: payload.lastName || undefined,
    name: payload.fullName,
    companyName: payload.companyName,
    source: payload.source,
  };
  if (payload.phone) body.phone = payload.phone;
  if (customFields.length) body.customFields = customFields;

  const existingId = await searchGhlContact(payload.email, payload.phone);
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
          tags: payload.tags,
        }),
      },
      'ghl-contact',
    );
    contactId = contactIdFrom(created);
  }

  if (!contactId) {
    throw new PipelineStepError('ghl-contact', 'GHL contact create/update returned no id');
  }

  await addGhlTags(contactId, payload.tags, 'ghl-contact');
  await removeGhlTags(contactId, legacyNamesFor(payload.tags), 'ghl-contact');
  try {
    await ghlFetch(
      `/contacts/${contactId}/notes`,
      { method: 'POST', body: JSON.stringify({ body: ghlContactNote(payload) }) },
      'ghl-note',
    );
  } catch (error) {
    console.error('[acq:ghl-note]', error);
  }
  return { contactId };
}

export async function writeScoreToGhl(
  contactId: string,
  score: AirtableScore,
): Promise<void> {
  if (!(await ghlReady())) {
    throw new PipelineStepError('ghl-score', 'ACQ GHL location or PIT token is not configured.');
  }

  const fields = await resolveGhlCustomFields();
  const customFields = customFieldEntries(fields, scoreFieldValues(score));

  if (customFields.length) {
    await ghlFetch(
      `/contacts/${contactId}`,
      { method: 'PUT', body: JSON.stringify({ customFields }) },
      'ghl-score',
    );
  }

  if (score.qualificationResult) {
    const change = exclusiveTagChange(QUALIFICATION_TAGS, qualificationResultTag(score.qualificationResult));
    await removeGhlTags(contactId, change.remove, 'ghl-score');
    await addGhlTags(contactId, change.add, 'ghl-score');
  }
}

function airtableUrl(path = ''): string {
  return `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_LEADS_TABLE_ID}${path}`;
}

async function airtableHeaders(): Promise<HeadersInit> {
  const key = await resolveAirtableApiKey();
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
}

async function airtableFetch<T>(path: string, init: RequestInit, step: string): Promise<T> {
  const key = await resolveAirtableApiKey();
  if (!key) {
    throw new PipelineStepError(
      step,
      'Airtable is not configured. Set da_settings.pipeline_airtable_pat.',
    );
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_MS);
  try {
    const response = await fetch(airtableUrl(path), {
      ...init,
      headers: { ...(await airtableHeaders()), ...init.headers },
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
  existingRecordId?: string | null,
): Promise<AirtableScore> {
  if (!(await airtableReady())) {
    throw new PipelineStepError('airtable-lead', 'Airtable destination is not configured.');
  }

  const fields = airtableFieldsFromPayload(payload, {
    ghlContactId,
    entryPoint: AIRTABLE_ENTRY_POINT,
  });

  let existingId = existingRecordId?.trim() || '';
  if (!existingId) {
    const formula = `LOWER({Email})='${escapeFormulaValue(payload.email)}'`;
    const found = await airtableFetch<{ records?: Array<{ id: string }> }>(
      `?filterByFormula=${encodeURIComponent(formula)}&maxRecords=1`,
      { method: 'GET' },
      'airtable-lead',
    );
    existingId = found.records?.[0]?.id ?? '';
  }
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

  return {
    recordId,
    readinessScore: null,
    qualificationResult: null,
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
