import type { PlaybookData } from './types';

/**
 * The playbook a trainee practises on. Every name in it is invented and it is
 * labelled as sample data wherever it shows. It lives in code, not the
 * database, so it can never be a real client's playbook.
 */
export const SAMPLE_PLAYBOOK: PlaybookData = {
  placement_id: 'sample',
  available: true,
  exists: true,
  client_name: 'Sample Smile Studio (practice data)',
  business_name: 'Sample Smile Studio',
  offer:
    'Family and cosmetic dentistry. New-patient exam with X-rays and cleaning; teeth whitening; Invisalign consultations.',
  locations: '100 Example Avenue, Springfield (practice address, not real)',
  hours: 'Monday to Friday 8:00 AM to 6:00 PM, Saturday 9:00 AM to 1:00 PM',
  qualifies:
    'A Confirmed Booking is a new patient with a date and time on the calendar, a valid phone number, and the reason for the visit noted.',
  disqualifiers: 'Under 18 without a parent on the call. Asking only for a price over text with no intent to book. Out of area.',
  handoff_method: 'calendar',
  handoff_steps:
    "1. Confirm name, phone and reason for visit.\n2. Offer the two soonest slots.\n3. Book it on the calendar and read back the time.\n4. Send the confirmation template.",
  escalation_contacts:
    'Clinical questions (pain, swelling, medication): escalate as Clinical; the office answers within 4 hours.\nPricing exceptions: escalate as Pricing exception.',
  never_say:
    'Never diagnose or suggest treatment. Never promise a price that is not listed below. Never say a procedure is painless.',
  approved_pricing: 'New-patient special: $99 exam, X-rays and cleaning (practice figure).',
  holding_lines: [
    'Great question. Let me confirm that with the team and get right back to you.',
    'I want to make sure you get the right answer, so I am checking with the office now.',
  ],
  scripts: [],
  has_override: false,
  version: 1,
  updated_at: null,
  updated_by: null,
};
