/**
 * Every state a Sales Operator can see, in plain language. Nothing in the portal
 * renders a raw status code: it goes through one of these, and an unknown value
 * falls back to a readable phrase rather than the code itself.
 */

export type Tone = 'brand' | 'neutral' | 'good' | 'warning' | 'critical';

type Label = { label: string; detail: string; tone: Tone };

/**
 * Booking states. "system_only" is a booking that arrived from the client's
 * calendar (GHL) on this VA's placement and no manual log was matched to it. It
 * counts toward quota and commission (booking_is_creditable), so the VA sees it,
 * labelled as found on the calendar.
 */
export const BOOKING_STATE: Record<string, Label> = {
  confirmed: { label: 'Confirmed', detail: 'Counts toward quota and commission', tone: 'good' },
  pending_review: { label: 'Waiting for review', detail: "Waiting for DA to verify, doesn't count yet", tone: 'warning' },
  rejected: { label: 'Not counted', detail: 'DA could not verify it', tone: 'critical' },
  system_only: {
    label: 'On the calendar',
    detail: "Found on the client's calendar during your placement. Counts toward quota and commission",
    tone: 'good',
  },
};

export function bookingState(state: string, counts?: boolean): Label {
  const base = BOOKING_STATE[state] ?? { label: 'In progress', detail: 'DA is still processing this booking', tone: 'neutral' };
  // A confirmed manual log that matched a calendar booking is credited once, on
  // the calendar record; the log itself is the proof, not a second count.
  if (state === 'confirmed' && counts === false) {
    return { label: 'Matched', detail: 'Matched to the calendar booking, which is the one that counts', tone: 'good' };
  }
  return base;
}

export const BOOKING_SOURCE: Record<string, string> = {
  manual: 'Logged by you',
  ghl: 'Client calendar',
};

export const ESCALATION_CATEGORY: Record<string, { label: string; detail: string }> = {
  clinical: {
    label: 'Clinical',
    detail: 'Any question about treatments, side effects, suitability, or medical history.',
  },
  pricing_exception: {
    label: 'Pricing exception',
    detail: 'A price, discount or package that is not on the approved list.',
  },
  complaint: {
    label: 'Complaint',
    detail: 'The customer is unhappy with the client, a past visit, or with us.',
  },
  scheduling_conflict: {
    label: 'Scheduling conflict',
    detail: "The time they want isn't available, or a booking clashes or needs moving.",
  },
  scope: {
    label: 'Outside my role',
    detail: 'They want something the playbook does not cover or you are not allowed to do.',
  },
  other: { label: 'Something else', detail: 'Anything that does not fit above. Describe it clearly.' },
};

export const escalationCategory = (value: string) =>
  ESCALATION_CATEGORY[value]?.label ?? 'Question';

export const ESCALATION_STATUS: Record<string, Label> = {
  open: { label: 'Waiting for DA', detail: 'DA has not answered yet', tone: 'warning' },
  answered: { label: 'Answered', detail: 'Read the answer and act on it', tone: 'good' },
  closed: { label: 'Closed', detail: 'Done', tone: 'neutral' },
};

export const escalationStatus = (value: string): Label =>
  ESCALATION_STATUS[value] ?? { label: 'In progress', detail: '', tone: 'neutral' };

export const ATTENDANCE: Record<string, Label> = {
  worked: { label: 'Worked', detail: 'A report was filed for this shift', tone: 'good' },
  worked_report_missing: {
    label: 'Worked, report missing',
    detail: 'You logged work this shift but have not filed the report',
    tone: 'warning',
  },
  notified_absence: { label: 'Absence reported', detail: 'You told DA you could not work this shift', tone: 'neutral' },
  excused_emergency: { label: 'Excused', detail: 'DA excused this shift', tone: 'neutral' },
  abandoned: { label: 'Abandoned', detail: 'Confirmed by DA: no notice and no work', tone: 'critical' },
  scheduled: { label: 'Scheduled', detail: 'This shift has not happened yet', tone: 'brand' },
  suspected_missed: {
    label: 'No report yet',
    detail: 'No report, no logged work and no notice. File the report if you worked it',
    tone: 'critical',
  },
};

export const attendance = (value: string): Label =>
  ATTENDANCE[value] ?? { label: 'Recorded', detail: '', tone: 'neutral' };

export const PAYOUT_STATUS: Record<string, Label> = {
  pending: { label: 'Being prepared', detail: 'DA has not sent this payment yet', tone: 'neutral' },
  sent: { label: 'Sent', detail: 'On its way to you', tone: 'brand' },
  confirmed: { label: 'Received', detail: 'Payment confirmed', tone: 'good' },
  failed: {
    label: 'Failed',
    detail: 'The payment did not go through. DA will retry or roll it into your next payout',
    tone: 'critical',
  },
  returned: {
    label: 'Returned',
    detail: 'The payment came back. Check your payout method; DA will resend it',
    tone: 'critical',
  },
};

export const payoutStatus = (value: string): Label =>
  PAYOUT_STATUS[value] ?? { label: 'In progress', detail: '', tone: 'neutral' };

export const PAYOUT_METHOD: Record<string, string> = {
  wise: 'Wise',
  payoneer: 'Payoneer',
  bank_transfer: 'Bank transfer',
  paypal: 'PayPal',
  crypto_usdc: 'USDC (crypto)',
};

export const TAX_STATUS: Record<string, Label> = {
  missing: { label: 'Missing', detail: 'DA needs your tax document', tone: 'critical' },
  requested: { label: 'Requested', detail: 'DA asked you for your tax document', tone: 'warning' },
  submitted: { label: 'Submitted', detail: 'DA is reviewing it', tone: 'brand' },
  on_file: { label: 'Approved', detail: 'On file with DA', tone: 'good' },
  expired: { label: 'Expired', detail: 'Send an updated document', tone: 'warning' },
};

export const CHANNEL: Record<string, string> = {
  in_app: 'In the portal only',
  discord: 'Discord',
  email: 'Email',
  whatsapp: 'WhatsApp',
};

export const OPERATOR_STATUS: Record<string, string> = {
  applicant: 'Applicant',
  in_training: 'In training',
  certified: 'Certified',
  placed: 'Placed',
  on_bench: 'Between placements',
  inactive: 'Inactive',
};

export const PLACEMENT_STATUS: Record<string, string> = {
  draft: 'Being set up',
  active: 'Active',
  ended: 'Ended',
  renewed: 'Renewed',
};

export const SEVERITY_TONE: Record<string, Tone> = {
  informational: 'neutral',
  important: 'warning',
  urgent: 'critical',
};

export const SEVERITY_LABEL: Record<string, string> = {
  informational: 'Info',
  important: 'Important',
  urgent: 'Urgent',
};

export const REASON_KINDS = [
  { value: 'support_request', label: 'Support request' },
  { value: 'dispute_investigation', label: 'Dispute investigation' },
  { value: 'quality_review', label: 'Quality review' },
  { value: 'pay_question', label: 'Pay question' },
  { value: 'other', label: 'Other' },
] as const;

export const reasonKind = (value: string | null | undefined) =>
  REASON_KINDS.find((item) => item.value === value)?.label ?? 'Other';

export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** "Mon to Fri", "Mon, Wed, Fri", "Every day". ISO days, 1 = Monday. */
export function workingDays(days: number[] | null | undefined): string {
  const list = [...new Set(days ?? [])].filter((d) => d >= 1 && d <= 7).sort((a, b) => a - b);
  if (list.length === 7) return 'Every day';
  if (list.length === 0) return 'No days set';
  const contiguous = list.every((d, i) => i === 0 || d === list[i - 1] + 1);
  if (contiguous && list.length > 2) return `${DAY_NAMES[list[0] - 1]} to ${DAY_NAMES[list[list.length - 1] - 1]}`;
  return list.map((d) => DAY_NAMES[d - 1]).join(', ');
}
