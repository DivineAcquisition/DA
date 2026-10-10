'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { controlRpc, readable } from '@/lib/ad/rpc';
import { academyAdminSession } from '@/lib/academy/access';
import { formId } from '@/lib/academy/form';
import { gradeWithModel, leadReply } from '@/lib/academy/ai';
import { createClient } from '@/lib/supabase/server';
import { serviceClient } from '@/lib/workspace/db';

function pathFor(moduleId: string, simId: string) {
  return `/academy/modules/${moduleId}/simulations/${simId}`;
}

function previewPath(simId: string, sessionId: string) {
  return `/workspace/academy/simulations/${simId}/preview?session=${sessionId}`;
}

type Service = NonNullable<ReturnType<typeof serviceClient>>;

async function recordAi(
  service: Service,
  sessionId: string | null,
  reflectionId: string | null,
  kind: string,
  usage: { tokensIn: number; tokensOut: number },
  ok: boolean,
) {
  await service.rpc('academy_ai_record', {
    p_session: sessionId,
    p_reflection: reflectionId,
    p_kind: kind,
    p_tokens_in: usage.tokensIn,
    p_tokens_out: usage.tokensOut,
    p_ok: ok,
  });
}

export async function beginSimulation(moduleId: string, simId: string) {
  const supabase = await createClient();
  const started = await controlRpc<string>(supabase, 'academy_sim_begin', { p_simulation: simId, p_preview: false });
  if (started.error || !started.data) redirect(`${pathFor(moduleId, simId)}?error=${encodeURIComponent(started.error ? readable(started.error) : 'The simulation did not start.')}`);
  const service = serviceClient();
  if (!service) redirect(`${pathFor(moduleId, simId)}?error=${encodeURIComponent('The AI lead is not configured.')}`);
  const { data: sim } = await service.from('academy_simulation').select('persona, offer_pack_id').eq('id', simId).maybeSingle();
  const offer = await offerText(service, sim?.offer_pack_id as string | null);
  const reply = await leadReply({ persona: String(sim?.persona ?? ''), offer, transcript: [] });
  if (reply.called) await recordAi(service, started.data, null, 'lead', reply.usage, Boolean(reply.message));
  if (!reply.message) {
    await service.from('academy_sim_session').delete().eq('id', started.data);
    redirect(`${pathFor(moduleId, simId)}?error=${encodeURIComponent('The lead did not respond. Try again.')}`);
  }
  await service.rpc('academy_sim_post_lead', { p_session: started.data, p_body: reply.message, p_end: reply.end });
  revalidatePath(pathFor(moduleId, simId));
}

async function offerText(service: NonNullable<ReturnType<typeof serviceClient>>, packId: string | null) {
  if (!packId) return '';
  const { data } = await service.from('academy_offer').select('title, body').eq('pack_id', packId).order('sort_order');
  return (data ?? []).map((row: { title: string; body: string }) => `${row.title}\n${row.body}`).join('\n\n');
}

export async function sendSimulationTurn(moduleId: string, simId: string, formData: FormData) {
  const sessionId = String(formData.get('session') ?? '');
  const text = String(formData.get('body') ?? '');
  const preview = formData.get('preview') === '1';
  const back = preview ? previewPath(simId, sessionId) : pathFor(moduleId, simId);
  const supabase = await createClient();
  const posted = await controlRpc<{ continue?: boolean }>(supabase, 'academy_sim_post_operator', { p_session: sessionId, p_body: text });
  if (posted.error) redirect(`${back}${back.includes('?') ? '&' : '?'}error=${encodeURIComponent(readable(posted.error))}`);
  if (!posted.data?.continue) {
    revalidatePath(back.split('?')[0]);
    return;
  }
  const service = serviceClient();
  if (!service) redirect(`${back}${back.includes('?') ? '&' : '?'}error=${encodeURIComponent('The AI lead is not configured.')}`);
  const { data: messages } = await service.from('academy_sim_message').select('role, body').eq('session_id', sessionId).order('created_at');
  const { data: session } = await service.from('academy_sim_session').select('simulation_id').eq('id', sessionId).maybeSingle();
  const { data: sim } = await service.from('academy_simulation').select('persona, offer_pack_id').eq('id', session?.simulation_id).maybeSingle();
  const reply = await leadReply({
    persona: String(sim?.persona ?? ''),
    offer: await offerText(service, sim?.offer_pack_id as string | null),
    transcript: (messages ?? []) as { role: string; body: string }[],
  });
  if (reply.called) await recordAi(service, sessionId, null, 'lead', reply.usage, Boolean(reply.message));
  if (!reply.message) redirect(`${back}${back.includes('?') ? '&' : '?'}error=${encodeURIComponent('The lead did not respond. Try again.')}`);
  await service.rpc('academy_sim_post_lead', { p_session: sessionId, p_body: reply.message, p_end: reply.end });
  revalidatePath(back.split('?')[0]);
}

export async function submitSimulationLog(moduleId: string, simId: string, formData: FormData) {
  const supabase = await createClient();
  const sessionId = String(formData.get('session') ?? '');
  const submitted = await controlRpc(supabase, 'academy_sim_submit', {
    p_session: sessionId,
    p_outcome: String(formData.get('outcome') ?? ''),
    p_learned: String(formData.get('learned') ?? ''),
    p_next: String(formData.get('next') ?? ''),
    p_notes: String(formData.get('notes') ?? ''),
  });
  const preview = formData.get('preview') === '1';
  const back = preview ? previewPath(simId, sessionId) : pathFor(moduleId, simId);
  if (submitted.error) redirect(`${back}${back.includes('?') ? '&' : '?'}error=${encodeURIComponent(readable(submitted.error))}`);
  if (preview) {
    revalidatePath(`/workspace/academy/simulations/${simId}/preview`);
    return;
  }
  const service = serviceClient();
  if (!service) redirect(`${pathFor(moduleId, simId)}?error=${encodeURIComponent('Grading is not configured.')}`);
  const graded = await gradeSession(service, sessionId);
  if (!graded) await service.rpc('academy_grade_manual', { p_session: sessionId });
  revalidatePath(pathFor(moduleId, simId));
}

async function gradeSession(service: NonNullable<ReturnType<typeof serviceClient>>, sessionId: string) {
  const { data: session } = await service.from('academy_sim_session').select('rubric_id, offer_pack_id, log_outcome, log_learned, log_next, log_notes').eq('id', sessionId).maybeSingle();
  const { data: messages } = await service.from('academy_sim_message').select('role, body, created_at').eq('session_id', sessionId).order('created_at');
  const { data: criteria } = await service.from('academy_rubric_criterion').select('criterion_key, name, description, score_0, score_3, score_5').eq('rubric_id', session?.rubric_id);
  const offer = await offerText(service, session?.offer_pack_id as string | null);
  const result = await gradeWithModel({
    transcript: (messages ?? []).map((row: { role: string; body: string; created_at: string }) => ({ role: row.role, body: row.body, at: row.created_at })),
    log: {
      outcome: String(session?.log_outcome ?? ''),
      learned: String(session?.log_learned ?? ''),
      next: String(session?.log_next ?? ''),
      notes: String(session?.log_notes ?? ''),
    },
    rubric: (criteria ?? []).map((row: { criterion_key: string; name: string; description: string; score_0: string; score_3: string; score_5: string }) => ({
      key: row.criterion_key,
      name: row.name,
      description: row.description,
      score0: row.score_0,
      score3: row.score_3,
      score5: row.score_5,
    })),
    offer,
  });
  if (result.called && !result.grade) {
    await recordAi(service, sessionId, null, 'grade', result.usage, false);
    return false;
  }
  if (!result.grade) return false;
  const { error } = await service.rpc('academy_grade_apply', {
    p_session: sessionId,
    p_payload: result.grade,
    p_tokens_in: result.usage.tokensIn,
    p_tokens_out: result.usage.tokensOut,
    p_kind: 'grade',
  });
  if (error) await recordAi(service, sessionId, null, 'grade', result.usage, false);
  return !error;
}

export async function beginPreview(simId: string) {
  const session = await academyAdminSession();
  if (!session) redirect('/workspace/login');
  const supabase = await createClient();
  const started = await controlRpc<string>(supabase, 'academy_sim_begin', { p_simulation: simId, p_preview: true });
  if (started.error || !started.data) redirect(`/workspace/academy/simulations?error=${encodeURIComponent(started.error ? readable(started.error) : 'The preview did not start.')}`);
  const service = serviceClient();
  if (!service) redirect(`/workspace/academy/simulations?error=${encodeURIComponent('The AI lead is not configured.')}`);
  const { data: sim } = await service.from('academy_simulation').select('persona, offer_pack_id').eq('id', simId).maybeSingle();
  const reply = await leadReply({ persona: String(sim?.persona ?? ''), offer: await offerText(service, sim?.offer_pack_id as string | null), transcript: [] });
  if (reply.called) await recordAi(service, started.data, null, 'lead', reply.usage, Boolean(reply.message));
  if (!reply.message) {
    await service.from('academy_sim_session').delete().eq('id', started.data);
    redirect(`/workspace/academy/simulations?error=${encodeURIComponent('The lead did not respond. Try again.')}`);
  }
  await service.rpc('academy_sim_post_lead', { p_session: started.data, p_body: reply.message, p_end: reply.end });
  redirect(previewPath(simId, started.data));
}

export async function gradeReflectionAttempt(attemptId: string) {
  const service = serviceClient();
  if (!service || !attemptId) return false;
  const { data: attempt } = await service.from('academy_reflection_attempt').select('body, reflection_id, created_at').eq('id', attemptId).maybeSingle();
  const { data: reflection } = await service.from('academy_reflection').select('rubric_id').eq('id', attempt?.reflection_id).maybeSingle();
  const { data: criteria } = await service.from('academy_rubric_criterion').select('criterion_key, name, description, score_0, score_3, score_5').eq('rubric_id', reflection?.rubric_id);
  const result = await gradeWithModel({
    task: 'reflection',
    transcript: [{ role: 'operator', body: String(attempt?.body ?? ''), at: String(attempt?.created_at ?? '') }],
    log: { outcome: '', learned: '', next: '', notes: '' },
    rubric: (criteria ?? []).map((row: { criterion_key: string; name: string; description: string; score_0: string; score_3: string; score_5: string }) => ({
      key: row.criterion_key,
      name: row.name,
      description: row.description,
      score0: row.score_0,
      score3: row.score_3,
      score5: row.score_5,
    })),
    offer: '',
  });
  if (!result.grade) {
    if (result.called) await recordAi(service, null, attemptId, 'reflection', result.usage, false);
    return false;
  }
  const { error } = await service.rpc('academy_reflection_grade', {
    p_attempt: attemptId,
    p_payload: result.grade,
    p_tokens_in: result.usage.tokensIn,
    p_tokens_out: result.usage.tokensOut,
  });
  if (error) await recordAi(service, null, attemptId, 'reflection', result.usage, false);
  return !error;
}

export async function saveOfferPack(formData: FormData) {
  const session = await academyAdminSession();
  if (!session) redirect('/workspace/login');
  const supabase = await createClient();
  const offers = String(formData.get('body') ?? '')
    .split('\n---\n')
    .map((block) => {
      const [title, ...rest] = block.trim().split('\n');
      return { title: title?.trim() ?? '', body: rest.join('\n').trim() };
    })
    .filter((offer) => offer.title && offer.body);
  const { error } = await controlRpc(supabase, 'academy_offer_save', {
    p_payload: { name: String(formData.get('name') ?? 'Offer Pack'), offers },
  });
  if (error) redirect(`/workspace/academy/offers?error=${encodeURIComponent(readable(error))}`);
  revalidatePath('/workspace/academy/offers');
}

export async function saveSimulation(formData: FormData) {
  const session = await academyAdminSession();
  if (!session) redirect('/workspace/login');
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, 'academy_sim_save', {
    p_payload: {
      id: formId(formData.get('id')),
      title: String(formData.get('title') ?? ''),
      vertical: String(formData.get('vertical') ?? 'general'),
      module_id: String(formData.get('module_id') ?? ''),
      gate_part_id: String(formData.get('gate_part_id') ?? '') || null,
      brief: String(formData.get('brief') ?? ''),
      persona: String(formData.get('persona') ?? ''),
      difficulty: String(formData.get('difficulty') ?? 'standard'),
      offer_pack_id: String(formData.get('offer_pack_id') ?? '') || null,
      rubric_id: String(formData.get('rubric_id') ?? '') || null,
      max_turns: Number(formData.get('max_turns') ?? 12),
      pass_score: String(formData.get('pass_score') ?? '') || null,
      capstone: formData.get('capstone') === 'on',
      status: String(formData.get('status') ?? 'draft'),
    },
  });
  if (error) redirect(`/workspace/academy/simulations?error=${encodeURIComponent(readable(error))}`);
  revalidatePath('/workspace/academy/simulations');
}
