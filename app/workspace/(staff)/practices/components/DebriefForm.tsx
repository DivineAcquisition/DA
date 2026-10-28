'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveDebriefAction } from '@/lib/workspace/practice-actions';
import {
  DEBRIEF_OUTCOMES,
  DEBRIEF_TIMELINES,
  debriefDraftFrom,
  debriefOutcomeLabel,
  debriefTimelineLabel,
  formatNumberInput,
  OBJECTION_CHIPS,
  parseNumberInput,
  type DebriefDraft,
  type DebriefOutcome,
  type DebriefRecord,
  type DebriefTimeline,
} from '@/lib/workspace/practices';
import { Button, Field, Input, Textarea } from '../../components/ui';
import { CurrencyInput } from './fields';
import { useDebounced } from '../useDebounced';

function headingClass(extra = '') {
  return `font-[family-name:var(--font-plus-jakarta)] tracking-tight text-white ${extra}`;
}

type FormValues = {
  outcome: DebriefOutcome | '';
  biggest_leak: string;
  their_words: string;
  objections_raised: string[];
  objection_notes: string;
  decision_makers: string;
  timeline: DebriefTimeline | '';
  proposed_price: string;
  next_step: string;
  next_step_due: string;
  fit_rating: number | null;
  would_i_take_them: boolean | null;
  notes: string;
};

function valuesFrom(debrief: DebriefRecord | null): FormValues {
  const draft = debriefDraftFrom(debrief);
  return {
    outcome: draft.outcome ?? '',
    biggest_leak: draft.biggest_leak ?? '',
    their_words: draft.their_words ?? '',
    objections_raised: [...draft.objections_raised],
    objection_notes: draft.objection_notes ?? '',
    decision_makers: draft.decision_makers ?? '',
    timeline: draft.timeline ?? '',
    proposed_price: formatNumberInput(draft.proposed_price),
    next_step: draft.next_step ?? '',
    next_step_due: draft.next_step_due ?? '',
    fit_rating: draft.fit_rating,
    would_i_take_them: draft.would_i_take_them,
    notes: draft.notes ?? '',
  };
}

function toDraft(values: FormValues): DebriefDraft {
  return {
    outcome: values.outcome || null,
    biggest_leak: values.biggest_leak,
    their_words: values.their_words,
    objections_raised: values.objections_raised,
    objection_notes: values.objection_notes,
    decision_makers: values.decision_makers,
    timeline: values.timeline || null,
    proposed_price: parseNumberInput(values.proposed_price),
    next_step: values.next_step,
    next_step_due: values.next_step_due || null,
    fit_rating: values.fit_rating,
    would_i_take_them: values.would_i_take_them,
    notes: values.notes,
  };
}

export default function DebriefForm({
  practiceId,
  debrief,
}: {
  practiceId: string;
  debrief: DebriefRecord | null;
}) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(() => valuesFrom(debrief));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const debriefIdRef = useRef(debrief?.id ?? null);
  const valuesRef = useRef(values);

  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  const patch = useCallback(<K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
  }, []);

  const persist = useCallback(
    async (applyOutcomeStage: boolean) => {
      const result = await saveDebriefAction(
        practiceId,
        debriefIdRef.current,
        toDraft(valuesRef.current),
        applyOutcomeStage,
      );
      if (!result.ok) {
        setError(result.error);
        return false;
      }
      setError(null);
      if (typeof result.data?.id === 'string') debriefIdRef.current = result.data.id;
      return true;
    },
    [practiceId],
  );

  useDebounced(values, 2000, () => {
    startTransition(() => {
      void persist(false);
    });
  }, true);

  function toggleObjection(chip: string) {
    setValues((current) => ({
      ...current,
      objections_raised: current.objections_raised.includes(chip)
        ? current.objections_raised.filter((item) => item !== chip)
        : [...current.objections_raised, chip],
    }));
  }

  return (
    <div className="mx-auto w-full max-w-[720px] space-y-6">
      <div>
        <p className={headingClass('mb-3 text-sm font-semibold')}>Outcome</p>
        <div className="space-y-2" role="radiogroup" aria-label="Outcome">
          {DEBRIEF_OUTCOMES.map((outcome) => {
            const active = values.outcome === outcome;
            return (
              <button
                key={outcome}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => patch('outcome', outcome)}
                className="w-full rounded-2xl border px-4 py-3 text-left text-sm font-semibold"
                style={{
                  borderColor: active ? '#937DFF' : '#2A2A3A',
                  backgroundColor: active ? '#937DFF22' : '#1C1C26',
                  color: active ? '#937DFF' : '#B0AEC0',
                }}
              >
                {debriefOutcomeLabel(outcome)}
              </button>
            );
          })}
        </div>
      </div>

      <Field label="Biggest leak" hint="The one gap to lead the proposal with">
        <Input value={values.biggest_leak} onChange={(e) => patch('biggest_leak', e.target.value)} />
      </Field>

      <Field label="Their words" hint="Direct quotes worth reusing in the proposal">
        <Textarea value={values.their_words} onChange={(e) => patch('their_words', e.target.value)} />
      </Field>

      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
          Objections raised
        </p>
        <div className="flex flex-wrap gap-2">
          {OBJECTION_CHIPS.map((chip) => {
            const active = values.objections_raised.includes(chip);
            return (
              <button
                key={chip}
                type="button"
                aria-pressed={active}
                onClick={() => toggleObjection(chip)}
                className="rounded-full border px-3 py-1.5 text-[12px] font-semibold"
                style={{
                  borderColor: active ? '#937DFF' : '#2A2A3A',
                  backgroundColor: active ? '#937DFF22' : 'transparent',
                  color: active ? '#937DFF' : '#6E6C80',
                }}
              >
                {chip}
              </button>
            );
          })}
        </div>
      </div>

      {values.objections_raised.length > 0 && (
        <Field label="Objection notes">
          <Textarea value={values.objection_notes} onChange={(e) => patch('objection_notes', e.target.value)} />
        </Field>
      )}

      <Field label="Who else decides">
        <Input value={values.decision_makers} onChange={(e) => patch('decision_makers', e.target.value)} />
      </Field>

      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Timeline</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Timeline">
          {DEBRIEF_TIMELINES.map((timeline) => {
            const active = values.timeline === timeline;
            return (
              <button
                key={timeline}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => patch('timeline', timeline)}
                className="rounded-full border px-3 py-1.5 text-[12px] font-semibold"
                style={{
                  borderColor: active ? '#937DFF' : '#2A2A3A',
                  backgroundColor: active ? '#937DFF22' : 'transparent',
                  color: active ? '#937DFF' : '#6E6C80',
                }}
              >
                {debriefTimelineLabel(timeline)}
              </button>
            );
          })}
        </div>
      </div>

      <Field label="Proposed price">
        <CurrencyInput
          value={values.proposed_price}
          onChange={(value) => patch('proposed_price', value)}
          ariaLabel="Proposed price"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Next step">
          <Input value={values.next_step} onChange={(e) => patch('next_step', e.target.value)} />
        </Field>
        <Field label="Due">
          <Input
            type="date"
            value={values.next_step_due}
            onChange={(e) => patch('next_step_due', e.target.value)}
          />
        </Field>
      </div>

      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Fit</p>
        <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Fit rating">
          {[1, 2, 3, 4, 5].map((rating) => {
            const active = values.fit_rating === rating;
            return (
              <button
                key={rating}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => patch('fit_rating', rating)}
                className="h-10 w-10 rounded-full border text-sm font-semibold"
                style={{
                  borderColor: active ? '#937DFF' : '#2A2A3A',
                  backgroundColor: active ? '#937DFF' : 'transparent',
                  color: active ? '#0B0B0F' : '#B0AEC0',
                }}
              >
                {rating}
              </button>
            );
          })}
        </div>
        <p className="mt-4 mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
          Would I take them as a client?
        </p>
        <div className="flex overflow-hidden rounded-xl border border-white/10" role="radiogroup" aria-label="Would I take them as a client?">
          {[
            { label: 'Yes', value: true },
            { label: 'No', value: false },
          ].map((option) => {
            const active = values.would_i_take_them === option.value;
            return (
              <button
                key={option.label}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => patch('would_i_take_them', option.value)}
                className="flex-1 py-2 text-sm font-semibold"
                style={{
                  backgroundColor: active ? '#937DFF' : 'transparent',
                  color: active ? '#0B0B0F' : '#6E6C80',
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <Field label="Notes">
        <Textarea value={values.notes} onChange={(e) => patch('notes', e.target.value)} />
      </Field>

      {error && <p className="text-sm text-[#FF6A6A]">{error}</p>}

      <Button
        type="button"
        disabled={pending}
        style={{ backgroundColor: '#6A00FF', color: '#fff' }}
        onClick={() => {
          startTransition(async () => {
            const ok = await persist(true);
            if (ok) router.refresh();
          });
        }}
      >
        Save debrief
      </Button>
    </div>
  );
}
