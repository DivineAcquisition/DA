/**
 * Which onboarding protocol an agreement send starts. The protocols
 * themselves (steps, wording, order) live in da_onboarding_protocol and
 * da_onboarding_protocol_step; the public page reads them from there only.
 */

export const VA_SALES_OPERATOR_ONBOARDING_KEY = 'va_sales_operator';

/**
 * DocuSeal template signed inside VA onboarding. The public form slug is the
 * embed target; the API key stays in Settings or DOCUSEAL_API_KEY.
 */
export const VA_SALES_OPERATOR_AGREEMENT = {
  name: 'DA | Sales Operator (Placement Role)',
  docusealTemplateId: '5332248',
  embedSrc: 'https://docuseal.com/d/s2vc7eK7pX3rrN',
  signerRole: 'Operator',
} as const;

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
