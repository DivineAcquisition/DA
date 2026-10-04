export const QUESTION_HEADERS = [
  'Module number',
  'Question text',
  'Type',
  'Scenario setup',
  'Option A',
  'Option B',
  'Option C',
  'Option D',
  'Correct option',
  'Explanation',
  'Concept tag',
  'Difficulty',
] as const;

export type QuestionRow = {
  line: number;
  moduleNumber: number;
  prompt: string;
  type: 'multiple_choice' | 'scenario';
  scenario: string;
  options: { id: string; text: string }[];
  correct: string;
  explanation: string;
  concept: string;
  difficulty: 'easy' | 'medium' | 'hard';
};

export type QuestionIssue = { line: number; prompt: string; message: string };

export type QuestionPlan = { creates: QuestionRow[]; skips: QuestionIssue[] };

export function blankQuestionManifest(): string {
  return `${QUESTION_HEADERS.join(',')}\n`;
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

function cell(row: string[], index: number | undefined): string {
  if (index === undefined) return '';
  return (row[index] ?? '').trim();
}

export function planQuestions(
  csv: string,
  known: { modules: number[]; concepts: { moduleNumber: number; name: string; linked: boolean }[]; prompts: { moduleNumber: number; prompt: string }[] },
): QuestionPlan {
  const table = parseCsv(csv);
  if (table.length === 0) return { creates: [], skips: [{ line: 1, prompt: '', message: 'The file is empty.' }] };
  const columns: Record<string, number> = {};
  table[0].forEach((header, index) => {
    columns[header.trim().toLowerCase()] = index;
  });
  const missing = ['module number', 'question text', 'type', 'correct option', 'concept tag', 'difficulty'].filter(
    (name) => columns[name] === undefined,
  );
  if (missing.length > 0) {
    return { creates: [], skips: [{ line: 1, prompt: '', message: `Add these columns: ${missing.join(', ')}.` }] };
  }
  const creates: QuestionRow[] = [];
  const skips: QuestionIssue[] = [];
  const seen = new Set<string>();
  table.slice(1).forEach((record, offset) => {
    const line = offset + 2;
    const moduleNumber = Number(cell(record, columns['module number']));
    const prompt = cell(record, columns['question text']);
    const typeText = cell(record, columns.type).toLowerCase();
    const type = typeText === 'scenario' ? 'scenario' : typeText === 'multiple choice' || typeText === 'multiple_choice' ? 'multiple_choice' : null;
    const scenario = cell(record, columns['scenario setup']);
    const letters = ['a', 'b', 'c', 'd'] as const;
    const texts = [
      cell(record, columns['option a']),
      cell(record, columns['option b']),
      cell(record, columns['option c']),
      cell(record, columns['option d']),
    ];
    const options = letters.flatMap((id, index) => (texts[index] ? [{ id, text: texts[index] }] : []));
    const correctLetter = cell(record, columns['correct option']).toLowerCase();
    const concept = cell(record, columns['concept tag']);
    const difficultyText = cell(record, columns.difficulty).toLowerCase();
    const difficulty = difficultyText === 'easy' || difficultyText === 'medium' || difficultyText === 'hard' ? difficultyText : null;
    const key = `${moduleNumber}:${prompt.toLowerCase()}`;
    if (!Number.isInteger(moduleNumber) || !known.modules.includes(moduleNumber)) {
      skips.push({ line, prompt, message: `${prompt || 'This row'} does not match a module.` });
      return;
    }
    if (!prompt) {
      skips.push({ line, prompt, message: `Line ${line} is missing the question text.` });
      return;
    }
    if (!type) {
      skips.push({ line, prompt, message: `${prompt} needs a type of multiple choice or scenario.` });
      return;
    }
    if (type === 'scenario' && !scenario) {
      skips.push({ line, prompt, message: `${prompt} is a scenario and has no situation.` });
      return;
    }
    if (options.length < 2) {
      skips.push({ line, prompt, message: `${prompt} needs at least two options.` });
      return;
    }
    if (!options.some((option) => option.id === correctLetter)) {
      skips.push({ line, prompt, message: `${prompt} has a correct option that does not match an option.` });
      return;
    }
    if (!difficulty) {
      skips.push({ line, prompt, message: `${prompt} needs a difficulty of easy, medium, or hard.` });
      return;
    }
    const tag = known.concepts.find((item) => item.moduleNumber === moduleNumber && item.name.toLowerCase() === concept.toLowerCase());
    if (!tag?.linked) {
      skips.push({ line, prompt, message: `${prompt} uses ${concept || 'a concept tag'} with no linked lesson.` });
      return;
    }
    if (seen.has(key) || known.prompts.some((item) => item.moduleNumber === moduleNumber && item.prompt.toLowerCase() === prompt.toLowerCase())) {
      skips.push({ line, prompt, message: `${prompt} is a duplicate question.` });
      return;
    }
    seen.add(key);
    creates.push({
      line,
      moduleNumber,
      prompt,
      type,
      scenario,
      options,
      correct: correctLetter,
      explanation: cell(record, columns.explanation),
      concept,
      difficulty,
    });
  });
  return { creates, skips };
}

export function questionCsv(rows: Record<string, string>[]): string {
  const lines = [QUESTION_HEADERS.join(',')];
  for (const row of rows) {
    lines.push(QUESTION_HEADERS.map((header) => csvCell(row[header] ?? '')).join(','));
  }
  return `${lines.join('\n')}\n`;
}

function csvCell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  if (/[",\n]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
  return safe;
}
