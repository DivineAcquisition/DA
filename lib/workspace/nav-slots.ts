/**
 * Screens that have a home in navigation but no page yet.
 * Set one flag to true when that page exists. Nothing renders while it is false.
 *
 * teamPerformance: Team Workspace tab for managers and DA Admin.
 *   Managers see the Performance Score only. Admin Score on that page is DA Admin only.
 * payImpact: Finance item, DA Admin only.
 * operatorScore / operatorFocusPlan: tabs on a sales operator's Performance item, beside Pay.
 */
export const navSlots = {
  teamPerformance: false,
  payImpact: false,
  operatorScore: false,
  operatorFocusPlan: false,
} as const;
