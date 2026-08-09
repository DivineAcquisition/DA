/**
 * VA / operator DocuSeal agreement mapping.
 *
 * Mirrors the NovaraCleaningui approach: exact template field names are filled
 * from the operator record + company countersign info, then unknown fields on
 * the current template revision are dropped so a re-upload cannot break sends.
 *
 * Two template shapes (same as Novara):
 *   - standard  — VA Independent Contractor Agreement
 *   - hourly    — VA Independent Contractor Agreement (V2 Hourly)
 */

import {
  formatPhoneForField,
  todayIso,
  type MappedField,
  type TemplateField,
} from './field-mapping';

export type OperatorAgreementVariant = 'standard' | 'hourly';

export type CompanyInfo = {
  name: string;
  rep: string;
  email: string;
  title: string;
};

export type OperatorSignerInput = {
  fullName: string;
  legalName?: string | null;
  email: string;
  phone?: string | null;
  address?: string | null;
  now?: Date;
};

/** Infer which VA template shape we are filling from the DocuSeal name. */
export function inferOperatorVariant(templateName: string): OperatorAgreementVariant {
  return /\bhourly\b/i.test(templateName) ? 'hourly' : 'standard';
}

export function companyInfoFromSettings(settings: {
  company_name?: string | null;
  company_rep?: string | null;
  company_email?: string | null;
  company_title?: string | null;
}): CompanyInfo {
  return {
    name: (settings.company_name ?? '').trim() || 'Divine Acquisition',
    rep: (settings.company_rep ?? '').trim() || 'Malik Sannie',
    email: (settings.company_email ?? '').trim() || 'malik@divineacquisition.io',
    title: (settings.company_title ?? '').trim() || 'Owner',
  };
}

/**
 * Exact signer-role values for a VA/operator agreement (Novara parity).
 * Keys are DocuSeal field names on the Contractor submitter.
 */
export function buildOperatorSignerValues(
  input: OperatorSignerInput,
  company: CompanyInfo,
  variant: OperatorAgreementVariant,
): Record<string, string> {
  const now = input.now ?? new Date();
  const date = todayIso(now);
  const name = input.fullName.trim();
  const legal = (input.legalName ?? '').trim() || name;
  const phoneDigits = formatPhoneForField(input.phone, 'number');
  const address = (input.address ?? '').trim();

  if (variant === 'hourly') {
    return compact({
      'Contractor Name': name,
      'Authorized Representative': company.rep,
      'Effective Date': date,
      Date: date,
      // Signature left for the signer on workspace sends.
    });
  }

  return compact({
    'Contractor Name': name,
    'Full Name': name,
    'Legal Name': legal,
    'Full Address': address || undefined,
    'Mobile Number': phoneDigits || undefined,
    Email: input.email.trim(),
    Date: date,
    'Contractor Date': date,
    // Company printed name that lives on the Contractor submitter in the V2 template.
    'Authorized Rep': company.rep,
  });
}

/** Exact company-role values for the countersignature page. */
export function buildOperatorCompanyValues(
  company: CompanyInfo,
  variant: OperatorAgreementVariant,
  now: Date = new Date(),
): Record<string, string> {
  const date = todayIso(now);

  if (variant === 'hourly') {
    return compact({
      'Company Full Name': company.name,
      'Company Signature': company.rep,
    });
  }

  return compact({
    'Effective Date': date,
    'Company Date': date,
    'Company Signature': company.rep,
    Name: company.rep,
    Title: company.title,
    Signature: company.rep,
    Date: date,
  });
}

export function compact(
  values: Record<string, string | undefined | null>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    if (value == null) continue;
    const trimmed = String(value).trim();
    if (trimmed) out[key] = trimmed;
  }
  return out;
}

/** Keep only field names that exist on the current template revision. */
export function filterKnownFields(
  values: Record<string, string>,
  knownNames: Iterable<string>,
): Record<string, string> {
  const known = new Set(knownNames);
  if (known.size === 0) return values;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    if (known.has(key)) out[key] = value;
  }
  return out;
}

export function fieldNamesForRole(
  fields: Array<TemplateField & { submitter_uuid?: string; name: string }>,
  submitters: Array<{ name?: string; uuid?: string }>,
  roleName: string,
): Set<string> {
  const roleUuid = submitters.find(
    (submitter) => (submitter.name ?? '').toLowerCase() === roleName.toLowerCase(),
  )?.uuid;
  const names = new Set<string>();
  for (const field of fields) {
    if (!field.name) continue;
    if (!roleUuid || !field.submitter_uuid || field.submitter_uuid === roleUuid) {
      names.add(field.name);
    }
  }
  return names;
}

/**
 * Overlay exact VA field values onto the generic mapped list. Exact names win
 * when the template has that field and generic mapping left it empty (or when
 * the exact map is more specific, e.g. Authorized Rep → company rep).
 */
export function applyOperatorExactMappings(
  mapped: MappedField[],
  exact: Record<string, string>,
): MappedField[] {
  return mapped.map((field) => {
    const exactValue = exact[field.name];
    if (!exactValue) return field;
    if (field.origin === 'page' || field.origin === 'override' || field.origin === 'skipped') {
      return field;
    }
    return {
      ...field,
      value: exactValue,
      sourceKey: 'operator_exact',
      sourceLabel: 'VA / operator map',
      origin: 'profile',
      confidence: 'exact',
    };
  });
}

export const OPERATOR_SIGNER_ROLE = 'Contractor';
export const OPERATOR_COMPANY_ROLE = 'Company';

/** Prefer Operator (DA placement) then Contractor (VA / Novara). */
export function resolveOperatorSignerRoleName(
  submitters: Array<{ name?: string; uuid?: string }>,
): string {
  const names = submitters.map((submitter) => submitter.name ?? '').filter(Boolean);
  const preferred = ['Operator', 'Contractor', 'Signer', 'Employee'];
  for (const candidate of preferred) {
    if (names.some((name) => name.toLowerCase() === candidate.toLowerCase())) return candidate;
  }
  return OPERATOR_SIGNER_ROLE;
}

/** Prefer the Company role; fall back to Divine Acquisition / common countersign labels. */
export function resolveCompanyRoleName(
  submitters: Array<{ name?: string; uuid?: string }>,
): string {
  const names = submitters.map((submitter) => submitter.name ?? '').filter(Boolean);
  const preferred = [
    'Divine Acquisition',
    'Company',
    'Company Representative',
    'Organization',
  ];
  for (const candidate of preferred) {
    if (names.some((name) => name.toLowerCase() === candidate.toLowerCase())) return candidate;
  }
  return OPERATOR_COMPANY_ROLE;
}

/** Initials from a full name (e.g. "A Sannie" → "AS"). */
export function initialsFromName(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 4);
}

/**
 * Exact signer values for the DA Sales Operator (Placement Role) template
 * (roles: Operator + Divine Acquisition).
 */
export function buildSalesOperatorSignerValues(input: OperatorSignerInput): Record<string, string> {
  const now = input.now ?? new Date();
  const date = todayIso(now);
  const name = input.fullName.trim();
  const address = (input.address ?? '').trim();
  return compact({
    Operator: name,
    Name: name,
    Address: address || undefined,
    'Effective Date': date,
    Date: date,
    'Operator initials': initialsFromName(name) || undefined,
  });
}
