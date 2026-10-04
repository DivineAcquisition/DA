import { describe, expect, it } from 'vitest';
import { blankQuestionManifest, planQuestions } from './questionImport';

const known = {
  modules: [1],
  concepts: [{ moduleNumber: 1, name: 'Offer', linked: true }],
  prompts: [{ moduleNumber: 1, prompt: 'Already there' }],
};

describe('question import', () => {
  it('flags a bad module, a mismatched answer, a tag with no lesson, and a duplicate', () => {
    const csv = [
      blankQuestionManifest().trim(),
      '99,Where?,multiple choice,,Yes,No,,,A,,Offer,easy',
      '1,Which one?,multiple choice,,Yes,No,,,C,,Offer,easy',
      '1,Who?,multiple choice,,Yes,No,,,A,,Missing,easy',
      '1,Already there,multiple choice,,Yes,No,,,A,,Offer,medium',
      '1,Fresh,scenario,A client calls.,Yes,No,,,A,Because.,Offer,hard',
    ].join('\n');
    const plan = planQuestions(csv, known);
    const messages = plan.skips.map((skip) => skip.message).join(' ');
    expect(messages).toContain('does not match a module');
    expect(messages).toContain('does not match an option');
    expect(messages).toContain('no linked lesson');
    expect(messages).toContain('duplicate');
    expect(plan.creates.map((row) => row.prompt)).toEqual(['Fresh']);
  });
});
