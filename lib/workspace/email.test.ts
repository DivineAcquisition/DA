import { describe, expect, it } from 'vitest';
import { buildAgreementInviteEmail } from './email';

describe('buildAgreementInviteEmail', () => {
  it('uses Divine Acquisition branding and the tokenized DA signing URL', () => {
    const content = buildAgreementInviteEmail({
      recipientName: 'Malik Sannie',
      companyName: 'Divine Acquisition',
      templateName: 'VA Independent Contractor Agreement',
      signingUrl: 'https://admin.divineacquisition.io/s/abcd1234abcd1234abcd1234abcd1234',
    });

    expect(content.subject).toContain('Divine Acquisition');
    expect(content.subject).toContain('VA Independent Contractor Agreement');
    expect(content.html).toContain('Divine Acquisition');
    expect(content.html).toContain('https://admin.divineacquisition.io/s/abcd1234abcd1234abcd1234abcd1234');
    expect(content.html).not.toContain('novaracleaning');
    expect(content.html).not.toContain('docuseal.com/s/');
    expect(content.text).toContain('https://admin.divineacquisition.io/s/abcd1234abcd1234abcd1234abcd1234');
  });
});
