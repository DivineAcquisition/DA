import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { APPLY_QUESTIONS } from './application-copy';
import type { ApplyRecord } from './application-flow';

const PURPLE = rgb(0.604, 0.533, 0.988);
const INK = rgb(0.1, 0.1, 0.12);
const MUTED = rgb(0.33, 0.33, 0.38);

export function applicationBadge(record: Pick<ApplyRecord, 'route'>): string {
  if (record.route?.screen === 'calendar' && record.route.priority === 'A') return 'Qualified, Priority A';
  if (record.route?.screen === 'calendar') return 'Qualified, Priority B';
  if (record.route?.screen === 'later') return 'Not yet';
  return 'Not a fit';
}

export function applicationFileName(name: string, at: Date): string {
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
  const clean = name.replace(/[^\w .'-]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Applicant';
  return `Application - ${clean} - ${day}.pdf`;
}

export function easternStamp(at: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(at);
}

function wrap(text: string, font: { widthOfTextAtSize: (text: string, size: number) => number }, size: number, width: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > width && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

export async function renderApplicationPdf(input: {
  record: ApplyRecord;
  company?: string;
  caseFileUrl?: string;
  bookedAt?: string;
  logo?: Uint8Array;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const width = 532;
  const left = 40;
  let y = 748;
  const logoBytes = input.logo ?? loadLogo();
  if (logoBytes) {
    try {
      const image = await pdf.embedPng(logoBytes);
      const scale = 28 / image.height;
      page.drawImage(image, { x: left, y: y - 8, width: image.width * scale, height: 28 });
    } catch {
      page.drawText('Divine Acquisition', { x: left, y, size: 12, font: bold, color: PURPLE });
    }
  }
  page.drawText('Application', { x: 430, y: y + 6, size: 14, font: bold, color: PURPLE });
  page.drawText(easternStamp(new Date(input.record.step2At || input.record.updatedAt)), {
    x: 360,
    y: y - 12,
    size: 9,
    font,
    color: MUTED,
  });
  y -= 48;
  page.drawText(input.record.contact.firstName, { x: left, y, size: 22, font: bold, color: INK });
  y -= 18;
  if (input.company) {
    for (const line of wrap(input.company, font, 11, width)) {
      page.drawText(line, { x: left, y, size: 11, font, color: INK });
      y -= 14;
    }
  }
  const badge = applicationBadge(input.record);
  page.drawRectangle({ x: left, y: y - 6, width: bold.widthOfTextAtSize(badge, 10) + 16, height: 18, color: PURPLE });
  page.drawText(badge, { x: left + 8, y: y - 1, size: 10, font: bold, color: rgb(1, 1, 1) });
  y -= 36;
  const blocks = [
    ['Contact', contactLines(input.record)],
    ['Answers', answerLines(input.record)],
    ['Source', sourceLines(input.record)],
    ['Next step', [nextStep(input.record, input.bookedAt)]],
  ] as const;
  for (const [heading, lines] of blocks) {
    page.drawText(heading, { x: left, y, size: 12, font: bold, color: PURPLE });
    y -= 4;
    page.drawLine({ start: { x: left, y }, end: { x: left + width, y }, thickness: 1, color: PURPLE });
    y -= 16;
    for (const line of lines.flatMap((item) => wrap(item, font, 10, width))) {
      page.drawText(line, { x: left, y, size: 10, font, color: INK });
      y -= 14;
    }
    y -= 8;
  }
  page.drawText(`Application ${input.record.token}  ·  Internal. Divine Acquisition.  ·  1`, {
    x: left,
    y: 28,
    size: 8,
    font,
    color: MUTED,
  });
  if (input.caseFileUrl) {
    page.drawText(input.caseFileUrl.slice(0, 90), { x: left, y: 16, size: 8, font, color: MUTED });
  }
  return pdf.save();
}

function contactLines(record: ApplyRecord): string[] {
  return [
    `Email: ${record.contact.email}`,
    `Phone: ${record.contact.phone}`,
    `SMS consent: ${record.contact.smsConsent ? 'yes' : 'no'} at ${record.contact.consentAt}`,
  ];
}

function answerLines(record: ApplyRecord): string[] {
  return APPLY_QUESTIONS.map((question) => `${question.prompt} ${record.answers[question.key] || 'Not answered'}`);
}

function sourceLines(record: ApplyRecord): string[] {
  const touch = (label: string, value: ApplyRecord['firstTouch']) =>
    `${label}: source ${value.source || 'direct'}, medium ${value.medium || 'none'}, campaign ${value.campaign || 'none'}, content ${value.content || 'direct'}, term ${value.term || 'none'}`;
  return [`Ad: ${record.sourceAd || 'direct'}`, touch('First touch', record.firstTouch), touch('Last touch', record.lastTouch)];
}

function nextStep(record: ApplyRecord, bookedAt?: string): string {
  if (bookedAt) return `Booked ${bookedAt}`;
  if (record.route?.screen === 'calendar') return 'Calendar shown';
  if (record.route?.screen === 'later') return 'Not yet. Asked to apply again around $5K a month in ad spend.';
  return 'Not a fit. Told the system is not the right fit right now.';
}

function loadLogo(): Uint8Array | undefined {
  try {
    return readFileSync(path.join(process.cwd(), 'public', 'logo.png'));
  } catch {
    return undefined;
  }
}
