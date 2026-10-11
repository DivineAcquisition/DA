import type { QualificationResult } from '@/lib/acq/qualify';
import type { LeadStage } from '@/lib/acq/stages';
import type { BookingStatus } from '@/lib/booking-messages/types';

/**
 * Every tag DA writes into GoHighLevel, named `group - value` in lower case.
 * Groups marked exclusive hold one tag at a time: setting one removes the
 * rest of the group. GHL workflows that trigger on a tag must use these names.
 */

/** Exclusive. Mirrors the lead's pipeline stage. */
export const STAGE_TAGS: Record<LeadStage, string> = {
  'Step 1 Captured': 'lead - new',
  'Application Abandoned': 'lead - application abandoned',
  'Manual Review': 'lead - manual review',
  'Qualified - Not Booked': 'lead - qualified',
  'Audit Booked': 'lead - audit booked',
  'No Show': 'lead - no show',
  'Audit Held': 'lead - audit held',
  'Closed Won': 'lead - closed won',
  'Closed Lost': 'lead - closed lost',
  Disqualified: 'lead - disqualified',
  Recycled: 'lead - recycled',
};

/** Exclusive. The application score result. */
export const QUALIFICATION_TAGS: Record<QualificationResult, string> = {
  Qualified: 'qualification - qualified',
  'Manual Review': 'qualification - manual review',
  Disqualified: 'qualification - disqualified',
};

/** Exclusive. The latest status of the free audit appointment. */
export const APPOINTMENT_TAGS: Record<BookingStatus, string> = {
  booked: 'appointment - booked',
  rescheduled: 'appointment - rescheduled',
  cancelled: 'appointment - cancelled',
  held: 'appointment - held',
  no_show: 'appointment - no show',
};

/** Additive. Where the contact came from. */
export const SOURCE_TAGS = {
  foundingInstall: 'source - founding install application',
  roofing: 'source - roofing lead leak audit',
  cleaning: 'source - cleaning strategy session',
  talent: 'source - talent assessment',
} as const;

export const TAGS = {
  applicationComplete: 'application - complete',
  smsConsent: 'consent - sms opt in',
  doNotContact: 'consent - do not contact',
  talentCandidate: 'talent - candidate',
  assessmentInvited: 'talent - assessment invited',
  assessmentBooked: 'talent - assessment booked',
} as const;

export const SPEND_QUALIFIED_TAGS = {
  yes: 'fit - spend qualified',
  no: 'fit - spend not qualified',
} as const;

export function nicheTag(niche: string): string {
  return `niche - ${niche.trim().toLowerCase()}`;
}

export function headlineTag(variant: string): string {
  return `ad - headline ${variant.trim().toLowerCase()}`;
}

/** Old names, kept only so they are recognised on read and removed on write. */
export const LEGACY_TAGS: Record<string, string> = {
  'da-qualified': QUALIFICATION_TAGS.Qualified,
  'da-manual-review': QUALIFICATION_TAGS['Manual Review'],
  'da-disqualified': QUALIFICATION_TAGS.Disqualified,
  'da-app-complete': TAGS.applicationComplete,
  'acq-qualify': TAGS.applicationComplete,
  'founding-install': SOURCE_TAGS.foundingInstall,
  'da-do-not-contact': TAGS.doNotContact,
  'da-audit-held': APPOINTMENT_TAGS.held,
  'cleaning strategy session': SOURCE_TAGS.cleaning,
  'assessment-booking': TAGS.assessmentBooked,
  'assessment-invite': TAGS.assessmentInvited,
  'talent-pipeline': TAGS.talentCandidate,
  'qualified-yes': SPEND_QUALIFIED_TAGS.yes,
  'qualified-no': SPEND_QUALIFIED_TAGS.no,
  'niche-roofing': nicheTag('roofing'),
  'spend-under-2000': 'spend - under 2000',
  'spend-2000-5000': 'spend - 2000 to 5000',
  'spend-5000-10000': 'spend - 5000 to 10000',
  'spend-10000-plus': 'spend - 10000 plus',
  'headline-default': headlineTag('default'),
  'headline-c1': headlineTag('c1'),
  'headline-c2': headlineTag('c2'),
  'headline-c3': headlineTag('c3'),
};

const norm = (tag: string) => tag.trim().toLowerCase();

/** The formal tag plus every legacy name that means the same thing. */
export function tagNames(formal: string): string[] {
  const wanted = norm(formal);
  return [formal, ...Object.keys(LEGACY_TAGS).filter((old) => norm(LEGACY_TAGS[old]) === wanted)];
}

export function hasTag(tags: readonly string[], formal: string): boolean {
  const names = new Set(tagNames(formal).map(norm));
  return tags.some((tag) => names.has(norm(tag)));
}

/** Tags to add and remove so `keep` is the only tag left from its group. */
export function exclusiveTagChange(group: Record<string, string>, keep: string): { add: string[]; remove: string[] } {
  const remove = Object.values(group)
    .filter((tag) => tag !== keep)
    .flatMap(tagNames);
  return { add: [keep], remove: [...remove, ...tagNames(keep).slice(1)] };
}

/** Legacy names to clear once their formal tags are written. */
export function legacyNamesFor(tags: readonly string[]): string[] {
  return tags.flatMap((tag) => tagNames(tag).slice(1));
}
