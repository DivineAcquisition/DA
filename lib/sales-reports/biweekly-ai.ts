import 'server-only';

import Anthropic from '@anthropic-ai/sdk';
import type { Draft } from './biweekly';

/**
 * Writes the client-facing analysis for a bi-weekly report with Claude, from
 * the findings and the rule-based draft (see aiInput). Returns null when
 * ANTHROPIC_API_KEY is not set, the call fails, or the answer does not have
 * the expected shape; the caller then sends the rule-based draft.
 */

const MODEL = process.env.ANTHROPIC_REPORT_MODEL?.trim() || 'claude-opus-5-5';

const SYSTEM = `You write the analysis section of a bi-weekly client report for Divine Acquisition, which places Sales Operators with home-service businesses.

You get the period's data as JSON: the operator's numbers against their targets, the change from the two weeks before, how consistently they submitted end-of-day reports, results such as bookings, their end-of-day notes, and a draft written by rule.

Write for the client, the business owner who pays for the seat:
- summary: 2 to 4 plain sentences on how the two weeks went. Lead with what matters most to the business (results and the biggest gap).
- improvements: 2 to 4 specific things the operator must do better, each one sentence, each tied to a number in the data.
- focus: 2 to 4 sales priorities for the next two weeks, each one sentence with a concrete, measurable aim.

Rules:
- Use only numbers that appear in the data. Never invent, estimate or round them into something new.
- When a number's source is "operator reported", do not describe it as verified or confirmed.
- Do not mention GoHighLevel syncing, data checks, mismatches, pay, the management fee, or anything internal.
- Refer to the operator by first name. No greetings, no sign-off, no headings, no emoji, no markdown.
- Be direct and constructive. No hype words.`;

const SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    improvements: { type: 'array', items: { type: 'string' } },
    focus: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'improvements', 'focus'],
  additionalProperties: false,
} as const;

function clean(list: unknown, max: number): string[] {
  return Array.isArray(list)
    ? list
        .map((item) => (typeof item === 'string' ? item.replace(/\s+/g, ' ').trim() : ''))
        .filter((item) => item.length > 0)
        .map((item) => item.slice(0, 400))
        .slice(0, max)
    : [];
}

export async function aiDraft(input: string): Promise<Draft | null> {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) return null;
  // An organization-level key (not scoped to a workspace) must name the
  // workspace on every request; a workspace-scoped key needs nothing.
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
  const client = new Anthropic({
    maxRetries: 2,
    timeout: 120_000,
    ...(workspace ? { defaultHeaders: { 'anthropic-workspace-id': workspace } } : {}),
  });
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // On a policy decline, the API re-runs the request on a fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
      system: SYSTEM,
      messages: [{ role: 'user', content: `Write the analysis for this period.\n\n${input}` }],
    });
    if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') return null;
    const text = response.content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('')
      .trim();
    if (!text) return null;
    const parsed = JSON.parse(text) as { summary?: unknown; improvements?: unknown; focus?: unknown };
    const summary = typeof parsed.summary === 'string' ? parsed.summary.replace(/\s+/g, ' ').trim().slice(0, 1200) : '';
    const improvements = clean(parsed.improvements, 4);
    const focus = clean(parsed.focus, 4);
    if (!summary || improvements.length === 0 || focus.length === 0) return null;
    return { summary, improvements, focus, source: 'ai', model: response.model };
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(`[biweekly-report] Claude API error ${error.status ?? ''}: ${error.message}`);
    } else if (error instanceof SyntaxError) {
      console.error('[biweekly-report] Claude returned text that is not JSON');
    } else {
      console.error('[biweekly-report] Claude call failed', error);
    }
    return null;
  }
}
