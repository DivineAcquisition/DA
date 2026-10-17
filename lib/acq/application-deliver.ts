import type { ApplyRecord } from './application-flow';
import { applicationBadge, applicationFileName, renderApplicationPdf } from './application-pdf';

export type DestinationStatus = 'pending' | 'done' | 'failed' | 'waiting';

export type DestinationState = {
  status: DestinationStatus;
  error: string;
  at: string;
};

export type ApplicationDelivery = {
  ghl: DestinationState;
  pdf: DestinationState;
  vistrial: DestinationState;
  airtable: DestinationState;
  email: DestinationState;
  text: DestinationState;
  pdfName: string;
  pdfBytes: string;
  caseFileUrl: string;
  vistrialLeadId: string;
  emailed: boolean;
  texted: string[];
};

export type DeliveryDeps = {
  now: () => Date;
  ghl: (record: ApplyRecord, note: string) => Promise<{ ok: true; contactId: string } | { ok: false; error: string }>;
  vistrial: (
    record: ApplyRecord,
    pdf: Uint8Array,
    fileName: string,
  ) => Promise<{ ok: true; leadId: string; url: string } | { ok: false; error: string } | { ok: false; off: true }>;
  airtable: (record: ApplyRecord, links: { caseFileUrl: string }) => Promise<{ ok: true } | { ok: false; error: string }>;
  email: (record: ApplyRecord, pdf: Uint8Array, fileName: string, caseFileUrl: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  text: (record: ApplyRecord, message: string) => Promise<{ ok: true; sent: string[] } | { ok: false; error: string }>;
  savePdf: (record: ApplyRecord, pdf: Uint8Array, fileName: string) => Promise<{ ok: true; url: string } | { ok: false; error: string }>;
  log: (step: string, email: string, error: unknown) => Promise<void>;
};

export function emptyDelivery(now: string): ApplicationDelivery {
  const pending = (): DestinationState => ({ status: 'pending', error: '', at: now });
  return {
    ghl: pending(),
    pdf: pending(),
    vistrial: pending(),
    airtable: pending(),
    email: pending(),
    text: pending(),
    pdfName: '',
    pdfBytes: '',
    caseFileUrl: '',
    vistrialLeadId: '',
    emailed: false,
    texted: [],
  };
}

export function airtableIsWaiting(error: string): boolean {
  const text = error.toLowerCase();
  return text.includes('429') || text.includes('rate') || text.includes('limit') || text.includes('billing');
}

export function alertSubject(record: ApplyRecord): string {
  const route =
    record.route?.screen === 'calendar' && record.route.priority === 'A'
      ? 'Qualified A'
      : record.route?.screen === 'calendar'
        ? 'Qualified B'
        : record.route?.screen === 'later'
          ? 'Not yet'
          : 'Not a fit';
  const prefix = record.test ? '[TEST] ' : '';
  return `${prefix}${route}: ${record.contact.firstName}, ${record.answers.adSpend || 'unknown'} spend, ${record.answers.offerPrice || 'unknown'} offer`;
}

export function internalAlertText(record: ApplyRecord, caseFileUrl: string): string {
  const status =
    record.route?.screen === 'calendar' && record.route.priority === 'A'
      ? 'QUALIFIED, PRIORITY A'
      : record.route?.screen === 'calendar'
        ? 'QUALIFIED, PRIORITY B'
        : record.route?.screen === 'later'
          ? 'NOT YET'
          : 'NOT A FIT';
  const prefix = record.test ? '[TEST] ' : '';
  const text = `${prefix}New DA application: ${record.contact.firstName}. ${status}. Spend ${record.answers.adSpend || 'unknown'}. Offer ${record.answers.offerPrice || 'unknown'}. Calls: ${record.answers.callTaker || 'unknown'}. Problem: ${record.answers.problem || 'unknown'}. Case file: ${caseFileUrl || 'pending'}`;
  return text.slice(0, 320);
}

export function alertNumbers(): string[] {
  return (process.env.ACQ_INTERNAL_ALERT_PHONES ?? '')
    .split(/[,\s]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function mark(state: DestinationState, status: DestinationStatus, error: string, at: string) {
  state.status = status;
  state.error = error;
  state.at = at;
}

export async function runApplicationDelivery(record: ApplyRecord, deps: DeliveryDeps): Promise<ApplicationDelivery> {
  const delivery = recordDelivery(record, deps.now().toISOString());
  if (!record.route) return delivery;
  const at = () => deps.now().toISOString();

  if (delivery.pdf.status !== 'done') {
    try {
      const bytes = await renderApplicationPdf({ record, caseFileUrl: delivery.caseFileUrl });
      delivery.pdfBytes = Buffer.from(bytes).toString('base64');
      delivery.pdfName = applicationFileName(record.contact.firstName, new Date(record.step2At || record.updatedAt));
      mark(delivery.pdf, 'done', '', at());
    } catch (error) {
      mark(delivery.pdf, 'failed', messageOf(error), at());
      await deps.log('pdf', record.contact.email, error);
    }
  }

  if (delivery.ghl.status !== 'done') {
    try {
      const note = summaryNote(record, delivery.caseFileUrl);
      const result = await deps.ghl(record, note);
      if (result.ok) {
        record.ghlContactId = result.contactId;
        mark(delivery.ghl, 'done', '', at());
      } else {
        mark(delivery.ghl, 'failed', result.error, at());
        await deps.log('ghl-apply', record.contact.email, result.error);
      }
    } catch (error) {
      mark(delivery.ghl, 'failed', messageOf(error), at());
      await deps.log('ghl-apply', record.contact.email, error);
    }
  }

  const pdf = delivery.pdfBytes ? Uint8Array.from(Buffer.from(delivery.pdfBytes, 'base64')) : new Uint8Array();
  if (delivery.vistrial.status !== 'done') {
    try {
      const result = await deps.vistrial(record, pdf, delivery.pdfName);
      if ('off' in result) {
        const stored = await deps.savePdf(record, pdf, delivery.pdfName);
        if (stored.ok) {
          delivery.caseFileUrl = stored.url;
          mark(delivery.vistrial, 'done', 'switched off, stored in admin', at());
        } else {
          mark(delivery.vistrial, 'failed', stored.error, at());
        }
      } else if (result.ok) {
        delivery.vistrialLeadId = result.leadId;
        delivery.caseFileUrl = result.url;
        mark(delivery.vistrial, 'done', '', at());
      } else {
        mark(delivery.vistrial, 'failed', result.error, at());
        const stored = await deps.savePdf(record, pdf, delivery.pdfName);
        if (stored.ok) delivery.caseFileUrl = stored.url;
        await deps.log('vistrial', record.contact.email, result.error);
      }
    } catch (error) {
      mark(delivery.vistrial, 'failed', messageOf(error), at());
      await deps.log('vistrial', record.contact.email, error);
    }
  }

  if (delivery.ghl.status === 'done' && delivery.caseFileUrl) {
    try {
      await deps.ghl(record, summaryNote(record, delivery.caseFileUrl));
    } catch (error) {
      await deps.log('ghl-note', record.contact.email, error);
    }
  }

  if (delivery.airtable.status !== 'done') {
    try {
      const result = await deps.airtable(record, { caseFileUrl: delivery.caseFileUrl });
      if (result.ok) mark(delivery.airtable, 'done', '', at());
      else if (airtableIsWaiting(result.error)) mark(delivery.airtable, 'waiting', result.error, at());
      else {
        mark(delivery.airtable, 'failed', result.error, at());
        await deps.log('airtable-apply', record.contact.email, result.error);
      }
    } catch (error) {
      const text = messageOf(error);
      mark(delivery.airtable, airtableIsWaiting(text) ? 'waiting' : 'failed', text, at());
      if (!airtableIsWaiting(text)) await deps.log('airtable-apply', record.contact.email, error);
    }
  }

  if (!delivery.emailed && delivery.pdf.status === 'done') {
    try {
      const result = await deps.email(record, pdf, delivery.pdfName, delivery.caseFileUrl);
      if (result.ok) {
        delivery.emailed = true;
        mark(delivery.email, 'done', '', at());
      } else {
        mark(delivery.email, 'failed', result.error, at());
        await deps.log('application-email', record.contact.email, result.error);
      }
    } catch (error) {
      mark(delivery.email, 'failed', messageOf(error), at());
      await deps.log('application-email', record.contact.email, error);
    }
  }

  if (delivery.texted.length < 2 && delivery.text.status !== 'done') {
    try {
      const result = await deps.text(record, internalAlertText(record, delivery.caseFileUrl));
      if (result.ok) {
        delivery.texted = result.sent;
        mark(delivery.text, result.sent.length ? 'done' : 'failed', result.sent.length ? '' : 'no numbers configured', at());
      } else {
        mark(delivery.text, 'failed', result.error, at());
        await deps.log('internal-text', record.contact.email, result.error);
      }
    } catch (error) {
      mark(delivery.text, 'failed', messageOf(error), at());
      await deps.log('internal-text', record.contact.email, error);
    }
  }

  record.delivery = delivery;
  return delivery;
}

export function recordDelivery(record: ApplyRecord, now: string): ApplicationDelivery {
  return record.delivery ?? emptyDelivery(now);
}

function summaryNote(record: ApplyRecord, caseFileUrl: string): string {
  return [
    `Application ${record.token}`,
    `Status: ${applicationBadge(record)}`,
    `Ad spend: ${record.answers.adSpend || ''}`,
    `Offer price: ${record.answers.offerPrice || ''}`,
    `Sales calls: ${record.answers.callTaker || ''}`,
    `Biggest problem: ${record.answers.problem || ''}`,
    `Source ad: ${record.sourceAd || 'direct'}`,
    caseFileUrl ? `Case file: ${caseFileUrl}` : null,
    record.test ? 'Test: yes' : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n');
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
