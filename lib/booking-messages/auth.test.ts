import { describe, expect, it } from 'vitest';
import { adaptPayload } from './adapt';
import { bodySignature, webhookAuthorized } from './auth';

describe('booking webhook auth', () => {
  it('accepts the shared secret or a signature and rejects anything else', () => {
    const body = '{"type":"booked"}';
    const secret = 'shared-secret';
    expect(webhookAuthorized({ secretHeader: secret, signatureHeader: '', body, secret })).toBe(true);
    expect(
      webhookAuthorized({
        secretHeader: '',
        signatureHeader: bodySignature(body, secret),
        body,
        secret,
      }),
    ).toBe(true);
    expect(webhookAuthorized({ secretHeader: 'nope', signatureHeader: '', body, secret })).toBe(false);
    expect(webhookAuthorized({ secretHeader: secret, signatureHeader: '', body, secret: '' })).toBe(false);
  });

  it('translates a loose appointment payload into a normalized booking', () => {
    const adapted = adaptPayload({
      type: 'AppointmentCreate',
      appointment: {
        id: 'apt-1',
        startTime: '2026-10-15T18:00:00.000Z',
        endTime: '2026-10-15T18:30:00.000Z',
        address: 'https://meet.google.com/abc-defg-hij',
      },
      contact: { email: 'jordan@example.com', phone: '+12025550148', firstName: 'Jordan' },
    });
    expect(adapted.ok).toBe(true);
    if (adapted.ok) {
      expect(adapted.event.type).toBe('booked');
      expect(adapted.event.bookingId).toBe('apt-1');
      expect(adapted.event.meetingLink).toBe('https://meet.google.com/abc-defg-hij');
    }
  });
});
