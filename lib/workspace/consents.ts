/**
 * Consent gates shown on the tokenized operator signing page.
 * These must all be checked before the signature can be submitted.
 * Where a DocuSeal checkbox field matches a consent id/label, the value is
 * also written onto the document.
 */

export type ConsentItem = {
  id: string;
  label: string;
  /** Optional DocuSeal checkbox field names this consent should fill. */
  docusealFields?: string[];
};

export const OPERATOR_CONSENTS: ConsentItem[] = [
  {
    id: 'read_agreement',
    label:
      'I have read this agreement (including compensation, duties, and termination terms) and agree to be bound by it.',
    docusealFields: ['Agree to Terms', 'I Agree', 'Accept Agreement', 'Agreement Accepted'],
  },
  {
    id: 'independent_contractor',
    label:
      'I confirm I am engaging as an independent contractor / operator, not as an employee of Divine Acquisition.',
    docusealFields: ['Independent Contractor', 'Contractor Status', 'IC Acknowledgement'],
  },
  {
    id: 'accurate_info',
    label: 'The information I provide on this form is true and complete to the best of my knowledge.',
    docusealFields: ['Accuracy', 'Information Accurate', 'Certify Information'],
  },
  {
    id: 'esign_consent',
    label:
      'I consent to sign this agreement electronically. My electronic signature has the same legal effect as a handwritten signature.',
    docusealFields: ['E-Sign Consent', 'Electronic Signature Consent', 'ESIGN Consent'],
  },
];

export function consentsForRecipientType(type: string | null | undefined): ConsentItem[] {
  if (type === 'operator') return OPERATOR_CONSENTS;
  return [
    {
      id: 'read_agreement',
      label: 'I have read this agreement and agree to its terms.',
      docusealFields: ['Agree to Terms', 'I Agree', 'Accept Agreement'],
    },
    {
      id: 'esign_consent',
      label:
        'I consent to sign this agreement electronically. My electronic signature has the same legal effect as a handwritten signature.',
      docusealFields: ['E-Sign Consent', 'Electronic Signature Consent'],
    },
  ];
}
