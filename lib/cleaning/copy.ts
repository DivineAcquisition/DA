import { cleaningFee, cleaningSettings, type CleaningSettings } from './settings';

const s = cleaningSettings;

export function cleaningHeadline(settings: CleaningSettings = s) {
  return {
    start: `We'll Book ${settings.firstCleans} First Cleans From Homeowners Who Only Talked To You, Then Turn Them Into Recurring Clients. Done For You, Ads Live In ${settings.launchTime},`,
    dropOnPhone: 'Without You Or Your VA Chasing Leads,',
    end: 'And You Only Pay When A New Client Goes Recurring.',
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
      q: 'Meta leads for cleaning are just price shoppers. Why would these be different?',
      a: 'Many are, when nobody screens them or sells the plan. Every lead here answers the home-size and frequency questions, then a real person books the first clean with the recurring plan on the table. You only pay when a client actually goes recurring.',
    },
    {
      q: 'I already have a VA. Why do I need this?',
      a: "Keep your VA. We handle the new leads from your ads and the recurring-plan conversation, and your VA keeps running your existing clients. Most VAs aren't on at 9 p.m. or on Sunday afternoon, and that's when many requests come in.",
    },
    {
      q: 'How do you know which clients were yours?',
      a: 'Every lead is tagged from the first contact, and a client counts only if they came through our ads and booked within 90 days of that first contact. Referrals and existing clients never count. You can see every record.',
    },
    {
      q: 'Does this work with my booking software?',
      a: "We book into the system you already use, either directly or through your calendar. We'll confirm on the audit.",
    },
    {
      q: 'Will texts annoy homeowners?',
      a: "Texts only go to people who asked for a quote through your ad, between 8 a.m. and 8 p.m., with a daily limit. The first message says it's an automated assistant for your company, and anyone can reply STOP.",
    },
    {
      q: 'Who owns the ad account?',
      a: "You do. It's built in your Meta account with your card. If you leave, it stays with you.",
    },
    {
      q: 'Who pays for the ads?',
      a: `You do, directly to Meta, at least ${settings.minimumAdBudget} a month. We never mark up ad spend.`,
    },
    {
      q: "What's the guarantee?",
      a: `If we don't book ${settings.firstCleans} first cleans within ${settings.promiseWindow}, we keep working and your next ${settings.feeFreeClients} new recurring clients are fee-free.`,
    },
    {
      q: 'What if my teams are full?',
      a: "Then it's not the right time, and we'll tell you on the audit. We set ad spend to match the capacity you actually have.",
    },
    {
      q: 'Do you also help with past and cancelled clients?',
      a: "Yes. Win-back follow-up for clients who pause or cancel is part of the system. On the audit we'll look at how big that list is.",
    },
    {
      q: 'How fast does this start?',
      a: `Ads go live about ${settings.launchTime} after we have access to your ad account, page, and booking system. Our team calls qualified leads from day one. Automated texting starts once carrier approval clears, which can take a few extra days.`,
    },
    {
      q: 'Can I leave?',
      a: "Yes. 30 days' notice. You keep everything. Fees still apply to new clients from our ads who go recurring within the attribution window.",
    },
    {
      q: 'Why do I get a call instead of a calendar?',
      a: 'Because a five-minute call makes sure the audit is worth your time. Malik calls you back personally.',
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
