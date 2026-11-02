/** Pure rules for hire stage, readiness, overrides, and the onboarding form. */

export const HIRE_STAGES = ['invited', 'onboarding', 'ready', 'placed', 'paused', 'offboarded'] as const;
export type HireStage = (typeof HIRE_STAGES)[number];

export const STAGE_LABEL: Record<HireStage, string> = {
  invited: 'Invited',
  onboarding: 'Onboarding',
  ready: 'Ready to place',
  placed: 'Placed',
  paused: 'Paused',
  offboarded: 'Off-boarded',
};

/** How the portal stages already in the app line up with the six hire stages. */
export const PORTAL_STAGE_MAP = {
  applicant: 'Onboarding, once they have signed in. Before that, Invited.',
  training: 'Onboarding, while Academy work is still open.',
  waiting: 'Ready to place.',
  placed: 'Placed.',
  inactive: 'Off-boarded.',
} as const;

export type ReadinessState = 'met' | 'missing' | 'waived' | 'flagged';

export type ReadinessItem = {
  key: 'account' | 'onboarding' | 'agreement' | 'payout' | 'academy' | 'setup' | 'manager';
  label: string;
  state: ReadinessState;
  detail: string;
};

export function readinessComplete(items: ReadinessItem[]): boolean {
  return items.length === 7 && items.every((item) => item.state === 'met' || item.state === 'waived');
}

export type StageFacts = {
  signedIn: boolean;
  readinessMet: boolean;
  placement: 'none' | 'active' | 'paused';
  offboarded: boolean;
  current: HireStage;
};

/** Automatic facts win. A manual stage stays only until one of those facts moves it. */
export function nextHireStage(facts: StageFacts): HireStage {
  if (facts.offboarded) return 'offboarded';
  if (facts.placement === 'paused') return 'paused';
  if (facts.placement === 'active') return 'placed';
  if (facts.readinessMet) return 'ready';
  if (facts.signedIn) return 'onboarding';
  return 'invited';
}

const DAY = 24 * 60 * 60 * 1000;

export function reminderDue(signedInAt: Date, count: number, now: Date): boolean {
  if (count >= 3) return false;
  return now.getTime() >= signedInAt.getTime() + (count + 1) * 48 * 60 * 60 * 1000;
}

export function daysBetween(start: string, end: string): number {
  const a = Date.parse(`${start}T00:00:00Z`);
  const b = Date.parse(`${end}T00:00:00Z`);
  return Math.round((b - a) / DAY);
}

export function addDays(start: string, days: number): string {
  const date = new Date(`${start}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Total length of an override. Over 60 days needs an explicit exception. */
export function extensionAllowed(start: string, expires: string, exception: boolean): { ok: boolean; total: number } {
  const total = daysBetween(start, expires);
  return { ok: total > 0 && total <= 60 || (exception && total > 0 && total <= 365), total };
}

export type OnboardingDraft = {
  legal_name?: string;
  preferred_name?: string;
  personal_email?: string;
  mobile?: string;
  discord?: string;
  city?: string;
  region?: string;
  country?: string;
  time_zone?: string;
  weekly_hours?: string;
  work_days?: string;
  work_hours?: string;
  earliest_start?: string;
  time_off?: string;
  us_zones?: string[];
  years?: string;
  roles?: string[];
  tools?: string[];
  industries?: string;
  verticals?: string[];
  laptop?: string;
  internet?: string;
  internet_speed?: string;
  headset?: string;
  quiet?: string;
  emergency_name?: string;
  emergency_relationship?: string;
  emergency_phone?: string;
  ack_academy?: boolean;
  ack_gates?: boolean;
  ack_logins?: boolean;
  ack_confidential?: boolean;
  ack_eod?: boolean;
  ack_myself?: boolean;
  why?: string;
  skill?: string;
  year_goal?: string;
};

const HOURS = ['under_20', '20_30', '30_40', '40_plus'];
const YEARS = ['none', 'under_1', '1_2', '3_5', '5_plus'];
const ZONES = ['eastern', 'central', 'mountain', 'pacific'];

export function setupFlags(draft: OnboardingDraft): string[] {
  const flags: string[] = [];
  if (draft.laptop === 'no') flags.push('laptop');
  if (draft.internet === 'no') flags.push('internet');
  if (draft.headset === 'no') flags.push('headset');
  if (draft.quiet === 'no') flags.push('quiet');
  return flags;
}

function sentences(value: string): number {
  return value
    .split(/[.!?]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 1).length;
}

/** Errors for one step. An empty list means the step can be saved. */
export function stepErrors(step: number, draft: OnboardingDraft, payoutComplete: boolean): string[] {
  const errors: string[] = [];
  const need = (ok: boolean, message: string) => {
    if (!ok) errors.push(message);
  };
  if (step === 1) {
    need(Boolean(draft.legal_name?.trim()), 'Enter your full legal name.');
    need(Boolean(draft.preferred_name?.trim()), 'Enter the name you go by.');
    need(/^\+[1-9]\d{7,14}$/.test((draft.mobile ?? '').replace(/[\s()-]/g, '')), 'Enter a mobile number with a country code.');
    need(Boolean(draft.discord?.trim()), 'Enter your Discord username.');
    need(Boolean(draft.city?.trim() && draft.region?.trim() && draft.country?.trim()), 'Enter your city, region, and country.');
    need(Boolean(draft.time_zone?.trim()), 'Confirm your time zone.');
    if (draft.personal_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.personal_email)) errors.push('That personal email is not valid.');
  }
  if (step === 2) {
    need(HOURS.includes(draft.weekly_hours ?? ''), 'Choose the hours you can commit.');
    need(Boolean(draft.work_days?.trim() && draft.work_hours?.trim()), 'Enter the days and hours you can work.');
    need(Boolean(draft.earliest_start), 'Enter the earliest date you can start.');
    need((draft.us_zones ?? []).some((zone) => ZONES.includes(zone)), 'Choose the US time zones you can cover.');
  }
  if (step === 3) {
    need(YEARS.includes(draft.years ?? ''), 'Choose your years in sales or outbound.');
    need((draft.roles ?? []).length > 0, 'Choose the roles you have held.');
    need((draft.verticals ?? []).length > 0, 'Choose the verticals you want.');
  }
  if (step === 4) {
    need(draft.laptop === 'yes' || draft.laptop === 'no', 'Say whether you have a laptop or desktop.');
    need(draft.internet === 'yes' || draft.internet === 'no', 'Say whether your internet is reliable.');
    need(draft.internet !== 'yes' || Boolean(draft.internet_speed?.trim()), 'Enter the speed test result.');
    need(draft.headset === 'yes' || draft.headset === 'no', 'Say whether you have a headset.');
    need(draft.quiet === 'yes' || draft.quiet === 'no', 'Say whether you have a quiet place to work.');
  }
  if (step === 5) {
    need(payoutComplete, 'Add your payout details on the payout step. They are stored on your payout record, not here.');
  }
  if (step === 6) {
    need(Boolean(draft.emergency_name?.trim() && draft.emergency_relationship?.trim()), 'Enter your emergency contact.');
    need(/^\+[1-9]\d{7,14}$/.test((draft.emergency_phone ?? '').replace(/[\s()-]/g, '')), 'Enter their phone with a country code.');
  }
  if (step === 7) {
    for (const key of ['ack_academy', 'ack_gates', 'ack_logins', 'ack_confidential', 'ack_eod', 'ack_myself'] as const) {
      need(draft[key] === true, 'Confirm every acknowledgment.');
    }
  }
  if (step === 8) {
    need(sentences(draft.why ?? '') >= 2, 'Say why you want to work with DA, in 2 or 3 sentences.');
    need(Boolean(draft.skill?.trim()), 'Name your strongest sales skill.');
    need(Boolean(draft.year_goal?.trim()), 'Say what you want to be doing in 12 months.');
  }
  return [...new Set(errors)];
}

export function formComplete(draft: OnboardingDraft, payoutComplete: boolean): boolean {
  return [1, 2, 3, 4, 5, 6, 7, 8].every((step) => stepErrors(step, draft, payoutComplete).length === 0);
}

/** Local clock label for a US zone, so the operator can see the overlap. */
export function zoneHours(zone: string, timeZone: string): string {
  const offset: Record<string, string> = {
    eastern: 'America/New_York',
    central: 'America/Chicago',
    mountain: 'America/Denver',
    pacific: 'America/Los_Angeles',
  };
  const target = offset[zone];
  if (!target) return '';
  try {
    const sample = new Date('2026-01-15T14:00:00Z');
    const there = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: target }).format(sample);
    const here = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: timeZone || 'UTC' }).format(sample);
    return `2:00 PM Eastern is ${there} there and ${here} for you.`;
  } catch {
    return '';
  }
}
