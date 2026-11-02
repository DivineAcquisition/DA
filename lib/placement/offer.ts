/** The offer brief the operator reads on the client card. */

export type OfferBrief = {
  one_liner: string;
  service_area: string;
  prices: string;
  ideal_customer: string;
  objections: string;
  booking_rules: string;
  never: string;
  escalate: string;
};

export const EMPTY_OFFER: OfferBrief = {
  one_liner: '',
  service_area: '',
  prices: '',
  ideal_customer: '',
  objections: '',
  booking_rules: '',
  never: '',
  escalate: '',
};

export const OFFER_FIELDS: Array<{ key: keyof OfferBrief; label: string; required: boolean }> = [
  { key: 'one_liner', label: 'Business in one line', required: true },
  { key: 'service_area', label: 'Service area', required: true },
  { key: 'prices', label: 'Services and price ranges', required: false },
  { key: 'ideal_customer', label: 'Ideal customer', required: true },
  { key: 'objections', label: 'Common objections and approved answers', required: false },
  { key: 'booking_rules', label: 'Booking rules', required: true },
  { key: 'never', label: 'What never to do or promise', required: true },
  { key: 'escalate', label: 'Escalate to the client when', required: false },
];

export function offerMissing(offer: Partial<OfferBrief> | null | undefined): string[] {
  return OFFER_FIELDS.filter((field) => field.required && !String(offer?.[field.key] ?? '').trim()).map((field) => field.label);
}

export function offerText(offer: Partial<OfferBrief> | null | undefined): string {
  return OFFER_FIELDS.map((field) => {
    const value = String(offer?.[field.key] ?? '').trim();
    return value ? `${field.label}: ${value}` : '';
  })
    .filter(Boolean)
    .join('\n');
}
