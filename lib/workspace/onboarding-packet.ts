/**
 * Turns a finished sales-operator onboarding form into the sections of the
 * placement packet, and into the Airtable fields that may leave this system.
 * A legacy bank account number stays in the PDF. A payout collected through
 * the payout record contributes the method and last four only. Airtable
 * receives the last four digits only.
 */

import type { PdfSection } from './branded-pdf';
import {
  PAYOUT_ONBOARDING_LABELS,
  ROLE_LABELS,
  VERTICAL_LABELS,
  YEARS_LABELS,
  YES_NO,
  choiceList,
  scheduleText,
  weeklyLabel,
} from './onboarding-fields';

export type OnboardingAnswers = Record<
  string,
  { value?: string; label?: string; access?: string; confirmed_at?: string; last4?: string }
>;

const SHIFT_LABELS: Record<string, string> = {
  '9am_530pm_est': '9AM - 5:30PM EST',
  '10am_630pm_est': '10AM - 6:30PM EST',
  '8am_430pm_est': '8AM - 4:30PM EST',
};

export function answerValue(answers: OnboardingAnswers, key: string): string {
  return String(answers[key]?.value ?? '').trim();
}

export function maskAccount(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 4) return '';
  return `ending ${digits.slice(-4)}`;
}

export function shiftLabel(value: string): string {
  return SHIFT_LABELS[value] ?? value;
}

export function onboardingSections(answers: OnboardingAnswers): PdfSection[] {
  const who: PdfSection['rows'] = [
    { label: 'Legal name', value: answerValue(answers, 'legal_name') },
    { label: 'Preferred name', value: answerValue(answers, 'preferred_name') },
    { label: 'Email', value: answerValue(answers, 'email') },
    { label: 'WhatsApp', value: answerValue(answers, 'whatsapp') },
    { label: 'Discord', value: answerValue(answers, 'discord') },
    { label: 'City and country', value: answerValue(answers, 'city_country') },
    { label: 'Timezone', value: answerValue(answers, 'timezone') },
  ].filter((row) => row.value);

  const shift: PdfSection['rows'] = [
    { label: 'Shift', value: shiftLabel(answerValue(answers, 'shift')) },
    { label: 'Training days', value: trainingLabel(answerValue(answers, 'training_availability')) },
    { label: 'Training conflict', value: answerValue(answers, 'training_conflict') },
  ].filter((row) => row.value);

  const bank: PdfSection['rows'] = [
    { label: 'Bank name', value: answerValue(answers, 'bank_name') },
    { label: 'Account number', value: answerValue(answers, 'account_number') },
  ].filter((row) => row.value);

  const payoutMethod = answerValue(answers, 'payout');
  const payoutLast4 = String(answers.payout?.last4 ?? '').trim();
  const payout: PdfSection['rows'] = [
    { label: 'Method', value: PAYOUT_ONBOARDING_LABELS[payoutMethod] ?? payoutMethod },
    { label: 'Ending', value: payoutLast4 ? `ending ${payoutLast4}` : '' },
  ].filter((row) => row.value);

  const equipment: PdfSection['rows'] = [
    { label: 'Laptop or desktop', value: YES_NO[answerValue(answers, 'has_computer')] ?? '' },
    { label: 'Reliable internet', value: YES_NO[answerValue(answers, 'has_internet')] ?? '' },
    { label: 'Headset', value: YES_NO[answerValue(answers, 'has_headset')] ?? '' },
    { label: 'Quiet workspace', value: YES_NO[answerValue(answers, 'has_quiet_workspace')] ?? '' },
    {
      label: 'Apploye',
      value: answers.apploye_download?.confirmed_at
        ? 'Downloaded. Tracked on productivity, including inactivity.'
        : '',
    },
  ].filter((row) => row.value);

  const availability: PdfSection['rows'] = [
    { label: 'Weekly hours', value: weeklyLabel(answerValue(answers, 'weekly_hours')) },
    { label: 'Days and hours', value: scheduleText(answerValue(answers, 'work_schedule')) },
    { label: 'Time off in 30 days', value: answerValue(answers, 'time_off_30') },
  ].filter((row) => row.value);

  const experience: PdfSection['rows'] = [
    { label: 'Years in sales or outbound', value: choiceList(answerValue(answers, 'years_sales'), YEARS_LABELS) },
    { label: 'Roles', value: choiceList(answerValue(answers, 'roles_held'), ROLE_LABELS) },
    { label: 'Industries', value: choiceList(answerValue(answers, 'industries_sold')) },
    { label: 'Verticals', value: choiceList(answerValue(answers, 'verticals_interest'), VERTICAL_LABELS) },
  ].filter((row) => row.value);

  const account: PdfSection['rows'] = [
    { label: 'Divine Acquisition login', value: answerValue(answers, 'da_login') },
  ].filter((row) => row.value);

  return [
    { heading: 'Who they are', rows: who },
    { heading: 'Divine Acquisition account', rows: account },
    { heading: 'Shift', rows: shift },
    { heading: 'Availability', rows: availability },
    { heading: 'Equipment', rows: equipment },
    { heading: 'Experience', rows: experience },
    { heading: 'Payout', rows: payout },
    { heading: 'Bank details', rows: bank },
  ].filter((section) => section.rows.length > 0);
}

function trainingLabel(value: string): string {
  if (value === 'yes_all_five') return 'Available all five training days';
  if (value === 'conflict') return 'Has a conflict';
  return value;
}

export type AirtableOperatorFields = {
  name: string;
  email: string;
  phone: string;
  timezone: string;
  shift: string;
  discord: string;
  city: string;
  bankLast4: string;
  notes: string;
};

/** Fields safe to copy into Airtable. The full account number is not one of them. */
export function airtableOperatorFields(input: {
  name: string;
  email: string;
  answers: OnboardingAnswers;
}): AirtableOperatorFields {
  const preferred = answerValue(input.answers, 'preferred_name');
  const legal = answerValue(input.answers, 'legal_name');
  const account = maskAccount(answerValue(input.answers, 'account_number'));
  const bank = answerValue(input.answers, 'bank_name');
  const payoutMethod = answerValue(input.answers, 'payout');
  const payoutLast4 = String(input.answers.payout?.last4 ?? '').trim();
  const payoutLabel = PAYOUT_ONBOARDING_LABELS[payoutMethod] ?? payoutMethod;
  const weekly = weeklyLabel(answerValue(input.answers, 'weekly_hours'));
  const schedule = scheduleText(answerValue(input.answers, 'work_schedule'));
  const notes = [
    legal && legal !== preferred ? `Legal name: ${legal}` : '',
    answerValue(input.answers, 'da_login') ? `Divine Acquisition login: ${answerValue(input.answers, 'da_login')}` : '',
    bank ? `Bank: ${bank}${account ? ` (${account})` : ''}` : '',
    payoutLabel ? `Payout: ${payoutLabel}${payoutLast4 ? `, ending ${payoutLast4}` : ''}` : '',
    weekly || schedule ? `Availability: ${[weekly, schedule].filter(Boolean).join('. ')}` : '',
    answerValue(input.answers, 'has_computer')
      ? `Equipment: laptop or desktop ${YES_NO[answerValue(input.answers, 'has_computer')] ?? ''}`
      : '',
    input.answers.apploye_download?.confirmed_at ? 'Apploye: downloaded. Productivity, including inactivity, is tracked.' : '',
    answerValue(input.answers, 'years_sales')
      ? `Experience: ${choiceList(answerValue(input.answers, 'years_sales'), YEARS_LABELS)}. Roles: ${choiceList(answerValue(input.answers, 'roles_held'), ROLE_LABELS)}. Verticals: ${choiceList(answerValue(input.answers, 'verticals_interest'), VERTICAL_LABELS)}.`
      : '',
    'Filed when the operator was placed.',
  ]
    .filter(Boolean)
    .join('\n');
  return {
    name: preferred || legal || input.name,
    email: answerValue(input.answers, 'email') || input.email,
    phone: answerValue(input.answers, 'whatsapp'),
    timezone: answerValue(input.answers, 'timezone'),
    shift: [weekly, schedule].filter(Boolean).join('. ') || shiftLabel(answerValue(input.answers, 'shift')),
    discord: answerValue(input.answers, 'discord').replace(/^@/, ''),
    city: answerValue(input.answers, 'city_country'),
    bankLast4: account,
    notes,
  };
}
