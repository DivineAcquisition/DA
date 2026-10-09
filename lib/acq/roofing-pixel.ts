/** Public roofing ads pixel. Not the coaches pixel. Safe to import from the browser. */

export const ROOFING_META_PIXEL_ID =
  process.env.NEXT_PUBLIC_ROOFING_META_PIXEL_ID?.trim() || '658113660313482';

export const ROOFING_CAPI_EVENTS = ['PageView', 'Lead', 'UnqualifiedLead', 'Schedule'] as const;

export type RoofingCapiEvent = (typeof ROOFING_CAPI_EVENTS)[number];

export function isRoofingPath(pathname: string): boolean {
  return (
    pathname === '/roofing' ||
    pathname.startsWith('/roofing/') ||
    pathname === '/acq/roofing' ||
    pathname.startsWith('/acq/roofing/')
  );
}

export function isRoofingCapiEvent(value: string): value is RoofingCapiEvent {
  return (ROOFING_CAPI_EVENTS as readonly string[]).includes(value);
}
