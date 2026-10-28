'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { saveQuestion } from '@/lib/academy/quizAdmin';
import { Button, Field, Input, Select } from '../../components/ui';

type Concept = { id: string; module_id: string; name: string };
type ModuleOption = { id: string; label: string };

export default function QuestionForm({
  modules,
  concepts,
  question,
}: {
  modules: ModuleOption[];
  concepts: Concept[];
  question?: {
    id: string;
    module_id: string;
    prompt: string;
    question_type: string;
    scenario: string | null;
    options: { id: string; text: string }[];
    correct_answer: string;
    explanation: string;
    concept_id: string | null;
    difficulty: string;
    active: boolean;
  };
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const option = (id: string) => question?.options.find((item) => item.id === id)?.text ?? '';
  return (
    <form
      className="space-y-4"
      action={(formData) => {
        setError(null);
        void saveQuestion(formData).then((result) => {
          if (!result.ok) setError(result.error ?? 'The question was not saved.');
          else if (result.id) router.push('/workspace/academy/questions');
        });
      }}
    >
      {question?.id ? <input type="hidden" name="id" value={question.id} /> : null}
      <Field label="Module">
        <Select name="module_id" defaultValue={question?.module_id ?? modules[0]?.id}>
          {modules.map((module) => (
            <option key={module.id} value={module.id}>
              {module.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Question">
        <Input name="prompt" defaultValue={question?.prompt} required />
      </Field>
      <Field label="Type">
        <Select name="question_type" defaultValue={question?.question_type ?? 'multiple_choice'}>
          <option value="multiple_choice">Multiple choice</option>
          <option value="scenario">Scenario</option>
        </Select>
      </Field>
      <Field label="Scenario" hint="Required for a scenario question.">
        <Input name="scenario" defaultValue={question?.scenario ?? ''} />
      </Field>
      {(['a', 'b', 'c', 'd'] as const).map((id) => (
        <Field key={id} label={`Option ${id.toUpperCase()}`}>
          <Input name={`option_${id}`} defaultValue={option(id)} />
        </Field>
      ))}
      <Field label="Correct option">
        <Select name="correct" defaultValue={question?.correct_answer ?? 'a'}>
          <option value="a">A</option>
          <option value="b">B</option>
          <option value="c">C</option>
          <option value="d">D</option>
        </Select>
      </Field>
      <Field label="Explanation" hint="Shown only after a pass.">
        <Input name="explanation" defaultValue={question?.explanation ?? ''} />
      </Field>
      <Field label="Concept tag">
        <Select name="concept_id" defaultValue={question?.concept_id ?? concepts[0]?.id}>
          {concepts.map((concept) => (
            <option key={concept.id} value={concept.id}>
              {concept.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Difficulty">
        <Select name="difficulty" defaultValue={question?.difficulty === 'foundation' ? 'easy' : question?.difficulty === 'advanced' ? 'hard' : question?.difficulty === 'standard' ? 'medium' : question?.difficulty ?? 'medium'}>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </Select>
      </Field>
      <label className="flex items-center gap-2 text-sm text-neutral-300">
        <input type="checkbox" name="active" defaultChecked={question?.active ?? true} />
        Active
      </label>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <Button type="submit">Save question</Button>
    </form>
  );
}
