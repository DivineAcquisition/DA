import type { DocuSealFieldInput } from './docuseal';
import { normalizeFieldName, type TemplateField } from './field-mapping';
import { consentsForRecipientType } from './consents';
import { resolveOperatorSignerRoleName } from './operator-agreement';

export const SIGNATURE_REQUIRED = 'Draw or type your signature before you submit.';
export const SIGNATURE_IMAGE_INVALID = "Draw or type your signature again. That image isn't valid.";
export const INITIALS_REQUIRED = 'Add your initials before you submit.';
export const INITIALS_IMAGE_INVALID = "Draw or type your initials again. That image isn't valid.";
export const CONSENTS_REQUIRED = 'Confirm each statement before you sign.';
export const SIGNATURE_FIELD_MISSING = 'This agreement has no signature line to fill yet.';

const PNG_PREFIX = 'data:image/png;base64,';
/** A drawn signature is a few dozen kilobytes. Anything larger is refused. */
const MAX_DATA_URL_CHARS = 450_000;
const MIN_SIDE = 16;
const MAX_WIDTH = 4096;
const MAX_HEIGHT = 2048;

export type SignSlots = {
  signature: string[];
  initials: string[];
};

export type SigningCatalogue = {
  submitterId: string;
  submissionId: string;
  templateId: string;
  recipientType: string;
  fields: TemplateField[];
  submitters: Array<{ name?: string; uuid?: string }>;
};

export type SignaturePlan =
  | { ok: true; fields: DocuSealFieldInput[]; stored: Record<string, string>; slots: SignSlots }
  | { ok: false; error: string };

function asArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function parseTemplateFields(raw: unknown): TemplateField[] {
  const fields: TemplateField[] = [];
  for (const entry of asArray(raw)) {
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;
    const name = String(record.name ?? '').trim();
    if (!name) continue;
    fields.push({
      name,
      type: record.type == null || record.type === '' ? undefined : String(record.type),
      required: record.required === true,
      submitter_uuid: record.submitter_uuid ? String(record.submitter_uuid) : undefined,
    });
  }
  return fields;
}

export function parseSubmitters(raw: unknown): Array<{ name?: string; uuid?: string }> {
  const submitters: Array<{ name?: string; uuid?: string }> = [];
  for (const entry of asArray(raw)) {
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;
    const name = String(record.name ?? '').trim();
    const uuid = String(record.uuid ?? '').trim();
    if (!name && !uuid) continue;
    submitters.push({ name: name || undefined, uuid: uuid || undefined });
  }
  return submitters;
}

export function catalogueFromSigningPayload(raw: unknown): SigningCatalogue | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const agreement = record.agreement;
  const template = record.template;
  if (!agreement || typeof agreement !== 'object' || !template || typeof template !== 'object') return null;

  const agreementRow = agreement as Record<string, unknown>;
  const templateRow = template as Record<string, unknown>;
  const recipient = record.recipient;
  const recipientRow = recipient && typeof recipient === 'object' ? (recipient as Record<string, unknown>) : {};

  return {
    submitterId: String(agreementRow.docuseal_submitter_id ?? '').trim(),
    submissionId: String(agreementRow.docuseal_submission_id ?? '').trim(),
    templateId: String(templateRow.docuseal_template_id ?? '').trim(),
    recipientType: String(recipientRow.recipient_type ?? templateRow.recipient_type ?? 'client'),
    fields: parseTemplateFields(templateRow.docuseal_fields),
    submitters: parseSubmitters(templateRow.docuseal_submitters),
  };
}

/** Signature and initials are images. A date or printed name that mentions "signature" is not. */
export function signSlot(field: { name: string; type?: string }): 'signature' | 'initials' | null {
  const type = (field.type ?? '').trim().toLowerCase();
  if (type === 'signature') return 'signature';
  if (type === 'initials') return 'initials';
  if (type === 'image') {
    const name = normalizeFieldName(field.name);
    if (/\binitials?\b/.test(name)) return 'initials';
    if (/\bsignature\b/.test(name)) return 'signature';
    return null;
  }
  if (type) return null;

  const name = normalizeFieldName(field.name);
  if (/\binitials?\b/.test(name)) return 'initials';
  if (/\bsignature\b/.test(name) && !/\b(date|name|print|printed)\b/.test(name)) return 'signature';
  return null;
}

function isCompanyOwnedName(name: string): boolean {
  const normalized = normalizeFieldName(name);
  return (
    normalized === 'company' ||
    normalized.startsWith('company ') ||
    normalized.startsWith('divine acquisition') ||
    normalized.includes('countersign')
  );
}

function pickNamedRole(submitters: Array<{ name?: string }>, preferred: string[]): string {
  const names = submitters.map((submitter) => submitter.name ?? '').filter(Boolean);
  for (const candidate of preferred) {
    if (names.some((name) => name.toLowerCase() === candidate.toLowerCase())) return candidate;
  }
  return names[0] ?? '';
}

function signerRoleUuid(
  submitters: Array<{ name?: string; uuid?: string }>,
  recipientType: string | null | undefined,
): string | undefined {
  const roleName =
    recipientType === 'operator'
      ? resolveOperatorSignerRoleName(submitters)
      : pickNamedRole(submitters, ['Client', 'First Party', 'Signer', 'Customer', 'Recipient']);
  if (!roleName) return undefined;
  return submitters.find((submitter) => (submitter.name ?? '').toLowerCase() === roleName.toLowerCase())?.uuid;
}

function includeSignField(
  field: TemplateField,
  recipientType: string | null | undefined,
  signerUuid: string | undefined,
): boolean {
  if (signerUuid && field.submitter_uuid && field.submitter_uuid !== signerUuid) return false;
  if (recipientType === 'operator' && isCompanyOwnedName(field.name)) {
    return Boolean(signerUuid && field.submitter_uuid === signerUuid);
  }
  return true;
}

function unique(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of names) {
    if (seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

/** The signer's signature and initials lines. Company countersign lines stay untouched. */
export function collectSignFields(input: {
  fields: TemplateField[];
  submitters: Array<{ name?: string; uuid?: string }>;
  recipientType: string | null | undefined;
}): SignSlots {
  const signerUuid = signerRoleUuid(input.submitters, input.recipientType);
  const signature: string[] = [];
  const initials: string[] = [];
  for (const field of input.fields) {
    if (!includeSignField(field, input.recipientType, signerUuid)) continue;
    const slot = signSlot(field);
    if (slot === 'signature') signature.push(field.name);
    if (slot === 'initials') initials.push(field.name);
  }
  return { signature: unique(signature), initials: unique(initials) };
}

/**
 * A PNG data URL from the signature pad. The bytes are checked, not just the
 * prefix, and the returned URL is re-encoded so the value we send is only a PNG.
 */
export function readSignaturePng(value: string): { ok: true; dataUrl: string } | { ok: false; error: string } {
  const trimmed = value.trim();
  if (!trimmed.startsWith(PNG_PREFIX) || trimmed.length > MAX_DATA_URL_CHARS) {
    return { ok: false, error: 'invalid image' };
  }
  const encoded = trimmed.slice(PNG_PREFIX.length);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length % 4 !== 0) {
    return { ok: false, error: 'invalid image' };
  }

  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.length < 24 || bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) {
    return { ok: false, error: 'invalid image' };
  }
  if (bytes.toString('ascii', 12, 16) !== 'IHDR') return { ok: false, error: 'invalid image' };

  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width < MIN_SIDE || height < MIN_SIDE || width > MAX_WIDTH || height > MAX_HEIGHT) {
    return { ok: false, error: 'invalid image' };
  }

  return { ok: true, dataUrl: `${PNG_PREFIX}${bytes.toString('base64')}` };
}

function checkboxNames(
  fields: TemplateField[],
  recipientType: string | null | undefined,
  consentIds: string[],
  include: (field: TemplateField) => boolean,
): string[] {
  const checked = new Set(consentIds);
  const names: string[] = [];
  for (const consent of consentsForRecipientType(recipientType)) {
    if (!checked.has(consent.id)) continue;
    for (const alias of consent.docusealFields ?? []) {
      const aliasName = normalizeFieldName(alias);
      const match = fields.find(
        (field) =>
          include(field) &&
          normalizeFieldName(field.name) === aliasName &&
          (field.type ?? '').toLowerCase() === 'checkbox',
      );
      if (match) names.push(match.name);
    }
  }
  return unique(names);
}

function storedValue(value: string | boolean): string {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value.startsWith('data:image/')) return '[signature]';
  return value;
}

/**
 * One signature image is written onto every signature line, and one initials
 * image onto every initials line. Consent checkboxes that exist on the
 * template are checked too. Nothing else on the document is changed.
 */
export function planSignaturePlacement(input: {
  fields: TemplateField[];
  submitters: Array<{ name?: string; uuid?: string }>;
  recipientType: string | null | undefined;
  signatureImage: string;
  initialsImage?: string | null;
  consentIds: string[];
}): SignaturePlan {
  if (!input.signatureImage.trim()) return { ok: false, error: SIGNATURE_REQUIRED };
  const signature = readSignaturePng(input.signatureImage);
  if (!signature.ok) return { ok: false, error: SIGNATURE_IMAGE_INVALID };

  const slots = collectSignFields(input);
  if (slots.signature.length === 0) return { ok: false, error: SIGNATURE_FIELD_MISSING };

  let initialsUrl: string | null = null;
  if (slots.initials.length > 0) {
    if (!(input.initialsImage ?? '').trim()) return { ok: false, error: INITIALS_REQUIRED };
    const initials = readSignaturePng(input.initialsImage ?? '');
    if (!initials.ok) return { ok: false, error: INITIALS_IMAGE_INVALID };
    initialsUrl = initials.dataUrl;
  }

  const required = consentsForRecipientType(input.recipientType);
  const checked = new Set(input.consentIds);
  if (required.some((consent) => !checked.has(consent.id))) {
    return { ok: false, error: CONSENTS_REQUIRED };
  }

  const signerUuid = signerRoleUuid(input.submitters, input.recipientType);
  const include = (field: TemplateField) => includeSignField(field, input.recipientType, signerUuid);
  const checks = checkboxNames(input.fields, input.recipientType, input.consentIds, include);

  const fields: DocuSealFieldInput[] = slots.signature.map((name) => ({
    name,
    default_value: signature.dataUrl,
    readonly: true,
  }));
  if (initialsUrl) {
    for (const name of slots.initials) fields.push({ name, default_value: initialsUrl, readonly: true });
  }
  for (const name of checks) fields.push({ name, default_value: true, readonly: true });

  const stored: Record<string, string> = {};
  for (const field of fields) stored[field.name] = storedValue(field.default_value);

  return { ok: true, fields, stored, slots };
}
