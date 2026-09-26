import { describe, expect, it } from 'vitest';
import {
  VA_SALES_OPERATOR_ONBOARDING,
  getOnboardingProtocol,
  onboardingProtocolForTemplate,
  validateOnboardingAnswers,
} from './onboarding-protocol';

describe('onboardingProtocolForTemplate', () => {
  it('selects VA sales operator protocol for operator agreements', () => {
    expect(
      onboardingProtocolForTemplate({
        recipientType: 'operator',
        templateName: 'DA | Sales Operator (Placement Role)',
      }),
    ).toBe('va_sales_operator');
  });
});

describe('validateOnboardingAnswers', () => {
  const base: Record<string, string> = {
    legal_name: 'Martin Matthew Locsin',
    preferred_name: 'Martin',
    email: 'locsin.matthew21@gmail.com',
    whatsapp: '+639171234567',
    discord: 'martin',
    city_country: 'Manila, Philippines',
    timezone: 'Asia/Manila',
    shift: '9am_530pm_est',
    training_availability: 'yes_all_five',
    bank_name: 'BDO Unibank',
    account_number: '1234567890',
    account_number_confirm: '1234567890',
    confirm_training_unpaid: 'true',
    confirm_shift_commitment: 'true',
    confirm_agreement_read: 'true',
    confirm_accuracy: 'true',
  };

  it('accepts a complete operator onboarding payload', () => {
    expect(validateOnboardingAnswers(VA_SALES_OPERATOR_ONBOARDING, base)).toEqual({ ok: true });
  });

  it('rejects mismatched account numbers', () => {
    const result = validateOnboardingAnswers(VA_SALES_OPERATOR_ONBOARDING, {
      ...base,
      account_number_confirm: '999',
    });
    expect(result.ok).toBe(false);
  });

  it('requires conflict details only when conflict is selected', () => {
    expect(
      validateOnboardingAnswers(VA_SALES_OPERATOR_ONBOARDING, {
        ...base,
        training_availability: 'conflict',
      }).ok,
    ).toBe(true);
  });
});

describe('protocolFromStoredSteps', () => {
  const stored = {
    key: 'standard_operator',
    name: 'Standard Operator Onboarding',
    description: '',
    steps: [
      { key: 'sop_reviewed', label: 'I have reviewed the operator SOP.', kind: 'acknowledgment' as const, help: null, options: null, required: true, asset: { title: 'Operator SOP', url: 'https://drive.google.com/x' } },
      { key: 'tool_access_granted', label: 'Tool access has been granted.', kind: 'credential_handoff' as const, help: null, options: ['GHL', 'Discord', 'Vistrial'], required: true, asset: null },
      { key: 'notes', label: 'Anything we should know?', kind: 'form_question' as const, help: null, options: null, required: false, asset: null },
    ],
  };

  it('renders confirmations as checkboxes and questions as text, in order', () => {
    const protocol = getOnboardingProtocol('standard_operator', stored);
    const fields = protocol?.sections[0].fields ?? [];
    expect(fields.map((f) => [f.id, f.type])).toEqual([
      ['sop_reviewed', 'checkbox'],
      ['tool_access_granted', 'checkbox'],
      ['notes', 'textarea'],
    ]);
    expect(fields[0].link).toEqual({ href: 'https://drive.google.com/x', label: 'Operator SOP' });
    expect(fields[1].help).toContain('GHL, Discord, Vistrial');
  });

  it('requires every required confirmation before submitting', () => {
    const protocol = getOnboardingProtocol('standard_operator', stored)!;
    expect(validateOnboardingAnswers(protocol, { sop_reviewed: 'true' }).ok).toBe(false);
    expect(
      validateOnboardingAnswers(protocol, { sop_reviewed: 'true', tool_access_granted: 'true' }).ok,
    ).toBe(true);
  });

  it('does not resolve a stored protocol under a different key', () => {
    expect(getOnboardingProtocol('something_else', stored)).toBeNull();
  });
});
