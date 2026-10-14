/**
 * Turns a finished sales-operator onboarding form into the sections of the
 * placement packet, and into the Airtable fields that may leave this system.
 * The full account number stays in the PDF. Airtable receives the last four
 * digits only.
 */

import type { PdfSection } from './branded-pdf';

export type OnboardingAnswers = Record<string, { value?: string; label?: string; access?: string; confirmed_at?: string }>;

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

  return [
    { heading: 'Who they are', rows: who },
    { heading: 'Shift', rows: shift },
    { heading: 'Bank details', rows: bank },
  ];
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
  const notes = [
    legal && legal !== preferred ? `Legal name: ${legal}` : '',
    bank ? `Bank: ${bank}${account ? ` (${account})` : ''}` : '',
    'Filed when the operator was placed.',
  ]
    .filter(Boolean)
    .join('\n');
  return {
    name: preferred || legal || input.name,
    email: answerValue(input.answers, 'email') || input.email,
    phone: answerValue(input.answers, 'whatsapp'),
    timezone: answerValue(input.answers, 'timezone'),
    shift: shiftLabel(answerValue(input.answers, 'shift')),
    discord: answerValue(input.answers, 'discord').replace(/^@/, ''),
    city: answerValue(input.answers, 'city_country'),
    bankLast4: account,
    notes,
  };
}
