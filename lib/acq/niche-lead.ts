import { acqPublicPath } from './config';
import {
  ROOFING,
  spendOptionByLabel,
  spendQualifies,
  type NicheContent,
} from './niche-content';
import {
  headlineVariantFromUtm,
  isHeadlineVariant,
  sanitizeNicheVisit,
  withNicheTracking,
  type HeadlineVariant,
  type NicheVisit,
} from './niche-tracking';
import {
  APP_COMPLETE_TAG,
  QualificationError,
  splitName,
  type QualificationInput,
  type QualificationPayload,
} from './qualify';

export type { HeadlineVariant, NicheVisit };

/** Custom fields the roofing lead can fill once they exist on the GHL location. */
export const GHL_FIELDS_TO_CREATE = [
  { key: 'niche', name: 'DA - Niche', aliases: ['DA - Niche', 'Niche'] },
  { key: 'spendBand', name: 'DA - Spend Band', aliases: ['DA - Spend Band', 'Spend Band'] },
  { key: 'qualified', name: 'DA - Qualified', aliases: ['DA - Qualified'] },
  {
    key: 'headlineVariant',
    name: 'DA - Headline Variant',
    aliases: ['DA - Headline Variant', 'Headline Variant'],
  },
  { key: 'utmSource', name: 'DA - UTM Source', aliases: ['DA - UTM Source', 'UTM Source', 'utm_source'] },
  { key: 'utmMedium', name: 'DA - UTM Medium', aliases: ['DA - UTM Medium', 'UTM Medium', 'utm_medium'] },
  {
    key: 'utmCampaign',
    name: 'DA - UTM Campaign',
    aliases: ['DA - UTM Campaign', 'UTM Campaign', 'utm_campaign'],
  },
  { key: 'utmTerm', name: 'DA - UTM Term', aliases: ['DA - UTM Term', 'UTM Term', 'utm_term'] },
  {
    key: 'utmContent',
    name: 'DA - UTM Content',
    aliases: ['DA - UTM Content', 'UTM Content', 'utm_content'],
  },
  { key: 'placement', name: 'DA - Placement', aliases: ['DA - Placement', 'Placement', 'placement'] },
  {
    key: 'campaignId',
    name: 'DA - Campaign ID',
    aliases: ['DA - Campaign ID', 'Campaign ID', 'campaign_id'],
  },
  { key: 'adsetId', name: 'DA - Ad Set ID', aliases: ['DA - Ad Set ID', 'Ad Set ID', 'adset_id'] },
  { key: 'adId', name: 'DA - Ad ID', aliases: ['DA - Ad ID', 'Ad ID', 'ad_id'] },
] as const;

export type NicheGhlFieldKey = (typeof GHL_FIELDS_TO_CREATE)[number]['key'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function publishedNiche(id: string | undefined): NicheContent | null {
  if (id === ROOFING.id && ROOFING.published) return ROOFING;
  return null;
}

export function nichePixelEvent(qualified: boolean): 'Lead' | 'UnqualifiedLead' {
  return qualified ? 'Lead' : 'UnqualifiedLead';
}

export function storedAttribution(payload: Pick<QualificationPayload, 'tracking' | 'attribution'>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(payload.tracking)) {
    if (value) out[key] = value;
  }
  for (const [key, value] of Object.entries(payload.attribution ?? {})) {
    if (value) out[key] = value;
  }
  return out;
}

export function nicheGhlValues(
  payload: QualificationPayload,
): Partial<Record<NicheGhlFieldKey, string>> {
  if (!payload.niche) return {};
  const visit = storedAttribution(payload);
  const values: Partial<Record<NicheGhlFieldKey, string>> = {
    niche: payload.niche,
    spendBand: payload.spendBand || undefined,
    qualified: payload.nicheQualified == null ? undefined : payload.nicheQualified ? 'yes' : 'no',
    headlineVariant: payload.headlineVariant || undefined,
    utmSource: visit.utm_source,
    utmMedium: visit.utm_medium,
    utmCampaign: visit.utm_campaign,
    utmTerm: visit.utm_term,
    utmContent: visit.utm_content,
    placement: visit.placement,
    campaignId: visit.campaign_id,
    adsetId: visit.adset_id,
    adId: visit.ad_id,
  };
  return values;
}

function digits(value: string): number {
  return value.match(/\d/g)?.length ?? 0;
}

function asVariant(value: string | undefined, utmContent: string | undefined): HeadlineVariant {
  if (isHeadlineVariant(value)) return value;
  return headlineVariantFromUtm(utmContent);
}

export function parseRoofingLead(input: QualificationInput): QualificationPayload {
  const content = ROOFING;
  const fullName = (input.fullName ?? '').trim();
  if (fullName.length < 2) {
    throw new QualificationError('Enter your first name.', 'fullName');
  }
  if (fullName.length > 80) {
    throw new QualificationError('Keep your first name under 80 characters.', 'fullName');
  }

  const email = (input.email ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    throw new QualificationError('Enter a valid email.', 'email');
  }

  const phone = (input.phone ?? '').trim();
  if (digits(phone) < 10) {
    throw new QualificationError('Enter a valid mobile phone.', 'phone');
  }

  const companyName = (input.companyName ?? '').trim();
  if (companyName.length < 2) {
    throw new QualificationError('Enter your company name.', 'companyName');
  }
  if (companyName.length > 200) {
    throw new QualificationError('Keep the company name under 200 characters.', 'companyName');
  }

  const option = spendOptionByLabel(content, input.spendBand ?? '');
  if (!option) {
    throw new QualificationError('Select about how much you spend on paid leads.', 'spendBand');
  }

  if (!input.smsConsent) {
    throw new QualificationError('Agree to calls and texts to continue.', 'smsConsent');
  }
  if (!input.emailConsent) {
    throw new QualificationError('Agree to emails to continue.', 'emailConsent');
  }

  const visit = sanitizeNicheVisit(input.tracking);
  const qualified = spendQualifies(option, content.qualificationCutoff);
  const headlineVariant = asVariant(input.headlineVariant, visit.utm_content);
  const { firstName, lastName } = splitName(fullName);

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

  const attribution: Record<string, string> = {
    niche: content.id,
    spend_band: option.label,
    qualified: qualified ? 'yes' : 'no',
    headline_variant: headlineVariant,
  };
  if (visit.placement) attribution.placement = visit.placement;
  if (visit.campaign_id) attribution.campaign_id = visit.campaign_id;
  if (visit.adset_id) attribution.adset_id = visit.adset_id;
  if (visit.ad_id) attribution.ad_id = visit.ad_id;

  return {
    fullName,
    firstName,
    lastName,
    email,
    phone,
    companyName,
    coachingNiche: content.offerLabel,
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
    source: 'Roofing Lead Leak Audit',
    tags: [
      APP_COMPLETE_TAG,
      `niche-${content.id}`,
      option.tag,
      qualified ? 'qualified-yes' : 'qualified-no',
      `headline-${headlineVariant}`,
    ],
    tracking,
    niche: content.id,
    spendBand: option.label,
    nicheQualified: qualified,
    headlineVariant,
    attribution,
  };
}

export function roofingNotYetPath(host?: string): string {
  return acqPublicPath('/roofing/not-yet', host);
}

export function roofingVisitorPath(
  payload: QualificationPayload,
  host: string | undefined,
  scheduleToken: string,
  schedulePath: string,
  thankYouPath: string,
): string {
  const tracking = storedAttribution(payload);
  if (payload.nicheQualified) {
    return withNicheTracking(scheduleToken ? schedulePath : thankYouPath, tracking);
  }
  return withNicheTracking(roofingNotYetPath(host), tracking);
}
