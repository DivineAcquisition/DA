import { consentsForRecipientType, type ConsentItem } from './consents';
import {
  completeDocuSealSubmitter,
  fetchSubmissionDocuments,
  fetchTemplateDocuments,
  type DocuSealFieldInput,
} from './docuseal';
import { buildSalesOperatorSignerValues, resolveOperatorSignerRoleName } from './operator-agreement';
import { publicDaRpc } from './resolve-signing';

export type SigningField = {
  name: string;
  type: string;
  required: boolean;
  value: string;
  kind: 'text' | 'checkbox' | 'signature' | 'date' | 'number' | 'phone' | 'readonly';
  /** Catalogue occurrences (duplicate DocuSeal slots share one UI control). */
  uuids: string[];
};

export type SigningPagePayload = {
  token: string;
  agreementId: string;
  status: string;
  completed: boolean;
  recipientName: string;
  recipientType: string;
  templateName: string;
  fields: SigningField[];
  consents: ConsentItem[];
  documents: Array<{ name: string; url: string }>;
  signedDocumentUrl: string | null;
  submitterId: string | null;
  submissionId: string | null;
  docusealTemplateId: string | null;
  onboardingUrl: string | null;
};

type LoadedBundle = {
  agreement: {
    id: string;
    status: string;
    docuseal_submission_id: string | null;
    docuseal_submitter_id: string | null;
    prefilled_values: Record<string, string>;
    submitted_values: Record<string, string>;
    signed_document_url: string | null;
    recipient_id: string;
    template_id: string;
    onboarding_token?: string | null;
    onboarding_url?: string | null;
  };
  recipient: {
    full_name: string;
    email: string;
    recipient_type: string;
    phone: string | null;
    business_name: string | null;
  };
  template: {
    name: string;
    recipient_type: string;
    docuseal_template_id: string;
    docuseal_fields: Array<{
      name: string;
      type?: string;
      required?: boolean;
      submitter_uuid?: string;
      uuid?: string;
    }>;
    docuseal_submitters: Array<{ name?: string; uuid?: string }>;
  };
};

function fieldKind(type: string | undefined, name: string): SigningField['kind'] {
  const t = (type ?? '').toLowerCase();
  const n = name.toLowerCase();
  if (t === 'signature' || n.includes('signature')) return 'signature';
  if (t === 'initials' || n === 'initials') return 'text';
  if (t === 'checkbox' || t === 'stamp') return 'checkbox';
  if (t === 'date' || n.includes('date')) return 'date';
  if (t === 'number' || n.includes('number') || n.includes('phone') || n.includes('mobile')) {
    return n.includes('phone') || n.includes('mobile') ? 'phone' : 'number';
  }
  return 'text';
}

/** Normalize common date strings for `<input type="date">` (YYYY-MM-DD). */
function toDateInputValue(raw: string): string {
  const value = raw.trim();
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const us = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) {
    const [, mm, dd, yyyy] = us;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return value;
}

async function resolveDocuSealApiKey(): Promise<string> {
  const fromEnv = (process.env.DOCUSEAL_API_KEY ?? '').trim();
  if (fromEnv) return fromEnv;
  const data = await publicDaRpc<string>('da_get_docuseal_api_key', {});
  return (data ?? '').trim();
}

function dedupeFields(fields: SigningField[]): SigningField[] {
  const byName = new Map<string, SigningField>();
  for (const field of fields) {
    const existing = byName.get(field.name);
    if (!existing) {
      byName.set(field.name, { ...field, uuids: [...field.uuids] });
      continue;
    }
    existing.required = existing.required || field.required;
    existing.uuids.push(...field.uuids);
    if (!existing.value && field.value) existing.value = field.value;
  }
  return [...byName.values()];
}

export async function loadSigningPage(token: string): Promise<SigningPagePayload | null> {
  if (token.trim().length < 32) return null;
  const data = await publicDaRpc<LoadedBundle>('da_load_signing_page', {
    p_token: token.trim(),
  });
  if (!data?.agreement || !data.recipient || !data.template) return null;

  const { agreement, recipient, template } = data;
  const submitters = Array.isArray(template.docuseal_submitters) ? template.docuseal_submitters : [];
  const catalogue = Array.isArray(template.docuseal_fields) ? template.docuseal_fields : [];
  const signerRole = resolveOperatorSignerRoleName(submitters);
  const signerUuid = submitters.find(
    (submitter) => (submitter.name ?? '').toLowerCase() === signerRole.toLowerCase(),
  )?.uuid;

  const salesDefaults =
    signerRole.toLowerCase() === 'operator'
      ? buildSalesOperatorSignerValues({
          fullName: recipient.full_name,
          email: recipient.email,
          phone: recipient.phone,
        })
      : {};

  const prefilled = agreement.prefilled_values ?? {};
  const submitted = agreement.submitted_values ?? {};

  // Filter by submitter uuid (not name) so company Signature/Name/Date
  // fields are never mixed into the operator form.
  const rawFields: SigningField[] = catalogue
    .filter((field) => {
      if (!field.name) return false;
      if (!signerUuid || !field.submitter_uuid) return true;
      return field.submitter_uuid === signerUuid;
    })
    .map((field) => {
      const kind = fieldKind(field.type, field.name);
      let value = String(
        submitted[field.name] ?? prefilled[field.name] ?? salesDefaults[field.name] ?? '',
      );
      if (kind === 'checkbox') {
        value = value === 'true' || value === '1' ? 'true' : '';
      } else if (kind === 'date') {
        value = toDateInputValue(value);
      }
      return {
        name: field.name,
        type: field.type ?? 'text',
        required: Boolean(field.required) || kind === 'signature',
        value,
        kind,
        uuids: field.uuid ? [field.uuid] : [],
      };
    });

  const fields = dedupeFields(rawFields);

  if (!fields.some((field) => field.kind === 'signature')) {
    fields.push({
      name: 'Signature',
      type: 'signature',
      required: true,
      value: '',
      kind: 'signature',
      uuids: [],
    });
  }

  const apiKey = await resolveDocuSealApiKey();
  let documents: Array<{ name: string; url: string }> = [];
  if (agreement.signed_document_url) {
    documents = [{ name: 'Signed agreement', url: agreement.signed_document_url }];
  } else if (apiKey && agreement.docuseal_submission_id) {
    documents = await fetchSubmissionDocuments(apiKey, agreement.docuseal_submission_id);
  }
  if (documents.length === 0 && apiKey && template.docuseal_template_id) {
    documents = await fetchTemplateDocuments(apiKey, template.docuseal_template_id);
  }

  return {
    token: token.trim(),
    agreementId: agreement.id,
    status: agreement.status,
    completed: agreement.status === 'completed',
    recipientName: recipient.full_name,
    recipientType: recipient.recipient_type,
    templateName: template.name,
    fields,
    consents: consentsForRecipientType(recipient.recipient_type),
    documents,
    signedDocumentUrl: agreement.signed_document_url,
    submitterId: agreement.docuseal_submitter_id,
    submissionId: agreement.docuseal_submission_id,
    docusealTemplateId: template.docuseal_template_id,
    onboardingUrl: agreement.onboarding_url ?? null,
  };
}

export async function completeSigning(input: {
  token: string;
  values: Record<string, string>;
  signatureDataUrl: string;
  consents: Record<string, boolean>;
}): Promise<{ ok: true; signedDocumentUrl: string | null } | { ok: false; error: string }> {
  const page = await loadSigningPage(input.token);
  if (!page) return { ok: false, error: 'This link is no longer available.' };
  if (page.completed) {
    return { ok: true, signedDocumentUrl: page.signedDocumentUrl };
  }

  for (const consent of page.consents) {
    if (!input.consents[consent.id]) {
      return { ok: false, error: 'Please accept every consent item before signing.' };
    }
  }

  if (!input.signatureDataUrl.startsWith('data:image/')) {
    return { ok: false, error: 'A signature is required.' };
  }

  const apiKey = await resolveDocuSealApiKey();
  if (!apiKey || !page.submitterId) {
    return { ok: false, error: 'Signing is not configured. Contact Divine Acquisition.' };
  }

  const fields: DocuSealFieldInput[] = [];
  const submitted: Record<string, string> = {};

  for (const field of page.fields) {
    if (field.kind === 'signature') {
      fields.push({
        name: field.name,
        default_value: input.signatureDataUrl,
        readonly: true,
      });
      submitted[field.name] = '[signature]';
      continue;
    }
    if (field.kind === 'checkbox') {
      const checked = input.values[field.name] === 'true' || input.values[field.name] === 'on';
      if (field.required && !checked) {
        return { ok: false, error: `Please complete: ${field.name}` };
      }
      fields.push({
        name: field.name,
        default_value: checked ? 'true' : 'false',
        readonly: true,
      });
      submitted[field.name] = checked ? 'true' : 'false';
      continue;
    }
    const value = (input.values[field.name] ?? field.value ?? '').trim();
    if (field.required && !value) {
      return { ok: false, error: `Please complete: ${field.name}` };
    }
    if (!value) continue;
    // Duplicate DocuSeal slots (e.g. Operator initials ×10) share one value.
    const occurrences = Math.max(1, field.uuids.length || 1);
    for (let i = 0; i < occurrences; i += 1) {
      fields.push({ name: field.name, default_value: value, readonly: true });
    }
    submitted[field.name] = value;
  }

  for (const consent of page.consents) {
    for (const name of consent.docusealFields ?? []) {
      if (page.fields.some((field) => field.name === name)) {
        fields.push({ name, default_value: 'true', readonly: true });
        submitted[name] = 'true';
      }
    }
  }

  const completed = await completeDocuSealSubmitter({
    apiKey,
    submitterId: page.submitterId,
    fields,
  });
  if (!completed.ok) {
    return { ok: false, error: completed.error ?? 'DocuSeal could not complete signing.' };
  }

  const signedUrl = completed.documents?.[0]?.url ?? null;

  const marked = await publicDaRpc<boolean>(
    'da_mark_agreement_signed',
    {
      p_token: input.token.trim(),
      p_submitted: submitted,
      p_signed_document_url: signedUrl,
    },
    (value) => value === true,
  );

  if (!marked) {
    return { ok: false, error: 'Signed in DocuSeal but local record failed to update.' };
  }

  return { ok: true, signedDocumentUrl: signedUrl };
}
