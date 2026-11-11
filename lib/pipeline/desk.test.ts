import { describe, expect, it } from 'vitest';
import { answersFromNote, bookingSummary, bookingTime, leadName, outcomeLabel, stageTone } from './desk';

describe('pipeline desk', () => {
  const now = new Date('2026-11-11T17:00:00Z');

  it('reads a booking in its own time zone', () => {
    expect(bookingTime('2026-11-13T20:00:00Z', 'America/Chicago')).toBe('Fri, Nov 13, 2:00 PM CT');
    expect(bookingSummary(null)).toEqual({ label: 'Not booked', tone: 'neutral' });
    expect(bookingSummary({ status: 'booked', starts_at: '2026-11-13T20:00:00Z', time_zone: 'America/Chicago' }, now)).toEqual({
      label: 'Booked Fri, Nov 13, 2:00 PM CT',
      tone: 'brand',
    });
    expect(bookingSummary({ status: 'booked', starts_at: '2026-11-10T20:00:00Z', time_zone: 'America/Chicago' }, now).tone).toBe('warn');
    expect(bookingSummary({ status: 'cancelled', starts_at: null, time_zone: null }, now).label).toBe('Cancelled');
  });

  it('names leads and labels stages and outcomes', () => {
    expect(leadName({ full_name: null, email: 'a@b.co', company: 'Acme' })).toBe('Acme');
    expect(stageTone('Audit Booked')).toBe('brand');
    expect(stageTone('Recycled')).toBe('neutral');
    expect(outcomeLabel('no_show')).toBe('They did not show');
  });
});

describe('answersFromNote', () => {
  it('splits note lines into label and answer pairs', () => {
    expect(answersFromNote('Page: sales operations review\nCompany: Acme\nfree text')).toEqual([
      ['Page', 'sales operations review'],
      ['Company', 'Acme'],
      ['Note', 'free text'],
    ]);
  });
});
