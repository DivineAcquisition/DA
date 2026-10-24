/** Local estimate only. Callers must not store or send the inputs. */

export function missedLeadCost(value: number, missedPerWeek: number, bookingPercent: number): number {
  if (![value, missedPerWeek, bookingPercent].every((item) => Number.isFinite(item))) return 0;
  if (value < 0 || missedPerWeek < 0 || bookingPercent < 0) return 0;
  return Math.round(value * missedPerWeek * (bookingPercent / 100) * 4.3);
}

export function formatDollars(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}
