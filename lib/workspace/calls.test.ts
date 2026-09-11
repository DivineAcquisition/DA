import { describe, expect, it } from 'vitest';
import {
  CALL_STAGES,
  CAPTURE_QUESTION_KEYS,
  callStatusColor,
  fitChecks,
  matchesCallSearch,
  nextStageId,
  parseStageProgress,
  practiceTypeLabel,
} from './calls';

describe('qualifying call script', () => {
  it('hardcodes four stages with the capture keys from the brief', () => {
    expect(CALL_STAGES.map((s) => s.id)).toEqual(['open', 'understand', 'reflect', 'book']);
    expect(CAPTURE_QUESTION_KEYS).toEqual([
      'why_responded',
      'missed_call_process',
      'recall_owner',
      'consult_followup',
      'tried_before',
    ]);
    expect(CALL_STAGES[2]?.questions).toEqual([]);
    expect(CALL_STAGES[3]?.objections).toHaveLength(4);
  });
});

describe('fit checks', () => {
  it('colours decision maker, front desk, and pain with no overall score', () => {
    const owner = fitChecks({ role: 'owner', front_desk_size: 'one', stated_pain: 'No follow-up' });
    expect(owner.map((c) => c.tone)).toEqual(['green', 'green', 'green']);

    const manager = fitChecks({ role: 'practice_manager', front_desk_size: 'three_plus', stated_pain: '  ' });
    expect(manager.map((c) => c.tone)).toEqual(['amber', 'amber', 'red']);

    const other = fitChecks({ role: 'other', front_desk_size: 'two', stated_pain: null });
    expect(other.map((c) => c.tone)).toEqual(['red', 'green', 'red']);
  });
});

describe('status colours and search', () => {
  it('uses the brief colours for each status', () => {
    expect(callStatusColor('scheduled')).toBe('#6E6C80');
    expect(callStatusColor('in_progress')).toBe('#FFD06A');
    expect(callStatusColor('booked')).toBe('#7AFF8A');
    expect(callStatusColor('not_booked')).toBe('#FF6A6A');
    expect(callStatusColor('no_show')).toBe('#FF6A6A');
  });

  it('matches contact name or practice name only', () => {
    const call = { contact_name: 'Jordan Lee', practice_name: 'Northside Dental' };
    expect(matchesCallSearch(call, 'jord')).toBe(true);
    expect(matchesCallSearch(call, 'NORTH')).toBe(true);
    expect(matchesCallSearch(call, 'spa')).toBe(false);
  });
});

describe('stage progress', () => {
  it('restores a saved open stage and completed dots', () => {
    const parsed = parseStageProgress('{"open":"understand","completed":["open"]}');
    expect(parsed.open).toBe('understand');
    expect(parsed.completed).toEqual(['open']);
    expect(nextStageId('open')).toBe('understand');
    expect(nextStageId('book')).toBeNull();
  });

  it('falls back when the payload is missing or junk', () => {
    expect(parseStageProgress(null)).toEqual({ open: 'open', completed: [] });
    expect(parseStageProgress('not-json')).toEqual({ open: 'open', completed: [] });
  });
});

describe('labels', () => {
  it('renders practice type labels', () => {
    expect(practiceTypeLabel('dental')).toBe('Dental');
    expect(practiceTypeLabel('med_spa')).toBe('Med spa');
    expect(practiceTypeLabel('both')).toBe('Both');
  });
});
