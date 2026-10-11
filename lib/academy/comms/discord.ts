export const DISCORD_CHANNELS = {
  enrollments: 'academy-enrollments',
  stalled: 'academy-stalled',
  holds: 'academy-holds',
  reviews: 'academy-reviews',
  certifications: 'academy-certifications',
  placement: 'academy-placement',
  daily: 'academy-daily',
} as const;

export type DiscordChannel = (typeof DISCORD_CHANNELS)[keyof typeof DISCORD_CHANNELS];

export type DiscordAlert = {
  id: string;
  channel: DiscordChannel;
  body: string;
  /** System line, counted apart from the 36 channel formats. */
  system?: boolean;
};

export const DISCORD_ALERTS: DiscordAlert[] = [
  { id: 'new_trainee', channel: DISCORD_CHANNELS.enrollments, body: 'NEW TRAINEE: [Full name] enrolled in [Program]. Manager: [Manager name]. Target: [Target date]. [Admin link]' },
  { id: 'agreement_sent', channel: DISCORD_CHANNELS.enrollments, body: 'AGREEMENT SENT: [Full name]. Awaiting signature. [Admin link]' },
  { id: 'agreement_unsigned_72h', channel: DISCORD_CHANNELS.enrollments, body: 'AGREEMENT UNSIGNED 72H: [Full name]. [Role ping] [Manager name], please follow up. [Admin link]' },
  { id: 'access_open', channel: DISCORD_CHANNELS.enrollments, body: 'ACCESS OPEN: [Full name] signed the agreement. Module 1 unlocked. [Admin link]' },
  { id: 'final_quiz_open', channel: DISCORD_CHANNELS.enrollments, body: 'FINAL QUIZ OPEN: [Full name] finished Modules 1 to 10. [Admin link]' },

  { id: 'stalled', channel: DISCORD_CHANNELS.stalled, body: 'STALLED: [Full name] inactive 48 hours. Last activity: [Lesson name or Quiz name]. Manager: [Manager name]. [Admin link]' },
  { id: 'call_needed', channel: DISCORD_CHANNELS.stalled, body: 'CALL NEEDED: [Full name] inactive 72 hours. [Role ping] [Manager name], please call today. [Admin link]' },
  { id: 'attempt_3', channel: DISCORD_CHANNELS.stalled, body: 'ATTEMPT 3: [Full name] failed attempt 3 on [Quiz name]. Missed: [Concepts]. Manager: [Manager name]. [Admin link]' },
  { id: 'back_on_track', channel: DISCORD_CHANNELS.stalled, body: 'BACK ON TRACK: [Full name] resumed activity. Status: Active. [Admin link]' },

  { id: 'hold', channel: DISCORD_CHANNELS.holds, body: 'HOLD: [Full name] is On Hold (Review). [Quiz name]. Attempts used: [Attempts used]. Most missed: [Concepts]. Time in module lessons: [Minutes] min. Reviewer: [Reviewer name]. Due: [Review due date]. [Role ping] [Admin link]' },
  { id: 'hold_unassigned', channel: DISCORD_CHANNELS.holds, body: 'HOLD UNASSIGNED: [Full name] has no reviewer. [Role ping] [Admin link]' },
  { id: 'hold_reminder', channel: DISCORD_CHANNELS.holds, body: "HOLD REMINDER: [Full name]'s review is due [Review due date]. Reviewer: [Reviewer name]. [Admin link]" },
  { id: 'hold_overdue', channel: DISCORD_CHANNELS.holds, body: "HOLD OVERDUE: [Full name]'s review was due [Review due date]. [Role ping] Reviewer: [Reviewer name]. [Admin link]" },
  { id: 'release_needs_confirm', channel: DISCORD_CHANNELS.holds, body: 'RELEASE NEEDS CONFIRM: [Reviewer name] recommends releasing [Full name]. [Role ping] [Admin link]' },
  { id: 'hold_resolved', channel: DISCORD_CHANNELS.holds, body: 'HOLD RESOLVED: [Full name]. Outcome: [Reset, Extend, or Release]. Reviewer: [Reviewer name]. [Admin link]' },
  { id: 'hold_reopened', channel: DISCORD_CHANNELS.holds, body: "HOLD REOPENED: [Full name]'s hold was reopened by [Reviewer name]. [Admin link]" },

  { id: 'needs_grading', channel: DISCORD_CHANNELS.reviews, body: "NEEDS GRADING: [Full name]'s [Simulation name or reflection] could not be graded automatically. [Role ping] [Admin link]" },
  { id: 'low_simulation_score', channel: DISCORD_CHANNELS.reviews, body: 'LOW SIMULATION SCORE: [Full name] scored [Number] on [Simulation name]. Manager: [Manager name]. [Admin link]' },
  { id: 'review_waiting', channel: DISCORD_CHANNELS.reviews, body: 'REVIEW WAITING: [Number] practical submissions waiting. Oldest: [Hours] hours. [Admin link]' },
  { id: 'grader_errors', channel: DISCORD_CHANNELS.reviews, body: 'GRADER ERRORS: [Number] grading failures in the last hour. [Role ping] [Admin link]' },

  { id: 'sign_off_needed', channel: DISCORD_CHANNELS.certifications, body: 'SIGN-OFF NEEDED: [Full name] passed the capstone and is ready for supervisor sign-off. [Role ping] [Admin link]' },
  { id: 'not_yet', channel: DISCORD_CHANNELS.certifications, body: 'NOT YET: [Full name] sign-off returned. Re-review: [Retest date]. Supervisor: [Supervisor name]. [Admin link]' },
  { id: 'not_yet_3x', channel: DISCORD_CHANNELS.certifications, body: 'NOT YET 3X: [Full name] has been returned 3 times. [Role ping] Admin decision needed. [Admin link]' },
  { id: 'certified', channel: DISCORD_CHANNELS.certifications, body: 'CERTIFIED: [Full name] earned Level 1: Certified Operator. Ready for placement. [Admin link]' },
  { id: 'level_2', channel: DISCORD_CHANNELS.certifications, body: 'LEVEL 2: [Full name] certified in [Vertical]. [Admin link]' },
  { id: 'level_3', channel: DISCORD_CHANNELS.certifications, body: 'LEVEL 3: [Full name] completed [Track]. [Admin link]' },
  { id: 'recert_due', channel: DISCORD_CHANNELS.certifications, body: 'RECERT DUE: [Full name] certification renews [Renewal date]. [Admin link]' },
  { id: 'lapsed', channel: DISCORD_CHANNELS.certifications, body: 'LAPSED: [Full name] certification expired. Placement status set to Lapsed. [Admin link]' },
  { id: 'revoked', channel: DISCORD_CHANNELS.certifications, body: 'REVOKED: [Full name] certification revoked by [Admin name]. [Admin link]' },

  { id: 'matched', channel: DISCORD_CHANNELS.placement, body: 'MATCHED: [Full name] matched with [Client] ([Vertical]). Start: [Start date]. [Admin link]' },
  { id: 'placed', channel: DISCORD_CHANNELS.placement, body: 'PLACED: [Full name] started with [Client] on [Start date]. Manager: [Manager name]. [Admin link]' },
  { id: 'low_pulse', channel: DISCORD_CHANNELS.placement, body: 'LOW PULSE: [Operator or Client] pulse for [Full name] at [Client], day [Days]: rating [Number]. Manager: [Manager name]. [Role ping] [Admin link]' },
  { id: 'no_pulse_response', channel: DISCORD_CHANNELS.placement, body: 'NO PULSE RESPONSE: [Full name], day [Days]. [Admin link]' },
  { id: 'placement_ending', channel: DISCORD_CHANNELS.placement, body: 'PLACEMENT ENDING: [Full name] at [Client] ends [End date]. [Admin link]' },
  { id: 'placement_ended', channel: DISCORD_CHANNELS.placement, body: 'PLACEMENT ENDED: [Full name] at [Client]. Status: [Ready or Paused]. [Admin link]' },

  { id: 'academy_daily', channel: DISCORD_CHANNELS.daily, body: 'ACADEMY DAILY: Active [Number]. Stalled [Number]. On Hold [Number]. Holds open [Number], overdue [Number]. Reviews waiting [Number]. Completed this week [Number].' },

  { id: 'delivery_failure', channel: DISCORD_CHANNELS.daily, body: 'DELIVERY FAILURE: [Number] messages failed after 3 retries. [Role ping] [Admin link]', system: true },
];

export function discordAlert(id: string): DiscordAlert | undefined {
  return DISCORD_ALERTS.find((alert) => alert.id === id);
}

export const NEW_DISCORD_IDS = [
  'grader_errors',
  'hold_reopened',
  'not_yet_3x',
  'revoked',
  'matched',
  'placement_ending',
  'placement_ended',
  'agreement_sent',
  'agreement_unsigned_72h',
  'back_on_track',
  'delivery_failure',
] as const;
