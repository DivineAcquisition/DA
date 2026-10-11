import { describe, expect, it } from 'vitest';
import { pickPipeline, pipelineStageId, type GhlPipeline } from './ghl-lifecycle';
import { GHL_CONTACT_FIELDS } from './ghl-fields';
import { LEAD_STAGES, opportunityStatus, stageAfterBooking, stageForQualification } from './stages';

describe('lead stages', () => {
  it('lands a scored application on its stage', () => {
    expect(stageForQualification('Qualified')).toBe('Qualified - Not Booked');
    expect(stageForQualification('Manual Review')).toBe('Manual Review');
    expect(stageForQualification('Disqualified')).toBe('Disqualified');
    expect(stageForQualification(null)).toBe('Step 1 Captured');
  });

  it('moves a lead through booking statuses', () => {
    expect(stageAfterBooking('Qualified - Not Booked', 'booked')).toBe('Audit Booked');
    expect(stageAfterBooking('', 'booked')).toBe('Audit Booked');
    expect(stageAfterBooking('Audit Booked', 'rescheduled')).toBeNull();
    expect(stageAfterBooking('Audit Booked', 'no_show')).toBe('No Show');
    expect(stageAfterBooking('No Show', 'booked')).toBe('Audit Booked');
    expect(stageAfterBooking('Audit Booked', 'held')).toBe('Audit Held');
    expect(stageAfterBooking('Audit Booked', 'cancelled')).toBe('Qualified - Not Booked');
  });

  it('never moves a closed lead or undoes a held audit', () => {
    expect(stageAfterBooking('Closed Won', 'booked')).toBeNull();
    expect(stageAfterBooking('Disqualified', 'held')).toBeNull();
    expect(stageAfterBooking('Audit Held', 'no_show')).toBeNull();
    expect(stageAfterBooking('Audit Held', 'rescheduled')).toBeNull();
    expect(stageAfterBooking('No Show', 'cancelled')).toBeNull();
  });

  it('sets the opportunity status from the stage', () => {
    expect(opportunityStatus('Closed Won')).toBe('won');
    expect(opportunityStatus('Disqualified')).toBe('lost');
    expect(opportunityStatus('Recycled')).toBe('abandoned');
    expect(opportunityStatus('Audit Booked')).toBe('open');
  });
});

describe('GHL pipeline mapping', () => {
  const pipeline: GhlPipeline = {
    id: 'p1',
    name: 'DivineACQ Sales Pipeline',
    stages: [
      { id: 's1', name: 'New Lead' },
      { id: 's2', name: 'Qualified' },
      { id: 's3', name: 'Audit Booked' },
      { id: 's4', name: 'Showed' },
      { id: 's5', name: 'Won' },
    ],
  };

  it('picks the pipeline by id or name only', () => {
    const other: GhlPipeline = { id: 'p2', name: 'Recruiting', stages: [] };
    expect(pickPipeline([other, pipeline], { id: 'p1' })?.id).toBe('p1');
    expect(pickPipeline([other, pipeline], { name: 'divineacq sales pipeline' })?.id).toBe('p1');
    expect(pickPipeline([pipeline], { name: 'Missing' })).toBeNull();
    expect(pickPipeline([other, pipeline], { name: 'Missing' })).toBeNull();
  });

  it('matches stages by name or a common alias', () => {
    expect(pipelineStageId(pipeline, 'Step 1 Captured')).toBe('s1');
    expect(pipelineStageId(pipeline, 'Qualified - Not Booked')).toBe('s2');
    expect(pipelineStageId(pipeline, 'Audit Booked')).toBe('s3');
    expect(pipelineStageId(pipeline, 'Audit Held')).toBe('s4');
    expect(pipelineStageId(pipeline, 'Closed Won')).toBe('s5');
    expect(pipelineStageId(pipeline, 'No Show')).toBeNull();
  });
});

describe('GHL contact fields', () => {
  it('names every field "DA - ..." once', () => {
    const names = GHL_CONTACT_FIELDS.map((field) => field.name);
    expect(names.every((name) => name.startsWith('DA - '))).toBe(true);
    expect(new Set(names).size).toBe(names.length);
    expect(new Set(GHL_CONTACT_FIELDS.map((field) => field.key)).size).toBe(names.length);
    expect(names).toContain('DA - Lead Stage');
    expect(LEAD_STAGES).toContain('Audit Held');
  });
});
