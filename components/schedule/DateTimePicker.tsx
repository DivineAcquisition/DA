'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  DEFAULT_TIME_ZONE,
  SCHEDULE_TIME_ZONES,
  civilToday,
  formatSlotTime,
  formatSlotWhen,
  isWeekendDate,
  monthMatrix,
  slotsForDate,
} from '@/lib/calendar/slots';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export type ScheduleBooking = {
  startsAt: string;
  timeZone: string;
  meetUrl?: string | null;
};

type BookResult =
  | { ok: true; startsAt: string; timeZone: string; meetUrl?: string | null; alreadyBooked?: boolean }
  | { ok: false; error: string };

export function DateTimePicker({
  initialBooking = null,
  onBook,
}: {
  initialBooking?: ScheduleBooking | null;
  onBook: (input: { startsAt: string; timeZone: string }) => Promise<BookResult>;
}) {
  const [booking, setBooking] = useState<ScheduleBooking | null>(initialBooking);
  const [timeZone, setTimeZone] = useState(initialBooking?.timeZone || DEFAULT_TIME_ZONE);
  const today = civilToday(timeZone);
  const [cursor, setCursor] = useState(() => {
    const [year, month] = today.split('-').map(Number);
    return { year, monthIndex: month - 1 };
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const weeks = useMemo(
    () => monthMatrix(cursor.year, cursor.monthIndex),
    [cursor.year, cursor.monthIndex],
  );
  const slots = selectedDate ? slotsForDate(selectedDate, timeZone) : [];
  const monthLabel = new Date(Date.UTC(cursor.year, cursor.monthIndex, 1)).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  if (booking) {
    return (
      <div className="rounded-3xl border border-white/10 bg-black p-6 sm:p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-300">Confirmed</p>
        <h2 className="mt-3 text-2xl font-semibold text-white">Your call is on the calendar.</h2>
        <p className="mt-3 text-base text-neutral-300">{formatSlotWhen(booking.startsAt, booking.timeZone)}</p>
        <p className="mt-1 text-sm text-neutral-500">30 minutes</p>
        {booking.meetUrl ? (
          <a
            href={booking.meetUrl}
            className="mt-6 inline-flex rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-ink-950"
          >
            Open meeting link
          </a>
        ) : (
          <p className="mt-6 text-sm text-neutral-400">A confirmation is on its way to your email.</p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-black p-4 sm:p-6">
      <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
        Time zone
        <select
          value={timeZone}
          onChange={(event) => {
            setTimeZone(event.target.value);
            setSelectedDate(null);
            setSelectedSlot(null);
          }}
          className="mt-2 w-full rounded-xl border border-white/10 bg-black px-3 py-2.5 text-sm text-white"
        >
          {SCHEDULE_TIME_ZONES.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div>
          <div className="flex items-center justify-between">
            <button
              type="button"
              className="rounded-lg px-2 py-1 text-sm text-neutral-300 hover:bg-white/5"
              onClick={() =>
                setCursor((current) => {
                  const monthIndex = current.monthIndex - 1;
                  return monthIndex < 0
                    ? { year: current.year - 1, monthIndex: 11 }
                    : { year: current.year, monthIndex };
                })
              }
            >
              Previous
            </button>
            <p className="text-sm font-semibold text-white">{monthLabel}</p>
            <button
              type="button"
              className="rounded-lg px-2 py-1 text-sm text-neutral-300 hover:bg-white/5"
              onClick={() =>
                setCursor((current) => {
                  const monthIndex = current.monthIndex + 1;
                  return monthIndex > 11
                    ? { year: current.year + 1, monthIndex: 0 }
                    : { year: current.year, monthIndex };
                })
              }
            >
              Next
            </button>
          </div>
          <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            {WEEKDAYS.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1">
            {weeks.flat().map((date, index) => {
              if (!date) return <span key={`pad-${index}`} />;
              const weekend = isWeekendDate(date);
              const past = date < today;
              const disabled = weekend || past || slotsForDate(date, timeZone).length === 0;
              const selected = date === selectedDate;
              return (
                <button
                  key={date}
                  type="button"
                  disabled={disabled}
                  aria-pressed={selected}
                  onClick={() => {
                    setSelectedDate(date);
                    setSelectedSlot(null);
                    setError(null);
                  }}
                  className={`h-10 rounded-lg text-sm ${
                    selected
                      ? 'bg-brand-500 font-semibold text-ink-950'
                      : disabled
                        ? 'text-neutral-700'
                        : 'text-white hover:bg-white/10'
                  }`}
                >
                  {Number(date.slice(-2))}
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:pt-14">
          <p className="text-sm font-semibold text-white">
            {selectedDate ? 'Available times' : 'Pick a date'}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {selectedDate && slots.length === 0 ? (
              <p className="col-span-2 text-sm text-neutral-500">No times left on this day.</p>
            ) : null}
            {slots.map((slot) => {
              const selected = slot === selectedSlot;
              return (
                <button
                  key={slot}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setSelectedSlot(slot);
                    setError(null);
                  }}
                  className={`rounded-xl border px-3 py-2.5 text-sm ${
                    selected
                      ? 'border-brand-400 bg-brand-500/15 font-semibold text-white'
                      : 'border-white/10 text-neutral-200 hover:border-white/25'
                  }`}
                >
                  {formatSlotTime(slot, timeZone)}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            disabled={!selectedSlot || pending}
            onClick={() => {
              if (!selectedSlot) return;
              setError(null);
              startTransition(async () => {
                const result = await onBook({ startsAt: selectedSlot, timeZone });
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setBooking({
                  startsAt: result.startsAt,
                  timeZone: result.timeZone,
                  meetUrl: result.meetUrl,
                });
              });
            }}
            className="mt-4 w-full rounded-xl bg-brand-500 px-4 py-3 text-sm font-semibold text-ink-950 disabled:opacity-40"
          >
            {pending ? 'Scheduling…' : 'Schedule this time'}
          </button>
          {error ? (
            <p className="mt-3 text-sm text-red-300" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
