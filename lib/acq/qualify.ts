import { TRACKING_PARAM_KEYS, type TrackingParamKey } from './config';

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
  phone: string;
  companyName: string;
  adSpend: string;
  followUp: string;
  programPrice: string;
  /** Honeypot. Bots that fill it are accepted locally and dropped. */
  website?: string;
  tracking?: Partial<Record<TrackingParamKey, string>>;
};

export type QualificationPayload = {
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  companyName: string;
  coachingNiche: string;
  monthlyAdSpend: AdSpend;
  followUpOwner: FollowUpValue;
  followUpOwnerLabel: string;
  programPrice: ProgramPrice;
  leadSource: 'Paid Ad';
  entryPoint: 'Audit Booking' | 'Landing Page';
  stage: 'Step 1 Captured';
  source: 'Founding Install Qualification';
  tags: string[];
  tracking: Partial<Record<TrackingParamKey, string>>;
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
  | 'adSpend'
  | 'followUp'
  | 'programPrice';

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

  const phone = input.phone.trim();
  const digits = phone.match(PHONE_DIGITS_RE)?.length ?? 0;
  if (digits < 7) {
    throw new QualificationError('Enter a valid phone number.', 'phone');
  }

  const companyName = input.companyName.trim();
  if (companyName.length < 2) {
    throw new QualificationError('Enter your company name.', 'companyName');
  }

  const monthlyAdSpend = AD_SPEND_OPTIONS.find((option) => option === input.adSpend);
  if (!monthlyAdSpend) {
    throw new QualificationError('Select monthly ad spend.', 'adSpend');
  }

  const followUpOwner = followUpValueFromInput(input.followUp);
  if (!followUpOwner) {
    throw new QualificationError('Select who handles follow-up.', 'followUp');
  }

  const programPrice = PROGRAM_PRICE_OPTIONS.find((option) => option === input.programPrice);
  if (!programPrice) {
    throw new QualificationError('Select your program price.', 'programPrice');
  }

  const { firstName, lastName } = splitName(fullName);

  return {
    fullName,
    firstName,
    lastName,
    email,
    phone,
    companyName,
    coachingNiche: companyName,
    monthlyAdSpend,
    followUpOwner,
    followUpOwnerLabel: followUpLabelFromValue(followUpOwner),
    programPrice,
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
    Phone: payload.phone,
    'Company Name': payload.companyName,
    'Coaching Niche': payload.coachingNiche,
    'Monthly Ad Spend': payload.monthlyAdSpend,
    'Follow-Up Owner': payload.followUpOwner,
    'Program Price': payload.programPrice,
    'Lead Source': payload.leadSource,
    'Entry Point': extras.entryPoint ?? payload.entryPoint,
    'Opt-In Date': extras.today ?? todayIsoDate(),
    Stage: payload.stage,
    Campaign: payload.tracking.utm_campaign || 'Landing Page',
  };

  if (payload.tracking.utm_content) fields['Ad Set'] = payload.tracking.utm_content;
  if (extras.ghlContactId) fields['GHL Contact ID'] = extras.ghlContactId;

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
    monthlyAdSpend: payload.monthlyAdSpend,
    monthly_ad_spend: payload.monthlyAdSpend,
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
    ...payload.tracking,
  };
}

export function ghlContactNote(payload: QualificationPayload): string {
  return [
    'Founding install qualification',
    `Company: ${payload.companyName}`,
    `Monthly ad spend: ${payload.monthlyAdSpend}`,
    `Follow-up: ${payload.followUpOwnerLabel} (${payload.followUpOwner})`,
    `Program price: ${payload.programPrice}`,
  ].join('\n');
}
