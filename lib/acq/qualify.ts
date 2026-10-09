import { TRACKING_PARAM_KEYS, type TrackingParamKey } from './config';
import type { HeadlineVariant } from './niche-tracking';

export const AD_SPEND_OPTIONS = ['$0', 'Under $2k', '$2-5k', '$5k+'] as const;
export const PROGRAM_PRICE_OPTIONS = ['Under $2k', '$2-5k', '$5k+'] as const;

/** Labels shown on the form. Values match the ClientAcquisition Airtable field. */
export const FOLLOW_UP_OPTIONS = [
  { label: 'Dedicated setter', value: 'Dedicated setter' },
  { label: 'I do it myself', value: 'Founder' },
  { label: 'Nobody, just automations', value: 'Nobody' },
  { label: 'Not sure', value: 'Not sure' },
] as const;

export type AdSpend = (typeof AD_SPEND_OPTIONS)[number];
export type ProgramPrice = (typeof PROGRAM_PRICE_OPTIONS)[number];
export type FollowUpValue = (typeof FOLLOW_UP_OPTIONS)[number]['value'];

export type QualificationInput = {
  fullName: string;
  email: string;
  phone?: string;
  companyName?: string;
  /** What the coach sells. Stored as the coaching niche. */
  offer?: string;
  adSpend?: string;
  /** Whole number of inbound inquiries per month. */
  inquiriesPerMonth?: string;
  followUp?: string;
  programPrice?: string;
  smsConsent?: boolean;
  emailConsent?: boolean;
  /** Honeypot. Bots that fill it are accepted locally and dropped. */
  website?: string;
  tracking?: Partial<Record<TrackingParamKey, string>>;
  /** Set by the roofing (and later niche) form. Coaches leave this empty. */
  niche?: string;
  spendBand?: string;
  headlineVariant?: string;
};

export type QualificationPayload = {
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  companyName: string;
  coachingNiche: string;
  /** Blank when the audit form collected inquiries instead of ad spend. */
  monthlyAdSpend: AdSpend | '';
  inquiriesPerMonth: number | null;
  followUpOwner: FollowUpValue | '';
  followUpOwnerLabel: string;
  programPrice: ProgramPrice | '';
  smsConsent: boolean;
  emailConsent: boolean;
  leadSource: 'Paid Ad';
  entryPoint: 'Audit Booking' | 'Landing Page';
  stage: 'Step 1 Captured';
  source: string;
  tags: string[];
  tracking: Partial<Record<TrackingParamKey, string>>;
  /** Niche ads page only. Coaches leads leave these empty. */
  niche?: string;
  spendBand?: string;
  nicheQualified?: boolean;
  headlineVariant?: HeadlineVariant;
  /** Visit values that are not already keys on `tracking`. */
  attribution?: Record<string, string>;
};

export type QualificationResult = 'Qualified' | 'Manual Review' | 'Disqualified';

export const QUALIFICATION_RESULT_TAGS = {
  Qualified: 'da-qualified',
  'Manual Review': 'da-manual-review',
  Disqualified: 'da-disqualified',
} as const;

export const APP_COMPLETE_TAG = 'da-app-complete';
export const RESULT_TAGS = Object.values(QUALIFICATION_RESULT_TAGS);

export type QualifyErrorField =
  | 'fullName'
  | 'email'
  | 'phone'
  | 'companyName'
  | 'offer'
  | 'adSpend'
  | 'inquiriesPerMonth'
  | 'followUp'
  | 'programPrice'
  | 'smsConsent'
  | 'emailConsent'
  | 'spendBand';

export class QualificationError extends Error {
  readonly field?: QualifyErrorField;

  constructor(message: string, field?: QualifyErrorField) {
    super(message);
    this.name = 'QualificationError';
    this.field = field;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_DIGITS_RE = /\d/g;

export function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? '',
    lastName: parts.slice(1).join(' '),
  };
}

export function followUpValueFromInput(value: string): FollowUpValue | null {
  const match = FOLLOW_UP_OPTIONS.find((option) => option.value === value || option.label === value);
  return match?.value ?? null;
}

export function followUpLabelFromValue(value: FollowUpValue): string {
  return FOLLOW_UP_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function cleanTracking(
  tracking: QualificationInput['tracking'],
): Partial<Record<TrackingParamKey, string>> {
  const cleaned: Partial<Record<TrackingParamKey, string>> = {};
  if (!tracking) return cleaned;
  for (const key of TRACKING_PARAM_KEYS) {
    const value = tracking[key]?.trim();
    if (value) cleaned[key] = value;
  }
  return cleaned;
}

export function isHoneypot(input: Pick<QualificationInput, 'website'>): boolean {
  return Boolean(input.website && input.website.trim());
}

export function parseQualification(input: QualificationInput): QualificationPayload {
  const fullName = input.fullName.trim();
  if (fullName.length < 2) {
    throw new QualificationError('Enter your full name.', 'fullName');
  }

  const email = input.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    throw new QualificationError('Enter a valid email.', 'email');
  }

  const phone = (input.phone ?? '').trim();
  if (phone) {
    const digits = phone.match(PHONE_DIGITS_RE)?.length ?? 0;
    if (digits < 7) {
      throw new QualificationError('Enter a valid phone number.', 'phone');
    }
  }

  const offer = (input.offer ?? '').trim();
  const companyInput = (input.companyName ?? '').trim();
  const blueprint =
    input.offer == null &&
    input.companyName == null &&
    input.followUp == null &&
    input.programPrice == null &&
    input.inquiriesPerMonth == null &&
    input.adSpend == null;

  if (blueprint) {
    const digits = phone.match(PHONE_DIGITS_RE)?.length ?? 0;
    if (digits < 10) {
      throw new QualificationError('Enter a valid phone number.', 'phone');
    }
    if (!input.smsConsent) {
      throw new QualificationError('Agree to calls and texts to continue.', 'smsConsent');
    }
    if (!input.emailConsent) {
      throw new QualificationError('Agree to emails to continue.', 'emailConsent');
    }
  }

  const whatYouSell = offer || companyInput;
  const identityField: QualifyErrorField = input.offer != null ? 'offer' : 'companyName';
  if (!blueprint && whatYouSell.length < 2) {
    throw new QualificationError(
      input.offer != null ? 'Tell us what you sell.' : 'Enter your company name.',
      identityField,
    );
  }
  if (whatYouSell.length > 200) {
    throw new QualificationError('Keep that under 200 characters.', identityField);
  }

  const adSpendRaw = (input.adSpend ?? '').trim();
  let monthlyAdSpend: AdSpend | '' = '';
  if (adSpendRaw) {
    const match = AD_SPEND_OPTIONS.find((option) => option === adSpendRaw);
    if (!match) {
      throw new QualificationError('Select monthly ad spend.', 'adSpend');
    }
    monthlyAdSpend = match;
  }

  const inquiriesRaw = (input.inquiriesPerMonth ?? '').trim();
  let inquiriesPerMonth: number | null = null;
  if (inquiriesRaw) {
    if (!/^\d{1,6}$/.test(inquiriesRaw)) {
      throw new QualificationError('Enter inquiries per month as a whole number.', 'inquiriesPerMonth');
    }
    inquiriesPerMonth = Number(inquiriesRaw);
  } else if (!monthlyAdSpend && !blueprint) {
    throw new QualificationError('Enter how many inquiries you get per month.', 'inquiriesPerMonth');
  }

  const followUpRaw = (input.followUp ?? '').trim();
  const followUpOwner = followUpRaw ? followUpValueFromInput(followUpRaw) : null;
  if (followUpRaw && !followUpOwner) {
    throw new QualificationError('Select who handles follow-up.', 'followUp');
  }
  if (!blueprint && !followUpOwner) {
    throw new QualificationError('Select who handles follow-up.', 'followUp');
  }

  const programPriceRaw = (input.programPrice ?? '').trim();
  const programPrice = programPriceRaw
    ? PROGRAM_PRICE_OPTIONS.find((option) => option === programPriceRaw)
    : undefined;
  if (programPriceRaw && !programPrice) {
    throw new QualificationError('Select your program price.', 'programPrice');
  }
  if (!blueprint && !programPrice) {
    throw new QualificationError('Select your program price.', 'programPrice');
  }

  const { firstName, lastName } = splitName(fullName);
  const companyName = companyInput || (blueprint ? '' : offer);
  const coachingNiche = offer || companyInput || (blueprint ? 'Free blueprint' : '');

  return {
    fullName,
    firstName,
    lastName,
    email,
    phone,
    companyName,
    coachingNiche,
    monthlyAdSpend,
    inquiriesPerMonth,
    followUpOwner: followUpOwner ?? '',
    followUpOwnerLabel: followUpOwner ? followUpLabelFromValue(followUpOwner) : '',
    programPrice: programPrice ?? '',
    smsConsent: Boolean(input.smsConsent),
    emailConsent: Boolean(input.emailConsent),
    leadSource: 'Paid Ad',
    entryPoint: 'Audit Booking',
    stage: 'Step 1 Captured',
    source: 'Founding Install Qualification',
    tags: ['founding-install', 'acq-qualify', APP_COMPLETE_TAG],
    tracking: cleanTracking(input.tracking),
  };
}

export function todayIsoDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function normalizeQualificationResult(value: unknown): QualificationResult | null {
  const text = String(value ?? '')
    .trim()
    .toLowerCase();
  if (text === 'qualified') return 'Qualified';
  if (text === 'manual review' || text === 'manual-review' || text === 'manualreview') {
    return 'Manual Review';
  }
  if (text === 'disqualified') return 'Disqualified';
  return null;
}

export function qualificationResultTag(result: QualificationResult): string {
  return QUALIFICATION_RESULT_TAGS[result];
}

export function parseReadinessScore(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

/** Fields written to the ClientAcquisition Leads table. */
export function airtableFieldsFromPayload(
  payload: QualificationPayload,
  extras: {
    ghlContactId?: string | null;
    today?: string;
    entryPoint?: string;
  } = {},
): Record<string, string> {
  const fields: Record<string, string> = {
    'Lead Name': payload.fullName,
    Email: payload.email,
    'Coaching Niche': payload.coachingNiche,
    'Lead Source': payload.leadSource,
    'Entry Point': extras.entryPoint ?? payload.entryPoint,
    'Opt-In Date': extras.today ?? todayIsoDate(),
    Stage: payload.stage,
    Campaign: payload.tracking.utm_campaign || 'Landing Page',
  };

  if (payload.companyName) fields['Company Name'] = payload.companyName;
  if (payload.followUpOwner) fields['Follow-Up Owner'] = payload.followUpOwner;
  if (payload.programPrice) fields['Program Price'] = payload.programPrice;
  if (payload.phone) fields.Phone = payload.phone;
  if (payload.monthlyAdSpend) fields['Monthly Ad Spend'] = payload.monthlyAdSpend;
  if (payload.tracking.utm_content) fields['Ad Set'] = payload.tracking.utm_content;
  if (extras.ghlContactId) fields['GHL Contact ID'] = extras.ghlContactId;
  fields.Notes = ghlContactNote(payload);

  return fields;
}

/** JSON body posted to the GHL form webhook / Zap so it lands in the existing pipeline. */
export function ghlWebhookBody(payload: QualificationPayload): Record<string, unknown> {
  return {
    fullName: payload.fullName,
    firstName: payload.firstName,
    lastName: payload.lastName,
    first_name: payload.firstName,
    last_name: payload.lastName,
    name: payload.fullName,
    email: payload.email,
    phone: payload.phone,
    companyName: payload.companyName,
    company_name: payload.companyName,
    coachingNiche: payload.coachingNiche,
    offer: payload.coachingNiche,
    monthlyAdSpend: payload.monthlyAdSpend,
    monthly_ad_spend: payload.monthlyAdSpend,
    inquiriesPerMonth: payload.inquiriesPerMonth,
    inquiries_per_month: payload.inquiriesPerMonth,
    followUpOwner: payload.followUpOwner,
    follow_up_owner: payload.followUpOwner,
    followUpOwnerLabel: payload.followUpOwnerLabel,
    programPrice: payload.programPrice,
    program_price: payload.programPrice,
    leadSource: payload.leadSource,
    lead_source: payload.leadSource,
    entryPoint: payload.entryPoint,
    entry_point: payload.entryPoint,
    stage: payload.stage,
    source: payload.source,
    tags: payload.tags,
    ...(payload.niche
      ? {
          niche: payload.niche,
          spendBand: payload.spendBand,
          spend_band: payload.spendBand,
          qualified: payload.nicheQualified ? 'yes' : 'no',
          headlineVariant: payload.headlineVariant,
          headline_variant: payload.headlineVariant,
        }
      : {}),
    ...payload.tracking,
    ...(payload.attribution ?? {}),
  };
}

export function ghlContactNote(payload: QualificationPayload): string {
  const visit = { ...payload.tracking, ...(payload.attribution ?? {}) };
  const visitLines = payload.niche
    ? Object.entries(visit)
        .filter((entry): entry is [string, string] => Boolean(entry[1]))
        .map(([key, value]) => `${key}: ${value}`)
    : [];
  return [
    payload.niche ? `${payload.niche} Lead Leak Audit` : 'Founding install qualification',
    `What they sell: ${payload.coachingNiche}`,
    payload.companyName ? `Company: ${payload.companyName}` : null,
    payload.niche ? `Niche: ${payload.niche}` : null,
    payload.spendBand ? `Spend band: ${payload.spendBand}` : null,
    payload.nicheQualified == null ? null : `Qualified: ${payload.nicheQualified ? 'yes' : 'no'}`,
    payload.headlineVariant ? `Headline: ${payload.headlineVariant}` : null,
    payload.monthlyAdSpend ? `Monthly ad spend: ${payload.monthlyAdSpend}` : null,
    payload.inquiriesPerMonth != null ? `Inquiries per month: ${payload.inquiriesPerMonth}` : null,
    payload.followUpOwner
      ? `Follow-up: ${payload.followUpOwnerLabel} (${payload.followUpOwner})`
      : null,
    payload.programPrice ? `Program price: ${payload.programPrice}` : null,
    payload.smsConsent ? 'Consent to calls and texts: yes' : null,
    payload.emailConsent ? 'Consent to email and the free blueprint: yes' : null,
    ...visitLines,
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n');
}
