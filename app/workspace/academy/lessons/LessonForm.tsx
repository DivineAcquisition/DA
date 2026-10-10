'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { archiveLesson, overrideProgress, reorderLesson, saveLesson } from '@/lib/academy/adminActions';
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
  documentName: string | null;
  completions: number;
  modules: ModuleOption[];
};

export default function LessonForm({ lesson }: { lesson: LessonFields }) {
  const router = useRouter();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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
            : 'Save it as a draft first. Set it live when it has a title and a video or written lesson.'}
        </p>
      </div>
      <form
        className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.02] p-4 sm:p-6"
        action={(formData) => {
          setError(null);
          startTransition(async () => {
            const result = await saveLesson(formData);
            if (!result.ok) setError(result.error ?? 'The lesson was not saved.');
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
          <Field label="Status">
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
        <Field label="Video link" hint="Vimeo or Mux. Playback must be limited to training.divineacquisition.io.">
          <Input name="video" defaultValue={lesson.videoUrl} placeholder="Vimeo or Mux link" />
        </Field>
        <Field label="Duration in seconds">
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
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Save lesson'}
          </Button>
          {lesson.id ? (
            <a href={`/workspace/academy/preview/${lesson.id}`} className="inline-flex items-center rounded-full border border-white/15 px-4 py-2 text-sm text-white">
              Preview
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
