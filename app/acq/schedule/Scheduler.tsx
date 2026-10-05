'use client';

import { useState } from 'react';
import { Field as CossField, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
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
      <div className="lx-card mb-4">
        <CossField>
          <FieldLabel className="mb-1.5 text-sm font-medium normal-case tracking-normal text-neutral-300">
            Mobile number
          </FieldLabel>
          <p className="mb-2 text-sm text-neutral-400">Used for a text 15 minutes before the call.</p>
          <Input
            nativeInput
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            placeholder="(555) 201-8890"
            size="lg"
            className="text-base"
          />
        </CossField>
      </div>
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
