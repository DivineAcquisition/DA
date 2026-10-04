export const MANIFEST_HEADERS = [
  'Lesson ID',
  'Title',
  'Order',
  'Video link',
  'Companion document file name',
  'Duration',
  'Required watch percentage',
  'Written lesson text or a file name for it',
  'Status',
  'Completion',
] as const;

export type ManifestStatus = 'draft' | 'ready' | 'live';

export type ManifestRow = {
  line: number;
  lessonId: string;
  title: string;
  order: number | null;
  videoLink: string;
  documentFile: string;
  duration: number | null;
  watchPercent: number | null;
  written: string;
  status: ManifestStatus | null;
  completion: 'keep' | 'review' | null;
};

export type ManifestIssue = { line: number; lessonId: string; message: string };

export type ManifestPlan = {
  creates: ManifestRow[];
  updates: ManifestRow[];
  skips: ManifestIssue[];
};

export function blankManifest(): string {
  return `${MANIFEST_HEADERS.join(',')}\n`;
}

/** An empty written cell keeps the lesson that is already stored. A file replaces it. */
export function importedLessonBody(written: string, existingBody: string | undefined, fileText: string | null): string {
  if (fileText !== null) return fileText;
  if (written.trim() !== '') return written;
  return existingBody ?? '';
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') cell += char;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((item) => item.some((value) => value.trim() !== ''));
}

function headerIndex(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  headers.forEach((header, index) => {
    map[header.trim().toLowerCase()] = index;
  });
  return map;
}

export function parseDuration(value: string): number | null {
  const text = value.trim();
  if (!text) return null;
  const clock = text.match(/^(\d+):([0-5]\d)$/);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  if (/^\d+$/.test(text)) return Number(text);
  return null;
}

function cell(row: string[], index: number | undefined): string {
  if (index === undefined) return '';
  return (row[index] ?? '').trim();
}

export function readManifest(csv: string): { rows: ManifestRow[]; issues: ManifestIssue[] } {
  const table = parseCsv(csv);
  if (table.length === 0) return { rows: [], issues: [{ line: 1, lessonId: '', message: 'The manifest is empty.' }] };
  const columns = headerIndex(table[0]);
  const required = ['lesson id', 'title', 'order', 'status'];
  const missing = required.filter((name) => columns[name] === undefined);
  if (missing.length > 0) {
    return { rows: [], issues: [{ line: 1, lessonId: '', message: `Add these columns: ${missing.join(', ')}.` }] };
  }
  const rows: ManifestRow[] = [];
  const issues: ManifestIssue[] = [];
  table.slice(1).forEach((record, offset) => {
    const line = offset + 2;
    const lessonId = cell(record, columns['lesson id']).toUpperCase();
    const statusText = cell(record, columns.status).toLowerCase();
    const status = statusText === 'draft' || statusText === 'ready' || statusText === 'live' ? statusText : null;
    const watchText = cell(record, columns['required watch percentage']);
    const watchPercent = watchText === '' ? null : Number(watchText);
    const completionText = cell(record, columns.completion).toLowerCase();
    const completion = completionText === 'keep' || completionText === 'review' ? completionText : null;
    const orderText = cell(record, columns.order);
    const order = /^\d+$/.test(orderText) ? Number(orderText) : null;
    const durationText = cell(record, columns.duration);
    const duration = durationText ? parseDuration(durationText) : null;
    if (!/^M[0-9]{2}-L[0-9]{2}$/.test(lessonId)) {
      issues.push({ line, lessonId, message: `${lessonId || 'This row'} is not a lesson ID like M07-L03.` });
      return;
    }
    if (order === null || order < 1) {
      issues.push({ line, lessonId, message: `${lessonId} needs an order number.` });
      return;
    }
    if (!status) {
      issues.push({ line, lessonId, message: `${lessonId} needs a status of Draft, Ready, or Live.` });
      return;
    }
    if (watchText !== '' && (!Number.isInteger(watchPercent) || (watchPercent ?? 0) < 1 || (watchPercent ?? 0) > 100)) {
      issues.push({ line, lessonId, message: `${lessonId} has a watch percentage that is not between 1 and 100.` });
      return;
    }
    if (durationText && duration === null) {
      issues.push({ line, lessonId, message: `${lessonId} has a duration that is not seconds or m:ss.` });
      return;
    }
    rows.push({
      line,
      lessonId,
      title: cell(record, columns.title),
      order,
      videoLink: cell(record, columns['video link']),
      documentFile: cell(record, columns['companion document file name']),
      duration,
      watchPercent,
      written: cell(record, columns['written lesson text or a file name for it']),
      status,
      completion,
    });
  });
  return { rows, issues };
}

export function planManifest(
  csv: string,
  fileNames: string[],
  existingCodes: string[],
): ManifestPlan {
  const parsed = readManifest(csv);
  const files = new Set(fileNames.map((name) => name.toLowerCase()));
  const existing = new Set(existingCodes.map((code) => code.toUpperCase()));
  const seen = new Set<string>();
  const creates: ManifestRow[] = [];
  const updates: ManifestRow[] = [];
  const skips: ManifestIssue[] = [...parsed.issues];

  for (const row of parsed.rows) {
    if (seen.has(row.lessonId)) {
      skips.push({ line: row.line, lessonId: row.lessonId, message: `${row.lessonId} is listed more than once.` });
      continue;
    }
    seen.add(row.lessonId);
    if (row.documentFile && !files.has(row.documentFile.toLowerCase())) {
      skips.push({
        line: row.line,
        lessonId: row.lessonId,
        message: `${row.lessonId} lists ${row.documentFile}, and that file was not uploaded.`,
      });
      continue;
    }
    if (/\.(md|txt)$/i.test(row.written) && !files.has(row.written.toLowerCase())) {
      skips.push({
        line: row.line,
        lessonId: row.lessonId,
        message: `${row.lessonId} lists ${row.written}, and that written file was not uploaded.`,
      });
      continue;
    }
    const writtenIsFile = row.written !== '' && files.has(row.written.toLowerCase());
    const hasWritten = row.written !== '' && !writtenIsFile;
    if (row.status === 'live' && row.title === '') {
      skips.push({ line: row.line, lessonId: row.lessonId, message: `${row.lessonId} is Live and has no title.` });
      continue;
    }
    if (row.status === 'live' && !row.videoLink && !hasWritten && !writtenIsFile) {
      skips.push({
        line: row.line,
        lessonId: row.lessonId,
        message: `${row.lessonId} is Live and needs a video or a written lesson.`,
      });
      continue;
    }
    if (existing.has(row.lessonId)) updates.push(row);
    else creates.push(row);
  }
  return { creates, updates, skips };
}

export function manifestCsv(rows: Record<string, string>[]): string {
  const lines = [MANIFEST_HEADERS.join(',')];
  for (const row of rows) {
    lines.push(MANIFEST_HEADERS.map((header) => csvCell(row[header] ?? '')).join(','));
  }
  return `${lines.join('\n')}\n`;
}

function csvCell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  if (/[",\n]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
  return safe;
}
