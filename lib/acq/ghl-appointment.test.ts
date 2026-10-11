import { describe, expect, it } from 'vitest';
import {
  ACQ_GHL_CALENDAR_ID,
  FREE_SALES_OPS_AUDIT_CALENDAR_ID,
  FREE_SALES_OPS_AUDIT_CALENDAR_NAME,
} from './config';
import { meetingLinkFromAppointment, salesOpsAppointmentBody } from './ghl-sms';

describe('Free Sales Ops Audit calendar', () => {
  it('books onto Free Sales Ops Audit | DivineACQ™', () => {
    expect(FREE_SALES_OPS_AUDIT_CALENDAR_NAME).toBe('Free Sales Ops Audit | DivineACQ™');
    expect(FREE_SALES_OPS_AUDIT_CALENDAR_ID).toBe('v0e24e3kxYEGCTUkSP4A');
    expect(ACQ_GHL_CALENDAR_ID).toBe(FREE_SALES_OPS_AUDIT_CALENDAR_ID);

    const body = salesOpsAppointmentBody({
      contactId: 'contact-1',
      title: `${FREE_SALES_OPS_AUDIT_CALENDAR_NAME} — Jordan Blake`,
      startsAt: '2026-10-15T18:00:00.000Z',
      endsAt: '2026-10-15T18:30:00.000Z',
    });

    expect(body.calendarId).toBe(FREE_SALES_OPS_AUDIT_CALENDAR_ID);
    expect(body.appointmentStatus).toBe('confirmed');
    expect(body.toNotify).toBe(false);
    expect(body.title).toBe('Free Sales Ops Audit | DivineACQ™ — Jordan Blake');
    expect(body.meetingLocationType).toBeUndefined();
  });

  it('keeps an https meeting link from the appointment and ignores anything else', () => {
    expect(meetingLinkFromAppointment({ address: 'https://meet.google.com/abc-defg-hij' })).toBe(
      'https://meet.google.com/abc-defg-hij',
    );
    expect(meetingLinkFromAppointment({ appointment: { address: 'https://zoom.us/j/1' } })).toBe('https://zoom.us/j/1');
    expect(meetingLinkFromAppointment({ address: 'phone' })).toBeNull();
  });
});
