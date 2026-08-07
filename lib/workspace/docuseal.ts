import type { DaSettings } from './types';

const DOCUSEAL_API = 'https://api.docuseal.com';
const PAGE_SIZE = 100;
/** A pull walks pages until DocuSeal stops handing back a cursor. Bounded so a
 *  runaway cursor cannot hold a request open forever. */
const MAX_PAGES = 40;

export type DocuSealFieldInput = {
  name: string;
  default_value: string;
  readonly?: boolean;
};

export type DocuSealTemplateField = {
  uuid?: string;
  name: string;
  type?: string;
  required?: boolean;
  submitter_uuid?: string;
};

export type DocuSealTemplate = {
  id: number | string;
  slug?: string;
  name: string;
  folder_name?: string | null;
  archived_at?: string | null;
  created_at?: string;
  updated_at?: string;
  fields?: DocuSealTemplateField[];
  submitters?: Array<{ name?: string; uuid?: string }>;
};

export type DocuSealSubmitter = {
  id?: number | string;
  submission_id?: number | string;
  uuid?: string;
  slug?: string;
  email?: string | null;
  name?: string | null;
  phone?: string | null;
  role?: string | null;
  status?: string | null;
  external_id?: string | null;
  sent_at?: string | null;
  opened_at?: string | null;
  completed_at?: string | null;
  declined_at?: string | null;
  embed_src?: string;
  values?: Array<{ field?: string; value?: unknown }>;
  documents?: Array<{ name?: string; url?: string }>;
};

export type DocuSealSubmission = {
  id: number | string;
  slug?: string;
  status?: string | null;
  source?: string | null;
  audit_log_url?: string | null;
  combined_document_url?: string | null;
  expire_at?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
  archived_at?: string | null;
  submitters?: DocuSealSubmitter[];
  template?: { id?: number | string; name?: string; folder_name?: string | null };
  documents?: Array<{ name?: string; url?: string }>;
};

type Paginated<T> = { data?: T[]; pagination?: { count?: number; next?: number | null } };

export type DocuSealResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * The key may live in the database (Settings) or in the environment. The
 * database wins so an administrator can rotate it without a deploy.
 */
export function docusealApiKey(settings: Pick<DaSettings, 'docuseal_api_key'> | null): string {
  return (settings?.docuseal_api_key ?? '').trim() || (process.env.DOCUSEAL_API_KEY ?? '').trim();
}

export function docusealConfigured(settings: Pick<DaSettings, 'docuseal_api_key'> | null): boolean {
  return docusealApiKey(settings).length > 0;
}

async function docusealFetch(
  path: string,
  apiKey: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(`${DOCUSEAL_API}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Token': apiKey,
      ...(init?.headers ?? {}),
    },
  });
}

async function failure(response: Response, what: string): Promise<string> {
  const text = await response.text().catch(() => '');
  if (response.status === 401 || response.status === 403) {
    return `DocuSeal rejected the API key (${response.status}). Check the key in Settings.`;
  }
  return `DocuSeal ${what} failed (${response.status}): ${text.slice(0, 240) || response.statusText}`;
}

/** Walks DocuSeal's `after` cursor until the pages run out. */
async function fetchAllPages<T extends { id?: number | string }>(
  resource: 'templates' | 'submissions' | 'submitters',
  apiKey: string,
  query: Record<string, string> = {},
): Promise<DocuSealResult<T[]>> {
  const rows: T[] = [];
  let after: string | null = null;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), ...query });
    if (after) params.set('after', after);

    const response = await docusealFetch(`/${resource}?${params.toString()}`, apiKey);
    if (!response.ok) return { ok: false, error: await failure(response, `${resource} list`) };

    const body = (await response.json()) as Paginated<T>;
    const batch = body.data ?? [];
    rows.push(...batch);

    const next = body.pagination?.next;
    if (!next || batch.length === 0) break;
    after = String(next);
  }

  return { ok: true, data: rows };
}

export async function listDocuSealTemplates(apiKey: string): Promise<DocuSealResult<DocuSealTemplate[]>> {
  return fetchAllPages<DocuSealTemplate>('templates', apiKey);
}

export async function listDocuSealSubmissions(
  apiKey: string,
): Promise<DocuSealResult<DocuSealSubmission[]>> {
  return fetchAllPages<DocuSealSubmission>('submissions', apiKey);
}

/**
 * Submitters carry the values already entered on a form. The submissions list
 * does not, so the pull reads both and joins them on submission id.
 */
export async function listDocuSealSubmitters(
  apiKey: string,
): Promise<DocuSealResult<DocuSealSubmitter[]>> {
  return fetchAllPages<DocuSealSubmitter>('submitters', apiKey);
}

export async function getDocuSealTemplate(
  apiKey: string,
  templateId: string | number,
): Promise<DocuSealResult<DocuSealTemplate>> {
  const response = await docusealFetch(`/templates/${encodeURIComponent(String(templateId))}`, apiKey);
  if (!response.ok) return { ok: false, error: await failure(response, 'template read') };
  return { ok: true, data: (await response.json()) as DocuSealTemplate };
}

/** Cheap credential check used by Settings to show whether the key works. */
export async function pingDocuSeal(apiKey: string): Promise<DocuSealResult<{ templates: number }>> {
  if (!apiKey) return { ok: false, error: 'No API key configured.' };
  const response = await docusealFetch('/templates?limit=1', apiKey);
  if (!response.ok) return { ok: false, error: await failure(response, 'connection check') };
  const body = (await response.json()) as Paginated<DocuSealTemplate>;
  return { ok: true, data: { templates: body.pagination?.count ?? body.data?.length ?? 0 } };
}

export async function createDocuSealSubmission(input: {
  settings: DaSettings;
  templateId: string;
  email: string;
  name: string;
  phone?: string | null;
  role?: string;
  fields: DocuSealFieldInput[];
  externalId?: string;
  /** Optional company countersigner for VA / operator agreements. */
  companySubmitter?: {
    role: string;
    email: string;
    name: string;
    fields: DocuSealFieldInput[];
  };
}): Promise<{
  submissionId: string;
  submitterId: string;
  submitterSlug: string;
  signingUrl: string | null;
  error?: string;
}> {
  const empty = { submissionId: '', submitterId: '', submitterSlug: '', signingUrl: null };
  const apiKey = docusealApiKey(input.settings);
  if (!apiKey) {
    return { ...empty, error: 'DocuSeal API key is not configured in settings.' };
  }

  const templateId = Number(input.templateId);
  if (!Number.isFinite(templateId)) {
    return { ...empty, error: 'DocuSeal template identifier must be numeric.' };
  }

  const payloadSubmitters: Array<Record<string, unknown>> = [
    {
      email: input.email,
      name: input.name,
      phone: input.phone || undefined,
      role: input.role || undefined,
      external_id: input.externalId,
      fields: input.fields,
    },
  ];

  if (input.companySubmitter) {
    payloadSubmitters.push({
      role: input.companySubmitter.role,
      email: input.companySubmitter.email,
      name: input.companySubmitter.name,
      send_email: false,
      fields: input.companySubmitter.fields,
    });
  }

  const body = {
    template_id: templateId,
    send_email: true,
    submitters: payloadSubmitters,
  };

  const response = await docusealFetch('/submissions', apiKey, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    return { ...empty, error: await failure(response, 'create') };
  }

  const data = (await response.json()) as
    | { id?: number | string; submitters?: DocuSealSubmitter[] }
    | DocuSealSubmitter[];

  // POST /submissions answers with the created submitters; older shapes wrap
  // them in the submission object.
  const createdSubmitters = Array.isArray(data) ? data : (data.submitters ?? []);
  const submitter = createdSubmitters[0];
  const submissionId = Array.isArray(data)
    ? String(submitter?.submission_id ?? '')
    : String(data.id ?? submitter?.submission_id ?? '');

  return {
    submissionId,
    submitterId: String(submitter?.id ?? ''),
    submitterSlug: String(submitter?.slug ?? ''),
    signingUrl: submitterSigningUrl(submitter),
  };
}

export function submitterSigningUrl(submitter: DocuSealSubmitter | undefined): string | null {
  if (!submitter) return null;
  if (submitter.embed_src) return submitter.embed_src;
  return submitter.slug ? `https://docuseal.com/s/${submitter.slug}` : null;
}

/**
 * Pre-fills an existing submitter. This is what makes auto-mapping apply to
 * submissions that were started in DocuSeal rather than here: the values land
 * on the form before the signer opens it.
 */
export async function prefillDocuSealSubmitter(
  apiKey: string,
  submitterId: string,
  fields: DocuSealFieldInput[],
): Promise<{ ok: boolean; error?: string }> {
  if (!apiKey || !submitterId) return { ok: false, error: 'Missing DocuSeal credentials or submitter.' };
  if (fields.length === 0) return { ok: true };

  const response = await docusealFetch(`/submitters/${encodeURIComponent(submitterId)}`, apiKey, {
    method: 'PUT',
    body: JSON.stringify({ fields, send_email: false }),
  });

  if (!response.ok) return { ok: false, error: await failure(response, 'prefill') };
  return { ok: true };
}

export async function cancelDocuSealSubmission(
  settings: DaSettings,
  submissionId: string,
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = docusealApiKey(settings);
  if (!apiKey || !submissionId) {
    return { ok: false, error: 'Missing DocuSeal credentials or submission id.' };
  }

  // DocuSeal archives/cancels via DELETE /submissions/:id
  const response = await docusealFetch(`/submissions/${encodeURIComponent(submissionId)}`, apiKey, {
    method: 'DELETE',
  });

  if (!response.ok && response.status !== 404) {
    return { ok: false, error: await failure(response, 'cancel') };
  }

  return { ok: true };
}

export async function fetchSignedDocumentUrl(
  settings: DaSettings,
  submissionId: string,
): Promise<string | null> {
  const apiKey = docusealApiKey(settings);
  if (!apiKey || !submissionId) return null;

  const response = await docusealFetch(
    `/submissions/${encodeURIComponent(submissionId)}/documents`,
    apiKey,
  );
  if (!response.ok) return null;

  const data = (await response.json()) as { documents?: Array<{ url?: string }> } | Array<{ url?: string }>;
  const docs = Array.isArray(data) ? data : data.documents ?? [];
  return docs.find((d) => d.url)?.url ?? null;
}

/** Map DocuSeal webhook event names onto local agreement statuses. */
export function mapDocuSealEventToStatus(event: string): string | null {
  const e = event.toLowerCase();
  if (e.includes('completed') || e.includes('completed_form')) return 'completed';
  if (e.includes('viewed') || e.includes('opened') || e.includes('started')) return 'viewed';
  if (e.includes('declined') || e.includes('rejected')) return 'declined';
  if (e.includes('expired')) return 'expired';
  if (e.includes('sent') || e.includes('created')) return 'sent';
  return null;
}

/**
 * DocuSeal reports a submission as pending / completed / declined / expired,
 * and a submitter as opened before it is completed. The workspace keeps a
 * finer-grained 'viewed'.
 */
export function docuSealStatusToAgreementStatus(
  submissionStatus: string | null | undefined,
  submitter?: DocuSealSubmitter,
): 'sent' | 'viewed' | 'completed' | 'declined' | 'expired' {
  const status = (submissionStatus ?? '').toLowerCase();
  if (status === 'completed') return 'completed';
  if (status === 'declined') return 'declined';
  if (status === 'expired') return 'expired';
  if (submitter?.declined_at) return 'declined';
  if (submitter?.completed_at) return 'completed';
  if (submitter?.opened_at) return 'viewed';
  return 'sent';
}

function coerceValue(raw: unknown): string | null {
  if (raw == null || raw === '') return null;
  if (Array.isArray(raw)) return raw.map(String).join(', ');
  if (typeof raw === 'object') return null;
  return String(raw);
}

/** Submitter values arrive as a list of { field, value }; collapse to a map. */
export function submitterValueMap(submitter: DocuSealSubmitter | undefined): Record<string, string> {
  return normalizeValues(submitter?.values);
}

/**
 * Webhooks send the same values either as the API's list of { field, value }
 * or as a plain object keyed by field name.
 */
export function normalizeValues(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      const record = (entry ?? {}) as Record<string, unknown>;
      const field = String(record.field ?? record.name ?? '').trim();
      const value = coerceValue(record.value);
      if (field && value) out[field] = value;
    }
    return out;
  }
  if (raw && typeof raw === 'object') {
    for (const [field, value] of Object.entries(raw as Record<string, unknown>)) {
      const coerced = coerceValue(value);
      if (field.trim() && coerced) out[field.trim()] = coerced;
    }
  }
  return out;
}
