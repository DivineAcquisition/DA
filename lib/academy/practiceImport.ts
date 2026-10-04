export const SIMULATION_HEADERS = [
  'Title',
  'Vertical',
  'Module number',
  'Gate part',
  'Brief',
  'Persona',
  'Difficulty',
  'Offer pack name',
  'Offer pack version',
  'Rubric name',
  'Rubric version',
  'Max turns',
  'Time limit seconds',
  'Pass score',
  'Capstone',
  'Status',
] as const;

export const DRILL_HEADERS = [
  'Module number',
  'Situation',
  'Source',
  'Reply speed',
  'Earlier touches',
  'Readiness',
  'Move A',
  'Move B',
  'Move C',
  'Move D',
  'Correct move',
  'Concept tag',
  'Difficulty',
  'Explanation',
] as const;

export type ImportIssue = { line: number; label: string; message: string };

export type SimulationDraft = {
  line: number;
  title: string;
  vertical: string;
  moduleId: string;
  gatePartId: string | null;
  brief: string;
  persona: string;
  difficulty: string;
  offerPackId: string | null;
  rubricId: string | null;
  maxTurns: number;
  timeLimitSeconds: number | null;
  passScore: number | null;
  capstone: boolean;
  status: string;
};

export type DrillDraft = {
  line: number;
  module: number;
  situation: string;
  source: string;
  replySpeed: string;
  earlierTouches: string;
  readiness: string;
  moves: { id: string; text: string }[];
  correctMove: string;
  concept: string;
  difficulty: string;
  explanation: string;
};

export type SimulationPlan = { creates: SimulationDraft[]; skips: ImportIssue[] };
export type DrillPlan = { creates: DrillDraft[]; skips: ImportIssue[] };

const VERTICALS: Record<string, string> = {
  'med spa': 'med_spa',
  med_spa: 'med_spa',
  'home services': 'home_services',
  home_services: 'home_services',
  'coaches and consultants': 'coaches',
  coaches: 'coaches',
  general: 'general',
};

const READINESS: Record<string, string> = {
  'not ready': 'not_ready',
  not_ready: 'not_ready',
  ready: 'ready',
  'not a fit': 'not_a_fit',
  not_a_fit: 'not_a_fit',
};

export function blankSimulationManifest(): string {
  return `${SIMULATION_HEADERS.join(',')}\n`;
}

export function blankDrillManifest(): string {
  return `${DRILL_HEADERS.join(',')}\n`;
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

function columnsOf(header: string[]): Record<string, number> {
  const columns: Record<string, number> = {};
  header.forEach((name, index) => {
    columns[name.trim().toLowerCase()] = index;
  });
  return columns;
}

function cell(row: string[], columns: Record<string, number>, name: string): string {
  const index = columns[name];
  if (index === undefined) return '';
  return (row[index] ?? '').trim();
}

function missingColumns(columns: Record<string, number>, required: string[]): string[] {
  return required.filter((name) => columns[name] === undefined);
}

export function planSimulations(
  csv: string,
  known: {
    modules: { order: number; id: string; parts: { key: string; id: string }[] }[];
    packs: { name: string; version: number; id: string }[];
    rubrics: { name: string; version: number; id: string }[];
    titles: { moduleId: string; title: string }[];
  },
): SimulationPlan {
  const table = parseCsv(csv);
  if (table.length === 0) return { creates: [], skips: [{ line: 1, label: '', message: 'The file is empty.' }] };
  const columns = columnsOf(table[0]);
  const missing = missingColumns(columns, ['title', 'vertical', 'module number', 'brief', 'persona', 'status']);
  if (missing.length > 0) return { creates: [], skips: [{ line: 1, label: '', message: `Add these columns: ${missing.join(', ')}.` }] };
  const creates: SimulationDraft[] = [];
  const skips: ImportIssue[] = [];
  const seen = new Set<string>();
  table.slice(1).forEach((record, offset) => {
    const line = offset + 2;
    const title = cell(record, columns, 'title');
    const moduleNumber = Number(cell(record, columns, 'module number'));
    const moduleRow = known.modules.find((item) => item.order === moduleNumber);
    const vertical = VERTICALS[cell(record, columns, 'vertical').toLowerCase()] ?? '';
    const difficultyText = cell(record, columns, 'difficulty').toLowerCase() || 'standard';
    const difficulty = ['easy', 'standard', 'hard'].includes(difficultyText) ? difficultyText : '';
    const statusText = cell(record, columns, 'status').toLowerCase() || 'draft';
    const status = ['draft', 'ready', 'live'].includes(statusText) ? statusText : '';
    const brief = cell(record, columns, 'brief');
    const persona = cell(record, columns, 'persona');
    const gateKey = cell(record, columns, 'gate part').toLowerCase();
    const gate = moduleRow?.parts.find((part) => part.key === gateKey) ?? null;
    const packName = cell(record, columns, 'offer pack name');
    const packVersion = Number(cell(record, columns, 'offer pack version'));
    const pack = known.packs.find((item) => item.name.toLowerCase() === packName.toLowerCase() && item.version === packVersion) ?? null;
    const rubricName = cell(record, columns, 'rubric name');
    const rubricVersion = Number(cell(record, columns, 'rubric version'));
    const rubric = known.rubrics.find((item) => item.name.toLowerCase() === rubricName.toLowerCase() && item.version === rubricVersion) ?? null;
    const key = `${moduleRow?.id ?? moduleNumber}:${title.toLowerCase()}`;
    if (!title) {
      skips.push({ line, label: title, message: `Line ${line} is missing a title.` });
      return;
    }
    if (!moduleRow) {
      skips.push({ line, label: title, message: `${title} does not match a module.` });
      return;
    }
    if (!vertical) {
      skips.push({ line, label: title, message: `${title} needs a vertical of Med Spa, Home Services, Coaches and Consultants, or General.` });
      return;
    }
    if (!difficulty) {
      skips.push({ line, label: title, message: `${title} needs a difficulty of easy, standard, or hard.` });
      return;
    }
    if (!status) {
      skips.push({ line, label: title, message: `${title} needs a status of Draft, Ready, or Live.` });
      return;
    }
    if (gateKey && !gate) {
      skips.push({ line, label: title, message: `${title} uses a gate part that is not on that module.` });
      return;
    }
    if (packName && !pack) {
      skips.push({ line, label: title, message: `${title} does not match an Offer Pack version.` });
      return;
    }
    if (rubricName && !rubric) {
      skips.push({ line, label: title, message: `${title} does not match a rubric version.` });
      return;
    }
    if (status === 'live' && (!brief || !persona || !pack || !rubric)) {
      skips.push({ line, label: title, message: `${title} cannot go Live without a brief, a persona, an Offer Pack version, and a rubric.` });
      return;
    }
    if (seen.has(key) || known.titles.some((item) => item.moduleId === moduleRow.id && item.title.toLowerCase() === title.toLowerCase())) {
      skips.push({ line, label: title, message: `${title} is already in that module. Nothing was deleted.` });
      return;
    }
    const turns = Number(cell(record, columns, 'max turns') || 12);
    const limit = cell(record, columns, 'time limit seconds');
    const pass = cell(record, columns, 'pass score');
    if (!Number.isInteger(turns) || turns < 2 || turns > 40) {
      skips.push({ line, label: title, message: `${title} needs between 2 and 40 turns.` });
      return;
    }
    if (limit && (!Number.isInteger(Number(limit)) || Number(limit) < 60 || Number(limit) > 7200)) {
      skips.push({ line, label: title, message: `${title} needs a time limit between 60 and 7200 seconds, or none.` });
      return;
    }
    seen.add(key);
    creates.push({
      line,
      title,
      vertical,
      moduleId: moduleRow.id,
      gatePartId: gate?.id ?? null,
      brief,
      persona,
      difficulty,
      offerPackId: pack?.id ?? null,
      rubricId: rubric?.id ?? null,
      maxTurns: turns,
      timeLimitSeconds: limit ? Number(limit) : null,
      passScore: pass ? Number(pass) : null,
      capstone: ['yes', 'true', '1'].includes(cell(record, columns, 'capstone').toLowerCase()),
      status,
    });
  });
  return { creates, skips };
}

export function planDrills(
  csv: string,
  known: { modules: number[] },
): DrillPlan {
  const table = parseCsv(csv);
  if (table.length === 0) return { creates: [], skips: [{ line: 1, label: '', message: 'The file is empty.' }] };
  const columns = columnsOf(table[0]);
  const missing = missingColumns(columns, ['module number', 'situation', 'readiness', 'move a', 'move b', 'correct move']);
  if (missing.length > 0) return { creates: [], skips: [{ line: 1, label: '', message: `Add these columns: ${missing.join(', ')}.` }] };
  const creates: DrillDraft[] = [];
  const skips: ImportIssue[] = [];
  table.slice(1).forEach((record, offset) => {
    const line = offset + 2;
    const situation = cell(record, columns, 'situation');
    const moduleNumber = Number(cell(record, columns, 'module number'));
    const readiness = READINESS[cell(record, columns, 'readiness').toLowerCase()] ?? '';
    const letters = ['a', 'b', 'c', 'd'] as const;
    const moves = letters.flatMap((id) => {
      const text = cell(record, columns, `move ${id}`);
      return text ? [{ id, text }] : [];
    });
    const correctLetter = cell(record, columns, 'correct move').toLowerCase();
    const difficultyText = cell(record, columns, 'difficulty').toLowerCase() || 'standard';
    const difficulty = difficultyText === 'medium' ? 'standard' : difficultyText;
    if (!situation) {
      skips.push({ line, label: situation, message: `Line ${line} is missing the lead situation.` });
      return;
    }
    if (!Number.isInteger(moduleNumber) || !known.modules.includes(moduleNumber)) {
      skips.push({ line, label: situation, message: `${situation} does not match a module.` });
      return;
    }
    if (!readiness) {
      skips.push({ line, label: situation, message: `${situation} needs a readiness of not ready, ready, or not a fit.` });
      return;
    }
    if (moves.length < 2) {
      skips.push({ line, label: situation, message: `${situation} needs at least two next moves.` });
      return;
    }
    if (!moves.some((move) => move.id === correctLetter)) {
      skips.push({ line, label: situation, message: `${situation} has a correct move that does not match an option.` });
      return;
    }
    if (!['easy', 'standard', 'hard'].includes(difficulty)) {
      skips.push({ line, label: situation, message: `${situation} needs a difficulty of easy, standard, or hard.` });
      return;
    }
    creates.push({
      line,
      module: moduleNumber,
      situation,
      source: cell(record, columns, 'source'),
      replySpeed: cell(record, columns, 'reply speed'),
      earlierTouches: cell(record, columns, 'earlier touches'),
      readiness,
      moves,
      correctMove: correctLetter,
      concept: cell(record, columns, 'concept tag'),
      difficulty,
      explanation: cell(record, columns, 'explanation'),
    });
  });
  return { creates, skips };
}
