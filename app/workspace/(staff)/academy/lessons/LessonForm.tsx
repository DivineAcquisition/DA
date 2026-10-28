'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { LessonMedia } from '@/app/academy/components/LessonPlayer';
import { archiveLesson, overrideProgress, prepareLessonVideoUpload, reorderLesson, saveLesson } from '@/lib/academy/adminActions';
import type { LessonVideo } from '@/lib/academy/lessonView';
import { videoFileError } from '@/lib/academy/video';
import { uploadLessonVideo } from '@/lib/academy/videoUpload';
import { Button, Field, Input, Select } from '../../components/ui';

type ModuleOption = { id: string; label: string };
type LessonFields = {
  id?: string;
  moduleId: string;
  code: string;
  title: string;
  order: number;
  status: string;
  watch: number;
  body: string;
  videoUrl: string;
  duration: string;
  playback: LessonVideo | null;
  videoFileName: string | null;
  documentName: string | null;
  completions: number;
  modules: ModuleOption[];
};

export default function LessonForm({ lesson }: { lesson: LessonFields }) {
  const router = useRouter();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [pendingLabel, setPendingLabel] = useState('Saving…');
  const previewAfter = useRef(false);

  function wrap(before: string, after = before) {
    const node = bodyRef.current;
    if (!node) return;
    const start = node.selectionStart;
    const end = node.selectionEnd;
    const selected = node.value.slice(start, end) || 'text';
    node.setRangeText(`${before}${selected}${after}`, start, end, 'end');
    node.focus();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8 sm:px-6">
      <div>
        <Link href="/workspace/academy" className="text-sm font-semibold text-brand-200">
          Back to lessons
        </Link>
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-300">Academy</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
          {lesson.id ? 'Edit lesson' : 'New lesson'}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-400">
          {lesson.id
            ? `${lesson.code} stays the id trainees and imports use.`
            : 'Save it as a draft first. Set it live when it has a title and a video or written lesson. Trainees only see Live lessons.'}
        </p>
      </div>
      <form
        ref={formRef}
        className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.02] p-4 sm:p-6"
        action={(formData) => {
          setError(null);
          startTransition(async () => {
            const chosen = formRef.current?.querySelector<HTMLInputElement>('input[data-video-file]')?.files?.[0];
            const status = String(formData.get('status') ?? '');
            const duration = Number(formData.get('duration') ?? '');
            const link = String(formData.get('video') ?? '').trim();
            const clearing = formData.get('clear_video') === 'on' && !chosen;
            const hasVideo = Boolean(chosen || link || (lesson.playback && !clearing));
            if (status === 'live' && hasVideo && !(duration > 0)) {
              setError('Enter the video duration in seconds before this lesson goes live.');
              return;
            }
            if (chosen && chosen.size > 0) {
              const problem = videoFileError(chosen.name, chosen.size);
              if (problem) {
                setError(problem);
                return;
              }
              setPendingLabel('Uploading video…');
              const prepared = await prepareLessonVideoUpload({
                lessonCode: String(formData.get('lesson_code') ?? ''),
                fileName: chosen.name,
                size: chosen.size,
              });
              if (!prepared.ok) {
                setError(prepared.error);
                setPendingLabel('Saving…');
                return;
              }
              const uploaded = await uploadLessonVideo(chosen, prepared.path, prepared.token);
              if (!uploaded.ok) {
                setError(uploaded.error);
                setPendingLabel('Saving…');
                return;
              }
              formData.set('video_path', prepared.path);
              formData.set('video_file_name', prepared.fileName);
              setPendingLabel('Saving…');
            }
            const result = await saveLesson(formData);
            const viewStudent = previewAfter.current;
            previewAfter.current = false;
            if (!result.ok) setError(result.error ?? 'The lesson was not saved.');
            else if (viewStudent && result.id) router.push(`/workspace/academy/preview/${result.id}`);
            else if (result.id) router.push(`/workspace/academy/lessons/${result.id}`);
            else router.refresh();
          });
        }}
      >
        {lesson.id ? <input type="hidden" name="id" value={lesson.id} /> : null}
        <Field label="Module">
          <Select name="module_id" defaultValue={lesson.moduleId}>
            {lesson.modules.map((module) => (
              <option key={module.id} value={module.id}>
                {module.label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Lesson ID" hint="M07-L03 matches module 7, lesson 3.">
            <Input name="lesson_code" defaultValue={lesson.code} required />
          </Field>
          <Field label="Order">
            <Input name="sort_order" type="number" min={1} defaultValue={lesson.order} required />
          </Field>
        </div>
        <Field label="Title">
          <Input name="title" defaultValue={lesson.title} required />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Status" hint="Draft and Ready stay in this builder. Trainees only see a lesson after you set it to Live and save.">
            <Select name="status" defaultValue={lesson.status}>
              <option value="draft">Draft</option>
              <option value="ready">Ready</option>
              <option value="live">Live</option>
            </Select>
          </Field>
          <Field label="Required watch %">
            <Input name="watch" type="number" min={1} max={100} defaultValue={lesson.watch} />
          </Field>
        </div>
        <Field label="Written lesson">
          <div className="mb-2 flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => wrap('## ', '')}>
              Heading
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => wrap('**')}>
              Bold
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => wrap('- ', '')}>
              List
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => wrap('[', '](https://)')}>
              Link
            </Button>
          </div>
          <textarea
            ref={bodyRef}
            name="body"
            rows={14}
            defaultValue={lesson.body}
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-base leading-relaxed text-white outline-none focus:border-brand-400/60"
          />
        </Field>
        {lesson.id && lesson.playback ? (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-white">Current video</p>
            {lesson.playback.provider === 'file' && lesson.videoFileName ? (
              <p className="text-sm text-neutral-400">Uploaded file: {lesson.videoFileName}</p>
            ) : null}
            <LessonMedia lessonId={lesson.id} title={lesson.title || lesson.code} video={lesson.playback} />
          </div>
        ) : null}
        <Field
          label="Video file"
          hint={
            lesson.videoFileName
              ? `Current file: ${lesson.videoFileName}. A new file replaces it. mp4, webm, mov, or m4v, up to 100 MB.`
              : 'mp4, webm, mov, or m4v, up to 100 MB. Larger videos should use a Vimeo or Mux link.'
          }
        >
          <Input
            data-video-file
            type="file"
            accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const problem = videoFileError(file.name, file.size);
              if (problem) {
                setError(problem);
                event.target.value = '';
                return;
              }
              setError(null);
              const url = URL.createObjectURL(file);
              const probe = document.createElement('video');
              probe.preload = 'metadata';
              probe.onloadedmetadata = () => {
                const seconds = Math.round(probe.duration);
                const field = formRef.current?.elements.namedItem('duration');
                if (Number.isFinite(seconds) && seconds > 0 && field instanceof HTMLInputElement && !field.value) {
                  field.value = String(seconds);
                }
                URL.revokeObjectURL(url);
              };
              probe.src = url;
            }}
          />
        </Field>
        <Field label="Video link" hint="Vimeo or Mux, including the privacy code on an unlisted Vimeo link. Playback must be limited to training.divineacquisition.io. A file upload is used instead of this link.">
          <Input name="video" defaultValue={lesson.videoUrl} placeholder="Vimeo or Mux link" />
        </Field>
        <Field label="Duration in seconds" hint="Required before a video lesson can go Live.">
          <Input name="duration" type="number" min={1} defaultValue={lesson.duration} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-neutral-300">
          <input type="checkbox" name="clear_video" />
          Remove the current video
        </label>
        <Field label="Companion document" hint={lesson.documentName ? `Current file: ${lesson.documentName}. A new upload keeps the old version.` : 'PDF or a common document file.'}>
          <Input name="document" type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.rtf" />
        </Field>
        {lesson.completions > 0 ? (
          <fieldset className="space-y-2 rounded-2xl border border-white/10 p-4">
            <legend className="px-1 text-sm text-white">Trainees have already completed this lesson</legend>
            <label className="flex gap-2 text-sm text-neutral-300">
              <input type="radio" name="completion_policy" value="keep" />
              Keep their completion
            </label>
            <label className="flex gap-2 text-sm text-neutral-300">
              <input type="radio" name="completion_policy" value="review" />
              Require them to review it again
            </label>
          </fieldset>
        ) : null}
        {error ? (
          <p className="rounded-2xl border border-flag-critical/40 bg-flag-critical/10 px-4 py-3 text-sm text-red-100" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            disabled={pending}
            onClick={() => {
              previewAfter.current = false;
            }}
          >
            {pending ? pendingLabel : 'Save lesson'}
          </Button>
          <Button
            type="submit"
            variant="secondary"
            disabled={pending}
            onClick={() => {
              previewAfter.current = true;
            }}
          >
            Save and view as student
          </Button>
          {lesson.id ? (
            <a href={`/workspace/academy/preview/${lesson.id}`} className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-4 text-sm text-white">
              Open saved student view
            </a>
          ) : null}
        </div>
      </form>

      {lesson.id ? (
        <div className="flex gap-2">
          <form action={reorderLesson}>
            <input type="hidden" name="id" value={lesson.id} />
            <input type="hidden" name="direction" value="up" />
            <Button type="submit" variant="secondary" size="sm">
              Move up
            </Button>
          </form>
          <form action={reorderLesson}>
            <input type="hidden" name="id" value={lesson.id} />
            <input type="hidden" name="direction" value="down" />
            <Button type="submit" variant="secondary" size="sm">
              Move down
            </Button>
          </form>
          <form action={archiveLesson}>
            <input type="hidden" name="id" value={lesson.id} />
            <Button type="submit" variant="danger" size="sm">
              Archive
            </Button>
          </form>
        </div>
      ) : null}

      {lesson.id ? (
        <form
          className="space-y-3 rounded-2xl border border-white/10 p-4"
          action={(formData) => {
            setOverrideError(null);
            void overrideProgress(formData).then((result) => {
              if (!result.ok) setOverrideError(result.error ?? 'The override was not saved.');
            });
          }}
        >
          <h2 className="text-sm font-semibold text-white">Override a trainee&apos;s progress</h2>
          <input type="hidden" name="lesson_id" value={lesson.id} />
          <Field label="Trainee email">
            <Input name="email" type="email" required />
          </Field>
          <Field label="Status">
            <Select name="status" defaultValue="completed">
              <option value="not_started">Not started</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
            </Select>
          </Field>
          <Field label="Reason">
            <Input name="reason" required />
          </Field>
          {overrideError ? <p className="text-sm text-red-300">{overrideError}</p> : null}
          <Button type="submit" variant="secondary">
            Record override
          </Button>
        </form>
      ) : null}
    </div>
  );
}
