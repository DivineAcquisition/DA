import { FACEBOOK_DISCLAIMER } from './copy';

/** Visitor-facing application copy. No routing rules live in this file. */

export const APPLY_STEP_NOTE = 'Takes about a minute.';

/**
 * Bump when the checkbox sentence changes. Stored only if the box is checked.
 * The older qualify form still uses ACQ_SMS_CONSENT_VERSION.
 */
export const APPLY_SMS_CONSENT_VERSION = 'acq-reminders-2026-10-17b';

/**
 * Pinned to the bottom of every application screen.
 *
 * TCPA / CTIA: the sender is named, texts are appointment reminders only,
 * frequency and rates are disclosed, STOP and HELP are named, and the box
 * is optional and separate from submitting.
 * CAN-SPAM: legal name, postal address, and an email unsubscribe path.
 * The Meta line is the ad-platform disclaimer. Results are not guaranteed.
 */
export const APPLY_LEGAL_FOOTER = {
  company: 'Divine Acquisition LLC, 7404 Executive Place, Lanham, MD 20706.',
  lines: [
    'Submitting this form requests a free sales audit. It is not a purchase, and it does not start a client agreement.',
    'Appointment reminder texts are sent only if you check the box. Consent is optional, is not required to apply or to buy anything, and you can withdraw it by replying STOP. Reply HELP for help. Message frequency varies. Message and data rates may apply.',
    'We may call and email you about the audit you requested. You can unsubscribe from email at any time.',
    'We use your name, email, phone, and answers to review fit and follow up. If you came from an ad, we store the campaign parameters so we know which ad brought you here.',
    FACEBOOK_DISCLAIMER,
    'Results are not typical or guaranteed.',
  ],
} as const;

export const SMS_CONSENT_WORDING =
  'Text me appointment reminders from Divine Acquisition LLC about my audit. Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for help. Consent is not required to apply.';

export const AD_SPEND_OPTIONS = ['Not running ads', 'Under $5K', '$5K to $10K', '$10K+'] as const;
export const OFFER_PRICE_OPTIONS = ['Under $3K', '$3K to $6K', '$6K to $10K', '$10K+'] as const;
export const CALL_TAKER_OPTIONS = ['Me', 'A closer', 'A setter and a closer', 'Nobody yet'] as const;
export const PROBLEM_OPTIONS = [
  "Leads don't book",
  "Booked calls don't show",
  "Calls don't close",
  "I can't tell where deals die",
  "My team can't keep up",
] as const;

export type AdSpendAnswer = (typeof AD_SPEND_OPTIONS)[number];
export type OfferPriceAnswer = (typeof OFFER_PRICE_OPTIONS)[number];
export type CallTakerAnswer = (typeof CALL_TAKER_OPTIONS)[number];
export type ProblemAnswer = (typeof PROBLEM_OPTIONS)[number];

export type ApplyAnswers = {
  adSpend?: AdSpendAnswer;
  offerPrice?: OfferPriceAnswer;
  callTaker?: CallTakerAnswer;
  problem?: ProblemAnswer;
};

export const APPLY_QUESTIONS = [
  {
    key: 'adSpend',
    prompt: 'What do you spend on ads per month?',
    options: AD_SPEND_OPTIONS,
  },
  {
    key: 'offerPrice',
    prompt: 'What does your main offer cost?',
    options: OFFER_PRICE_OPTIONS,
  },
  {
    key: 'callTaker',
    prompt: 'Who takes your sales calls?',
    options: CALL_TAKER_OPTIONS,
  },
  {
    key: 'problem',
    prompt: 'What is the biggest problem right now?',
    options: PROBLEM_OPTIONS,
  },
] as const;

export type ApplyQuestionKey = (typeof APPLY_QUESTIONS)[number]['key'];

export type ApplyScreen = 'calendar' | 'closed' | 'later';

export const APPLY_SCREENS: Record<ApplyScreen, { heading: string; line: string }> = {
  calendar: {
    heading: "You're a fit.",
    line: "Pick a time for your free audit. We'll look at your numbers and send you a written blueprint.",
  },
  closed: {
    heading: 'Thanks for applying.',
    line: "Right now the system we build isn't the right fit for where your business is, and we'd rather tell you that than take your money. We'll send you a few resources in the meantime.",
  },
  later: {
    heading: "You're close.",
    line: 'The system pays off once ad spend reaches about $5K a month. When you get there, come back and apply again.',
  },
};

export function answerOnQuestion(question: number, value: string): ApplyAnswers | null {
  const item = APPLY_QUESTIONS[question - 1];
  if (!item) return null;
  if (!(item.options as readonly string[]).includes(value)) return null;
  return { [item.key]: value } as ApplyAnswers;
}
