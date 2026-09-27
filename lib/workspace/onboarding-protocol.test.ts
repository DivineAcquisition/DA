import { describe, expect, it } from 'vitest';
import { onboardingProtocolForTemplate } from './onboarding-protocol';

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
