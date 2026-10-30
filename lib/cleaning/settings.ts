/**
 * Editable settings for the residential cleaning landing page.
 * Change a value here and the page, form, and guarantee use the new one.
 */
export const cleaningSettings = {
  /** First cleans promised. */
  firstCleans: 10,
  /** Promise window, used after "within". */
  promiseWindow: '30 days of your leads starting',
  /** Fee in whole dollars for each new recurring client. */
  feePerRecurringClient: 150,
  /** Fee-free clients if the first-clean promise is missed. */
  feeFreeClients: 5,
  /** Minimum ad budget, as shown in the copy. */
  minimumAdBudget: '$1,000 a month',
  /** Launch time, counted from the day we have access. */
  launchTime: '7 days',
  /** Founding partner spots remaining per market. */
  foundingSpotsPerMarket: 2,
  /** When false, hide the bar, the deal, and the last comparison row. */
  foundingPartnerOffer: true as boolean,
  /** Shown on the thank-you screen. */
  callbackPromise: 'Malik will call you back, usually within the hour during business hours.',
  /** Meta Pixel ID. PIXEL_PLACEHOLDER means use the cleaning site pixel already on the page. */
  metaPixelId: 'PIXEL_PLACEHOLDER',
  /** Legal name in the consent line. */
  legalName: 'Divine Acquisition LLC',
  /** Leave empty to hide the line. Fill it to show a second proof line. */
  mysteryShopStat: '',
  /** The only result shown. Labeled as one client's result. */
  proofStat: '+$50K ARR',
  /** Secondary thank-you button. Empty keeps the button, with no destination yet. */
  schedulerUrl: '',
};

export type CleaningSettings = {
  firstCleans: number;
  promiseWindow: string;
  feePerRecurringClient: number;
  feeFreeClients: number;
  minimumAdBudget: string;
  launchTime: string;
  foundingSpotsPerMarket: number;
  foundingPartnerOffer: boolean;
  callbackPromise: string;
  metaPixelId: string;
  legalName: string;
  mysteryShopStat: string;
  proofStat: string;
  schedulerUrl: string;
};

export function cleaningFee(settings: Pick<CleaningSettings, 'feePerRecurringClient'> = cleaningSettings): string {
  return `$${settings.feePerRecurringClient}`;
}
