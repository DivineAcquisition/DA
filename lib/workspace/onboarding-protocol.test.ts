import { describe, expect, it } from 'vitest';
import { VA_SALES_OPERATOR_AGREEMENT, onboardingProtocolForTemplate } from './onboarding-protocol';

describe('onboardingProtocolForTemplate', () => {
  it('selects VA sales operator protocol for operator agreements', () => {
    expect(
      onboardingProtocolForTemplate({
        recipientType: 'operator',
        templateName: VA_SALES_OPERATOR_AGREEMENT.name,
      }),
    ).toBe('va_sales_operator');
  });
});
