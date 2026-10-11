import { ACADEMY_COMMS } from './config';
import { fillMerge, type MergeFields } from './fields';

function line(template: string, fields: MergeFields): string {
  const filled = fillMerge(template, { supportEmail: ACADEMY_COMMS.supportEmail, numberOfDays: ACADEMY_COMMS.replyDays, ...fields });
  return filled.text;
}

export const inApp = {
  signIn: {
    headline: 'Sign in to the Academy',
    tagline: 'Devotion. Value. Exclusivity.',
    button: 'Sign in',
    forgot: 'Forgot your password?',
    wrongLogin: 'That email or password does not match. Try again or reset your password.',
    noAccess: () =>
      line('This account does not have Academy access. If you think that is a mistake, contact [Support email].', {}),
  },
  agreement: {
    headline: 'One step before you start',
    body: (managerName?: string | null) =>
      line(
        'Your agreement is not signed yet. Your Academy access opens the moment it is. Check your email for the signing request, or contact [Manager name].',
        { managerName: managerName?.trim() || 'your manager' },
      ),
    button: 'Resend my agreement email',
  },
  dashboard: {
    greeting: (firstName?: string | null) => (firstName?.trim() ? `${firstName.trim()}, here is where you are.` : 'Here is where you are.'),
    next: (step?: string | null, minutes?: number | null) => {
      if (!step) return '';
      return minutes ? `Next: ${step}. About ${minutes} minutes.` : `Next: ${step}.`;
    },
    progress: (moduleNumber: number, total: number, percent: number) => `Module ${moduleNumber} of ${total}. ${percent} percent complete.`,
    stalled: (step?: string | null) =>
      step ? `It has been a couple of days. Pick up where you left off: ${step}.` : 'It has been a couple of days. Pick up where you left off.',
    empty: () =>
      line('You are not enrolled in a program yet. Your manager will set that up. If you have waited more than a day, contact [Support email].', {}),
  },
  modules: {
    locked: (previous?: string | null) =>
      previous ? `Complete ${previous} to unlock this module.` : 'Complete the previous module to unlock this module.',
    unpublished: 'Not yet published. Content is coming.',
    available: 'Ready to start.',
    inProgress: 'Continue.',
    quizOpen: 'Lessons complete. Take the quiz when you are ready.',
    extra: (requirement?: string | null) =>
      `Quiz passed. One more requirement is pending: ${requirement?.trim() || 'an extra requirement'}.`,
    complete: 'Complete.',
    onHold: 'On review with your manager.',
  },
  lesson: {
    resume: (time: string) => `Pick up where you left off at ${time}?`,
    watch: (percent: number) => `Watch at least ${percent} percent to mark complete.`,
    openDocument: 'Open the companion document to continue.',
    readToEnd: 'Read to the end of the page to continue.',
    markComplete: 'Mark complete',
    linkExpired: 'This link expired for your security. Open the lesson again to get a fresh one.',
    outOfOrder: (previous?: string | null) => (previous ? `Finish ${previous} first.` : 'Finish the previous lesson first.'),
  },
  quiz: {
    start: (name: string, questions: number, needed: string, used: number, max: number) =>
      `${name}. ${questions} questions. You need ${needed} to pass. Attempts used: ${used} of ${max}.`,
    lockout: (time: string, lessons: string) => `Next attempt opens at ${time}. Before then, reopen: ${lessons}.`,
    ready: 'You can retry now.',
    progress: (current: number, total: number) => `Question ${current} of ${total}.`,
    submitConfirm: 'Submit your answers? You cannot change them afterward.',
    abandoned: 'Your last attempt was left open and has been scored as submitted.',
    fail: (score: number, total: number, needed: string, minutes: number, left: number) =>
      `Not yet. You scored ${score} of ${total}. You need ${needed} to pass. Review the topics below, reopen the lesson, and retry in ${minutes} minutes. You have ${left} attempts left.`,
    topic: (concept: string) => `Review these topics: ${concept}.`,
    attempt3: (managerName?: string | null) =>
      `This is your third attempt. Slow down, reread the lessons, and consider asking ${managerName?.trim() || 'your manager'} for help before the next try.`,
    attempt4: "You have one attempt left on this quiz. If it isn't passed, your program goes on hold for a review with your manager. Take your time, reopen the lesson, and review each missed topic first.",
    pass: (score: number, total: number) => `Passed. You scored ${score} of ${total}. Your full review is unlocked.`,
    finalPass: 'You passed the Final Quiz. Here is your score by module.',
    lockedAfterPass: 'You already passed this quiz. You can review your answers anytime.',
    flagged:
      'You used every attempt. You are flagged for review, and your manager has been notified. Your program stays on review until that is finished.',
  },
  simulation: {
    start: "This is a practice conversation with an AI playing a fictional person. Everything in it is made up. Your timer starts when the lead's first message arrives.",
    finish: 'Finish and submit',
    log: 'Complete your interaction log before your result is graded.',
    grading: 'Scoring your conversation. This takes about a minute.',
    pass: (total: number) => `Passed. Total ${total} out of 100. Your feedback is below.`,
    failScore: (total: number, needed: number) => `Not yet. Total ${total} out of 100. You need ${needed}.`,
    failCompliance: 'Not yet. Your total passed, but a compliance item was below the minimum. See the feedback for what to change.',
    manual: 'A reviewer is scoring your submission by hand. You do not need to resubmit.',
    dailyLimit: "You reached today's practice limit. Come back tomorrow.",
    reveal: 'Here is who the lead really was and what they were worried about.',
  },
  reflection: {
    underCount: (minimum: number, current: number) => `Write at least ${minimum} words before submitting. You have ${current}.`,
    passed: 'Passed. See your feedback on each criterion.',
    notYet: 'Not yet. See your feedback on each criterion.',
  },
  practical: {
    pending: 'Waiting for review.',
    approved: 'Approved.',
    needsWork: 'Needs work. See the comment and resubmit this item.',
    complete: 'Practical complete.',
  },
  hold: {
    headline: 'Your progress is on review',
    body: (fields: MergeFields) => {
      const manager = fields.managerName?.trim() || 'your manager';
      const days = fields.numberOfDays ?? ACADEMY_COMMS.replyDays;
      const check = `${manager} is reviewing your progress and will contact you within ${days} business days. This is a check that the material is landing. It is not a judgment about you.`;
      if (fields.quizName && fields.attemptsMax !== undefined && fields.attemptsMax !== '') {
        return `You used all ${fields.attemptsMax} attempts on ${fields.quizName}. ${check}`;
      }
      return check;
    },
    reset: (attempts: number, managerName?: string | null) =>
      `Your review is complete. You have ${attempts} more attempts. Read your plan from ${managerName?.trim() || 'your manager'} and acknowledge it to unlock your retry.`,
    extend: (retestDate: string) => `Your re-test opens on ${retestDate}. Use the time to follow your plan.`,
    acknowledge: 'I have read my plan',
    released: () => line('Your access to the Academy has ended. Contact [Support email] with any questions.', {}),
  },
  certification: {
    pending: (supervisor?: string | null) =>
      `Your capstone is passed. A supervisor sign-off is the last step. ${supervisor?.trim() || 'Your supervisor'} will schedule it with you.`,
    notYet: (retestDate: string) => `Your supervisor has a plan for you. Re-review on ${retestDate}.`,
    certificate: (fields: MergeFields) => line('[Full name]. [Level]. Granted [Date]. Renews [Renewal date].', fields),
    verifyToggle: 'Anyone with your verification link can confirm your certification. Turn it off anytime.',
    revoked: 'This certification has been revoked.',
    expired: (renewalDate: string) => `This certification expired on ${renewalDate}. Renew it to return to active status.`,
  },
  placement: {
    shadow: (vertical: string) => `You are shadow only on this account until you finish the ${vertical} pack.`,
    cleared: (vertical: string) => `You are cleared for live work in ${vertical}.`,
  },
  system: {
    saved: 'Saved.',
    sessionExpired: 'You were signed out for your security. Sign in again to continue.',
    generic: () => line('Something went wrong on our side. Your progress is safe. Try again in a minute, or contact [Support email].', {}),
    notFound: 'That page does not exist. Go back to your dashboard.',
    maintenance: 'The Academy is briefly offline for maintenance. Your progress is safe.',
  },
};

export const IN_APP_GROUPS = [
  'signIn',
  'agreement',
  'dashboard',
  'modules',
  'lesson',
  'quiz',
  'simulation',
  'reflection',
  'practical',
  'hold',
  'certification',
  'placement',
  'system',
] as const;
