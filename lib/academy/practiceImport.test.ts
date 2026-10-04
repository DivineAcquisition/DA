import { describe, expect, it } from 'vitest';
import { planDrills, planSimulations } from './practiceImport';

const known = {
  modules: [{ order: 8, id: 'mod-8', parts: [{ key: 'simulation', id: 'part-1' }] }],
  packs: [{ name: 'Offer Pack', version: 1, id: 'pack-1' }],
  rubrics: [{ name: 'Conversation', version: 1, id: 'rubric-1' }],
  titles: [],
};

describe('practice imports', () => {
  it('keeps a complete simulation and explains why a live row is blocked', () => {
    const csv = [
      'Title,Vertical,Module number,Gate part,Brief,Persona,Difficulty,Offer pack name,Offer pack version,Rubric name,Rubric version,Max turns,Time limit seconds,Pass score,Capstone,Status',
      'First call,Med Spa,8,simulation,The lead just wrote.,They want proof.,standard,Offer Pack,1,Conversation,1,12,,80,no,live',
      'Empty,General,8,simulation,,,standard,,,,,12,,,no,live',
    ].join('\n');
    const plan = planSimulations(csv, known);
    expect(plan.creates.map((row) => row.title)).toEqual(['First call']);
    expect(plan.skips[0]?.message).toContain('cannot go Live');
  });

  it('flags a drill row whose correct move is not one of the options', () => {
    const csv = [
      'Module number,Situation,Source,Reply speed,Earlier touches,Readiness,Move A,Move B,Move C,Move D,Correct move,Concept tag,Difficulty,Explanation',
      '6,Lead wrote once,form,2 minutes,,ready,Ask,Book,,,B,Readiness,easy,Ask before you book.',
      '6,Wrong letter,form,1 minute,,ready,Ask,Book,,,C,Readiness,hard,No.',
    ].join('\n');
    const plan = planDrills(csv, { modules: [6] });
    expect(plan.creates).toHaveLength(1);
    expect(plan.creates[0]?.correctMove).toBe('b');
    expect(plan.skips[0]?.message).toContain('does not match');
  });
});
