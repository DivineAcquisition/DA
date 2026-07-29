import type { EodFieldType } from './types';

/**
 * The locked EOD core. These eight fields exist on every report for every client
 * in every industry. They are deliberately not configurable: cross-operator
 * reporting is only possible while every operator answers the same questions.
 *
 * This is the one part of the EOD shape that is code rather than data, because it
 * is the `EodCore` type — a compile-time contract, not a per-client choice. The
 * industry templates that used to sit beside it are rows in `industry_template`,
 * so adding an industry no longer needs a deploy. `app.eod_core_keys()` mirrors
 * the keys below so the database can refuse a configured field that would shadow
 * one; if this list changes, change that function with it.
 */
export const EOD_CORE_FIELDS = [
  { key: 'shiftStartActual', label: 'Shift start (actual)', type: 'text' as EodFieldType },
  { key: 'shiftEndActual', label: 'Shift end (actual)', type: 'text' as EodFieldType },
  { key: 'conversationsHandled', label: 'Leads / conversations handled', type: 'number' as EodFieldType },
  { key: 'appointmentsBooked', label: 'Appointments booked', type: 'number' as EodFieldType },
  { key: 'followUpsCompleted', label: 'Follow-ups completed', type: 'number' as EodFieldType },
  { key: 'escalationsRaised', label: 'Escalations raised', type: 'number' as EodFieldType },
  { key: 'blockers', label: 'Blockers', type: 'text' as EodFieldType },
  { key: 'notes', label: 'Notes', type: 'text' as EodFieldType },
] as const;

export const CORE_FIELD_KEYS: readonly string[] = EOD_CORE_FIELDS.map((field) => field.key);
