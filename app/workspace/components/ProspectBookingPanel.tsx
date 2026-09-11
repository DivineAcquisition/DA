'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  createProspectAction,
  scheduleProspectCallAction,
  searchProspectsAction,
} from '@/lib/acq/booking-actions';
import type { ProspectRecord } from '@/lib/acq/prospects';
import {
  AD_SPEND_OPTIONS,
  FOLLOW_UP_OPTIONS,
  PROGRAM_PRICE_OPTIONS,
} from '@/lib/acq/qualify';
import { isClosedStage } from '@/lib/acq/stages';
import { Badge, Button, Card, Dialog, Field, Input, Select, Textarea } from './ui';

const TIME_ZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'Europe/London',
  'UTC',
];

function scoreTone(score: number | null): 'success' | 'pending' | 'error' | 'neutral' {
  if (score == null) return 'neutral';
  if (score >= 60) return 'success';
  if (score >= 40) return 'pending';
  return 'error';
}

function defaultStartsAtLocal(): string {
  const next = new Date(Date.now() + 60 * 60_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}T${pad(next.getHours())}:${pad(next.getMinutes())}`;
}

export default function ProspectBookingPanel({
  airtableReady,
  calendarReady,
}: {
  airtableReady: boolean;
  calendarReady: boolean;
}) {
  const [query, setQuery] = useState('');
  const [includeManualReview, setIncludeManualReview] = useState(false);
  const [prospects, setProspects] = useState<ProspectRecord[]>([]);
  const [booked, setBooked] = useState<ProspectRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();
  const [booking, startBooking] = useTransition();
  const [creating, startCreate] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const selected = useMemo(
    () => prospects.find((prospect) => prospect.recordId === selectedId) ?? null,
    [prospects, selectedId],
  );

  const runSearch = (
    nextQuery = query,
    nextInclude = includeManualReview,
    keepProspect?: ProspectRecord | null,
  ) => {
    setSearchError(null);
    startSearch(async () => {
      const [open, alreadyBooked] = await Promise.all([
        searchProspectsAction({ query: nextQuery, includeManualReview: nextInclude }),
        searchProspectsAction({ query: nextQuery, bookedOnly: true, limit: 12 }),
      ]);
      if (!open.ok) {
        setSearchError(open.error);
        setProspects(keepProspect && !isClosedStage(keepProspect.stage) ? [keepProspect] : []);
      } else {
        const rows = open.prospects;
        const keep =
          keepProspect &&
          !isClosedStage(keepProspect.stage) &&
          !rows.some((row) => row.recordId === keepProspect.recordId)
            ? keepProspect
            : null;
        setProspects(keep ? [keep, ...rows] : rows);
      }
      if (alreadyBooked.ok) setBooked(alreadyBooked.prospects);
    });
  };

  useEffect(() => {
    runSearch('', false);
    // Initial load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-8">
      <Card className="p-5 sm:p-7" beam>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-300">
          Workspace leads
        </p>
        <h2 className="mt-2 text-lg font-semibold text-white">Search legit prospects</h2>
        <p className="mt-2 max-w-2xl text-sm text-neutral-500">
          Qualified leads (readiness 60+) stored in this workspace. Pick one to map name, email,
          company, and score into a 30-minute Lead Leak Audit with Google Meet. A copy is sent to
          Airtable when a destination PAT is set.
        </p>
        <p className="mt-2 text-xs text-neutral-600">
          Google Calendar / Meet: {calendarReady ? 'connected' : 'not configured — set GOOGLE_CALENDAR_*'}
          {' · '}
          Airtable send: {airtableReady ? 'destination ready' : 'no PAT — bookings still save here'}
        </p>

        <form
          className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            runSearch();
          }}
        >
          <div className="min-w-0 flex-1">
            <Field label="Search">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name, email, company, phone…"
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm text-neutral-400">
            <input
              type="checkbox"
              checked={includeManualReview}
              onChange={(event) => {
                const next = event.target.checked;
                setIncludeManualReview(next);
                runSearch(query, next);
              }}
              className="h-4 w-4 accent-brand-500"
            />
            Include manual review
          </label>
          <Button type="submit" disabled={searching} className="sm:mb-0.5">
            {searching ? 'Searching…' : 'Search'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="sm:mb-0.5"
            onClick={() => {
              setCreateError(null);
              setCreateOpen(true);
            }}
          >
            New prospect
          </Button>
        </form>

        {searchError && (
          <p className="mt-4 rounded-xl border border-flag-critical/25 bg-flag-critical/[0.08] px-3.5 py-2.5 text-sm text-flag-critical">
            {searchError}
          </p>
        )}
      </Card>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-300">
              Bookable
            </p>
            <h3 className="mt-1 text-lg font-semibold text-white">
              {searching ? 'Loading…' : `${prospects.length} prospect${prospects.length === 1 ? '' : 's'}`}
            </h3>
          </div>
        </div>

        {prospects.length === 0 && !searching ? (
          <Card className="px-6 py-10 text-center text-sm text-neutral-500" shine={false}>
            No legit prospects match that search. Qualified workspace leads who are not closed will
            show here. Use New prospect if the public form has not landed them yet.
          </Card>
        ) : (
          <div className="space-y-2.5">
            {prospects.map((prospect) => {
              const active = prospect.recordId === selectedId;
              return (
                <article
                  key={prospect.recordId}
                  className={`panel relative overflow-hidden rounded-2xl flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${
                    active ? 'ring-1 ring-brand-500/40' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-white">
                        {prospect.fullName || 'Unnamed lead'}
                      </p>
                      <Badge tone={scoreTone(prospect.readinessScore)}>
                        {prospect.readinessScore ?? '—'} {prospect.qualificationResult ?? ''}
                      </Badge>
                      {prospect.stage ? <Badge>{prospect.stage}</Badge> : null}
                    </div>
                    <p className="mt-1 truncate text-xs text-neutral-500">
                      {prospect.companyName || 'No company'}
                      {prospect.email ? ` · ${prospect.email}` : ' · no email'}
                      {prospect.phone ? ` · ${prospect.phone}` : ''}
                    </p>
                    {prospect.nextAction ? (
                      <p className="mt-1 text-xs text-neutral-400">{prospect.nextAction}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {prospect.airtableUrl ? (
                      <a
                        href={prospect.airtableUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-brand-300 hover:underline"
                      >
                        Airtable
                      </a>
                    ) : (
                      <span className="text-xs text-neutral-600">Not sent</span>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant={active ? 'secondary' : 'primary'}
                      onClick={() => {
                        setSelectedId(prospect.recordId);
                        setMessage(null);
                        setError(null);
                      }}
                    >
                      {active ? 'Selected' : 'Set up call'}
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {selected && (
        <Card className="p-5 sm:p-7">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-300">
            Call setup
          </p>
          <h3 className="mt-2 text-lg font-semibold text-white">
            Lead Leak Audit — {selected.fullName || 'prospect'}
          </h3>
          <p className="mt-2 whitespace-pre-line text-sm text-neutral-500">{selected.briefing}</p>

          <form
            ref={formRef}
            className="mt-6 space-y-5"
            action={(formData) => {
              setMessage(null);
              setError(null);
              startBooking(async () => {
                const result = await scheduleProspectCallAction(formData);
                if (result.ok) {
                  setMessage(result.message);
                  setSelectedId(null);
                  runSearch();
                } else {
                  setError(result.error);
                }
              });
            }}
          >
            <input type="hidden" name="recordId" value={selected.recordId} />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Full name">
                <Input name="fullName" required defaultValue={selected.fullName} key={`${selected.recordId}-name`} />
              </Field>
              <Field label="Email" hint={!selected.email ? 'Missing on the lead — add it to send the Meet invite.' : undefined}>
                <Input
                  name="email"
                  type="email"
                  required
                  defaultValue={selected.email}
                  key={`${selected.recordId}-email`}
                  placeholder="prospect@company.com"
                />
              </Field>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Company">
                <Input name="companyName" defaultValue={selected.companyName} key={`${selected.recordId}-company`} />
              </Field>
              <Field label="Phone">
                <Input name="phone" defaultValue={selected.phone} readOnly />
              </Field>
            </div>
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Date & time">
                <Input name="startsAtLocal" type="datetime-local" required defaultValue={defaultStartsAtLocal()} />
              </Field>
              <Field label="Time zone">
                <Select name="timeZone" defaultValue="America/New_York">
                  {TIME_ZONES.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Duration">
                <Select name="durationMinutes" defaultValue="30">
                  <option value="20">20 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">60 minutes</option>
                </Select>
              </Field>
            </div>
            <Field label="Internal note" hint="Appended to the calendar description. The workspace lead already has the score brief.">
              <Textarea name="note" rows={3} placeholder="Optional context for the call" />
            </Field>

            {message && (
              <p className="rounded-xl border border-flag-good/25 bg-flag-good/[0.08] px-3.5 py-2.5 text-sm text-flag-good">
                {message}
              </p>
            )}
            {error && (
              <p className="rounded-xl border border-flag-critical/25 bg-flag-critical/[0.08] px-3.5 py-2.5 text-sm text-flag-critical">
                {error}
              </p>
            )}

            <Button type="submit" disabled={booking || !calendarReady}>
              {booking ? 'Creating Meet…' : 'Create Google Meet + book'}
            </Button>
            {!calendarReady && (
              <p className="text-xs text-flag-warning">
                Google Calendar is not configured on this deploy, so Meet links cannot be created yet.
              </p>
            )}
          </form>
        </Card>
      )}

      <section>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-300">
          Already booked
        </p>
        <h3 className="mt-1 text-lg font-semibold text-white">Audit Booked</h3>
        <div className="mt-4 space-y-2.5">
          {booked.length === 0 ? (
            <Card className="px-5 py-8 text-center text-sm text-neutral-500" shine={false}>
              No internally booked audits yet.
            </Card>
          ) : (
            booked.map((prospect) => (
              <article
                key={prospect.recordId}
                className="panel rounded-2xl flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{prospect.fullName}</p>
                  <p className="truncate text-xs text-neutral-500">
                    {prospect.email || 'no email'}
                    {prospect.companyName ? ` · ${prospect.companyName}` : ''}
                    {prospect.auditBookedDate ? ` · ${prospect.auditBookedDate}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-xs">
                  {prospect.meetUrl ? (
                    <a href={prospect.meetUrl} className="text-brand-300 hover:underline" target="_blank" rel="noreferrer">
                      Meet
                    </a>
                  ) : (
                    <span className="text-neutral-600">No Meet URL</span>
                  )}
                  {prospect.airtableUrl ? (
                    <a href={prospect.airtableUrl} className="text-neutral-500 hover:underline" target="_blank" rel="noreferrer">
                      Airtable
                    </a>
                  ) : (
                    <span className="text-neutral-600">Not sent</span>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New prospect"
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            setCreateError(null);
            startCreate(async () => {
              const result = await createProspectAction(formData);
              if (!result.ok) {
                setCreateError(result.error);
                return;
              }
              setCreateOpen(false);
              setMessage(result.message);
              if (isClosedStage(result.prospect.stage)) {
                setSelectedId(null);
                runSearch(query, includeManualReview);
                return;
              }
              setSelectedId(result.prospect.recordId);
              const includeManual =
                includeManualReview || result.prospect.qualificationResult === 'Manual Review';
              if (includeManual) setIncludeManualReview(true);
              runSearch(query, includeManual, result.prospect);
            });
          }}
        >
          <p className="text-sm text-neutral-500">
            Stored in the workspace. Score is computed here, then a copy is sent to Airtable when
            the destination PAT is set.
          </p>
          <Field label="Full name">
            <Input name="fullName" required placeholder="Jordan Blake" />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" required placeholder="jordan@example.com" />
          </Field>
          <Field label="Phone">
            <Input name="phone" required placeholder="555-201-8890" />
          </Field>
          <Field label="Company">
            <Input name="companyName" required placeholder="Blake Coaching" />
          </Field>
          <Field label="Monthly ad spend">
            <Select name="adSpend" required defaultValue="$2-5k">
              {AD_SPEND_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Follow-up owner">
            <Select name="followUp" required defaultValue="Founder">
              {FOLLOW_UP_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Program price">
            <Select name="programPrice" required defaultValue="$2-5k">
              {PROGRAM_PRICE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </Field>
          {createError && (
            <p className="rounded-xl border border-flag-critical/25 bg-flag-critical/[0.08] px-3.5 py-2.5 text-sm text-flag-critical">
              {createError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? 'Saving…' : 'Save prospect'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
