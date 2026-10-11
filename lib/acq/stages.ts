import type { BookingStatus } from '@/lib/booking-messages/types';
import type { QualificationResult } from './qualify';

/**
 * The lead pipeline in order. The workspace lead, the Airtable Stage, the GHL
 * opportunity stage and the `lead - ...` tag all carry the same value.
 */
export const LEAD_STAGES = [
  'Step 1 Captured',
  'Application Abandoned',
  'Manual Review',
  'Qualified - Not Booked',
  'Audit Booked',
  'No Show',
  'Audit Held',
  'Closed Won',
  'Closed Lost',
  'Disqualified',
  'Recycled',
] as const;

export type LeadStage = (typeof LEAD_STAGES)[number];

export const CLOSED_STAGES = [
  'Closed Won',
  'Closed Lost',
  'Disqualified',
  'Recycled',
] as const;

export function isLeadStage(stage: string): stage is LeadStage {
  return (LEAD_STAGES as readonly string[]).includes(stage);
}

export function isClosedStage(stage: string): boolean {
  return (CLOSED_STAGES as readonly string[]).includes(stage);
}

export const STAGE_ADVANCE_TO_BOOKED = [
  'Step 1 Captured',
  'Application Abandoned',
  'Manual Review',
  'Qualified - Not Booked',
  'Audit Booked',
  'No Show',
] as const;

/** PostgREST `not.in` list. Quotes keep spaces in Closed Won / Closed Lost. */
export function closedStagesPostgrestIn(): string {
  return `(${CLOSED_STAGES.map((stage) => `"${stage}"`).join(',')})`;
}

/** Where a new application lands once it is scored. */
export function stageForQualification(result: QualificationResult | null | undefined): LeadStage {
  if (result === 'Qualified') return 'Qualified - Not Booked';
  if (result === 'Manual Review') return 'Manual Review';
  if (result === 'Disqualified') return 'Disqualified';
  return 'Step 1 Captured';
}

/**
 * The stage a booking event moves a lead to, or null to leave it. Closed leads
 * never move, a held audit is not undone by a later status, and a cancel only
 * steps back from Audit Booked.
 */
export function stageAfterBooking(current: string, status: BookingStatus): LeadStage | null {
  const from = current.trim();
  if (isClosedStage(from)) return null;
  let next: LeadStage | null = null;
  switch (status) {
    case 'booked':
    case 'rescheduled':
      next = from === 'Audit Held' ? null : 'Audit Booked';
      break;
    case 'held':
      next = 'Audit Held';
      break;
    case 'no_show':
      next = from === 'Audit Held' ? null : 'No Show';
      break;
    case 'cancelled':
      next = from === 'Audit Booked' || from === '' ? 'Qualified - Not Booked' : null;
      break;
  }
  return next === from ? null : next;
}

/** GHL opportunity status for a stage. */
export function opportunityStatus(stage: LeadStage): 'open' | 'won' | 'lost' | 'abandoned' {
  if (stage === 'Closed Won') return 'won';
  if (stage === 'Closed Lost' || stage === 'Disqualified') return 'lost';
  if (stage === 'Recycled') return 'abandoned';
  return 'open';
}
