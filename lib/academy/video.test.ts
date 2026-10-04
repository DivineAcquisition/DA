import { describe, expect, it } from 'vitest';
import { parseVideoRef, videoResolves } from './video';

describe('academy video refs', () => {
  it('reads Vimeo and Mux links and refuses other hosts', () => {
    expect(parseVideoRef('https://vimeo.com/123456789')?.provider).toBe('vimeo');
    expect(parseVideoRef('https://player.vimeo.com/video/123456789')?.id).toBe('123456789');
    expect(parseVideoRef('https://stream.mux.com/AbCdEfGh12345678.m3u8')?.provider).toBe('mux');
    expect(parseVideoRef('https://www.youtube.com/watch?v=dQw4w9wgxcq')).toBeNull();
    expect(parseVideoRef('https://www.loom.com/share/abc')).toBeNull();
  });

  it('flags a video the host does not know', async () => {
    const ref = parseVideoRef('https://vimeo.com/123456789');
    const missing = await videoResolves(ref!, async () => new Response('no', { status: 404 }));
    expect(missing.ok).toBe(false);
    const found = await videoResolves(ref!, async () => Response.json({ duration: 95 }));
    expect(found).toEqual({ ok: true, duration: 95 });
  });
});
