import { describe, expect, it } from 'vitest';
import { countWords, readingSeconds, renderLesson } from './markdown';

describe('lesson text', () => {
  it('counts words the way the reading timer does', () => {
    expect(countWords('Hello, world!')).toBe(2);
    expect(countWords('')).toBe(0);
    expect(readingSeconds(4, 180, 30)).toBe(30);
    expect(readingSeconds(900, 180, 30)).toBe(300);
  });

  it('keeps headings, lists, bold, and links', () => {
    const html = renderLesson('## Title\n\n**Bold** and [DA](https://training.divineacquisition.io)\n\n- One');
    expect(html).toContain('<h2>Title</h2>');
    expect(html).toContain('<strong>Bold</strong>');
    expect(html).toContain('href="https://training.divineacquisition.io"');
    expect(html).toContain('<li>One</li>');
    expect(renderLesson('<script>alert(1)</script>')).not.toContain('<script>');
  });
});
