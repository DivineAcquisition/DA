import { describe, expect, it } from 'vitest';
import { adSpendPoints, followUpPoints, programPricePoints } from '@/lib/calls/map';
import {
  MANUAL_REVIEW_MIN_SCORE,
  QUALIFIED_MIN_SCORE,
  inquiryPoints,
  qualificationFromScore,
  readinessScoreFromInputs,
  scoreQualification,
} from './score';

describe('workspace readiness score', () => {
  it('matches the Call Intelligence point table ($2-5k + Not sure + $2-5k = 52)', () => {
    const input = {
      monthlyAdSpend: '$2-5k',
      followUpOwner: 'Not sure',
      programPrice: '$2-5k',
    };
    expect(readinessScoreFromInputs(input)).toBe(52);
    expect(
      adSpendPoints(input.monthlyAdSpend) +
        followUpPoints(input.followUpOwner) +
        programPricePoints(input.programPrice),
    ).toBe(52);
  });

  it('scores a high-readiness founding install as Qualified', () => {
    const score = scoreQualification({
      monthlyAdSpend: '$5k+',
      followUpOwner: 'Dedicated setter',
      programPrice: '$5k+',
    });
    expect(score.readinessScore).toBe(85);
    expect(score.qualificationResult).toBe('Qualified');
  });

  it('uses inquiry volume in place of ad spend on the coach audit form', () => {
    expect(inquiryPoints(4)).toBe(0);
    expect(inquiryPoints(8)).toBe(10);
    expect(inquiryPoints(20)).toBe(25);
    expect(inquiryPoints(40)).toBe(35);
    const score = scoreQualification({
      monthlyAdSpend: '',
      followUpOwner: 'Founder',
      programPrice: '$5k+',
      inquiriesPerMonth: 20,
    });
    expect(score.readinessScore).toBe(65);
    expect(score.qualificationResult).toBe('Qualified');
  });

  it('uses the workspace 60 / 40 chips, not an Airtable formula dump', () => {
    expect(qualificationFromScore(QUALIFIED_MIN_SCORE)).toBe('Qualified');
    expect(qualificationFromScore(MANUAL_REVIEW_MIN_SCORE)).toBe('Manual Review');
    expect(qualificationFromScore(MANUAL_REVIEW_MIN_SCORE - 1)).toBe('Disqualified');
  });
});
