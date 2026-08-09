import { describe, expect, it } from 'vitest';
import { buildAgreementInviteEmail } from './email';

describe('buildAgreementInviteEmail', () => {
  it('uses Divine Acquisition branding and the tokenized talent signing URL', () => {
    const content = buildAgreementInviteEmail({
      recipientName: 'Malik Sannie',
      companyName: 'Divine Acquisition',
      templateName: 'VA Independent Contractor Agreement',
      signingUrl: 'https://talent.divineacquisition.io/s/abcd1234abcd1234abcd1234abcd1234',
    });

    expect(content.subject).toContain('Divine Acquisition');
    expect(content.subject).toContain('VA Independent Contractor Agreement');
    expect(content.subject).toMatch(/ready for your signature/i);
    expect(content.html).toContain('Divine Acquisition');
    expect(content.html).toContain('Review &amp; sign');
    expect(content.html).toContain('https://talent.divineacquisition.io/s/abcd1234abcd1234abcd1234abcd1234');
    expect(content.html).toContain('talent.divineacquisition.io');
    expect(content.html).not.toContain('novaracleaning');
    expect(content.html).not.toContain('docuseal.com/s/');
    expect(content.text).toContain('https://talent.divineacquisition.io/s/abcd1234abcd1234abcd1234abcd1234');
  });

  it('greets with full name when the first token is a single letter', () => {
    const content = buildAgreementInviteEmail({
      recipientName: 'A Sannie',
      companyName: 'Divine Acquisition',
      templateName: 'Operator Agreement',
      signingUrl: 'https://talent.divineacquisition.io/s/abcd1234abcd1234abcd1234abcd1234',
    });
    expect(content.html).toContain('Hi A Sannie,');
    expect(content.text).toContain('Hi A Sannie,');
  });
});
