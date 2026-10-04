'use client';

import { useState } from 'react';
import { DateTimePicker } from '@/components/schedule/DateTimePicker';
import { bookAcqAuditAction } from '@/lib/acq/schedule';

export function AcqScheduler({
  token,
  booked = null,
}: {
  token: string;
  booked?: { startsAt: string; timeZone: string; meetUrl?: string | null } | null;
}) {
  const [phone, setPhone] = useState('');

  if (booked) {
    return (
      <DateTimePicker
        initialBooking={booked}
        onBook={async () => ({
          ok: true,
          startsAt: booked.startsAt,
          timeZone: booked.timeZone,
          meetUrl: booked.meetUrl,
        })}
      />
    );
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="acq-headline text-[13px] font-semibold text-white">Mobile number</span>
        <span className="mt-1 block text-sm text-neutral-500">
          Used for a text 15 minutes before the call.
        </span>
        <span className="acq-field mt-2 block">
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            placeholder="(555) 201-8890"
            className="acq-field-control"
          />
        </span>
      </label>
      <DateTimePicker
        onBook={async (input) => {
          const digits = phone.replace(/\D/g, '');
          if (digits.length < 7) {
            return { ok: false, error: 'Enter a mobile number for the text reminder.' };
          }
          const result = await bookAcqAuditAction(token, input.startsAt, input.timeZone, phone.trim());
          if (!result.ok) return result;
          return {
            ok: true,
            startsAt: result.startsAt,
            timeZone: result.timeZone,
            meetUrl: result.meetUrl,
            alreadyBooked: result.alreadyBooked,
          };
        }}
      />
    </div>
  );
}
