import { describe, expect, it } from 'vitest';
import {
  airtableBookingFields,
  appendBookingNote,
  callSetupNote,
  mapAirtableRecord,
  mapProspectToCallSetup,
  prospectSearchFormula,
  sanitizeSearchQuery,
  shouldAdvanceStage,
} from './prospects';

const qualifiedRecord = {
  id: 'recsGCP9YvsZMeKmX',
  fields: {
    'Lead Name': 'Jordan Blake',
    Email: 'jordan@example.com',
    Phone: '555-201-8890',
    'Company Name': 'Blake Coaching',
    'Coaching Niche': 'Fitness',
    Stage: { id: 'selEhqUSzDFs2xVNc', name: 'Qualified - Not Booked' },
    'Qualification Result': 'Qualified',
    'Readiness Score': 100,
    'Monthly Ad Spend': { name: '$5k+' },
    'Follow-Up Owner': 'Dedicated setter',
    'Program Price': '$5k+',
    'Next Action': '🔴 CALL NOW - qualified, never contacted',
    Notes: 'Came in from the founding-install form.',
  },
};

describe('prospectSearchFormula', () => {
  it('defaults to qualified prospects who are not closed', () => {
    expect(prospectSearchFormula()).toBe(
      "AND({Qualification Result}='Qualified',NOT(OR({Stage}='Closed Won',{Stage}='Closed Lost',{Stage}='Disqualified',{Stage}='Recycled')))",
    );
  });

  it('optionally includes manual review and a name/email/company search', () => {
    const formula = prospectSearchFormula({
      query: "O'Brien fitness",
      includeManualReview: true,
    });
    expect(formula).toContain("OR({Qualification Result}='Qualified',{Qualification Result}='Manual Review')");
    expect(formula).toContain("FIND('o''brien fitness',LOWER({Lead Name}&''))");
    expect(formula).toContain("FIND('o''brien fitness',LOWER({Email}&''))");
    expect(formula).toContain("FIND('o''brien fitness',LOWER({Company Name}&''))");
  });

  it('lists booked audits without the qualification filter', () => {
    expect(prospectSearchFormula({ bookedOnly: true })).toBe("{Stage}='Audit Booked'");
  });

  it('strips curly braces so a search cannot inject formula', () => {
    expect(sanitizeSearchQuery("{Qualification Result}='Qualified'")).toBe(
      "Qualification Result ='Qualified'",
    );
  });
});

describe('mapAirtableRecord', () => {
  it('maps select objects and formulas onto call-setup fields', () => {
    const prospect = mapAirtableRecord(qualifiedRecord);
    expect(prospect.recordId).toBe('recsGCP9YvsZMeKmX');
    expect(prospect.fullName).toBe('Jordan Blake');
    expect(prospect.email).toBe('jordan@example.com');
    expect(prospect.companyName).toBe('Blake Coaching');
    expect(prospect.stage).toBe('Qualified - Not Booked');
    expect(prospect.qualificationResult).toBe('Qualified');
    expect(prospect.readinessScore).toBe(100);
    expect(prospect.monthlyAdSpend).toBe('$5k+');
    expect(prospect.airtableUrl).toContain('recsGCP9YvsZMeKmX');
    expect(prospect.briefing).toContain('Readiness 100 · Qualified');
    expect(prospect.briefing).toContain('Ad spend $5k+');
  });

  it('falls back to coaching niche when company is blank', () => {
    const prospect = mapAirtableRecord({
      id: 'recAAAAAAAAAAAAAAAA',
      fields: { 'Lead Name': 'Pat', 'Coaching Niche': 'B2B coaching' },
    });
    expect(prospect.companyName).toBe('B2B coaching');
  });
});

describe('mapProspectToCallSetup', () => {
  it('builds the calendar title, duration, and briefing note from the lead', () => {
    const setup = mapProspectToCallSetup(mapAirtableRecord(qualifiedRecord));
    expect(setup.summary).toBe('Lead Leak Audit — Jordan Blake (Blake Coaching)');
    expect(setup.durationMinutes).toBe(30);
    expect(setup.timeZone).toBe('America/New_York');
    expect(setup.note).toContain('Readiness 100 · Qualified');
    expect(setup.note).toContain('Ad spend $5k+');
    expect(setup.note).toContain('Follow-up Dedicated setter');
    expect(setup.description).toContain('jordan@example.com');
    expect(setup.description).toContain('Airtable:');
  });
});

describe('airtableBookingFields', () => {
  it('advances a bookable stage, stamps the date, and appends the Meet note', () => {
    const fields = airtableBookingFields({
      currentStage: 'Qualified - Not Booked',
      startsAtIso: '2026-08-27T18:00:00.000Z',
      timeZone: 'America/New_York',
      durationMinutes: 30,
      meetUrl: 'https://meet.google.com/abc-defg-hij',
      eventId: 'evt_123',
      existingNotes: 'Came in from the founding-install form.',
      email: 'jordan@example.com',
      existingEmail: 'jordan@example.com',
    });

    expect(fields.Stage).toBe('Audit Booked');
    expect(fields['Audit Booked Date']).toBe('2026-08-27');
    expect(fields['Google Meet URL']).toBe('https://meet.google.com/abc-defg-hij');
    expect(fields['Calendar Event ID']).toBe('evt_123');
    expect(fields.Notes).toContain('Came in from the founding-install form.');
    expect(fields.Notes).toContain('Meet: https://meet.google.com/abc-defg-hij');
    expect(fields.Email).toBeUndefined();
  });

  it('does not regress a later stage and writes a missing email', () => {
    expect(shouldAdvanceStage('Proposal Out')).toBe(false);
    const fields = airtableBookingFields({
      currentStage: 'Proposal Out',
      startsAtIso: '2026-08-27T18:00:00.000Z',
      timeZone: 'America/New_York',
      durationMinutes: 30,
      existingNotes: '',
      email: 'new@example.com',
      existingEmail: '',
    });
    expect(fields.Stage).toBeUndefined();
    expect(fields.Email).toBe('new@example.com');
  });

  it('appends a booking stamp onto existing notes', () => {
    expect(appendBookingNote('Prior', 'Next')).toBe('Prior\n\nNext');
    expect(appendBookingNote('  ', 'Next')).toBe('Next');
  });
});

describe('callSetupNote', () => {
  it('omits empty scoring lines', () => {
    const note = callSetupNote(
      mapAirtableRecord({
        id: 'recBBBBBBBBBBBBBBB',
        fields: { 'Lead Name': 'Pat', Stage: 'Qualified - Not Booked' },
      }),
    );
    expect(note).toBe('Stage: Qualified - Not Booked');
  });
});
