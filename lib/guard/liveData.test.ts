import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Prompt 8B guardrail: only live data moves through DivineACQ. This fails the
 * build when sample data creeps back into code that ships to users.
 *
 * Scanned: every .ts/.tsx under app/ and lib/, except tests and test fixtures.
 * Form placeholders (placeholder="...") are allowed: they are hints in an empty
 * field, not data. Training simulation content lives in the database's
 * training schema, never in code.
 */

const ROOT = join(__dirname, '..', '..');
const DIRS = ['app', 'lib'];

const IGNORE = [/\.test\.tsx?$/, /\/rules\/testData\.ts$/, /\/database\.types\.ts$/, /lib\/guard\//];

const MARKERS: { name: string; pattern: RegExp }[] = [
  { name: 'mock or sample data import', pattern: /from\s+['"][^'"]*(?:\/|^)(?:mock|mocks|sample|samples|fixtures?|demo|seed)(?:Data)?['"]/i },
  { name: 'sample constant', pattern: /\b(?:SAMPLE|MOCK|DEMO|FAKE)_[A-Z_]+\s*[=:]/ },
  { name: 'lorem ipsum', pattern: /lorem ipsum/i },
  { name: 'placeholder person', pattern: /\b(?:John|Jane) (?:Doe|Smith)\b/ },
  { name: 'placeholder company', pattern: /\bAcme(?: Corp| Inc)?\b/ },
  { name: 'example email', pattern: /\b[\w.+-]+@example\.(?:com|org|net)\b/i },
  { name: 'fake phone number', pattern: /\b555[-.\s)]\s?\d{3}[-.\s]\d{4}\b/ },
];

/** Strip form placeholders and comments: hints and notes, not data shown as fact. */
function shipped(source: string): string {
  return source
    .replace(/placeholder=(?:"[^"]*"|'[^']*'|\{[^}]*\})/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function files(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    if (statSync(path).isDirectory()) out.push(...files(path));
    else if (/\.tsx?$/.test(entry)) out.push(path);
  }
  return out;
}

export function findSampleData(source: string): string[] {
  const text = shipped(source);
  return MARKERS.filter((m) => m.pattern.test(text)).map((m) => m.name);
}

describe('live data only', () => {
  it('finds the markers it is meant to find', () => {
    expect(findSampleData(`import { rows } from '@/lib/mock';`)).toContain('mock or sample data import');
    expect(findSampleData(`export const SAMPLE_LEADS = [];`)).toContain('sample constant');
    expect(findSampleData(`<p>Contact jane@example.com</p>`)).toContain('example email');
    expect(findSampleData(`<p>John Doe, Acme Inc</p>`)).toEqual(['placeholder person', 'placeholder company']);
    expect(findSampleData(`<input placeholder="jane@example.com" />`)).toEqual([]);
  });

  it('ships no sample data in app/ or lib/', () => {
    const hits: string[] = [];
    for (const dir of DIRS) {
      for (const path of files(join(ROOT, dir))) {
        const rel = relative(ROOT, path);
        if (IGNORE.some((re) => re.test(rel))) continue;
        for (const name of findSampleData(readFileSync(path, 'utf8'))) hits.push(`${rel}: ${name}`);
      }
    }
    expect(hits).toEqual([]);
  });
});
