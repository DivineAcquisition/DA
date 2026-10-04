'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { controlRpc, readable } from '@/lib/ad/rpc';
import { academyAdminSession, academyHoldSession } from '@/lib/academy/access';
import { planDrills, planSimulations, type DrillPlan, type SimulationPlan } from '@/lib/academy/practiceImport';
import { createClient } from '@/lib/supabase/server';
import { serviceClient } from '@/lib/workspace/db';

type Catalog = {
  modules?: { id: string; order: number; title: string; parts?: { id: string; key: string; label: string }[] }[];
  packs?: { id: string; name: string; version: number }[];
  rubrics?: { id: string; name: string; version: number }[];
  simulations?: { id: string; title: string; module_id: string }[];
};

async function adminClient() {
  const session = await academyAdminSession();
  if (!session) return null;
  return createClient();
}

async function readCatalog(supabase: Awaited<ReturnType<typeof createClient>>): Promise<{ ok: true; data: Catalog } | { ok: false; error: string }> {
  const { data, error } = await controlRpc<Catalog>(supabase, 'academy_practice_catalog');
  if (error || !data) return { ok: false, error: error ? readable(error) : 'The practice catalog did not load.' };
  return { ok: true, data };
}

export async function previewSimulationImport(formData: FormData): Promise<{ ok: true; plan: SimulationPlan } | { ok: false; error: string }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: 'Academy admin access is required.' };
  const file = formData.get('manifest');
  if (!(file instanceof File)) return { ok: false, error: 'Choose a simulation file.' };
  const catalog = await readCatalog(supabase);
  if (!catalog.ok) return catalog;
  const plan = planSimulations(await file.text(), {
    modules: (catalog.data.modules ?? []).map((module) => ({
      order: module.order,
      id: module.id,
      parts: (module.parts ?? []).map((part) => ({ key: part.key, id: part.id })),
    })),
    packs: (catalog.data.packs ?? []).map((pack) => ({ name: pack.name, version: pack.version, id: pack.id })),
    rubrics: (catalog.data.rubrics ?? []).map((rubric) => ({ name: rubric.name, version: rubric.version, id: rubric.id })),
    titles: (catalog.data.simulations ?? []).map((item) => ({ moduleId: item.module_id, title: item.title })),
  });
  return { ok: true, plan };
}

export async function confirmSimulationImport(formData: FormData): Promise<{ ok: true; created: number; skipped: number } | { ok: false; error: string }> {
  const preview = await previewSimulationImport(formData);
  if (!preview.ok) return preview;
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: 'Academy admin access is required.' };
  let created = 0;
  for (const row of preview.plan.creates) {
    const { error } = await controlRpc(supabase, 'academy_sim_save', {
      p_payload: {
        title: row.title,
        vertical: row.vertical,
        module_id: row.moduleId,
        gate_part_id: row.gatePartId,
        brief: row.brief,
        persona: row.persona,
        difficulty: row.difficulty,
        offer_pack_id: row.offerPackId,
        rubric_id: row.rubricId,
        max_turns: row.maxTurns,
        time_limit_seconds: row.timeLimitSeconds,
        pass_score: row.passScore,
        capstone: row.capstone,
        status: row.status,
      },
    });
    if (error) return { ok: false, error: readable(error) };
    created += 1;
  }
  revalidatePath('/workspace/academy/simulations');
  return { ok: true, created, skipped: preview.plan.skips.length };
}

export async function previewDrillImport(formData: FormData): Promise<{ ok: true; plan: DrillPlan } | { ok: false; error: string }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: 'Academy admin access is required.' };
  const file = formData.get('manifest');
  if (!(file instanceof File)) return { ok: false, error: 'Choose a drill file.' };
  const catalog = await readCatalog(supabase);
  if (!catalog.ok) return catalog;
  return {
    ok: true,
    plan: planDrills(await file.text(), { modules: (catalog.data.modules ?? []).map((module) => module.order) }),
  };
}

export async function confirmDrillImport(formData: FormData): Promise<{ ok: true; created: number; skipped: number } | { ok: false; error: string }> {
  const preview = await previewDrillImport(formData);
  if (!preview.ok) return preview;
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: 'Academy admin access is required.' };
  if (preview.plan.creates.length === 0) return { ok: true, created: 0, skipped: preview.plan.skips.length };
  const { error } = await controlRpc(supabase, 'academy_drill_import', {
    p_items: preview.plan.creates.map((row) => ({
      module: row.module,
      situation: row.situation,
      source: row.source,
      reply_speed: row.replySpeed,
      earlier_touches: row.earlierTouches,
      readiness: row.readiness,
      moves: row.moves,
      correct_move: row.correctMove,
      concept: row.concept,
      difficulty: row.difficulty,
      explanation: row.explanation,
    })),
  });
  if (error) return { ok: false, error: readable(error) };
  revalidatePath('/workspace/academy/drills/import');
  return { ok: true, created: preview.plan.creates.length, skipped: preview.plan.skips.length };
}

export async function saveRubric(formData: FormData) {
  const supabase = await adminClient();
  if (!supabase) redirect('/workspace/login');
  const count = Number(formData.get('count') ?? 0);
  const criteria = [];
  for (let index = 0; index < count; index += 1) {
    const name = String(formData.get(`name_${index}`) ?? '').trim();
    if (!name) continue;
    const rawKey = String(formData.get(`key_${index}`) ?? '').trim();
    criteria.push({
      key: (rawKey || name).toLowerCase().replace(/[^a-z0-9]+/g, '_'),
      name,
      description: String(formData.get(`description_${index}`) ?? ''),
      weight: Number(formData.get(`weight_${index}`) ?? 1),
      score_0: String(formData.get(`score0_${index}`) ?? ''),
      score_3: String(formData.get(`score3_${index}`) ?? ''),
      score_5: String(formData.get(`score5_${index}`) ?? ''),
      critical: formData.get(`critical_${index}`) === 'on',
      minimum_score: Number(formData.get(`minimum_${index}`) ?? 0),
      sort_order: index + 1,
    });
  }
  const { error } = await controlRpc(supabase, 'academy_rubric_save', {
    p_payload: { name: String(formData.get('name') ?? ''), kind: String(formData.get('kind') ?? 'conversation'), criteria },
  });
  if (error) redirect(`/workspace/academy/rubrics?error=${encodeURIComponent(readable(error))}`);
  revalidatePath('/workspace/academy/rubrics');
}

export async function saveReflectionPrompt(formData: FormData) {
  const supabase = await adminClient();
  if (!supabase) redirect('/workspace/login');
  const { error } = await controlRpc(supabase, 'academy_reflection_save', {
    p_payload: {
      id: String(formData.get('id') ?? '') || null,
      module_id: String(formData.get('module_id') ?? ''),
      gate_part_id: String(formData.get('gate_part_id') ?? '') || null,
      prompt: String(formData.get('prompt') ?? ''),
      min_words: Number(formData.get('min_words') ?? 150),
      rubric_id: String(formData.get('rubric_id') ?? '') || null,
      pass_total: Number(formData.get('pass_total') ?? 10),
      criterion_min: Number(formData.get('criterion_min') ?? 2),
      status: String(formData.get('status') ?? 'draft'),
    },
  });
  if (error) redirect(`/workspace/academy/reflections?error=${encodeURIComponent(readable(error))}`);
  revalidatePath('/workspace/academy/reflections');
}

export async function savePracticalDefinition(formData: FormData) {
  const supabase = await adminClient();
  if (!supabase) redirect('/workspace/login');
  const labels = String(formData.get('items') ?? '').split('\n').map((line) => line.trim()).filter(Boolean);
  const { error } = await controlRpc(supabase, 'academy_practical_save', {
    p_payload: {
      id: String(formData.get('id') ?? '') || null,
      module_id: String(formData.get('module_id') ?? ''),
      gate_part_id: String(formData.get('gate_part_id') ?? '') || null,
      title: String(formData.get('title') ?? ''),
      instructions: String(formData.get('instructions') ?? ''),
      status: String(formData.get('status') ?? 'draft'),
      items: labels.map((label, index) => {
        const optional = /^optional\s+/i.test(label);
        return {
          label: label.replace(/^optional\s+/i, ''),
          required: !optional,
          sort_order: index + 1,
        };
      }),
    },
  });
  if (error) redirect(`/workspace/academy/practicals?error=${encodeURIComponent(readable(error))}`);
  revalidatePath('/workspace/academy/practicals');
}

export async function savePracticeSettings(formData: FormData) {
  const supabase = await adminClient();
  if (!supabase) redirect('/workspace/login');
  const num = (name: string) => {
    const raw = String(formData.get(name) ?? '').trim();
    return raw === '' ? null : Number(raw);
  };
  const bands = {
    '5': num('speed_5'),
    '4': num('speed_4'),
    '3': num('speed_3'),
    '2': num('speed_2'),
    '1': num('speed_1'),
  };
  const { error } = await controlRpc(supabase, 'academy_practice_settings', {
    p_payload: {
      sim_max_attempts: num('sim_max_attempts'),
      sim_lockout_minutes: num('sim_lockout_minutes'),
      sim_abandoned_minutes: num('sim_abandoned_minutes'),
      sim_daily_limit: num('sim_daily_limit'),
      sim_pass_score: num('sim_pass_score'),
      capstone_pass_score: num('capstone_pass_score'),
      capstone_compliance_min: num('capstone_compliance_min'),
      reflection_max_attempts: num('reflection_max_attempts'),
      reflection_min_words: num('reflection_min_words'),
      practical_max_submissions: num('practical_max_submissions'),
      drill_questions: num('drill_questions'),
      drill_pass_mark: num('drill_pass_mark'),
      drill_max_attempts: num('drill_max_attempts'),
      drill_lockout_minutes: num('drill_lockout_minutes'),
      ai_input_usd_per_million: num('ai_input_usd_per_million'),
      ai_output_usd_per_million: num('ai_output_usd_per_million'),
      speed_thresholds: Object.values(bands).every((value) => typeof value === 'number' && Number.isFinite(value)) ? bands : undefined,
    },
  });
  if (error) redirect(`/workspace/academy/practice?error=${encodeURIComponent(readable(error))}`);
  revalidatePath('/workspace/academy/practice');
}

export async function saveCalibration(formData: FormData) {
  const supabase = await adminClient();
  if (!supabase) redirect('/workspace/login');
  const sessionId = String(formData.get('session') ?? '');
  const count = Number(formData.get('count') ?? 0);
  const scores = [];
  for (let index = 0; index < count; index += 1) {
    const key = String(formData.get(`key_${index}`) ?? '');
    const score = String(formData.get(`score_${index}`) ?? '');
    if (!key || score === '') continue;
    scores.push({ key, score: Number(score), note: String(formData.get(`note_${index}`) ?? '') });
  }
  const { error } = await controlRpc(supabase, 'academy_calibration_save', { p_session: sessionId, p_scores: scores });
  if (error) redirect(`/workspace/academy/calibration?session=${sessionId}&error=${encodeURIComponent(readable(error))}`);
  revalidatePath('/workspace/academy/calibration');
}

export async function overrideScore(formData: FormData) {
  const session = await academyHoldSession();
  if (!session) redirect('/workspace/login');
  const supabase = await createClient();
  const back = String(formData.get('back') ?? '/workspace/academy/holds/grading');
  const reflection = String(formData.get('reflection') ?? '');
  const simulation = String(formData.get('session') ?? '');
  const { error } = reflection
    ? await controlRpc(supabase, 'academy_reflection_override', {
        p_attempt: reflection,
        p_key: String(formData.get('key') ?? ''),
        p_score: Number(formData.get('score')),
        p_note: String(formData.get('note') ?? ''),
      })
    : await controlRpc(supabase, 'academy_grade_override', {
        p_session: simulation,
        p_key: String(formData.get('key') ?? ''),
        p_score: Number(formData.get('score')),
        p_note: String(formData.get('note') ?? ''),
      });
  if (error) redirect(`${back}${back.includes('?') ? '&' : '?'}error=${encodeURIComponent(readable(error))}`);
  revalidatePath(back.split('?')[0]);
}

export async function reviewPracticalItem(formData: FormData) {
  const session = await academyHoldSession();
  if (!session) redirect('/workspace/login');
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, 'academy_practical_review', {
    p_evidence: String(formData.get('evidence') ?? ''),
    p_status: String(formData.get('status') ?? ''),
    p_comment: String(formData.get('comment') ?? ''),
  });
  if (error) redirect(`/workspace/academy/holds/practicals?error=${encodeURIComponent(readable(error))}`);
  revalidatePath('/workspace/academy/holds/practicals');
}

function safeName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? 'file';
  return base.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 80);
}

export async function submitPractical(moduleId: string, practicalId: string, formData: FormData) {
  const supabase = await createClient();
  const back = `/academy/modules/${moduleId}/practical`;
  const ids = formData.getAll('item').map(String);
  const service = serviceClient();
  const items: { item_id: string; kind: string; body?: string; storage_path?: string }[] = [];
  for (const id of ids) {
    const kind = String(formData.get(`kind-${id}`) ?? 'text');
    if (kind === 'file') {
      const file = formData.get(`file-${id}`);
      if (!(file instanceof File) || file.size === 0) {
        redirect(`${back}?error=${encodeURIComponent('Add a screenshot for each file item.')}`);
      }
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (!['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
        redirect(`${back}?error=${encodeURIComponent('Upload a PNG, JPG, or WebP screenshot.')}`);
      }
      if (!service) redirect(`${back}?error=${encodeURIComponent('Storage is not configured.')}`);
      const path = `practical/${practicalId}/${id}/${Date.now()}-${safeName(file.name)}`;
      const uploaded = await service.storage.from('academy-documents').upload(path, await file.arrayBuffer(), {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });
      if (uploaded.error) redirect(`${back}?error=${encodeURIComponent('The screenshot could not be stored.')}`);
      items.push({ item_id: id, kind: 'file', storage_path: path });
    } else {
      items.push({ item_id: id, kind: kind === 'link' ? 'link' : 'text', body: String(formData.get(`body-${id}`) ?? '') });
    }
  }
  const { error } = await controlRpc(supabase, 'academy_practical_submit', { p_practical: practicalId, p_items: items });
  if (error) redirect(`${back}?error=${encodeURIComponent(readable(error))}`);
  revalidatePath(back);
}
