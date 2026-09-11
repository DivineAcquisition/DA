import { describe, expect, it } from 'vitest';
import {
  isBookableLead,
  leadMatchesQuery,
  leadWriteFromQualification,
  mapStoredLead,
  sanitizeLikeQuery,
} from './leads';
import { parseQualification } from './qualify';
import { scoreQualification } from './score';
import { closedStagesPostgrestIn, isClosedStage } from './stages';

const payload = parseQualification({
  fullName: 'Jordan Blake',
  email: 'jordan@example.com',
  phone: '555-201-8890',
  companyName: 'Blake Coaching',
  adSpend: '$5k+',
  followUp: 'Dedicated setter',
  programPrice: '$5k+',
});

describe('workspace lead helpers', () => {
  it('strips like-injection characters from search', () => {
    expect(sanitizeLikeQuery('Jordan%,_Blake')).toBe('Jordan Blake');
    expect(sanitizeLikeQuery('{Qualification Result}')).toBe('Qualification Result');
  });

  it('matches name, email, company, phone, and niche', () => {
    const row = mapStoredLead({
      id: '11111111-1111-4111-8111-111111111111',
      full_name: 'Jordan Blake',
      email: 'jordan@example.com',
      phone: '555-201-8890',
      company_name: 'Blake Coaching',
      coaching_niche: 'Fitness',
    });
    expect(leadMatchesQuery(row, 'blake')).toBe(true);
    expect(leadMatchesQuery(row, 'jordan@')).toBe(true);
    expect(leadMatchesQuery(row, 'fitness')).toBe(true);
    expect(leadMatchesQuery(row, 'nope')).toBe(false);
  });

  it('treats Qualified open-stage leads as bookable and skips closed stages', () => {
    expect(
      isBookableLead({ qualification_result: 'Qualified', stage: 'Step 1 Captured' }),
    ).toBe(true);
    expect(
      isBookableLead({ qualification_result: 'Manual Review', stage: 'Manual Review' }),
    ).toBe(false);
    expect(
      isBookableLead(
        { qualification_result: 'Manual Review', stage: 'Manual Review' },
        true,
      ),
    ).toBe(true);
    expect(
      isBookableLead({ qualification_result: 'Qualified', stage: 'Closed Won' }),
    ).toBe(false);
    expect(
      isBookableLead({ qualification_result: 'Disqualified', stage: 'Step 1 Captured' }),
    ).toBe(false);
  });

  it('excludes closed stages in the PostgREST filter so high-score Closed Won rows do not fill the page', () => {
    expect(closedStagesPostgrestIn()).toBe(
      '("Closed Won","Closed Lost","Disqualified","Recycled")',
    );
    expect(isClosedStage('Closed Won')).toBe(true);
    expect(isClosedStage('Qualified - Not Booked')).toBe(false);
  });

  it('writes in-app score onto the workspace row, not an Airtable formula', () => {
    const score = scoreQualification(payload);
    const write = leadWriteFromQualification(payload, { ghlContactId: 'ghl_123', score });
    expect(write.email).toBe('jordan@example.com');
    expect(write.ghl_contact_id).toBe('ghl_123');
    expect(write.readiness_score).toBe(85);
    expect(write.qualification_result).toBe('Qualified');
    expect(write.stage).toBe('Step 1 Captured');
  });

  it('keeps an existing GHL contact id when the incoming value is blank', () => {
    const existing = mapStoredLead({
      id: '11111111-1111-4111-8111-111111111111',
      email: 'jordan@example.com',
      ghl_contact_id: 'ghl_keep',
      stage: 'Qualified - Not Booked',
    });
    const score = scoreQualification(payload);
    const write = leadWriteFromQualification(payload, {
      ghlContactId: '',
      score,
      existing,
    });
    expect(write.ghl_contact_id).toBe('ghl_keep');
    expect(write.stage).toBe('Qualified - Not Booked');
  });
});
