import 'server-only';
import { AGREEMENT_UNAVAILABLE } from './agreement-copy';
import { loadAgreementPage } from './agreement-page';
import { readDocuSealApiKey } from './docuseal-key';
import {
  completeDocuSealSubmitter,
  getDocuSealSubmission,
  getDocuSealSubmitter,
  getDocuSealTemplate,
  type DocuSealFieldInput,
} from './docuseal';
import { serviceRoleClient } from './db';
import { publicDaRpc } from './resolve-signing';
import {
  catalogueFromSigningPayload,
  collectSignFields,
  parseSubmitters,
  parseTemplateFields,
  planSignaturePlacement,
  SIGNATURE_FIELD_MISSING,
  type SigningCatalogue,
  type SignSlots,
} from './signature-fields';

const EMPTY_SLOTS: SignSlots = { signature: [], initials: [] };

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out')), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function loadCatalogue(token: string): Promise<SigningCatalogue | null> {
  const raw = await publicDaRpc<unknown>(
    'da_load_signing_page',
    { p_token: token },
    (data) => Boolean(data && typeof data === 'object' && 'agreement' in data),
  );
  return catalogueFromSigningPayload(raw);
}

/** Prefer the live template so a signature lands on the fields DocuSeal has now. */
async function resolveCatalogueFields(catalogue: SigningCatalogue, timeoutMs: number): Promise<SigningCatalogue> {
  const apiKey = await readDocuSealApiKey();
  if (!apiKey || !catalogue.templateId) return catalogue;

  try {
    const live = await withTimeout(getDocuSealTemplate(apiKey, catalogue.templateId), timeoutMs);
    if (!live.ok || !live.data.fields?.length) return catalogue;
    const fields = parseTemplateFields(live.data.fields);
    const submitters = live.data.submitters?.length ? parseSubmitters(live.data.submitters) : catalogue.submitters;
    const slots = collectSignFields({ fields, submitters, recipientType: catalogue.recipientType });
    if (slots.signature.length === 0) return catalogue;
    return { ...catalogue, fields, submitters };
  } catch (error) {
    console.error('[agreement-sign] template fields', error instanceof Error ? error.message : error);
    return catalogue;
  }
}

/** Names of the lines the signature pad will fill. Empty when the template has none yet. */
export async function loadSignerSignFields(token: string): Promise<SignSlots> {
  try {
    const catalogue = await loadCatalogue(token);
    if (!catalogue) return EMPTY_SLOTS;
    const resolved = await resolveCatalogueFields(catalogue, 8000);
    return collectSignFields(resolved);
  } catch (error) {
    console.error('[agreement-sign] signature fields', error instanceof Error ? error.message : error);
    return EMPTY_SLOTS;
  }
}

async function placeSignature(
  apiKey: string,
  submitterId: string,
  fields: DocuSealFieldInput[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const placed = await completeDocuSealSubmitter({ apiKey, submitterId, fields });
    if (placed.ok) return { ok: true };

    const current = await getDocuSealSubmitter(apiKey, submitterId).catch(() => null);
    const status = (current && current.ok ? current.data.status : '')?.toLowerCase() ?? '';
    if (current && current.ok && (current.data.completed_at || status === 'completed')) return { ok: true };

    console.error('[agreement-sign] docuseal', placed.error);
  } catch (error) {
    console.error('[agreement-sign] docuseal', error instanceof Error ? error.message : error);
  }
  return {
    ok: false,
    error: "We couldn't place your signature on the agreement. Please try again.",
  };
}

async function finishedSubmission(
  apiKey: string,
  submissionId: string,
): Promise<{ completed: boolean; url: string | null }> {
  try {
    const submission = await withTimeout(getDocuSealSubmission(apiKey, submissionId), 12000);
    if (!submission.ok) return { completed: false, url: null };
    const completed = (submission.data.status ?? '').toLowerCase() === 'completed';
    return { completed, url: submission.data.combined_document_url ?? null };
  } catch (error) {
    console.error('[agreement-sign] submission', error instanceof Error ? error.message : error);
    return { completed: false, url: null };
  }
}

/**
 * Records the signature only once DocuSeal says the whole submission is
 * finished. A countersigner who still has to sign leaves the agreement open;
 * the webhook moves it when they do. The image itself is stored as
 * "[signature]", never as the PNG.
 */
async function recordSigned(token: string, stored: Record<string, string>, documentUrl: string | null): Promise<void> {
  const client = serviceRoleClient();
  if (!client) {
    console.error('[agreement-sign] signature is on the agreement, but there is no service role to record it');
    return;
  }
  try {
    const { data, error } = await client.rpc('da_mark_agreement_signed', {
      p_token: token,
      p_submitted: stored,
      p_signed_document_url: documentUrl,
    });
    if (error || data !== true) {
      console.error('[agreement-sign] could not record the signed agreement', error?.message ?? data);
    }
  } catch (error) {
    console.error('[agreement-sign] could not record the signed agreement', error instanceof Error ? error.message : error);
  }
}

export async function applyAgreementSignature(input: {
  token: string;
  client: string | null;
  signature: string;
  initials: string | null;
  consentIds: string[];
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const page = await loadAgreementPage(input.token, input.client);
  if (page.state === 'completed') {
    return { ok: false, error: 'This agreement is already signed.', status: 409 };
  }
  if (page.state !== 'open') {
    return { ok: false, error: AGREEMENT_UNAVAILABLE, status: 404 };
  }

  const catalogue = await loadCatalogue(input.token);
  if (!catalogue?.submitterId) {
    return {
      ok: false,
      error: 'Your agreement is still being prepared. Check back in a few minutes.',
      status: 409,
    };
  }

  const apiKey = await readDocuSealApiKey();
  if (!apiKey) {
    return { ok: false, error: 'Signing is temporarily unavailable. Please try again shortly.', status: 503 };
  }

  const resolved = await resolveCatalogueFields(catalogue, 12000);
  const plan = planSignaturePlacement({
    fields: resolved.fields,
    submitters: resolved.submitters,
    recipientType: resolved.recipientType,
    signatureImage: input.signature,
    initialsImage: input.initials,
    consentIds: input.consentIds,
  });
  if (!plan.ok) {
    if (plan.error === SIGNATURE_FIELD_MISSING) {
      console.error('[agreement-sign] no signature field', {
        templateId: resolved.templateId,
        fields: resolved.fields.map((field) => `${field.name}:${field.type ?? ''}`),
      });
    }
    return { ok: false, error: plan.error, status: 400 };
  }

  const placed = await placeSignature(apiKey, resolved.submitterId, plan.fields);
  if (!placed.ok) return { ok: false, error: placed.error, status: 502 };

  if (resolved.submissionId) {
    const finished = await finishedSubmission(apiKey, resolved.submissionId);
    if (finished.completed) await recordSigned(input.token, plan.stored, finished.url);
  }

  return { ok: true };
}
