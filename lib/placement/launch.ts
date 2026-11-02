/** Suggestions only. A person still has to save the target. */

export function suggestTarget(average: number | null, templateDaily: number | null) {
  if (average === null || Number.isNaN(average)) {
    return { hold: null, stretch: null, template: templateDaily };
  }
  const hold = Math.round(average * 10) / 10;
  return { hold, stretch: Math.round(hold * 1.15 * 10) / 10, template: templateDaily };
}

/** The first weekly report always needs a manager, even when later reports do not. */
export function firstReportNeedsApproval(isFirst: boolean, placementRequiresApproval: boolean) {
  return isFirst || placementRequiresApproval;
}

export function launchWindow(dataDaysInFirstFive: number) {
  return dataDaysInFirstFive < 3 ? 10 : 5;
}
