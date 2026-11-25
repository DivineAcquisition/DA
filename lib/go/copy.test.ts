import { describe, expect, it } from 'vitest';
import { FAQ, HEADLINE_BEFORE, PILL_BANNER, SUBHEADLINE, TESTIMONIALS } from './copy';

describe('cleaning funnel copy', () => {
  it('keeps the offer about cleaning companies', () => {
    const text = [PILL_BANNER, HEADLINE_BEFORE, SUBHEADLINE, ...FAQ.items.map((item) => item.question)]
      .join(' ')
      .toLowerCase();
    expect(text).toContain('cleaning');
    expect(HEADLINE_BEFORE).toBe("We'll Help Cleaning Companies Add 10-15 Recurring Accounts In 30-90 Days.");
    expect(text).toContain('10-15 recurring accounts');
    expect(text).toContain('30-90 days');
    expect(text).not.toContain('coach');
    expect(TESTIMONIALS.map((item) => item.role).join(' ')).toMatch(/Clean/i);
  });
});
