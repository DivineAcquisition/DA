import { describe, expect, it } from 'vitest';
import { FAQ, HEADLINE_BEFORE, PILL_BANNER, SUBHEADLINE, TESTIMONIALS } from './copy';

describe('cleaning funnel copy', () => {
  it('keeps the offer about cleaning companies', () => {
    const text = [PILL_BANNER, HEADLINE_BEFORE, SUBHEADLINE, ...FAQ.items.map((item) => item.question)]
      .join(' ')
      .toLowerCase();
    expect(text).toContain('cleaning');
    expect(text).toContain('recurring clients');
    expect(text).not.toContain('coach');
    expect(TESTIMONIALS.map((item) => item.role).join(' ')).toMatch(/Clean/i);
  });
});
