export type EventAudience = 'candidate' | 'trainee' | 'operator' | 'client' | 'internal';
export type EventTiming = 'immediate' | 'allowed_hours' | 'business_hours' | 'fixed';
export type EventGate = 'client' | 'module_complete' | 'sign_in_alert';

export type AcademyEvent = {
  key: string;
  label: string;
  audience: EventAudience;
  email?: string;
  discord?: string;
  sms?: string;
  inApp?: string;
  timing: EventTiming;
  nudge?: boolean;
  once?: boolean;
  manual?: boolean;
  gate?: EventGate;
  /** Staff email is the fallback when the person is not on Discord. */
  emailFallback?: boolean;
  new?: boolean;
};

export const EVENTS: AcademyEvent[] = [
  { key: 'application_received', label: 'Application received', audience: 'candidate', email: 'A01', timing: 'immediate' },
  { key: 'interview_scheduled', label: 'Interview scheduled', audience: 'candidate', email: 'A02', sms: 'S05', timing: 'immediate' },
  { key: 'interview_reminder', label: '24 hours before interview', audience: 'candidate', email: 'A03', sms: 'S05', timing: 'allowed_hours' },
  { key: 'second_conversation', label: 'Second conversation scheduled', audience: 'candidate', email: 'A05', timing: 'business_hours' },
  { key: 'not_advancing', label: 'Not advancing', audience: 'candidate', email: 'A06', timing: 'business_hours' },
  { key: 'offer_accepted', label: 'Offer made / accepted', audience: 'candidate', email: 'A07', discord: 'new_trainee', timing: 'immediate' },
  { key: 'agreement_sent', label: 'Agreement sent', audience: 'candidate', email: 'A08', discord: 'agreement_sent', timing: 'immediate', new: true },
  { key: 'agreement_unsigned_24h', label: 'Agreement unsigned 24 hours', audience: 'candidate', email: 'A09', timing: 'allowed_hours', once: true },
  { key: 'agreement_unsigned_72h', label: 'Agreement unsigned 72 hours', audience: 'candidate', email: 'A10', discord: 'agreement_unsigned_72h', timing: 'allowed_hours', once: true, new: true },
  { key: 'offer_lapsed', label: 'Offer lapsed', audience: 'candidate', email: 'A11', timing: 'immediate', once: true },

  { key: 'enrollment_created', label: 'Enrollment created', audience: 'trainee', email: 'B01', discord: 'new_trainee', timing: 'immediate' },
  { key: 'access_open', label: 'Agreement signed, access open', audience: 'trainee', email: 'B02', discord: 'access_open', sms: 'S01', timing: 'immediate' },
  { key: 'how_it_works', label: 'Next morning 8 AM after access', audience: 'trainee', email: 'B03', timing: 'fixed', once: true },
  { key: 'inactive_24h', label: 'Inactive 24 hours', audience: 'trainee', email: 'B04', sms: 'S02', timing: 'allowed_hours', nudge: true },
  { key: 'inactive_48h', label: 'Inactive 48 hours (Stalled)', audience: 'trainee', email: 'B05', discord: 'stalled', timing: 'allowed_hours', new: true },
  { key: 'inactive_72h', label: 'Inactive 72 hours', audience: 'trainee', discord: 'call_needed', timing: 'immediate' },
  { key: 'back_on_track', label: 'Back on track', audience: 'internal', discord: 'back_on_track', timing: 'immediate', new: true },
  { key: 'module_complete', label: 'Module complete', audience: 'trainee', email: 'B06', inApp: 'module_complete', timing: 'immediate', gate: 'module_complete', new: true },
  { key: 'attempt_3', label: 'Failed attempt 3', audience: 'internal', discord: 'attempt_3', inApp: 'attempt_3', timing: 'immediate' },
  { key: 'attempt_4', label: 'Failed attempt 4', audience: 'trainee', inApp: 'attempt_4', timing: 'immediate' },
  { key: 'attempt_max', label: 'Failed attempt at max', audience: 'trainee', email: 'B09', discord: 'hold', inApp: 'hold', timing: 'immediate' },
  { key: 'practical_reviewed', label: 'Practical reviewed', audience: 'trainee', email: 'B07', timing: 'immediate', new: true },
  { key: 'grading_delayed', label: 'Grading delayed', audience: 'trainee', email: 'B08', discord: 'needs_grading', timing: 'immediate', new: true },
  { key: 'hold_call_set', label: 'Hold review call scheduled', audience: 'trainee', email: 'B10', sms: 'S03', timing: 'immediate', new: true },
  { key: 'hold_reset', label: 'Hold resolved: Reset', audience: 'trainee', email: 'B11', discord: 'hold_resolved', timing: 'immediate' },
  { key: 'hold_extend', label: 'Hold resolved: Extend', audience: 'trainee', email: 'B12', discord: 'hold_resolved', timing: 'immediate' },
  { key: 'retest_tomorrow', label: 'Re-test day before', audience: 'trainee', email: 'B13', timing: 'allowed_hours', new: true },
  { key: 'hold_release', label: 'Hold resolved: Release', audience: 'trainee', email: 'B14', discord: 'hold_resolved', timing: 'immediate', manual: true },
  { key: 'final_quiz_open', label: 'Final Quiz unlocked', audience: 'trainee', email: 'B15', discord: 'final_quiz_open', timing: 'immediate' },
  { key: 'capstone_passed', label: 'Capstone passed, sign-off next', audience: 'trainee', email: 'B16', discord: 'sign_off_needed', timing: 'immediate', new: true },
  { key: 'signoff_not_yet', label: 'Sign-off: Not yet', audience: 'trainee', email: 'B17', discord: 'not_yet', timing: 'immediate' },
  { key: 'signoff_not_yet_3x', label: 'Sign-off returned 3 times', audience: 'internal', discord: 'not_yet_3x', timing: 'immediate', new: true },
  { key: 'level_1', label: 'Level 1 granted', audience: 'trainee', email: 'B18', discord: 'certified', timing: 'immediate' },
  { key: 'level_2', label: 'Level 2 granted', audience: 'trainee', email: 'B19', discord: 'level_2', timing: 'immediate' },
  { key: 'level_3', label: 'Level 3 granted', audience: 'trainee', email: 'B20', discord: 'level_3', timing: 'immediate' },
  { key: 'recert_30', label: 'Re-cert 30 days before', audience: 'operator', email: 'B21', discord: 'recert_due', timing: 'allowed_hours' },
  { key: 'recert_7', label: 'Re-cert 7 days before', audience: 'operator', email: 'B22', sms: 'S06', timing: 'allowed_hours', new: true },
  { key: 'cert_expired', label: 'Certification expired', audience: 'operator', email: 'B23', discord: 'lapsed', timing: 'immediate' },
  { key: 'cert_revoked', label: 'Certification revoked', audience: 'operator', email: 'B24', discord: 'revoked', timing: 'immediate', manual: true, new: true },
  { key: 'matched', label: 'Operator matched to client', audience: 'operator', email: 'B25', discord: 'matched', timing: 'immediate', new: true },
  { key: 'placement_tomorrow', label: 'Day before placement start', audience: 'operator', email: 'B26', timing: 'fixed', new: true },
  { key: 'placement_start', label: 'Placement start', audience: 'internal', discord: 'placed', timing: 'immediate' },
  { key: 'operator_pulse', label: 'Operator pulse day 7 and 30', audience: 'operator', email: 'B27', sms: 'S04', timing: 'allowed_hours' },
  { key: 'pulse_reminder', label: 'Pulse reminder', audience: 'operator', email: 'B28', timing: 'allowed_hours', once: true },
  { key: 'placement_ended', label: 'Placement ended', audience: 'operator', email: 'B29', discord: 'placement_ended', timing: 'immediate', new: true },
  { key: 'placement_ending', label: 'Placement ending', audience: 'internal', discord: 'placement_ending', timing: 'immediate', new: true },
  { key: 'low_pulse', label: 'Low pulse rating', audience: 'internal', discord: 'low_pulse', timing: 'immediate' },
  { key: 'no_pulse_response', label: 'No pulse response', audience: 'internal', discord: 'no_pulse_response', timing: 'immediate' },

  { key: 'client_intro', label: 'Client introduction', audience: 'client', email: 'C01', timing: 'business_hours', gate: 'client', new: true },
  { key: 'client_pulse', label: 'Client pulse day 7 and 30', audience: 'client', email: 'C02', timing: 'business_hours', gate: 'client' },
  { key: 'client_pulse_reminder', label: 'Client pulse reminder', audience: 'client', email: 'B28', timing: 'business_hours', gate: 'client', once: true },
  { key: 'client_end', label: 'Placement end notice to client', audience: 'client', email: 'C04', timing: 'business_hours', gate: 'client', new: true },
  { key: 'client_replacement', label: 'Operator replacement notice', audience: 'client', email: 'C05', timing: 'business_hours', gate: 'client', manual: true, new: true },

  { key: 'hold_assigned', label: 'Hold assigned to reviewer', audience: 'internal', email: 'D01', discord: 'hold', timing: 'immediate', emailFallback: true },
  { key: 'hold_due', label: 'Hold due in 24 hours', audience: 'internal', email: 'D02', discord: 'hold_reminder', timing: 'allowed_hours', emailFallback: true },
  { key: 'hold_overdue', label: 'Hold overdue', audience: 'internal', email: 'D03', discord: 'hold_overdue', timing: 'immediate', emailFallback: true },
  { key: 'release_confirm', label: 'Release needs admin confirm', audience: 'internal', email: 'D04', discord: 'release_needs_confirm', timing: 'immediate', emailFallback: true },
  { key: 'signoff_needed', label: 'Sign-off needed', audience: 'internal', email: 'D05', discord: 'sign_off_needed', timing: 'immediate', emailFallback: true },
  { key: 'practical_waiting', label: 'Practical waiting over 24 hours', audience: 'internal', email: 'D06', discord: 'review_waiting', timing: 'immediate', emailFallback: true },
  { key: 'needs_grading', label: 'Needs manual grading', audience: 'internal', email: 'D07', discord: 'needs_grading', timing: 'immediate', emailFallback: true },
  { key: 'weekly_digest', label: 'Weekly digest (Monday 8 AM)', audience: 'internal', email: 'D08', timing: 'fixed', new: true },
  { key: 'trainee_assigned', label: 'New trainee assigned', audience: 'internal', email: 'D09', timing: 'immediate', new: true },
  { key: 'hold_unassigned', label: 'Hold unassigned', audience: 'internal', discord: 'hold_unassigned', timing: 'immediate' },
  { key: 'hold_reopened', label: 'Hold reopened', audience: 'internal', discord: 'hold_reopened', timing: 'immediate', new: true },
  { key: 'low_simulation', label: 'Low simulation score', audience: 'internal', discord: 'low_simulation_score', timing: 'immediate' },
  { key: 'grader_errors', label: 'Grader errors', audience: 'internal', discord: 'grader_errors', timing: 'immediate', new: true },
  { key: 'daily_summary', label: 'Daily summary', audience: 'internal', discord: 'academy_daily', timing: 'fixed' },
  { key: 'delivery_failure', label: 'Delivery failure', audience: 'internal', discord: 'delivery_failure', timing: 'immediate', new: true },

  { key: 'confirm_email', label: 'Confirm your email', audience: 'trainee', email: 'I01', timing: 'immediate' },
  { key: 'magic_link', label: 'Sign-in link', audience: 'trainee', email: 'I02', timing: 'immediate' },
  { key: 'reset_password', label: 'Reset your password', audience: 'trainee', email: 'I03', timing: 'immediate' },
  { key: 'password_changed', label: 'Password changed', audience: 'trainee', email: 'I04', timing: 'immediate' },
  { key: 'email_change', label: 'Email address change', audience: 'trainee', email: 'I05', timing: 'immediate' },
  { key: 'team_invite', label: 'Invitation', audience: 'internal', email: 'I06', timing: 'immediate' },
  { key: 'new_sign_in', label: 'New sign-in alert', audience: 'trainee', email: 'I07', timing: 'immediate', gate: 'sign_in_alert' },
];

export function academyEvent(key: string): AcademyEvent | undefined {
  return EVENTS.find((event) => event.key === key);
}

export const NEW_EMAIL_IDS = [
  'B05',
  'B06',
  'B07',
  'B08',
  'B10',
  'B13',
  'B16',
  'B22',
  'B24',
  'B25',
  'B26',
  'B29',
  'C01',
  'C04',
  'C05',
  'D08',
  'D09',
] as const;
