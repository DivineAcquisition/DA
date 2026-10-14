/**
 * A short branded PDF, built without a PDF library. Pages are white, with a
 * purple band, so the packet reads as a Divine Acquisition document when it
 * is printed or filed.
 */

export type PdfSection = {
  heading: string;
  rows: { label: string; value: string }[];
};

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 48;
const BRAND = '0.604 0.533 0.988';

function ascii(text: string): string {
  return text
    .replace(/[–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E\n]/g, '')
    .replace(/\r/g, '');
}

function pdfText(text: string): string {
  return ascii(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wrap(text: string, width: number): string[] {
  const clean = ascii(text).replace(/\s+/g, ' ').trim();
  if (!clean) return [''];
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

export function buildBrandedPdf(input: { kicker: string; title: string; subtitle: string; sections: PdfSection[] }): Uint8Array {
  const pages: string[] = [];
  let commands: string[] = [];
  let y = 700;

  const flush = () => {
    pages.push(commands.join('\n'));
    commands = [];
    y = 700;
  };

  const paintHeader = () => {
    commands.push(`${BRAND} rg`);
    commands.push(`0 744 ${PAGE_W} 48 re f`);
    commands.push('1 1 1 rg');
    commands.push(`BT /F1 11 Tf ${MARGIN} 762 Td (${pdfText(input.kicker)}) Tj ET`);
    commands.push('0.12 0.11 0.16 rg');
  };

  const ensure = (needed: number) => {
    if (y - needed < 56) {
      flush();
      paintHeader();
    }
  };

  paintHeader();
  commands.push(`BT /F2 22 Tf ${MARGIN} ${y} Td (${pdfText(input.title)}) Tj ET`);
  y -= 28;
  for (const line of wrap(input.subtitle, 78)) {
    commands.push('0.35 0.33 0.42 rg');
    commands.push(`BT /F1 11 Tf ${MARGIN} ${y} Td (${pdfText(line)}) Tj ET`);
    y -= 16;
  }
  y -= 10;

  for (const section of input.sections) {
    ensure(36);
    commands.push(`${BRAND} rg`);
    commands.push(`BT /F2 13 Tf ${MARGIN} ${y} Td (${pdfText(section.heading)}) Tj ET`);
    y -= 8;
    commands.push(`${BRAND} rg`);
    commands.push(`${MARGIN} ${y} ${PAGE_W - MARGIN * 2} 1.2 re f`);
    y -= 18;
    if (section.rows.length === 0) {
      commands.push('0.45 0.43 0.5 rg');
      commands.push(`BT /F1 11 Tf ${MARGIN} ${y} Td (Nothing recorded.) Tj ET`);
      y -= 20;
      continue;
    }
    for (const row of section.rows) {
      const valueLines = wrap(row.value || '-', 70);
      ensure(16 + valueLines.length * 14);
      commands.push('0.4 0.38 0.48 rg');
      commands.push(`BT /F1 9 Tf ${MARGIN} ${y} Td (${pdfText(row.label.toUpperCase())}) Tj ET`);
      y -= 14;
      commands.push('0.1 0.09 0.14 rg');
      for (const line of valueLines) {
        commands.push(`BT /F1 11 Tf ${MARGIN} ${y} Td (${pdfText(line)}) Tj ET`);
        y -= 14;
      }
      y -= 6;
    }
    y -= 8;
  }

  ensure(24);
  commands.push('0.55 0.53 0.6 rg');
  commands.push(`BT /F1 8 Tf ${MARGIN} 36 Td (Divine Acquisition  |  Confidential placement packet) Tj ET`);
  flush();

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
  const catalog = `1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj`;
  const pageTree = `2 0 obj << /Type /Pages /Kids [${kids}] /Count ${pageIds.length} >> endobj`;
  const byId = new Map<number, string>();
  byId.set(1, catalog);
  byId.set(2, pageTree);
  for (const object of objects) {
    const id = Number(object.slice(0, object.indexOf(' ')));
    byId.set(id, object);
  }
  const maxId = Math.max(...byId.keys());
  const xrefOffsets: number[] = new Array(maxId + 1).fill(0);
  let pdf = '%PDF-1.4\n';
  for (let id = 1; id <= maxId; id += 1) {
    xrefOffsets[id] = pdf.length;
    pdf += `${byId.get(id)}\n`;
  }
  const xrefAt = pdf.length;
  pdf += `xref\n0 ${maxId + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let id = 1; id <= maxId; id += 1) {
    pdf += `${String(xrefOffsets[id]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer << /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}
