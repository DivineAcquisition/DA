import { describe, expect, it } from 'vitest';
import {
  VA_SALES_OPERATOR_ONBOARDING,
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
