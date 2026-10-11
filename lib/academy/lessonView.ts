export type LessonVideo = {
  provider: 'vimeo' | 'mux' | 'file';
  id: string;
  duration: number | null;
  url: string | null;
};

export type LessonView = {
  id: string;
  code: string;
  title: string;
  body: string;
  position: number;
  total: number;
  moduleId: string;
  moduleTitle: string;
  moduleOrder: number;
  watchPercent: number;
  readingSeconds: number;
  video: LessonVideo | null;
  hasDocument: boolean;
  documentName: string | null;
  positionSeconds: number;
  watchedSeconds: number;
  readingDone: number;
  scrolled: boolean;
  documentOpened: boolean;
  missing: string[];
  complete: boolean;
  prevId: string | null;
  nextId: string | null;
  nextOpen: boolean;
  preview: boolean;
};

type RawLesson = {
  id?: string;
  code?: string;
  title?: string;
  body?: string;
  position?: number;
  total?: number;
  module_id?: string;
  module_title?: string;
  module_order?: number;
  watch_percent?: number;
  reading_seconds?: number;
  video?: { provider?: string; provider_id?: string; duration?: number | null; url?: string | null } | null;
  document?: boolean;
  document_name?: string | null;
  position_seconds?: number;
  watched_seconds?: number;
  reading_done?: number;
  scrolled?: boolean;
  document_opened?: boolean;
  missing?: string[];
  complete?: boolean;
  prev_id?: string | null;
  next_id?: string | null;
  next_open?: boolean;
};

export function lessonVideo(raw: RawLesson['video']): LessonVideo | null {
  const provider = raw?.provider === 'vimeo' || raw?.provider === 'mux' || raw?.provider === 'file' ? raw.provider : null;
  if (!provider) return null;
  const id = raw?.provider_id ?? '';
  if (provider !== 'file' && !id) return null;
  return { provider, id, duration: raw?.duration ?? null, url: raw?.url ?? null };
}

export function lessonView(raw: RawLesson, preview = false): LessonView | null {
  if (!raw.id || !raw.code || !raw.title || !raw.module_id) return null;
  return {
    id: raw.id,
    code: raw.code,
    title: raw.title,
    body: raw.body ?? '',
    position: raw.position ?? 1,
    total: raw.total ?? 1,
    moduleId: raw.module_id,
    moduleTitle: raw.module_title ?? '',
    moduleOrder: raw.module_order ?? 0,
    watchPercent: raw.watch_percent ?? 90,
    readingSeconds: raw.reading_seconds ?? 0,
    video: lessonVideo(raw.video),
    hasDocument: Boolean(raw.document),
    documentName: raw.document_name ?? null,
    positionSeconds: Number(raw.position_seconds ?? 0),
    watchedSeconds: raw.watched_seconds ?? 0,
    readingDone: raw.reading_done ?? 0,
    scrolled: Boolean(raw.scrolled),
    documentOpened: Boolean(raw.document_opened),
    missing: Array.isArray(raw.missing) ? raw.missing : [],
    complete: Boolean(raw.complete),
    prevId: raw.prev_id ?? null,
    nextId: raw.next_id ?? null,
    nextOpen: Boolean(raw.next_open),
    preview,
  };
}
