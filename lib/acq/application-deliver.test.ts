import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { directTouch } from './application-attribution';
import {
  alertSubject,
  airtableIsWaiting,
  internalAlertText,
  runApplicationDelivery,
  type DeliveryDeps,
} from './application-deliver';
import type { ApplyRecord } from './application-flow';
import { routeApplication } from './application-route';

function record(overrides: Partial<ApplyRecord> = {}): ApplyRecord {
  const route = routeApplication({
    adSpend: '$10K+',
    offerPrice: '$6K to $10K',
    callTaker: 'A closer',
    problem: "Booked calls don't show",
  });
  return {
    token: 'app_123',
    contact: {
      firstName: 'Jordan Miles',
      email: 'jordan@miles.test',
      phone: '+12025550199',
      smsConsent: true,
      consentWording: 'Text me appointment reminders for my call. Message and data rates may apply. Reply STOP to opt out.',
      consentAt: '2026-10-17T15:00:00.000Z',
      consentPage: 'https://acq.divineacquisition.io/',
    },
    answers: {
      adSpend: '$10K+',
      offerPrice: '$6K to $10K',
      callTaker: 'A closer',
      problem: "Booked calls don't show",
    },
    answeredAt: {},
    firstTouch: { ...directTouch(), source: 'facebook', campaign: 'spring', content: 'AdNameOne' },
    lastTouch: { ...directTouch(), source: 'facebook', campaign: 'fall', content: 'AdNameTwo' },
    sourceAd: 'AdNameOne',
    test: false,
    route,
    step1At: '2026-10-17T15:00:00.000Z',
    step2At: '2026-10-17T15:01:00.000Z',
    updatedAt: '2026-10-17T15:01:00.000Z',
    ghlContactId: '',
    recovery: 'stopped',
    failures: [],
    ...overrides,
  };
}

function deps(partial: Partial<DeliveryDeps> = {}): DeliveryDeps & {
  calls: string[];
} {
  const calls: string[] = [];
  return {
    calls,
    now: () => new Date('2026-10-17T15:02:00.000Z'),
    log: async () => undefined,
    ghl: async () => {
      calls.push('ghl');
      return { ok: true, contactId: 'ghl_1' };
    },
    vistrial: async () => {
      calls.push('vistrial');
      return { ok: true, leadId: 'lead_1', url: 'https://app.vistrial.com/app/cases/lead_1' };
    },
    airtable: async () => {
      calls.push('airtable');
      return { ok: true };
    },
    email: async () => {
      calls.push('email');
      return { ok: true };
    },
    text: async (_record, message) => {
      calls.push(`text:${message}`);
      return { ok: true, sent: ['+14436486798', '+14438906941'] };
    },
    savePdf: async (current) => {
      calls.push('pdf-store');
      return { ok: true, url: `https://admin.divineacquisition.io/workspace/acq-applications/${current.token}` };
    },
    ...partial,
  };
}

describe('completed application delivery', () => {
  it('writes every destination once for a priority A application', async () => {
    const box = deps();
    const lead = record();
    const first = await runApplicationDelivery(lead, box);
    const second = await runApplicationDelivery(lead, box);
    expect(first.ghl.status).toBe('done');
    expect(first.pdf.status).toBe('done');
    expect(first.vistrial.status).toBe('done');
    expect(first.airtable.status).toBe('done');
    expect(first.email.status).toBe('done');
    expect(first.text.status).toBe('done');
    expect(first.texted).toEqual(['+14436486798', '+14438906941']);
    expect(box.calls.filter((call) => call === 'email')).toHaveLength(1);
    expect(box.calls.filter((call) => call.startsWith('text:'))).toHaveLength(1);
    expect(second.emailed).toBe(true);
    expect(alertSubject(lead)).toBe('Qualified A: Jordan Miles, $10K+ spend, $6K to $10K offer');
  });

  it('uses the right badge and wording for the other routes', () => {
    const priorityB = record({
      route: routeApplication({
        adSpend: '$5K to $10K',
        offerPrice: '$3K to $6K',
        callTaker: 'Me',
        problem: "Calls don't close",
      }),
      answers: { adSpend: '$5K to $10K', offerPrice: '$3K to $6K', callTaker: 'Me', problem: "Calls don't close" },
    });
    const later = record({
      route: routeApplication({
        adSpend: 'Under $5K',
        offerPrice: '$6K to $10K',
        callTaker: 'A setter and a closer',
        problem: "My team can't keep up",
      }),
    });
    const closed = record({
      route: routeApplication({
        adSpend: 'Not running ads',
        offerPrice: '$10K+',
        callTaker: 'A closer',
        problem: "Leads don't book",
      }),
    });
    expect(alertSubject(priorityB)).toContain('Qualified B');
    expect(internalAlertText(priorityB, 'https://case')).toContain('QUALIFIED, PRIORITY B');
    expect(alertSubject(later)).toContain('Not yet');
    expect(internalAlertText(later, 'https://case')).toContain('NOT YET');
    expect(alertSubject(closed)).toContain('Not a fit');
    expect(internalAlertText(closed, 'https://case')).toContain('NOT A FIT');
  });

  it('keeps going when GHL is down and succeeds on the retry', async () => {
    let up = false;
    const box = deps({
      ghl: async () => {
        if (!up) return { ok: false, error: 'ghl_down' };
        return { ok: true, contactId: 'ghl_2' };
      },
    });
    const lead = record();
    const failed = await runApplicationDelivery(lead, box);
    expect(failed.ghl.status).toBe('failed');
    expect(failed.email.status).toBe('done');
    expect(failed.vistrial.status).toBe('done');
    up = true;
    const retried = await runApplicationDelivery(lead, box);
    expect(retried.ghl.status).toBe('done');
    expect(lead.ghlContactId).toBe('ghl_2');
  });

  it('stores the PDF in the admin workspace when Vistrial is off or keeps failing', async () => {
    const off = deps({ vistrial: async () => ({ ok: false, off: true }) });
    const stored = await runApplicationDelivery(record(), off);
    expect(stored.caseFileUrl).toContain('/workspace/acq-applications/');
    expect(off.calls).toContain('pdf-store');

    const failing = deps({
      vistrial: async () => ({ ok: false, error: 'vistrial down' }),
    });
    const fallback = await runApplicationDelivery(record({ token: 'app_fail' }), failing);
    expect(fallback.vistrial.status).toBe('failed');
    expect(fallback.caseFileUrl).toContain('app_fail');
  });

  it('waits on an Airtable limit instead of failing the application', async () => {
    const box = deps({
      airtable: async () => ({ ok: false, error: '429 PUBLIC_API_BILLING_LIMIT' }),
    });
    const result = await runApplicationDelivery(record(), box);
    expect(result.airtable.status).toBe('waiting');
    expect(result.email.status).toBe('done');
    expect(airtableIsWaiting(result.airtable.error)).toBe(true);
  });

  it('keeps the lead email and phone out of the text', () => {
    const lead = record();
    const text = internalAlertText(lead, 'https://case.test/app_123');
    expect(text).not.toContain(lead.contact.email);
    expect(text).not.toContain(lead.contact.phone);
    expect(text.startsWith('New DA application: Jordan Miles.')).toBe(true);
  });

  it('labels a test application and prefixes the alerts', () => {
    const lead = record({ test: true });
    expect(alertSubject(lead).startsWith('[TEST]')).toBe(true);
    expect(internalAlertText(lead, 'https://case').startsWith('[TEST]')).toBe(true);
  });
});

describe('application pdf', () => {
  it('fits a long company name on one page with the badge and footer', async () => {
    const { renderApplicationPdf, applicationFileName } = await import('./application-pdf');
    const bytes = await renderApplicationPdf({
      record: record(),
      company: 'A very long coaching company name that has to wrap across the line without being cut off at the edge of the page',
    });
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
    expect(applicationFileName('Jordan Miles', new Date('2026-10-17T15:01:00.000Z'))).toBe(
      'Application - Jordan Miles - 2026-10-17.pdf',
    );
  });
});
