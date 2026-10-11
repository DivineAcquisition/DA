'use server';

import { controlRpc, readable } from '@/lib/ad/rpc';
import { VIDEO_STORAGE_ERROR, videoStorage } from '@/lib/academy/storage';
import { createClient, SUPABASE_URL } from '@/lib/supabase/server';

export type LessonProgress = {
  missing: string[];
  complete: boolean;
  watchedSeconds?: number;
  readingSeconds?: number;
};

function progress(data: { missing?: string[]; complete?: boolean; watched_seconds?: number; reading_seconds?: number } | null): LessonProgress {
  return {
    missing: data?.missing ?? [],
    complete: Boolean(data?.complete),
    watchedSeconds: data?.watched_seconds,
    readingSeconds: data?.reading_seconds,
  };
}

export async function recordPlayback(lessonId: string, position: number): Promise<LessonProgress> {
  const supabase = await createClient();
  const { data, error } = await controlRpc<LessonProgress & { watched_seconds?: number; missing?: string[]; complete?: boolean }>(
    supabase,
    'academy_record_playback',
    { p_lesson_id: lessonId, p_position: position },
  );
  if (error) return { missing: [readable(error)], complete: false };
  return progress(data);
}

export async function recordReading(lessonId: string, seconds: number, scrolled: boolean): Promise<LessonProgress> {
  const supabase = await createClient();
  const { data, error } = await controlRpc<LessonProgress & { reading_seconds?: number; missing?: string[]; complete?: boolean }>(
    supabase,
    'academy_record_reading',
    { p_lesson_id: lessonId, p_seconds: seconds, p_scrolled: scrolled },
  );
  if (error) return { missing: [readable(error)], complete: false };
  return progress(data);
}

export async function markLessonComplete(lessonId: string): Promise<LessonProgress & { ok: boolean }> {
  const supabase = await createClient();
  const { data, error } = await controlRpc<{ ok?: boolean; missing?: string[] }>(supabase, 'academy_mark_lesson_complete', {
    p_lesson_id: lessonId,
  });
  if (error) return { ok: false, missing: [readable(error)], complete: false };
  return { ok: Boolean(data?.ok), missing: data?.missing ?? [], complete: Boolean(data?.ok) };
}

function absoluteStorageUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  const base = SUPABASE_URL.replace(/\/$/, '');
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}

export async function openLessonVideo(lessonId: string): Promise<{ ok: true; href: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await controlRpc<string>(supabase, 'academy_lesson_video_file', { p_lesson_id: lessonId });
  if (error) return { ok: false, error: readable(error) };
  if (!data) return { ok: false, error: 'This video is not available.' };
  const service = videoStorage();
  if (!service) return { ok: false, error: VIDEO_STORAGE_ERROR };
  const signed = await service.storage.from('academy-documents').createSignedUrl(data, 60 * 60 * 4);
  if (signed.error || !signed.data?.signedUrl) return { ok: false, error: 'The video could not be opened.' };
  return { ok: true, href: absoluteStorageUrl(signed.data.signedUrl) };
}

export async function openDocument(lessonId: string): Promise<{ ok: true; href: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await controlRpc<{ token?: string }>(supabase, 'academy_open_document', { p_lesson_id: lessonId });
  if (error || !data?.token) return { ok: false, error: error ? readable(error) : 'This lesson has no document.' };
  return { ok: true, href: `/academy/documents/${data.token}` };
}
