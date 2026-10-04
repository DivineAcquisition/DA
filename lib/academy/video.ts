export type VideoRef = {
  provider: 'vimeo' | 'mux';
  id: string;
  url: string;
};

const VIMEO_ID = /^[0-9]{6,12}$/;
const MUX_ID = /^[A-Za-z0-9]{8,128}$/;

/** Accept a Vimeo or Mux link or id. Other hosts are refused. */
export function parseVideoRef(input: string): VideoRef | null {
  const value = input.trim();
  if (!value) return null;

  const vimeo = value.match(/vimeo\.com\/(?:video\/)?(\d{6,12})(?:$|[/?#])/i);
  if (vimeo) return { provider: 'vimeo', id: vimeo[1], url: `https://vimeo.com/${vimeo[1]}` };
  if (VIMEO_ID.test(value)) return { provider: 'vimeo', id: value, url: `https://vimeo.com/${value}` };

  const mux = value.match(/stream\.mux\.com\/([A-Za-z0-9]{8,128})(?:\.m3u8)?(?:$|[/?#])/i);
  if (mux) return { provider: 'mux', id: mux[1], url: `https://stream.mux.com/${mux[1]}.m3u8` };
  const muxPlayer = value.match(/player\.mux\.com\/([A-Za-z0-9]{8,128})(?:$|[/?#])/i);
  if (muxPlayer) return { provider: 'mux', id: muxPlayer[1], url: `https://stream.mux.com/${muxPlayer[1]}.m3u8` };
  if (MUX_ID.test(value) && !VIMEO_ID.test(value)) return { provider: 'mux', id: value, url: `https://stream.mux.com/${value}.m3u8` };

  return null;
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
