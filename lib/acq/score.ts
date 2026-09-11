import type { QualificationPayload, QualificationResult } from './qualify';

/**
 * Readiness points. Same table as `lib/calls/map.ts` (Call Intelligence).
 * Duplicated here so the acquisition pipeline does not import the calls mapper
 * (that module pulls Airtable URL helpers and would cycle through prospects).
 *
 * Buckets are the workspace chips: 60+ Qualified, 40–59 Manual Review, else
 * Disqualified. Airtable may still compute its own formula on the destination
 * row; the workspace does not read that formula back.
 */
export const QUALIFIED_MIN_SCORE = 60;
export const MANUAL_REVIEW_MIN_SCORE = 40;

export function adSpendPoints(value: string): number {
  if (value === '$5k+') return 35;
  if (value === '$2-5k') return 25;
  if (value === 'Under $2k') return 10;
  return 0;
}

export function followUpPoints(value: string): number {
  if (value === 'Dedicated setter') return 30;
  if (value === 'Founder') return 20;
  if (value === 'Not sure') return 15;
  if (value === 'Nobody') return 12;
  return 0;
}

export function programPricePoints(value: string): number {
  if (value === '$5k+') return 20;
  if (value === '$2-5k') return 12;
  return 0;
}

export function readinessScoreFromInputs(input: {
  monthlyAdSpend: string;
  followUpOwner: string;
  programPrice: string;
}): number {
  return (
    adSpendPoints(input.monthlyAdSpend) +
    followUpPoints(input.followUpOwner) +
    programPricePoints(input.programPrice)
  );
}

export function qualificationFromScore(score: number): QualificationResult {
  if (score >= QUALIFIED_MIN_SCORE) return 'Qualified';
  if (score >= MANUAL_REVIEW_MIN_SCORE) return 'Manual Review';
  return 'Disqualified';
}

export type WorkspaceScore = {
  readinessScore: number;
  qualificationResult: QualificationResult;
};

export function scoreQualification(
  payload: Pick<QualificationPayload, 'monthlyAdSpend' | 'followUpOwner' | 'programPrice'>,
): WorkspaceScore {
  const readinessScore = readinessScoreFromInputs({
    monthlyAdSpend: payload.monthlyAdSpend,
    followUpOwner: payload.followUpOwner,
    programPrice: payload.programPrice,
  });
  return {
    readinessScore,
    qualificationResult: qualificationFromScore(readinessScore),
  };
}
