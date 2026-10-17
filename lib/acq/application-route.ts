import { QUALIFICATION_TAGS, SOURCE_TAGS, TAGS } from '@/lib/ghl/tags';
import type { LeadStage } from './stages';
import {
  AD_SPEND_OPTIONS,
  APPLY_QUESTIONS,
  CALL_TAKER_OPTIONS,
  OFFER_PRICE_OPTIONS,
  PROBLEM_OPTIONS,
  type AdSpendAnswer,
  type ApplyAnswers,
  type ApplyScreen,
  type CallTakerAnswer,
  type OfferPriceAnswer,
  type ProblemAnswer,
} from './application-copy';

export type ApplyPriority = 'A' | 'B';

export type ApplyRoute = {
  screen: ApplyScreen;
  priority: ApplyPriority | null;
  stage: LeadStage;
  tags: string[];
};

const COMPLETE = ['application - complete', 'da-app-complete'] as const;

export function routeApplication(answers: ApplyAnswers): ApplyRoute | null {
  const adSpend = answers.adSpend;
  const offerPrice = answers.offerPrice;
  const callTaker = answers.callTaker;
  const problem = answers.problem;
  if (!adSpend || !offerPrice || !callTaker || !problem) return null;
  if (!isOption(AD_SPEND_OPTIONS, adSpend)) return null;
  if (!isOption(OFFER_PRICE_OPTIONS, offerPrice)) return null;
  if (!isOption(CALL_TAKER_OPTIONS, callTaker)) return null;
  if (!isOption(PROBLEM_OPTIONS, problem)) return null;

  if (adSpend === 'Not running ads' || offerPrice === 'Under $3K' || callTaker === 'Nobody yet') {
    return {
      screen: 'closed',
      priority: null,
      stage: 'Recycled',
      tags: [...COMPLETE, 'da-not-a-fit', 'trigger-da-nurture'],
    };
  }
  if (adSpend === 'Under $5K') {
    return {
      screen: 'later',
      priority: null,
      stage: 'Recycled',
      tags: [...COMPLETE, 'da-not-yet-spend', 'trigger-da-nurture'],
    };
  }

  const priority: ApplyPriority =
    adSpend === '$10K+' && (offerPrice === '$6K to $10K' || offerPrice === '$10K+') ? 'A' : 'B';
  return {
    screen: 'calendar',
    priority,
    stage: 'Qualified - Not Booked',
    tags: [
      ...COMPLETE,
      QUALIFICATION_TAGS.Qualified,
      'da-qualified',
      priority === 'A' ? 'da-priority-a' : 'da-priority-b',
    ],
  };
}

export function stepOneTags(smsConsent: boolean): string[] {
  return smsConsent
    ? [SOURCE_TAGS.foundingInstall, TAGS.smsConsent]
    : [SOURCE_TAGS.foundingInstall];
}

function isOption<T extends string>(options: readonly T[], value: string): value is T {
  return (options as readonly string[]).includes(value);
}

export function questionKey(question: number): (typeof APPLY_QUESTIONS)[number]['key'] | null {
  return APPLY_QUESTIONS[question - 1]?.key ?? null;
}

export type StoredAnswers = {
  adSpend?: AdSpendAnswer;
  offerPrice?: OfferPriceAnswer;
  callTaker?: CallTakerAnswer;
  problem?: ProblemAnswer;
};
