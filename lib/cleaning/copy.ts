import { cleaningFee, cleaningSettings, type CleaningSettings } from './settings';

const s = cleaningSettings;

export function cleaningHeadline(settings: CleaningSettings = s) {
  return {
    start: `We'll book ${settings.firstCleans} first cleans from homeowners who only talked to you, then turn them into recurring clients.`,
    dropOnPhone: '',
    end: `Ads live in ${settings.launchTime}. You pay only when a new client goes recurring.`,
  };
}

export function cleaningProofLine(settings: CleaningSettings = s) {
  return `Built by Divine Acquisition. We run our own cleaning company in the DMV and built the follow-up system that added ${settings.proofStat} for another cleaning company.`;
}

export function cleaningGateLine(settings: CleaningSettings = s) {
  return `For cleaning companies doing $15K or more a month, with teams that can take on more homes, and at least ${settings.minimumAdBudget} for ads.`;
}

export function cleaningFoundingBar(settings: CleaningSettings = s) {
  return `Founding partner spots open: no setup, no monthly fee. You only pay when a new client goes recurring. ${settings.foundingSpotsPerMarket} spots per market.`;
}

export function cleaningConsent(settings: CleaningSettings = s) {
  return `By submitting, you agree that ${settings.legalName} may contact you by call, text, or email about your request. Consent is not a condition of purchase. Message and data rates may apply. Reply STOP to opt out at any time.`;
}

export const CLEANING_CTA = 'Get My Free Lead Leak Audit';
export const CLEANING_STICKY_CTA = 'Get My Free Audit';
export const CLEANING_SUBMIT = 'Request My Free Audit';

export function cleaningFaqs(settings: CleaningSettings = s) {
  return [
    {
      q: 'Why would these leads be different?',
      a: 'Each one is asked about the home and how often they want a clean. A person on our team books the first clean with a weekly, biweekly, or monthly plan on the table. You pay only when they go recurring.',
    },
    {
      q: 'I already have a VA.',
      a: 'Keep them on your current clients. We handle new quote requests from your ads, including the ones that come in at night and on weekends.',
    },
    {
      q: 'Who pays for the ads, and who owns the account?',
      a: `You pay Meta directly, at least ${settings.minimumAdBudget}. The ad account, page, and leads stay yours. Leave with 30 days' notice and you keep them.`,
    },
    {
      q: "What's the guarantee?",
      a: `If we don't book ${settings.firstCleans} first cleans within ${settings.promiseWindow}, we keep working and your next ${settings.feeFreeClients} new recurring clients are fee-free.`,
    },
  ] as const;
}

export function cleaningComparison(settings: CleaningSettings = s) {
  const rows = [
    ['Leads are exclusive to you', 'Usually not', 'Sometimes', 'Not applicable', 'Yes'],
    ['Answers new requests within minutes', 'No', 'No', 'During their shift', 'Yes, 8 a.m. to 8 p.m.'],
    ['Sells the recurring plan on the first call', 'No', 'No', 'Sometimes', 'Yes'],
    ['Follows up after the first clean', 'No', 'Rarely', 'If they remember', 'Yes'],
    ['Wins back cancelled clients', 'No', 'Rarely', 'Rarely', 'Yes'],
    ['You own the ad account and data', 'No', 'Often not', 'Not applicable', 'Yes'],
    ['When you pay', 'Per lead, booked or not', 'Monthly retainer', 'Hourly or monthly', `${cleaningFee(settings)} per new recurring client`],
  ] as const;
  return settings.foundingPartnerOffer ? rows : rows.slice(0, -1);
}

/** Every sentence the page can show, for the banned-phrase check. */
export function cleaningVisibleCopy(settings: CleaningSettings = s): string {
  const headline = cleaningHeadline(settings);
  return [
    cleaningFoundingBar(settings),
    headline.start,
    headline.dropOnPhone,
    headline.end,
    cleaningProofLine(settings),
    settings.mysteryShopStat,
    cleaningGateLine(settings),
    CLEANING_CTA,
    cleaningConsent(settings),
    settings.callbackPromise,
    settings.proofStat,
    ...cleaningFaqs(settings).flatMap((item) => [item.q, item.a]),
    ...cleaningComparison(settings).flat(),
  ].join('\n');
}
