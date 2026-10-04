import { marked } from 'marked';

const WORDS = /[^0-9A-Za-z]+/g;

/** Same split the database uses: letters and digits, everything else is a space. */
export function countWords(value: string): number {
  const text = value.replace(WORDS, ' ').trim();
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

export function readingSeconds(words: number, wordsPerMinute: number, minimumSeconds: number): number {
  if (words <= 0) return 0;
  return Math.max(minimumSeconds, Math.ceil((words / wordsPerMinute) * 60));
}

const ALLOWED = new Set(['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'a']);

/** Headings, lists, bold, and links. Everything else is dropped. */
export function renderLesson(markdown: string): string {
  const html = marked.parse(markdown, { async: false, gfm: true, breaks: true }) as string;
  return html.replace(/<\/?([a-z0-9]+)(\s[^>]*)?>/gi, (match, tag: string, attrs: string | undefined) => {
    const name = tag.toLowerCase();
    if (!ALLOWED.has(name)) return '';
    if (match.startsWith('</')) return `</${name}>`;
    if (name === 'br') return '<br>';
    if (name === 'a') {
      const href = /href="(https?:\/\/[^"]+)"/i.exec(attrs ?? '');
      if (!href) return '';
      return `<a href="${href[1]}" rel="noopener noreferrer">`;
    }
    return `<${name}>`;
  });
}
