'use server';

import { revalidatePath } from 'next/cache';
import { controlRpc, readable } from '@/lib/ad/rpc';
import { academyAdminSession } from '@/lib/academy/access';
import { formId } from '@/lib/academy/form';
import { importedLessonBody, planManifest, type ManifestPlan, type ManifestRow } from '@/lib/academy/manifest';
import { parseVideoRef, videoResolves } from '@/lib/academy/video';
import { workspaceClient, serviceClient } from '@/lib/workspace/db';

const DOCUMENTS = new Set(['pdf', 'doc', 'docx', 'ppt', 'pptx', 'txt', 'md', 'rtf']);

function safeName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? 'file';
  return base.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 120);
}

async function catalogClient() {
  const session = await academyAdminSession();
  if (!session) return null;
  const client = await workspaceClient();
  if (!client) return null;
  return { session, client };
}

export async function saveAcademySettings(formData: FormData): Promise<void> {
  const gate = await catalogClient();
  if (!gate) return;
  const { error } = await controlRpc(gate.client, 'academy_save_settings', {
    p_watch: Number(formData.get('watch')),
    p_words_per_minute: Number(formData.get('wpm')),
    p_min_seconds: Number(formData.get('minimum')),
    p_link_seconds: Number(formData.get('link')),
  });
  if (error) throw new Error(readable(error));
  revalidatePath('/workspace/academy');
}

export async function saveLesson(formData: FormData): Promise<{ ok: boolean; error?: string; id?: string }> {
  const gate = await catalogClient();
  if (!gate) return { ok: false, error: 'Academy admin access is required.' };
  const videoLink = String(formData.get('video') ?? '').trim();
  let video: Record<string, unknown> | null = null;
  if (videoLink) {
    const ref = parseVideoRef(videoLink);
    if (!ref) return { ok: false, error: 'Use a Vimeo or Mux link. Other hosts are not accepted.' };
    const check = await videoResolves(ref);
    if (!check.ok) return { ok: false, error: check.reason };
    const typed = Number(formData.get('duration') ?? '');
    video = {
      provider: ref.provider,
      provider_id: ref.id,
      url: ref.url,
      duration_seconds: Number.isFinite(typed) && typed > 0 ? typed : check.duration,
    };
  }
  let document: Record<string, string> | null = null;
  const file = formData.get('document');
  if (file instanceof File && file.size > 0) {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!DOCUMENTS.has(ext)) return { ok: false, error: 'Upload a PDF or a common document file.' };
    const code = String(formData.get('lesson_code') ?? 'lesson').toUpperCase();
    const path = `${code}/${Date.now()}/${safeName(file.name)}`;
    const service = serviceClient();
    if (!service) return { ok: false, error: 'Storage is not configured.' };
    const uploaded = await service.storage.from('academy-documents').upload(path, await file.arrayBuffer(), {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
    if (uploaded.error) return { ok: false, error: 'The document could not be stored.' };
    document = { storage_path: path, file_name: safeName(file.name) };
  }
  const payload: Record<string, unknown> = {
    id: formId(formData.get('id')),
    module_id: String(formData.get('module_id') ?? ''),
    lesson_code: String(formData.get('lesson_code') ?? ''),
    title: String(formData.get('title') ?? ''),
    sort_order: Number(formData.get('sort_order') ?? 1),
    body: String(formData.get('body') ?? ''),
    required_watch_percent: Number(formData.get('watch') ?? 90),
    status: String(formData.get('status') ?? 'draft'),
    completion_policy: String(formData.get('completion_policy') ?? '') || null,
    clear_video: formData.get('clear_video') === 'on' ? 'true' : 'false',
  };
  if (video) payload.video = video;
  if (document) payload.document = document;
  const { data, error } = await controlRpc<{ id?: string }>(gate.client, 'academy_save_lesson', { p_payload: payload });
  if (error) return { ok: false, error: readable(error) };
  revalidatePath('/workspace/academy');
  return { ok: true, id: data?.id };
}

export async function archiveLesson(formData: FormData): Promise<void> {
  const gate = await catalogClient();
  if (!gate) return;
  await controlRpc(gate.client, 'academy_archive_lesson', { p_lesson_id: String(formData.get('id') ?? '') });
  revalidatePath('/workspace/academy');
}

export async function reorderLesson(formData: FormData): Promise<void> {
  const gate = await catalogClient();
  if (!gate) return;
  await controlRpc(gate.client, 'academy_reorder_lesson', {
    p_lesson_id: String(formData.get('id') ?? ''),
    p_direction: String(formData.get('direction') ?? ''),
  });
  revalidatePath('/workspace/academy');
}

export async function overrideProgress(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const gate = await catalogClient();
  if (!gate) return { ok: false, error: 'Academy admin access is required.' };
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const { data: profile } = await gate.client.from('profile').select('id').eq('email', email).maybeSingle();
  const profileId = (profile as { id?: string } | null)?.id;
  if (!profileId) return { ok: false, error: 'No account uses that email.' };
  const { data: enrollment } = await gate.client
    .from('academy_enrollment')
    .select('id')
    .eq('profile_id', profileId)
    .neq('status', 'withdrawn')
    .limit(1)
    .maybeSingle();
  const enrollmentId = (enrollment as { id?: string } | null)?.id;
  if (!enrollmentId) return { ok: false, error: 'That account has no Academy enrollment.' };
  const { error } = await controlRpc(gate.client, 'academy_override_progress', {
    p_enrollment_id: enrollmentId,
    p_lesson_id: String(formData.get('lesson_id') ?? ''),
    p_status: String(formData.get('status') ?? ''),
    p_reason: String(formData.get('reason') ?? ''),
  });
  if (error) return { ok: false, error: readable(error) };
  return { ok: true };
}

type StoredLesson = {
  id: string;
  lesson_code: string;
  title: string;
  body: string;
  module_id: string;
  video_asset_id: string | null;
  document_asset_id: string | null;
};

export async function previewImport(formData: FormData): Promise<{ ok: true; plan: ManifestPlan } | { ok: false; error: string }> {
  const built = await buildPlan(formData, false);
  if (!built.ok) return built;
  return { ok: true, plan: built.plan };
}

export async function confirmImport(
  formData: FormData,
): Promise<{ ok: true; result: { created: number; updated: number; skipped: number; detail: { lesson_id: string; action: string; message?: string }[] } } | { ok: false; error: string }> {
  const built = await buildPlan(formData, true);
  if (!built.ok) return built;
  const gate = await catalogClient();
  if (!gate) return { ok: false, error: 'Academy admin access is required.' };
  const { data, error } = await controlRpc<{
    created: number;
    updated: number;
    skipped: number;
    detail: { lesson_id: string; action: string; message?: string }[];
  }>(gate.client, 'academy_apply_import', {
    p_file_name: built.fileName,
    p_rows: built.rows,
  });
  if (error || !data) return { ok: false, error: error ? readable(error) : 'The import did not finish.' };
  revalidatePath('/workspace/academy');
  revalidatePath('/workspace/academy/import');
  return { ok: true, result: data };
}

async function buildPlan(formData: FormData, upload: boolean) {
  const gate = await catalogClient();
  if (!gate) return { ok: false as const, error: 'Academy admin access is required.' };
  const manifest = formData.get('manifest');
  if (!(manifest instanceof File)) return { ok: false as const, error: 'Choose a manifest file.' };
  const csv = await manifest.text();
  const files = formData.getAll('files').filter((item): item is File => item instanceof File && item.size > 0);
  const { data: lessons } = await gate.client
    .from('academy_lesson')
    .select('id, lesson_code, title, body, module_id, video_asset_id, document_asset_id')
    .is('archived_at', null);
  const stored = (lessons ?? []) as StoredLesson[];
  const { data: modules } = await gate.client.from('academy_module').select('id, order_number');
  const byOrder = new Map<number, string[]>();
  for (const courseModule of (modules ?? []) as { id: string; order_number: number }[]) {
    const list = byOrder.get(courseModule.order_number) ?? [];
    list.push(courseModule.id);
    byOrder.set(courseModule.order_number, list);
  }
  const { data: done } = await gate.client.from('academy_progress').select('lesson_id').eq('status', 'completed');
  const completed = new Set(((done ?? []) as { lesson_id: string }[]).map((row) => row.lesson_id));
  const plan = planManifest(csv, files.map((file) => file.name), stored.map((row) => row.lesson_code));
  const fileMap = new Map(files.map((file) => [file.name.toLowerCase(), file]));
  const rows: Record<string, unknown>[] = [];

  for (const row of [...plan.creates, ...plan.updates]) {
    const issue = await rowIssue(row, stored, byOrder, completed, fileMap);
    if (issue) {
      plan.skips.push({ line: row.line, lessonId: row.lessonId, message: issue });
      if (plan.creates.includes(row)) plan.creates = plan.creates.filter((item) => item !== row);
      else plan.updates = plan.updates.filter((item) => item !== row);
      continue;
    }
    if (!upload) continue;
    const payload = await rowPayload(row, stored, byOrder, fileMap);
    if ('error' in payload && typeof payload.error === 'string') {
      plan.skips.push({ line: row.line, lessonId: row.lessonId, message: payload.error });
      continue;
    }
    rows.push(payload);
  }
  if (!upload) return { ok: true as const, plan };
  return { ok: true as const, plan, rows, fileName: manifest.name };
}

async function rowIssue(
  row: ManifestRow,
  stored: StoredLesson[],
  byOrder: Map<number, string[]>,
  completed: Set<string>,
  files: Map<string, File>,
): Promise<string | null> {
  const moduleNumber = Number(row.lessonId.slice(1, 3));
  const modules = byOrder.get(moduleNumber) ?? [];
  if (modules.length === 0) return `${row.lessonId} does not match a module.`;
  if (modules.length > 1) return `${row.lessonId} matches more than one module.`;
  if (row.videoLink) {
    const ref = parseVideoRef(row.videoLink);
    if (!ref) return `${row.lessonId} has a video link that is not Vimeo or Mux.`;
    const check = await videoResolves(ref);
    if (!check.ok) return `${row.lessonId}: ${check.reason}`;
    if (row.status === 'live' && row.duration === null && check.duration === null) {
      return `${row.lessonId} is Live and its video has no duration.`;
    }
  }
  const existing = stored.find((item) => item.lesson_code === row.lessonId);
  const writtenFile = Boolean(row.written && files.has(row.written.toLowerCase()));
  const written = writtenFile ? '' : row.written;
  const changed =
    !existing ||
    existing.title !== row.title ||
    writtenFile ||
    existing.body !== (written || existing.body) ||
    Boolean(row.videoLink) ||
    Boolean(row.documentFile);
  if (existing && completed.has(existing.id) && changed && !row.completion) {
    return `${row.lessonId} is already complete for trainees. Set Completion to Keep or Review.`;
  }
  return null;
}

async function rowPayload(
  row: ManifestRow,
  stored: StoredLesson[],
  byOrder: Map<number, string[]>,
  files: Map<string, File>,
): Promise<Record<string, unknown> | { error: string }> {
  const moduleId = (byOrder.get(Number(row.lessonId.slice(1, 3))) ?? [])[0];
  const existing = stored.find((item) => item.lesson_code === row.lessonId);
  let fileText: string | null = null;
  const writtenFile = row.written ? files.get(row.written.toLowerCase()) : undefined;
  if (writtenFile) {
    const ext = writtenFile.name.split('.').pop()?.toLowerCase();
    if (ext !== 'txt' && ext !== 'md') return { error: `${row.lessonId} points at a written file that is not text.` };
    fileText = await writtenFile.text();
  }
  const body = importedLessonBody(row.written, existing?.body, fileText);
  let video: Record<string, unknown> | undefined;
  if (row.videoLink) {
    const ref = parseVideoRef(row.videoLink);
    if (!ref) return { error: `${row.lessonId} has a video link that is not Vimeo or Mux.` };
    const check = await videoResolves(ref);
    if (!check.ok) return { error: `${row.lessonId}: ${check.reason}` };
    video = { provider: ref.provider, provider_id: ref.id, url: ref.url, duration_seconds: row.duration ?? check.duration };
  }
  let document: Record<string, string> | undefined;
  if (row.documentFile) {
    const file = files.get(row.documentFile.toLowerCase());
    if (!file) return { error: `${row.lessonId} is missing ${row.documentFile}.` };
    const path = `${row.lessonId}/${Date.now()}/${safeName(file.name)}`;
    const service = serviceClient();
    if (!service) return { error: 'Storage is not configured.' };
    const uploaded = await service.storage.from('academy-documents').upload(path, await file.arrayBuffer(), {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
    if (uploaded.error) return { error: `${row.lessonId} could not store ${row.documentFile}.` };
    document = { storage_path: path, file_name: safeName(file.name) };
  }
  return {
    id: existing?.id ?? null,
    module_id: moduleId,
    lesson_code: row.lessonId,
    title: row.title,
    sort_order: row.order,
    body,
    required_watch_percent: row.watchPercent,
    status: row.status,
    completion_policy: row.completion,
    ...(video ? { video } : {}),
    ...(document ? { document } : {}),
  };
}
