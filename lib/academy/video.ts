export type VideoRef = {
  provider: 'vimeo' | 'mux';
  id: string;
  url: string;
};

const VIMEO_ID = /^[0-9]{6,12}$/;
const MUX_ID = /^[A-Za-z0-9]{8,128}$/;
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov', 'm4v']);

export const VIDEO_MAX_BYTES = 100 * 1024 * 1024;

export function videoFileError(name: string, size: number): string | null {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (!VIDEO_EXTENSIONS.has(ext)) return 'Upload an mp4, webm, mov, or m4v file.';
  if (!Number.isFinite(size) || size <= 0) return 'That video file is empty.';
  if (size > VIDEO_MAX_BYTES) return 'That video is over 100 MB. Use a Vimeo or Mux link for a larger file.';
  return null;
}

export function videoContentType(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'mp4' || ext === 'm4v') return 'video/mp4';
  if (ext === 'webm') return 'video/webm';
  if (ext === 'mov') return 'video/quicktime';
  return 'application/octet-stream';
}

/** Private object name for an uploaded lesson video. The lesson id is part of the path. */
export function lessonVideoPath(lessonCode: string, fileName: string, now = Date.now()): string | null {
  const code = lessonCode.trim().toUpperCase();
  if (!/^M\d{2}-L\d{2}$/.test(code)) return null;
  const base = (fileName.split(/[/\\]/).pop() ?? 'video').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^\.+/, '').slice(0, 120);
  const stamp = String(now);
  if (!base || !/^\d{10,16}$/.test(stamp)) return null;
  return `${code}/video/${stamp}/${base}`;
}

export function isLessonVideoPath(path: string, lessonCode: string): boolean {
  const code = lessonCode.trim().toUpperCase();
  if (!/^M\d{2}-L\d{2}$/.test(code) || path.includes('..')) return false;
  return new RegExp(`^${code}/video/\\d{10,16}/[A-Za-z0-9._-]{1,120}$`).test(path);
}

/** Accept a Vimeo or Mux link or id. Other hosts are refused. */
export function parseVideoRef(input: string): VideoRef | null {
  const value = input.trim();
  if (!value) return null;

  const vimeo = value.match(/vimeo\.com\/(?:video\/)?(\d{6,12})(?:$|[/?#])/i);
  if (vimeo) {
    const url = /^https?:\/\//i.test(value) ? value : `https://vimeo.com/${vimeo[1]}`;
    return { provider: 'vimeo', id: vimeo[1], url };
  }
  if (VIMEO_ID.test(value)) return { provider: 'vimeo', id: value, url: `https://vimeo.com/${value}` };

  const mux = value.match(/stream\.mux\.com\/([A-Za-z0-9]{8,128})(?:\.m3u8)?(?:$|[/?#])/i);
  if (mux) return { provider: 'mux', id: mux[1], url: `https://stream.mux.com/${mux[1]}.m3u8` };
  const muxPlayer = value.match(/player\.mux\.com\/([A-Za-z0-9]{8,128})(?:$|[/?#])/i);
  if (muxPlayer) return { provider: 'mux', id: muxPlayer[1], url: `https://stream.mux.com/${muxPlayer[1]}.m3u8` };
  if (MUX_ID.test(value) && !VIMEO_ID.test(value)) return { provider: 'mux', id: value, url: `https://stream.mux.com/${value}.m3u8` };

  return null;
}

/** Unlisted Vimeo links hide a second code. The player will not start without it. */
export function vimeoPrivacyHash(pageUrl: string | null | undefined): string | null {
  if (!pageUrl) return null;
  try {
    const parsed = new URL(pageUrl);
    const query = parsed.searchParams.get('h');
    if (query && /^[A-Za-z0-9]+$/.test(query)) return query;
    const parts = parsed.pathname.split('/').filter(Boolean);
    const idIndex = parts.findIndex((part) => /^\d{6,12}$/.test(part));
    const next = idIndex >= 0 ? parts[idIndex + 1] : undefined;
    if (next && /^[A-Za-z0-9]+$/.test(next)) return next;
  } catch {
    return null;
  }
  return null;
}

export function vimeoEmbedSrc(id: string, pageUrl?: string | null): string {
  const params = new URLSearchParams({ dnt: '1' });
  const hash = vimeoPrivacyHash(pageUrl);
  if (hash) params.set('h', hash);
  return `https://player.vimeo.com/video/${id}?${params.toString()}`;
}

export type VideoCheck = { ok: true; duration: number | null } | { ok: false; reason: string };

/** Confirm the host knows this video. Domain lock is configured on the host, not here. */
export async function videoResolves(ref: VideoRef, fetchImpl: typeof fetch = fetch): Promise<VideoCheck> {
  try {
    if (ref.provider === 'vimeo') {
      const response = await fetchImpl(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(ref.url)}`);
      if (!response.ok) return { ok: false, reason: 'That Vimeo link does not resolve.' };
      const body = (await response.json()) as { duration?: number };
      return { ok: true, duration: typeof body.duration === 'number' ? body.duration : null };
    }
    const response = await fetchImpl(ref.url, { method: 'HEAD' });
    if (response.status === 404) return { ok: false, reason: 'That Mux playback id does not resolve.' };
    if (response.ok || response.status === 401 || response.status === 403) return { ok: true, duration: null };
    return { ok: false, reason: 'That Mux playback id does not resolve.' };
  } catch {
    return { ok: false, reason: 'The video host did not respond.' };
  }
}
