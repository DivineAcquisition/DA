import { describe, expect, it } from 'vitest';
import {
  HS_CALL_STAGES,
  HS_CAPTURE_QUESTION_KEYS,
  hsCallStatusColor,
  hsFitChecks,
  hsTradeLabel,
  matchesHsCallSearch,
  nextHsStageId,
  parseHsStageProgress,
} from './hs-calls';

describe('home-services qualifying call script', () => {
  it('hardcodes four stages with the capture keys from the brief', () => {
    expect(HS_CALL_STAGES.map((s) => s.id)).toEqual(['open', 'understand', 'reflect', 'book']);
    expect(HS_CAPTURE_QUESTION_KEYS).toEqual([
      'why_responded',
      'call_handling',
      'response_time',
      'unsold_estimates',
      'past_customers',
      'tried_before',
    ]);
    expect(HS_CALL_STAGES[2]?.questions).toEqual([]);
    expect(HS_CALL_STAGES[3]?.objections).toHaveLength(5);
  });
});

describe('hs fit checks', () => {
  it('colours decision maker, phone coverage, and size with no overall score', () => {
    const owner = hsFitChecks({
      role: 'owner',
      who_answers_phone: 'nobody',
      crew_count: 'two_to_four',
    });
    expect(owner.map((c) => c.tone)).toEqual(['green', 'green', 'green']);

    const gm = hsFitChecks({
      role: 'general_manager',
      who_answers_phone: 'answering_service',
      crew_count: 'ten_plus',
    });
    expect(gm.map((c) => c.tone)).toEqual(['amber', 'amber', 'amber']);

    const office = hsFitChecks({
      role: 'office_manager',
      who_answers_phone: 'two_plus_admin',
      crew_count: 'owner_only',
    });
    expect(office.map((c) => c.tone)).toEqual(['red', 'red', 'red']);
  });

  it('treats owner-answered and one-admin phones as green coverage', () => {
    expect(hsFitChecks({ role: 'owner', who_answers_phone: 'owner', crew_count: 'five_to_ten' })[1]?.tone).toBe(
      'green',
    );
    expect(hsFitChecks({ role: 'owner', who_answers_phone: 'one_admin', crew_count: 'five_to_ten' })[1]?.tone).toBe(
      'green',
    );
  });
});

describe('hs status colours and search', () => {
  it('uses the brief colours for each status', () => {
    expect(hsCallStatusColor('scheduled')).toBe('#6E6C80');
    expect(hsCallStatusColor('in_progress')).toBe('#FFD06A');
    expect(hsCallStatusColor('booked')).toBe('#7AFF8A');
    expect(hsCallStatusColor('not_booked')).toBe('#FF6A6A');
    expect(hsCallStatusColor('no_show')).toBe('#FF6A6A');
  });

  it('matches contact name or company name only', () => {
    const call = { contact_name: 'Alex Rivera', company_name: 'Rivera HVAC' };
    expect(matchesHsCallSearch(call, 'alex')).toBe(true);
    expect(matchesHsCallSearch(call, 'HVAC')).toBe(true);
    expect(matchesHsCallSearch(call, 'plumb')).toBe(false);
  });
});

describe('hs stage progress', () => {
  it('restores a saved open stage and completed dots', () => {
    const parsed = parseHsStageProgress('{"open":"understand","completed":["open"]}');
    expect(parsed.open).toBe('understand');
    expect(parsed.completed).toEqual(['open']);
    expect(nextHsStageId('open')).toBe('understand');
    expect(nextHsStageId('book')).toBeNull();
  });

  it('falls back when the payload is missing or junk', () => {
    expect(parseHsStageProgress(null)).toEqual({ open: 'open', completed: [] });
    expect(parseHsStageProgress('not-json')).toEqual({ open: 'open', completed: [] });
  });
});

describe('hs labels', () => {
  it('renders trade labels', () => {
    expect(hsTradeLabel('hvac')).toBe('HVAC');
    expect(hsTradeLabel('pest')).toBe('Pest control');
    expect(hsTradeLabel('garage_doors')).toBe('Garage doors');
  });
});
