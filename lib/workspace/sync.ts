import type { UntypedClient } from './db';
import {
  docuSealStatusToAgreementStatus,
  docusealApiKey,
  listDocuSealSubmissions,
  listDocuSealSubmitters,
  listDocuSealTemplates,
  prefillDocuSealSubmitter,
  submitterSigningUrl,
  submitterValueMap,
  type DocuSealSubmission,
  type DocuSealSubmitter,
  type DocuSealTemplate,
} from './docuseal';
import {
  buildProfile,
  mapFields,
  mappingSummary,
  normalizeFieldName,
  toDocuSealFields,
  type FieldOverride,
  type TemplateField,
} from './field-mapping';
import type { DaFieldMapping, DaSettings, RecipientType } from './types';

/** Only the columns the pull reads; the tables carry more. */
type TemplateRow = {
  id: string;
  name: string;
  recipient_type: RecipientType;
  docuseal_template_id: string;
  docuseal_fields?: unknown;
};

type RecipientRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  business_name: string | null;
  recipient_type: RecipientType;
};

type AgreementRow = { id: string; docuseal_submission_id: string | null };

export type SyncCounts = {
  templates: number;
  submissions: number;
  recipientsCreated: number;
  valuesCaptured: number;
  prefilled: number;
};

export type SyncResult = { ok: true; counts: SyncCounts } | { ok: false; error: string };

const OPERATOR_HINTS = ['operator', 'contractor', 'va ', 'virtual assistant', 'talent', 'nda'];

/** DocuSeal folders and template names are the only signal about who signs. */
function inferRecipientType(template: DocuSealTemplate): RecipientType {
  const haystack = `${template.name ?? ''} ${template.folder_name ?? ''}`.toLowerCase();
  return OPERATOR_HINTS.some((hint) => haystack.includes(hint)) ? 'operator' : 'client';
}

function templateFields(template: { docuseal_fields?: unknown }): TemplateField[] {
  const raw = template.docuseal_fields;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((field) => {
      const record = (field ?? {}) as Record<string, unknown>;
      return {
        name: String(record.name ?? '').trim(),
        type: record.type ? String(record.type) : 'text',
        required: Boolean(record.required),
      };
    })
    .filter((field) => field.name.length > 0);
}

function nameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? email;
  return local
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function businessFromEmail(email: string): string {
  const domain = (email.split('@')[1] ?? '').trim();
  return domain || 'Unknown';
}

/** The submitter the workspace tracks: the first one who has an email. */
function primarySubmitter(submission: DocuSealSubmission): DocuSealSubmitter | undefined {
  return submission.submitters?.find((s) => (s.email ?? '').trim()) ?? submission.submitters?.[0];
}

export async function loadFieldOverrides(
  supabase: UntypedClient,
): Promise<{ global: Record<string, FieldOverride>; byTemplate: Map<string, Record<string, FieldOverride>> }> {
  const { data } = await supabase.from('da_field_mapping').select('*');
  const global: Record<string, FieldOverride> = {};
  const byTemplate = new Map<string, Record<string, FieldOverride>>();

  const rows = (data as DaFieldMapping[] | null) ?? [];
  for (const row of rows) {
    const key = normalizeFieldName(String(row.field_name ?? ''));
    if (!key) continue;
    const override: FieldOverride = {
      sourceKey: String(row.source_key ?? ''),
      literalValue: row.literal_value ?? null,
    };
    if (row.agreement_template_id) {
      const bucket = byTemplate.get(row.agreement_template_id) ?? {};
      bucket[key] = override;
      byTemplate.set(row.agreement_template_id, bucket);
    } else {
      global[key] = override;
    }
  }

  return { global, byTemplate };
}

export function overridesFor(
  overrides: Awaited<ReturnType<typeof loadFieldOverrides>>,
  templateId: string | null,
): Record<string, FieldOverride> {
  return { ...overrides.global, ...(templateId ? (overrides.byTemplate.get(templateId) ?? {}) : {}) };
}

/** Everything a recipient has ever entered, keyed by the label they saw. */
export async function loadSubmittedValues(
  supabase: UntypedClient,
  recipientId: string,
): Promise<Record<string, string>> {
  const { data } = await supabase
    .from('da_recipient_field')
    .select('field_name, value')
    .eq('recipient_id', recipientId);

  const out: Record<string, string> = {};
  for (const row of (data as { field_name: string; value: string }[] | null) ?? []) {
    if (row.value?.trim()) out[row.field_name] = row.value;
  }
  return out;
}

/** Records what a recipient entered, newest answer winning per label. */
export async function captureRecipientValues(
  supabase: UntypedClient,
  recipientId: string,
  values: Record<string, string>,
  agreementId: string | null,
): Promise<number> {
  const entries = Object.entries(values).filter(([name, value]) => name.trim() && value.trim());
  if (entries.length === 0) return 0;

  const { data: existing } = await supabase
    .from('da_recipient_field')
    .select('id, field_key, value')
    .eq('recipient_id', recipientId);

  const known = new Map<string, { id: string; value: string }>();
  for (const row of (existing as { id: string; field_key: string; value: string }[] | null) ?? []) {
    known.set(row.field_key, { id: row.id, value: row.value });
  }

  const inserts: Record<string, unknown>[] = [];
  let written = 0;

  for (const [name, value] of entries) {
    const key = name.trim().toLowerCase();
    const match = known.get(key);
    if (!match) {
      inserts.push({
        recipient_id: recipientId,
        field_name: name.trim(),
        value,
        source: 'docuseal',
        agreement_id: agreementId,
      });
      written += 1;
    } else if (match.value !== value) {
      await supabase
        .from('da_recipient_field')
        .update({ value, source: 'docuseal', agreement_id: agreementId, observed_at: new Date().toISOString() })
        .eq('id', match.id);
      written += 1;
    }
  }

  if (inserts.length > 0) {
    await supabase.from('da_recipient_field').insert(inserts);
  }

  return written;
}

/**
 * Pulls every template, submission and submitted value out of DocuSeal, then
 * pre-fills the forms that are still waiting on a signature.
 */
export async function syncDocuSeal(
  supabase: UntypedClient,
  settings: DaSettings,
): Promise<SyncResult> {
  const apiKey = docusealApiKey(settings);
  if (!apiKey) {
    return { ok: false, error: 'Add a DocuSeal API key in Settings before syncing.' };
  }

  const { data: run } = await supabase.from('da_sync_run').insert({}).select('id').single();
  const runId = (run as { id: string } | null)?.id ?? null;

  const finish = async (result: SyncResult) => {
    if (runId) {
      await supabase
        .from('da_sync_run')
        .update({
          finished_at: new Date().toISOString(),
          ok: result.ok,
          error: result.ok ? null : result.error,
          templates_synced: result.ok ? result.counts.templates : 0,
          submissions_synced: result.ok ? result.counts.submissions : 0,
          recipients_created: result.ok ? result.counts.recipientsCreated : 0,
          values_captured: result.ok ? result.counts.valuesCaptured : 0,
        })
        .eq('id', runId);
    }
    if (result.ok) {
      await supabase
        .from('da_settings')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('id', 1);
    }
    return result;
  };

  const templatesResult = await listDocuSealTemplates(apiKey);
  if (!templatesResult.ok) return finish({ ok: false, error: templatesResult.error });

  const submissionsResult = await listDocuSealSubmissions(apiKey);
  if (!submissionsResult.ok) return finish({ ok: false, error: submissionsResult.error });

  // Values live on submitters, not on the submissions list.
  const submittersResult = await listDocuSealSubmitters(apiKey);
  const submitterValues = new Map<string, DocuSealSubmitter>();
  if (submittersResult.ok) {
    for (const submitter of submittersResult.data) {
      if (submitter.id != null) submitterValues.set(String(submitter.id), submitter);
    }
  }

  const counts: SyncCounts = {
    templates: 0,
    submissions: 0,
    recipientsCreated: 0,
    valuesCaptured: 0,
    prefilled: 0,
  };

  // Templates -----------------------------------------------------------
  const { data: localTemplates } = await supabase.from('da_agreement_template').select('*');
  const templateByDocuSealId = new Map<string, TemplateRow>();
  for (const row of (localTemplates as TemplateRow[] | null) ?? []) {
    templateByDocuSealId.set(String(row.docuseal_template_id), row);
  }

  for (const template of templatesResult.data) {
    const docusealId = String(template.id);
    const payload = {
      name: template.name || `DocuSeal template ${docusealId}`,
      docuseal_template_id: docusealId,
      docuseal_slug: template.slug ?? null,
      docuseal_folder: template.folder_name ?? null,
      docuseal_fields: template.fields ?? [],
      docuseal_submitters: template.submitters ?? [],
      archived: Boolean(template.archived_at),
      synced_at: new Date().toISOString(),
    };

    const existing = templateByDocuSealId.get(docusealId);
    if (existing) {
      // The local name and recipient type are an administrator's to set.
      const { data: updated } = await supabase
        .from('da_agreement_template')
        .update({ ...payload, name: existing.name })
        .eq('id', existing.id)
        .select('*')
        .single();
      if (updated) templateByDocuSealId.set(docusealId, updated);
    } else {
      const { data: inserted } = await supabase
        .from('da_agreement_template')
        .insert({
          ...payload,
          description: `Pulled from DocuSeal${template.folder_name ? ` · ${template.folder_name}` : ''}`,
          recipient_type: inferRecipientType(template),
        })
        .select('*')
        .single();
      if (inserted) templateByDocuSealId.set(docusealId, inserted);
    }
    counts.templates += 1;
  }

  // Recipients and agreements -------------------------------------------
  const { data: localRecipients } = await supabase.from('da_recipient').select('*');
  const recipientByEmail = new Map<string, RecipientRow>();
  for (const row of (localRecipients as RecipientRow[] | null) ?? []) {
    recipientByEmail.set(String(row.email).toLowerCase(), row);
  }

  const { data: localAgreements } = await supabase
    .from('da_agreement')
    .select('*')
    .not('docuseal_submission_id', 'is', null);
  const agreementBySubmission = new Map<string, AgreementRow>();
  for (const row of (localAgreements as AgreementRow[] | null) ?? []) {
    agreementBySubmission.set(String(row.docuseal_submission_id), row);
  }

  const overrides = await loadFieldOverrides(supabase);

  for (const submission of submissionsResult.data) {
    const submissionId = String(submission.id);
    const listed = primarySubmitter(submission);
    const detailed = listed?.id != null ? submitterValues.get(String(listed.id)) : undefined;
    const submitter = { ...(listed ?? {}), ...(detailed ?? {}) } as DocuSealSubmitter;

    const email = (submitter.email ?? '').trim().toLowerCase();
    const docusealTemplateId = submission.template?.id != null ? String(submission.template.id) : '';
    const template = templateByDocuSealId.get(docusealTemplateId);
    if (!template || !email) continue;

    let found = recipientByEmail.get(email);
    if (!found) {
      const values = submitterValueMap(submitter);
      const profileGuess = buildProfile({
        recipient: { full_name: submitter.name || nameFromEmail(email), email },
        submitted: values,
      });
      const recipientType: RecipientType = template.recipient_type ?? 'client';
      const { data: created } = await supabase
        .from('da_recipient')
        .insert({
          full_name: submitter.name?.trim() || nameFromEmail(email),
          email,
          phone: submitter.phone ?? null,
          recipient_type: recipientType,
          business_name:
            recipientType === 'client'
              ? profileGuess.business_name || businessFromEmail(email)
              : null,
          status: 'active',
          notes: 'Imported from DocuSeal.',
        })
        .select('*')
        .single();
      if (!created) continue;
      found = created as RecipientRow;
      recipientByEmail.set(email, found);
      counts.recipientsCreated += 1;
    }
    const recipient: RecipientRow = found;

    const values = submitterValueMap(submitter);
    const status = docuSealStatusToAgreementStatus(submission.status, submitter);
    const signedUrl =
      submitter.documents?.find((d) => d.url)?.url ??
      submission.documents?.find((d) => d.url)?.url ??
      submission.combined_document_url ??
      null;

    const payload = {
      docuseal_submission_id: submissionId,
      docuseal_submitter_id: submitter.id != null ? String(submitter.id) : null,
      docuseal_slug: submission.slug ?? null,
      submitter_email: email,
      signing_url: submitterSigningUrl(submitter),
      status,
      viewed_at: submitter.opened_at ?? null,
      completed_at: submission.completed_at ?? submitter.completed_at ?? null,
      signed_document_url: status === 'completed' ? signedUrl : null,
      audit_log_url: submission.audit_log_url ?? null,
      submitted_values: values,
      synced_at: new Date().toISOString(),
    };

    const known = agreementBySubmission.get(submissionId);
    if (known) {
      await supabase.from('da_agreement').update(payload).eq('id', known.id);
    } else {
      const { data: inserted } = await supabase
        .from('da_agreement')
        .insert({
          ...payload,
          recipient_id: recipient.id,
          template_id: template.id,
          source: 'docuseal',
          sent_at: submitter.sent_at ?? submission.created_at ?? new Date().toISOString(),
        })
        .select('id, docuseal_submission_id')
        .single();
      if (!inserted) continue;
      agreementBySubmission.set(submissionId, inserted as AgreementRow);
    }
    const agreement = agreementBySubmission.get(submissionId);
    if (!agreement) continue;

    counts.submissions += 1;
    counts.valuesCaptured += await captureRecipientValues(
      supabase,
      recipient.id,
      values,
      agreement.id,
    );

    // Auto-map and push the values onto forms that have not been signed yet.
    const awaitingSignature = status === 'sent' || status === 'viewed';
    if (!settings.auto_prefill || !awaitingSignature || submitter.id == null) continue;

    const submitted = await loadSubmittedValues(supabase, recipient.id);
    const mapped = mapFields(templateFields(template), {
      profile: buildProfile({
        recipient,
        submitted,
        bookingUrl: settings.default_booking_url,
      }),
      submitted,
      overrides: overridesFor(overrides, template.id),
    });

    // Never overwrite something the signer has already typed on this form.
    const pending = mapped.filter((field) => !(values[field.name] ?? '').trim());
    const fields = toDocuSealFields(pending, { readonly: settings.prefill_readonly });
    if (fields.length === 0) continue;

    const prefill = await prefillDocuSealSubmitter(apiKey, String(submitter.id), fields);
    if (!prefill.ok) continue;

    counts.prefilled += 1;
    await supabase
      .from('da_agreement')
      .update({
        prefilled_values: Object.fromEntries(fields.map((f) => [f.name, f.default_value])),
        unmapped_fields: mappingSummary(mapped).unmapped,
      })
      .eq('id', agreement.id);
  }

  return finish({ ok: true, counts });
}
