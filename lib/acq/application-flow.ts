import { createToken } from '@/lib/workspace/tokens';
import {
  answerOnQuestion,
  APPLY_QUESTIONS,
  SMS_CONSENT_WORDING,
  type ApplyAnswers,
  type ApplyScreen,
} from './application-copy';
import { mergeAttribution, type Touch } from './application-attribution';
import type { ApplyEvent, ApplyEventName } from './application-events';
import { questionKey, routeApplication, stepOneTags, type ApplyRoute } from './application-route';

export type ApplyContact = {
  firstName: string;
  email: string;
  phone: string;
  smsConsent: boolean;
  consentWording: string;
  consentAt: string;
  consentPage: string;
};

export type ApplyRecord = {
  token: string;
  contact: ApplyContact;
  answers: ApplyAnswers;
  answeredAt: Partial<Record<keyof ApplyAnswers, string>>;
  firstTouch: Touch;
  lastTouch: Touch;
  sourceAd: string;
  test: boolean;
  route: ApplyRoute | null;
  step1At: string;
  step2At: string;
  updatedAt: string;
  ghlContactId: string;
  recovery: 'running' | 'stopped' | 'skipped';
  failures: string[];
  /** Set when Step 2 should return before the other destinations finish. */
  deliveryPending?: boolean;
  delivery?: import('./application-deliver').ApplicationDelivery;
};

export type RetryJob = {
  id: string;
  token: string;
  kind: 'ghl' | 'airtable';
  error: string;
  attempts: number;
};

export type PublicResult =
  | { ok: true; token?: string; screen?: ApplyScreen; question?: number }
  | { ok: false; error: string; field?: 'firstName' | 'email' | 'phone' };

export type ApplyDeps = {
  now: () => Date;
  load: (token: string) => Promise<ApplyRecord | null>;
  loadByEmail: (email: string) => Promise<ApplyRecord | null>;
  save: (record: ApplyRecord) => Promise<void>;
  events: ApplyEvent[];
  retries: RetryJob[];
  rateLimit: (key: string) => boolean;
  syncGhl: (record: ApplyRecord, tags: string[]) => Promise<{ ok: true; contactId: string } | { ok: false; error: string }>;
  syncAirtable: (record: ApplyRecord) => Promise<{ ok: true } | { ok: false; error: string }>;
  startRecovery: (record: ApplyRecord) => Promise<void>;
  stopRecovery: (email: string) => Promise<void>;
  /** When true, Step 2 saves the route and returns. Delivery runs after the response. */
  backgroundComplete?: boolean;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) return null;
  if (/^(\d)\1+$/.test(digits)) return null;
  if (digits === '1234567890' || digits === '0123456789' || digits.endsWith('5555555555')) return null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

export function normalizeContact(input: {
  firstName?: string;
  email?: string;
  phone?: string;
  smsConsent?: boolean;
  page?: string;
  now: Date;
}): { contact: ApplyContact } | { error: string; field: 'firstName' | 'email' | 'phone' } {
  const firstName = (input.firstName ?? '').trim().replace(/\s+/g, ' ');
  if (firstName.length < 2 || firstName.length > 60 || !/[A-Za-z]/.test(firstName)) {
    return { error: 'Enter your first name.', field: 'firstName' };
  }
  const email = (input.email ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 320 || email.endsWith('@example.invalid')) {
    return { error: 'Enter a valid email.', field: 'email' };
  }
  const phone = normalizePhone(input.phone ?? '');
  if (!phone) return { error: 'Enter a valid phone number.', field: 'phone' };
  return {
    contact: {
      firstName,
      email,
      phone,
      smsConsent: Boolean(input.smsConsent),
      consentWording: SMS_CONSENT_WORDING,
      consentAt: input.now.toISOString(),
      consentPage: (input.page ?? '').slice(0, 500),
    },
  };
}

function stamp(record: ApplyRecord, now: Date): ApplyRecord {
  return { ...record, updatedAt: now.toISOString() };
}

async function remember(deps: ApplyDeps, record: ApplyRecord, name: ApplyEventName, extra: Partial<ApplyEvent> = {}) {
  deps.events.push({
    at: record.updatedAt,
    email: record.contact.email,
    adName: record.sourceAd || 'direct',
    name,
    test: record.test,
    ...extra,
  });
}

async function syncBoth(deps: ApplyDeps, record: ApplyRecord, tags: string[]) {
  const [ghl, airtable] = await Promise.all([
    deps.syncGhl(record, tags),
    deps.syncAirtable(record),
  ]);
  if (!ghl.ok) {
    record.failures.push(`ghl: ${ghl.error}`);
    deps.retries.push({ id: createToken(9), token: record.token, kind: 'ghl', error: ghl.error, attempts: 1 });
    await remember(deps, record, 'sync_failed', { screen: 'ghl' });
  } else {
    record.ghlContactId = ghl.contactId || record.ghlContactId;
  }
  if (!airtable.ok) {
    record.failures.push(`airtable: ${airtable.error}`);
    deps.retries.push({
      id: createToken(9),
      token: record.token,
      kind: 'airtable',
      error: airtable.error,
      attempts: 1,
    });
    await remember(deps, record, 'sync_failed', { screen: 'airtable' });
  }
}

export function createApplyFlow(deps: ApplyDeps) {
  const flow = {
    async open(input: { adName: string; test: boolean; key: string }) {
      if (!deps.rateLimit(input.key)) {
        return { ok: false as const, error: 'Please wait a moment and try again.' };
      }
      deps.events.push({
        at: deps.now().toISOString(),
        email: '',
        adName: input.adName || 'direct',
        name: 'popup_opened',
        test: input.test,
      });
      return { ok: true as const };
    },

    async start(input: {
      firstName?: string;
      email?: string;
      phone?: string;
      smsConsent?: boolean;
      website?: string;
      page?: string;
      test?: boolean;
      key: string;
      incoming: Touch | null;
      storedFirst: Touch | null;
      storedLast: Touch | null;
    }): Promise<PublicResult> {
      if ((input.website ?? '').trim()) {
        return { ok: true, token: `bot_${createToken(8)}` };
      }
      if (!deps.rateLimit(`start:${input.key}`)) {
        return { ok: false, error: 'Please wait a moment and try again.' };
      }
      const parsed = normalizeContact({ ...input, now: deps.now() });
      if ('error' in parsed) return { ok: false, error: parsed.error, field: parsed.field };

      const existing = await deps.loadByEmail(parsed.contact.email);
      const attribution = mergeAttribution(
        { first: existing?.firstTouch ?? input.storedFirst, last: existing?.lastTouch ?? input.storedLast },
        input.incoming,
      );
      const now = deps.now().toISOString();
      const record: ApplyRecord = existing
        ? stamp(
            {
              ...existing,
              contact: parsed.contact,
              firstTouch: existing.firstTouch,
              lastTouch: attribution.last,
              sourceAd: attribution.sourceAd,
              test: existing.test || Boolean(input.test),
            },
            deps.now(),
          )
        : {
            token: createToken(),
            contact: parsed.contact,
            answers: {},
            answeredAt: {},
            firstTouch: attribution.first,
            lastTouch: attribution.last,
            sourceAd: attribution.sourceAd,
            test: Boolean(input.test),
            route: null,
            step1At: now,
            step2At: '',
            updatedAt: now,
            ghlContactId: '',
            recovery: 'skipped',
            failures: [],
          };
      await deps.save(record);
      await syncBoth(deps, record, stepOneTags(record.contact.smsConsent).concat(record.test ? ['da-test'] : []));
      await deps.save(record);
      if (!record.test && !record.route && record.recovery !== 'running') {
        try {
          await deps.startRecovery(record);
          record.recovery = 'running';
          await deps.save(record);
        } catch (error) {
          record.failures.push(error instanceof Error ? error.message : 'recovery');
          await deps.save(record);
        }
      }
      if (!existing) await remember(deps, record, 'step1_submitted');
      return { ok: true, token: record.token };
    },

    async answer(input: { token: string; question: number; value: string }): Promise<PublicResult> {
      const record = await deps.load(input.token);
      if (!record || input.token.startsWith('bot_')) {
        return input.token.startsWith('bot_')
          ? { ok: true, screen: 'calendar' }
          : { ok: false, error: 'Start again so we can save your place.' };
      }
      const patch = answerOnQuestion(input.question, input.value);
      const key = questionKey(input.question);
      if (!patch || !key) return { ok: false, error: 'Choose one of the options.' };
      const previous = record.answers[key];
      if (previous === input.value && record.route && input.question === 4) {
        return { ok: true, screen: record.route.screen };
      }
      if (previous === input.value && input.question < 4) {
        return { ok: true, question: input.question + 1 };
      }
      const answers: ApplyAnswers = { ...record.answers, ...patch };
      if (previous && previous !== input.value) {
        for (let later = input.question + 1; later <= 4; later += 1) {
          const laterKey = questionKey(later);
          if (laterKey) delete answers[laterKey];
        }
        record.route = null;
        record.step2At = '';
      }
      record.answers = answers;
      record.answeredAt = { ...record.answeredAt, [key]: deps.now().toISOString() };
      const stamped = stamp(record, deps.now());
      Object.assign(record, stamped);
      await deps.save(record);
      await remember(deps, record, 'question_answered', { question: input.question });
      const route = routeApplication(record.answers);
      if (!route) return { ok: true, question: input.question + 1 };

      record.route = route;
      record.step2At = record.updatedAt;
      if (record.recovery === 'running') {
        await deps.stopRecovery(record.contact.email);
        record.recovery = 'stopped';
      }
      const tags = record.test ? [...route.tags, 'da-test'] : [...route.tags];
      if (deps.backgroundComplete) {
        record.deliveryPending = true;
      } else {
        await syncBoth(deps, record, tags);
      }
      await deps.save(record);
      await remember(deps, record, 'step2_completed');
      await remember(deps, record, 'route_shown', { screen: route.screen });
      return { ok: true, screen: route.screen };
    },

    async resume(token: string): Promise<
      | { ok: false }
      | {
          ok: true;
          question: number;
          answers: ApplyAnswers;
          screen: ApplyScreen | null;
          firstName: string;
        }
    > {
      const record = await deps.load(token);
      if (!record) return { ok: false };
      const sameDay = record.updatedAt.slice(0, 10) === deps.now().toISOString().slice(0, 10);
      if (!sameDay) return { ok: false };
      const next = [1, 2, 3, 4].find((question) => {
        const key = questionKey(question);
        return key ? !record.answers[key] : false;
      });
      return {
        ok: true,
        question: next ?? 4,
        answers: record.answers,
        screen: record.route?.screen ?? null,
        firstName: record.contact.firstName,
      };
    },

    async book(token: string): Promise<{ ok: true }> {
      const record = await deps.load(token);
      if (!record) return { ok: true };
      const already = deps.events.some(
        (event) => event.name === 'calendar_booked' && event.email === record.contact.email && event.test === record.test,
      );
      if (!already) await remember(deps, record, 'calendar_booked');
      return { ok: true };
    },

    async retry(): Promise<number> {
      let done = 0;
      for (const job of [...deps.retries]) {
        const record = await deps.load(job.token);
        if (!record) continue;
        const tags = record.route?.tags ?? stepOneTags(record.contact.smsConsent);
        const result =
          job.kind === 'ghl'
            ? await deps.syncGhl(record, record.test ? [...tags, 'da-test'] : tags)
            : await deps.syncAirtable(record);
        if (result.ok) {
          if (job.kind === 'ghl' && 'contactId' in result && typeof result.contactId === 'string') {
            record.ghlContactId = result.contactId;
          }
          await deps.save(record);
          const index = deps.retries.findIndex((item) => item.id === job.id);
          if (index >= 0) deps.retries.splice(index, 1);
          done += 1;
        } else {
          job.attempts += 1;
          job.error = result.error;
        }
      }
      return done;
    },

    async complete(input: {
      firstName?: string;
      email?: string;
      phone?: string;
      smsConsent?: boolean;
      website?: string;
      page?: string;
      test?: boolean;
      key: string;
      incoming: Touch | null;
      storedFirst: Touch | null;
      storedLast: Touch | null;
      answers: ApplyAnswers;
    }): Promise<PublicResult> {
      for (let index = 0; index < APPLY_QUESTIONS.length; index += 1) {
        const value = input.answers[APPLY_QUESTIONS[index].key] ?? '';
        if (!answerOnQuestion(index + 1, value)) {
          return { ok: false, error: 'Choose one of the options.' };
        }
      }
      const started = await flow.start(input);
      if (!started.ok || !started.token) {
        return started.ok ? { ok: false, error: 'Try that once more.' } : started;
      }
      let screen: ApplyScreen | undefined;
      for (let index = 0; index < APPLY_QUESTIONS.length; index += 1) {
        const value = input.answers[APPLY_QUESTIONS[index].key] ?? '';
        const answered = await flow.answer({ token: started.token, question: index + 1, value });
        if (!answered.ok) return answered;
        if (answered.screen) screen = answered.screen;
      }
      if (!screen) return { ok: false, error: 'Try that once more.' };
      return { ok: true, token: started.token, screen };
    },
  };
  return flow;
}

export function publicShape(result: PublicResult): PublicResult {
  if (!result.ok) return { ok: false, error: result.error, field: result.field };
  const next: PublicResult = { ok: true };
  if (result.token) next.token = result.token;
  if (result.screen) next.screen = result.screen;
  if (result.question) next.question = result.question;
  return next;
}
