'use server';

import { revalidatePath } from 'next/cache';
import { controlRpc, readable } from '@/lib/ad/rpc';
import { academyAdminSession } from '@/lib/academy/access';
import { planQuestions, type QuestionPlan, type QuestionRow } from '@/lib/academy/questionImport';
import { workspaceClient } from '@/lib/workspace/db';

async function gate() {
  const session = await academyAdminSession();
  if (!session) return null;
  const client = await workspaceClient();
  if (!client) return null;
  return { session, client };
}

export async function saveQuizSettings(formData: FormData): Promise<void> {
  const admin = await gate();
  if (!admin) return;
  const limit = String(formData.get('time_limit') ?? '').trim();
  const { error } = await controlRpc(admin.client, 'academy_save_quiz_settings', {
    p_payload: {
      id: String(formData.get('id') ?? ''),
      questions_per_attempt: Number(formData.get('questions')),
      pass_mark: Number(formData.get('pass_mark')),
      pass_mark_unit: String(formData.get('pass_unit') ?? ''),
      max_attempts: Number(formData.get('max_attempts')),
      lockout_minutes: Number(formData.get('lockout')),
      shuffle_answers: formData.get('shuffle') === 'on',
      active: formData.get('active') === 'on',
      time_limit_seconds: limit ? Number(limit) * 60 : null,
      abandoned_minutes: Number(formData.get('abandoned')),
      min_seconds_per_question: Number(formData.get('minimum')),
    },
  });
  if (error) throw new Error(readable(error));
  revalidatePath('/workspace/academy/quizzes');
}

export async function saveConcept(formData: FormData): Promise<void> {
  const admin = await gate();
  if (!admin) return;
  const { error } = await controlRpc(admin.client, 'academy_save_concept', {
    p_payload: {
      module_id: String(formData.get('module_id') ?? ''),
      name: String(formData.get('name') ?? ''),
      lesson_id: String(formData.get('lesson_id') ?? ''),
    },
  });
  if (error) throw new Error(readable(error));
  revalidatePath('/workspace/academy/questions');
}

export async function saveQuestion(formData: FormData): Promise<{ ok: boolean; error?: string; id?: string }> {
  const admin = await gate();
  if (!admin) return { ok: false, error: 'Academy admin access is required.' };
  const options = ['a', 'b', 'c', 'd'].flatMap((id) => {
    const text = String(formData.get(`option_${id}`) ?? '').trim();
    return text ? [{ id, text }] : [];
  });
  const { data, error } = await controlRpc<{ id?: string }>(admin.client, 'academy_save_question', {
    p_payload: {
      id: String(formData.get('id') ?? '') || null,
      module_id: String(formData.get('module_id') ?? ''),
      prompt: String(formData.get('prompt') ?? ''),
      question_type: String(formData.get('question_type') ?? ''),
      scenario: String(formData.get('scenario') ?? ''),
      options,
      correct_answer: String(formData.get('correct') ?? ''),
      explanation: String(formData.get('explanation') ?? ''),
      concept_id: String(formData.get('concept_id') ?? '') || null,
      difficulty: String(formData.get('difficulty') ?? ''),
      active: formData.get('active') === 'on',
    },
  });
  if (error) return { ok: false, error: readable(error) };
  revalidatePath('/workspace/academy/questions');
  return { ok: true, id: data?.id };
}

export async function setQuestionActive(formData: FormData): Promise<void> {
  const admin = await gate();
  if (!admin) return;
  const { error } = await controlRpc(admin.client, 'academy_set_question_active', {
    p_question_id: String(formData.get('id') ?? ''),
    p_active: String(formData.get('active') ?? '') === 'true',
  });
  if (error) throw new Error(readable(error));
  revalidatePath('/workspace/academy/questions');
}

export async function satisfyGate(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const admin = await gate();
  if (!admin) return { ok: false, error: 'Academy admin access is required.' };
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const { data: profile } = await admin.client.from('profile').select('id').eq('email', email).maybeSingle();
  const profileId = (profile as { id?: string } | null)?.id;
  if (!profileId) return { ok: false, error: 'No account uses that email.' };
  const { data: enrollment } = await admin.client
    .from('academy_enrollment')
    .select('id')
    .eq('profile_id', profileId)
    .neq('status', 'withdrawn')
    .limit(1)
    .maybeSingle();
  const enrollmentId = (enrollment as { id?: string } | null)?.id;
  if (!enrollmentId) return { ok: false, error: 'That account has no Academy enrollment.' };
  const { error } = await controlRpc(admin.client, 'academy_satisfy_gate', {
    p_enrollment_id: enrollmentId,
    p_part_id: String(formData.get('part_id') ?? ''),
    p_note: String(formData.get('note') ?? ''),
  });
  if (error) return { ok: false, error: readable(error) };
  return { ok: true };
}

export async function previewQuestionImport(formData: FormData): Promise<{ ok: true; plan: QuestionPlan } | { ok: false; error: string }> {
  const built = await buildQuestionPlan(formData);
  if (!built.ok) return built;
  return { ok: true, plan: built.plan };
}

export async function confirmQuestionImport(
  formData: FormData,
): Promise<{ ok: true; result: { created: number; skipped: number; detail: { prompt?: string; action: string; message?: string }[] } } | { ok: false; error: string }> {
  const built = await buildQuestionPlan(formData);
  if (!built.ok) return built;
  const admin = await gate();
  if (!admin) return { ok: false, error: 'Academy admin access is required.' };
  const { data, error } = await controlRpc<{
    created: number;
    skipped: number;
    detail: { prompt?: string; action: string; message?: string }[];
  }>(admin.client, 'academy_apply_question_import', {
    p_file_name: built.fileName,
    p_rows: built.rows,
  });
  if (error || !data) return { ok: false, error: error ? readable(error) : 'The import did not finish.' };
  revalidatePath('/workspace/academy/questions');
  return { ok: true, result: data };
}

async function buildQuestionPlan(formData: FormData) {
  const admin = await gate();
  if (!admin) return { ok: false as const, error: 'Academy admin access is required.' };
  const manifest = formData.get('manifest');
  if (!(manifest instanceof File)) return { ok: false as const, error: 'Choose a question file.' };
  const { data: modules } = await admin.client.from('academy_module').select('id, order_number');
  const moduleRows = (modules ?? []) as { id: string; order_number: number }[];
  const { data: concepts } = await admin.client.from('academy_concept').select('id, module_id, name, lesson_id');
  const conceptRows = (concepts ?? []) as { id: string; module_id: string; name: string; lesson_id: string | null }[];
  const { data: questions } = await admin.client.from('academy_question').select('module_id, prompt');
  const questionRows = (questions ?? []) as { module_id: string; prompt: string }[];
  const orderOf = new Map(moduleRows.map((row) => [row.id, row.order_number]));
  const plan = planQuestions(await manifest.text(), {
    modules: moduleRows.map((row) => row.order_number),
    concepts: conceptRows.map((row) => ({
      moduleNumber: orderOf.get(row.module_id) ?? -1,
      name: row.name,
      linked: Boolean(row.lesson_id),
    })),
    prompts: questionRows.map((row) => ({ moduleNumber: orderOf.get(row.module_id) ?? -1, prompt: row.prompt })),
  });
  const moduleId = new Map<number, string[]>();
  for (const row of moduleRows) {
    const list = moduleId.get(row.order_number) ?? [];
    list.push(row.id);
    moduleId.set(row.order_number, list);
  }
  const rows: Record<string, unknown>[] = [];
  const creates: QuestionRow[] = [];
  for (const row of plan.creates) {
    const modulesForNumber = moduleId.get(row.moduleNumber) ?? [];
    if (modulesForNumber.length !== 1) {
      plan.skips.push({ line: row.line, prompt: row.prompt, message: `${row.prompt} matches more than one module.` });
      continue;
    }
    const concept = conceptRows.find(
      (item) => orderOf.get(item.module_id) === row.moduleNumber && item.name.toLowerCase() === row.concept.toLowerCase(),
    );
    if (!concept) {
      plan.skips.push({ line: row.line, prompt: row.prompt, message: `${row.prompt} uses a concept tag with no linked lesson.` });
      continue;
    }
    creates.push(row);
    rows.push({
      module_id: modulesForNumber[0],
      prompt: row.prompt,
      question_type: row.type,
      scenario: row.scenario,
      options: row.options,
      correct_answer: row.correct,
      explanation: row.explanation,
      concept_id: concept.id,
      difficulty: row.difficulty,
      active: true,
    });
  }
  plan.creates = creates;
  return { ok: true as const, plan, rows, fileName: manifest.name };
}
