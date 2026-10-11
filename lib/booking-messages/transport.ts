import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createRecord, tables, updateRecord } from '@/lib/calls/airtable';
import { resolveAirtableApiKey } from '@/lib/acq/airtable-key';
import { DO_NOT_CONTACT_TAG } from './copy';
import { readBookingMessageConfig, type BookingMessageConfig } from './config';
import {
  afterFailedSend,
  airtableLeadPatch,
  applyDecision,
  contactFromGhl,
  emptyContact,
  emptySlice,
  eventKeys,
  ingest,
  knownPerson,
  markSent,
  normalizePhone,
  prepareSend,
  safeError,
  shouldWriteTouch,
  touchFields,
} from './logic';
import type { Booking, ContactSnapshot, NormalizedEvent, Person, QueuedMessage, Slice } from './types';

const GHL_API = 'https://services.leadconnectorhq.com';

type Db = SupabaseClient;

function database(): Db | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim() || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SECRET_KEY?.trim() || '';
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function config(): BookingMessageConfig {
  return readBookingMessageConfig();
}

async function ghl(path: string, init: RequestInit, version: string): Promise<{ ok: boolean; data: unknown; error: string }> {
  const settings = config();
  if (!settings.pit || !settings.locationId) {
    return { ok: false, data: null, error: 'ghl_not_configured' };
  }
  try {
    const response = await fetch(`${GHL_API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${settings.pit}`,
        Version: version,
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) {
      return { ok: false, data, error: safeError(`${response.status} ${text}`, [settings.pit]) };
    }
    return { ok: true, data, error: '' };
  } catch (error) {
    return { ok: false, data: null, error: safeError(error, [settings.pit]) };
  }
}

function messageIdFrom(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const row = data as Record<string, unknown>;
  const nested = row.message && typeof row.message === 'object' ? (row.message as Record<string, unknown>) : {};
  const id = row.messageId ?? row.message_id ?? nested.id ?? row.id;
  return typeof id === 'string' && id ? id : null;
}

async function readContact(contactId: string): Promise<ContactSnapshot> {
  if (!contactId) return emptyContact();
  const result = await ghl(`/contacts/${encodeURIComponent(contactId)}`, { method: 'GET' }, '2021-07-28');
  if (!result.ok) return emptyContact();
  return contactFromGhl(result.data);
}

async function ensureContact(person: Person): Promise<string> {
  if (person.ghlContactId) return person.ghlContactId;
  const settings = config();
  if (!settings.pit || !settings.locationId) return '';
  if (person.email) {
    const found = await ghl(
      `/contacts/search/duplicate?locationId=${encodeURIComponent(settings.locationId)}&email=${encodeURIComponent(person.email)}`,
      { method: 'GET' },
      '2021-07-28',
    );
    const existing = contactFromGhl(found.data);
    if (existing.id) return existing.id;
  }
  const [firstName, ...rest] = (person.fullName || person.firstName).split(/\s+/);
  const created = await ghl(
    '/contacts/',
    {
      method: 'POST',
      body: JSON.stringify({
        locationId: settings.locationId,
        email: person.email || undefined,
        phone: person.phone || undefined,
        firstName: firstName || person.firstName,
        lastName: rest.join(' ') || undefined,
        name: person.fullName || person.firstName,
        source: 'Free audit booking',
      }),
    },
    '2021-07-28',
  );
  return contactFromGhl(created.data).id ?? '';
}

async function sendMessage(input: {
  contactId: string;
  channel: 'email' | 'sms';
  subject: string;
  body: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const settings = config();
  const payload =
    input.channel === 'sms'
      ? { type: 'SMS', contactId: input.contactId, message: input.body }
      : {
          type: 'Email',
          contactId: input.contactId,
          subject: input.subject,
          message: input.body,
          html: `<div style="font-family:Georgia,serif;font-size:16px;line-height:1.5;color:#111">${input.body
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>')}</div>`,
          emailFrom: `${settings.fromName} <${settings.fromEmail}>`,
        };
  const result = await ghl('/conversations/messages', { method: 'POST', body: JSON.stringify(payload) }, '2021-04-15');
  if (!result.ok) return { ok: false, error: result.error || 'ghl_send_failed' };
  const id = messageIdFrom(result.data);
  if (!id) return { ok: false, error: 'ghl_send_failed: missing message id' };
  return { ok: true, id };
}

async function tagDoNotContact(contactId: string): Promise<void> {
  if (!contactId) return;
  await ghl(
    `/contacts/${encodeURIComponent(contactId)}/tags`,
    { method: 'POST', body: JSON.stringify({ tags: [DO_NOT_CONTACT_TAG] }) },
    '2021-07-28',
  );
  await ghl(
    `/contacts/${encodeURIComponent(contactId)}`,
    { method: 'PUT', body: JSON.stringify({ dnd: true }) },
    '2021-07-28',
  );
}

function personFromRow(row: Record<string, unknown>): Person {
  return knownPerson({
    id: String(row.id),
    email: String(row.email ?? ''),
    phone: String(row.phone ?? ''),
    firstName: String(row.first_name ?? ''),
    fullName: String(row.full_name ?? ''),
    timeZone: String(row.time_zone ?? ''),
    timeZoneSource: (row.time_zone_source as Person['timeZoneSource']) || 'eastern',
    smsConsent: row.sms_consent === true,
    smsConsentAt: (row.sms_consent_at as string | null) ?? null,
    smsConsentWordingVersion: (row.sms_consent_wording_version as string | null) ?? null,
    smsConsentPageUrl: (row.sms_consent_page_url as string | null) ?? null,
    ghlContactId: String(row.ghl_contact_id ?? ''),
    airtableRecordId: String(row.airtable_record_id ?? ''),
    daLeadId: String(row.da_lead_id ?? ''),
    doNotContact: row.do_not_contact === true,
    unmatched: row.unmatched === true,
  });
}

function messageFromRow(row: Record<string, unknown>): QueuedMessage {
  return {
    id: String(row.id),
    personId: String(row.person_id),
    bookingId: (row.booking_id as string | null) ?? null,
    type: row.message_type as QueuedMessage['type'],
    channel: row.channel as QueuedMessage['channel'],
    scheduledFor: String(row.scheduled_for),
    status: row.status as QueuedMessage['status'],
    reason: String(row.reason ?? ''),
    final: row.final === true,
    attempts: Number(row.attempts ?? 0),
    nextAttemptAt: (row.next_attempt_at as string | null) ?? null,
    ghlMessageId: (row.ghl_message_id as string | null) ?? null,
    dryRun: row.dry_run === true,
    flagged: row.flagged === true,
    sentAt: (row.sent_at as string | null) ?? null,
    touchError: String(row.touch_error ?? ''),
  };
}

function bookingFromRow(row: Record<string, unknown>): Booking {
  return {
    id: String(row.id),
    externalId: String(row.external_id),
    personId: String(row.person_id),
    status: row.status as Booking['status'],
    startsAt: String(row.starts_at),
    endsAt: String(row.ends_at),
    timeZone: String(row.time_zone ?? ''),
    meetingLink: String(row.meeting_link ?? ''),
    rescheduleLink: String(row.reschedule_link ?? ''),
    bookingLink: String(row.booking_link ?? ''),
    unmatched: row.unmatched === true,
  };
}

function personRow(person: Person) {
  return {
    id: person.id,
    email: person.email,
    phone: person.phone,
    first_name: person.firstName,
    full_name: person.fullName,
    time_zone: person.timeZone,
    time_zone_source: person.timeZoneSource,
    sms_consent: person.smsConsent,
    sms_consent_at: person.smsConsentAt,
    sms_consent_wording_version: person.smsConsentWordingVersion,
    sms_consent_page_url: person.smsConsentPageUrl,
    ghl_contact_id: person.ghlContactId,
    airtable_record_id: person.airtableRecordId,
    da_lead_id: person.daLeadId || null,
    do_not_contact: person.doNotContact,
    unmatched: person.unmatched,
    updated_at: new Date().toISOString(),
  };
}

function bookingRow(booking: Booking) {
  return {
    id: booking.id,
    external_id: booking.externalId,
    person_id: booking.personId,
    status: booking.status,
    starts_at: booking.startsAt,
    ends_at: booking.endsAt,
    time_zone: booking.timeZone,
    meeting_link: booking.meetingLink,
    reschedule_link: booking.rescheduleLink,
    booking_link: booking.bookingLink,
    unmatched: booking.unmatched,
    updated_at: new Date().toISOString(),
  };
}

function messageRow(message: QueuedMessage) {
  return {
    id: message.id,
    person_id: message.personId,
    booking_id: message.bookingId,
    message_type: message.type,
    channel: message.channel,
    scheduled_for: message.scheduledFor,
    status: message.status,
    reason: message.reason,
    final: message.final,
    attempts: message.attempts,
    next_attempt_at: message.nextAttemptAt,
    ghl_message_id: message.ghlMessageId,
    dry_run: message.dryRun,
    flagged: message.flagged,
    sent_at: message.sentAt,
    touch_error: message.touchError,
    updated_at: new Date().toISOString(),
  };
}

async function loadSlice(db: Db, event: NormalizedEvent): Promise<Slice> {
  const email = event.email?.trim().toLowerCase() ?? '';
  const phone = normalizePhone(event.phone ?? '');
  let person: Person | null = null;
  if (email) {
    const { data } = await db.from('booking_message_people').select('*').eq('email', email).maybeSingle();
    if (data) person = personFromRow(data);
  }
  if (!person && phone) {
    const { data } = await db.from('booking_message_people').select('*').eq('phone', phone).maybeSingle();
    if (data) person = personFromRow(data);
  }
  if (!person && email) {
    const { data } = await db
      .from('da_leads')
      .select(
        'id, email, phone, full_name, ghl_contact_id, airtable_record_id, scheduled_time_zone, sms_consent, sms_consent_at, sms_consent_wording_version, sms_consent_page_url',
      )
      .eq('email', email)
      .maybeSingle();
    if (data) {
      person = knownPerson({
        email: String(data.email ?? email),
        phone: String(data.phone ?? ''),
        fullName: String(data.full_name ?? ''),
        timeZone: String(data.scheduled_time_zone ?? ''),
        smsConsent: data.sms_consent === true,
        smsConsentAt: data.sms_consent_at,
        smsConsentWordingVersion: data.sms_consent_wording_version,
        smsConsentPageUrl: data.sms_consent_page_url,
        ghlContactId: String(data.ghl_contact_id ?? ''),
        airtableRecordId: String(data.airtable_record_id ?? ''),
        daLeadId: String(data.id ?? ''),
        unmatched: false,
      });
    }
  }

  const slice = emptySlice();
  if (!person) return slice;
  slice.people.push(person);
  const { data: bookings } = await db.from('booking_message_bookings').select('*').eq('person_id', person.id);
  const { data: messages } = await db.from('booking_message_messages').select('*').eq('person_id', person.id);
  slice.bookings = (bookings ?? []).map((row) => bookingFromRow(row));
  slice.messages = (messages ?? []).map((row) => messageFromRow(row));
  return slice;
}

async function saveSlice(db: Db, before: Slice, after: Slice, keys: string[], eventType: string) {
  if (after.people.length) {
    const { error } = await db.from('booking_message_people').upsert(after.people.map(personRow));
    if (error) throw new Error(safeError(error.message));
  }
  if (after.bookings.length) {
    const { error } = await db.from('booking_message_bookings').upsert(after.bookings.map(bookingRow));
    if (error) throw new Error(safeError(error.message));
  }
  const changed = after.messages.filter((message) => {
    const prior = before.messages.find((item) => item.id === message.id);
    return !prior || JSON.stringify(prior) !== JSON.stringify(message);
  });
  if (changed.length) {
    const { error } = await db.from('booking_message_messages').upsert(changed.map(messageRow));
    if (error) throw new Error(safeError(error.message));
  }
  if (keys.length) {
    const { error } = await db.from('booking_message_events').upsert(
      keys.map((key) => ({ dedupe_key: key, event_type: eventType, received_at: new Date().toISOString() })),
      { onConflict: 'dedupe_key', ignoreDuplicates: true },
    );
    if (error) throw new Error(safeError(error.message));
  }
}

async function syncAirtable(booking: Booking | undefined, person: Person | undefined) {
  if (!booking || !person?.airtableRecordId) return;
  try {
    await updateRecord(tables.leads, person.airtableRecordId, airtableLeadPatch(booking));
  } catch (error) {
    console.error('[booking-messages] airtable lead update failed', safeError(error));
  }
}

async function writeTouch(message: QueuedMessage, person: Person): Promise<string> {
  if (!shouldWriteTouch(message) || !person.airtableRecordId) {
    return person.airtableRecordId ? '' : 'no_airtable_lead';
  }
  try {
    await createRecord(
      tables.touches,
      touchFields({
        airtableRecordId: person.airtableRecordId,
        channel: message.channel,
        type: message.type,
        sentAt: message.sentAt || new Date().toISOString(),
        leadName: person.fullName || person.firstName,
      }),
    );
    return '';
  } catch (error) {
    const key = await resolveAirtableApiKey().catch(() => '');
    return safeError(error, key ? [key] : []);
  }
}

export async function recordBookingEvent(event: NormalizedEvent): Promise<
  { ok: true; duplicate: boolean; unmatched: boolean } | { ok: false; error: string }
> {
  const db = database();
  if (!db) return { ok: false, error: 'message queue is not configured' };
  try {
    const keys = eventKeys(event);
    const { data: seen } = await db.from('booking_message_events').select('dedupe_key').in('dedupe_key', keys);
    if (seen && seen.length > 0) return { ok: true, duplicate: true, unmatched: false };

    const before = await loadSlice(db, event);
    const outcome = ingest(before, event, new Date(), config());
    if (outcome.duplicate) return { ok: true, duplicate: true, unmatched: false };
    await saveSlice(db, before, outcome.slice, keys, event.type);

    const person = outcome.slice.people[0];
    if (outcome.flags.includes('stop') && person) {
      const contactId = person.ghlContactId || (await ensureContact(person));
      if (contactId && contactId !== person.ghlContactId) {
        person.ghlContactId = contactId;
        await db.from('booking_message_people').upsert(personRow(person));
      }
      await tagDoNotContact(contactId);
    }
    const booking = outcome.slice.bookings.find((item) => item.externalId === event.bookingId) ?? outcome.slice.bookings.at(-1);
    await syncAirtable(booking, person);
    if (outcome.unmatched) {
      console.error('[booking-messages] unmatched booking', event.bookingId || event.email || 'unknown');
    }
    return { ok: true, duplicate: false, unmatched: outcome.unmatched };
  } catch (error) {
    const message = safeError(error, [config().pit]);
    console.error('[booking-messages] record failed', message);
    return { ok: false, error: message };
  }
}

export async function runDueMessages(): Promise<{
  ok: boolean;
  claimed: number;
  results: { id: string; status: string; reason: string }[];
  error?: string;
}> {
  const db = database();
  if (!db) return { ok: false, claimed: 0, results: [], error: 'message queue is not configured' };
  const settings = config();
  const now = new Date();
  const { data, error } = await db
    .from('booking_message_messages')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_for', now.toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(settings.batchSize);
  if (error) return { ok: false, claimed: 0, results: [], error: safeError(error.message, [settings.pit]) };

  const results: { id: string; status: string; reason: string }[] = [];
  for (const row of data ?? []) {
    const message = messageFromRow(row);
    if (message.nextAttemptAt && new Date(message.nextAttemptAt).getTime() > now.getTime()) continue;
    const { data: personRowData } = await db.from('booking_message_people').select('*').eq('id', message.personId).maybeSingle();
    if (!personRowData) {
      const failed = { ...message, status: 'failed' as const, reason: 'missing_person', final: true, flagged: true };
      await db.from('booking_message_messages').upsert(messageRow(failed));
      results.push({ id: message.id, status: failed.status, reason: failed.reason });
      continue;
    }
    const owner = personFromRow(personRowData);
    const { data: bookingRowData } = message.bookingId
      ? await db.from('booking_message_bookings').select('*').eq('id', message.bookingId).maybeSingle()
      : { data: null };
    const booking = bookingRowData ? bookingFromRow(bookingRowData) : null;
    const { data: bookingRows } = await db.from('booking_message_bookings').select('*').eq('person_id', owner.id);
    const bookings = (bookingRows ?? []).map((item) => bookingFromRow(item));
    let contact = emptyContact();
    if (settings.mode !== 'dry-run') {
      const contactId = settings.mode === 'test' ? settings.testContactId : owner.ghlContactId;
      contact = await readContact(contactId);
      if (settings.mode === 'live' && !owner.ghlContactId) {
        const created = await ensureContact(owner);
        if (created) {
          owner.ghlContactId = created;
          contact = await readContact(created);
          await db.from('booking_message_people').upsert(personRow(owner));
        }
      }
    }
    const decision = prepareSend({ message, person: owner, booking, bookings, contact, config: settings, now });
    let saved = message;
    if (decision.action === 'send' && decision.dryRun) {
      saved = markSent(message, now, null, true);
    } else if (decision.action === 'send') {
      const contactId = decision.contactId || (await ensureContact(owner));
      if (!contactId) {
        saved = afterFailedSend(message, now, settings, 'ghl_not_configured');
      } else {
        const sent = await sendMessage({
          contactId,
          channel: message.channel,
          subject: decision.rendered.subject,
          body: decision.rendered.body,
        });
        if (!sent.ok) saved = afterFailedSend(message, now, settings, sent.error);
        else {
          saved = markSent(message, now, sent.id, false);
          const touchError = await writeTouch(saved, owner);
          if (touchError) {
            saved = { ...saved, touchError, flagged: true };
          }
        }
      }
    } else {
      saved = applyDecision(message, decision, now);
    }
    await db.from('booking_message_messages').upsert(messageRow(saved));
    results.push({ id: saved.id, status: saved.status, reason: saved.reason });
  }
  return { ok: results.every((item) => item.status !== 'failed'), claimed: results.length, results };
}

export async function rejectWebhook(reason: string): Promise<void> {
  const db = database();
  if (!db) {
    console.error('[booking-messages] rejected webhook', reason);
    return;
  }
  await db.from('booking_message_rejections').insert({ reason, received_at: new Date().toISOString() });
  console.error('[booking-messages] rejected webhook', reason);
}
