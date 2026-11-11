/** The Pipeline desk: every inquiry as a lead, its booking, and its discovery calls. */
/** The desk pill tones (see app/workspace/(staff)/components/desk.tsx). */
export type Tone = 'neutral' | 'brand' | 'good' | 'warn' | 'bad';

export const STAGES = [
  'Manual Review',
  'Qualified - Not Booked',
  'Audit Booked',
  'No Show',
  'Audit Held',
  'Closed Won',
  'Closed Lost',
  'Disqualified',
  'Recycled',
  'Step 1 Captured',
  'Application Abandoned',
] as const;

/** What each stage reads as on this desk. The values stay the GHL and Airtable stages. */
export const STAGE_LABEL: Record<string, string> = {
  'Step 1 Captured': 'Started a form',
  'Application Abandoned': 'Form abandoned',
  'Manual Review': 'Needs review',
  'Qualified - Not Booked': 'Not booked yet',
  'Audit Booked': 'Call booked',
  'No Show': 'No show',
  'Audit Held': 'Call held',
  'Closed Won': 'Won',
  'Closed Lost': 'Lost',
  Disqualified: 'Not a fit',
  Recycled: 'Recycled',
};

const STAGE_TONE: Record<string, Tone> = {
  'Manual Review': 'warn',
  'Qualified - Not Booked': 'warn',
  'Audit Booked': 'brand',
  'No Show': 'bad',
  'Audit Held': 'good',
  'Closed Won': 'good',
};

export function stageTone(stage: string): Tone {
  return STAGE_TONE[stage] ?? 'neutral';
}

export const INQUIRY_LABEL: Record<string, string> = {
  diagnostic: 'Diagnostic request',
  discovery: 'Pre-discovery answers',
  sales_review: 'Sales operations review',
  cleaning_audit: 'Cleaning audit',
};

export const CALL_OUTCOMES = [
  { value: 'held', label: 'Held the call', stage: 'Audit Held' },
  { value: 'follow_up', label: 'Follow-up needed', stage: null },
  { value: 'no_show', label: 'They did not show', stage: 'No Show' },
  { value: 'won', label: 'Won: they signed', stage: 'Closed Won' },
  { value: 'lost', label: 'Lost', stage: 'Closed Lost' },
] as const;

export type CallOutcome = (typeof CALL_OUTCOMES)[number]['value'];

export function outcomeLabel(value: string | null): string {
  return CALL_OUTCOMES.find((item) => item.value === value)?.label ?? 'Call';
}

export type LeadBooking = { status: string; starts_at: string | null; time_zone: string | null; meeting_link?: string | null } | null;

export type PipelineRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  stage: string;
  source: string;
  next_action: string | null;
  created_at: string;
  booking: LeadBooking;
  inquiries: number;
  last_inquiry: { kind: string; at: string } | null;
  calls: number;
  last_activity: string;
};

export type LeadDetail = {
  lead: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    company: string | null;
    stage: string;
    source: string;
    next_action: string | null;
    notes: string | null;
    ghl_contact_id: string | null;
    created_at: string;
    updated_at: string;
  };
  booking: LeadBooking;
  bookings: Array<{ status: string; starts_at: string | null; time_zone: string | null; updated_at: string }>;
  inquiries: Array<{ id: string; kind: string; created_at: string; answers: Array<[string, string]> }>;
  calls: Array<{ id: string; occurred_at: string; outcome: string | null; notes: string | null; by: string | null }>;
};

const ZONE_SHORT: Record<string, string> = {
  'America/Chicago': 'CT',
  'America/New_York': 'ET',
  'America/Denver': 'MT',
  'America/Los_Angeles': 'PT',
  'America/Phoenix': 'MST',
};

/** "Thu, Nov 13, 2:00 PM CT" in the booking's own time zone. */
export function bookingTime(iso: string | null, zone: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const timeZone = zone || 'America/Chicago';
  let text: string;
  try {
    text = date.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone });
  } catch {
    text = date.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' });
  }
  const short = ZONE_SHORT[timeZone];
  return short ? `${text} ${short}` : text;
}

export function bookingSummary(booking: LeadBooking, now: Date = new Date()): { label: string; tone: Tone } {
  if (!booking) return { label: 'Not booked', tone: 'neutral' };
  const when = bookingTime(booking.starts_at, booking.time_zone);
  const past = booking.starts_at ? new Date(booking.starts_at).getTime() < now.getTime() : false;
  switch (booking.status) {
    case 'booked':
    case 'rescheduled':
      return { label: past ? `Was booked ${when}` : `Booked ${when}`, tone: past ? 'warn' : 'brand' };
    case 'held':
      return { label: `Held ${when}`, tone: 'good' };
    case 'no_show':
      return { label: `No show ${when}`, tone: 'bad' };
    case 'cancelled':
      return { label: 'Cancelled', tone: 'bad' };
    default:
      return { label: booking.status, tone: 'neutral' };
  }
}

export function leadName(row: { full_name: string | null; email: string | null; company: string | null }): string {
  return row.full_name || row.company || row.email || 'Unnamed lead';
}

/** "Key: value" lines from a GHL note, for forms that only build a note. */
export function answersFromNote(note: string): Array<[string, string]> {
  return note
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const at = line.indexOf(':');
      return at > 0 ? ([line.slice(0, at).trim(), line.slice(at + 1).trim()] as [string, string]) : (['Note', line] as [string, string]);
    });
}
