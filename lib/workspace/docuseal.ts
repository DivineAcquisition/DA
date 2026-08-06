import type { DaSettings } from './types';

const DOCUSEAL_API = 'https://api.docuseal.com';

type DocuSealField = {
  name: string;
  default_value: string;
  readonly?: boolean;
};

type CreateSubmissionResult = {
  id: number | string;
  submitters?: Array<{
    id?: number | string;
    email?: string;
    slug?: string;
    embed_src?: string;
  }>;
};

async function docusealFetch(
  path: string,
  apiKey: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(`${DOCUSEAL_API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Token': apiKey,
      ...(init?.headers ?? {}),
    },
  });
}

export async function createDocuSealSubmission(input: {
  settings: DaSettings;
  templateId: string;
  email: string;
  name: string;
  phone?: string | null;
  fields: DocuSealField[];
  externalId?: string;
}): Promise<{ submissionId: string; signingUrl: string | null; error?: string }> {
  const apiKey = input.settings.docuseal_api_key.trim();
  if (!apiKey) {
    return { submissionId: '', signingUrl: null, error: 'DocuSeal API key is not configured in settings.' };
  }

  const templateId = Number(input.templateId);
  if (!Number.isFinite(templateId)) {
    return { submissionId: '', signingUrl: null, error: 'DocuSeal template identifier must be numeric.' };
  }

  const body = {
    template_id: templateId,
    send_email: true,
    submitters: [
      {
        email: input.email,
        name: input.name,
        phone: input.phone || undefined,
        external_id: input.externalId,
        fields: input.fields,
      },
    ],
  };

  const response = await docusealFetch('/submissions', apiKey, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    return {
      submissionId: '',
      signingUrl: null,
      error: `DocuSeal create failed (${response.status}): ${text.slice(0, 280) || response.statusText}`,
    };
  }

  const data = (await response.json()) as CreateSubmissionResult | CreateSubmissionResult[];
  const submission = Array.isArray(data) ? data[0] : data;
  const submitter = submission?.submitters?.[0];
  const signingUrl =
    submitter?.embed_src ??
    (submitter?.slug ? `https://docuseal.com/s/${submitter.slug}` : null);

  return {
    submissionId: String(submission?.id ?? ''),
    signingUrl,
  };
}

export async function cancelDocuSealSubmission(
  settings: DaSettings,
  submissionId: string,
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = settings.docuseal_api_key.trim();
  if (!apiKey || !submissionId) {
    return { ok: false, error: 'Missing DocuSeal credentials or submission id.' };
  }

  // DocuSeal archives/cancels via DELETE /submissions/:id
  const response = await docusealFetch(`/submissions/${encodeURIComponent(submissionId)}`, apiKey, {
    method: 'DELETE',
  });

  if (!response.ok && response.status !== 404) {
    const text = await response.text().catch(() => '');
    return {
      ok: false,
      error: `DocuSeal cancel failed (${response.status}): ${text.slice(0, 280) || response.statusText}`,
    };
  }

  return { ok: true };
}

export async function fetchSignedDocumentUrl(
  settings: DaSettings,
  submissionId: string,
): Promise<string | null> {
  const apiKey = settings.docuseal_api_key.trim();
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
