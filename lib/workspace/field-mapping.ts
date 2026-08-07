/**
 * Automatic DocuSeal field mapping.
 *
 * A DocuSeal template names its fields for humans ("Client Full Name", "Co.
 * Email"), not for us. This module decides, for every field on a template,
 * which known value belongs in it — so an agreement arrives pre-filled with
 * everything the recipient has already told us, before signing occurs.
 *
 * Precedence, strongest first:
 *   1. an attached tokenized page URL for that field,
 *   2. an administrator's explicit override,
 *   3. the same field label the recipient filled on an earlier agreement,
 *   4. a canonical profile value matched by alias,
 *   5. nothing — the field is left for the signer.
 */

export type ProfileKey =
  | 'full_name'
  | 'first_name'
  | 'last_name'
  | 'legal_name'
  | 'email'
  | 'phone'
  | 'business_name'
  | 'job_title'
  | 'address'
  | 'city'
  | 'state'
  | 'postal_code'
  | 'country'
  | 'website'
  | 'date'
  | 'booking_url'
  | 'company_name'
  | 'company_rep'
  | 'company_email'
  | 'company_title';

export type FieldOrigin = 'page' | 'override' | 'submitted' | 'profile' | 'none' | 'skipped';
export type MatchConfidence = 'exact' | 'high' | 'medium' | 'none';

export type TemplateField = {
  name: string;
  type?: string;
  required?: boolean;
  submitter_uuid?: string;
};

export type FieldOverride = {
  /** A ProfileKey, or 'literal' to use literalValue, or 'ignore' to skip. */
  sourceKey: string;
  literalValue?: string | null;
};

export type MappedField = {
  name: string;
  type: string;
  required: boolean;
  value: string | null;
  sourceKey: string | null;
  sourceLabel: string;
  origin: FieldOrigin;
  confidence: MatchConfidence;
};

export type MappingContext = {
  /** Canonical values derived from the recipient record and past submissions. */
  profile: Partial<Record<ProfileKey, string>>;
  /** Every field label the recipient has filled before, keyed by raw label. */
  submitted: Record<string, string>;
  /** Field name → tokenized page URL, from the template's attached pages. */
  pageUrls?: Record<string, string>;
  /** Field name (lowercased) → administrator override. */
  overrides?: Record<string, FieldOverride>;
};

type ProfileDefinition = {
  key: ProfileKey;
  label: string;
  aliases: string[];
};

/** Canonical values and the labels a document is likely to call them. */
export const PROFILE_FIELDS: ProfileDefinition[] = [
  {
    key: 'full_name',
    label: 'Full name',
    aliases: [
      'full name',
      'name',
      'your name',
      'client name',
      'customer name',
      'signer name',
      'signature name',
      'printed name',
      'print name',
      'recipient name',
      'contact name',
      'operator name',
      'contractor name',
      'partner name',
      'member name',
      'owner name',
      'authorized signatory',
      'signatory',
    ],
  },
  {
    key: 'first_name',
    label: 'First name',
    aliases: ['first name', 'given name', 'forename', 'first'],
  },
  {
    key: 'last_name',
    label: 'Last name',
    aliases: ['last name', 'surname', 'family name', 'last'],
  },
  {
    key: 'legal_name',
    label: 'Legal name',
    aliases: ['legal name', 'legal full name', 'contractor legal name'],
  },
  {
    key: 'email',
    label: 'Email',
    aliases: [
      'email',
      'e mail',
      'email address',
      'work email',
      'business email',
      'contact email',
      'client email',
      'your email',
    ],
  },
  {
    key: 'phone',
    label: 'Phone',
    aliases: [
      'phone',
      'phone number',
      'telephone',
      'telephone number',
      'mobile',
      'mobile number',
      'cell',
      'cell phone',
      'contact number',
      'best number',
    ],
  },
  {
    key: 'business_name',
    label: 'Business name',
    aliases: [
      'business name',
      'company',
      'company name',
      'business',
      'organization',
      'organisation',
      'organization name',
      'entity',
      'entity name',
      'legal entity',
      'client company',
      'brand',
      'brand name',
      'dba',
      'llc',
      'company legal name',
    ],
  },
  {
    key: 'job_title',
    label: 'Title',
    aliases: ['title', 'job title', 'role', 'position', 'your title'],
  },
  {
    key: 'address',
    label: 'Address',
    aliases: [
      'address',
      'street address',
      'mailing address',
      'business address',
      'full address',
      'street',
      'address line 1',
      'address 1',
    ],
  },
  { key: 'city', label: 'City', aliases: ['city', 'town'] },
  { key: 'state', label: 'State', aliases: ['state', 'province', 'region', 'state province'] },
  {
    key: 'postal_code',
    label: 'Postal code',
    aliases: ['zip', 'zip code', 'postal code', 'postcode', 'post code'],
  },
  { key: 'country', label: 'Country', aliases: ['country'] },
  {
    key: 'website',
    label: 'Website',
    aliases: ['website', 'web site', 'url', 'site', 'domain', 'company website'],
  },
  {
    key: 'date',
    label: "Today's date",
    aliases: [
      'date',
      'today',
      'todays date',
      'date signed',
      'signed date',
      'signature date',
      'effective date',
      'agreement date',
      'execution date',
      'start date',
      'commencement date',
    ],
  },
  {
    key: 'booking_url',
    label: 'Booking link',
    aliases: ['booking link', 'booking url', 'calendar link', 'scheduling link', 'call link'],
  },
  {
    key: 'company_name',
    label: 'Our company name',
    aliases: [
      'company full name',
      'organization name company',
      'countersign company',
      'hiring company',
    ],
  },
  {
    key: 'company_rep',
    label: 'Company representative',
    aliases: [
      'authorized rep',
      'authorized representative',
      'company representative',
      'company rep',
      'representative name',
    ],
  },
  {
    key: 'company_email',
    label: 'Company email',
    aliases: ['company email', 'organization email'],
  },
  {
    key: 'company_title',
    label: 'Company title',
    aliases: ['company title', 'rep title', 'representative title'],
  },
];

const PROFILE_BY_KEY = new Map<string, ProfileDefinition>(PROFILE_FIELDS.map((f) => [f.key, f]));

/** Words that carry no signal about which value a field wants. */
const STOP_WORDS = new Set([
  'the',
  'your',
  'my',
  'our',
  'please',
  'enter',
  'field',
  'info',
  'information',
  'details',
  'detail',
  'of',
  'for',
  'a',
  'an',
  'to',
  'in',
  'on',
  'here',
  'text',
  'input',
  'value',
  'required',
  'optional',
]);

/** Field types a value can be typed into. Everything else is the signer's. */
const FILLABLE_TYPES = new Set([
  '',
  'text',
  'number',
  'date',
  'phone',
  'select',
  'radio',
  'cells',
  'multiple',
]);

export function normalizeFieldName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function meaningfulTokens(name: string): string[] {
  return normalizeFieldName(name)
    .split(' ')
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function tokenOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  const shared = a.filter((token) => setB.has(token)).length;
  return shared / Math.max(a.length, b.length);
}

/** Exact alias hit, else the best-scoring alias above the noise floor. */
export function matchProfileKey(fieldName: string): { key: ProfileKey; confidence: MatchConfidence } | null {
  const normalized = normalizeFieldName(fieldName);
  if (!normalized) return null;

  for (const definition of PROFILE_FIELDS) {
    if (definition.aliases.includes(normalized)) {
      return { key: definition.key, confidence: 'exact' };
    }
  }

  const fieldTokens = meaningfulTokens(fieldName);
  if (fieldTokens.length === 0) return null;

  let best: { key: ProfileKey; score: number } | null = null;
  for (const definition of PROFILE_FIELDS) {
    for (const alias of definition.aliases) {
      const aliasTokens = meaningfulTokens(alias);
      if (aliasTokens.length === 0) continue;

      // "Client Full Name" contains every token of "full name".
      const contained = aliasTokens.every((token) => fieldTokens.includes(token));
      const score = contained ? 0.9 : tokenOverlap(fieldTokens, aliasTokens);
      if (!best || score > best.score) best = { key: definition.key, score };
    }
  }

  if (!best || best.score < 0.5) return null;
  return { key: best.key, confidence: best.score >= 0.9 ? 'high' : 'medium' };
}

export function profileLabel(key: string): string {
  return PROFILE_BY_KEY.get(key)?.label ?? key;
}

export function isFillableType(type: string | undefined): boolean {
  return FILLABLE_TYPES.has((type ?? '').toLowerCase());
}

export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function todayLong(now: Date = new Date()): string {
  return now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * DocuSeal NUMBER fields coerce formatted phones to 0. Digits-only keeps the
 * real number (same fix as NovaraCleaningui's VA contractor map).
 */
export function formatPhoneForField(phone: string | null | undefined, type: string): string {
  const raw = (phone ?? '').trim();
  if (!raw) return '';
  if ((type ?? '').toLowerCase() === 'number') {
    return raw.replace(/\D/g, '');
  }
  return raw;
}

export function splitName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: '', last: '' };
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

/**
 * The recipient record is authoritative for identity; anything the recipient
 * typed on an earlier form fills the gaps the record cannot know about.
 */
export function buildProfile(input: {
  recipient: {
    full_name: string;
    email: string;
    phone?: string | null;
    business_name?: string | null;
  };
  submitted?: Record<string, string>;
  bookingUrl?: string | null;
  /** Company countersign values used on VA / operator agreements. */
  company?: {
    name?: string | null;
    rep?: string | null;
    email?: string | null;
    title?: string | null;
  } | null;
  extras?: Partial<Record<ProfileKey, string>>;
  now?: Date;
}): Partial<Record<ProfileKey, string>> {
  const now = input.now ?? new Date();
  const { first, last } = splitName(input.recipient.full_name);

  const profile: Partial<Record<ProfileKey, string>> = {};
  const set = (key: ProfileKey, value: string | null | undefined) => {
    const trimmed = (value ?? '').trim();
    if (trimmed) profile[key] = trimmed;
  };

  set('full_name', input.recipient.full_name);
  set('first_name', first);
  set('last_name', last);
  set('legal_name', input.recipient.full_name);
  set('email', input.recipient.email);
  set('phone', input.recipient.phone);
  set('business_name', input.recipient.business_name);
  set('booking_url', input.bookingUrl);
  set('date', todayLong(now));
  set('company_name', input.company?.name);
  set('company_rep', input.company?.rep);
  set('company_email', input.company?.email);
  set('company_title', input.company?.title);

  for (const [key, value] of Object.entries(input.extras ?? {}) as [ProfileKey, string][]) {
    if (!profile[key]) set(key, value);
  }

  for (const [label, value] of Object.entries(input.submitted ?? {})) {
    const match = matchProfileKey(label);
    // Never let a stale form answer overwrite the recipient record, and never
    // let one carry a stale date forward.
    if (!match || match.key === 'date' || profile[match.key]) continue;
    set(match.key, value);
  }

  return profile;
}

function formatForType(value: string, type: string, sourceKey: string | null): string {
  if (type === 'date') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }
  if (sourceKey === 'phone') return formatPhoneForField(value, type);
  return value;
}

export function mapField(field: TemplateField, context: MappingContext): MappedField {
  const type = (field.type ?? 'text').toLowerCase();
  const base = {
    name: field.name,
    type,
    required: Boolean(field.required),
  };

  const pageUrl = context.pageUrls?.[field.name];
  if (pageUrl) {
    return {
      ...base,
      value: pageUrl,
      sourceKey: 'page_url',
      sourceLabel: 'Tokenized page',
      origin: 'page',
      confidence: 'exact',
    };
  }

  const override = context.overrides?.[normalizeFieldName(field.name)];
  if (override) {
    if (override.sourceKey === 'ignore') {
      return {
        ...base,
        value: null,
        sourceKey: 'ignore',
        sourceLabel: 'Left for signer',
        origin: 'skipped',
        confidence: 'exact',
      };
    }
    const value =
      override.sourceKey === 'literal'
        ? (override.literalValue ?? '').trim()
        : (context.profile[override.sourceKey as ProfileKey] ?? '').trim();
    return {
      ...base,
      value: value ? formatForType(value, type, override.sourceKey) : null,
      sourceKey: override.sourceKey,
      sourceLabel:
        override.sourceKey === 'literal' ? 'Fixed value' : `${profileLabel(override.sourceKey)} (override)`,
      origin: 'override',
      confidence: 'exact',
    };
  }

  if (!isFillableType(type)) {
    return {
      ...base,
      value: null,
      sourceKey: null,
      sourceLabel: 'Signer completes',
      origin: 'skipped',
      confidence: 'none',
    };
  }

  const normalized = normalizeFieldName(field.name);
  for (const [label, value] of Object.entries(context.submitted)) {
    if (normalizeFieldName(label) === normalized && value.trim()) {
      return {
        ...base,
        value: formatForType(value.trim(), type, matchProfileKey(label)?.key ?? null),
        sourceKey: `submitted:${label}`,
        sourceLabel: 'Previously submitted',
        origin: 'submitted',
        confidence: 'exact',
      };
    }
  }

  const match = matchProfileKey(field.name);
  const profileValue = match ? (context.profile[match.key] ?? '').trim() : '';
  if (match && profileValue) {
    return {
      ...base,
      value: formatForType(profileValue, type, match.key),
      sourceKey: match.key,
      sourceLabel: profileLabel(match.key),
      origin: 'profile',
      confidence: match.confidence,
    };
  }

  return {
    ...base,
    value: null,
    sourceKey: null,
    sourceLabel: 'No match',
    origin: 'none',
    confidence: 'none',
  };
}

export function mapFields(fields: TemplateField[], context: MappingContext): MappedField[] {
  const seen = new Set<string>();
  const mapped: MappedField[] = [];

  for (const field of fields) {
    const name = (field.name ?? '').trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    mapped.push(mapField({ ...field, name }, context));
  }

  // A page URL must reach DocuSeal even when the template catalogue is stale.
  for (const [name, url] of Object.entries(context.pageUrls ?? {})) {
    if (seen.has(name)) continue;
    seen.add(name);
    mapped.push({
      name,
      type: 'text',
      required: false,
      value: url,
      sourceKey: 'page_url',
      sourceLabel: 'Tokenized page',
      origin: 'page',
      confidence: 'exact',
    });
  }

  return mapped;
}

export function toDocuSealFields(
  mapped: MappedField[],
  options?: { readonly?: boolean },
): { name: string; default_value: string; readonly: boolean }[] {
  return mapped
    .filter((field) => field.value != null && field.value !== '')
    .map((field) => ({
      name: field.name,
      default_value: field.value as string,
      // A tokenized page URL is ours to set, never the signer's to edit.
      readonly: field.origin === 'page' ? true : Boolean(options?.readonly),
    }));
}

export function mappingSummary(mapped: MappedField[]): {
  total: number;
  filled: number;
  unmapped: string[];
  missingRequired: string[];
} {
  const fillable = mapped.filter((field) => field.origin !== 'skipped');
  const filled = fillable.filter((field) => field.value);
  const unmapped = fillable.filter((field) => !field.value).map((field) => field.name);
  const missingRequired = fillable
    .filter((field) => field.required && !field.value)
    .map((field) => field.name);
  return { total: fillable.length, filled: filled.length, unmapped, missingRequired };
}
