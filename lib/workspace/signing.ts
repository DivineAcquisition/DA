import { controlRpc } from '@/lib/ad/rpc';
import { createClient } from '@/lib/supabase/server';
import { consentsForRecipientType, type ConsentItem } from './consents';
import {
  completeDocuSealSubmitter,
  fetchSubmissionDocuments,
  fetchTemplateDocuments,
  type DocuSealFieldInput,
} from './docuseal';
import { fieldNamesForRole, OPERATOR_SIGNER_ROLE } from './operator-agreement';

export type SigningField = {
  name: string;
  type: string;
  required: boolean;
  value: string;
  kind: 'text' | 'checkbox' | 'signature' | 'date' | 'number' | 'phone' | 'readonly';
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
    }>;
    docuseal_submitters: Array<{ name?: string; uuid?: string }>;
  };
};

function fieldKind(type: string | undefined, name: string): SigningField['kind'] {
  const t = (type ?? '').toLowerCase();
  const n = name.toLowerCase();
  if (t === 'signature' || t === 'initials' || n.includes('signature') || n === 'initials') {
    return 'signature';
  }
  if (t === 'checkbox' || t === 'stamp') return 'checkbox';
  if (t === 'date' || n.includes('date')) return 'date';
  if (t === 'number' || n.includes('number') || n.includes('phone') || n.includes('mobile')) {
    return n.includes('phone') || n.includes('mobile') ? 'phone' : 'number';
  }
  return 'text';
}

async function resolveDocuSealApiKey(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const fromEnv = (process.env.DOCUSEAL_API_KEY ?? '').trim();
  if (fromEnv) return fromEnv;
  const { data } = await controlRpc<string>(supabase, 'da_get_docuseal_api_key', {});
  return (data ?? '').trim();
}

export async function loadSigningPage(token: string): Promise<SigningPagePayload | null> {
  if (token.trim().length < 32) return null;
  const supabase = await createClient();
  const { data } = await controlRpc<LoadedBundle>(supabase, 'da_load_signing_page', {
    p_token: token.trim(),
  });
  if (!data?.agreement || !data.recipient || !data.template) return null;

  const { agreement, recipient, template } = data;
  const submitters = Array.isArray(template.docuseal_submitters) ? template.docuseal_submitters : [];
  const catalogue = Array.isArray(template.docuseal_fields) ? template.docuseal_fields : [];
  const contractorNames = fieldNamesForRole(
    catalogue.map((field) => ({
      name: field.name,
      type: field.type,
      required: field.required,
      submitter_uuid: field.submitter_uuid,
    })),
    submitters,
    OPERATOR_SIGNER_ROLE,
  );

  const prefilled = agreement.prefilled_values ?? {};
  const submitted = agreement.submitted_values ?? {};

  const fields: SigningField[] = catalogue
    .filter((field) => field.name && (contractorNames.size === 0 || contractorNames.has(field.name)))
    .map((field) => {
      const kind = fieldKind(field.type, field.name);
      const value = String(submitted[field.name] ?? prefilled[field.name] ?? '');
      return {
        name: field.name,
        type: field.type ?? 'text',
        required: Boolean(field.required) || kind === 'signature',
        value: kind === 'checkbox' ? (value === 'true' || value === '1' ? 'true' : '') : value,
        kind,
      };
    });

  if (!fields.some((field) => field.kind === 'signature')) {
    fields.push({
      name: 'Signature',
      type: 'signature',
      required: true,
      value: '',
      kind: 'signature',
    });
  }

  const apiKey = await resolveDocuSealApiKey(supabase);
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

  const supabase = await createClient();
  const apiKey = await resolveDocuSealApiKey(supabase);
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
    fields.push({ name: field.name, default_value: value, readonly: true });
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

  const { data: marked } = await controlRpc<boolean>(supabase, 'da_mark_agreement_signed', {
    p_token: input.token.trim(),
    p_submitted: submitted,
    p_signed_document_url: signedUrl,
  });

  if (!marked) {
    return { ok: false, error: 'Signed in DocuSeal but local record failed to update.' };
  }

  return { ok: true, signedDocumentUrl: signedUrl };
}
