'use server';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { controlRpc, readable, type ActionResult } from '@/lib/ad/rpc';
import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
  createClient,
  getSessionContext,
  supabaseConfigured,
} from '@/lib/supabase/server';
import { localDateTimeToIso } from '@/lib/datetime/local';
import { calendarConfigured, createAssessmentCalendarEvent } from './calendar';
import { bookingLinkForToken, RESEND_CC } from './config';
import {
  sendAssessmentBookingConfirmationEmail,
  sendAssessmentInviteEmail,
} from './email';
import { bookAssessmentInGhl, upsertTalentContact } from './ghl';

type CreatedInvite = {
  id: string;
  token: string;
  email: string;
  full_name: string;
  company_name: string | null;
  expires_at: string;
};

export type AssessmentInviteRow = {
  id: string;
  email: string;
  full_name: string;
  company_name: string | null;
  created_at: string;
  expires_at: string;
  opened_at: string | null;
  used_at: string | null;
  revoked_at: string | null;
  last_sent_at: string;
};

export type AssessmentBookingRow = {
  id: string;
  email: string;
  full_name: string;
  company_name: string | null;
  starts_at: string;
  ends_at: string;
  time_zone: string;
  duration_minutes: number;
  google_meet_url: string | null;
  google_html_link: string | null;
  reminder_sent_at: string | null;
  cancelled_at: string | null;
  created_at: string;
};

type CreatedBooking = {
  id: string;
  email: string;
  full_name: string;
  company_name: string | null;
  starts_at: string;
  ends_at: string;
  time_zone: string;
  duration_minutes: number;
};

export async function sendAssessmentInviteAction(formData: FormData): Promise<ActionResult> {
  if (!supabaseConfigured) {
    return { ok: false, error: 'Supabase is not configured on this deploy.' };
  }

  const session = await getSessionContext();
  if (!session?.isAdmin) {
    return { ok: false, error: 'Admin access required.' };
  }

  const fullName = String(formData.get('fullName') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const companyName = String(formData.get('companyName') ?? '').trim() || null;
  const note = String(formData.get('note') ?? '').trim() || null;

  if (!fullName || !email) {
    return { ok: false, error: 'Name and email are required.' };
  }

  const supabase = await createClient();
  const { data, error } = await controlRpc<CreatedInvite>(supabase, 'create_assessment_invite', {
    p_email: email,
    p_full_name: fullName,
    p_company_name: companyName,
    p_note: note,
  });

  if (error || !data?.token || !data.id) {
    return { ok: false, error: readable(error) };
  }

  const bookingUrl = bookingLinkForToken(data.token);

  let resendId: string | null = null;
  try {
    const sent = await sendAssessmentInviteEmail({
      to: data.email,
      fullName: data.full_name,
      companyName: data.company_name,
      bookingUrl,
      expiresAt: data.expires_at,
    });
    resendId = sent.id;
  } catch (sendError) {
    return {
      ok: false,
      error:
        sendError instanceof Error
          ? `Invite created but email failed: ${sendError.message}`
          : 'Invite created but email failed.',
    };
  }

  const { contactId } = await upsertTalentContact({
    email: data.email,
    fullName: data.full_name,
    companyName: data.company_name,
    note,
  });

  await controlRpc(supabase, 'record_assessment_invite_delivery', {
    p_invite_id: data.id,
    p_resend_email_id: resendId,
    p_ghl_contact_id: contactId,
  });

  revalidatePath('/workspace/calendar-links');
  revalidatePath('/admin');
  return {
    ok: true,
    message: `Invite sent to ${data.email}. Link expires ${new Date(data.expires_at).toLocaleString()}.`,
  };
}

export async function assessmentSignInAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath('/workspace/calendar-links');
  revalidatePath('/admin', 'layout');
  redirect('/workspace/calendar-links');
}

export async function assessmentSignOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/workspace/calendar-links');
  revalidatePath('/admin', 'layout');
  redirect('/workspace/login');
}

export async function listAssessmentInvites(): Promise<AssessmentInviteRow[]> {
  if (!supabaseConfigured) return [];
  const session = await getSessionContext();
  if (!session?.isAdmin) return [];

  const supabase = await createClient();
  const { data, error } = await controlRpc<AssessmentInviteRow[]>(
    supabase,
    'list_assessment_invites',
    { p_limit: 40 },
  );

  if (error || !data) return [];
  return Array.isArray(data) ? data : [];
}

export async function listAssessmentBookings(): Promise<AssessmentBookingRow[]> {
  if (!supabaseConfigured) return [];
  const session = await getSessionContext();
  if (!session?.isAdmin) return [];

  const supabase = await createClient();
  const { data, error } = await controlRpc<AssessmentBookingRow[]>(
    supabase,
    'list_assessment_bookings',
    { p_limit: 40 },
  );

  if (error || !data) return [];
  return Array.isArray(data) ? data : [];
}

/**
 * Admin picks date/time → GHL appointment (PIT) → Google Meet → confirmation email (+ CC).
 * A separate cron sends the 30-minute reminder.
 */
export async function scheduleAssessmentBookingAction(formData: FormData): Promise<ActionResult> {
  if (!supabaseConfigured) {
    return { ok: false, error: 'Supabase is not configured on this deploy.' };
  }

  const session = await getSessionContext();
  if (!session?.isAdmin) {
    return { ok: false, error: 'Admin access required.' };
  }

  const fullName = String(formData.get('fullName') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const companyName = String(formData.get('companyName') ?? '').trim() || null;
  const note = String(formData.get('note') ?? '').trim() || null;
  const timeZone = String(formData.get('timeZone') ?? 'America/New_York').trim() || 'America/New_York';
  const durationMinutes = Number(formData.get('durationMinutes') ?? 30) || 30;
  const localDateTime = String(formData.get('startsAtLocal') ?? '').trim();

  if (!fullName || !email || !localDateTime) {
    return { ok: false, error: 'Name, email, and date/time are required.' };
  }

  // datetime-local has no offset; interpret in the selected IANA zone.
  const startsAtIso = localDateTimeToIso(localDateTime, timeZone);
  if (!startsAtIso) {
    return { ok: false, error: 'Could not parse that date/time.' };
  }

  const supabase = await createClient();
  const { data, error } = await controlRpc<CreatedBooking>(supabase, 'create_assessment_booking', {
    p_email: email,
    p_full_name: fullName,
    p_starts_at: startsAtIso,
    p_time_zone: timeZone,
    p_duration_minutes: durationMinutes,
    p_company_name: companyName,
    p_note: note,
  });

  if (error || !data?.id) {
    return { ok: false, error: readable(error) };
  }

  // GHL via PIT is required — fail the schedule if the appointment cannot be created.
  let ghlContactId: string | null = null;
  let ghlAppointmentId: string | null = null;
  try {
    const ghl = await bookAssessmentInGhl({
      email: data.email,
      fullName: data.full_name,
      companyName: data.company_name,
      note,
      startsAt: data.starts_at,
      endsAt: data.ends_at,
    });
    ghlContactId = ghl.contactId;
    ghlAppointmentId = ghl.appointmentId;
  } catch (ghlError) {
    return {
      ok: false,
      error:
        ghlError instanceof Error
          ? `GHL booking failed (PIT): ${ghlError.message}`
          : 'GHL booking failed via PIT.',
    };
  }

  let meetUrl: string | null = null;
  let calendarUrl: string | null = null;
  let eventId: string | null = null;
  let calendarWarning: string | null = null;

  if (calendarConfigured()) {
    try {
      const attendees = [data.email, ...RESEND_CC, session.email].filter(Boolean);
      const event = await createAssessmentCalendarEvent({
        summary: data.company_name
          ? `Assessment call — ${data.full_name} (${data.company_name})`
          : `Assessment call — ${data.full_name}`,
        description: [
          'Divine Acquisition talent assessment call.',
          data.company_name ? `Company: ${data.company_name}` : null,
          note ? `Note: ${note}` : null,
          ghlAppointmentId ? `GHL appointment: ${ghlAppointmentId}` : null,
        ]
          .filter(Boolean)
          .join('\n'),
        startsAt: data.starts_at,
        endsAt: data.ends_at,
        timeZone: data.time_zone,
        attendeeEmails: attendees,
      });
      eventId = event.eventId;
      meetUrl = event.meetUrl;
      calendarUrl = event.htmlLink;
    } catch (calendarError) {
      calendarWarning =
        calendarError instanceof Error
          ? `Calendar/Meet failed: ${calendarError.message}`
          : 'Calendar/Meet failed.';
    }
  } else {
    calendarWarning =
      'Google Calendar is not configured (set GOOGLE_CALENDAR_SUBJECT_EMAIL / service account).';
  }

  let confirmationId: string | null = null;
  try {
    const sent = await sendAssessmentBookingConfirmationEmail({
      to: data.email,
      fullName: data.full_name,
      companyName: data.company_name,
      startsAt: data.starts_at,
      timeZone: data.time_zone,
      durationMinutes: data.duration_minutes,
      meetUrl,
      calendarUrl,
    });
    confirmationId = sent.id;
  } catch (sendError) {
    return {
      ok: false,
      error:
        sendError instanceof Error
          ? `Booking saved but confirmation email failed: ${sendError.message}`
          : 'Booking saved but confirmation email failed.',
    };
  }

  await controlRpc(supabase, 'record_assessment_booking_calendar', {
    p_booking_id: data.id,
    p_google_event_id: eventId,
    p_google_meet_url: meetUrl,
    p_google_html_link: calendarUrl,
    p_confirmation_email_id: confirmationId,
    p_ghl_contact_id: ghlContactId,
    p_ghl_appointment_id: ghlAppointmentId,
  });

  revalidatePath('/workspace/calendar-links');
  revalidatePath('/admin');

  const when = new Date(data.starts_at).toLocaleString('en-US', { timeZone: data.time_zone });
  return {
    ok: true,
    message: [
      `Booked ${data.full_name} for ${when}.`,
      'Created in GHL Assessment Interview calendar via PIT.',
      'Confirmation emailed (CC Malik).',
      '30-minute reminder will send automatically.',
      calendarWarning,
    ]
      .filter(Boolean)
      .join(' '),
  };
}

export type ValidatedInvite = {
  id: string;
  full_name: string;
  email: string;
  company_name: string | null;
  expires_at: string;
  used_at: string | null;
};

export async function validateAssessmentToken(
  token: string,
): Promise<{ ok: true; invite: ValidatedInvite } | { ok: false; error: string }> {
  if (!supabaseConfigured) {
    return { ok: false, error: 'Booking is temporarily unavailable.' };
  }

  const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await controlRpc<ValidatedInvite>(supabase, 'validate_assessment_invite', {
    p_token: token,
  });

  if (error || !data) {
    return { ok: false, error: readable(error) };
  }

  return { ok: true, invite: data };
}

export async function markAssessmentUsed(token: string): Promise<void> {
  if (!supabaseConfigured || !token) return;

  const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await controlRpc(supabase, 'mark_assessment_invite_used', { p_token: token });
}
