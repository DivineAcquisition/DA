import { describe, expect, it } from 'vitest';
import { agreementPdfFilename, previewDocumentUrl } from './agreement-preview-url';

describe('agreement preview', () => {
  it('names the download from the template', () => {
    expect(agreementPdfFilename('Independent Contractor Agreement')).toBe(
      'Independent Contractor Agreement.pdf',
    );
    expect(agreementPdfFilename('Already.pdf')).toBe('Already.pdf');
    expect(agreementPdfFilename('  bad/name  ')).toBe('badname.pdf');
  });

  it('only fetches an https document', () => {
    expect(previewDocumentUrl('https://docuseal.com/file/hash/agreement.pdf')).toBe(
      'https://docuseal.com/file/hash/agreement.pdf',
    );
    expect(previewDocumentUrl('http://docuseal.com/file.pdf')).toBeNull();
    expect(previewDocumentUrl('not a url')).toBeNull();
  });
});
