import { describe, expect, it } from 'vitest';
import { signerFacingDescription } from './agreement-page';

describe('signerFacingDescription', () => {
  it('hides the DocuSeal sync placeholder', () => {
    expect(signerFacingDescription('Pulled from DocuSeal · Default')).toBeNull();
    expect(signerFacingDescription('Pulled from DocuSeal')).toBeNull();
    expect(signerFacingDescription('  pulled from docuseal · Contracts  ')).toBeNull();
  });

  it('keeps a description written for the signer', () => {
    expect(signerFacingDescription('Compensation, duties, and how the engagement ends.')).toBe(
      'Compensation, duties, and how the engagement ends.',
    );
    expect(signerFacingDescription('   ')).toBeNull();
    expect(signerFacingDescription(null)).toBeNull();
  });
});
