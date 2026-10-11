'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { renderLesson } from '@/lib/academy/markdown';
import type { LessonView, LessonVideo } from '@/lib/academy/lessonView';
import { markLessonComplete, openDocument, openLessonVideo, recordPlayback, recordReading } from '@/lib/academy/lessonActions';
import { vimeoEmbedSrc } from '@/lib/academy/video';

type VimeoPlayer = {
  on: (event: string, cb: (data: { seconds?: number }) => void) => void;
  setCurrentTime: (seconds: number) => Promise<void>;
  destroy: () => void;
};

type PlaybackEvent = 'tick' | 'play' | 'pause' | 'seek';

declare global {
  interface Window {
    Vimeo?: { Player: new (frame: HTMLIFrameElement) => VimeoPlayer };
  }
}

function VimeoFrame({
  id,
  pageUrl,
  title,
  start,
  track,
  report,
}: {
  id: string;
  pageUrl: string | null;
  title: string;
  start: number;
  track: boolean;
  report?: (seconds: number, event: PlaybackEvent) => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const reportRef = useRef(report);
  useEffect(() => {
    reportRef.current = report;
  }, [report]);
  useEffect(() => {
    if (!track || !frame.current) return;
    let stopped = false;
    let player: VimeoPlayer | null = null;
    const frameEl = frame.current;
    const position = { current: start };
    const script = document.createElement('script');
    script.src = 'https://player.vimeo.com/api/player.js';
    script.async = true;
    script.onload = () => {
      if (stopped || !window.Vimeo || !frameEl) return;
      const next = new window.Vimeo.Player(frameEl);
      player = next;
      if (start > 1) void next.setCurrentTime(start);
      next.on('timeupdate', (data) => {
        if (typeof data.seconds === 'number') {
          position.current = data.seconds;
          reportRef.current?.(data.seconds, 'tick');
        }
      });
      next.on('play', () => reportRef.current?.(position.current, 'play'));
      next.on('pause', () => reportRef.current?.(position.current, 'pause'));
      next.on('seeked', (data) => {
        if (typeof data.seconds === 'number') position.current = data.seconds;
        reportRef.current?.(position.current, 'seek');
      });
    };
    document.body.appendChild(script);
    return () => {
      stopped = true;
      player?.destroy();
      script.remove();
    };
  }, [id, pageUrl, start, track]);
  return (
    <div className="overflow-hidden rounded-2xl bg-black">
      <iframe
        ref={frame}
        title={title}
        src={vimeoEmbedSrc(id, pageUrl)}
        className="aspect-video w-full"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}

function MuxFrame({
  playbackId,
  start,
  report,
}: {
  playbackId: string;
  start: number;
  report?: (seconds: number, event: PlaybackEvent) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const reportRef = useRef(report);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    reportRef.current = report;
  }, [report]);
  useEffect(() => {
    let cancelled = false;
    let node: HTMLElement | null = null;
    const mount = () => {
      if (cancelled || !host.current || !customElements.get('mux-player')) return;
      node = document.createElement('mux-player');
      node.setAttribute('playback-id', playbackId);
      node.setAttribute('accent-color', '#6A00FF');
      node.style.width = '100%';
      node.style.aspectRatio = '16 / 9';
      if (start > 1) node.setAttribute('start-time', String(Math.floor(start)));
      const emit = (event: PlaybackEvent) => {
        const seconds = Number((node as HTMLElement & { currentTime?: number }).currentTime);
        reportRef.current?.(Number.isFinite(seconds) ? seconds : 0, event);
      };
      node.addEventListener('play', () => emit('play'));
      node.addEventListener('pause', () => emit('pause'));
      node.addEventListener('seeked', () => emit('seek'));
      node.addEventListener('timeupdate', () => emit('tick'));
      host.current.replaceChildren(node);
    };
    const ready = customElements.whenDefined('mux-player').then(mount);
    let script = document.querySelector<HTMLScriptElement>('script[data-mux-player]');
    if (!script && !customElements.get('mux-player')) {
      script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@mux/mux-player@3';
      script.async = true;
      script.dataset.muxPlayer = '1';
      script.onerror = () => {
        if (!cancelled) setError('This Mux video did not load. Check that the playback id is allowed on this site.');
      };
      document.body.appendChild(script);
    }
    void ready.catch(() => {
      if (!cancelled) setError('This Mux video did not load. Check that the playback id is allowed on this site.');
    });
    return () => {
      cancelled = true;
      node?.remove();
    };
  }, [playbackId, start]);
  if (error) return <p className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-neutral-300">{error}</p>;
  return <div ref={host} className="overflow-hidden rounded-2xl bg-black" />;
}

function FileVideo({
  lessonId,
  start,
  report,
}: {
  lessonId: string;
  start: number;
  report?: (seconds: number, event: PlaybackEvent) => void;
}) {
  const reportRef = useRef(report);
  const refreshed = useRef(false);
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    reportRef.current = report;
  }, [report]);
  useEffect(() => {
    let cancelled = false;
    void openLessonVideo(lessonId).then((result) => {
      if (cancelled) return;
      if (!result.ok) setError(result.error);
      else setSrc(result.href);
    });
    return () => {
      cancelled = true;
    };
  }, [lessonId]);
  if (error) return <p className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-neutral-300">{error}</p>;
  if (!src) return <p className="rounded-2xl bg-black px-4 py-10 text-center text-sm text-neutral-400">Loading video…</p>;
  return (
    <div className="overflow-hidden rounded-2xl bg-black">
      <video
        src={src}
        controls
        playsInline
        preload="metadata"
        className="aspect-video w-full"
        onLoadedMetadata={(event) => {
          if (start > 1) event.currentTarget.currentTime = start;
        }}
        onPlay={(event) => reportRef.current?.(event.currentTarget.currentTime, 'play')}
        onPause={(event) => reportRef.current?.(event.currentTarget.currentTime, 'pause')}
        onSeeked={(event) => reportRef.current?.(event.currentTarget.currentTime, 'seek')}
        onTimeUpdate={(event) => reportRef.current?.(event.currentTarget.currentTime, 'tick')}
        onError={() => {
          if (refreshed.current) {
            setError('This video could not be played.');
            return;
          }
          refreshed.current = true;
          void openLessonVideo(lessonId).then((result) => {
            if (!result.ok) setError(result.error);
            else setSrc(result.href);
          });
        }}
      />
    </div>
  );
}

export function LessonMedia({
  lessonId,
  title,
  video,
  start = 0,
  track = false,
  report,
}: {
  lessonId: string;
  title: string;
  video: LessonVideo;
  start?: number;
  track?: boolean;
  report?: (seconds: number, event: PlaybackEvent) => void;
}) {
  if (video.provider === 'vimeo') {
    return <VimeoFrame id={video.id} pageUrl={video.url} title={title} start={start} track={track} report={report} />;
  }
  if (video.provider === 'mux') return <MuxFrame playbackId={video.id} start={start} report={report} />;
  return <FileVideo lessonId={lessonId} start={start} report={report} />;
}

export default function LessonPlayer({ lesson }: { lesson: LessonView }) {
  const position = useRef(lesson.positionSeconds);
  const playing = useRef(false);
  const [missing, setMissing] = useState(lesson.missing);
  const [complete, setComplete] = useState(lesson.complete);
  const [scrolled, setScrolled] = useState(lesson.scrolled);
  const [note, setNote] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const html = renderLesson(lesson.body);
  const writtenOnly = !lesson.video && lesson.body.trim().length > 0;

  const reportPlayback = (seconds: number, event: PlaybackEvent) => {
    position.current = seconds;
    if (lesson.preview) return;
    if (event === 'play') playing.current = true;
    if (event === 'pause') playing.current = false;
    if (event === 'pause' || event === 'seek') {
      void recordPlayback(lesson.id, seconds).then((result) => {
        setMissing(result.missing);
        setComplete(result.complete);
      });
    }
  };

  useEffect(() => {
    if (lesson.preview || !lesson.video) return;
    const timer = window.setInterval(() => {
      if (!playing.current) return;
      void recordPlayback(lesson.id, position.current).then((result) => {
        setMissing(result.missing);
        setComplete(result.complete);
      });
    }, 2000);
    return () => window.clearInterval(timer);
  }, [lesson.id, lesson.preview, lesson.video]);

  useEffect(() => {
    if (lesson.preview || !writtenOnly) return;
    const started = Date.now();
    let last = started;
    const tick = () => {
      if (document.visibilityState !== 'visible') {
        last = Date.now();
        return;
      }
      const seconds = Math.round((Date.now() - last) / 1000);
      last = Date.now();
      if (seconds <= 0) return;
      void recordReading(lesson.id, seconds, scrolled).then((result) => {
        setMissing(result.missing);
        setComplete(result.complete);
      });
    };
    const timer = window.setInterval(tick, 5000);
    return () => window.clearInterval(timer);
  }, [lesson.id, lesson.preview, scrolled, writtenOnly]);

  useEffect(() => {
    if (!endRef.current || lesson.preview) return;
    const target = endRef.current;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setScrolled(true);
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [lesson.preview]);

  return (
    <article className="space-y-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#937DFF]">
          {lesson.code} · {lesson.moduleTitle}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{lesson.title}</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Lesson {lesson.position} of {lesson.total}
        </p>
      </div>

      {lesson.video ? (
        <LessonMedia
          lessonId={lesson.id}
          title={lesson.title}
          video={lesson.video}
          start={lesson.positionSeconds}
          track={!lesson.preview}
          report={lesson.preview ? undefined : reportPlayback}
        />
      ) : null}

      {html.trim() ? (
        <div
          className="lesson-body space-y-3 text-base leading-7 text-neutral-100"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : null}
      <div ref={endRef} aria-hidden className="h-px" />

      {lesson.hasDocument ? (
        <button
          type="button"
          className="inline-flex min-h-11 items-center rounded-xl border border-white/15 px-4 text-sm font-semibold"
          onClick={() => {
            if (lesson.preview) {
              window.open(`/workspace/academy/documents/${lesson.id}`, '_blank', 'noopener');
              return;
            }
            void openDocument(lesson.id).then((result) => {
              if (!result.ok) {
                setNote(result.error);
                return;
              }
              setMissing((current) => current.filter((item) => !item.toLowerCase().includes('document')));
              window.open(result.href, '_blank', 'noopener');
            });
          }}
        >
          Open {lesson.documentName ?? 'companion document'}
        </button>
      ) : null}

      {note ? <p className="text-sm text-red-200">{note}</p> : null}

      <div className="sticky bottom-3 rounded-3xl border border-white/10 bg-[#100f18]/95 p-4 shadow-[0_16px_50px_-24px_rgba(106,0,255,0.8)]">
        {complete ? <p className="text-sm font-semibold text-[#937DFF]">Completed.</p> : null}
        {missing.length > 0 && !complete ? (
          <ul className="mb-3 space-y-1 text-sm text-neutral-300">
            {missing.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
        <button
          type="button"
          disabled={complete || missing.length > 0}
          className="min-h-12 w-full rounded-2xl bg-[#9A88FC] text-sm font-semibold text-[#07070b] disabled:opacity-40"
          onClick={() => {
            if (lesson.preview) {
              setNote('This is the student view. Progress is not recorded.');
              return;
            }
            void markLessonComplete(lesson.id).then((result) => {
              setMissing(result.missing);
              setComplete(result.complete);
            });
          }}
        >
          Mark complete
        </button>
      </div>

      <div className="flex items-center justify-between gap-3 text-sm">
        {lesson.prevId ? (
          <Link href={lesson.preview ? `/workspace/academy/preview/${lesson.prevId}` : `/academy/modules/${lesson.moduleId}/lessons/${lesson.prevId}`} className="min-h-11 inline-flex items-center text-[#937DFF]">
            Previous
          </Link>
        ) : (
          <span />
        )}
        {lesson.nextId && (lesson.nextOpen || lesson.preview) ? (
          <Link href={lesson.preview ? `/workspace/academy/preview/${lesson.nextId}` : `/academy/modules/${lesson.moduleId}/lessons/${lesson.nextId}`} className="min-h-11 inline-flex items-center text-[#937DFF]">
            Next
          </Link>
        ) : (
          <span className="text-neutral-500">{lesson.nextId ? 'Next lesson is locked' : ''}</span>
        )}
      </div>
    </article>
  );
}
