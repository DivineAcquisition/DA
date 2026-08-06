import { marked } from 'marked';
import { applyVariables } from './tokens';

marked.setOptions({
  gfm: true,
  breaks: true,
});

export function renderMarkdown(body: string, values: Record<string, string>): string {
  const withVars = applyVariables(body, values);
  const html = marked.parse(withVars, { async: false }) as string;
  return html;
}

export function renderTitle(title: string, values: Record<string, string>): string {
  return applyVariables(title, values);
}
