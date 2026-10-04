import 'server-only';
import { leadSystem, parseGrade, type GradeResult } from './grader';

const MODEL = process.env.ANTHROPIC_MODEL?.trim() || 'claude-sonnet-4-5';

type Usage = { tokensIn: number; tokensOut: number };

async function anthropic(system: string, user: string): Promise<{ text: string; usage: Usage } | null> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return null;
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1200,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as {
    content?: { type?: string; text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const text = payload.content?.find((block) => block.type === 'text')?.text ?? '';
  return {
    text,
    usage: { tokensIn: payload.usage?.input_tokens ?? 0, tokensOut: payload.usage?.output_tokens ?? 0 },
  };
}

function jsonFrom(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function leadReply(input: { persona: string; offer: string; transcript: { role: string; body: string }[] }): Promise<{ message: string | null; end: boolean; usage: Usage; called: boolean }> {
  const usage: Usage = { tokensIn: 0, tokensOut: 0 };
  let called = false;
  const once = async () => {
    const result = await anthropic(
      leadSystem(input.persona, input.offer),
      JSON.stringify({ transcript: input.transcript }),
    );
    if (!result) return null;
    called = true;
    usage.tokensIn += result.usage.tokensIn;
    usage.tokensOut += result.usage.tokensOut;
    const parsed = jsonFrom(result.text) as { message?: unknown; end?: unknown; outcome?: unknown } | null;
    if (!parsed || typeof parsed.message !== 'string' || !parsed.message.trim()) return null;
    return { message: parsed.message.trim(), end: parsed.end === true || parsed.outcome === true };
  };
  const first = await once();
  const second = first ?? (await once());
  return { message: second?.message ?? null, end: second?.end ?? false, usage, called };
}

export async function gradeWithModel(input: {
  transcript: { role: string; body: string; at: string }[];
  log: { outcome: string; learned: string; next: string; notes: string };
  rubric: { key: string; name: string; description: string; score0: string; score3: string; score5: string }[];
  offer: string;
  task?: 'simulation' | 'reflection';
}): Promise<{ grade: GradeResult | null; usage: Usage; called: boolean }> {
  const keys = input.rubric.map((item) => item.key);
  const system = input.task === 'reflection'
    ? 'Score the written reflection against the rubric. Return JSON with summary, violations, and criteria. Each criterion has key, score from 0 to 5, evidence quotes from the reflection, and next when the score is below 4. Be specific about what to improve.'
    : 'Score the transcript against the rubric. Return JSON with summary, violations, and criteria. Each criterion has key, score from 0 to 5, evidence quotes, and next when the score is below 4. Do not score speed.';
  const user = JSON.stringify({ transcript: input.transcript, log: input.log, rubric: input.rubric, offer: input.offer });
  const usage: Usage = { tokensIn: 0, tokensOut: 0 };
  let called = false;
  const once = async () => {
    const result = await anthropic(system, user);
    if (!result) return null;
    called = true;
    usage.tokensIn += result.usage.tokensIn;
    usage.tokensOut += result.usage.tokensOut;
    return parseGrade(jsonFrom(result.text), keys);
  };
  const first = await once();
  const grade = first ?? (await once());
  return { grade, usage, called };
}
