'use server';

import { controlRpc, readable } from '@/lib/ad/rpc';
import { createClient } from '@/lib/supabase/server';

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

export async function openDocument(lessonId: string): Promise<{ ok: true; href: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await controlRpc<{ token?: string }>(supabase, 'academy_open_document', { p_lesson_id: lessonId });
  if (error || !data?.token) return { ok: false, error: error ? readable(error) : 'This lesson has no document.' };
  return { ok: true, href: `/academy/documents/${data.token}` };
}
