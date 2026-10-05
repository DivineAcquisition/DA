import { describe, expect, it } from 'vitest';
import { buildApplicationAlertEmail, applicationNotifyTo } from './application-email';
import { parseQualification } from './qualify';

const payload = parseQualification({
  fullName: 'Jordan Blake',
  email: 'jordan@example.com',
  companyName: 'Blake Coaching',
  offer: 'A 12-week coaching program',
  inquiriesPerMonth: '20',
  followUp: 'Founder',
  programPrice: '$5k+',
});

describe('application alert email', () => {
  it('goes to Malik and includes the application', () => {
    expect(applicationNotifyTo()).toBe('malik@divineacquisition.io');
    const mail = buildApplicationAlertEmail({
      payload,
      ghlContactId: 'ghl_123',
      airtableRecordId: 'rec_123',
    });
    expect(mail.subject).toBe('New application: Jordan Blake');
    expect(mail.text).toContain('jordan@example.com');
    expect(mail.text).toContain('A 12-week coaching program');
    expect(mail.text).toContain('Inquiries per month: 20');
    expect(mail.text).toContain('ghl_123');
    expect(mail.text).toContain('rec_123');
    expect(mail.html).toContain('New application');
  });
});
