import { isOfferedDate, isOfferedSlot, slotsForDate, type SlotOffer } from '@/lib/calendar/slots';

/** Cleaning strategy sessions: Sunday, Monday, Wednesday, Thursday at 6am, 7am, and 6pm. */
export const GO_SLOTS: SlotOffer = {
  days: [0, 1, 3, 4],
  times: ['06:00', '07:00', '18:00'],
};

export function goSlotsForDate(isoDate: string, timeZone: string, now = new Date()): string[] {
  return slotsForDate(isoDate, timeZone, now, GO_SLOTS);
}

export function isGoOpenDate(isoDate: string): boolean {
  return isOfferedDate(isoDate, GO_SLOTS);
}

export function isGoOfferedSlot(iso: string, timeZone: string, now = new Date()): boolean {
  return isOfferedSlot(iso, timeZone, now, GO_SLOTS);
}
