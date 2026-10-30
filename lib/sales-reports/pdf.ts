import { asClientReport, formatValue, paceLabel, periodLabel, reportedLabel } from './client';

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 48;

function ascii(text: string): string {
  return text.replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\x20-\x7E\n]/g, '').replace(/\r/g, '');
}

function pdfText(text: string): string {
  return ascii(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wrap(text: string, width: number): string[] {
  const clean = ascii(text).replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const lines: string[] = [];
  let line = '';
  for (const word of clean.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > width && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Branded letter PDF. Charts are drawn as bars in the page, from the client payload only. */
export function buildClientReportPdf(input: unknown): Uint8Array {
  const report = asClientReport(input);
  const pages: string[] = [];
  let commands: string[] = [];
  let y = 700;

  const flush = () => {
    pages.push(commands.join('\n'));
    commands = [];
    y = 700;
  };
  const header = () => {
    commands.push('0.416 0 1 rg');
    commands.push(`0 744 ${PAGE_W} 48 re f`);
    commands.push('1 1 1 rg');
    commands.push(`BT /F2 11 Tf ${MARGIN} 762 Td (DIVINE ACQUISITION) Tj ET`);
    commands.push('0.12 0.11 0.16 rg');
  };
  const ensure = (needed: number) => {
    if (y - needed < 64) {
      flush();
      header();
    }
  };
  const heading = (text: string) => {
    ensure(36);
    commands.push('0.416 0 1 rg');
    commands.push(`BT /F2 13 Tf ${MARGIN} ${y} Td (${pdfText(text)}) Tj ET`);
    y -= 8;
    commands.push('0.576 0.49 1 rg');
    commands.push(`${MARGIN} ${y} ${PAGE_W - MARGIN * 2} 1.4 re f`);
    y -= 18;
    commands.push('0.1 0.09 0.14 rg');
  };
  const paragraph = (text: string, size = 11) => {
    for (const line of wrap(text, 86)) {
      ensure(16);
      commands.push(`BT /F1 ${size} Tf ${MARGIN} ${y} Td (${pdfText(line)}) Tj ET`);
      y -= size + 4;
    }
  };

  header();
  if (report.test) {
    commands.push('0.7 0.2 0.2 rg');
    commands.push(`BT /F2 10 Tf ${MARGIN} ${y} Td (TEST) Tj ET`);
    y -= 16;
  }
  commands.push('0.1 0.09 0.14 rg');
  commands.push(`BT /F2 20 Tf ${MARGIN} ${y} Td (${pdfText(report.client)}) Tj ET`);
  y -= 24;
  paragraph(`${report.operator}, ${report.role}`);
  paragraph(`${periodLabel(report)}  ·  ${report.manager}`);
  y -= 8;

  heading('Headline');
  if (report.headline.length === 0) paragraph('No numbers for this period.');
  for (const row of report.headline) {
    const pace = paceLabel(row.pace);
    const source = reportedLabel(row.reported);
    const target = row.target != null ? ` of ${formatValue(row.target)}` : '';
    paragraph(`${row.label}: ${formatValue(row.value)}${target}${pace ? ` · ${pace}` : ''}${source ? ` · ${source}` : ''}`);
  }

  if (report.outcomes.length > 0) {
    heading('Positive outcomes');
    for (const row of report.outcomes) {
      const previous = row.previous != null ? ` · previous ${formatValue(row.previous)}` : '';
      paragraph(`${row.name}: ${formatValue(row.value)}${previous}${reportedLabel(row.reported) ? ' · Operator reported' : ''}`);
    }
  }

  if (report.activity.length > 0) {
    heading('Activity');
    for (const row of report.activity) {
      const target = row.target != null ? ` of ${formatValue(row.target)}` : '';
      paragraph(`${row.label}: ${formatValue(row.value)}${target}${reportedLabel(row.reported) ? ' · Operator reported' : ''}`);
    }
  }

  if (report.speed) {
    heading('Speed to lead');
    paragraph(`Median ${formatValue(report.speed.median)} seconds. ${report.speed.leads} leads. ${report.speed.not_touched} not touched.${report.speed.reported ? ' Operator reported.' : ''}`);
  }

  if (report.results) {
    heading('Results');
    paragraph(`Show rate ${formatValue(report.results.show_rate)}${report.results.show_reported ? ' (Operator reported)' : ''}. Closes ${formatValue(report.results.closes)}${report.results.closes_reported ? ' (Operator reported)' : ''}.`);
    if (report.show_rate_note) paragraph(report.show_rate_note);
  }

  if (report.trend.length > 0) {
    heading('Last four weeks');
    const max = Math.max(1, ...report.trend.map((week) => Number(week.conversations ?? 0)));
    report.trend.forEach((week, index) => {
      ensure(28);
      const width = Math.max(4, Math.round((Number(week.conversations ?? 0) / max) * 220));
      commands.push('0.416 0 1 rg');
      commands.push(`${MARGIN + 88} ${y - 2} ${width} 10 re f`);
      commands.push('0.2 0.18 0.24 rg');
      commands.push(`BT /F1 9 Tf ${MARGIN} ${y} Td (${pdfText(week.start)}) Tj ET`);
      commands.push(`BT /F1 9 Tf ${MARGIN + 320} ${y} Td (${pdfText(formatValue(week.conversations))}) Tj ET`);
      y -= 18;
      if (index === report.trend.length - 1) y -= 4;
    });
  }

  if (report.wins.length > 0) {
    heading('Wins');
    report.wins.forEach((win) => paragraph(win));
  }
  if (report.summary) {
    heading('Summary');
    paragraph(report.summary);
  }
  if (report.next_focus) {
    heading('Next focus');
    paragraph(report.next_focus);
  }
  if (report.plan.length > 0) {
    heading("Tomorrow's plan");
    report.plan.forEach((line) => paragraph(line));
  }
  if (report.gaps.length > 0) {
    heading('Days');
    report.gaps.forEach((gap) => paragraph(`${gap.date}: ${gap.label}`));
  }

  ensure(28);
  commands.push('0.45 0.43 0.5 rg');
  paragraph('Leave feedback from the link in the email.');

  flush();
  pages.forEach((stream, index) => {
    const footer = `BT /F1 8 Tf ${MARGIN} 36 Td (${pdfText('Devotion. Value. Exclusivity.')}) Tj ET\nBT /F1 8 Tf ${PAGE_W - MARGIN - 40} 36 Td (${pdfText(`${index + 1} / ${pages.length}`)}) Tj ET`;
    pages[index] = `${stream}\n0.45 0.43 0.5 rg\n${footer}`;
  });

  const objects: string[] = [];
  const pageIds: number[] = [];
  let next = 3;
  const fontRegular = next++;
  const fontBold = next++;
  objects.push(`${fontRegular} 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj`);
  objects.push(`${fontBold} 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj`);
  const contentIds: number[] = [];
  for (const stream of pages) {
    const contentId = next++;
    contentIds.push(contentId);
    objects.push(`${contentId} 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`);
    const pageId = next++;
    pageIds.push(pageId);
    objects.push(
      `${pageId} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> >> endobj`,
    );
  }
  const kids = pageIds.map((id) => `${id} 0 R`).join(' ');
  const byId = new Map<number, string>();
  byId.set(1, '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj');
  byId.set(2, `2 0 obj << /Type /Pages /Kids [${kids}] /Count ${pageIds.length} >> endobj`);
  for (const object of objects) byId.set(Number(object.slice(0, object.indexOf(' '))), object);
  const maxId = Math.max(...byId.keys());
  const xrefOffsets: number[] = new Array(maxId + 1).fill(0);
  let pdf = '%PDF-1.4\n';
  for (let id = 1; id <= maxId; id += 1) {
    xrefOffsets[id] = pdf.length;
    pdf += `${byId.get(id)}\n`;
  }
  const xrefAt = pdf.length;
  pdf += `xref\n0 ${maxId + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= maxId; id += 1) pdf += `${String(xrefOffsets[id]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer << /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}
