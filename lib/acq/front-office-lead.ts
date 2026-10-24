import { acqPublicPath } from './config';
import {
  frontOfficeBusiness,
  revenueQualifies,
  SHARED_FRONT_OFFICE,
  type FrontOfficeChoice,
} from './front-office-content';
import { readFrontOfficeTouch } from './front-office-touch';
import {
  AI_FRONT_OFFICE_KEY,
  AI_FRONT_OFFICE_OFFER,
  AI_FRONT_OFFICE_TAG,
  REVENUE_FIT_TAGS,
  SOURCE_TAGS,
  TAGS,
  headlineTag,
  nicheTag,
} from '@/lib/ghl/tags';
import {
  APP_COMPLETE_TAG,
  QualificationError,
  splitName,
  type QualificationInput,
  type QualificationPayload,
} from './qualify';
import {
  headlineVariantFromUtm,
  isHeadlineVariant,
  sanitizeNicheVisit,
  withNicheTracking,
  type HeadlineVariant,
} from './niche-tracking';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function digits(value: string): number {
  return value.match(/\d/g)?.length ?? 0;
}

function choiceByLabel(options: FrontOfficeChoice[], label: string): FrontOfficeChoice | undefined {
  return options.find((option) => option.label === label.trim());
}

function choiceById(options: FrontOfficeChoice[], id: string): FrontOfficeChoice | undefined {
  return options.find((option) => option.id === id.trim());
}

function asVariant(value: string | undefined, utmContent: string | undefined): HeadlineVariant {
  if (isHeadlineVariant(value)) return value;
  return headlineVariantFromUtm(utmContent);
}

export function parseFrontOfficeLead(input: QualificationInput): QualificationPayload {
  if (input.offerKey !== AI_FRONT_OFFICE_KEY) {
    throw new QualificationError('Check the form and try again.');
  }

  const fullName = (input.fullName ?? '').trim();
  if (fullName.length < 2) throw new QualificationError('Enter your first name.', 'fullName');
  if (fullName.length > 80) throw new QualificationError('Keep your first name under 80 characters.', 'fullName');

  const email = (input.email ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new QualificationError('Enter a valid email.', 'email');

  const phone = (input.phone ?? '').trim();
  if (digits(phone) < 10) throw new QualificationError('Enter a valid mobile phone.', 'phone');

  const companyName = (input.companyName ?? '').trim();
  if (companyName.length < 2) throw new QualificationError('Enter your company name.', 'companyName');
  if (companyName.length > 200) throw new QualificationError('Keep the company name under 200 characters.', 'companyName');

  const business = frontOfficeBusiness((input.businessType ?? '').trim());
  if (!business || !(input.businessType ?? '').trim()) {
    throw new QualificationError('Select the type of business you run.', 'businessType');
  }
  const businessId = (input.businessType ?? '').trim();

  const revenue = choiceByLabel(SHARED_FRONT_OFFICE.form.revenueOptions, input.monthlyRevenue ?? '');
  if (!revenue) throw new QualificationError('Select your monthly revenue.', 'monthlyRevenue');

  const weekly = choiceByLabel(business.form.leadsOptions, input.weeklyLeads ?? '');
  if (!weekly) throw new QualificationError('Select how many new leads you get a week.', 'weeklyLeads');

  const leak =
    choiceById(business.form.leakOptions, input.biggestLeak ?? '') ??
    choiceByLabel(business.form.leakOptions, input.biggestLeak ?? '');
  if (!leak) throw new QualificationError('Select where you lose the most jobs.', 'biggestLeak');

  if (!input.smsConsent) throw new QualificationError('Agree to calls and texts to continue.', 'smsConsent');
  if (!input.emailConsent) throw new QualificationError('Agree to emails to continue.', 'emailConsent');

  const visit = sanitizeNicheVisit(input.tracking);
  const qualified = revenueQualifies(revenue, business.qualificationCutoff);
  const headlineVariant = asVariant(input.headlineVariant, visit.utm_content);
  const { firstName, lastName } = splitName(fullName);
  const businessLabel =
    SHARED_FRONT_OFFICE.form.businesses.find((item) => item.id === businessId)?.label ?? businessId;

  const tracking: QualificationPayload['tracking'] = {};
  if (visit.utm_source) tracking.utm_source = visit.utm_source;
  if (visit.utm_medium) tracking.utm_medium = visit.utm_medium;
  if (visit.utm_campaign) tracking.utm_campaign = visit.utm_campaign;
  if (visit.utm_term) tracking.utm_term = visit.utm_term;
  if (visit.utm_content) tracking.utm_content = visit.utm_content;
  if (visit.fbclid) tracking.fbclid = visit.fbclid;
  if (visit.gclid) tracking.gclid = visit.gclid;
  if (visit.gbraid) tracking.gbraid = visit.gbraid;
  if (visit.wbraid) tracking.wbraid = visit.wbraid;
  if (visit.ttclid) tracking.ttclid = visit.ttclid;
  if (visit.msclkid) tracking.msclkid = visit.msclkid;

  return {
    fullName,
    firstName,
    lastName,
    email,
    phone,
    companyName,
    coachingNiche: AI_FRONT_OFFICE_OFFER,
    monthlyAdSpend: '',
    inquiriesPerMonth: null,
    followUpOwner: '',
    followUpOwnerLabel: '',
    programPrice: '',
    smsConsent: true,
    emailConsent: true,
    leadSource: 'Paid Ad',
    entryPoint: 'Audit Booking',
    stage: 'Step 1 Captured',
    source: AI_FRONT_OFFICE_OFFER,
    tags: [
      SOURCE_TAGS.aiFrontOffice,
      APP_COMPLETE_TAG,
      TAGS.smsConsent,
      AI_FRONT_OFFICE_TAG,
      nicheTag(businessId),
      revenue.tag,
      weekly.tag,
      leak.tag,
      qualified ? REVENUE_FIT_TAGS.yes : REVENUE_FIT_TAGS.no,
      headlineTag(headlineVariant),
    ],
    tracking,
    niche: businessId,
    spendBand: '',
    nicheQualified: qualified,
    headlineVariant,
    businessLabel,
    monthlyRevenue: revenue.label,
    weeklyLeads: weekly.label,
    biggestLeak: leak.label,
    attribution: {
      niche: businessId,
      offer: AI_FRONT_OFFICE_OFFER,
      monthly_revenue: revenue.label,
      weekly_leads: weekly.label,
      biggest_leak: leak.label,
      qualified: qualified ? 'yes' : 'no',
      headline_variant: headlineVariant,
      ...(visit.placement ? { placement: visit.placement } : {}),
      ...(visit.campaign_id ? { campaign_id: visit.campaign_id } : {}),
      ...(visit.adset_id ? { adset_id: visit.adset_id } : {}),
      ...(visit.ad_id ? { ad_id: visit.ad_id } : {}),
    },
  };
}

export async function withFrontOfficeTouch(payload: QualificationPayload): Promise<QualificationPayload> {
  const touch = await readFrontOfficeTouch(payload.tracking);
  const firstCampaign = touch.firstCampaign || payload.tracking.utm_campaign || '';
  const lastCampaign = touch.lastCampaign || payload.tracking.utm_campaign || '';
  const adName = touch.adName || payload.tracking.utm_content || '';
  return {
    ...payload,
    firstCampaign,
    lastCampaign,
    adName,
    attribution: {
      ...(payload.attribution ?? {}),
      ...(firstCampaign ? { first_campaign: firstCampaign } : {}),
      ...(lastCampaign ? { last_campaign: lastCampaign } : {}),
      ...(adName ? { ad_name: adName } : {}),
    },
  };
}

export function frontOfficeNotYetPath(host?: string): string {
  return acqPublicPath('/ai/not-yet', host);
}

export function frontOfficeVisitorPath(
  payload: QualificationPayload,
  host: string | undefined,
  scheduleToken: string,
  schedulePath: string,
  thankYouPath: string,
): string {
  const tracking = { ...payload.tracking, ...(payload.attribution ?? {}) };
  const visit = sanitizeNicheVisit(tracking);
  if (payload.nicheQualified) {
    return withNicheTracking(scheduleToken ? schedulePath : thankYouPath, visit);
  }
  return withNicheTracking(frontOfficeNotYetPath(host), visit);
}
