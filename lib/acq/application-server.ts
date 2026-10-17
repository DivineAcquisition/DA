import { cookies } from 'next/headers';
import { recordBookingEvent, stopApplicationRecovery } from '@/lib/booking-messages/transport';
import { applicationNotifyTo, sendCompletedApplicationEmail } from './application-email';
import { alertSubject, internalAlertText, runApplicationDelivery } from './application-deliver';
import { ACQ_PUBLIC_ORIGIN } from './config';
import { sendGhlSms } from './ghl-sms';
import { serviceRoleClient } from '@/lib/workspace/db';
import { touchFromTracking, type Touch } from './application-attribution';
import { countApplications, type ApplyDayCount, type ApplyEvent } from './application-events';
import {
  createApplyFlow,
  type ApplyDeps,
  type ApplyRecord,
  type RetryJob,
} from './application-flow';
import { moveGhlLead } from './ghl-lifecycle';
import {
  addGhlTags,
  ghlReady,
  logPipelineFailure,
  upsertAirtableLead,
  upsertGhlContact,
} from './pipeline';
import { stepOneTags } from './application-route';
import type { QualificationPayload } from './qualify';

const memory = new Map<string, ApplyRecord>();
const emailIndex = new Map<string, string>();
const events: ApplyEvent[] = [];
const retries: RetryJob[] = [];
const hits = new Map<string, number[]>();

const originalPush = events.push.bind(events);
events.push = (...items: ApplyEvent[]) => {
  const count = originalPush(...items);
  for (const item of items) {
    void persistEvent(item).catch((error) => console.error('[acq:apply-event]', error));
  }
  return count;
};

function rateLimit(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((at) => now - at < 10 * 60_000);
  if (recent.length >= 12) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

function applicationNote(record: ApplyRecord): string {
  const lines = [
    record.answers.adSpend ? `Ad spend: ${record.answers.adSpend}` : null,
    record.answers.offerPrice ? `Offer price: ${record.answers.offerPrice}` : null,
    record.answers.callTaker ? `Sales calls: ${record.answers.callTaker}` : null,
    record.answers.problem ? `Biggest problem: ${record.answers.problem}` : null,
    record.route ? `Route: ${record.route.screen}` : null,
    record.route?.priority ? `Priority: ${record.route.priority}` : null,
    `Source ad: ${record.sourceAd || 'direct'}`,
    `First touch: ${record.firstTouch.source || 'direct'} / ${record.firstTouch.campaign || 'none'} / ${record.firstTouch.content || 'direct'}`,
    `Last touch: ${record.lastTouch.source || 'direct'} / ${record.lastTouch.campaign || 'none'} / ${record.lastTouch.content || 'direct'}`,
    `SMS consent: ${record.contact.smsConsent ? 'yes' : 'no'}`,
    `SMS wording: ${record.contact.consentWording}`,
    `Consent at: ${record.contact.consentAt}`,
    record.contact.consentPage ? `Consent page: ${record.contact.consentPage}` : null,
    `Step 1 at: ${record.step1At}`,
    record.step2At ? `Step 2 at: ${record.step2At}` : null,
    record.test ? 'Test: yes' : null,
  ];
  return lines.filter((line): line is string => Boolean(line)).join('\n');
}

function toPayload(record: ApplyRecord): QualificationPayload {
  const content = record.sourceAd === 'direct' ? '' : record.sourceAd;
  return {
    fullName: record.contact.firstName,
    firstName: record.contact.firstName,
    lastName: '',
    email: record.contact.email,
    phone: record.contact.phone,
    companyName: '',
    coachingNiche: 'Coach application',
    monthlyAdSpend: '',
    inquiriesPerMonth: null,
    followUpOwner: '',
    followUpOwnerLabel: '',
    programPrice: '',
    smsConsent: record.contact.smsConsent,
    emailConsent: false,
    leadSource: 'Paid Ad',
    entryPoint: 'Landing Page',
    stage: record.route?.stage ?? 'Step 1 Captured',
    source: 'Founding Install Qualification',
    tags: stepOneTags(record.contact.smsConsent),
    tracking: {
      utm_source: record.lastTouch.source || undefined,
      utm_medium: record.lastTouch.medium || undefined,
      utm_campaign: record.lastTouch.campaign || undefined,
      utm_content: content || undefined,
      utm_term: record.lastTouch.term || undefined,
      utm_id: record.lastTouch.id || undefined,
    },
    consentPageUrl: record.contact.consentPage,
    applicationNote: applicationNote(record),
  };
}

async function syncAirtable(record: ApplyRecord) {
  try {
    await upsertAirtableLead(toPayload(record), record.ghlContactId);
    return { ok: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'airtable_failed';
    await logPipelineFailure('airtable-apply', record.contact.email, error);
    return { ok: false as const, error: message };
  }
}

async function persistLead(record: ApplyRecord) {
  const db = serviceRoleClient();
  if (!db) return;
  const payload = {
    scheduleToken: record.token,
    application: record,
    sourceAd: record.sourceAd,
    test: record.test,
    tags: record.route?.tags ?? stepOneTags(record.contact.smsConsent),
  };
  const row = {
    full_name: record.contact.firstName,
    email: record.contact.email,
    phone: record.contact.phone,
    stage: record.route?.stage ?? 'Step 1 Captured',
    qualification_result: record.route ? (record.route.screen === 'calendar' ? 'Qualified' : 'Disqualified') : null,
    monthly_ad_spend: record.answers.adSpend ?? '',
    follow_up_owner: record.answers.callTaker ?? '',
    program_price: record.answers.offerPrice ?? '',
    ghl_contact_id: record.ghlContactId,
    schedule_token: record.token,
    sms_consent: record.contact.smsConsent,
    sms_consent_at: record.contact.consentAt,
    sms_consent_wording_version: 'acq-reminders-2026-10-17',
    sms_consent_page_url: record.contact.consentPage,
    notes: applicationNote(record),
    payload,
  };
  const { data: existing } = await db.from('da_leads').select('id').eq('email', record.contact.email).limit(1);
  const id = existing?.[0]?.id as string | undefined;
  if (id) await db.from('da_leads').update(row).eq('id', id);
  else await db.from('da_leads').insert(row);
}

async function persistEvent(event: ApplyEvent) {
  const db = serviceRoleClient();
  if (!db) return;
  await db.from('acq_apply_events').insert({
    created_at: event.at,
    email: event.email,
    ad_name: event.adName,
    event_name: event.name,
    screen: event.screen ?? null,
    question: event.question ?? null,
    test: event.test,
  });
}

async function save(record: ApplyRecord) {
  memory.set(record.token, record);
  emailIndex.set(record.contact.email, record.token);
  try {
    await persistLead(record);
  } catch (error) {
    console.error('[acq:apply-save]', error);
  }
}

const deps: ApplyDeps = {
  now: () => new Date(),
  load: async (token) => memory.get(token) ?? null,
  loadByEmail: async (email) => {
    const token = emailIndex.get(email);
    return token ? memory.get(token) ?? null : null;
  },
  save,
  events,
  retries,
  rateLimit,
  syncGhl,
  syncAirtable,
  startRecovery: async (record) => {
    const recorded = await recordBookingEvent({
      type: 'application',
      email: record.contact.email,
      phone: record.contact.phone,
      fullName: record.contact.firstName,
      firstName: record.contact.firstName,
      smsConsent: record.contact.smsConsent,
      smsConsentAt: record.contact.smsConsent ? record.contact.consentAt : null,
      smsConsentWordingVersion: record.contact.smsConsent ? 'acq-reminders-2026-10-17' : null,
      smsConsentPageUrl: record.contact.consentPage,
      ghlContactId: record.ghlContactId || undefined,
    });
    if (!recorded.ok) throw new Error(recorded.error);
  },
  stopRecovery: async (email) => {
    await stopApplicationRecovery(email);
  },
  backgroundComplete: true,
};

export const applyFlow = createApplyFlow(deps);

export async function listApplicationCounts(): Promise<ApplyDayCount[]> {
  const db = serviceRoleClient();
  if (!db) return countApplications(events);
  const { data, error } = await db
    .from('acq_apply_events')
    .select('created_at, email, ad_name, event_name, screen, question, test')
    .order('created_at', { ascending: false })
    .limit(5000);
  if (error || !data) return countApplications(events);
  return countApplications(
    data.map((row: {
      created_at?: string;
      email?: string;
      ad_name?: string;
      event_name?: ApplyEvent['name'];
      screen?: string | null;
      question?: number | null;
      test?: boolean;
    }) => ({
      at: row.created_at || new Date(0).toISOString(),
      email: row.email || '',
      adName: row.ad_name || 'direct',
      name: row.event_name || 'popup_opened',
      screen: row.screen || undefined,
      question: row.question ?? undefined,
      test: Boolean(row.test),
    })),
  );
}

export function storedApplication(token: string): ApplyRecord | null {
  return memory.get(token) ?? null;
}

export async function deliverCompletedApplication(token: string): Promise<void> {
  const record = memory.get(token);
  if (!record?.route) return;
  await runApplicationDelivery(record, {
    now: () => new Date(),
    log: logPipelineFailure,
    ghl: (current, note) => syncGhl(current, current.route?.tags ?? [], note),
    vistrial: (current, pdf, fileName) => deliverToVistrial(current, pdf, fileName),
    airtable: (current) => syncAirtable(current),
    email: async (current, pdf, fileName, caseFileUrl) => {
      const text = [
        current.test ? '[TEST]' : null,
        `Name: ${current.contact.firstName}`,
        `Email: ${current.contact.email}`,
        `Phone: ${current.contact.phone}`,
        `Ad spend: ${current.answers.adSpend || ''}`,
        `Offer price: ${current.answers.offerPrice || ''}`,
        `Sales calls: ${current.answers.callTaker || ''}`,
        `Biggest problem: ${current.answers.problem || ''}`,
        `Route: ${current.route?.screen || ''} ${current.route?.priority || ''}`.trim(),
        `Source ad: ${current.sourceAd || 'direct'}`,
        caseFileUrl ? `Case file: ${caseFileUrl}` : null,
        current.ghlContactId ? `GHL contact: ${current.ghlContactId}` : null,
      ]
        .filter((line): line is string => Boolean(line))
        .join('\n');
      await sendCompletedApplicationEmail({
        to: applicationNotifyTo(),
        subject: alertSubject(current),
        text,
        filename: fileName,
        pdf,
      });
      return { ok: true };
    },
    text: async (current, message) => {
      const numbers = (process.env.ACQ_INTERNAL_ALERT_PHONES ?? '')
        .split(/[,\s]+/)
        .map((value) => value.trim())
        .filter(Boolean);
      if (!numbers.length) return { ok: false, error: 'no numbers configured' };
      const sent: string[] = [];
      for (const phone of numbers) {
        const contactId = await ensureInternalAlertContact(phone);
        await sendGhlSms(contactId, message);
        sent.push(phone);
      }
      if (message.includes(current.contact.email) || message.includes(current.contact.phone)) {
        return { ok: false, error: 'text included contact details' };
      }
      return { ok: true, sent };
    },
    savePdf: async (current) => ({
      ok: true,
      url: `${ACQ_PUBLIC_ORIGIN}/workspace/acq-applications/${current.token}`,
    }),
  });
  record.deliveryPending = false;
  await save(record);
}

async function syncGhl(record: ApplyRecord, tags: string[], note?: string) {
  const payload = toPayload(record);
  if (note) payload.applicationNote = `${payload.applicationNote || ''}\n${note}`.trim();
  try {
    if (!(await ghlReady())) return { ok: false as const, error: 'ghl_not_configured' };
    const contact = await upsertGhlContact(payload);
    await addGhlTags(contact.contactId, tags.concat(record.test ? ['da-test'] : []), 'ghl-apply');
    await moveGhlLead({
      contactId: contact.contactId,
      stage: record.route?.stage ?? 'Step 1 Captured',
      name: record.contact.firstName,
    });
    return { ok: true as const, contactId: contact.contactId };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ghl_failed';
    await logPipelineFailure('ghl-apply', record.contact.email, error);
    return { ok: false as const, error: message };
  }
}

async function deliverToVistrial(record: ApplyRecord, pdf: Uint8Array, fileName: string) {
  const base = process.env.VISTRIAL_API_BASE?.trim().replace(/\/$/, '') || '';
  const key = process.env.VISTRIAL_API_KEY?.trim() || '';
  if (!base || !key) return { ok: false as const, off: true as const };
  const headers = {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    'Idempotency-Key': `${record.token}:lead`,
  };
  const created = await fetch(`${base}/api/v1/leads`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      first_name: record.contact.firstName,
      email: record.contact.email,
      phone: record.contact.phone,
      source: record.test ? 'Test' : 'Application form',
      fields: [
        { key: 'ad_spend', label: 'Ad spend', value: record.answers.adSpend || '' },
        { key: 'offer_price', label: 'Offer price', value: record.answers.offerPrice || '' },
        { key: 'sales_calls', label: 'Sales calls', value: record.answers.callTaker || '' },
        { key: 'biggest_problem', label: 'Biggest problem', value: record.answers.problem || '' },
        { key: 'route', label: 'Route', value: record.route?.screen || '' },
        { key: 'priority', label: 'Priority', value: record.route?.priority || '' },
        { key: 'source_ad', label: 'Source ad', value: record.sourceAd || 'direct' },
      ].filter((field) => field.value),
    }),
  });
  const leadBody = (await created.json()) as { data?: { id?: string }; id?: string };
  const leadId = leadBody.data?.id || leadBody.id || '';
  if (!created.ok || !leadId) return { ok: false as const, error: `vistrial ${created.status}` };
  await fetch(`${base}/api/v1/notes`, {
    method: 'POST',
    headers: { ...headers, 'Idempotency-Key': `${record.token}:note` },
    body: JSON.stringify({ lead_id: leadId, body: 'Application submitted.' }),
  });
  await fetch(`${base}/api/v1/leads/${leadId}/files`, {
    method: 'POST',
    headers: { ...headers, 'Idempotency-Key': `${record.token}:file` },
    body: JSON.stringify({
      file_name: fileName,
      content_type: 'application/pdf',
      content_base64: Buffer.from(pdf).toString('base64'),
      source: record.test ? 'Test' : 'Application form',
    }),
  });
  return { ok: true as const, leadId, url: `${base}/app/cases/${leadId}` };
}

async function ensureInternalAlertContact(phone: string): Promise<string> {
  const found = await searchGhlByPhone(phone);
  if (found) {
    await addGhlTags(found, ['da-internal-alert'], 'ghl-internal');
    return found;
  }
  const payload = toPayload({
    token: `internal-${phone}`,
    contact: {
      firstName: 'Internal alert',
      email: '',
      phone,
      smsConsent: false,
      consentWording: '',
      consentAt: '',
      consentPage: '',
    },
    answers: {},
    answeredAt: {},
    firstTouch: { source: '', medium: '', campaign: '', content: '', term: '', id: '' },
    lastTouch: { source: '', medium: '', campaign: '', content: '', term: '', id: '' },
    sourceAd: 'direct',
    test: false,
    route: null,
    step1At: '',
    step2At: '',
    updatedAt: '',
    ghlContactId: '',
    recovery: 'skipped',
    failures: [],
  });
  payload.email = `internal-alert-${phone.replace(/\D/g, '')}@divineacquisition.io`;
  payload.phone = phone;
  payload.firstName = 'Internal';
  payload.lastName = 'alert';
  payload.fullName = 'Internal alert';
  payload.tags = ['da-internal-alert'];
  const contact = await upsertGhlContact(payload);
  await addGhlTags(contact.contactId, ['da-internal-alert'], 'ghl-internal');
  return contact.contactId;
}

async function searchGhlByPhone(phone: string): Promise<string | null> {
  return null;
}

export function readStoredTouch(raw: string | undefined): Touch | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Touch>;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      source: String(parsed.source ?? ''),
      medium: String(parsed.medium ?? ''),
      campaign: String(parsed.campaign ?? ''),
      content: String(parsed.content ?? ''),
      term: String(parsed.term ?? ''),
      id: String(parsed.id ?? ''),
    };
  } catch {
    return null;
  }
}

export async function rememberTouches(incoming: Touch | null, first: Touch | null, last: Touch | null) {
  const jar = await cookies();
  const secure = process.env.NODE_ENV === 'production';
  const base = { httpOnly: true, sameSite: 'lax' as const, secure, path: '/', maxAge: 60 * 60 * 24 * 180 };
  if (!first && incoming) jar.set('acq_ft', JSON.stringify(incoming), base);
  if (!first && !incoming) jar.set('acq_ft', JSON.stringify({ source: 'direct', medium: '', campaign: '', content: 'direct', term: '', id: '' }), base);
  if (incoming) jar.set('acq_lt', JSON.stringify(incoming), base);
  else if (!last) jar.set('acq_lt', JSON.stringify({ source: 'direct', medium: '', campaign: '', content: 'direct', term: '', id: '' }), base);
}
