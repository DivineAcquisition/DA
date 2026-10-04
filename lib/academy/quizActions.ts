'use server';

import { controlRpc, readable } from '@/lib/ad/rpc';
import { createClient } from '@/lib/supabase/server';

export async function startQuiz(moduleId: string, device: string): Promise<{ ok: true; state: Record<string, unknown> } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await controlRpc<Record<string, unknown>>(supabase, 'academy_start_quiz', {
    p_module_id: moduleId,
    p_device: device,
  });
  if (error || !data) return { ok: false, error: error ? readable(error) : 'The quiz did not start.' };
  return { ok: true, state: data };
}

export async function saveQuizAnswer(
  attemptId: string,
  questionId: string,
  optionId: string,
): Promise<{ ok: true; state: Record<string, unknown> } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await controlRpc<Record<string, unknown>>(supabase, 'academy_save_quiz_answer', {
    p_attempt_id: attemptId,
    p_question_id: questionId,
    p_option_id: optionId,
  });
  if (error || !data) return { ok: false, error: error ? readable(error) : 'The answer was not saved.' };
  return { ok: true, state: data };
}

export async function submitQuiz(attemptId: string): Promise<{ ok: true; state: Record<string, unknown> } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await controlRpc<Record<string, unknown>>(supabase, 'academy_submit_quiz', {
    p_attempt_id: attemptId,
  });
  if (error || !data) return { ok: false, error: error ? readable(error) : 'The quiz was not submitted.' };
  return { ok: true, state: data };
}
