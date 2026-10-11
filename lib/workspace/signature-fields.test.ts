import { crc32, deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  CONSENTS_REQUIRED,
  INITIALS_REQUIRED,
  SIGNATURE_FIELD_MISSING,
  SIGNATURE_IMAGE_INVALID,
  catalogueFromSigningPayload,
  collectSignFields,
  planSignaturePlacement,
  readSignaturePng,
  signSlot,
} from './signature-fields';

const CLIENT_CONSENTS = ['read_agreement', 'esign_consent'];

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([length, body, checksum]);
}

function solidPng(width: number, height: number): string {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const index = row + 1 + x * 4;
      raw[index] = 20;
      raw[index + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${png.toString('base64')}`;
}

const SIGNATURE = solidPng(64, 32);
const INITIALS = solidPng(32, 32);
const TINY = solidPng(1, 1);

const operatorParties = [
  { name: 'Operator', uuid: 'op' },
  { name: 'Divine Acquisition', uuid: 'co' },
];

const operatorFields = [
  { name: 'Signature', type: 'signature', submitter_uuid: 'op' },
  { name: 'Contractor Signature', type: 'signature', submitter_uuid: 'op' },
  { name: 'Initials', type: 'initials', submitter_uuid: 'op' },
  { name: 'Company Signature', type: 'signature', submitter_uuid: 'co' },
  { name: 'Operator initials', type: 'text', submitter_uuid: 'op' },
  { name: 'Signature Date', type: 'date', submitter_uuid: 'op' },
  { name: 'I Agree', type: 'checkbox', submitter_uuid: 'op' },
  { name: 'I Agree', type: 'text', submitter_uuid: 'op' },
];

describe('sign slots', () => {
  it('keeps signature images and leaves dates, printed names, and the company line alone', () => {
    expect(signSlot({ name: 'Signature Date', type: 'date' })).toBeNull();
    expect(signSlot({ name: 'Operator initials', type: 'text' })).toBeNull();
    expect(signSlot({ name: 'Signature' })).toBe('signature');
    expect(signSlot({ name: 'Initials', type: 'initials' })).toBe('initials');

    expect(
      collectSignFields({
        fields: operatorFields,
        submitters: operatorParties,
        recipientType: 'operator',
      }),
    ).toEqual({
      signature: ['Signature', 'Contractor Signature'],
      initials: ['Initials'],
    });
  });

  it('drops a company signature that is not assigned to the operator', () => {
    const slots = collectSignFields({
      fields: [
        { name: 'Signature', type: 'signature' },
        { name: 'Company Signature', type: 'signature' },
      ],
      submitters: operatorParties,
      recipientType: 'operator',
    });
    expect(slots.signature).toEqual(['Signature']);
  });
});

describe('signature images', () => {
  it('accepts a real PNG and rejects anything else', () => {
    const accepted = readSignaturePng(`  ${SIGNATURE}  `);
    expect(accepted.ok).toBe(true);
    if (accepted.ok) expect(accepted.dataUrl.startsWith('data:image/png;base64,')).toBe(true);

    expect(readSignaturePng(TINY).ok).toBe(false);
    expect(readSignaturePng('data:image/svg+xml;base64,PHN2Zy8+').ok).toBe(false);
    expect(readSignaturePng(`${SIGNATURE.slice(0, 40)} ${SIGNATURE.slice(40)}`).ok).toBe(false);
    expect(readSignaturePng(`data:image/png;base64,${'A'.repeat(450_000)}`).ok).toBe(false);
  });
});

describe('placing a signature on the agreement', () => {
  const base = {
    fields: operatorFields,
    submitters: operatorParties,
    recipientType: 'operator' as const,
    signatureImage: SIGNATURE,
    initialsImage: INITIALS,
    consentIds: ['read_agreement', 'independent_contractor', 'accurate_info', 'esign_consent'],
  };

  it('pastes one signature onto every signature line and does not keep the image', () => {
    const plan = planSignaturePlacement(base);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;

    const signatures = plan.fields.filter((field) => field.name === 'Signature' || field.name === 'Contractor Signature');
    expect(signatures).toHaveLength(2);
    expect(signatures[0].default_value).toBe(signatures[1].default_value);
    expect(String(signatures[0].default_value).startsWith('data:image/png;base64,')).toBe(true);
    expect(plan.fields.some((field) => field.name === 'Company Signature')).toBe(false);
    expect(plan.fields.some((field) => field.name === 'Operator initials')).toBe(false);
    expect(plan.fields.find((field) => field.name === 'Initials')?.default_value).not.toBe(signatures[0].default_value);
    expect(plan.fields.find((field) => field.name === 'I Agree')).toEqual({
      name: 'I Agree',
      default_value: true,
      readonly: true,
    });
    expect(plan.stored.Signature).toBe('[signature]');
    expect(plan.stored.Initials).toBe('[signature]');
    expect(plan.stored['I Agree']).toBe('true');
    expect(JSON.stringify(plan.stored)).not.toContain('data:image');
  });

  it('refuses to sign until the initials and every consent are present', () => {
    const missingInitials = planSignaturePlacement({ ...base, initialsImage: '' });
    const missingConsents = planSignaturePlacement({ ...base, consentIds: CLIENT_CONSENTS });
    const badImage = planSignaturePlacement({ ...base, signatureImage: 'nope' });
    expect(missingInitials.ok).toBe(false);
    expect(missingConsents.ok).toBe(false);
    expect(badImage.ok).toBe(false);
    if (!missingInitials.ok) expect(missingInitials.error).toBe(INITIALS_REQUIRED);
    if (!missingConsents.ok) expect(missingConsents.error).toBe(CONSENTS_REQUIRED);
    if (!badImage.ok) expect(badImage.error).toBe(SIGNATURE_IMAGE_INVALID);
  });

  it('stops when the template has no signature line', () => {
    const plan = planSignaturePlacement({
      ...base,
      fields: [{ name: 'Full Name', type: 'text' }],
      consentIds: CLIENT_CONSENTS,
      recipientType: 'client',
    });
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.error).toBe(SIGNATURE_FIELD_MISSING);
  });
});

describe('signing page payload', () => {
  it('reads the submitter and the template fields', () => {
    const catalogue = catalogueFromSigningPayload({
      agreement: { docuseal_submitter_id: 44, docuseal_submission_id: 'sub-1' },
      recipient: { recipient_type: 'client' },
      template: {
        docuseal_template_id: '4001',
        docuseal_fields: JSON.stringify([{ name: 'Signature', type: 'signature' }]),
        docuseal_submitters: [{ name: 'Client', uuid: 'cl' }],
      },
    });
    expect(catalogue).toMatchObject({
      submitterId: '44',
      submissionId: 'sub-1',
      templateId: '4001',
      recipientType: 'client',
    });
    expect(catalogue?.fields).toEqual([{ name: 'Signature', type: 'signature', required: false, submitter_uuid: undefined }]);
  });

  it('ignores a payload that is not a signing page', () => {
    expect(catalogueFromSigningPayload(null)).toBeNull();
    expect(catalogueFromSigningPayload({ unavailable: 'link_expired' })).toBeNull();
  });
});
