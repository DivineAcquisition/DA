'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { renderLesson } from '@/lib/academy/markdown';
import type { LessonView } from '@/lib/academy/lessonView';
import { markLessonComplete, openDocument, recordPlayback, recordReading } from '@/lib/academy/lessonActions';

type VimeoPlayer = {
  on: (event: string, cb: (data: { seconds?: number }) => void) => void;
  setCurrentTime: (seconds: number) => Promise<void>;
  destroy: () => void;
};

declare global {
  interface Window {
    Vimeo?: { Player: new (frame: HTMLIFrameElement) => VimeoPlayer };
  }
}

function MuxFrame({
  playbackId,
  start,
  report,
}: {
  playbackId: string;
  start: number;
  report?: (seconds: number, event: 'tick' | 'play' | 'pause') => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const reportRef = useRef(report);
  useEffect(() => {
    reportRef.current = report;
  }, [report]);
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@mux/mux-player@3';
    script.async = true;
    document.body.appendChild(script);
    const node = document.createElement('mux-player');
    node.setAttribute('playback-id', playbackId);
    node.setAttribute('accent-color', '#6A00FF');
    node.style.width = '100%';
    node.style.aspectRatio = '16 / 9';
    if (start > 1) node.setAttribute('start-time', String(Math.floor(start)));
    const emit = (event: 'tick' | 'play' | 'pause') => {
      const seconds = Number((node as HTMLElement & { currentTime?: number }).currentTime);
      reportRef.current?.(Number.isFinite(seconds) ? seconds : 0, event);
    };
    const onPlay = () => emit('play');
    const onPause = () => emit('pause');
    const onTick = () => emit('tick');
    node.addEventListener('play', onPlay);
    node.addEventListener('pause', onPause);
    node.addEventListener('seeked', onPause);
    node.addEventListener('timeupdate', onTick);
    host.current?.replaceChildren(node);
    return () => {
      node.remove();
      script.remove();
    };
  }, [playbackId, start]);
  return <div ref={host} className="overflow-hidden rounded-2xl bg-black" />;
}

export default function LessonPlayer({ lesson }: { lesson: LessonView }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const player = useRef<VimeoPlayer | null>(null);
  const position = useRef(lesson.positionSeconds);
  const playing = useRef(false);
  const [missing, setMissing] = useState(lesson.missing);
  const [complete, setComplete] = useState(lesson.complete);
  const [scrolled, setScrolled] = useState(lesson.scrolled);
  const [note, setNote] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const html = renderLesson(lesson.body);
  const writtenOnly = !lesson.video && lesson.body.trim().length > 0;

  useEffect(() => {
    if (lesson.preview || !lesson.video || lesson.video.provider !== 'vimeo' || !frame.current) return;
    let timer = 0;
    let stopped = false;
    const frameEl = frame.current;
    const script = document.createElement('script');
    script.src = 'https://player.vimeo.com/api/player.js';
    script.async = true;
    script.onload = () => {
      if (stopped || !window.Vimeo || !frameEl) return;
      const next = new window.Vimeo.Player(frameEl);
      player.current = next;
      if (lesson.positionSeconds > 1) void next.setCurrentTime(lesson.positionSeconds);
      const flush = () => {
        if (lesson.preview) return;
        void recordPlayback(lesson.id, position.current).then((result) => {
          setMissing(result.missing);
          setComplete(result.complete);
        });
      };
      next.on('timeupdate', (data) => {
        if (typeof data.seconds === 'number') position.current = data.seconds;
      });
      next.on('play', () => {
        playing.current = true;
        window.clearInterval(timer);
        timer = window.setInterval(() => {
          if (playing.current) flush();
        }, 2000);
      });
      next.on('pause', () => {
        playing.current = false;
        window.clearInterval(timer);
        flush();
      });
      next.on('seeked', (data) => {
        if (typeof data.seconds === 'number') position.current = data.seconds;
        flush();
      });
    };
    document.body.appendChild(script);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      player.current?.destroy();
      script.remove();
    };
  }, [lesson.id, lesson.preview, lesson.positionSeconds, lesson.video]);

  const reportMux = (seconds: number, event: 'tick' | 'play' | 'pause') => {
    position.current = seconds;
    if (event === 'play') playing.current = true;
    if (event === 'pause') {
      playing.current = false;
      void recordPlayback(lesson.id, seconds).then((result) => {
        setMissing(result.missing);
        setComplete(result.complete);
      });
    }
  };

  useEffect(() => {
    if (lesson.preview || lesson.video?.provider !== 'mux') return;
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

      {lesson.preview ? (
        <p className="rounded-2xl border border-[#937DFF]/40 bg-[#6A00FF]/15 px-4 py-3 text-sm">Preview. This does not record progress.</p>
      ) : null}

      {lesson.video?.provider === 'vimeo' ? (
        <div className="overflow-hidden rounded-2xl bg-black">
          <iframe
            ref={frame}
            title={lesson.title}
            src={`https://player.vimeo.com/video/${lesson.video.id}?dnt=1`}
            className="aspect-video w-full"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : null}

      {lesson.video?.provider === 'mux' ? (
        <MuxFrame playbackId={lesson.video.id} start={lesson.positionSeconds} report={lesson.preview ? undefined : reportMux} />
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

      {!lesson.preview ? (
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
              void markLessonComplete(lesson.id).then((result) => {
                setMissing(result.missing);
                setComplete(result.complete);
              });
            }}
          >
            Mark complete
          </button>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 text-sm">
        {lesson.prevId ? (
          <Link href={`/academy/modules/${lesson.moduleId}/lessons/${lesson.prevId}`} className="min-h-11 inline-flex items-center text-[#937DFF]">
            Previous
          </Link>
        ) : (
          <span />
        )}
        {lesson.nextId && lesson.nextOpen ? (
          <Link href={`/academy/modules/${lesson.moduleId}/lessons/${lesson.nextId}`} className="min-h-11 inline-flex items-center text-[#937DFF]">
            Next
          </Link>
        ) : (
          <span className="text-neutral-500">{lesson.nextId ? 'Next lesson is locked' : ''}</span>
        )}
      </div>
    </article>
  );
}
