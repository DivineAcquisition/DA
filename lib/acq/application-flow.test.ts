import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cancelApplicationMessages, emptySlice, ingest } from '@/lib/booking-messages/logic';
import { readBookingMessageConfig } from '@/lib/booking-messages/config';
import { directTouch, mergeAttribution, touchFromTracking } from './application-attribution';
import { countApplications } from './application-events';
import {
  createApplyFlow,
  normalizePhone,
  publicShape,
  type ApplyDeps,
  type ApplyRecord,
  type RetryJob,
} from './application-flow';
import { routeApplication } from './application-route';

const NOW = new Date('2026-10-17T15:00:00.000Z');

function harness(options: { ghl?: boolean; airtable?: boolean; backgroundComplete?: boolean } = {}) {
  const records = new Map<string, ApplyRecord>();
  const events: ApplyDeps['events'] = [];
  const retries: RetryJob[] = [];
  const ghl = new Map<string, string>();
  let ghlCalls = 0;
  let ghlUp = options.ghl !== false;
  const airtableUp = options.airtable !== false;
  let recoveryStarts = 0;
  let recoveryStops = 0;
  const deps: ApplyDeps = {
    now: () => NOW,
    load: async (token) => records.get(token) ?? null,
    loadByEmail: async (email) => {
      for (const record of records.values()) {
        if (record.contact.email === email) return record;
      }
      return null;
    },
    save: async (record) => {
      records.set(record.token, record);
    },
    events,
    retries,
    rateLimit: () => true,
    syncGhl: async (record) => {
      ghlCalls += 1;
      if (!ghlUp) return { ok: false, error: 'ghl_down' };
      const id = ghl.get(record.contact.email) ?? `ghl_${ghl.size + 1}`;
      ghl.set(record.contact.email, id);
      return { ok: true, contactId: id };
    },
    syncAirtable: async () => (airtableUp ? { ok: true } : { ok: false, error: 'airtable_down' }),
    startRecovery: async () => {
      recoveryStarts += 1;
    },
    stopRecovery: async () => {
      recoveryStops += 1;
    },
    backgroundComplete: options.backgroundComplete,
  };
  return {
    flow: createApplyFlow(deps),
    records,
    events,
    retries,
    ghl,
    ghlCalls: () => ghlCalls,
    recoveryStarts: () => recoveryStarts,
    recoveryStops: () => recoveryStops,
    setGhl(up: boolean) {
      ghlUp = up;
    },
  };
}

const contact = {
  firstName: 'Jordan',
  email: 'jordan@blake.test',
  phone: '(202) 555-0199',
  key: 'ip',
  incoming: null,
  storedFirst: null,
  storedLast: null,
};

async function finish(
  box: ReturnType<typeof harness>,
  token: string,
  answers: [string, string, string, string],
) {
  let last: Awaited<ReturnType<typeof box.flow.answer>> | null = null;
  for (const [index, value] of answers.entries()) {
    last = await box.flow.answer({ token, question: index + 1, value });
  }
  return last;
}

describe('application routing', () => {
  it('priority A reaches the calendar with the qualified tags', () => {
    const route = routeApplication({
      adSpend: '$10K+',
      offerPrice: '$6K to $10K',
      callTaker: 'A closer',
      problem: "Leads don't book",
    });
    expect(route?.screen).toBe('calendar');
    expect(route?.priority).toBe('A');
    expect(route?.stage).toBe('Qualified - Not Booked');
    expect(route?.tags).toEqual(
      expect.arrayContaining(['da-app-complete', 'da-qualified', 'da-priority-a', 'application - complete']),
    );
  });

  it('priority B reaches the calendar', () => {
    const route = routeApplication({
      adSpend: '$5K to $10K',
      offerPrice: '$3K to $6K',
      callTaker: 'Me',
      problem: "Calls don't close",
    });
    expect(route?.screen).toBe('calendar');
    expect(route?.priority).toBe('B');
    expect(route?.tags).toContain('da-priority-b');
  });

  it.each([
    ['Not running ads', '$6K to $10K', 'A closer'],
    ['$10K+', 'Under $3K', 'Me'],
    ['$10K+', '$10K+', 'Nobody yet'],
  ] as const)('hard no %s / %s / %s stays off the calendar', (adSpend, offerPrice, callTaker) => {
    const route = routeApplication({
      adSpend,
      offerPrice,
      callTaker,
      problem: "Booked calls don't show",
    });
    expect(route?.screen).toBe('closed');
    expect(route?.tags).toEqual(expect.arrayContaining(['da-not-a-fit', 'trigger-da-nurture', 'da-app-complete']));
    expect(route?.stage).toBe('Recycled');
  });

  it('spend under $5K with an otherwise fine offer is not yet', () => {
    const route = routeApplication({
      adSpend: 'Under $5K',
      offerPrice: '$6K to $10K',
      callTaker: 'A setter and a closer',
      problem: "My team can't keep up",
    });
    expect(route?.screen).toBe('later');
    expect(route?.tags).toEqual(expect.arrayContaining(['da-not-yet-spend', 'trigger-da-nurture']));
  });

  it('a hard no wins when spend is also under $5K', () => {
    const route = routeApplication({
      adSpend: 'Under $5K',
      offerPrice: 'Under $3K',
      callTaker: 'Nobody yet',
      problem: "I can't tell where deals die",
    });
    expect(route?.screen).toBe('closed');
    expect(route?.tags).not.toContain('da-not-yet-spend');
  });
});

describe('application flow', () => {
  it('quitting after step 1 keeps one contact and starts recovery', async () => {
    const box = harness();
    const first = await box.flow.start(contact);
    const second = await box.flow.start(contact);
    if (!first.ok || !second.ok || !first.token) throw new Error('start');
    expect(second.token).toBe(first.token);
    expect(box.records.size).toBe(1);
    expect(box.ghl.size).toBe(1);
    expect(box.recoveryStarts()).toBe(1);
    expect(box.records.get(first.token)?.recovery).toBe('running');
  });

  it('quitting at question 3 keeps the partial answers', async () => {
    const box = harness();
    const started = await box.flow.start(contact);
    if (!started.ok || !started.token) throw new Error('start');
    await box.flow.answer({ token: started.token, question: 1, value: '$10K+' });
    await box.flow.answer({ token: started.token, question: 2, value: '$10K+' });
    await box.flow.answer({ token: started.token, question: 3, value: 'A closer' });
    const saved = box.records.get(started.token);
    expect(saved?.answers).toEqual({ adSpend: '$10K+', offerPrice: '$10K+', callTaker: 'A closer' });
    expect(saved?.route).toBeNull();
    expect(saved?.recovery).toBe('running');
  });

  it('finishing step 2 stops recovery and does not reveal the rules', async () => {
    const box = harness();
    const started = await box.flow.start({ ...contact, smsConsent: true, page: 'https://acq.divineacquisition.io/' });
    if (!started.ok || !started.token) throw new Error('start');
    const done = await finish(box, started.token, ['$10K+', '$10K+', 'Me', "Leads don't book"]);
    const shown = publicShape(done!);
    expect(shown).toEqual({ ok: true, screen: 'calendar' });
    expect(JSON.stringify(shown)).not.toMatch(/priority|da-not|Under \$5K|Not running ads/);
    expect(box.records.get(started.token)?.recovery).toBe('stopped');
    expect(box.recoveryStops()).toBe(1);
    expect(box.records.get(started.token)?.contact.smsConsent).toBe(true);
    expect(box.records.get(started.token)?.contact.consentWording).toContain('Reply STOP');
  });

  it('records consent left unchecked', async () => {
    const box = harness();
    const started = await box.flow.start(contact);
    if (!started.ok || !started.token) throw new Error('start');
    const saved = box.records.get(started.token);
    expect(saved?.contact.smsConsent).toBe(false);
    expect(saved?.contact.consentWording).toContain('appointment reminders');
    expect(saved?.contact.consentAt).toBe(NOW.toISOString());
  });

  it('keeps first touch and updates last touch', async () => {
    const box = harness();
    const firstVisit = touchFromTracking({
      utm_source: 'facebook',
      utm_campaign: 'spring',
      utm_content: 'AdNameOne',
    });
    const started = await box.flow.start({ ...contact, incoming: firstVisit, storedFirst: null, storedLast: null });
    if (!started.ok || !started.token) throw new Error('start');
    const second = touchFromTracking({ utm_source: 'facebook', utm_campaign: 'fall', utm_content: 'AdNameTwo' });
    await box.flow.start({ ...contact, incoming: second, storedFirst: null, storedLast: null });
    const saved = box.records.get(started.token);
    expect(saved?.firstTouch.campaign).toBe('spring');
    expect(saved?.firstTouch.content).toBe('AdNameOne');
    expect(saved?.lastTouch.campaign).toBe('fall');
    expect(saved?.lastTouch.content).toBe('AdNameTwo');
    expect(saved?.sourceAd).toBe('AdNameOne');
  });

  it('records a visit with no parameters as direct', async () => {
    const box = harness();
    const started = await box.flow.start(contact);
    if (!started.ok || !started.token) throw new Error('start');
    expect(box.records.get(started.token)?.sourceAd).toBe('direct');
    expect(box.records.get(started.token)?.firstTouch).toEqual(directTouch());
  });

  it('keeps the visitor moving when GHL is down and retries later', async () => {
    const box = harness({ ghl: false });
    const started = await box.flow.start(contact);
    if (!started.ok || !started.token) throw new Error('start');
    const done = await finish(box, started.token, ['$5K to $10K', '$3K to $6K', 'Me', "Calls don't close"]);
    expect(done).toEqual({ ok: true, screen: 'calendar' });
    expect(box.retries.some((job) => job.kind === 'ghl')).toBe(true);
    box.setGhl(true);
    expect(await box.flow.retry()).toBeGreaterThan(0);
    expect(box.retries.filter((job) => job.kind === 'ghl')).toHaveLength(0);
    expect(box.ghl.get('jordan@blake.test')).toBeTruthy();
  });

  it('restores the same-day answers and ignores a repeated tap', async () => {
    const box = harness();
    const started = await box.flow.start(contact);
    if (!started.ok || !started.token) throw new Error('start');
    await box.flow.answer({ token: started.token, question: 1, value: '$10K+' });
    await box.flow.answer({ token: started.token, question: 1, value: '$10K+' });
    const restored = await box.flow.resume(started.token);
    expect(restored.ok && restored.answers.adSpend).toBe('$10K+');
    if (restored.ok) expect(restored.question).toBe(2);
    expect(box.events.filter((event) => event.name === 'question_answered')).toHaveLength(1);
    await box.flow.answer({ token: started.token, question: 2, value: '$3K to $6K' });
    await box.flow.answer({ token: started.token, question: 1, value: 'Under $5K' });
    expect(box.records.get(started.token)?.answers.offerPrice).toBeUndefined();
  });

  it('leaves test applications out of the counts', async () => {
    const box = harness();
    await box.flow.open({ adName: 'AdNameOne', test: false, key: 'open' });
    const live = await box.flow.start({
      ...contact,
      email: 'live@blake.test',
      incoming: touchFromTracking({ utm_content: 'AdNameOne' }),
    });
    const test = await box.flow.start({
      ...contact,
      email: 'test@blake.test',
      test: true,
      incoming: touchFromTracking({ utm_content: 'AdNameOne' }),
    });
    if (!live.ok || !live.token || !test.ok || !test.token) throw new Error('start');
    await finish(box, live.token, ['$10K+', '$10K+', 'A closer', "Leads don't book"]);
    await finish(box, test.token, ['Not running ads', 'Under $3K', 'Nobody yet', "Leads don't book"]);
    await box.flow.book(test.token);
    const counts = countApplications(box.events);
    expect(counts).toHaveLength(1);
    expect(counts[0]).toMatchObject({
      ad: 'AdNameOne',
      popupOpens: 1,
      step1Submits: 1,
      step2Completions: 1,
      calendar: 1,
      bookings: 0,
      closed: 0,
    });
    expect(box.records.get(test.token)?.test).toBe(true);
    expect(box.recoveryStarts()).toBe(1);
  });

  it('returns the next screen before the other destinations run', async () => {
    const box = harness({ backgroundComplete: true });
    const started = await box.flow.start(contact);
    if (!started.ok || !started.token) throw new Error('start');
    const afterStart = box.ghlCalls();
    const done = await finish(box, started.token, ['$10K+', '$10K+', 'Me', "Leads don't book"]);
    expect(done).toEqual({ ok: true, screen: 'calendar' });
    expect(box.ghlCalls()).toBe(afterStart);
    expect(box.records.get(started.token)?.deliveryPending).toBe(true);
  });

  it('normalizes a US phone and blocks junk', () => {
    expect(normalizePhone('(202) 555-0199')).toBe('+12025550199');
    expect(normalizePhone('0000000000')).toBeNull();
    expect(normalizePhone('1234567890')).toBeNull();
  });

  it('does not ship the routing rules to the popup', () => {
    const popup = readFileSync('app/acq/components/ApplyFlow.tsx', 'utf8');
    const gate = readFileSync('app/acq/components/QualifyGate.tsx', 'utf8');
    expect(popup + gate).not.toContain('application-route');
    expect(popup + gate).not.toContain('da-priority');
    expect(popup + gate).not.toContain('da-not-a-fit');
    const copy = readFileSync('lib/acq/application-copy.ts', 'utf8');
    expect(popup).toContain('SMS_CONSENT_WORDING');
    expect(popup).toContain('APPLY_LEGAL_FOOTER');
    expect(popup).toContain('APPLY_QUESTIONS.map');
    expect(popup).toContain('<Logo');
    expect(copy).toContain('Divine Acquisition LLC');
    expect(copy).not.toContain('7404 Executive Place');
    expect(copy).toContain(
      'Text me appointment reminders from Divine Acquisition LLC about my audit. Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for help. Consent is not required to apply.',
    );
    expect(copy).toContain('It is not a purchase, and it does not start a client agreement.');
    expect(copy).not.toMatch(/[—–]/);
    expect(readFileSync('lib/acq/application-route.ts', 'utf8')).not.toMatch(/[—–]/);
  });
});

describe('attribution merge', () => {
  it('does not rewrite first touch', () => {
    const first = touchFromTracking({ utm_campaign: 'spring', utm_content: 'AdNameOne' });
    const next = touchFromTracking({ utm_campaign: 'fall', utm_content: 'AdNameTwo' });
    const merged = mergeAttribution({ first, last: first }, next);
    expect(merged.first.content).toBe('AdNameOne');
    expect(merged.last.content).toBe('AdNameTwo');
    expect(merged.sourceAd).toBe('AdNameOne');
  });
});

describe('application recovery', () => {
  it('cancels the unfinished-application email without touching reminders', () => {
    const config = { ...readBookingMessageConfig({}), mode: 'live' as const, texting: true, emailing: true };
    const started = ingest(
      emptySlice(),
      { type: 'application', email: 'jordan@blake.test', fullName: 'Jordan', firstName: 'Jordan', smsConsent: false },
      NOW,
      config,
    );
    const stopped = cancelApplicationMessages(started.slice, 'jordan@blake.test');
    expect(stopped.messages.find((message) => message.type === 'application_received')?.status).toBe('cancelled');
    expect(stopped.messages.find((message) => message.type === 'application_received')?.reason).toBe(
      'application_complete',
    );
  });
});
