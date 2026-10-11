import { describe, expect, it } from 'vitest';
import { isLessonVideoPath, lessonVideoPath, parseVideoRef, videoFileError, videoResolves, vimeoEmbedSrc } from './video';

describe('academy video refs', () => {
  it('reads Vimeo and Mux links and refuses other hosts', () => {
    expect(parseVideoRef('https://vimeo.com/123456789')?.provider).toBe('vimeo');
    expect(parseVideoRef('https://player.vimeo.com/video/123456789')?.id).toBe('123456789');
    expect(parseVideoRef('https://stream.mux.com/AbCdEfGh12345678.m3u8')?.provider).toBe('mux');
    expect(parseVideoRef('https://www.youtube.com/watch?v=dQw4w9wgxcq')).toBeNull();
    expect(parseVideoRef('https://www.loom.com/share/abc')).toBeNull();
  });

  it('keeps a Vimeo privacy code so an unlisted video can play', () => {
    const ref = parseVideoRef('https://vimeo.com/123456789/Ab12Cd');
    expect(ref?.id).toBe('123456789');
    expect(vimeoEmbedSrc(ref!.id, ref!.url)).toContain('h=Ab12Cd');
    const query = parseVideoRef('https://vimeo.com/123456789?h=Zz99');
    expect(vimeoEmbedSrc(query!.id, query!.url)).toContain('h=Zz99');
  });

  it('accepts a lesson video file and refuses other files and paths', () => {
    expect(videoFileError('talk.mp4', 1024)).toBeNull();
    expect(videoFileError('notes.pdf', 1024)).toMatch(/mp4/);
    expect(videoFileError('talk.mp4', 101 * 1024 * 1024)).toMatch(/100 MB/);
    const path = lessonVideoPath('m07-l03', 'My Talk.mp4', 1710000000000);
    expect(path).toBe('M07-L03/video/1710000000000/My_Talk.mp4');
    expect(isLessonVideoPath(path!, 'M07-L03')).toBe(true);
    expect(isLessonVideoPath('M07-L03/video/1710000000000/../secret.mp4', 'M07-L03')).toBe(false);
    expect(isLessonVideoPath(path!, 'M07-L04')).toBe(false);
    expect(lessonVideoPath('lesson', 'talk.mp4', 1710000000000)).toBeNull();
  });

  it('flags a video the host does not know', async () => {
    const ref = parseVideoRef('https://vimeo.com/123456789');
    const missing = await videoResolves(ref!, async () => new Response('no', { status: 404 }));
    expect(missing.ok).toBe(false);
    const found = await videoResolves(ref!, async () => Response.json({ duration: 95 }));
    expect(found).toEqual({ ok: true, duration: 95 });
  });
});
