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
import { bookGoStrategyAction } from '@/lib/go/book';
import { BOOKING, LEGAL_PRIVACY_URL, LEGAL_TERMS_URL } from '@/lib/go/copy';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type Booked = { startsAt: string; timeZone: string; meetUrl: string | null; alreadyBooked: boolean };

export function StrategyCalendar() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [showUp, setShowUp] = useState<'yes' | 'no' | ''>('');
  const [smsConsent, setSmsConsent] = useState(false);
  const [emailConsent, setEmailConsent] = useState(false);
  const [website, setWebsite] = useState('');
  const [timeZone, setTimeZone] = useState(DEFAULT_TIME_ZONE);
  const today = civilToday(timeZone);
  const [cursor, setCursor] = useState(() => {
    const [year, month] = today.split('-').map(Number);
    return { year, monthIndex: month - 1 };
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState<Booked | null>(null);
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

  if (booked) {
    return (
      <div className="go-scheduler go-booked">
        <p className="go-kicker">{booked.alreadyBooked ? 'Already booked' : 'Confirmed'}</p>
        <h3>{BOOKING.confirmedTitle}</h3>
        <p>{formatSlotWhen(booked.startsAt, booked.timeZone)}</p>
        <p>30 minutes</p>
        {booked.meetUrl ? (
          <a className="acq-button" href={booked.meetUrl}>
            Join Google Meet
          </a>
        ) : (
          <p>{BOOKING.confirmedNote}</p>
        )}
      </div>
    );
  }

  return (
    <form
      className="go-scheduler"
      onSubmit={(event) => {
        event.preventDefault();
        if (!selectedSlot) {
          setError('Pick a date and time.');
          return;
        }
        setError(null);
        startTransition(async () => {
          const result = await bookGoStrategyAction({
            fullName,
            email,
            phone,
            showUp: showUp === 'yes',
            smsConsent,
            emailConsent,
            startsAt: selectedSlot,
            timeZone,
            website,
          });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setBooked(result);
        });
      }}
    >
      <div className="go-identity">
        <label className="go-field">
          <span>{BOOKING.fullName}</span>
          <input
            name="fullName"
            type="text"
            autoComplete="name"
            required
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Jordan Blake"
          />
        </label>
        <label className="go-field">
          <span>{BOOKING.email}</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
          />
          <small>{BOOKING.emailNote}</small>
        </label>
        <label className="go-field">
          <span>{BOOKING.phone}</span>
          <input
            name="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            required
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="(555) 201-8890"
          />
          <small>{BOOKING.phoneNote}</small>
        </label>
      </div>

      <div className="go-cal">
        <label className="go-field">
          <span>Time zone</span>
          <select
            value={timeZone}
            onChange={(event) => {
              setTimeZone(event.target.value);
              setSelectedDate(null);
              setSelectedSlot(null);
            }}
          >
            {SCHEDULE_TIME_ZONES.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
        </label>

        <div className="go-cal-grid">
          <div>
            <div className="go-cal-nav">
              <button
                type="button"
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
              <p>{monthLabel}</p>
              <button
                type="button"
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
            <div className="go-cal-weekdays">
              {WEEKDAYS.map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="go-cal-days">
              {weeks.flat().map((date, index) => {
                if (!date) return <span key={`pad-${index}`} />;
                const disabled = isWeekendDate(date) || date < today || slotsForDate(date, timeZone).length === 0;
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
                  >
                    {Number(date.slice(-2))}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="go-times-label">{selectedDate ? 'Available times' : 'Pick a date'}</p>
            <div className="go-times">
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
                  >
                    {formatSlotTime(slot, timeZone)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <fieldset className="go-question">
        <legend>{BOOKING.showUpPrompt}</legend>
        <label>
          <input
            type="radio"
            name="showUp"
            value="yes"
            required
            checked={showUp === 'yes'}
            onChange={() => setShowUp('yes')}
          />
          <span>{BOOKING.showUpYes}</span>
        </label>
        <label>
          <input
            type="radio"
            name="showUp"
            value="no"
            checked={showUp === 'no'}
            onChange={() => setShowUp('no')}
          />
          <span>{BOOKING.showUpNo}</span>
        </label>
        {showUp === 'no' ? <p className="go-decline">{BOOKING.showUpDecline}</p> : null}
      </fieldset>

      <label className="acq-consent">
        <input
          name="smsConsent"
          type="checkbox"
          required
          checked={smsConsent}
          onChange={(event) => setSmsConsent(event.target.checked)}
        />
        <span>
          {BOOKING.smsConsent}{' '}
          <a href={LEGAL_TERMS_URL}>Terms</a>
          {' | '}
          <a href={LEGAL_PRIVACY_URL}>Privacy Policy</a>
        </span>
      </label>
      <label className="acq-consent">
        <input
          name="emailConsent"
          type="checkbox"
          required
          checked={emailConsent}
          onChange={(event) => setEmailConsent(event.target.checked)}
        />
        <span>{BOOKING.emailConsent}</span>
      </label>

      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
          />
        </label>
      </div>

      {error ? (
        <p className="go-error" role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" className="acq-button" disabled={pending || !selectedSlot || showUp === 'no'}>
        {pending ? BOOKING.submitting : BOOKING.submit}
      </button>
    </form>
  );
}
