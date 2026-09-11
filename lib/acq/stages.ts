export const CLOSED_STAGES = [
  'Closed Won',
  'Closed Lost',
  'Disqualified',
  'Recycled',
] as const;

export function isClosedStage(stage: string): boolean {
  return (CLOSED_STAGES as readonly string[]).includes(stage);
}

export const STAGE_ADVANCE_TO_BOOKED = [
  'Step 1 Captured',
  'Application Abandoned',
  'Manual Review',
  'Qualified - Not Booked',
  'Audit Booked',
] as const;

/** PostgREST `not.in` list. Quotes keep spaces in Closed Won / Closed Lost. */
export function closedStagesPostgrestIn(): string {
  return `(${CLOSED_STAGES.map((stage) => `"${stage}"`).join(',')})`;
}
