import { describe, expect, it } from 'vitest';
import { blankManifest, importedLessonBody, planManifest, readManifest } from './manifest';

const header = blankManifest().trim();

describe('lesson manifest', () => {
  it('flags a bad id, a duplicate, a missing file, and a live lesson with no content', () => {
    const csv = [
      header,
      'NOPE,Title,1,,notes.pdf,60,90,Hello,Live,',
      'M07-L03,Sales,3,,missing.pdf,,,Hello there,Live,',
      'M07-L03,Sales again,3,,,,,,Draft,',
      'M07-L04,Empty,4,,,,,,Live,',
    ].join('\n');
    const plan = planManifest(csv, ['notes.pdf'], []);
    const messages = plan.skips.map((skip) => skip.message).join(' ');
    expect(messages).toContain('not a lesson ID');
    expect(messages).toContain('missing.pdf');
    expect(messages).toContain('listed more than once');
    expect(messages).toContain('needs a video or a written lesson');
    expect(plan.creates).toHaveLength(0);
  });

  it('plans a create and an update and saves nothing by itself', () => {
    const csv = [header, 'M01-L01,Who DA is,1,https://vimeo.com/123456789,,95,90,,Ready,'].join('\n');
    const plan = planManifest(csv, [], ['M01-L01']);
    expect(plan.updates.map((row) => row.lessonId)).toEqual(['M01-L01']);
    expect(plan.creates).toHaveLength(0);
    expect(readManifest(csv).rows[0].duration).toBe(95);
  });

  it('keeps an existing written lesson when the cell is empty, and flags a missing text file', () => {
    expect(importedLessonBody('', 'Already written', null)).toBe('Already written');
    expect(importedLessonBody('New text', 'Already written', null)).toBe('New text');
    expect(importedLessonBody('notes.md', 'Already written', 'From the file')).toBe('From the file');
    const csv = [header, 'M07-L03,Sales,3,,,,,notes.md,Draft,'].join('\n');
    const plan = planManifest(csv, [], []);
    expect(plan.skips.map((skip) => skip.message).join(' ')).toContain('notes.md');
    expect(plan.creates).toHaveLength(0);
  });
});
