/**
 * The Sales Operations forms on the company site:
 *
 *  1. The diagnostic request (qualification). Short, required before booking.
 *  2. The pre-discovery questionnaire. Longer, sent after the call is booked.
 *  3. The podcast 1-on-1 request. Both in one, for listeners, before booking.
 *
 * Options and validation live here so the page and the API agree on both.
 * Nothing in this file touches the network.
 */

export const POSITIONS = [
  'Founder / Owner',
  'CEO / Managing Partner',
  'Sales Director / Manager',
  'Operations Director / Manager',
  'Other',
] as const;

export const BUSINESS_TYPES = [
  'B2B Consultancy',
  'Specialized Agency',
  'Professional Services',
  'Roofing / Remodeling',
  'Other High-End Local Services',
  'Other',
] as const;

export const DEAL_VALUES = ['Under $1,000', '$1,000–$5,000', '$5,001–$20,000', 'Over $20,000', 'Varies / Not Sure'] as const;

export const MONTHLY_OPPORTUNITIES = ['0–10', '11–30', '31–100', 'Over 100', 'Not Sure'] as const;

export const CONSTRAINTS = [
  'Slow response to new leads',
  'Inconsistent sales follow-up',
  'Unqualified leads',
  'Proposals or estimates going quiet',
  'Poor CRM organization',
  'Limited pipeline visibility',
  'Unclear salesperson accountability',
  'Missed reactivation or expansion opportunities',
  'Unsure',
] as const;

export const CRMS = [
  'GoHighLevel',
  'HubSpot',
  'Salesforce',
  'Pipedrive',
  'Another CRM',
  'Spreadsheets / Manual Process',
  'No CRM',
] as const;

export const TIMELINES = ['Within 30 days', 'Within 31–90 days', 'More than 90 days', 'Exploring Options'] as const;

export const SALES_CYCLES = ['Same day', '2–7 days', '1–4 weeks', '1–3 months', 'More than 3 months', 'Varies / Unsure'] as const;

export const SOURCES = [
  'Paid Ads',
  'Cold Outbound',
  'Referrals',
  'Organic Search',
  'Content / Social Media',
  'Partnerships',
  'Existing Customers',
  'Other',
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number];

/** Which follow-up questions the pre-discovery questionnaire asks. */
export type BusinessTrack = 'b2b' | 'local' | 'general';

export function trackFor(type: string | undefined | null): BusinessTrack {
  if (type === 'B2B Consultancy' || type === 'Specialized Agency' || type === 'Professional Services') return 'b2b';
  if (type === 'Roofing / Remodeling' || type === 'Other High-End Local Services') return 'local';
  return 'general';
}

/** `field` is the first problem; `fields` lists every field that needs attention. */
export type FormError = { ok: false; error: string; field?: string; fields?: Record<string, string> };

export const HONEYPOT_FIELD = 'company_url_confirm';

/* ------------------------------------------------------------------------ */
/* Shared field checks                                                       */
/* ------------------------------------------------------------------------ */

class FieldError extends Error {
  constructor(
    public field: string,
    message: string,
  ) {
    super(message);
  }
}

type Body = Record<string, unknown>;

function text(body: Body, field: string, label: string, opts: { max: number; required?: boolean; min?: number }): string {
  const raw = body[field];
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) {
    if (opts.required) throw new FieldError(field, `Enter ${label}.`);
    return '';
  }
  if (opts.min && value.length < opts.min) throw new FieldError(field, `Enter ${label}.`);
  if (value.length > opts.max) throw new FieldError(field, `Keep ${label} under ${opts.max} characters.`);
  return value;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function email(body: Body, field: string): string {
  const value = text(body, field, 'your work email', { max: 200, required: true }).toLowerCase();
  if (!EMAIL.test(value)) throw new FieldError(field, 'Enter a valid email address.');
  return value;
}

function choice<T extends readonly string[]>(body: Body, field: string, options: T, label: string): T[number] {
  const raw = body[field];
  if (typeof raw !== 'string' || !(options as readonly string[]).includes(raw)) {
    throw new FieldError(field, `Choose ${label}.`);
  }
  return raw as T[number];
}

function choices<T extends readonly string[]>(
  body: Body,
  field: string,
  options: T,
  label: string,
  required: boolean,
): Array<T[number]> {
  const raw = body[field];
  const list = Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string') : [];
  const picked = (options as readonly string[]).filter((option) => list.includes(option)) as Array<T[number]>;
  if (required && picked.length === 0) throw new FieldError(field, `Choose ${label}.`);
  return picked;
}

/** Accepts "acme.com" or a full URL. Returns a normalized https URL. */
export function normalizeWebsite(value: string): string | null {
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(candidate);
    if (!url.hostname.includes('.') || url.hostname.length < 4) return null;
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

function phone(body: Body, field: string): string {
  const value = text(body, field, 'your phone number', { max: 40 });
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) throw new FieldError(field, 'Enter a valid phone number, or leave it blank.');
  return value;
}

function count(body: Body, field: string, label: string): number | 'Unknown' | null {
  const unknown = body[`${field}Unknown`] === true;
  if (unknown) return 'Unknown';
  const raw = body[field];
  if (raw === '' || raw == null) return null;
  const value = typeof raw === 'number' ? raw : Number(String(raw).replace(/,/g, '').trim());
  if (!Number.isFinite(value) || value < 0 || value > 1_000_000 || !Number.isInteger(value)) {
    throw new FieldError(field, `Enter ${label} as a whole number, or mark it unknown.`);
  }
  return value;
}

/**
 * Runs a parser that checks every field. `check` records a field's problem and
 * lets the parse carry on, so the visitor sees all of them at once.
 */
function run<T>(body: unknown, parse: (body: Body, check: <V>(read: () => V) => V) => T): { ok: true; value: T } | FormError {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid request.' };
  const record = body as Body;
  if (typeof record[HONEYPOT_FIELD] === 'string' && record[HONEYPOT_FIELD].trim()) {
    return { ok: false, error: 'honeypot' };
  }
  const fields: Record<string, string> = {};
  const check = <V,>(read: () => V): V => {
    try {
      return read();
    } catch (error) {
      if (!(error instanceof FieldError)) throw error;
      if (!fields[error.field]) fields[error.field] = error.message;
      return undefined as V;
    }
  };
  try {
    const value = parse(record, check);
    const [first] = Object.entries(fields);
    if (first) return { ok: false, error: first[1], field: first[0], fields };
    return { ok: true, value };
  } catch {
    return { ok: false, error: 'Check the form and try again.' };
  }
}

/* ------------------------------------------------------------------------ */
/* 1. Diagnostic request                                                     */
/* ------------------------------------------------------------------------ */

export type DiagnosticRequest = {
  fullName: string;
  email: string;
  company: string;
  website: string | null;
  position: (typeof POSITIONS)[number];
  phone: string;
  businessType: BusinessType;
  dealValue: (typeof DEAL_VALUES)[number];
  monthlyOpportunities: (typeof MONTHLY_OPPORTUNITIES)[number];
  constraints: Array<(typeof CONSTRAINTS)[number]>;
  crm: (typeof CRMS)[number];
  timeline: (typeof TIMELINES)[number];
  privacyConsent: true;
  marketingConsent: boolean;
};

export function parseDiagnosticRequest(body: unknown): { ok: true; value: DiagnosticRequest } | FormError {
  return run(body, (b, check) => {
    // Checked in the order the form shows them, so the first error is the first field.
    const fullName = check(() => text(b, 'fullName', 'your full name', { max: 120, required: true, min: 2 }));
    const address = check(() => email(b, 'email'));
    const company = check(() => text(b, 'company', 'your company name', { max: 160, required: true }));
    const website =
      b.noWebsite === true
        ? null
        : check(() => {
            const raw = text(b, 'website', 'your company website', { max: 300, required: true });
            const normalized = normalizeWebsite(raw);
            if (!normalized) throw new FieldError('website', 'Enter a valid website, or check “No website yet”.');
            return normalized;
          });
    const value = {
      fullName,
      email: address,
      company,
      website,
      position: check(() => choice(b, 'position', POSITIONS, 'your position')),
      phone: check(() => phone(b, 'phone')),
      businessType: check(() => choice(b, 'businessType', BUSINESS_TYPES, 'what best describes your business')),
      dealValue: check(() => choice(b, 'dealValue', DEAL_VALUES, 'a typical engagement value')),
      monthlyOpportunities: check(() => choice(b, 'monthlyOpportunities', MONTHLY_OPPORTUNITIES, 'your monthly opportunity volume')),
      constraints: check(() => choices(b, 'constraints', CONSTRAINTS, 'at least one thing limiting your sales process', true)),
      crm: check(() => choice(b, 'crm', CRMS, 'your current CRM or system')),
      timeline: check(() => choice(b, 'timeline', TIMELINES, 'a timeline')),
      privacyConsent: true as const,
      marketingConsent: b.marketingConsent === true,
    };
    check(() => {
      if (b.privacyConsent !== true) {
        throw new FieldError('privacyConsent', 'Please acknowledge how we use your information so we can respond.');
      }
    });
    return value;
  });
}

export function diagnosticSummary(request: DiagnosticRequest, inquiryId: string): Array<[string, string]> {
  return [
    ['Inquiry', `Sales Operations Diagnostic · ${inquiryId}`],
    ['Name', request.fullName],
    ['Email', request.email],
    ['Company', request.company],
    ['Website', request.website ?? 'No website'],
    ['Position', request.position],
    ['Phone', request.phone || 'Not given'],
    ['Business', request.businessType],
    ['Typical engagement value', request.dealValue],
    ['New opportunities per month', request.monthlyOpportunities],
    ['What is limiting sales', request.constraints.join('; ')],
    ['Current CRM / system', request.crm],
    ['Timeline', request.timeline],
    ['Privacy acknowledgement', 'Yes'],
    ['Marketing updates', request.marketingConsent ? 'Opted in' : 'Not opted in'],
  ];
}

/* ------------------------------------------------------------------------ */
/* 2. Pre-discovery questionnaire                                            */
/* ------------------------------------------------------------------------ */

export const DISCOVERY_FOLLOW_UPS: Record<Exclude<BusinessTrack, 'general'>, Array<{ field: string; label: string }>> = {
  b2b: [
    { field: 'proposalTracking', label: 'How are proposals tracked?' },
    { field: 'postDiscoveryOwner', label: 'Who handles follow-up after discovery?' },
    { field: 'renewals', label: 'Are renewals or additional client engagements part of the business model?' },
  ],
  local: [
    { field: 'estimateBooking', label: 'How are consultations or estimates booked?' },
    { field: 'estimateFollowUp', label: 'Who follows up on estimates that haven’t been accepted?' },
    { field: 'jobHandoff', label: 'How are booked jobs handed to the service team?' },
  ],
};

export type DiscoveryAnswers = {
  inquiryId: string | null;
  email: string;
  company: string;
  businessType: BusinessType;
  primaryServices: string;
  mainOffer: string;
  averageDealValue: string;
  salesCycle: (typeof SALES_CYCLES)[number];
  sources: Array<(typeof SOURCES)[number]>;
  newOpportunityProcess: string;
  qualificationOwner: string;
  pipelineManagement: string;
  stalledProspects: string;
  qualifiedLast30: number | 'Unknown' | null;
  progressedLast30: number | 'Unknown' | null;
  customersLast30: number | 'Unknown' | null;
  biggestLoss: string;
  tools: string;
  disconnected: string;
  approver: string;
  successLooksLike: string;
  followUps: Array<{ label: string; answer: string }>;
};

const LONG = { max: 4000, required: true };

export function parseDiscovery(body: unknown): { ok: true; value: DiscoveryAnswers } | FormError {
  return run(body, (b, check) => {
    const rawId = typeof b.inquiryId === 'string' ? b.inquiryId.trim() : '';
    const inquiryId = /^[a-zA-Z0-9-]{8,64}$/.test(rawId) ? rawId : null;
    const address = check(() => email(b, 'email'));
    const company = check(() => text(b, 'company', 'your company name', { max: 160, required: true }));
    const businessType = check(() => choice(b, 'businessType', BUSINESS_TYPES, 'what best describes your business'));
    const track = trackFor(businessType);
    const long = (field: string, label: string) => check(() => text(b, field, label, LONG));
    return {
      inquiryId,
      email: address,
      company,
      businessType,
      primaryServices: long('primaryServices', 'your primary services'),
      mainOffer: long('mainOffer', 'your main offer or service package'),
      averageDealValue: check(() => text(b, 'averageDealValue', 'an approximate deal value or range', { max: 120, required: true })),
      salesCycle: check(() => choice(b, 'salesCycle', SALES_CYCLES, 'your typical sales cycle')),
      sources: check(() => choices(b, 'sources', SOURCES, 'where new opportunities come from', true)),
      newOpportunityProcess: long('newOpportunityProcess', 'what happens when a new opportunity arrives'),
      qualificationOwner: long('qualificationOwner', 'who qualifies and follows up'),
      pipelineManagement: long('pipelineManagement', 'how you manage your pipeline'),
      stalledProspects: long('stalledProspects', 'what happens when a prospect goes quiet'),
      qualifiedLast30: check(() => count(b, 'qualifiedLast30', 'qualified opportunities')),
      progressedLast30: check(() => count(b, 'progressedLast30', 'opportunities that progressed')),
      customersLast30: check(() => count(b, 'customersLast30', 'new paying customers')),
      biggestLoss: long('biggestLoss', 'where opportunities are being lost'),
      tools: long('tools', 'the tools in your sales process'),
      disconnected: long('disconnected', 'what feels disconnected'),
      approver: long('approver', 'who would approve changes'),
      successLooksLike: long('successLooksLike', 'what a successful implementation would improve'),
      // Asked last on the form, so checked last.
      followUps:
        track === 'general'
          ? []
          : DISCOVERY_FOLLOW_UPS[track].map(({ field, label }) => ({
              label,
              answer: check(() => text(b, field, 'an answer', LONG)),
            })),
    };
  });
}

function shown(value: number | 'Unknown' | null): string {
  return value == null ? 'Not given' : String(value);
}

export function discoverySummary(answers: DiscoveryAnswers): Array<[string, string]> {
  return [
    ['Inquiry', answers.inquiryId ? `Sales Operations Diagnostic · ${answers.inquiryId}` : 'Not linked'],
    ['Email', answers.email],
    ['Company', answers.company],
    ['Business', answers.businessType],
    ['Primary services', answers.primaryServices],
    ['Main offer', answers.mainOffer],
    ['Average deal value', answers.averageDealValue],
    ['Sales cycle', answers.salesCycle],
    ['Opportunity sources', answers.sources.join('; ')],
    ['When a new opportunity arrives', answers.newOpportunityProcess],
    ['Who qualifies and follows up', answers.qualificationOwner],
    ['Pipeline management', answers.pipelineManagement],
    ['When prospects go quiet', answers.stalledProspects],
    ['Qualified opportunities, last 30 days', shown(answers.qualifiedLast30)],
    ['Progressed to consultation / estimate', shown(answers.progressedLast30)],
    ['Became paying customers', shown(answers.customersLast30)],
    ['Where opportunities are lost', answers.biggestLoss],
    ['Tools involved', answers.tools],
    ['Disconnected systems', answers.disconnected],
    ['Who approves changes', answers.approver],
    ['What success should improve', answers.successLooksLike],
    ...answers.followUps.map(({ label, answer }): [string, string] => [label, answer]),
  ];
}

export function summaryText(title: string, rows: Array<[string, string]>): string {
  return [title, '', ...rows.map(([label, value]) => `${label}: ${value}`)].join('\n');
}

/* ------------------------------------------------------------------------ */
/* 3. Podcast 1-on-1 request (divineacquisition.io/biv/pod)                  */
/* ------------------------------------------------------------------------ */

/**
 * For listeners who want a 1-on-1 call. One form that asks everything a
 * discovery call needs: who they are, why they reached out, the business, how
 * sales run today, and what they want changed. Then they choose a time.
 */
export type PodcastRequest = {
  fullName: string;
  email: string;
  phone: string;
  company: string;
  website: string | null;
  position: (typeof POSITIONS)[number];
  episode: string;
  whyNow: string;
  businessType: BusinessType;
  primaryServices: string;
  dealValue: (typeof DEAL_VALUES)[number];
  monthlyOpportunities: (typeof MONTHLY_OPPORTUNITIES)[number];
  salesCycle: (typeof SALES_CYCLES)[number];
  sources: Array<(typeof SOURCES)[number]>;
  newOpportunityProcess: string;
  qualificationOwner: string;
  crm: (typeof CRMS)[number];
  tools: string;
  constraints: Array<(typeof CONSTRAINTS)[number]>;
  biggestLoss: string;
  successLooksLike: string;
  timeline: (typeof TIMELINES)[number];
  approver: string;
  privacyConsent: true;
  marketingConsent: boolean;
};

export function parsePodcastRequest(body: unknown): { ok: true; value: PodcastRequest } | FormError {
  return run(body, (b, check) => {
    const long = (field: string, label: string) => check(() => text(b, field, label, LONG));
    // Checked in the order the form shows them, so the first error is the first field.
    const fullName = check(() => text(b, 'fullName', 'your full name', { max: 120, required: true, min: 2 }));
    const address = check(() => email(b, 'email'));
    const phoneNumber = check(() => {
      const value = phone(b, 'phone');
      if (!value) throw new FieldError('phone', 'Enter the best number to reach you.');
      return value;
    });
    const company = check(() => text(b, 'company', 'your company name', { max: 160, required: true }));
    const website =
      b.noWebsite === true
        ? null
        : check(() => {
            const raw = text(b, 'website', 'your company website', { max: 300, required: true });
            const normalized = normalizeWebsite(raw);
            if (!normalized) throw new FieldError('website', 'Enter a valid website, or check “No website yet”.');
            return normalized;
          });
    const value = {
      fullName,
      email: address,
      phone: phoneNumber,
      company,
      website,
      position: check(() => choice(b, 'position', POSITIONS, 'your position')),
      episode: check(() => text(b, 'episode', 'the episode', { max: 200 })),
      whyNow: long('whyNow', 'what made you want to talk'),
      businessType: check(() => choice(b, 'businessType', BUSINESS_TYPES, 'what best describes your business')),
      primaryServices: long('primaryServices', 'what you sell and who you sell to'),
      dealValue: check(() => choice(b, 'dealValue', DEAL_VALUES, 'a typical engagement value')),
      monthlyOpportunities: check(() => choice(b, 'monthlyOpportunities', MONTHLY_OPPORTUNITIES, 'your monthly opportunity volume')),
      salesCycle: check(() => choice(b, 'salesCycle', SALES_CYCLES, 'your typical sales cycle')),
      sources: check(() => choices(b, 'sources', SOURCES, 'where new opportunities come from', true)),
      newOpportunityProcess: long('newOpportunityProcess', 'what happens when a new opportunity comes in'),
      qualificationOwner: long('qualificationOwner', 'who handles sales and follow-up'),
      crm: check(() => choice(b, 'crm', CRMS, 'your current CRM or system')),
      tools: check(() => text(b, 'tools', 'the other tools you use', { max: 4000 })),
      constraints: check(() => choices(b, 'constraints', CONSTRAINTS, 'at least one thing limiting your sales process', true)),
      biggestLoss: long('biggestLoss', 'where you lose opportunities'),
      successLooksLike: long('successLooksLike', 'what you want to be different'),
      timeline: check(() => choice(b, 'timeline', TIMELINES, 'a timeline')),
      approver: long('approver', 'who else is part of the decision'),
      privacyConsent: true as const,
      marketingConsent: b.marketingConsent === true,
    };
    check(() => {
      if (b.privacyConsent !== true) {
        throw new FieldError('privacyConsent', 'Please acknowledge how we use your information so we can respond.');
      }
    });
    return value;
  });
}

export function podcastSummary(request: PodcastRequest, inquiryId: string): Array<[string, string]> {
  return [
    ['Inquiry', `Podcast 1-on-1 · ${inquiryId}`],
    ['Name', request.fullName],
    ['Email', request.email],
    ['Phone', request.phone],
    ['Company', request.company],
    ['Website', request.website ?? 'No website'],
    ['Position', request.position],
    ['Episode', request.episode || 'Not given'],
    ['Why they reached out', request.whyNow],
    ['Business', request.businessType],
    ['What they sell, to whom', request.primaryServices],
    ['Typical engagement value', request.dealValue],
    ['New opportunities per month', request.monthlyOpportunities],
    ['Sales cycle', request.salesCycle],
    ['Opportunity sources', request.sources.join('; ')],
    ['When a new opportunity comes in', request.newOpportunityProcess],
    ['Who handles sales and follow-up', request.qualificationOwner],
    ['CRM / system', request.crm],
    ['Other tools', request.tools || 'Not given'],
    ['What is limiting sales', request.constraints.join('; ')],
    ['Where opportunities are lost', request.biggestLoss],
    ['What they want to be different', request.successLooksLike],
    ['Timeline', request.timeline],
    ['Who else decides', request.approver],
    ['Privacy acknowledgement', 'Yes'],
    ['Marketing updates', request.marketingConsent ? 'Opted in' : 'Not opted in'],
  ];
}
