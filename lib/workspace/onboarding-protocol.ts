/**
 * VA Sales Operator onboarding protocol — shown after the placement agreement
 * is signed. Field schema drives the public /o/[token] form.
 */

export type OnboardingFieldType =
  | 'text'
  | 'email'
  | 'phone'
  | 'textarea'
  | 'select'
  | 'single_select'
  | 'checkbox';

export type OnboardingField = {
  id: string;
  label: string;
  type: OnboardingFieldType;
  required: boolean;
  help?: string;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  link?: { href: string; label: string };
  /** Show only when another field matches one of these values. */
  showWhen?: { fieldId: string; values: string[] };
};

export type OnboardingSection = {
  id: string;
  title: string;
  intro?: string;
  fields: OnboardingField[];
};

export type OnboardingProtocol = {
  key: string;
  title: string;
  intro: string;
  sections: OnboardingSection[];
};

export const VA_SALES_OPERATOR_ONBOARDING_KEY = 'va_sales_operator';

const TIMEZONE_OPTIONS = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Toronto', label: 'Toronto' },
  { value: 'America/Sao_Paulo', label: 'São Paulo' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Berlin', label: 'Central Europe' },
  { value: 'Africa/Lagos', label: 'Lagos (WAT)' },
  { value: 'Africa/Johannesburg', label: 'Johannesburg (SAST)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'Asia/Manila', label: 'Manila (PHT)' },
  { value: 'Asia/Singapore', label: 'Singapore' },
  { value: 'Asia/Tokyo', label: 'Tokyo' },
  { value: 'Australia/Sydney', label: 'Sydney' },
  { value: 'Pacific/Auckland', label: 'Auckland' },
];

export const VA_SALES_OPERATOR_ONBOARDING: OnboardingProtocol = {
  key: VA_SALES_OPERATOR_ONBOARDING_KEY,
  title: 'VA Sales Operator Onboarding Protocol',
  intro:
    'This form takes about five minutes. Everything here is used to set up your training and your placement, so answer accurately. If something is wrong we will be chasing it on your first day instead of training you.',
  sections: [
    {
      id: 'who',
      title: 'Section 1 — Who you are',
      fields: [
        {
          id: 'legal_name',
          label: 'Legal name, exactly as it appears on your ID',
          type: 'text',
          required: true,
          placeholder: 'Full legal name',
        },
        {
          id: 'preferred_name',
          label: 'Preferred name',
          type: 'text',
          required: true,
          help: 'What we will call you day to day.',
          placeholder: 'Preferred name',
        },
        {
          id: 'email',
          label: 'Email address',
          type: 'email',
          required: true,
          help: 'This is where your Drive folder and calendar invites go. Use the one you check.',
        },
        {
          id: 'whatsapp',
          label: 'WhatsApp number, with country code',
          type: 'phone',
          required: true,
          help: 'Used for urgent contact only.',
          placeholder: '+63…',
        },
        {
          id: 'discord',
          label: 'Discord handle',
          type: 'text',
          required: true,
          help: 'Our team communication runs on Discord. Create an account if you do not have one.',
          placeholder: 'username',
          link: { href: 'https://discord.com/register', label: 'Create a Discord account' },
        },
        {
          id: 'city_country',
          label: 'City and country',
          type: 'text',
          required: true,
          placeholder: 'Manila, Philippines',
        },
        {
          id: 'timezone',
          label: 'Your timezone',
          type: 'select',
          required: true,
          options: TIMEZONE_OPTIONS,
        },
      ],
    },
    {
      id: 'shift',
      title: 'Section 2 — Your shift',
      fields: [
        {
          id: 'shift',
          label:
            'Select a shift that aligns with you (shift may change slightly based on the client’s timezone)',
          type: 'single_select',
          required: true,
          options: [
            { value: '9am_530pm_est', label: '9AM – 5:30PM EST' },
            { value: '10am_630pm_est', label: '10AM – 6:30PM EST' },
            { value: '8am_430pm_est', label: '8AM – 4:30PM EST' },
          ],
        },
        {
          id: 'training_availability',
          label: 'Are you available for all five training days?',
          type: 'single_select',
          required: true,
          options: [
            { value: 'yes_all_five', label: 'Yes, all five days' },
            { value: 'conflict', label: 'No, I have a conflict (explain below)' },
          ],
        },
        {
          id: 'training_conflict',
          label: 'If you have a conflict, tell us which day and why',
          type: 'textarea',
          required: false,
          showWhen: { fieldId: 'training_availability', values: ['conflict'] },
          placeholder: 'Day + reason',
        },
      ],
    },
    {
      id: 'bank',
      title: 'Section 3 — Bank details',
      fields: [
        {
          id: 'bank_name',
          label: 'Bank name, in full',
          type: 'text',
          required: true,
          help: 'Write the full official name, not an abbreviation.',
        },
        {
          id: 'account_number',
          label: 'Account number',
          type: 'text',
          required: true,
          help: 'Enter it once, carefully, with no spaces or dashes.',
        },
        {
          id: 'account_number_confirm',
          label: 'Confirm account number',
          type: 'text',
          required: true,
          help: 'Type it again rather than copying and pasting.',
        },
      ],
    },
    {
      id: 'confirmations',
      title: 'Section 4 — Confirmations',
      intro: 'Tick each to confirm you have read and understood it.',
      fields: [
        {
          id: 'confirm_training_unpaid',
          label:
            'Training is unpaid. It runs approximately five days. During training I am learning, not working. I will not handle any real customer, and I understand no payment is owed for this time. I am paid from the start date of my first placement.',
          type: 'checkbox',
          required: true,
        },
        {
          id: 'confirm_shift_commitment',
          label:
            'My shift is a commitment. I will be reachable and working the queue for my full scheduled hours. If I cannot make a shift, I will notify Divine Acquisition before it begins, not during or after.',
          type: 'checkbox',
          required: true,
        },
        {
          id: 'confirm_agreement_read',
          label:
            'I have read and signed the Operator Placement Agreement. I understand the response standard, the escalation rules, how commission is earned, and the confidentiality and non-circumvention terms.',
          type: 'checkbox',
          required: true,
        },
        {
          id: 'confirm_accuracy',
          label: 'Everything I have entered on this form is accurate.',
          type: 'checkbox',
          required: true,
        },
      ],
    },
  ],
};

export function getOnboardingProtocol(key: string): OnboardingProtocol | null {
  if (key === VA_SALES_OPERATOR_ONBOARDING_KEY) return VA_SALES_OPERATOR_ONBOARDING;
  return null;
}

/** Protocols that should be minted when sending an operator agreement. */
export function onboardingProtocolForTemplate(input: {
  recipientType?: string | null;
  templateName?: string | null;
}): string | null {
  const type = (input.recipientType ?? '').toLowerCase();
  const name = (input.templateName ?? '').toLowerCase();
  if (type === 'operator' || name.includes('operator') || name.includes('sales operator')) {
    return VA_SALES_OPERATOR_ONBOARDING_KEY;
  }
  return null;
}

export function validateOnboardingAnswers(
  protocol: OnboardingProtocol,
  answers: Record<string, string>,
): { ok: true } | { ok: false; error: string } {
  for (const section of protocol.sections) {
    for (const field of section.fields) {
      if (field.showWhen) {
        const controlling = answers[field.showWhen.fieldId] ?? '';
        if (!field.showWhen.values.includes(controlling)) continue;
      }

      const raw = (answers[field.id] ?? '').trim();
      if (field.type === 'checkbox') {
        if (field.required && raw !== 'true') {
          return { ok: false, error: `Please confirm: ${field.label.slice(0, 80)}…` };
        }
        continue;
      }
      if (field.required && !raw) {
        return { ok: false, error: `Please complete: ${field.label}` };
      }
      if (field.type === 'email' && raw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
        return { ok: false, error: 'Enter a valid email address.' };
      }
    }
  }

  const account = (answers.account_number ?? '').replace(/[\s-]/g, '');
  const confirm = (answers.account_number_confirm ?? '').replace(/[\s-]/g, '');
  if (account && confirm && account !== confirm) {
    return { ok: false, error: 'Account numbers do not match. Type the confirmation carefully.' };
  }

  return { ok: true };
}
