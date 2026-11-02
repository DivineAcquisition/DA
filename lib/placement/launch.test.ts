import { describe, expect, it } from 'vitest';
import { firstReportNeedsApproval, launchWindow, suggestTarget } from './launch';

describe('launch targets', () => {
  it('suggests hold at the average and stretch 15 percent higher', () => {
    expect(suggestTarget(20, 18)).toEqual({ hold: 20, stretch: 23, template: 18 });
    expect(suggestTarget(10.2, null)).toEqual({ hold: 10.2, stretch: 11.7, template: null });
  });

  it('leaves the suggestion empty when there is no average yet', () => {
    expect(suggestTarget(null, 12)).toEqual({ hold: null, stretch: null, template: 12 });
  });
});

describe('first report', () => {
  it('always needs approval the first time', () => {
    expect(firstReportNeedsApproval(true, false)).toBe(true);
    expect(firstReportNeedsApproval(false, false)).toBe(false);
    expect(firstReportNeedsApproval(false, true)).toBe(true);
  });
});

describe('first week length', () => {
  it('extends the window when fewer than three days have data', () => {
    expect(launchWindow(2)).toBe(10);
    expect(launchWindow(3)).toBe(5);
  });
});
