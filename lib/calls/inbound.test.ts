import { describe, expect, it } from 'vitest';
import { inboundRecordInput, parseInboundCall } from './inbound';

const appointmentCreate = {
  type: 'AppointmentCreate',
  id: 'evt-not-the-appointment',
  appointment: {
    id: 'apt-1001',
    address: 'https://meet.google.com/aaa-bbbb-ccc',
    startTime: '2026-09-04T18:00:00.000Z',
    contactId: 'ghl-contact-9',
  },
  contact: {
    id: 'ghl-contact-9',
    email: 'Booked@Example.COM',
    name: 'Booked Prospect',
  },
};

describe('parseInboundCall', () => {
  it('reads a GHL AppointmentCreate, using appointment.id and Meet address', () => {
    const parsed = parseInboundCall(appointmentCreate);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.call.kind).toBe('booking');
    expect(parsed.call.source).toBe('ghl');
    expect(parsed.call.externalRef).toBe('apt-1001');
    expect(parsed.call.email).toBe('booked@example.com');
    expect(parsed.call.fullName).toBe('Booked Prospect');
    expect(parsed.call.meetUrl).toBe('https://meet.google.com/aaa-bbbb-ccc');
    expect(parsed.call.ghlContactId).toBe('ghl-contact-9');
    expect(parsed.call.occurredAt).toBe('2026-09-04T18:00:00.000Z');
  });

  it('keeps the same appointment id on create and update so upsert can merge them', () => {
    const created = parseInboundCall(appointmentCreate);
    const updated = parseInboundCall({
      ...appointmentCreate,
      type: 'AppointmentUpdate',
      id: 'evt-a-different-delivery',
      appointment: {
        ...appointmentCreate.appointment,
        recordingUrl: 'https://drive.google.com/file/d/rec1',
      },
    });
    expect(created.ok && updated.ok).toBe(true);
    if (!created.ok || !updated.ok) return;
    expect(updated.call.externalRef).toBe(created.call.externalRef);
    expect(updated.call.kind).toBe('booking');
    expect(updated.call.recordingUrl).toBe('https://drive.google.com/file/d/rec1');
  });

  it('ignores ContactCreate and other non-call GHL events', () => {
    const parsed = parseInboundCall({
      type: 'ContactCreate',
      contact: { id: 'ghl-contact-9', email: 'new@example.com', name: 'New' },
    });
    expect(parsed).toEqual({
      ok: false,
      reason: 'ignored',
      error: 'Not a call event (contactcreate).',
    });
  });

  it('maps the inbound call into the RPC row the door writes', () => {
    const parsed = parseInboundCall(appointmentCreate);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const row = inboundRecordInput(parsed.call, 'recbhuwRMsnk618TH');
    expect(row.airtableLeadId).toBe('recbhuwRMsnk618TH');
    expect(row.externalRef).toBe('apt-1001');
    expect(row.payload).toMatchObject({ ghl_contact_id: 'ghl-contact-9' });
  });
});
