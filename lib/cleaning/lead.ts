import { sanitizeNicheVisit, type NicheVisit } from '@/lib/acq/niche-tracking';

export const REVENUE_OPTIONS = [
  'under $15K',
  '$15K to $30K',
  '$30K to $75K',
  '$75K to $150K',
  '$150K+',
] as const;

export const RECURRING_OPTIONS = ['Under 25%', '25% to 50%', '50% to 75%', 'Over 75%'] as const;

export const ANSWERS_LEADS_OPTIONS = ['Me', 'A VA or office', 'A call service', 'No one consistently'] as const;

export const BUDGET_OPTIONS = ['Yes', 'Not yet', 'Not sure'] as const;

export type CleaningLead = {
  page: 'cleaning';
  firstName: string;
  phone: string;
  email: string;
  company: string;
  serviceArea: string;
  monthlyRevenue: (typeof REVENUE_OPTIONS)[number];
  recurringShare: (typeof RECURRING_OPTIONS)[number];
  answersLeads: (typeof ANSWERS_LEADS_OPTIONS)[number];
  adBudget: (typeof BUDGET_OPTIONS)[number];
  underRevenueFloor: boolean;
  budgetNotYet: boolean;
  tracking: NicheVisit;
};

export type CleaningLeadError = { ok: false; error: string; field?: string };
export type CleaningLeadResult = { ok: true; lead: CleaningLead } | CleaningLeadError;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

function oneOf<T extends readonly string[]>(value: string, options: T): T[number] | null {
  return options.find((option) => option === value) ?? null;
}

/** Accepts everyone who completes the form. Flags low revenue and "Not yet" on budget. */
export function parseCleaningLead(body: unknown): CleaningLeadResult {
  const source = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  if (text(source.website, 200)) {
    return { ok: false, error: 'honeypot' };
  }

  const firstName = text(source.firstName, 80);
  const phone = text(source.phone, 40);
  const email = text(source.email, 160);
  const company = text(source.company, 120);
  const serviceArea = text(source.serviceArea, 120);
  const monthlyRevenue = oneOf(text(source.monthlyRevenue, 40), REVENUE_OPTIONS);
  const recurringShare = oneOf(text(source.recurringShare, 40), RECURRING_OPTIONS);
  const answersLeads = oneOf(text(source.answersLeads, 40), ANSWERS_LEADS_OPTIONS);
  const adBudget = oneOf(text(source.adBudget, 20), BUDGET_OPTIONS);

  if (firstName.length < 2) return { ok: false, field: 'firstName', error: 'Enter your first name.' };
  if ((phone.match(/\d/g)?.length ?? 0) < 10) return { ok: false, field: 'phone', error: 'Enter a valid mobile phone.' };
  if (!EMAIL_RE.test(email)) return { ok: false, field: 'email', error: 'Enter a valid email.' };
  if (company.length < 2) return { ok: false, field: 'company', error: 'Enter your company name.' };
  if (serviceArea.length < 2) return { ok: false, field: 'serviceArea', error: 'Enter your city or county.' };
  if (!monthlyRevenue) return { ok: false, field: 'monthlyRevenue', error: 'Select your monthly revenue.' };
  if (!recurringShare) return { ok: false, field: 'recurringShare', error: 'Select how much of your revenue is recurring.' };
  if (!answersLeads) return { ok: false, field: 'answersLeads', error: 'Select who answers new leads today.' };
  if (!adBudget) return { ok: false, field: 'adBudget', error: 'Select whether you can fund the ads.' };

  return {
    ok: true,
    lead: {
      page: 'cleaning',
      firstName,
      phone,
      email,
      company,
      serviceArea,
      monthlyRevenue,
      recurringShare,
      answersLeads,
      adBudget,
      underRevenueFloor: monthlyRevenue === 'under $15K',
      budgetNotYet: adBudget === 'Not yet',
      tracking: sanitizeNicheVisit(source.tracking),
    },
  };
}

export function cleaningLeadNote(lead: CleaningLead): string {
  const flags = [
    lead.underRevenueFloor ? 'Spot: under $15K a month' : '',
    lead.budgetNotYet ? 'Spot: ad budget not yet' : '',
  ].filter(Boolean);
  const tracking = Object.entries(lead.tracking)
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');
  return [
    'Page: cleaning',
    `Company: ${lead.company}`,
    `Service area: ${lead.serviceArea}`,
    `Monthly revenue: ${lead.monthlyRevenue}`,
    `Recurring share: ${lead.recurringShare}`,
    `Who answers new leads: ${lead.answersLeads}`,
    `Ad budget answer: ${lead.adBudget}`,
    ...flags,
    tracking,
  ]
    .filter(Boolean)
    .join('\n');
}
