'use client';

import { bookAssessmentInviteAction, bookCallSlotAction } from '@/lib/calendar/book';
import { DateTimePicker, type ScheduleBooking } from './DateTimePicker';

export function AssessmentScheduler({
  token,
  initialBooking = null,
}: {
  token: string;
  initialBooking?: ScheduleBooking | null;
}) {
  return (
    <DateTimePicker
      initialBooking={initialBooking}
      onBook={(input) => bookAssessmentInviteAction(token, input.startsAt, input.timeZone)}
    />
  );
}

export function CallScheduler({
  token,
  initialBooking = null,
}: {
  token: string;
  initialBooking?: ScheduleBooking | null;
}) {
  return (
    <DateTimePicker
      initialBooking={initialBooking}
      onBook={(input) => bookCallSlotAction(token, input.startsAt, input.timeZone)}
    />
  );
}
